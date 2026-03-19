import { 
  Kafka,
  Consumer,
  EachMessagePayload 
} from 'kafkajs';
import { injectable, inject } from 'inversify';
import pino from 'pino';

import { IKafkaEventConsumer } from '../../interfaces/kafka/kafka-event-consumer.interface';
import { TYPES } from '../../types';
import { EventDispatcher } from '../../events/dispatcher/dispatcher.event';

@injectable()
export class KafkaEventConsumerProvider implements IKafkaEventConsumer {
  private consumer: Consumer;
  private logger = pino({
    name: KafkaEventConsumerProvider.name,
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
      },
    },
  });

  constructor(
    @inject(TYPES.EventDispatcher) private eventDispatcher: EventDispatcher
  ) {
    const kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'card-issuer-client',
      brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
    });

    this.consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID || 'card-issuer-group' });
  }

  async connect(): Promise<void> {
    try {
      await this.consumer.connect();
      this.logger.info('Kafka Consumer connected successfully');
    } catch (error) {
      this.logger.error(`Error connecting Kafka Consumer: ${(error as Error).message}`);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
  }

  async startListening(topics: string[]): Promise<void> {
    await this.consumer.subscribe({ topics, fromBeginning: true });

    await this.consumer.run({
      eachMessage: async ({ topic, message }: EachMessagePayload) => {
        try {
          if (!message.value) return;
          const cloudEvent = JSON.parse(message.value.toString());
          await this.eventDispatcher.dispatch(cloudEvent);
        } catch (error) {
          this.logger.error(`Error general procesando mensaje en ${topic}: ${(error as Error).message}`);
        }
      },
    });
  }
}
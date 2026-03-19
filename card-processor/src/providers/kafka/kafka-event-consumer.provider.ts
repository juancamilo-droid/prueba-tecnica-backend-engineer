import { 
  Kafka,
  Consumer,
  EachMessagePayload 
} from 'kafkajs';
import { injectable } from 'inversify';
import pino from 'pino';

import { IKafkaEventConsumer } from '../../interfaces/kafka/kafka-event-consumer.interface';

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

  constructor() {
    const kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'card-processor-client',
      brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
    });

    this.consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID || 'card-processor-group' });
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
    this.logger.info('Kafka Consumer disconnected successfully');
  }

  async subscribeAndListen<T>(topic: string, handler: (payload: T) => Promise<void>): Promise<void> {
    await this.consumer.subscribe({ topic, fromBeginning: true });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
        try {
          if (!message.value) return;

          const payload = JSON.parse(message.value.toString());
          
          await handler(payload);

        } catch (error) {
          this.logger.error(`Error processing message from topic ${topic}: ${(error as Error).message}`);
        }
      },
    });
  }
}
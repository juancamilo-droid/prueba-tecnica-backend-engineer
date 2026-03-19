import { inject, injectable } from 'inversify';
import pino from 'pino';

import { ICardIssuePayload } from '../../interfaces/cards/card-issue-payload.interface';
import { ICardProcessorService } from '../../interfaces/cards/card-processor.interface';
import { TYPES } from '../../types';
import { ICardEmission } from '../../interfaces/cards/card-emission.interface';
import { IKafkaEventBroker } from '../../interfaces/kafka/kafka-event-broker.interface';
import { IKafkaCloudEvent } from '../../interfaces/kafka/kafka-cloud-event.interface';
import { KAFKA_TOPICS } from '../../shared/constants';
import { ICardRetriesService } from '../../interfaces/cards/card-retries.interface';

@injectable()
export class CardProcessorService implements ICardProcessorService {
  private logger = pino({
    name: CardProcessorService.name,
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
    @inject(TYPES.CardRetriesService) private readonly cardRetriesService: ICardRetriesService,
    @inject(TYPES.KafkaEventBrokerProvider) private readonly kafkaEventBroker: IKafkaEventBroker,
  ) {}
  
  async approve(cardProcessor: ICardIssuePayload): Promise<void> {
    this.logger.info(`Approving card request: ${JSON.stringify(cardProcessor)}`);
    const card = await this.cardRetriesService.processWithRetries(cardProcessor);

    if (!card) {      
      return; 
    }

    this.publishCardIssued(card);
  }

  private publishCardIssued(card: ICardEmission): void {
    const payload: IKafkaCloudEvent<ICardEmission> = {
      id: crypto.randomUUID(),
      type: KAFKA_TOPICS.CARD_ISSUED,
      source: '/services/cards/card-processor',
      data: card,
      specversion: '1.0',
      time: new Date().toISOString(),
    };

    this.kafkaEventBroker.publish(KAFKA_TOPICS.CARD_ISSUED, payload);
  }
}

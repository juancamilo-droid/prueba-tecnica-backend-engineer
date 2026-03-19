import { inject, injectable } from 'inversify';
import pino from 'pino';

import { ICardRetriesService } from '../../interfaces/cards/card-retries.interface';
import { ICardEmission, ICardEmissionService } from '../../interfaces/cards/card-emission.interface';
import { ICardIssuePayload } from '../../interfaces/cards/card-issue-payload.interface';
import { IKafkaEventBroker } from '../../interfaces/kafka/kafka-event-broker.interface';
import { IKafkaCloudEvent } from '../../interfaces/kafka/kafka-cloud-event.interface';
import { TYPES } from '../../types';
import { KAFKA_TOPICS } from '../../shared/constants';

@injectable()
export class CardRetriesService implements ICardRetriesService {
  private logger = pino({
    name: CardRetriesService.name,
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: { 
      target: 'pino-pretty', 
      options: { 
        colorize: true, 
        ignore: 'pid,hostname' 
      } 
    },
  });

  constructor(
    @inject(TYPES.CardEmissionService) private readonly cardEmissionService: ICardEmissionService,
    @inject(TYPES.KafkaEventBrokerProvider) private readonly kafkaEventBroker: IKafkaEventBroker,
  ) {}

  async processWithRetries(payload: ICardIssuePayload): Promise<ICardEmission | null> {
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      if (attempt > 0) {
        this.logger.info(`Attempt ${attempt} of ${MAX_RETRIES} for card ${payload.cardId}.`);
      }

      const card = await this.cardEmissionService.generateCard(payload.cardId);

      if (card) {
        return card;
      }

      if (!payload.forceError) {
        this.logger.warn(`forceError is false. Skipping retry for card ${payload.cardId}`);
        return null;
      }

      attempt++;

      if (attempt <= MAX_RETRIES) {
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        this.logger.info(`Waiting ${delayMs / 1000} seconds before next retry.`);
        
        await this.delay(delayMs);
      }
    }

    this.logger.error(`Exhausted ${MAX_RETRIES} retries. Sending event to DLQ.`);
    this.publishToDLQ(payload);
    
    return null;
  }

  private publishToDLQ(payload: ICardIssuePayload): void {
    const dlqEvent: IKafkaCloudEvent<ICardIssuePayload> = {
      id: crypto.randomUUID(),
      type: KAFKA_TOPICS.CARD_DLQ,
      source: '/services/cards/card-retries',
      data: payload,
      specversion: '1.0',
      time: new Date().toISOString(),
    };

    this.kafkaEventBroker.publish(KAFKA_TOPICS.CARD_DLQ, dlqEvent);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
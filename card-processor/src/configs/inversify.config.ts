import 'reflect-metadata';
import { Container } from 'inversify';

import { TYPES } from '../types';
import { IKafkaEventConsumer } from '../interfaces/kafka/kafka-event-consumer.interface';
import { KafkaEventConsumerProvider } from '../providers/kafka/kafka-event-consumer.provider';
import { EventDispatcher } from '../events/dispatcher/dispatcher.event';
import { CardRequestedHandler } from '../events/handlers/card-requested.handler';
import { IEventHandler } from '../interfaces/kafka/kafka-event-handler.interface';
import { ICardIssuePayload } from '../interfaces/cards/card-issue-payload.interface';
import { ICardEmissionService } from '../interfaces/cards/card-emission.interface';
import { CardEmissionService } from '../services/cards/card-emission.service';
import { ICardProcessorService } from '../interfaces/cards/card-processor.interface';
import { CardProcessorService } from '../services/cards/card-processor.service';
import { IKafkaEventBroker } from '../interfaces/kafka/kafka-event-broker.interface';
import { KafkaEventBrokerProvider } from '../providers/kafka/kafka-event-broker.provider';
import { ICardRetriesService } from '../interfaces/cards/card-retries.interface';
import { CardRetriesService } from '../services/cards/card-retries.service';

const container = new Container();

container.bind<IKafkaEventConsumer>(TYPES.KafkaEventConsumerProvider).to(KafkaEventConsumerProvider).inSingletonScope();
container.bind<EventDispatcher>(TYPES.EventDispatcher).to(EventDispatcher).inSingletonScope();
container.bind<IEventHandler<ICardIssuePayload>>(TYPES.CardRequestedHandler).to(CardRequestedHandler).inSingletonScope();
container.bind<ICardEmissionService>(TYPES.CardEmissionService).to(CardEmissionService).inSingletonScope();
container.bind<ICardProcessorService>(TYPES.CardProcessorService).to(CardProcessorService).inSingletonScope();
container.bind<IKafkaEventBroker>(TYPES.KafkaEventBrokerProvider).to(KafkaEventBrokerProvider).inSingletonScope();
container.bind<ICardRetriesService>(TYPES.CardRetriesService).to(CardRetriesService).inSingletonScope();

export { container };
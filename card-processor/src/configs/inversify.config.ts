import 'reflect-metadata';
import { Container } from 'inversify';

import { TYPES } from '../types';
import { IKafkaEventConsumer } from '../interfaces/kafka/kafka-event-consumer.interface';
import { KafkaEventConsumerProvider } from '../providers/kafka/kafka-event-consumer.provider';

const container = new Container();

container.bind<IKafkaEventConsumer>(TYPES.KafkaEventConsumerProvider).to(KafkaEventConsumerProvider).inSingletonScope();

export { container };
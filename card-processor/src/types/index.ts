export const TYPES = {
  KafkaEventConsumerProvider: Symbol('KafkaEventConsumerProvider'),
  KafkaEventBrokerProvider: Symbol('KafkaEventBrokerProvider'),
  EventDispatcher: Symbol('EventDispatcher'),
  CardRequestedHandler: Symbol('CardRequestedHandler'),
  CardEmissionService: Symbol('CardEmissionService'),
  CardProcessorService: Symbol('CardProcessorService'),
  CardRetriesService: Symbol.for('CardRetriesService'),
};
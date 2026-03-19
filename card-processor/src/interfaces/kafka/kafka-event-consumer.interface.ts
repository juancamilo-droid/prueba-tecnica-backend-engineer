export interface IKafkaEventConsumer {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribeAndListen<T>(topic: string, handler: (payload: T) => Promise<void>): Promise<void>;
}
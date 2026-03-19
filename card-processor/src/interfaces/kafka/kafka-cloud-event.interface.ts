export interface IKafkaCloudEvent<T> {
  id: string;
  source: string;
  specversion: string;
  type: string;
  datacontenttype?: string;
  time?: string;
  data: T
}
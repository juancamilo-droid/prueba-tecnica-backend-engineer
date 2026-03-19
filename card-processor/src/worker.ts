import 'reflect-metadata';
import { container } from './configs/inversify.config';
import { TYPES } from './types';
import { IKafkaEventConsumer } from './interfaces/kafka/kafka-event-consumer.interface';
import { KAFKA_TOPICS } from './shared/constants';

async function bootstrapConsumer() {
  const kafkaConsumer = container.get<IKafkaEventConsumer>(TYPES.KafkaEventConsumerProvider);

  try {
    await kafkaConsumer.connect();

    const handleCardRequested = async (cloudEventPayload: any) => {
      console.log(`\n📨 Nuevo evento recibido! ID: ${cloudEventPayload.id}`);
      console.log(`Contexto: ${cloudEventPayload.source}`);
      console.log(`Datos de la tarjeta:`, cloudEventPayload.data);

      // Aquí llamarías a tu servicio de dominio (ej. CardProcessorService)
      // await cardProcessorService.processNewCard(cloudEventPayload.data);
    };

    await kafkaConsumer.subscribeAndListen(KAFKA_TOPICS.CARD_REQUESTED, handleCardRequested);
    console.log(`🎧 Escuchando mensajes en el tópico: ${KAFKA_TOPICS.CARD_REQUESTED}`);

  } catch (error) {
    console.error('❌ Error iniciando el consumidor:', error);
    process.exit(1);
  }

  const gracefulShutdown = async () => {
    await kafkaConsumer.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

bootstrapConsumer();
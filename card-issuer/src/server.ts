import 'reflect-metadata';
import app from './app'
import pino from 'pino';

import { container } from './configs/inversify.config';
import { TYPES } from './types';
import { IKafkaEventBroker } from './interfaces/kafka/kafka-event-broker.interface';

const logger = pino({
  name: 'CardsIssueServer',
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
    },
  },
});

const PORT = process.env.PORT || 3000;

async function main() {
  try {
    const server = app.listen(PORT, () => {
      logger.info(`🚀 card-issue-app running on http://localhost:${PORT}`);
    });

    const shutdown = async () => {
      server.close(async () => {
        const kafkaBroker = container.get<IKafkaEventBroker>(TYPES.KafkaEventBrokerProvider);
        await kafkaBroker.disconnect();
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error(`❌ Error starting server: ${(error as Error).message}`);
    process.exit(1);
  }
}

main();
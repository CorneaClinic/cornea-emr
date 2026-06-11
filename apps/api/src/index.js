import { startServer } from './server.js';
import { logger } from './core/logger.js';

startServer().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});

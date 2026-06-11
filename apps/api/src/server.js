import { createServer } from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './core/logger.js';
import { closePool, checkDatabaseConnection } from './db/pool.js';

export async function startServer() {
  const app = createApp();
  const server = createServer(app);

  const dbCheck = await checkDatabaseConnection();
  if (!dbCheck.ok) {
    logger.warn({ db: dbCheck }, 'Database not reachable at startup — health endpoint will report degraded');
  } else {
    logger.info({ dbLatencyMs: dbCheck.latencyMs }, 'Database connection verified');
  }

  await new Promise((resolve) => {
    server.listen(env.port, '0.0.0.0', resolve);
  });

  logger.info({
    port: env.port,
    nodeEnv: env.nodeEnv,
    version: env.apiVersion
  }, 'Cornea EMR API listening');

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down');
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

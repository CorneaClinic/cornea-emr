import { runMigrations } from './migrate.js';
import { closePool } from './pool.js';
import { logger } from '../core/logger.js';

async function main() {
  logger.info('Running foundation migrations...');
  const applied = await runMigrations();

  if (applied.length === 0) {
    logger.info('Database is up to date');
  } else {
    logger.info({ count: applied.length, migrations: applied }, 'Migrations complete');
  }
}

main()
  .then(async () => {
    await closePool();
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error({ err }, 'Migration failed');
    await closePool();
    process.exit(1);
  });

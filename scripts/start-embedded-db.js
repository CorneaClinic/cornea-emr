/**
 * Start embedded PostgreSQL for local development (no Docker/system install).
 * Usage: node scripts/start-embedded-db.js
 */
import EmbeddedPostgres from 'embedded-postgres';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../.pgdata');

mkdirSync(dataDir, { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'cornea',
  password: 'cornea_dev',
  port: 5432,
  persistent: true
});

console.log('Initialising embedded PostgreSQL...');
await pg.initialise();
console.log('Starting PostgreSQL on port 5432...');
await pg.start();

try {
  await pg.createDatabase('cornea_emr');
  console.log('Created database: cornea_emr');
} catch (err) {
  if (String(err.message || err).includes('already exists')) {
    console.log('Database cornea_emr already exists');
  } else {
    throw err;
  }
}

console.log('');
console.log('PostgreSQL ready.');
console.log('DATABASE_URL=postgres://cornea:cornea_dev@127.0.0.1:5432/cornea_emr');
console.log('');
console.log('Keep this process running. In another terminal:');
console.log('  cd apps/api && npm run migrate && npm run dev');
console.log('');

process.on('SIGINT', async () => {
  console.log('\nStopping PostgreSQL...');
  await pg.stop();
  process.exit(0);
});

// Keep alive
await new Promise(() => {});

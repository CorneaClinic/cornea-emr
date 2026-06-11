import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdir, readFile } from 'fs/promises';
import { query, withTransaction, closePool } from './pool.js';
import { logger } from '../core/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Apply SQL migrations from a directory in sorted filename order.
 * @param {string} migrationsDir
 */
export async function runMigrationsFromDir(migrationsDir) {
  let files;
  try {
    files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort();
  } catch (err) {
    if (err.code === 'ENOENT') {
      logger.warn({ migrationsDir }, 'Migrations directory not found');
      return [];
    }
    throw err;
  }

  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const applied = [];

  for (const file of files) {
    const { rows } = await query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
    if (rows.length) continue;

    const sql = await readFile(join(migrationsDir, file), 'utf8');
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    });

    logger.info({ migration: file }, 'Applied migration');
    applied.push(file);
  }

  return applied;
}

/** Run foundation migrations (default). */
export async function runMigrations() {
  const dir = join(__dirname, 'migrations');
  return runMigrationsFromDir(dir);
}

import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../core/logger.js';

const { Pool } = pg;

const poolConfig = {
  connectionString: env.databaseConnectionUrl,
  max: env.db.poolMax,
  idleTimeoutMillis: env.db.idleTimeoutMs,
  connectionTimeoutMillis: env.db.connectionTimeoutMs
};

if (env.db.ssl) {
  poolConfig.ssl = env.db.ssl;
}

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected PostgreSQL pool error');
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** @returns {{ ok: boolean, latencyMs: number, error?: string }} */
export async function checkDatabaseConnection() {
  const started = Date.now();
  try {
    await query('SELECT 1 AS ok');
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err.message
    };
  }
}

export async function closePool() {
  await pool.end();
}

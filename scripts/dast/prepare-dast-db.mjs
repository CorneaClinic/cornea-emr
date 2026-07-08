#!/usr/bin/env node
/**
 * Migrate local test Postgres and create DAST role users.
 * Usage: npm run dast:prepare-db
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolveDastDatabaseUrl, setupDastUsers } from './setup-dast-users.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const API_DIR = path.join(ROOT, 'apps', 'api');
const require = createRequire(path.join(ROOT, 'apps/api/package.json'));
const pg = require('pg');

async function ensureDastDatabase(databaseUrl) {
  const url = new URL(databaseUrl.replace(/^postgres:/, 'postgresql:'));
  const dbName = url.pathname.replace(/^\//, '');
  if (!dbName) return;

  url.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: url.toString(), ssl: false });
  try {
    await admin.connect();
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (!exists.rows.length) {
      await admin.query(`CREATE DATABASE ${dbName}`);
      console.log(`Created database: ${dbName}`);
    }
  } catch (err) {
    console.warn(`Could not auto-create database ${dbName}: ${err.message}`);
    console.warn('Create it manually or set DAST_DATABASE_URL to an existing empty database.');
  } finally {
    await admin.end().catch(() => {});
  }
}

function dastEnv(databaseUrl) {
  return {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'test',
    DATABASE_URL: databaseUrl,
    JWT_SECRET:
      process.env.JWT_SECRET || 'ci-jwt-secret-at-least-32-characters-long!!',
    SECRETS_ENCRYPTION_KEY:
      process.env.SECRETS_ENCRYPTION_KEY || 'ci-encryption-key-32-characters-min!!',
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://127.0.0.1:8080'
  };
}

function runMigrate(databaseUrl) {
  console.log('\n=== DAST DB prepare: migrations ===\n');
  const result = spawnSync(process.execPath, ['src/db/migrate-cli.js'], {
    cwd: API_DIR,
    env: dastEnv(databaseUrl),
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    throw new Error(
      'Migration failed. Ensure local Postgres is running and DAST_DATABASE_URL credentials are correct.'
    );
  }
}

async function main() {
  const databaseUrl = resolveDastDatabaseUrl();
  console.log(`Target database: ${new URL(databaseUrl.replace(/^postgres:/, 'postgresql:')).host}`);

  await ensureDastDatabase(databaseUrl);
  runMigrate(databaseUrl);

  console.log('\n=== DAST DB prepare: role users ===\n');
  await setupDastUsers();
}

main().catch((err) => {
  console.error('\nDAST DB prepare failed:', err.message || err);
  console.error('\nTypical fix (local Postgres):');
  console.error('  1. Start Postgres on 127.0.0.1:5432');
  console.error('  2. Create DB/user if needed: node scripts/setup-local-db.js');
  console.error('  3. Or set DAST_DATABASE_URL=postgres://user:pass@127.0.0.1:5432/your_db');
  console.error('  4. npm run dast:prepare-db\n');
  process.exit(1);
});

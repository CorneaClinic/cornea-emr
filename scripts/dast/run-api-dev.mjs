#!/usr/bin/env node
/**
 * Start API dev server against the DAST test database (cornea_emr_dast).
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDastDatabaseUrl } from './setup-dast-users.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PORT = Number(process.env.PORT || 3000);

function portInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => server.close(() => resolve(false)));
    server.listen(port, '0.0.0.0');
  });
}

async function main() {
  if (await portInUse(PORT)) {
    console.error(`Port ${PORT} is already in use. Stop the existing API first, for example:`);
    console.error(`  Get-NetTCPConnection -LocalPort ${PORT} | Select OwningProcess`);
    console.error(`  Stop-Process -Id <PID> -Force`);
    process.exit(1);
  }

  const databaseUrl = resolveDastDatabaseUrl();
  const host = new URL(databaseUrl.replace(/^postgres:/, 'postgresql:')).host;
  console.log(`Starting API (DAST) on :${PORT} with database ${host}`);

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    NODE_ENV: process.env.NODE_ENV || 'development',
    JWT_SECRET:
      process.env.JWT_SECRET || 'ci-jwt-secret-at-least-32-characters-long!!',
    SECRETS_ENCRYPTION_KEY:
      process.env.SECRETS_ENCRYPTION_KEY || 'ci-encryption-key-32-characters-min!!',
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://127.0.0.1:8080',
    RATE_LIMIT_LOGIN_WINDOW_MS: process.env.RATE_LIMIT_LOGIN_WINDOW_MS || '60000',
    RATE_LIMIT_LOGIN_MAX_PER_IP: process.env.RATE_LIMIT_LOGIN_MAX_PER_IP || '1000',
    RATE_LIMIT_LOGIN_MAX_PER_EMAIL: process.env.RATE_LIMIT_LOGIN_MAX_PER_EMAIL || '200',
    RATE_LIMIT_API_MAX_PER_IP: process.env.RATE_LIMIT_API_MAX_PER_IP || '10000'
  };

  // Use `start` (node src/index.js) not `dev` (node --watch): avoids mid-scan restarts that break logins.
  const child = spawn('npm', ['run', 'start', '--prefix', 'apps/api'], {
    cwd: ROOT,
    env,
    stdio: 'inherit',
    shell: true
  });

  child.on('exit', (code) => process.exit(code ?? 1));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

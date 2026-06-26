import { spawnSync } from 'node:child_process';
import path from 'node:path';

function runNode(script, cwd) {
  const result = spawnSync(process.execPath, [script], {
    cwd,
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'test',
      DATABASE_URL:
        process.env.DATABASE_URL ||
        'postgres://cornea:test@127.0.0.1:5432/cornea_emr_test',
      JWT_SECRET:
        process.env.JWT_SECRET || 'ci-jwt-secret-at-least-32-characters-long!!',
      SECRETS_ENCRYPTION_KEY:
        process.env.SECRETS_ENCRYPTION_KEY || 'ci-encryption-key-32-characters-min!!',
      CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://127.0.0.1:8080',
      E2E_API_URL: process.env.E2E_API_URL || 'http://127.0.0.1:3000',
      E2E_PASSWORD: process.env.E2E_PASSWORD || 'Playwright-E2e-Test1!'
    },
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    throw new Error(`E2E setup failed: node ${script}`);
  }
}

export default async function globalSetup() {
  const apiDir = path.join(process.cwd(), 'apps', 'api');
  runNode('src/db/migrate-cli.js', apiDir);
  runNode('scripts/e2e-playwright-setup.js', apiDir);
}

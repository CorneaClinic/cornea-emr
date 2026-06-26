// @ts-check
import { defineConfig, devices } from '@playwright/test';

const LOCAL_API = 'http://127.0.0.1:3000';
const LOCAL_CLINIC = 'http://127.0.0.1:8080';
const API_URL = (process.env.E2E_API_URL || LOCAL_API).replace(/\/$/, '');
const CLINIC_URL = (process.env.E2E_CLINIC_URL || LOCAL_CLINIC).replace(/\/$/, '');

const apiEnv = {
  NODE_ENV: 'test',
  DATABASE_URL:
    process.env.DATABASE_URL || 'postgres://cornea:test@127.0.0.1:5432/cornea_emr_test',
  JWT_SECRET:
    process.env.JWT_SECRET || 'ci-jwt-secret-at-least-32-characters-long!!',
  SECRETS_ENCRYPTION_KEY:
    process.env.SECRETS_ENCRYPTION_KEY || 'ci-encryption-key-32-characters-min!!',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://127.0.0.1:8080',
  E2E_PASSWORD: process.env.E2E_PASSWORD || 'Playwright-E2e-Test1!',
  E2E_API_URL: API_URL
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: CLINIC_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './e2e/global-setup.js',
  webServer: [
    {
      command: 'node src/index.js',
      url: `${LOCAL_API}/health/live`,
      cwd: 'apps/api',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: apiEnv
    },
    {
      command: 'node clinic-server.js',
      url: `${LOCAL_CLINIC}/Cornea.html`,
      cwd: 'apps/clinic',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000
    }
  ]
});

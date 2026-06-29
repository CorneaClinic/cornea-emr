// @ts-check
/** Playwright config for live production/staging smoke — no local webServer or DB setup. */
import { defineConfig, devices } from '@playwright/test';

const STAGING_CLINIC = (
  process.env.STAGING_CLINIC_URL || 'https://corneaclinic.visionemr.net/Cornea'
).replace(/\/$/, '');

export default defineConfig({
  testDir: './e2e',
  testMatch: 'staging-smoke.spec.js',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: STAGING_CLINIC,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});

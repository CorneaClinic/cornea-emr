// @ts-check
/** Playwright config for live production validation — desktop + mobile (Project 7). */
import { defineConfig, devices } from '@playwright/test';

const STAGING_CLINIC = (
  process.env.STAGING_CLINIC_URL || 'https://corneaclinic.visionemr.net/Cornea'
).replace(/\/$/, '');

export default defineConfig({
  testDir: './e2e',
  testMatch: 'production-validation.spec.js',
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
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } }
  ]
});

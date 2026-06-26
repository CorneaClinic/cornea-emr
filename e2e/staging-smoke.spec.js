import { test, expect } from '@playwright/test';
import { signInCloud } from './helpers.js';

const STAGING_EMAIL = process.env.STAGING_E2E_EMAIL || '';
const STAGING_PASSWORD = process.env.STAGING_E2E_PASSWORD || '';
const STAGING_CLINIC = (process.env.STAGING_CLINIC_URL || 'https://corneaclinic.visionemr.net/Cornea').replace(
  /\/$/,
  ''
);
const STAGING_API = (process.env.STAGING_API_URL || 'https://corneaclinic-2zfpt.ondigitalocean.app').replace(
  /\/$/,
  ''
);

test.describe('Staging live smoke', () => {
  test.skip(!STAGING_EMAIL || !STAGING_PASSWORD, 'Set STAGING_E2E_EMAIL and STAGING_E2E_PASSWORD');

  test.use({ baseURL: STAGING_CLINIC });

  test('production clinic loads and KP globals exist', async ({ page }) => {
    const syntaxErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /SyntaxError/i.test(msg.text())) syntaxErrors.push(msg.text());
    });

    await page.goto('/Cornea.html');
    await page.waitForFunction(() => typeof window.switchKpPanel === 'function', null, {
      timeout: 45_000
    });
    expect(syntaxErrors).toHaveLength(0);
  });

  test('cloud sign-in against production API', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('corneaEmr_apiToken');
        localStorage.removeItem('corneaEmr_apiBase');
      } catch (_) { /* ignore */ }
    });
    await page.goto('/Cornea.html?cloud=1');

    const modal = page.locator('#corneaCloudLoginModal');
    await expect(modal).toHaveClass(/is-open/, { timeout: 30_000 });

    await page.locator('#corneaLoginApiUrl').fill(STAGING_API);
    await page.locator('#corneaLoginEmail').fill(STAGING_EMAIL);
    await page.locator('#corneaLoginPassword').fill(STAGING_PASSWORD);

    const started = Date.now();
    await page.locator('#corneaLoginSubmitBtn').click();
    await expect(modal).not.toHaveClass(/is-open/, { timeout: 20_000 });
    expect(Date.now() - started).toBeLessThan(15_000);

    await expect(page.locator('body')).not.toHaveClass(/cornea-auth-pending/);
  });
});

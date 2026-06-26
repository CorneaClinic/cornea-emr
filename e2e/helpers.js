import fs from 'fs';
import path from 'path';
import { expect } from '@playwright/test';

const CRED_FILE = path.join(process.cwd(), 'e2e', '.auth', 'credentials.json');

export function loadCredentials() {
  if (!fs.existsSync(CRED_FILE)) {
    throw new Error(
      `Missing ${CRED_FILE}. Run: node apps/api/scripts/e2e-playwright-setup.js`
    );
  }
  return JSON.parse(fs.readFileSync(CRED_FILE, 'utf8'));
}

/**
 * Cloud sign-in against the local API (use Cornea.html?cloud=1).
 * @param {import('@playwright/test').Page} page
 */
export async function signInCloud(page) {
  const creds = loadCredentials();
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('corneaEmr_apiToken');
      localStorage.removeItem('corneaEmr_apiBase');
      localStorage.removeItem('corneaEmr_apiEmail');
    } catch (_) { /* ignore */ }
  });
  await page.goto('/Cornea.html?cloud=1');

  const modal = page.locator('#corneaCloudLoginModal');
  await expect(modal).toHaveClass(/is-open/, { timeout: 25_000 });

  await page.locator('#corneaLoginApiUrl').fill(creds.apiUrl);
  await page.locator('#corneaLoginEmail').fill(creds.email);
  await page.locator('#corneaLoginPassword').fill(creds.password);

  const started = Date.now();
  await page.locator('#corneaLoginSubmitBtn').click();
  await expect(modal).not.toHaveClass(/is-open/, { timeout: 15_000 });
  const elapsed = Date.now() - started;

  await expect(page.locator('body')).not.toHaveClass(/cornea-auth-pending/, { timeout: 10_000 });
  return { elapsed, creds };
}

export async function openKeratoplastyTab(page) {
  await page.locator('#nav-keratoplastyTab').click();
  const tab = page.locator('#keratoplastyTab');
  await expect(tab).toHaveClass(/active/, { timeout: 15_000 });
  await expect(tab).toHaveAttribute('aria-hidden', 'false');
}

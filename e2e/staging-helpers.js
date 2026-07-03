import { expect } from '@playwright/test';

export function stagingCredentials() {
  const email = (process.env.STAGING_E2E_EMAIL || '').trim();
  const password = process.env.STAGING_E2E_PASSWORD || '';
  const apiUrl = (process.env.STAGING_API_URL || 'https://corneaclinic-2zfpt.ondigitalocean.app').replace(
    /\/$/,
    ''
  );
  return { email, password, apiUrl };
}

/** Cloud sign-in against live staging/production API (uses STAGING_E2E_* env). */
export async function signInStaging(page) {
  const creds = stagingCredentials();
  if (!creds.email || !creds.password) {
    throw new Error('Set STAGING_E2E_EMAIL and STAGING_E2E_PASSWORD');
  }

  await page.addInitScript(() => {
    try {
      localStorage.removeItem('corneaEmr_apiToken');
      localStorage.removeItem('corneaEmr_apiBase');
      localStorage.removeItem('corneaEmr_apiEmail');
    } catch (_) {
      /* ignore */
    }
  });
  await page.goto('/Cornea.html?cloud=1');

  const modal = page.locator('#corneaCloudLoginModal');
  await expect(modal).toHaveClass(/is-open/, { timeout: 30_000 });

  await page.locator('#corneaLoginApiUrl').fill(creds.apiUrl);
  await page.locator('#corneaLoginEmail').fill(creds.email);
  await page.locator('#corneaLoginPassword').fill(creds.password);

  const started = Date.now();
  const loginResponse = page.waitForResponse(
    (r) => r.url().includes('/api/v1/auth/login'),
    { timeout: 20_000 }
  );
  await page.locator('#corneaLoginSubmitBtn').click();
  const loginRes = await loginResponse;
  if (!loginRes.ok()) {
    throw new Error(`Staging login failed (${loginRes.status()}): ${await loginRes.text()}`);
  }
  await expect(modal).not.toHaveClass(/is-open/, { timeout: 20_000 });

  await expect(page.locator('body')).not.toHaveClass(/cornea-auth-pending/, { timeout: 10_000 });
  return { elapsed: Date.now() - started, creds };
}

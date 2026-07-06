import { test, expect } from '@playwright/test';
import { signInStaging, stagingCredentials } from './staging-helpers.js';

const { email: STAGING_EMAIL, password: STAGING_PASSWORD } = stagingCredentials();
const STAGING_CLINIC = (process.env.STAGING_CLINIC_URL || 'https://corneaclinic.visionemr.net/Cornea').replace(
  /\/$/,
  ''
);

const hasCreds = Boolean(STAGING_EMAIL && STAGING_PASSWORD);

test.describe('Production validation — desktop', () => {
  test.skip(!hasCreds, 'Set STAGING_E2E_EMAIL and STAGING_E2E_PASSWORD');

  test.use({ baseURL: STAGING_CLINIC });

  test('New Visit opens patient form modal (regression)', async ({ page }) => {
    await signInStaging(page);
    await page.locator('#nav-patientTab').click();
    await expect(page.locator('#patientTab')).toHaveClass(/active/, { timeout: 15_000 });

    await page.locator('button:has-text("New Visit")').first().click();
    const modal = page.locator('#emrPatientModal');
    await expect(modal).toHaveClass(/is-open/, { timeout: 15_000 });
    await expect(page.locator('#emrPatientModalTitle')).toContainText(/Patient Visit/i);
  });

  test('core tabs navigate without errors', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await signInStaging(page);
    const tabs = ['#nav-dashboardTab', '#nav-patientTab', '#nav-appointmentsTab'];
    for (const sel of tabs) {
      await page.locator(sel).click();
      await page.waitForTimeout(500);
    }

    const critical = pageErrors.filter((e) => /SyntaxError|ReferenceError/i.test(e));
    expect(critical, critical.join('\n')).toHaveLength(0);
  });

  test('login completes within performance budget', async ({ page }) => {
    const { elapsed } = await signInStaging(page);
    expect(elapsed).toBeLessThan(15_000);
  });
});

test.describe('Production validation — mobile viewport', () => {
  test.skip(!hasCreds, 'Set STAGING_E2E_EMAIL and STAGING_E2E_PASSWORD');

  test.use({
    baseURL: STAGING_CLINIC,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });

  test('clinic loads on mobile viewport', async ({ page }) => {
    await page.goto('/Cornea.html');
    await page.waitForFunction(() => typeof window.switchKpPanel === 'function', null, {
      timeout: 45_000
    });
    await expect(page.locator('#corneaCloudLoginModal')).toBeVisible({ timeout: 30_000 });
  });

  test('mobile cloud sign-in and dashboard', async ({ page }) => {
    await signInStaging(page);
    await expect(page.locator('#dashboardTab')).toHaveClass(/active/, { timeout: 15_000 });
    await expect(page.locator('#corneaCloudBadgeWrap')).toBeVisible();
  });
});

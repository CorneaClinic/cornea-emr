import { test, expect } from '@playwright/test';
import { signInCloud, openKcRegistryTab } from './helpers.js';

test.describe('Registry offline policy (M2.2)', () => {
  test('KC registry shows banner and disables save controls when offline in cloud mode', async ({
    page,
    context
  }) => {
    await signInCloud(page);
    await openKcRegistryTab(page);
    await page.locator('[data-kc-panel="kcPatientsPanel"]').click();
    await expect(page.locator('#kcPatientsPanel')).toHaveClass(/active/);

    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.evaluate(() => window.CorneaRegistryOnline?.refresh('kc'));

    const banner = page.locator('#kcRegistryOfflineBanner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/internet/i);

    const enrolBtn = page.locator('#kcPatientsPanel button.btn-primary').first();
    await expect(enrolBtn).toBeDisabled();

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.evaluate(() => window.CorneaRegistryOnline?.refresh('kc'));
    await expect(banner).toBeHidden();
    await expect(enrolBtn).toBeEnabled();
  });

  test('dry eye registry disables new case when offline in cloud mode', async ({ page, context }) => {
    await signInCloud(page);
    await page.locator('#nav-dryEyeTab').click();
    await expect(page.locator('#dryEyeTab')).toHaveClass(/active/);
    await page.locator('[data-de-panel="deCasesPanel"]').click();

    await context.setOffline(true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
      window.CorneaRegistryOnline?.refresh('dryeye');
    });

    await expect(page.locator('#dryEyeOfflineBanner')).toBeVisible();
    await expect(page.locator('#deCasesPanel button.btn-primary').first()).toBeDisabled();
  });
});

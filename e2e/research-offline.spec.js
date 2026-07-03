import { test, expect } from '@playwright/test';
import { signInCloud, waitForCloudRegistryMode } from './helpers.js';

test.describe('Research offline summaries (Phase 4 P2)', () => {
  test('live overview caches then offline shows cached badge', async ({ page }) => {
    await signInCloud(page);
    await waitForCloudRegistryMode(page);

    const badge = page.locator('#raSourceBadge');
    const overviewResponse = page.waitForResponse(
      (r) => r.url().includes('/api/v1/research-analytics/overview') && r.ok(),
      { timeout: 30_000 }
    );
    await page.locator('#nav-researchTab').click();
    await expect(page.locator('#researchTab')).toHaveClass(/active/);
    await overviewResponse;
    await expect(badge).toContainText(/Live institute data from cloud/i, { timeout: 25_000 });

    await page.context().setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.evaluate(async () => {
      await window.CorneaResearchAnalytics?.init?.();
    });

    await expect(badge).toContainText(/Offline — last cloud sync/i, { timeout: 15_000 });
    await expect(page.locator('#raCloudHint')).toBeHidden();

    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.evaluate(async () => {
      await window.CorneaResearchAnalytics?.init?.();
    });
    await expect(badge).toContainText(/Live institute data from cloud/i, { timeout: 20_000 });
  });
});

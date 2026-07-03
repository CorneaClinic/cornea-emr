import { test, expect } from '@playwright/test';
import { signInCloud, openKcRegistryTab } from './helpers.js';

const KC_PANELS = [
  { id: 'kcOverviewPanel', label: 'Overview' },
  { id: 'kcPatientsPanel', label: 'Patient Register' }
];

test.describe('KC registry UI', () => {
  /** @type {import('@playwright/test').Page} */
  let page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await signInCloud(page);
    await openKcRegistryTab(page);
  });

  test.afterAll(async () => {
    await page?.close();
  });

  for (const panel of KC_PANELS) {
    test(`switches to ${panel.label}`, async () => {
      await page.locator(`[data-kc-panel="${panel.id}"]`).click();
      const el = page.locator(`#${panel.id}`);
      await expect(el).toHaveClass(/active/);
      await expect(el).not.toHaveAttribute('hidden', 'true');
    });
  }

  test('overview stats grid is visible', async () => {
    await page.locator('[data-kc-panel="kcOverviewPanel"]').click();
    await expect(page.locator('#kcStatsGrid')).toBeVisible();
    await expect(page.locator('#kcStatTotal')).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import { signInCloud, openKeratoplastyTab } from './helpers.js';

const KP_PANELS = [
  { id: 'kpOverviewPanel', label: 'Overview' },
  { id: 'kpPatientsPanel', label: 'Patient Register' },
  { id: 'kpTissuePanel', label: 'Tissue Inventory' },
  { id: 'kpMatchPanel', label: 'Matching Engine' }
];

test.describe('Keratoplasty sub-panels', () => {
  test.beforeAll(async ({ page }) => {
    await signInCloud(page);
    await openKeratoplastyTab(page);
  });

  for (const panel of KP_PANELS) {
    test(`switches to ${panel.label}`, async ({ page }) => {
      await page.locator(`[data-kp-panel="${panel.id}"]`).click();
      const el = page.locator(`#${panel.id}`);
      await expect(el).toHaveClass(/active/);
      await expect(el).not.toHaveAttribute('hidden', 'true');
      await expect(page.locator(`[data-kp-panel="${panel.id}"]`)).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });
  }
});

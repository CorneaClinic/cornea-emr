import { test, expect } from '@playwright/test';
import { signInStaging, stagingCredentials } from './staging-helpers.js';

const { email: STAGING_EMAIL, password: STAGING_PASSWORD } = stagingCredentials();
const STAGING_CLINIC = (process.env.STAGING_CLINIC_URL || 'https://corneaclinic.visionemr.net/Cornea').replace(
  /\/$/,
  ''
);
const hasCreds = Boolean(STAGING_EMAIL && STAGING_PASSWORD);

const WORKFLOW_TABS = [
  { id: 'W01', name: 'Cornea clinic (core)', nav: '#nav-formTab', panel: '#formTab' },
  { id: 'W05', name: 'Keratitis', nav: '#nav-keratitisTab', panel: '#keratitisTab' },
  { id: 'W06', name: 'Dry eye', nav: '#nav-dryEyeTab', panel: '#dryEyeTab' },
  { id: 'W07', name: 'KC registry', nav: '#nav-kcRegistryTab', panel: '#kcRegistryTab' },
  { id: 'W09', name: 'Keratoplasty', nav: '#nav-keratoplastyTab', panel: '#keratoplastyTab' },
  { id: 'W-MEDIA', name: 'Clinical media', nav: '#nav-clinicalMediaTab', panel: '#clinicalMediaTab' }
];

test.describe('Clinical validation — workflow tabs', () => {
  test.skip(!hasCreds, 'Set STAGING_E2E_EMAIL and STAGING_E2E_PASSWORD');

  test.use({ baseURL: STAGING_CLINIC });

  test.beforeEach(async ({ page }) => {
    await signInStaging(page);
  });

  for (const wf of WORKFLOW_TABS) {
    test(`${wf.id} ${wf.name} tab opens`, async ({ page }) => {
      await page.locator(wf.nav).click();
      await expect(page.locator(wf.panel)).toHaveClass(/active/, { timeout: 15_000 });
    });
  }

  test('printing controls present on patient form', async ({ page }) => {
    await page.locator('#nav-formTab').click();
    await expect(page.locator('button:has-text("Print")').first()).toBeVisible({ timeout: 15_000 });
  });

  test('contact lens and scleral sections exist in visit form', async ({ page }) => {
    await page.locator('#nav-formTab').click();
    await expect(page.locator('#btnToggleContactLens')).toBeVisible();
    await page.locator('#btnToggleContactLens').click();
    await expect(page.locator('#section-contact-lens')).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import { waitForInstituteKpis } from './helpers.js';
import { signInStaging, stagingCredentials } from './staging-helpers.js';

const { email: STAGING_EMAIL, password: STAGING_PASSWORD } = stagingCredentials();
const STAGING_CLINIC = (process.env.STAGING_CLINIC_URL || 'https://corneaclinic.visionemr.net/Cornea').replace(
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
    const { elapsed } = await signInStaging(page);
    expect(elapsed).toBeLessThan(15_000);
  });

  test('dashboard institute KPIs load after sign-in (Phase 4 P1)', async ({ page }) => {
    await signInStaging(page);
    await expect(page.locator('#dashboardTab')).toHaveClass(/active/);
    await waitForInstituteKpis(page);

    const kpiIds = ['kpiUniquePatients', 'kpiVisitsWeek', 'kpiKcEnrolled', 'kpiKpWaiting'];
    for (const id of kpiIds) {
      const text = await page.locator(`#${id}`).textContent();
      expect(text, id).toMatch(/^\d+$/);
    }
    await expect(page.locator('#instituteKpisAsOf')).toContainText(/As of/i);
  });

  test('appointments schedule tab opens (Phase 4 P5)', async ({ page }) => {
    await signInStaging(page);
    await page.locator('#nav-appointmentsTab').click();
    await expect(page.locator('#appointmentsTab')).toHaveClass(/active/, { timeout: 15_000 });
    await expect(page.locator('#apptSchedulePanel')).toHaveClass(/active/);
  });
});

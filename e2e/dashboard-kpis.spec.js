import { test, expect } from '@playwright/test';
import { apiLogin, authHeaders, signInCloud, waitForInstituteKpis } from './helpers.js';

test.describe('Dashboard institute KPIs (Phase 4 P1)', () => {
  test('GET /api/v1/dashboard/kpis returns tenant-scoped payload', async ({ request }) => {
    const { token, creds } = await apiLogin(request);
    const res = await request.get(`${creds.apiUrl}/api/v1/dashboard/kpis`, {
      headers: authHeaders(token)
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.generatedAt).toBeTruthy();
    expect(body.data.visits).toMatchObject({
      total: expect.any(Number),
      today: expect.any(Number),
      week: expect.any(Number),
      uniquePatients: expect.any(Number),
      sexRatio: expect.objectContaining({
        male: expect.any(Number),
        female: expect.any(Number)
      })
    });
    expect(body.data.registries).toMatchObject({
      kc: expect.objectContaining({
        enrolled: expect.any(Number),
        active: expect.any(Number),
        cxl: expect.any(Number)
      }),
      keratitis: expect.objectContaining({
        active: expect.any(Number)
      }),
      keratoplasty: expect.objectContaining({
        waiting: expect.any(Number),
        tissueAvailable: expect.any(Number)
      })
    });
  });

  test('dashboard shows institute KPI grid after cloud sign-in', async ({ page }) => {
    await signInCloud(page);
    await expect(page.locator('#dashboardTab')).toHaveClass(/active/);
    await waitForInstituteKpis(page);

    const kpiIds = [
      'kpiUniquePatients',
      'kpiVisitsWeek',
      'kpiKcEnrolled',
      'kpiKcActive',
      'kpiCxlTotal',
      'kpiUkActive',
      'kpiKpWaiting',
      'kpiKpEmergency',
      'kpiTissueAvailable'
    ];

    for (const id of kpiIds) {
      const text = await page.locator(`#${id}`).textContent();
      expect(text, id).toMatch(/^\d+$/);
    }

    await expect(page.locator('#instituteKpisAsOf')).toContainText(/As of/i);
  });
});

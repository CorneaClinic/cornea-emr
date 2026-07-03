import { test, expect } from '@playwright/test';
import { apiLogin, authHeaders, signInCloud, openAppointmentsSchedule, waitForCloudRegistryMode } from './helpers.js';

const DEVICE_ID = 'playwright-e2e-p7';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

test.describe('Dry eye OSD registry API (Phase 4 P7)', () => {
  test('create case, add assessment with OSD index', async ({ request }) => {
    const { token, creds } = await apiLogin(request, DEVICE_ID);
    const headers = authHeaders(token, DEVICE_ID);

    const create = await request.post(`${creds.apiUrl}/api/v1/dry-eye-registry`, {
      headers,
      data: {
        fullName: 'Playwright Dry Eye Patient',
        primarySubtype: 'MGD',
        status: 'Active'
      }
    });
    expect(create.status()).toBe(201);
    const caseRow = (await create.json()).data;
    expect(caseRow.caseId).toMatch(/^DE-/);

    const assess = await request.post(
      `${creds.apiUrl}/api/v1/dry-eye-registry/${caseRow.id}/assessments`,
      {
        headers,
        data: {
          assessedAt: todayIso(),
          tbutOd: 4,
          schirmerOd: 5,
          osdiScore: 35,
          mgdGrade: 'Moderate'
        }
      }
    );
    expect(assess.status()).toBe(201);
    const assessment = (await assess.json()).data;
    expect(assessment.osdIndexScore).toBeGreaterThan(0);
    expect(assessment.severity).toBeTruthy();

    const detail = await request.get(
      `${creds.apiUrl}/api/v1/dry-eye-registry/${caseRow.id}`,
      { headers }
    );
    expect(detail.ok()).toBeTruthy();
    expect((await detail.json()).data.assessments.length).toBeGreaterThan(0);
  });

  test('overview returns registry stats', async ({ request }) => {
    const { token, creds } = await apiLogin(request, DEVICE_ID);
    const res = await request.get(`${creds.apiUrl}/api/v1/dry-eye-registry/overview`, {
      headers: authHeaders(token, DEVICE_ID)
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()).data;
    expect(body.total).toEqual(expect.any(Number));
  });
});

test.describe('OR schedule API (Phase 4 P7)', () => {
  test('schedule case, list day, update status', async ({ request }) => {
    const { token, creds } = await apiLogin(request, DEVICE_ID);
    const headers = authHeaders(token, DEVICE_ID);
    const day = todayIso();

    const create = await request.post(`${creds.apiUrl}/api/v1/or-schedule`, {
      headers,
      data: {
        patientName: 'Playwright OR Patient',
        procedureDate: day,
        startTime: '08:30',
        procedureType: 'PK',
        surgeonName: 'Dr Playwright',
        theatre: 'Theatre 1'
      }
    });
    expect(create.status()).toBe(201);
    const orCase = (await create.json()).data;
    expect(orCase.caseNumber).toMatch(/^OR-/);

    const dayRes = await request.get(
      `${creds.apiUrl}/api/v1/or-schedule/day/${encodeURIComponent(day)}`,
      { headers }
    );
    expect(dayRes.ok()).toBeTruthy();
    const dayList = (await dayRes.json()).data;
    expect(dayList.some((r) => r.id === orCase.id)).toBe(true);

    const update = await request.patch(
      `${creds.apiUrl}/api/v1/or-schedule/${orCase.id}`,
      { headers, data: { status: 'confirmed', revision: orCase.revision } }
    );
    expect(update.ok()).toBeTruthy();
    expect((await update.json()).data.status).toBe('confirmed');
  });

  test('procedure-types returns corneal surgery list', async ({ request }) => {
    const { token, creds } = await apiLogin(request, DEVICE_ID);
    const res = await request.get(`${creds.apiUrl}/api/v1/or-schedule/procedure-types`, {
      headers: authHeaders(token, DEVICE_ID)
    });
    expect(res.ok()).toBeTruthy();
    const types = (await res.json()).data;
    expect(types).toContain('PK');
    expect(types).toContain('CXL');
  });
});

test.describe('Ectasia AI v2 API (Phase 4 P7)', () => {
  test('analyze with v2 modifiers returns enhanced model', async ({ request }) => {
    const { token, creds } = await apiLogin(request, DEVICE_ID);
    const res = await request.post(`${creds.apiUrl}/api/v1/ectasia-ai/analyze`, {
      headers: authHeaders(token, DEVICE_ID),
      data: {
        useV2: true,
        od: { badD: 1.4, kmax: 46, abcdGrade: 'C', isv: 45 },
        os: { badD: 1.2, kmax: 44 },
        shared: { age: 22, ocularSurfaceDryEye: true }
      }
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()).data;
    expect(body.modelVersion).toBe('ectasia-v2-topography');
    expect(body.procedureRanking).toBeTruthy();
    expect(body.registryInsights).toBeTruthy();
  });
});

test.describe('P7 clinical modules UI', () => {
  test('dry eye tab loads after cloud sign-in', async ({ page }) => {
    await signInCloud(page);
    await waitForCloudRegistryMode(page);
    await page.locator('#nav-dryEyeTab').click();
    await expect(page.locator('#dryEyeTab')).toHaveClass(/active/);
    await expect(page.locator('#deOverviewPanel')).toHaveClass(/active/);
    await expect(page.locator('#deStatTotal')).toBeVisible();
  });

  test('OR schedule panel loads under appointments', async ({ page }) => {
    await signInCloud(page);
    await waitForCloudRegistryMode(page);
    await openAppointmentsSchedule(page);
    await page.locator('[data-appt-panel="or"]').click();
    await expect(page.locator('#apptOrPanel')).toHaveClass(/active/);
    await expect(page.locator('#orScheduleBody')).toBeVisible();
  });
});

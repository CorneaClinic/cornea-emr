import { test, expect } from '@playwright/test';
import { apiLogin, authHeaders, loadCredentials } from './helpers.js';

const DEVICE_ID = 'playwright-e2e-fhir';

test.describe('FHIR export API (Phase 4 P4)', () => {
  test('cohort bundle returns anonymized FHIR R4 collection', async ({ request }) => {
    const { token, creds } = await apiLogin(request, DEVICE_ID);
    const headers = authHeaders(token, DEVICE_ID);

    const create = await request.post(`${creds.apiUrl}/api/v1/kc-registry`, {
      headers,
      data: {
        fullName: 'Playwright FHIR KC',
        kcRegistryId: `PW-FHIR-KC-${Date.now()}`,
        eyeInvolvement: 'OD',
        diagnosis: 'Keratoconus',
        status: 'Active'
      }
    });
    expect(create.status()).toBe(201);

    const res = await request.get(
      `${creds.apiUrl}/api/v1/fhir-export/cohort/kc/bundle?anonymize=true&limit=5`,
      { headers }
    );
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/fhir+json');

    const bundle = await res.json();
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('collection');
    expect(Array.isArray(bundle.entry)).toBe(true);
    expect(bundle.meta?.security?.[0]?.code).toBe('ANONY');
  });

  test('cohort bundle requires authentication', async ({ request }) => {
    const creds = loadCredentials();
    const res = await request.get(`${creds.apiUrl}/api/v1/fhir-export/cohort/kc/bundle`);
    expect(res.status()).toBe(401);
  });
});

import { test, expect } from '@playwright/test';
import { apiLogin, authHeaders, loadCredentials } from './helpers.js';

test.describe('FHIR export API (Phase 4 P4)', () => {
  test('cohort bundle returns anonymized FHIR R4 collection', async ({ request }) => {
    const { token, creds } = await apiLogin(request);
    const res = await request.get(
      `${creds.apiUrl}/api/v1/fhir-export/cohort/kc/bundle?anonymize=true&limit=5`,
      { headers: authHeaders(token) }
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

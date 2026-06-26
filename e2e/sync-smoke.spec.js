import { test, expect } from '@playwright/test';
import crypto from 'crypto';
import { loadCredentials } from './helpers.js';

const DEVICE_ID = 'playwright-e2e-device';

test.describe('Sync smoke', () => {
  test('push and pull round-trip via API', async ({ request }) => {
    const creds = loadCredentials();
    const login = await request.post(`${creds.apiUrl}/api/v1/auth/login`, {
      data: { email: creds.email, password: creds.password },
      headers: { 'X-Device-Id': DEVICE_ID }
    });
    expect(login.ok()).toBeTruthy();
    const { accessToken: token } = await login.json();

    const mutationId = crypto.randomUUID();
    const localId = 991_000 + Math.floor(Math.random() * 1000);
    const mrn = `PW-E2E-${Date.now()}`;

    const push = await request.post(`${creds.apiUrl}/api/v1/sync/push`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Device-Id': DEVICE_ID
      },
      data: {
        deviceId: DEVICE_ID,
        mutations: [
          {
            mutationId,
            entityType: 'visit',
            operation: 'upsert',
            localId,
            baseRevision: 0,
            payload: {
              id: localId,
              patientId: mrn,
              fullName: 'Playwright Sync Test',
              sex: 'Other',
              visitDate: new Date().toISOString().slice(0, 10),
              chiefComplaint: 'Playwright E2E sync smoke — safe to delete'
            }
          }
        ]
      }
    });
    expect(push.ok()).toBeTruthy();
    const pushBody = await push.json();
    const result = pushBody.data?.results?.[0];
    expect(result?.status).toBe('ok');
    expect(result?.entityId).toBeTruthy();

    const pull = await request.get(
      `${creds.apiUrl}/api/v1/sync/pull?cursor=0&limit=50&deviceId=${DEVICE_ID}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Device-Id': DEVICE_ID
        }
      }
    );
    expect(pull.ok()).toBeTruthy();
    const pullBody = await pull.json();
    const changes = pullBody.data?.changes || [];
    const found = changes.some((c) => c.entityId === result.entityId);
    expect(found).toBeTruthy();
  });
});

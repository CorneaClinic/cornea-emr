import { test, expect } from '@playwright/test';
import crypto from 'crypto';
import { apiLogin, authHeaders } from './helpers.js';

const DEVICE_ID = 'playwright-e2e-registry';

test.describe('KC registry API', () => {
  test('create, read, update, and delete KC patient', async ({ request }) => {
    const { token, creds } = await apiLogin(request, DEVICE_ID);
    const headers = authHeaders(token, DEVICE_ID);
    const suffix = Date.now();
    const kcRegistryId = `PW-E2E-KC-${suffix}`;

    const create = await request.post(`${creds.apiUrl}/api/v1/kc-registry`, {
      headers,
      data: {
        fullName: 'Playwright KC Patient',
        kcRegistryId,
        eyeInvolvement: 'OD',
        diagnosis: 'Keratoconus',
        status: 'Active'
      }
    });
    expect(create.status()).toBe(201);
    const created = (await create.json()).data;
    expect(created.id).toBeTruthy();
    expect(created.fullName).toBe('Playwright KC Patient');

    const read = await request.get(`${creds.apiUrl}/api/v1/kc-registry/${created.id}`, { headers });
    expect(read.ok()).toBeTruthy();
    expect((await read.json()).data.kcRegistryId).toBe(kcRegistryId);

    const update = await request.put(`${creds.apiUrl}/api/v1/kc-registry/${created.id}`, {
      headers,
      data: { status: 'Watch' }
    });
    expect(update.ok()).toBeTruthy();
    expect((await update.json()).data.status).toBe('Watch');

    const del = await request.delete(`${creds.apiUrl}/api/v1/kc-registry/${created.id}`, { headers });
    expect(del.ok()).toBeTruthy();
  });

  test('overview returns 200 when authenticated', async ({ request }) => {
    const { token, creds } = await apiLogin(request, DEVICE_ID);
    const res = await request.get(`${creds.apiUrl}/api/v1/kc-registry/overview`, {
      headers: authHeaders(token, DEVICE_ID)
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data).toBeTruthy();
  });
});

test.describe('Record lock API', () => {
  test('acquire, renew, and release lock on visit entity', async ({ request }) => {
    const { token, creds } = await apiLogin(request, DEVICE_ID);
    const headers = authHeaders(token, DEVICE_ID);
    const mutationId = crypto.randomUUID();
    const localId = 992_000 + Math.floor(Math.random() * 1000);

    const push = await request.post(`${creds.apiUrl}/api/v1/sync/push`, {
      headers,
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
              patientId: `PW-LOCK-${Date.now()}`,
              fullName: 'Playwright Lock Test',
              sex: 'Other',
              visitDate: new Date().toISOString().slice(0, 10),
              chiefComplaint: 'Record lock E2E — safe to delete'
            }
          }
        ]
      }
    });
    expect(push.ok()).toBeTruthy();
    const entityId = (await push.json()).data?.results?.[0]?.entityId;
    expect(entityId).toBeTruthy();

    const acquire = await request.post(`${creds.apiUrl}/api/v1/record-locks/acquire`, {
      headers,
      data: { entityType: 'visit', entityId, deviceId: DEVICE_ID, ttlMinutes: 5 }
    });
    expect(acquire.ok()).toBeTruthy();
    const lock = (await acquire.json()).data;
    expect(lock.entityId).toBe(entityId);
    expect(lock.entityType).toBe('visit');

    const getLock = await request.get(
      `${creds.apiUrl}/api/v1/record-locks/visit/${entityId}`,
      { headers }
    );
    expect(getLock.ok()).toBeTruthy();
    expect((await getLock.json()).data.entityId).toBe(entityId);

    const renew = await request.post(`${creds.apiUrl}/api/v1/record-locks/renew`, {
      headers,
      data: { entityType: 'visit', entityId, ttlMinutes: 5 }
    });
    expect(renew.ok()).toBeTruthy();

    const release = await request.post(`${creds.apiUrl}/api/v1/record-locks/release`, {
      headers,
      data: { entityType: 'visit', entityId }
    });
    expect(release.ok()).toBeTruthy();
    expect((await release.json()).data.released).toBe(true);

    const afterRelease = await request.get(
      `${creds.apiUrl}/api/v1/record-locks/visit/${entityId}`,
      { headers }
    );
    expect(afterRelease.ok()).toBeTruthy();
    expect((await afterRelease.json()).data).toBeNull();
  });
});

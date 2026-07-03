import { test, expect } from '@playwright/test';
import crypto from 'crypto';
import { apiLogin, authHeaders, loadCredentials, signInCloud, waitForCloudRegistryMode } from './helpers.js';
import { buildMinimalDicomBuffer } from './fixtures/minimal-dicom.js';

const DEVICE_ID = 'playwright-e2e-dicom';

function dicomMultipart(buffer, extra = {}) {
  return {
    file: {
      name: 'pentacam-study.dcm',
      mimeType: 'application/dicom',
      buffer
    },
    ...extra
  };
}

test.describe('DICOM ingest API (Phase 4 P6)', () => {
  test('parse returns metadata and suggested category', async ({ request }) => {
    const { token, creds } = await apiLogin(request, DEVICE_ID);
    const res = await request.post(`${creds.apiUrl}/api/v1/dicom/parse`, {
      headers: authHeaders(token, DEVICE_ID),
      multipart: dicomMultipart(buildMinimalDicomBuffer())
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.suggestedCategory).toBe('topography');
    expect(body.data.tags.patientName).toBe('John Doe');
    expect(body.data.tags.modality).toBe('OT');
    expect(body.data.tags.studyDescription).toBe('Pentacam HR');
  });

  test('ingest stores DICOM in clinical media library', async ({ request }) => {
    const { token, creds } = await apiLogin(request, DEVICE_ID);
    const headers = authHeaders(token, DEVICE_ID);
    const mutationId = crypto.randomUUID();
    const localId = 990_000 + Math.floor(Math.random() * 1000);

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
              patientId: `PW-DICOM-${Date.now()}`,
              fullName: 'Playwright DICOM Patient',
              sex: 'Male',
              visitDate: new Date().toISOString().slice(0, 10),
              chiefComplaint: 'DICOM E2E — safe to delete'
            }
          }
        ]
      }
    });
    expect(push.ok()).toBeTruthy();
    const visitId = (await push.json()).data?.results?.[0]?.entityId;
    const visitRes = await request.get(`${creds.apiUrl}/api/v1/visits/${visitId}`, { headers });
    const patientId = (await visitRes.json()).data.patientId;

    const ingest = await request.post(`${creds.apiUrl}/api/v1/dicom/ingest`, {
      headers,
      multipart: dicomMultipart(buildMinimalDicomBuffer(), {
        entityType: 'patient',
        entityId: patientId,
        category: 'topography',
        label: 'E2E Pentacam study'
      })
    });
    expect(ingest.status()).toBe(201);
    const body = await ingest.json();
    expect(body.data.asset.id).toBeTruthy();
    expect(body.data.asset.mimeType).toBe('application/dicom');
    expect(body.data.asset.category).toBe('topography');
    expect(body.data.dicom.tags.modality).toBe('OT');
  });

  test('parse rejects non-DICOM upload', async ({ request }) => {
    const { token, creds } = await apiLogin(request, DEVICE_ID);
    const res = await request.post(`${creds.apiUrl}/api/v1/dicom/parse`, {
      headers: authHeaders(token, DEVICE_ID),
      multipart: {
        file: {
          name: 'not-dicom.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('not a dicom file')
        }
      }
    });
    expect(res.status()).toBe(400);
  });

  test('parse requires authentication', async ({ request }) => {
    const creds = loadCredentials();
    const res = await request.post(`${creds.apiUrl}/api/v1/dicom/parse`, {
      multipart: dicomMultipart(buildMinimalDicomBuffer())
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('DICOM ingest UI (Phase 4 P6)', () => {
  test('clinical media tab shows DICOM import entry point', async ({ page }) => {
    await signInCloud(page);
    await waitForCloudRegistryMode(page);
    await page.locator('#nav-clinicalMediaTab').click();
    await expect(page.locator('#clinicalMediaTab')).toHaveClass(/active/);
    await expect(page.getByRole('button', { name: /Import DICOM/i })).toBeVisible();
  });
});

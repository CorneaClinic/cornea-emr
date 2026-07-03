import { test, expect } from '@playwright/test';
import crypto from 'crypto';
import { apiLogin, authHeaders, loadCredentials, signInCloud, openAppointmentsSchedule, waitForCloudRegistryMode } from './helpers.js';

const DEVICE_ID = 'playwright-e2e-appointments';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

test.describe('Appointments API (Phase 4 P5)', () => {
  test('book, list day, mark arrived, cancel', async ({ request }) => {
    const { token, creds } = await apiLogin(request, DEVICE_ID);
    const headers = authHeaders(token, DEVICE_ID);
    const day = todayIso();

    const create = await request.post(`${creds.apiUrl}/api/v1/appointments`, {
      headers,
      data: {
        patientName: 'Playwright Appt Patient',
        patientMrn: `PW-APPT-${Date.now()}`,
        appointmentDate: day,
        startTime: '10:00',
        durationMinutes: 20,
        appointmentType: 'visit',
        reason: 'E2E test appointment'
      }
    });
    expect(create.status()).toBe(201);
    const appt = (await create.json()).data;
    expect(appt.id).toBeTruthy();
    expect(appt.appointmentId).toMatch(/^APPT-/);
    expect(appt.status).toBe('scheduled');

    const dayRes = await request.get(
      `${creds.apiUrl}/api/v1/appointments/day/${encodeURIComponent(day)}`,
      { headers }
    );
    expect(dayRes.ok()).toBeTruthy();
    const dayBody = await dayRes.json();
    expect(dayBody.data.date).toBe(day);
    expect(dayBody.data.data.some((a) => a.id === appt.id)).toBe(true);

    const arrived = await request.patch(
      `${creds.apiUrl}/api/v1/appointments/${appt.id}`,
      { headers, data: { status: 'arrived', revision: appt.revision } }
    );
    expect(arrived.ok()).toBeTruthy();
    expect((await arrived.json()).data.status).toBe('arrived');

    const cancel = await request.delete(
      `${creds.apiUrl}/api/v1/appointments/${appt.id}`,
      { headers }
    );
    expect(cancel.ok()).toBeTruthy();
    expect((await cancel.json()).data.status).toBe('cancelled');
  });

  test('recall queue lists due follow-up until recall appointment booked', async ({ request }) => {
    const { token, creds } = await apiLogin(request, DEVICE_ID);
    const headers = authHeaders(token, DEVICE_ID);
    const mutationId = crypto.randomUUID();
    const localId = 991_000 + Math.floor(Math.random() * 1000);
    const patientName = 'Playwright Recall Patient';
    const day = todayIso();

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
              patientId: `PW-RECALL-${Date.now()}`,
              fullName: patientName,
              sex: 'Female',
              visitDate: day,
              chiefComplaint: 'Recall E2E — safe to delete'
            }
          }
        ]
      }
    });
    expect(push.ok()).toBeTruthy();
    const pushBody = await push.json();
    const visitId = pushBody.data?.results?.[0]?.entityId;
    expect(visitId).toBeTruthy();

    const visitRes = await request.get(`${creds.apiUrl}/api/v1/visits/${visitId}`, { headers });
    expect(visitRes.ok()).toBeTruthy();
    const patientId = (await visitRes.json()).data.patientId;
    expect(patientId).toBeTruthy();

    const fu = await request.put(
      `${creds.apiUrl}/api/v1/visits/${visitId}/followup`,
      {
        headers,
        data: {
          followUpDate: day,
          purpose: 'KC review',
          severity: 'moderate'
        }
      }
    );
    expect(fu.ok()).toBeTruthy();

    const queue = await request.get(
      `${creds.apiUrl}/api/v1/appointments/recall-queue?days=30`,
      { headers }
    );
    expect(queue.ok()).toBeTruthy();
    const q = (await queue.json()).data;
    expect(q.dueFollowups.some((r) => r.visitId === visitId)).toBe(true);

    const book = await request.post(`${creds.apiUrl}/api/v1/appointments`, {
      headers,
      data: {
        patientId,
        patientName,
        appointmentDate: day,
        startTime: '11:00',
        appointmentType: 'recall',
        recallSourceVisitId: visitId,
        reason: 'KC review'
      }
    });
    expect(book.status()).toBe(201);

    const queue2 = await request.get(
      `${creds.apiUrl}/api/v1/appointments/recall-queue?days=30`,
      { headers }
    );
    expect(queue2.ok()).toBeTruthy();
    const q2 = (await queue2.json()).data;
    expect(q2.dueFollowups.some((r) => r.visitId === visitId)).toBe(false);
    expect(q2.scheduledRecalls.some((a) => a.recallSourceVisitId === visitId)).toBe(true);
  });

  test('day schedule requires authentication', async ({ request }) => {
    const creds = loadCredentials();
    const res = await request.get(`${creds.apiUrl}/api/v1/appointments/day/2025-01-01`);
    expect(res.status()).toBe(401);
  });
});

test.describe('Appointments UI (Phase 4 P5)', () => {
  test('day schedule tab loads after cloud sign-in', async ({ page }) => {
    await signInCloud(page);
    await waitForCloudRegistryMode(page);
    const dayResponse = page.waitForResponse(
      (r) => r.url().includes('/api/v1/appointments/day/') && r.ok(),
      { timeout: 30_000 }
    );
    await openAppointmentsSchedule(page);
    await dayResponse;
    await expect(page.locator('#apptScheduleBody')).toBeVisible();
    await expect(page.locator('#apptCloudHint')).toBeHidden();
    await expect(page.locator('#apptDatePicker')).toHaveValue(/\d{4}-\d{2}-\d{2}/);
  });
});

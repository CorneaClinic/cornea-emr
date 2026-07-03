#!/usr/bin/env node
/**
 * Production operator checklist (docs/PHASE4_EXIT.md).
 * Requires STAGING_E2E_EMAIL + STAGING_E2E_PASSWORD (cornea_consultant+ recommended).
 */
import { buildMinimalDicomBuffer } from '../e2e/fixtures/minimal-dicom.js';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const API = (process.env.STAGING_API_URL || 'https://corneaclinic-2zfpt.ondigitalocean.app').replace(
  /\/$/,
  ''
);
const EMAIL = (process.env.STAGING_E2E_EMAIL || '').trim();
const PASSWORD = process.env.STAGING_E2E_PASSWORD || '';
const DEVICE = 'production-operator-check';

const results = [];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function login() {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-Id': DEVICE },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    signal: AbortSignal.timeout(25_000)
  });
  if (!res.ok) {
    throw new Error(`Login failed (${res.status}): ${await res.text()}`);
  }
  const body = await res.json();
  if (!body.accessToken) throw new Error('Login missing accessToken');
  return body.accessToken;
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    'X-Device-Id': DEVICE,
    'Content-Type': 'application/json'
  };
}

async function apiGet(token, path) {
  return fetch(`${API}${path}`, {
    headers: headers(token),
    signal: AbortSignal.timeout(30_000)
  });
}

async function apiPost(token, path, data) {
  return fetch(`${API}${path}`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(30_000)
  });
}

async function apiDelete(token, path) {
  return fetch(`${API}${path}`, {
    method: 'DELETE',
    headers: headers(token),
    signal: AbortSignal.timeout(30_000)
  });
}

async function checkDashboardKpis(token) {
  const res = await apiGet(token, '/api/v1/dashboard/kpis');
  if (!res.ok) {
    record('Dashboard institute KPIs', false, `HTTP ${res.status}`);
    return;
  }
  const body = await res.json();
  const v = body?.data?.visits;
  const ok =
    v &&
    typeof v.total === 'number' &&
    body.data.registries?.kc &&
    body.data.generatedAt;
  record('Dashboard institute KPIs', ok, ok ? `visits.total=${v.total}` : 'unexpected payload');
}

async function checkResearchExport(token) {
  const csvRes = await apiGet(token, '/api/v1/research-analytics/cohort/kc/export.csv?limit=5');
  if (!csvRes.ok) {
    record('Research cohort CSV export', false, `HTTP ${csvRes.status}`);
  } else {
    const csv = await csvRes.text();
    record(
      'Research cohort CSV export',
      csv.includes('kcRegistryId') || csv.length > 20,
      `${csv.split('\n').length} lines`
    );
  }

  const fhirRes = await apiGet(
    token,
    '/api/v1/fhir-export/cohort/kc/bundle?anonymize=true&limit=5'
  );
  if (!fhirRes.ok) {
    record('Research FHIR cohort export', false, `HTTP ${fhirRes.status}`);
    return;
  }
  const bundle = await fhirRes.json();
  record(
    'Research FHIR cohort export',
    bundle.resourceType === 'Bundle' && bundle.type === 'collection',
    `${bundle.entry?.length ?? 0} entries`
  );
}

async function checkTopographyImport() {
  try {
    execSync('node apps/clinic/tests/topography-import.test.mjs', {
      cwd: repoRoot,
      stdio: 'pipe'
    });
    record('KC Sirius/Pentacam CSV import preview (parser)', true, 'unit smoke passed');
  } catch (err) {
    record('KC Sirius/Pentacam CSV import preview (parser)', false, err.message?.slice(0, 80));
  }
}

async function checkAppointments(token) {
  const day = todayIso();
  const create = await apiPost(token, '/api/v1/appointments', {
    patientName: 'Operator Check Patient',
    patientMrn: `OPCHK-${Date.now()}`,
    appointmentDate: day,
    startTime: '14:30',
    durationMinutes: 15,
    appointmentType: 'visit',
    reason: 'Phase 4 operator checklist'
  });
  if (!create.ok) {
    record('Appointments book slot', false, `HTTP ${create.status}`);
    record('Appointments recall queue', false, 'skipped (no booking)');
    return;
  }
  const appt = (await create.json()).data;
  record('Appointments book slot', true, appt.appointmentId);

  const recall = await apiGet(token, '/api/v1/appointments/recall-queue?limit=10');
  if (!recall.ok) {
    record('Appointments recall queue', false, `HTTP ${recall.status}`);
  } else {
    const body = await recall.json();
    const data = body.data;
    const ok =
      data &&
      Array.isArray(data.dueFollowups) &&
      Array.isArray(data.scheduledRecalls);
    record(
      'Appointments recall queue',
      ok,
      ok ? `${data.dueFollowups.length} due, ${data.scheduledRecalls.length} recall` : 'unexpected payload'
    );
  }

  await apiDelete(token, `/api/v1/appointments/${appt.id}`);
}

async function checkDicomParse(token) {
  const buf = buildMinimalDicomBuffer();
  const form = new FormData();
  form.append('file', new Blob([buf]), 'operator-check.dcm');

  const res = await fetch(`${API}/api/v1/dicom/parse`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-Device-Id': DEVICE },
    body: form,
    signal: AbortSignal.timeout(30_000)
  });
  if (!res.ok) {
    record('Clinical Media DICOM import preview', false, `HTTP ${res.status}`);
    return;
  }
  const body = await res.json();
  record(
    'Clinical Media DICOM import preview',
    Boolean(body.data?.suggestedCategory),
    body.data?.suggestedCategory || ''
  );
}

async function checkDryEye(token) {
  const create = await apiPost(token, '/api/v1/dry-eye-registry', {
    fullName: 'Operator Check Dry Eye',
    primarySubtype: 'MGD',
    status: 'Active'
  });
  if (!create.ok) {
    record('Dry Eye new case + OSD assessment', false, `create HTTP ${create.status}`);
    return;
  }
  const caseRow = (await create.json()).data;
  const assess = await apiPost(token, `/api/v1/dry-eye-registry/${caseRow.id}/assessments`, {
    assessedAt: todayIso(),
    tbutOd: 5,
    schirmerOd: 6,
    osdiScore: 28,
    mgdGrade: 'Mild'
  });
  if (!assess.ok) {
    record('Dry Eye new case + OSD assessment', false, `assess HTTP ${assess.status}`);
    return;
  }
  const assessment = (await assess.json()).data;
  record(
    'Dry Eye new case + OSD assessment',
    assessment.osdIndexScore > 0 && caseRow.caseId?.startsWith('DE-'),
    `OSD index ${assessment.osdIndexScore}`
  );
}

async function checkOrSchedule(token) {
  const day = todayIso();
  const create = await apiPost(token, '/api/v1/or-schedule', {
    patientName: 'Operator Check OR',
    procedureDate: day,
    startTime: '09:00',
    procedureType: 'PK',
    surgeonName: 'Dr Operator',
    theatre: 'Theatre 1'
  });
  if (!create.ok) {
    record('OR schedule book PK case', false, `HTTP ${create.status}`);
    return;
  }
  const orCase = (await create.json()).data;
  const dayRes = await apiGet(token, `/api/v1/or-schedule/day/${encodeURIComponent(day)}`);
  const listed =
    dayRes.ok && (await dayRes.json()).data?.some((r) => r.id === orCase.id);
  record('OR schedule book PK case', listed, orCase.caseNumber);
}

async function checkEctasiaV2(token) {
  const res = await apiPost(token, '/api/v1/ectasia-ai/analyze', {
    useV2: true,
    od: { badD: 1.4, kmax: 46, abcdGrade: 'C', isv: 45 },
    os: { badD: 1.2, kmax: 44 },
    shared: { age: 22, ocularSurfaceDryEye: true }
  });
  if (!res.ok) {
    record('KC/laser ectasia v2 analysis', false, `HTTP ${res.status}`);
    return;
  }
  const body = (await res.json()).data;
  record(
    'KC/laser ectasia v2 analysis',
    body.modelVersion === 'ectasia-v2-topography' && body.procedureRanking,
    body.modelVersion
  );
}

async function main() {
  console.log('=== Production operator checklist ===\n');
  console.log(`API: ${API}`);
  console.log(`User: ${EMAIL || '(not set)'}\n`);

  if (!EMAIL || !PASSWORD) {
    console.error('Set STAGING_E2E_EMAIL and STAGING_E2E_PASSWORD');
    console.error('Tip: npm run e2e:staging-user (use STAGING_E2E_ROLE=cornea_consultant for full checklist)');
    process.exit(1);
  }

  let token;
  try {
    token = await login();
    const me = await apiGet(token, '/api/v1/auth/me');
    const role = me.ok ? (await me.json()).user?.role : '?';
    console.log(`Signed in as ${EMAIL} (${role})\n`);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }

  await checkDashboardKpis(token);
  await checkResearchExport(token);
  await checkTopographyImport();
  await checkAppointments(token);
  await checkDicomParse(token);
  await checkDryEye(token);
  await checkOrSchedule(token);
  await checkEctasiaV2(token);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== Summary: ${results.length - failed.length}/${results.length} passed ===`);
  if (failed.length) {
    failed.forEach((r) => console.log(`  ✗ ${r.name}: ${r.detail}`));
    if (failed.some((r) => String(r.detail).includes('403'))) {
      console.log(
        '\nHint: re-run with consultant role:\n  $env:STAGING_E2E_ROLE="cornea_consultant"; npm run e2e:staging-user'
      );
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

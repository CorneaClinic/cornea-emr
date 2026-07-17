/**
 * Surgical Centre production smoke (API + asset markers).
 * Usage:
 *   STAGING_E2E_EMAIL=... STAGING_E2E_PASSWORD=... node scripts/smoke-surgical-centre.mjs
 * Or with DATABASE_URL for migration column check only.
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.join(__dirname, '..', 'apps', 'api');
const require = createRequire(path.join(apiRoot, 'package.json'));
const pg = require('pg');

for (const name of ['.env.production', '.env.local', '.env']) {
  const p = path.join(apiRoot, name);
  if (fs.existsSync(p)) {
    const text = fs.readFileSync(p, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[m[1]] || process.env[m[1]] === '') process.env[m[1]] = v;
    }
  }
}

const API = (process.env.STAGING_API_URL || process.env.PRODUCTION_API_URL || 'https://corneaclinic-2zfpt.ondigitalocean.app').replace(/\/$/, '');
const CLINIC = (process.env.CLINIC_URL || 'https://corneaclinic.visionemr.net').replace(/\/$/, '');
const email = (process.env.STAGING_E2E_EMAIL || process.env.SEED_ADMIN_EMAIL || '').trim();
const password = process.env.STAGING_E2E_PASSWORD || process.env.SEED_ADMIN_PASSWORD || '';
if (!email || !password) {
  console.log(`Auth env: email=${email ? 'set' : 'missing'} password=${password ? 'set' : 'missing'}`);
}

const results = [];
function ok(name, detail = '') {
  results.push({ ok: true, name, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ ok: false, name, detail });
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function checkAssets() {
  const html = await fetch(`${CLINIC}/Cornea`).then((r) => r.text());
  const js = await fetch(`${CLINIC}/cornea-surgical-centre.js`).then((r) => r.text());
  const markers = [
    'surgicalWhoModal',
    'surgicalPostopModal',
    'surgicalIntraopPanel',
    'roleW_otSched',
    'CorneaSurgicalCentre.openFromNav'
  ];
  for (const m of markers) {
    if (html.includes(m)) ok(`html has ${m}`);
    else fail(`html has ${m}`);
  }
  for (const m of ['openWhoModal', 'savePostopFollowup', 'recordEventForEpisode', 'openFromNav']) {
    if (js.includes(m)) ok(`js has ${m}`);
    else fail(`js has ${m}`);
  }
}

async function checkDbColumns() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('SKIP  DATABASE_URL not set');
    return;
  }
  const client = new pg.Client({
    connectionString: url.replace(/([?&])sslmode=[^&]*/gi, '$1').replace(/[?&]$/, ''),
    ssl: { rejectUnauthorized: false }
  });
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  try {
    await client.connect();
    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'surgical_episodes'
         AND column_name IN ('who_checklist', 'postop_followups')
       ORDER BY 1`
    );
    const names = cols.rows.map((r) => r.column_name);
    if (names.includes('who_checklist') && names.includes('postop_followups')) {
      ok('migration 028 columns', names.join(','));
    } else {
      fail('migration 028 columns', `found: ${names.join(',') || '(none)'}`);
    }
  } catch (err) {
    fail('migration 028 columns', err?.message || String(err));
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

async function api(pathname, { method = 'GET', token, body } = {}) {
  const headers = { 'X-Device-Id': 'surgical-smoke', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body != null) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000)
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { res, text, json };
}

async function checkApiFlow() {
  if (!email || !password) {
    console.log('SKIP  API flow (set STAGING_E2E_EMAIL / STAGING_E2E_PASSWORD)');
    return;
  }

  const live = await api('/health/live');
  if (live.res.ok && live.json?.ok) ok('API live');
  else fail('API live', live.text.slice(0, 200));

  const login = await api('/api/v1/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  const token = login.json?.accessToken;
  if (!token) {
    fail('login', `${login.res.status} ${login.text.slice(0, 200)}`);
    return;
  }
  ok('login');

  const workflow = await api('/api/v1/surgical-centre/workflow', { token });
  if (workflow.res.ok && workflow.json?.data?.whoChecklistPhases?.length) {
    ok('workflow meta', `${workflow.json.data.whoChecklistPhases.length} WHO phases`);
  } else {
    fail('workflow meta', `${workflow.res.status} ${workflow.text.slice(0, 300)}`);
  }

  const dash = await api('/api/v1/surgical-centre/dashboard', { token });
  if (dash.res.ok && dash.json?.data?.today) ok('dashboard', JSON.stringify(dash.json.data.today));
  else fail('dashboard', `${dash.res.status} ${dash.text.slice(0, 300)}`);

  const stamp = Date.now().toString(36);
  const created = await api('/api/v1/surgical-centre/episodes', {
    method: 'POST',
    token,
    body: {
      patientName: `Smoke Patient ${stamp}`,
      patientMrn: `SMK-${stamp}`,
      diagnosis: 'Smoke-test keratoconus',
      plannedProcedure: 'Pterygium excision',
      eye: 'OD',
      priority: 'ELECTIVE',
      surgeonName: 'Smoke Surgeon',
      notes: 'Automated surgical centre smoke'
    }
  });
  const episode = created.json?.data;
  if (!created.res.ok || !episode?.id) {
    fail('create episode', `${created.res.status} ${created.text.slice(0, 400)}`);
    return;
  }
  ok('create episode', episode.surgicalEpisodeId || episode.id);
  const id = episode.id;

  const preop = await api(`/api/v1/surgical-centre/episodes/${id}/preop`, {
    method: 'POST',
    token,
    body: {
      fitStatus: 'FIT_FOR_SURGERY',
      anaesthesiaPlan: 'LA',
      medicalHistory: 'nil',
      medications: 'nil',
      allergies: 'NKDA',
      allergyAlert: false,
      investigations: 'ok',
      notes: 'smoke preop'
    }
  });
  if (preop.res.ok) ok('preop');
  else fail('preop', `${preop.res.status} ${preop.text.slice(0, 300)}`);

  const consent = await api(`/api/v1/surgical-centre/episodes/${id}/events`, {
    method: 'POST',
    token,
    body: { event: 'CONSENT_COMPLETE' }
  });
  if (consent.res.ok && consent.json?.data?.consentStatus === 'COMPLETE') ok('consent event');
  else fail('consent event', `${consent.res.status} ${consent.text.slice(0, 300)}`);

  const checklistBody = {};
  for (const key of [
    'patient_identity',
    'mrn_verified',
    'correct_procedure',
    'correct_eye',
    'site_marked',
    'consent_complete',
    'allergies_reviewed',
    'medications_reviewed',
    'anaesthesia_plan',
    'equipment_available'
  ]) {
    checklistBody[key] = { done: true };
  }
  const safety = await api(`/api/v1/surgical-centre/episodes/${id}/safety-checklist`, {
    method: 'POST',
    token,
    body: { checklist: checklistBody }
  });
  if (safety.res.ok) ok('safety checklist', `pct=${safety.json?.data?.safetyChecklistPct}`);
  else fail('safety checklist', `${safety.res.status} ${safety.text.slice(0, 300)}`);

  const whoPhase = {
    identity_confirmed: { done: true },
    site_marked: { done: true },
    anaesthesia_check: { done: true },
    pulse_oximeter: { done: true },
    allergy_confirmed: { done: true },
    airway_risk: { done: true }
  };
  const who = await api(`/api/v1/surgical-centre/episodes/${id}/who-checklist`, {
    method: 'POST',
    token,
    body: { phase: 'sign_in', checklist: whoPhase }
  });
  if (who.res.ok && who.json?.data?.whoSignInStatus === 'COMPLETED') ok('WHO sign-in');
  else fail('WHO sign-in', `${who.res.status} ${who.text.slice(0, 400)}`);

  const started = await api(`/api/v1/surgical-centre/episodes/${id}/events`, {
    method: 'POST',
    token,
    body: { event: 'SURGERY_STARTED' }
  });
  if (started.res.ok && started.json?.data?.stage === 'OPERATING_THEATRE') ok('surgery started');
  else fail('surgery started', `${started.res.status} ${started.text.slice(0, 400)}`);

  const completed = await api(`/api/v1/surgical-centre/episodes/${id}/events`, {
    method: 'POST',
    token,
    body: { event: 'SURGERY_COMPLETED', actualProcedure: 'Pterygium excision' }
  });
  if (completed.res.ok && completed.json?.data?.stage === 'RECOVERY') ok('surgery completed');
  else fail('surgery completed', `${completed.res.status} ${completed.text.slice(0, 400)}`);

  const postop = await api(`/api/v1/surgical-centre/episodes/${id}/postop-followup`, {
    method: 'POST',
    token,
    body: {
      milestoneId: 'POST_OP_DAY_1',
      visitDate: new Date().toISOString().slice(0, 10),
      visualAcuity: '6/18',
      graftStatus: 'Clear',
      complications: 'None',
      notes: 'smoke postop',
      completed: true
    }
  });
  if (postop.res.ok && (postop.json?.data?.postopFollowups || []).length) ok('postop follow-up');
  else fail('postop follow-up', `${postop.res.status} ${postop.text.slice(0, 400)}`);

  const discharged = await api(`/api/v1/surgical-centre/episodes/${id}/events`, {
    method: 'POST',
    token,
    body: { event: 'DISCHARGED' }
  });
  if (discharged.res.ok) ok('discharged');
  else fail('discharged', `${discharged.res.status} ${discharged.text.slice(0, 300)}`);
}

const failures = [];
try {
  await checkAssets();
  await checkDbColumns();
  await checkApiFlow();
} catch (err) {
  fail('unexpected', err?.message || String(err));
}

for (const r of results) {
  if (!r.ok) failures.push(r);
}
console.log('');
console.log(`Summary: ${results.filter((r) => r.ok).length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);

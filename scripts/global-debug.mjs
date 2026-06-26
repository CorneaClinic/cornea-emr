#!/usr/bin/env node
/**
 * Global production + codebase health debug.
 * Usage: node scripts/global-debug.mjs
 * Env: DIGITALOCEAN_API_TOKEN (optional, for DO app env audit)
 *      API_URL, CLINIC_URL, SEED_ADMIN_PASSWORD (optional extras)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const API_URL = (process.env.API_URL || 'https://api.visionemr.net').replace(/\/$/, '');
const API_FALLBACK = 'https://corneaclinic-2zfpt.ondigitalocean.app';
const CLINIC_URL = (process.env.CLINIC_URL || 'https://corneaclinic.visionemr.net/Cornea').replace(/\/$/, '');
const DO_APP_ID = process.env.DO_APP_ID || 'a2be820f-a9f2-496b-bc2d-5aacef4ad7e4';

let passed = 0;
let failed = 0;
let warned = 0;

function ok(name, detail = '') {
  passed++;
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  failed++;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

function warn(name, detail = '') {
  warned++;
  console.warn(`  ! ${name}${detail ? ` — ${detail}` : ''}`);
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 15000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { res, json, text };
  } finally {
    clearTimeout(timer);
  }
}

async function checkApiBase(baseUrl) {
  const label = baseUrl.replace(/^https?:\/\//, '');
  const live = await fetchJson(`${baseUrl}/health/live`);
  if (live.res.ok && live.json?.ok) {
    ok(`API live [${label}]`, `v${live.json.version || '?'}`);
    return true;
  }
  if (label.startsWith('api.visionemr.net') && live.res.status === 403) {
    warn(`API live [${label}]`, 'Cloudflare challenge (403) — normal for scripts; browsers OK');
    return false;
  }
  fail(`API live [${label}]`, `${live.res.status} ${live.text?.slice(0, 120) || ''}`);
  return false;
}

async function checkApiReady(baseUrl) {
  const label = baseUrl.replace(/^https?:\/\//, '');
  const ready = await fetchJson(`${baseUrl}/health/ready`);
  if (ready.res.ok && ready.json?.ok) {
    ok(`API ready [${label}]`, 'database connected');
    return true;
  }
  const db = ready.json?.checks?.database;
  fail(`API ready [${label}]`, db?.error || `${ready.res.status}`);
  return false;
}

async function checkCors(baseUrl) {
  const origin = 'https://corneaclinic.visionemr.net';
  const res = await fetch(`${baseUrl}/health/live`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'GET'
    }
  }).catch((err) => ({ ok: false, status: 0, headers: { get: () => null }, _err: err }));
  const allowOrigin = res.headers?.get?.('access-control-allow-origin');
  if (allowOrigin && (allowOrigin === origin || allowOrigin === '*')) {
    ok('CORS preflight', allowOrigin);
  } else {
    warn('CORS preflight', allowOrigin || res._err?.message || 'no Access-Control-Allow-Origin');
  }
}

async function checkAuthLogin(baseUrl) {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    warn('Auth login', 'skipped (set SEED_ADMIN_PASSWORD to test)');
    return;
  }
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@corneaclinic.local';
  const { res, json } = await fetchJson(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (res.ok && json?.accessToken) {
    ok('Auth login', email);
    const me = await fetchJson(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${json.accessToken}` }
    });
    if (me.res.ok && me.json?.user?.email) ok('Auth /me', me.json.user.role || 'ok');
    else fail('Auth /me', `${me.res.status}`);
  } else {
    fail('Auth login', json?.error?.message || `${res.status}`);
  }
}

async function checkClinicFrontend() {
  const res = await fetch(CLINIC_URL, { redirect: 'follow' });
  if (!res.ok) {
    fail('Clinic frontend', `${CLINIC_URL} → ${res.status}`);
    return;
  }
  const html = await res.text();
  ok('Clinic frontend', `${CLINIC_URL} (${res.status})`);

  const base = CLINIC_URL.replace(/\/Cornea\/?$/, '');
  const patientFormUrl = `${base}/js/patient-form.js`;
  const pf = await fetch(patientFormUrl, { redirect: 'follow' });
  if (!pf.ok) {
    fail('patient-form.js deployed', `${pf.status}`);
    return;
  }
  const pfText = await pf.text();
  if (pfText.includes("getElementById('currentRecordId')") && pfText.includes('_currentViewRecordId')) {
    ok('Duplicate-save fix deployed', 'patient-form.js reads currentRecordId from DOM');
  } else {
    fail('Duplicate-save fix deployed', 'patient-form.js missing currentRecordId DOM read');
  }

  const adapterUrl = `${base}/cornea-api-adapter.js`;
  const ad = await fetch(adapterUrl, { redirect: 'follow' });
  if (ad.ok) {
    const adText = await ad.text();
    if (adText.includes('scheduleCloudBootstrap') && adText.includes('Show sign-in immediately')) {
      ok('Login UX fix deployed', 'cornea-api-adapter.js');
    } else {
      warn('Login UX fix deployed', 'adapter missing instant-login/bootstrap changes');
    }
  } else {
    warn('Login UX fix deployed', `could not fetch adapter (${ad.status})`);
  }

  if (html.includes('cornea-api-adapter.js') || html.includes('cornea-visit-media.js')) {
    ok('Clinic bundles referenced', 'adapter + visit media');
  } else {
    warn('Clinic bundles referenced', 'could not confirm script tags in HTML');
  }
}

function checkLocalCodeFixes() {
  const patientForm = path.join(ROOT, 'apps/clinic/js/patient-form.js');
  const adapter = path.join(ROOT, 'apps/clinic/cornea-api-adapter.js');
  const media = path.join(ROOT, 'apps/clinic/cornea-visit-media.js');

  const pf = fs.readFileSync(patientForm, 'utf8');
  if (pf.includes("getElementById('currentRecordId')") && !pf.includes('const rawId = data.currentRecordId')) {
    ok('Local: duplicate-save fix', 'patient-form.js');
  } else {
    fail('Local: duplicate-save fix', 'patient-form.js regression');
  }

  const ad = fs.readFileSync(adapter, 'utf8');
  if (ad.includes('if (data.id == null)') && ad.includes('currentRecordId')) {
    ok('Local: save guard', 'cornea-api-adapter.js');
  } else {
    warn('Local: save guard', 'adapter id guard not found');
  }

  const vm = fs.readFileSync(media, 'utf8');
  if (vm.includes('parseDuplicateAssetId') && vm.includes('reconcileMediaWithRemote')) {
    ok('Local: media sync hardening', 'cornea-visit-media.js');
  } else {
    warn('Local: media sync hardening', 'partial or missing');
  }
}

async function checkDigitalOceanEnv() {
  const token = process.env.DIGITALOCEAN_API_TOKEN;
  if (!token) {
    warn('DigitalOcean app env', 'skipped (DIGITALOCEAN_API_TOKEN not set)');
    return;
  }
  const { res, json } = await fetchJson(`https://api.digitalocean.com/v2/apps/${DO_APP_ID}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    fail('DigitalOcean app fetch', `${res.status}`);
    return;
  }
  const phase = json?.app?.active_deployment?.phase;
  if (phase === 'ACTIVE') ok('DO deployment', 'ACTIVE');
  else warn('DO deployment', phase || 'unknown');

  const appEnvs = json?.app?.spec?.envs || [];
  const serviceEnvs = (json?.app?.spec?.services || []).flatMap((s) => s.envs || []);
  const envs = [...appEnvs, ...serviceEnvs];
  const map = Object.fromEntries(envs.map((e) => [e.key, e.value]));
  if (map.EDIA_S3_BUCKET) fail('DO env typo', 'EDIA_S3_BUCKET still present');
  else ok('DO env typo', 'no EDIA_S3_BUCKET');

  if (map.MEDIA_STORAGE_PROVIDER === 's3') ok('DO media provider', 's3');
  else warn('DO media provider', map.MEDIA_STORAGE_PROVIDER || 'unset');

  if (map.MEDIA_S3_BUCKET) ok('DO MEDIA_S3_BUCKET', map.MEDIA_S3_BUCKET);
  else fail('DO MEDIA_S3_BUCKET', 'missing');

  if (map.MEDIA_S3_ENDPOINT) ok('DO MEDIA_S3_ENDPOINT', map.MEDIA_S3_ENDPOINT);
  else warn('DO MEDIA_S3_ENDPOINT', 'missing');

  if (map.MEDIA_S3_ACCESS_KEY_ID) ok('DO MEDIA_S3_ACCESS_KEY_ID', 'set');
  else fail('DO MEDIA_S3_ACCESS_KEY_ID', 'missing');

  if (map.MEDIA_S3_SECRET_ACCESS_KEY) ok('DO MEDIA_S3_SECRET_ACCESS_KEY', 'set');
  else fail('DO MEDIA_S3_SECRET_ACCESS_KEY', 'missing');

  if (map.NODE_ENV === 'production') ok('DO NODE_ENV', 'production');
  else warn('DO NODE_ENV', map.NODE_ENV || 'unset');

  const refreshExpose = map.AUTH_EXPOSE_REFRESH_IN_BODY;
  if (refreshExpose === 'false' || refreshExpose === false) {
    ok('DO AUTH_EXPOSE_REFRESH_IN_BODY', 'false');
  } else if (refreshExpose === 'true' || refreshExpose === true) {
    warn('DO AUTH_EXPOSE_REFRESH_IN_BODY', 'true — set false for production (G3)');
  } else {
    warn('DO AUTH_EXPOSE_REFRESH_IN_BODY', 'unset — defaults to false when NODE_ENV=production');
  }

  const cors = map.CORS_ORIGIN || '';
  if (cors && cors !== '*' && cors.includes('corneaclinic.visionemr.net')) {
    ok('DO CORS_ORIGIN', cors.split(',')[0].trim() + (cors.includes(',') ? '…' : ''));
  } else if (cors === '*') {
    warn('DO CORS_ORIGIN', '* — use explicit clinic origin (G3)');
  } else {
    warn('DO CORS_ORIGIN', cors || 'unset');
  }

  if (map.SMTP_HOST && map.SMTP_FROM) ok('DO SMTP', `${map.SMTP_HOST} / ${map.SMTP_FROM}`);
  else warn('DO SMTP', 'SMTP_HOST or SMTP_FROM missing (G3 password-reset)');
}

async function main() {
  console.log('\n=== Cornea EMR Global Debug ===\n');
  console.log(`API:    ${API_URL}`);
  console.log(`Clinic: ${CLINIC_URL}`);
  console.log('');

  console.log('— Local codebase —');
  checkLocalCodeFixes();

  console.log('\n— Production API —');
  let apiBase = API_URL;
  let apiOk = await checkApiBase(apiBase);
  if (!apiOk && API_URL !== API_FALLBACK) {
    const cfBlock = apiBase.includes('visionemr.net');
    warn(
      'Primary API unreachable',
      cfBlock
        ? `Cloudflare may block automated requests; clinic browsers still work. Trying ${API_FALLBACK}`
        : `trying ${API_FALLBACK}`
    );
    apiBase = API_FALLBACK;
    apiOk = await checkApiBase(apiBase);
  }
  if (apiOk) {
    await checkApiReady(apiBase);
    await checkCors(apiBase);
    await checkAuthLogin(apiBase);
  }

  console.log('\n— Clinic frontend —');
  await checkClinicFrontend();

  console.log('\n— DigitalOcean —');
  await checkDigitalOceanEnv();

  console.log('\n=== Summary ===');
  console.log(`  Passed:   ${passed}`);
  console.log(`  Failed:   ${failed}`);
  console.log(`  Warnings: ${warned}`);
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Global debug crashed:', err);
  process.exit(2);
});

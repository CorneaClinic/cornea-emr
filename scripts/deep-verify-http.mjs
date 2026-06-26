#!/usr/bin/env node
/**
 * Deep HTTP verification against production API (no local DB required).
 *
 * Usage:
 *   node scripts/deep-verify-http.mjs
 *   AUTH_EMAIL=admin@... AUTH_PASSWORD=... node scripts/deep-verify-http.mjs
 */
const API = (process.env.API_URL || 'https://corneaclinic-2zfpt.ondigitalocean.app').replace(/\/$/, '');
const AUTH_EMAIL = process.env.AUTH_EMAIL || process.env.SEED_ADMIN_EMAIL || 'admin@corneaclinic.local';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || process.env.SEED_ADMIN_PASSWORD || '';
const DEVICE_ID = 'deep-verify-http-device';

let passed = 0;
let failed = 0;
let warned = 0;
let token = '';

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

async function http(method, path, { body, headers = {}, formData } = {}) {
  const init = {
    method,
    headers: {
      'X-Device-Id': DEVICE_ID,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    }
  };
  if (formData) {
    init.body = formData;
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, init);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text, res };
}

function tinyPngBuffer() {
  // 1x1 PNG
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
}

async function runUnauthenticated() {
  console.log('— Health & security —');
  const live = await http('GET', '/health/live');
  if (live.status === 200 && live.json?.ok) ok('GET /health/live', live.json.version);
  else fail('GET /health/live', `${live.status}`);

  const ready = await http('GET', '/health/ready');
  if (ready.status === 200 && ready.json?.ok) ok('GET /health/ready', 'database');
  else fail('GET /health/ready', ready.json?.checks?.database?.error || `${ready.status}`);

  const badLogin = await http('POST', '/api/v1/auth/login', {
    body: { email: 'nobody@example.com', password: 'wrong-password-xyz' }
  });
  if (badLogin.status === 401 || badLogin.status === 400) ok('POST /auth/login rejects bad credentials', `${badLogin.status}`);
  else fail('POST /auth/login rejects bad credentials', `${badLogin.status}`);

  const pullNoAuth = await http('GET', '/api/v1/sync/pull?cursor=0&limit=1');
  if (pullNoAuth.status === 401) ok('GET /sync/pull requires auth', '401');
  else fail('GET /sync/pull requires auth', `${pullNoAuth.status}`);

  const visitsNoAuth = await http('GET', '/api/v1/visits?limit=1');
  if (visitsNoAuth.status === 401) ok('GET /visits requires auth', '401');
  else fail('GET /visits requires auth', `${visitsNoAuth.status}`);
}

async function runAuthenticated() {
  console.log('\n— Authentication —');
  const login = await http('POST', '/api/v1/auth/login', {
    body: { email: AUTH_EMAIL, password: AUTH_PASSWORD }
  });
  if (!login.json?.accessToken) {
    fail('POST /auth/login', login.json?.error?.message || `${login.status}`);
    return false;
  }
  token = login.json.accessToken;
  ok('POST /auth/login', AUTH_EMAIL);

  const me = await http('GET', '/api/v1/auth/me');
  if (me.status === 200 && me.json?.user?.email) ok('GET /auth/me', me.json.user.role);
  else fail('GET /auth/me', `${me.status}`);

  console.log('\n— ICD-11 —');
  const icd = await http('GET', '/api/v1/icd/status');
  if (icd.status === 200) {
    const configured = icd.json?.data?.configured;
    ok('GET /icd/status', configured ? 'configured' : 'not configured');
    if (configured) {
      const search = await http('GET', '/api/v1/icd/search?q=keratoconus');
      const entities = search.json?.destinationEntities || search.json?.data?.destinationEntities;
      if (search.status === 200 && Array.isArray(entities)) ok('GET /icd/search', `${entities.length} results`);
      else fail('GET /icd/search', `${search.status}`);
    }
  } else fail('GET /icd/status', `${icd.status}`);

  console.log('\n— Sync pull —');
  const pull = await http('GET', '/api/v1/sync/pull?cursor=0&limit=5');
  if (pull.status === 200 && pull.json?.data?.cursor != null) {
    ok('GET /sync/pull', `cursor=${pull.json.data.cursor} changes=${(pull.json.data.changes || []).length}`);
  } else fail('GET /sync/pull', `${pull.status} ${pull.text?.slice(0, 120)}`);

  console.log('\n— Visit upsert via sync push —');
  const visitUuid = crypto.randomUUID();
  const mutationId = crypto.randomUUID();
  const push = await http('POST', '/api/v1/sync/push', {
    body: {
      deviceId: DEVICE_ID,
      mutations: [{
        mutationId,
        entityType: 'visit',
        operation: 'upsert',
        entityId: visitUuid,
        localId: 999001,
        baseRevision: 0,
        payload: {
          id: 999001,
          uuid: visitUuid,
          fullName: 'Deep Verify Test Patient',
          visitDate: new Date().toISOString().slice(0, 10),
          chiefComplaint: 'automated deep verify — safe to delete',
          sync_status: 'pending'
        }
      }]
    }
  });
  const result = push.json?.data?.results?.[0];
  if (push.status === 200 && result?.status === 'ok') {
    ok('POST /sync/push creates visit', `revision=${result.revision}`);
  } else {
    fail('POST /sync/push creates visit', JSON.stringify(result || push.json).slice(0, 200));
    return true;
  }

  console.log('\n— Media upload (Spaces) —');
  const form = new FormData();
  const blob = new Blob([tinyPngBuffer()], { type: 'image/png' });
  form.append('file', blob, 'deep-verify-1x1.png');
  form.append('category', 'slit_lamp');
  form.append('eye', 'OD');
  form.append('label', 'deep verify test');
  form.append('moduleName', 'visit_media');

  const upload = await http('POST', `/api/v1/visits/${visitUuid}/media`, { formData: form });
  const assetId = upload.json?.data?.id;
  if (upload.status === 201 && assetId) {
    ok('POST /visits/:id/media', `asset=${assetId}`);
  } else {
    fail('POST /visits/:id/media', upload.json?.error?.message || `${upload.status} ${upload.text?.slice(0, 150)}`);
  }

  if (assetId) {
    const list = await http('GET', `/api/v1/visits/${visitUuid}/media`);
    const items = list.json?.data || [];
    if (list.status === 200 && items.some((a) => a.id === assetId)) ok('GET /visits/:id/media lists asset');
    else fail('GET /visits/:id/media lists asset', `${list.status} count=${items.length}`);

    const content = await http('GET', `/api/v1/media/${assetId}/content`);
    if (content.status === 200 && content.res.headers.get('content-type')?.includes('image')) {
      ok('GET /media/:id/content streams image');
    } else {
      fail('GET /media/:id/content', `${content.status}`);
    }
  }

  console.log('\n— Cleanup test visit —');
  const del = await http('POST', '/api/v1/sync/push', {
    body: {
      deviceId: DEVICE_ID,
      mutations: [{
        mutationId: crypto.randomUUID(),
        entityType: 'visit',
        operation: 'delete',
        entityId: visitUuid,
        localId: 999001,
        baseRevision: result.revision
      }]
    }
  });
  const delResult = del.json?.data?.results?.[0];
  if (del.status === 200 && delResult?.status === 'ok') ok('POST /sync/push deletes test visit');
  else warn('Cleanup delete', JSON.stringify(delResult || del.json).slice(0, 120));

  return true;
}

async function main() {
  console.log('\n=== Cornea EMR Deep HTTP Verification ===\n');
  console.log(`API: ${API}\n`);

  await runUnauthenticated();

  if (!AUTH_PASSWORD) {
    warn('Authenticated suite', 'skipped — set AUTH_PASSWORD or SEED_ADMIN_PASSWORD');
  } else {
    await runAuthenticated();
  }

  console.log('\n=== Summary ===');
  console.log(`  Passed:   ${passed}`);
  console.log(`  Failed:   ${failed}`);
  console.log(`  Warnings: ${warned}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});

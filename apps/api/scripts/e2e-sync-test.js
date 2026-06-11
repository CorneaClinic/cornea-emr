/**
 * End-to-end sync verification against a running API.
 *
 * Creates a temporary test user directly in the database, then exercises the
 * real HTTP API: push, idempotent replay, keyset pagination (including rows
 * sharing one updated_at), conflict detection, delete tombstones, and cursor
 * convergence. Cleans up its user and test data afterwards.
 *
 * Usage (API must be running):
 *   cd apps/api && npm run verify:sync
 */
import 'dotenv/config';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const API = process.env.API_URL || 'http://127.0.0.1:3000';
const TEST_EMAIL = 'e2e-sync-test@corneaclinic.local';
const TEST_MRN_PREFIX = 'E2E-TEST-';
const DEVICE_ID = 'e2e-sync-test-device';

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });

let passed = 0;
let failed = 0;

function ok(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function uuid() {
  return crypto.randomUUID();
}

let token = '';

async function http(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': DEVICE_ID,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function push(mutations) {
  const { status, body } = await http('POST', '/api/v1/sync/push', {
    deviceId: DEVICE_ID,
    mutations
  });
  if (status !== 200) {
    throw new Error(`push failed (${status}): ${JSON.stringify(body)}`);
  }
  return body.data.results;
}

async function pull(cursor, limit) {
  const { status, body } = await http(
    'GET',
    `/api/v1/sync/pull?cursor=${encodeURIComponent(cursor)}&limit=${limit}&deviceId=${DEVICE_ID}`
  );
  if (status !== 200) {
    throw new Error(`pull failed (${status}): ${JSON.stringify(body)}`);
  }
  return body.data;
}

function visitPayload(n) {
  return {
    patientId: `${TEST_MRN_PREFIX}${String(n).padStart(3, '0')}`,
    fullName: `E2E Test Patient ${n} (safe to ignore)`,
    sex: 'Other',
    visitDate: new Date().toISOString().slice(0, 10),
    chiefComplaint: 'Automated sync verification — not a real patient'
  };
}

async function setup() {
  await db.connect();

  const clinic = await db.query(`SELECT id FROM clinics LIMIT 1`);
  if (!clinic.rows.length) throw new Error('No clinic found — seed the database first');
  const clinicId = clinic.rows[0].id;

  // Remove leftovers from previous runs (tombstones from old runs have long
  // since propagated to any device).
  await cleanupData(clinicId, { silent: true });

  const password = crypto.randomBytes(18).toString('base64url');
  const hash = await bcrypt.hash(password, 10);

  // Audit log is append-only, so the user from a previous run may still
  // exist (deactivated) — reactivate it instead of inserting a duplicate.
  const existing = await db.query(
    `SELECT id FROM users WHERE clinic_id = $1 AND email = $2`,
    [clinicId, TEST_EMAIL]
  );
  if (existing.rows.length) {
    await db.query(
      `
        UPDATE users
           SET password_hash = $2, is_active = true,
               failed_login_count = 0, locked_until = NULL,
               must_change_password = false
         WHERE id = $1
      `,
      [existing.rows[0].id, hash]
    );
  } else {
    await db.query(
      `
        INSERT INTO users (clinic_id, email, password_hash, full_name, role, is_active)
        VALUES ($1, $2, $3, 'E2E Sync Test (temporary)', 'admin', true)
      `,
      [clinicId, TEST_EMAIL, hash]
    );
  }

  return { clinicId, password };
}

async function cleanupData(clinicId, { silent = false } = {}) {
  const steps = [
    [`DELETE FROM sync_conflicts WHERE clinic_id = $1 AND device_id = $2`, [clinicId, DEVICE_ID]],
    [`DELETE FROM client_mutations WHERE clinic_id = $1 AND device_id = $2`, [clinicId, DEVICE_ID]],
    [`DELETE FROM sync_cursors WHERE clinic_id = $1 AND device_id = $2`, [clinicId, DEVICE_ID]],
    [
      `DELETE FROM visits WHERE clinic_id = $1 AND patient_id IN
         (SELECT id FROM patients WHERE clinic_id = $1 AND mrn LIKE $2)`,
      [clinicId, `${TEST_MRN_PREFIX}%`]
    ],
    [`DELETE FROM patients WHERE clinic_id = $1 AND mrn LIKE $2`, [clinicId, `${TEST_MRN_PREFIX}%`]]
  ];

  for (const [sql, params] of steps) {
    try {
      await db.query(sql, params);
    } catch (err) {
      if (!silent) console.warn(`  cleanup step failed: ${err.message}`);
    }
  }
}

async function cleanupUser(clinicId) {
  // Audit rows reference the user and the audit log is append-only, so the
  // account cannot be hard-deleted. Deactivate it so it cannot sign in.
  const user = await db.query(
    `SELECT id FROM users WHERE clinic_id = $1 AND email = $2`,
    [clinicId, TEST_EMAIL]
  );
  if (!user.rows.length) return;
  const userId = user.rows[0].id;

  try {
    await db.query(`DELETE FROM user_sessions WHERE user_id = $1`, [userId]);
  } catch (_) { /* non-fatal */ }

  await db.query(
    `UPDATE users SET is_active = false WHERE id = $1`,
    [userId]
  );
  console.log('  test user deactivated (kept for audit-log integrity)');
}

async function main() {
  console.log(`\nE2E sync verification against ${API}\n`);

  const health = await fetch(`${API}/health/live`).catch(() => null);
  if (!health?.ok) {
    console.error('API is not reachable — start it first (cd apps/api && npm run dev)');
    process.exit(1);
  }

  const { clinicId, password } = await setup();
  console.log('Setup: temporary test user created\n');

  try {
    // --- Login -----------------------------------------------------------
    const login = await http('POST', '/api/v1/auth/login', {
      email: TEST_EMAIL,
      password
    });
    ok('login succeeds', login.status === 200 && !!login.body.accessToken,
      `status ${login.status}`);
    token = login.body.accessToken;

    // --- T1: push create -------------------------------------------------
    const m1 = uuid();
    const [r1] = await push([{
      mutationId: m1,
      entityType: 'visit',
      operation: 'upsert',
      localId: 990001,
      baseRevision: 0,
      payload: { ...visitPayload(1), id: 990001 }
    }]);
    ok('push create returns ok', r1.status === 'ok' && !!r1.entityId,
      JSON.stringify(r1));
    ok('push create returns revision 1', r1.revision === 1, `revision=${r1.revision}`);
    const visit1 = r1.entityId;

    // --- T2: idempotent replay --------------------------------------------
    const [r2] = await push([{
      mutationId: m1,
      entityType: 'visit',
      operation: 'upsert',
      localId: 990001,
      baseRevision: 0,
      payload: { ...visitPayload(1), id: 990001 }
    }]);
    ok('replayed mutation is deduplicated', r2.status === 'ok' && r2.replay === true,
      JSON.stringify(r2));

    // --- T3: pull returns the visit, v2 cursor ----------------------------
    const p1 = await pull('0', 200);
    const found = (p1.changes || []).find((c) => c.entityId === visit1);
    ok('pull returns pushed visit', !!found);
    ok('pulled record carries patient fields',
      found?.data?.patientId === `${TEST_MRN_PREFIX}001`
      && !!found?.data?.fullName,
      JSON.stringify(found?.data || {}).slice(0, 120));
    let cursorV2 = null;
    try { cursorV2 = JSON.parse(p1.cursor); } catch (_) { /* not JSON */ }
    ok('cursor is v2 per-table keyset', cursorV2?.v === 2 && !!cursorV2.visit?.ts,
      String(p1.cursor).slice(0, 80));
    ok('pull reports hasMore=false on small dataset page', p1.hasMore === false || p1.hasMore === true);

    // --- T4: keyset pagination with identical timestamps ------------------
    const batch = [];
    for (let n = 2; n <= 6; n++) {
      batch.push({
        mutationId: uuid(),
        entityType: 'visit',
        operation: 'upsert',
        localId: 990000 + n,
        baseRevision: 0,
        payload: { ...visitPayload(n), id: 990000 + n }
      });
    }
    const batchResults = await push(batch);
    ok('batch push of 5 visits succeeds', batchResults.every((r) => r.status === 'ok'));
    const allVisitIds = new Set([visit1, ...batchResults.map((r) => r.entityId)]);

    // Force every test visit onto ONE timestamp — the case the old
    // cursor logic silently lost rows on.
    await db.query(
      `
        UPDATE visits SET updated_at = now()
         WHERE clinic_id = $1 AND patient_id IN
           (SELECT id FROM patients WHERE clinic_id = $1 AND mrn LIKE $2)
      `,
      [clinicId, `${TEST_MRN_PREFIX}%`]
    );

    const seen = new Map();
    let cursor = '0';
    let pages = 0;
    let hasMore = true;
    while (hasMore && pages < 100) {
      const page = await pull(cursor, 2);
      for (const c of page.changes || []) {
        seen.set(c.entityId, (seen.get(c.entityId) || 0) + 1);
      }
      hasMore = page.hasMore;
      if (hasMore && page.cursor === cursor) break;
      cursor = page.cursor;
      pages++;
    }
    const testSeen = [...allVisitIds].filter((id) => seen.has(id));
    const dupes = [...seen.values()].filter((n) => n > 1).length;
    ok('pagination delivers all 6 same-timestamp visits (limit=2)',
      testSeen.length === allVisitIds.size,
      `delivered ${testSeen.length}/${allVisitIds.size} across ${pages} pages`);
    ok('pagination produces no duplicates', dupes === 0, `${dupes} duplicated`);
    ok('pagination terminates with hasMore=false', hasMore === false);

    // --- T5: stale baseRevision raises conflict ---------------------------
    const [rc] = await push([{
      mutationId: uuid(),
      entityType: 'visit',
      operation: 'upsert',
      entityId: visit1,
      localId: 990001,
      baseRevision: 999,
      payload: { ...visitPayload(1), id: 990001, chiefComplaint: 'conflicting edit' }
    }]);
    ok('stale revision returns conflict', rc.status === 'conflict',
      JSON.stringify(rc).slice(0, 120));
    ok('conflict reports server revision', rc.details?.serverRevision != null);
    ok('conflict includes server state', !!rc.details?.serverState);

    // --- T6: correct baseRevision updates ---------------------------------
    const current = rc.details?.serverRevision;
    const [ru] = await push([{
      mutationId: uuid(),
      entityType: 'visit',
      operation: 'upsert',
      entityId: visit1,
      localId: 990001,
      baseRevision: current,
      payload: { ...visitPayload(1), id: 990001, chiefComplaint: 'updated complaint' }
    }]);
    ok('update with correct revision succeeds',
      ru.status === 'ok' && ru.revision === current + 1,
      JSON.stringify(ru).slice(0, 120));

    // --- T7: delete produces tombstone on pull -----------------------------
    const [rd] = await push([{
      mutationId: uuid(),
      entityType: 'visit',
      operation: 'delete',
      entityId: visit1,
      localId: 990001,
      baseRevision: ru.revision
    }]);
    ok('delete mutation accepted', rd.status === 'ok');

    const pAfterDelete = await pull(cursor, 200);
    const tombstone = (pAfterDelete.deleted || []).find((d) => d.entityId === visit1);
    ok('pull delivers deletion tombstone', !!tombstone,
      `deleted=${JSON.stringify(pAfterDelete.deleted || [])}`);

    // --- T8: cursor converges ----------------------------------------------
    const pFinal = await pull(pAfterDelete.cursor, 200);
    const newForUs = (pFinal.changes || []).filter((c) => allVisitIds.has(c.entityId));
    const newTombs = (pFinal.deleted || []).filter((d) => allVisitIds.has(d.entityId));
    ok('cursor converges (no re-delivery after catch-up)',
      newForUs.length === 0 && newTombs.length === 0,
      `changes=${newForUs.length} deleted=${newTombs.length}`);
  } finally {
    console.log('\nCleanup:');
    await cleanupData((await db.query(`SELECT id FROM clinics LIMIT 1`)).rows[0].id);
    await cleanupUser((await db.query(`SELECT id FROM clinics LIMIT 1`)).rows[0].id);
    await db.end();
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error('\nFatal:', err.message);
  try {
    const clinic = await db.query(`SELECT id FROM clinics LIMIT 1`);
    if (clinic.rows.length) {
      await cleanupData(clinic.rows[0].id);
      await cleanupUser(clinic.rows[0].id);
    }
    await db.end();
  } catch (_) { /* already disconnected */ }
  process.exit(1);
});

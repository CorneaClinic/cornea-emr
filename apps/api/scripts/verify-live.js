/**
 * Run scripts/verify-api.js and ICD-11 cloud checks against the live API
 * without needing the real admin password.
 *
 * Creates/reactivates the temporary test user directly in the database,
 * runs the verification with its credentials, then deactivates it.
 *
 * Usage (API must be running):
 *   cd apps/api && node scripts/verify-live.js
 */
import 'dotenv/config';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const API = process.env.API_URL || 'http://127.0.0.1:3000';
const TEST_EMAIL = 'e2e-sync-test@corneaclinic.local';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERIFY_SCRIPT = path.resolve(__dirname, '../../../scripts/verify-api.js');

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

async function setupUser() {
  await db.connect();
  const clinic = await db.query(`SELECT id FROM clinics LIMIT 1`);
  if (!clinic.rows.length) throw new Error('No clinic found — seed the database first');
  const clinicId = clinic.rows[0].id;

  const password = crypto.randomBytes(18).toString('base64url');
  const hash = await bcrypt.hash(password, 10);

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

async function cleanupUser(clinicId) {
  const user = await db.query(
    `SELECT id FROM users WHERE clinic_id = $1 AND email = $2`,
    [clinicId, TEST_EMAIL]
  );
  if (!user.rows.length) return;
  try {
    await db.query(`DELETE FROM user_sessions WHERE user_id = $1`, [user.rows[0].id]);
  } catch (_) { /* non-fatal */ }
  await db.query(`UPDATE users SET is_active = false WHERE id = $1`, [user.rows[0].id]);
  console.log('\nTest user deactivated.');
}

async function icdChecks(password) {
  console.log('\nICD-11 cloud checks:');

  const loginRes = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password })
  });
  const loginData = await loginRes.json();
  ok('login for ICD checks', loginRes.ok && !!loginData.accessToken);
  const token = loginData.accessToken;
  if (!token) return;

  const auth = { Authorization: `Bearer ${token}` };

  const statusRes = await fetch(`${API}/api/v1/icd/status`, { headers: auth });
  const statusData = await statusRes.json();
  const configured = statusData.data?.configured;
  ok('GET /icd/status', statusRes.ok && typeof configured === 'boolean',
    JSON.stringify(statusData));
  console.log(`    WHO credentials configured: ${configured}`);

  const searchRes = await fetch(
    `${API}/api/v1/icd/search?q=${encodeURIComponent('keratoconus')}`,
    { headers: auth }
  );
  const searchData = await searchRes.json().catch(() => ({}));

  if (configured) {
    const entities = searchData.destinationEntities || searchData.data?.destinationEntities;
    ok('GET /icd/search returns WHO results', searchRes.ok && Array.isArray(entities),
      `status=${searchRes.status} body=${JSON.stringify(searchData).slice(0, 300)}`);
    if (Array.isArray(entities)) {
      console.log(`    "keratoconus" matched ${entities.length} entities`);
      if (entities[0]) {
        const title = String(entities[0].title || '').replace(/<[^>]*>/g, '');
        console.log(`    first match: ${entities[0].theCode || '?'} — ${title}`);
      }
    }
  } else {
    ok('GET /icd/search rejects cleanly when not configured',
      !searchRes.ok && searchRes.status < 500,
      `status=${searchRes.status} body=${JSON.stringify(searchData).slice(0, 300)}`);
    console.log('    (save WHO Client ID/Secret in the Database tab to enable search)');
  }
}

async function main() {
  const live = await fetch(`${API}/health/live`).catch(() => null);
  if (!live || !live.ok) {
    console.error(`API is not reachable at ${API} — start it first (npm run dev).`);
    process.exit(1);
  }

  const { clinicId, password } = await setupUser();
  let verifyExit = 1;
  try {
    console.log(`Running verify-api.js against ${API} as temporary user...\n`);
    const res = spawnSync(process.execPath, [VERIFY_SCRIPT], {
      stdio: 'inherit',
      env: {
        ...process.env,
        API_URL: API,
        SEED_ADMIN_EMAIL: TEST_EMAIL,
        SEED_ADMIN_PASSWORD: password
      }
    });
    verifyExit = res.status ?? 1;

    await icdChecks(password);
  } finally {
    await cleanupUser(clinicId);
    await db.end();
  }

  console.log(`\nICD checks: ${passed} passed, ${failed} failed`);
  process.exit(verifyExit === 0 && failed === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('FATAL:', err.message);
  try { await db.end(); } catch (_) { /* ignore */ }
  process.exit(1);
});

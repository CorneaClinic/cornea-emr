/**
 * DAST role accounts (local / staging test DB only).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const require = createRequire(path.join(ROOT, 'apps/api/package.json'));
const dotenv = require('dotenv');

const DAST_DB_NAME = 'cornea_emr_dast';
const CI_DATABASE_URL = `postgres://cornea:test@127.0.0.1:5432/${DAST_DB_NAME}`;

function localEnvDatabaseUrl() {
  for (const rel of ['apps/api/.env.local', 'apps/api/.env']) {
    const envPath = path.join(ROOT, rel);
    if (!fs.existsSync(envPath)) continue;
    const parsed = dotenv.parse(fs.readFileSync(envPath, 'utf8'));
    const url = parsed.DATABASE_URL;
    if (url && isLocalDbUrl(url) && !isProductionDbUrl(url)) {
      const u = new URL(String(url).replace(/^postgres:/, 'postgresql:'));
      u.pathname = `/${DAST_DB_NAME}`;
      return u.toString().replace(/^postgresql:/, 'postgres:');
    }
  }
  return null;
}

function isProductionDbUrl(url) {
  return /ondigitalocean\.com/i.test(url) || /digitalocean\.com/i.test(url);
}

function isLocalDbUrl(url) {
  try {
    const host = new URL(String(url).replace(/^postgres:/, 'postgresql:')).hostname;
    return host === '127.0.0.1' || host === 'localhost' || host === 'postgres';
  } catch {
    return false;
  }
}

export function resolveDastDatabaseUrl() {
  if (process.env.DAST_DATABASE_URL) {
    if (isProductionDbUrl(process.env.DAST_DATABASE_URL)) {
      throw new Error('DAST refuses production DAST_DATABASE_URL');
    }
    return process.env.DAST_DATABASE_URL;
  }

  if (process.env.DATABASE_URL) {
    if (isProductionDbUrl(process.env.DATABASE_URL)) {
      throw new Error(
        'DATABASE_URL points to production. For DAST use local Postgres and run: npm run dast:prepare-db. Or set DAST_DATABASE_URL.'
      );
    }
    if (isLocalDbUrl(process.env.DATABASE_URL)) {
      const u = new URL(String(process.env.DATABASE_URL).replace(/^postgres:/, 'postgresql:'));
      if (u.pathname === '/' || u.pathname === '/postgres') {
        u.pathname = `/${DAST_DB_NAME}`;
      }
      return u.toString().replace(/^postgresql:/, 'postgres:');
    }
  }

  return localEnvDatabaseUrl() || CI_DATABASE_URL;
}
const bcrypt = require('bcryptjs');
const pg = require('pg');
const AUTH_DIR = path.join(ROOT, 'e2e', '.auth');
const DAST_CRED_FILE = path.join(AUTH_DIR, 'dast-credentials.json');

const DEFAULT_PASSWORD = process.env.DAST_PASSWORD || 'Dast-Scan-Test1!';
const API_URL = (process.env.DAST_API_URL || process.env.E2E_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

export const DAST_ROLES = [
  { role: 'admin', email: 'dast-admin@corneaclinic.local', fullName: 'DAST Admin' },
  { role: 'receptionist', email: 'dast-reception@corneaclinic.local', fullName: 'DAST Reception' },
  { role: 'cornea_consultant', email: 'dast-consultant@corneaclinic.local', fullName: 'DAST Consultant' }
];

async function ensureClinic(db) {
  const slug = 'cornea-clinic-dast';
  const existing = await db.query(`SELECT id FROM clinics WHERE slug = $1`, [slug]);
  if (existing.rows.length) return existing.rows[0].id;
  const inserted = await db.query(
    `INSERT INTO clinics (name, slug, status) VALUES ('Cornea Clinic DAST', $1, 'active') RETURNING id`,
    [slug]
  );
  return inserted.rows[0].id;
}

async function upsertUser(db, clinicId, user) {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const existing = await db.query(`SELECT id FROM users WHERE clinic_id = $1 AND email = $2`, [
    clinicId,
    user.email
  ]);
  if (existing.rows.length) {
    await db.query(
      `UPDATE users SET password_hash = $2, full_name = $3, role = $4, is_active = true,
       failed_login_count = 0, locked_until = NULL, must_change_password = false WHERE id = $1`,
      [existing.rows[0].id, hash, user.fullName, user.role]
    );
    return;
  }
  await db.query(
    `INSERT INTO users (clinic_id, email, password_hash, full_name, role, is_active, must_change_password)
     VALUES ($1, $2, $3, $4, $5, true, false)`,
    [clinicId, user.email, hash, user.fullName, user.role]
  );
}

export async function setupDastUsers() {
  const databaseUrl = resolveDastDatabaseUrl();
  const db = new pg.Client({
    connectionString: databaseUrl,
    ssl: isLocalDbUrl(databaseUrl) ? false : undefined
  });
  await db.connect();
  try {
    const clinicId = await ensureClinic(db);
    for (const user of DAST_ROLES) {
      await upsertUser(db, clinicId, user);
    }
  } finally {
    await db.end();
  }

  const creds = {
    apiUrl: API_URL,
    password: DEFAULT_PASSWORD,
    users: DAST_ROLES
  };
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(DAST_CRED_FILE, JSON.stringify(creds, null, 2), 'utf8');
  console.log(`DAST users ready in isolated clinic (slug: cornea-clinic-dast)`);
  console.log(`Database: ${new URL(databaseUrl.replace(/^postgres:/, 'postgresql:')).host}`);
  console.log(`Credentials: ${DAST_CRED_FILE}`);
  return creds;
}

export function loadDastCredentials() {
  if (!fs.existsSync(DAST_CRED_FILE)) {
    throw new Error(`Missing ${DAST_CRED_FILE}. Run: npm run dast:setup-users`);
  }
  return JSON.parse(fs.readFileSync(DAST_CRED_FILE, 'utf8'));
}

export async function loginRole(apiUrl, email, password, deviceId = 'dast-zap-scanner') {
  const url = `${apiUrl.replace(/\/$/, '')}/api/v1/auth/login`;
  const body = JSON.stringify({ email, password });
  const maxAttempts = Number(process.env.DAST_LOGIN_MAX_ATTEMPTS || 6);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Device-Id': deviceId },
        body
      });
    } catch (err) {
      // Transient network error (API restarting / not yet listening) — back off and retry.
      if (attempt < maxAttempts) {
        console.warn(
          `[DAST] Login request to ${email} failed (${err.message}); retry ${attempt}/${maxAttempts - 1} in 5s…`
        );
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      throw new Error(`DAST login failed for ${email}: ${err.message}`);
    }

    if (res.status === 429 && attempt < maxAttempts) {
      const retryAfter = Math.min(Number(res.headers.get('retry-after') || 15), 30);
      console.warn(
        `[DAST] Login rate limited for ${email}; retry ${attempt}/${maxAttempts - 1} in ${retryAfter}s…`
      );
      console.warn('[DAST] Restart API with: npm run api:dev:dast (resets in-memory rate limits)');
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }

    if (!res.ok) {
      throw new Error(`DAST login failed for ${email} (${res.status}): ${await res.text()}`);
    }

    const json = await res.json();
    if (!json.accessToken) throw new Error(`No accessToken for ${email}`);
    return json.accessToken;
  }

  throw new Error(`DAST login failed for ${email} after ${maxAttempts} attempts`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  setupDastUsers().catch((err) => {
    const msg = err.message || String(err);
    console.error(msg);
    if (/relation .* does not exist/i.test(msg)) {
      console.error('\nDatabase schema missing. Run:');
      console.error('  npm run dast:prepare-db');
    } else if (/password authentication failed/i.test(msg)) {
      console.error('\nPostgres credentials mismatch. Set DAST_DATABASE_URL, for example:');
      console.error('  set DAST_DATABASE_URL=postgres://cornea:cornea_dev@127.0.0.1:5432/cornea_emr_v1');
      console.error('  npm run dast:prepare-db');
    }
    process.exit(1);
  });
}

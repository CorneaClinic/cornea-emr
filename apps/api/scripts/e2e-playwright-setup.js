/**
 * Ensures a Playwright E2E user exists and writes credentials for browser tests.
 * Run after migrations (and optional seed) before starting the API in CI.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const CRED_DIR = path.join(ROOT, 'e2e', '.auth');
const CRED_FILE = path.join(CRED_DIR, 'credentials.json');

const TEST_EMAIL = process.env.E2E_EMAIL || 'playwright-e2e@corneaclinic.local';
const TEST_PASSWORD = process.env.E2E_PASSWORD || 'Playwright-E2e-Test1!';
const API_URL = (process.env.E2E_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function ensureClinic() {
  const existing = await db.query(`SELECT id FROM clinics LIMIT 1`);
  if (existing.rows.length) return existing.rows[0].id;

  const inserted = await db.query(
    `
      INSERT INTO clinics (name, slug, status)
      VALUES ('Cornea Clinic E2E', 'cornea-clinic-e2e', 'active')
      RETURNING id
    `
  );
  return inserted.rows[0].id;
}

async function upsertPlaywrightUser(clinicId) {
  const hash = await bcrypt.hash(TEST_PASSWORD, 10);
  const existing = await db.query(
    `SELECT id FROM users WHERE clinic_id = $1 AND email = $2`,
    [clinicId, TEST_EMAIL]
  );

  if (existing.rows.length) {
    await db.query(
      `
        UPDATE users
           SET password_hash = $2,
               is_active = true,
               failed_login_count = 0,
               locked_until = NULL,
               must_change_password = false,
               role = 'admin',
               full_name = 'Playwright E2E'
         WHERE id = $1
      `,
      [existing.rows[0].id, hash]
    );
    return;
  }

  await db.query(
    `
      INSERT INTO users (clinic_id, email, password_hash, full_name, role, is_active, must_change_password)
      VALUES ($1, $2, $3, 'Playwright E2E', 'admin', true, false)
    `,
    [clinicId, TEST_EMAIL, hash]
  );
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for Playwright E2E setup');
  }

  await db.connect();
  try {
    const clinicId = await ensureClinic();
    await upsertPlaywrightUser(clinicId);
  } finally {
    await db.end();
  }

  fs.mkdirSync(CRED_DIR, { recursive: true });
  fs.writeFileSync(
    CRED_FILE,
    JSON.stringify(
      {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        apiUrl: API_URL
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`Playwright E2E user ready: ${TEST_EMAIL}`);
  console.log(`Credentials file: ${CRED_FILE}`);
}

main().catch((err) => {
  console.error('Playwright E2E setup failed:', err.message || err);
  process.exit(1);
});

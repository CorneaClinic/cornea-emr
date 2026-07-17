/**
 * Create or reset the production E2E monitor account for nightly GitHub Actions smoke tests.
 *
 * Usage (production DB — apps/api/.env.production):
 *   cd apps/api
 *   node scripts/setup-staging-e2e-user.js
 *
 * Env:
 *   DATABASE_URL          — required (from .env.production)
 *   STAGING_E2E_EMAIL     — default e2e-monitor@corneaclinic.local
 *   STAGING_E2E_PASSWORD  — optional; generated if omitted (printed once)
 *   STAGING_E2E_ROLE      — default admin (institute KPI block visible for staging-smoke)
 */
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { validatePasswordStrength } from '../src/core/password-policy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');

const envFile = process.env.ENV_FILE || path.join(apiRoot, '.env.production');
dotenv.config({ path: envFile });
dotenv.config();

const EMAIL = (process.env.STAGING_E2E_EMAIL || 'e2e-monitor@corneaclinic.local').trim().toLowerCase();
const ALLOWED_ROLES = new Set([
  'admin',
  'cornea_consultant',
  'ophthalmologist',
  'doctor_in_training',
  'optometrist',
  'technician',
  'receptionist'
]);
// admin → administrator profile with showInstituteMetrics (required for staging-smoke KPI test)
const ROLE = (process.env.STAGING_E2E_ROLE || 'admin').trim().toLowerCase();
const FULL_NAME = process.env.STAGING_E2E_NAME || 'E2E Monitor (automation)';

function pgClientConfig(connectionString) {
  if (!/ondigitalocean\.com/i.test(connectionString)) {
    return { connectionString };
  }
  const url = connectionString
    .replace(/([?&])sslmode=[^&]*&?/g, '$1')
    .replace(/[?&]$/, '');
  return {
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  };
}

function generatePassword() {
  const core = crypto.randomBytes(16).toString('base64url');
  return `${core}Aa1!`;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required. Use apps/api/.env.production or set ENV_FILE.');
  }

  if (!ALLOWED_ROLES.has(ROLE)) {
    throw new Error(
      `Invalid STAGING_E2E_ROLE "${ROLE}". Use one of: ${[...ALLOWED_ROLES].join(', ')}`
    );
  }

  let password = process.env.STAGING_E2E_PASSWORD || '';
  let generated = false;
  const roleOnly = !password;

  const db = new pg.Client(pgClientConfig(databaseUrl));
  await db.connect();

  try {
    const clinic = await db.query(`SELECT id, name FROM clinics ORDER BY id LIMIT 1`);
    if (!clinic.rows.length) throw new Error('No clinic found in production database.');
    const clinicId = clinic.rows[0].id;

    const existing = await db.query(
      `SELECT id, role FROM users WHERE clinic_id = $1 AND email = $2`,
      [clinicId, EMAIL]
    );

    if (existing.rows.length && roleOnly) {
      await db.query(
        `
          UPDATE users
             SET full_name = $2,
                 role = $3,
                 is_active = true,
                 failed_login_count = 0,
                 locked_until = NULL,
                 must_change_password = false
           WHERE id = $1
        `,
        [existing.rows[0].id, FULL_NAME, ROLE]
      );
      console.log(
        `Updated E2E monitor user (id ${existing.rows[0].id}): role ${existing.rows[0].role} → ${ROLE} (password unchanged).`
      );
    } else {
      if (!password) {
        password = generatePassword();
        generated = true;
      }
      validatePasswordStrength(password);
      const hash = await bcrypt.hash(password, 12);

      if (existing.rows.length) {
        await db.query(
          `
            UPDATE users
               SET password_hash = $2,
                   full_name = $3,
                   role = $4,
                   is_active = true,
                   failed_login_count = 0,
                   locked_until = NULL,
                   must_change_password = false
             WHERE id = $1
          `,
          [existing.rows[0].id, hash, FULL_NAME, ROLE]
        );
        console.log(`Updated existing E2E monitor user (id ${existing.rows[0].id}).`);
      } else {
        const inserted = await db.query(
          `
            INSERT INTO users (
              clinic_id, email, password_hash, full_name, role, is_active, must_change_password
            )
            VALUES ($1, $2, $3, $4, $5, true, false)
            RETURNING id
          `,
          [clinicId, EMAIL, hash, FULL_NAME, ROLE]
        );
        console.log(`Created E2E monitor user (id ${inserted.rows[0].id}).`);
      }
    }

    console.log('');
    console.log('=== GitHub repository secrets (Actions) ===');
    console.log(`STAGING_E2E_EMAIL=${EMAIL}`);
    if (generated) {
      console.log(`STAGING_E2E_PASSWORD=${password}`);
      console.log('');
      console.log('Save the password now — it is not stored in git. Add both values under:');
      console.log('  GitHub → cornea-emr → Settings → Secrets and variables → Actions → New repository secret');
    } else if (roleOnly && existing.rows.length) {
      console.log('STAGING_E2E_PASSWORD=(unchanged — existing GitHub secret still valid)');
    } else {
      console.log('STAGING_E2E_PASSWORD=(value you supplied via STAGING_E2E_PASSWORD env)');
      console.log('');
      console.log('Add or update both secrets in GitHub Actions if not already set.');
    }
    console.log('');
    console.log('Test locally:');
    console.log(`  $env:STAGING_E2E_EMAIL="${EMAIL}"`);
    console.log(`  $env:STAGING_E2E_PASSWORD="<password>"`);
    console.log('  npm run test:e2e:staging');
    console.log('');
    console.log('Nightly workflow: Actions → E2E Nightly → Run workflow');
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error('setup-staging-e2e-user failed:', err.message || err);
  process.exit(1);
});

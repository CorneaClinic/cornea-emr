/**
 * Helpers for pen-test / tenant-isolation integration tests (CI postgres).
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { signAccessToken, hashToken } from '../../src/core/auth-crypto.js';

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });

export async function connectSecurityHarness() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL required for security integration tests');
  }
  await db.connect();
}

export async function disconnectSecurityHarness() {
  await db.end().catch(() => {});
}

function familyId() {
  return crypto.randomUUID();
}

async function getClinicIdBySlug(slug) {
  const res = await db.query(`SELECT id FROM clinics WHERE slug = $1`, [slug]);
  return res.rows[0]?.id ?? null;
}

/**
 * Remove pen-test data without deleting clinics or audit_logs (append-only).
 * @param {string} clinicId
 */
async function resetClinicTestData(clinicId) {
  const steps = [
    [`DELETE FROM sync_conflicts WHERE clinic_id = $1`, [clinicId]],
    [`DELETE FROM client_mutations WHERE clinic_id = $1`, [clinicId]],
    [`DELETE FROM sync_cursors WHERE clinic_id = $1`, [clinicId]],
    [`DELETE FROM sync_logs WHERE clinic_id = $1`, [clinicId]],
    [`DELETE FROM record_edit_locks WHERE clinic_id = $1`, [clinicId]],
    [`DELETE FROM visits WHERE clinic_id = $1`, [clinicId]],
    [`DELETE FROM patients WHERE clinic_id = $1`, [clinicId]],
    [`DELETE FROM user_sessions WHERE clinic_id = $1`, [clinicId]]
  ];

  for (const [sql, params] of steps) {
    try {
      await db.query(sql, params);
    } catch (_) {
      /* table may be absent on older migration snapshots */
    }
  }
}

/**
 * Reset pen-test fixtures. Clinics and audit_logs are kept (append-only policy).
 * @param {string[]} slugs
 */
export async function cleanupClinicFixtures(slugs) {
  for (const slug of slugs) {
    const clinicId = await getClinicIdBySlug(slug);
    if (!clinicId) continue;
    await resetClinicTestData(clinicId);
    await db.query(`UPDATE users SET is_active = false WHERE clinic_id = $1`, [clinicId]);
    await db.query(`UPDATE clinics SET status = 'suspended' WHERE id = $1`, [clinicId]);
  }
}

/**
 * @param {{ name: string, slug: string, userEmail: string, role?: string, password?: string }} opts
 */
export async function createClinicFixture(opts) {
  const password = opts.password || 'PenTest-Clinic-User1!';
  const role = opts.role || 'cornea_consultant';

  let clinicId = await getClinicIdBySlug(opts.slug);
  if (clinicId) {
    await resetClinicTestData(clinicId);
    await db.query(
      `UPDATE clinics SET name = $2, status = 'active' WHERE id = $1`,
      [clinicId, opts.name]
    );
  } else {
    const clinicRes = await db.query(
      `
        INSERT INTO clinics (name, slug, status)
        VALUES ($1, $2, 'active')
        RETURNING id
      `,
      [opts.name, opts.slug]
    );
    clinicId = clinicRes.rows[0].id;
  }

  const hash = await bcrypt.hash(password, 10);
  const existingUser = await db.query(
    `SELECT id FROM users WHERE clinic_id = $1 AND email = $2`,
    [clinicId, opts.userEmail]
  );

  let user;
  if (existingUser.rows.length) {
    const userRes = await db.query(
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
         RETURNING id, email, role, clinic_id
      `,
      [existingUser.rows[0].id, hash, `${opts.name} User`, role]
    );
    user = userRes.rows[0];
    await db.query(`DELETE FROM user_sessions WHERE user_id = $1`, [user.id]);
  } else {
    const userRes = await db.query(
      `
        INSERT INTO users (
          clinic_id, email, password_hash, full_name, role, is_active, must_change_password
        )
        VALUES ($1, $2, $3, $4, $5, true, false)
        RETURNING id, email, role, clinic_id
      `,
      [clinicId, opts.userEmail, hash, `${opts.name} User`, role]
    );
    user = userRes.rows[0];
  }

  const sessionFamilyId = familyId();
  const refreshToken = crypto.randomBytes(32).toString('base64url');
  await db.query(
    `
      INSERT INTO user_sessions (
        user_id, clinic_id, family_id, token_hash, expires_at
      )
      VALUES ($1, $2, $3, $4, now() + interval '1 day')
    `,
    [user.id, clinicId, sessionFamilyId, hashToken(refreshToken)]
  );

  const accessToken = signAccessToken(user, sessionFamilyId);

  return {
    clinicId,
    userId: user.id,
    email: user.email,
    role: user.role,
    accessToken,
    deviceId: `pentest-${opts.slug}`
  };
}

/**
 * @param {string} clinicId
 * @param {{ mrn?: string, fullName?: string }} [opts]
 */
export async function createPatient(clinicId, opts = {}) {
  const mrn = opts.mrn || `PT-${crypto.randomBytes(4).toString('hex')}`;
  const fullName = opts.fullName || 'Pen-test Patient';
  const res = await db.query(
    `
      INSERT INTO patients (clinic_id, mrn, full_name, sex)
      VALUES ($1, $2, $3, 'Other')
      RETURNING id, mrn
    `,
    [clinicId, mrn, fullName]
  );
  return res.rows[0];
}

export function authHeader(token, deviceId = 'pentest-device') {
  return {
    Authorization: `Bearer ${token}`,
    'X-Device-Id': deviceId
  };
}

/**
 * @param {import('supertest').Agent | import('express').Express} app
 * @param {string} token
 * @param {string} deviceId
 * @param {object[]} mutations
 */
export async function syncPush(app, token, deviceId, mutations) {
  const request = (await import('supertest')).default;
  return request(app)
    .post('/api/v1/sync/push')
    .set(authHeader(token, deviceId))
    .send({ deviceId, mutations });
}

export async function syncPull(app, token, deviceId, cursor = '0') {
  const request = (await import('supertest')).default;
  return request(app)
    .get(`/api/v1/sync/pull?deviceId=${encodeURIComponent(deviceId)}&cursor=${encodeURIComponent(cursor)}`)
    .set(authHeader(token, deviceId));
}

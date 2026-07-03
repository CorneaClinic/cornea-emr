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

/**
 * @param {{ name: string, slug: string, userEmail: string, role?: string, password?: string }} opts
 */
export async function createClinicFixture(opts) {
  const password = opts.password || 'PenTest-Clinic-User1!';
  const role = opts.role || 'cornea_consultant';
  const clinicRes = await db.query(
    `
      INSERT INTO clinics (name, slug, status)
      VALUES ($1, $2, 'active')
      RETURNING id
    `,
    [opts.name, opts.slug]
  );
  const clinicId = clinicRes.rows[0].id;

  const hash = await bcrypt.hash(password, 10);
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
  const user = userRes.rows[0];
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

export async function cleanupClinicFixtures(slugs) {
  for (const slug of slugs) {
    await db.query(
      `
        DELETE FROM clinics
         WHERE slug = $1
      `,
      [slug]
    );
  }
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

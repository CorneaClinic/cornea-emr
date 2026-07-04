import crypto from 'crypto';
import { query, withTransaction } from '../db/pool.js';
import { env } from '../config/env.js';
import {
  generateSecureToken,
  hashPassword,
  hashToken,
  signAccessToken,
  verifyPassword
} from '../core/auth-crypto.js';
import { ROLE_LABELS } from '../core/permissions.js';
import { resolveEmrSections } from '../core/emr-sections.js';
import {
  UnauthorizedError,
  ValidationError,
  NotFoundError
} from '../core/errors.js';
import { auditAuthEvent } from './auditService.js';
import { logger } from '../core/logger.js';
import { validatePasswordStrength } from '../core/password-policy.js';
import { sendPasswordResetEmail } from './mailService.js';

/**
 * @param {object} row
 */
function mapUserProfile(row) {
  const sectionOverride = row.emr_sections ?? null;
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    roleLabel: ROLE_LABELS[row.role] || row.role,
    clinicId: row.clinic_id,
    clinicName: row.clinic_name,
    clinicSlug: row.clinic_slug,
    isActive: row.is_active,
    mustChangePassword: !!row.must_change_password,
    emrSectionOverride: sectionOverride,
    emrSections: resolveEmrSections(row.role, sectionOverride)
  };
}

const USER_SELECT = `
  SELECT
    u.id,
    u.email,
    u.full_name,
    u.role,
    u.clinic_id,
    u.password_hash,
    u.is_active,
    u.failed_login_count,
    u.locked_until,
    u.must_change_password,
    u.emr_sections,
    c.name AS clinic_name,
    c.slug AS clinic_slug,
    c.status AS clinic_status
  FROM users u
  JOIN clinics c ON c.id = u.clinic_id
`;

/**
 * @param {string} email
 */
async function findUserByEmail(email) {
  const normalized = email.trim().toLowerCase();
  const { rows } = await query(
    `${USER_SELECT} WHERE lower(u.email) = $1 LIMIT 1`,
    [normalized]
  );
  return rows[0] || null;
}

/**
 * @param {string} userId
 */
async function findUserById(userId) {
  const { rows } = await query(
    `${USER_SELECT} WHERE u.id = $1 LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

/**
 * @param {object} user
 */
async function recordFailedLogin(user) {
  const newCount = (user.failed_login_count || 0) + 1;
  const shouldLock = newCount >= env.auth.maxFailedAttempts;
  const lockedUntil = shouldLock
    ? new Date(Date.now() + env.auth.lockoutMinutes * 60 * 1000)
    : user.locked_until;

  await query(
    `
      UPDATE users
         SET failed_login_count = $2,
             last_failed_login_at = now(),
             locked_until = $3
       WHERE id = $1
    `,
    [user.id, newCount, lockedUntil]
  );
}

/**
 * @param {string} userId
 */
async function clearFailedLogins(userId) {
  await query(
    `
      UPDATE users
         SET failed_login_count = 0,
             locked_until = NULL
       WHERE id = $1
    `,
    [userId]
  );
}

/**
 * @param {object} params
 * @param {import('express').Request} params.req
 * @param {string} params.email
 * @param {string} params.password
 */
export async function login({ req, email, password }) {
  if (!email?.trim() || !password) {
    throw new ValidationError('Email and password are required');
  }

  const user = await findUserByEmail(email);

  if (!user || !user.is_active) {
    await auditAuthEvent({
      req,
      userId: user?.id,
      clinicId: user?.clinic_id,
      action: 'login_failed',
      diff: { reason: 'invalid_credentials_or_inactive' }
    });
    throw new UnauthorizedError('Invalid email or password');
  }

  if (user.clinic_status !== 'active') {
    await auditAuthEvent({
      req,
      userId: user.id,
      clinicId: user.clinic_id,
      action: 'login_failed',
      diff: { reason: 'clinic_suspended' }
    });
    throw new UnauthorizedError('Clinic account is suspended');
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    await auditAuthEvent({
      req,
      userId: user.id,
      clinicId: user.clinic_id,
      action: 'login_failed',
      diff: { reason: 'account_locked' }
    });
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    await recordFailedLogin(user);
    await auditAuthEvent({
      req,
      userId: user.id,
      clinicId: user.clinic_id,
      action: 'login_failed',
      diff: { reason: 'invalid_password' }
    });
    throw new UnauthorizedError('Invalid email or password');
  }

  await clearFailedLogins(user.id);

  return issueAuthTokens({
    req,
    user,
    auditAction: 'login',
    auditDiff: { method: 'local' }
  });
}

/**
 * Issue JWT session tokens for an authenticated user (local, LDAP, OIDC).
 * @param {object} params
 * @param {import('express').Request} params.req
 * @param {object} params.user
 * @param {string} [params.auditAction]
 * @param {Record<string, unknown>} [params.auditDiff]
 */
export async function issueAuthTokens({ req, user, auditAction = 'login', auditDiff = {} }) {
  if (!user?.is_active) {
    throw new UnauthorizedError('Account is inactive');
  }
  if (user.clinic_status !== 'active') {
    throw new UnauthorizedError('Clinic account is suspended');
  }

  const session = await createSession({ req, user });

  await auditAuthEvent({
    req,
    userId: user.id,
    clinicId: user.clinic_id,
    action: auditAction,
    diff: auditDiff
  });

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresIn: env.auth.accessExpiresIn,
    user: mapUserProfile(user)
  };
}

/**
 * @param {object} params
 * @param {import('express').Request} params.req
 * @param {object} params.user
 */
async function createSession({ req, user }) {
  const refreshToken = generateSecureToken(48);
  const tokenHash = hashToken(refreshToken);
  const familyId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + env.auth.refreshExpiresMs);

  const ip = req.ip || null;
  const userAgent = typeof req.headers['user-agent'] === 'string'
    ? req.headers['user-agent']
    : null;

  await query(
    `
      INSERT INTO user_sessions (
        user_id,
        clinic_id,
        family_id,
        token_hash,
        user_agent,
        ip_address,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [user.id, user.clinic_id, familyId, tokenHash, userAgent, ip, expiresAt]
  );

  const accessToken = signAccessToken(user, familyId);

  return { accessToken, refreshToken, familyId };
}

/**
 * @param {object} params
 * @param {import('express').Request} params.req
 * @param {string} params.refreshToken
 */
export async function refreshSession({ req, refreshToken }) {
  if (!refreshToken?.trim()) {
    throw new UnauthorizedError('Refresh token required');
  }

  const tokenHash = hashToken(refreshToken);

  const { rows } = await query(
    `
      SELECT
        s.id,
        s.user_id,
        s.clinic_id,
        s.family_id,
        s.expires_at,
        s.revoked_at
      FROM user_sessions s
      WHERE s.token_hash = $1
      LIMIT 1
    `,
    [tokenHash]
  );

  const session = rows[0];
  if (!session) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  if (session.revoked_at || new Date(session.expires_at) <= new Date()) {
    await revokeSessionFamily(session.family_id);
    throw new UnauthorizedError('Refresh token expired or revoked');
  }

  const user = await findUserById(session.user_id);
  if (!user || !user.is_active || user.clinic_status !== 'active') {
    await revokeSessionFamily(session.family_id);
    throw new UnauthorizedError('Session no longer valid');
  }

  const newRefreshToken = generateSecureToken(48);
  const newTokenHash = hashToken(newRefreshToken);
  const expiresAt = new Date(Date.now() + env.auth.refreshExpiresMs);

  const newSessionId = await withTransaction(async (client) => {
    const insert = await client.query(
      `
        INSERT INTO user_sessions (
          user_id,
          clinic_id,
          family_id,
          token_hash,
          user_agent,
          ip_address,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `,
      [
        user.id,
        user.clinic_id,
        session.family_id,
        newTokenHash,
        req.headers['user-agent'] || null,
        req.ip || null,
        expiresAt
      ]
    );

    const newId = insert.rows[0].id;

    await client.query(
      `
        UPDATE user_sessions
           SET revoked_at = now(),
               replaced_by = $2
         WHERE id = $1
      `,
      [session.id, newId]
    );

    return newId;
  });

  const accessToken = signAccessToken(user, session.family_id);

  await auditAuthEvent({
    req,
    userId: user.id,
    clinicId: user.clinic_id,
    action: 'token_refresh',
    diff: { sessionId: newSessionId, familyId: session.family_id }
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: env.auth.accessExpiresIn,
    user: mapUserProfile(user)
  };
}

/**
 * @param {object} params
 * @param {import('express').Request} params.req
 * @param {string} [params.refreshToken]
 * @param {string} [params.sessionFamilyId]
 * @param {string} [params.userId]
 * @param {string} [params.clinicId]
 */
export async function logout({
  req,
  refreshToken,
  sessionFamilyId,
  userId,
  clinicId
}) {
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    const { rows } = await query(
      `SELECT family_id, user_id, clinic_id FROM user_sessions WHERE token_hash = $1 LIMIT 1`,
      [tokenHash]
    );
    if (rows[0]) {
      await revokeSessionFamily(rows[0].family_id);
      userId = userId || rows[0].user_id;
      clinicId = clinicId || rows[0].clinic_id;
    }
  } else if (sessionFamilyId) {
    await revokeSessionFamily(sessionFamilyId);
  }

  await auditAuthEvent({
    req,
    userId,
    clinicId,
    action: 'logout',
    diff: { sessionFamilyId: sessionFamilyId || null }
  });
}

/**
 * @param {string} familyId
 */
async function revokeSessionFamily(familyId) {
  await query(
    `
      UPDATE user_sessions
         SET revoked_at = now()
       WHERE family_id = $1
         AND revoked_at IS NULL
    `,
    [familyId]
  );
}

/**
 * @param {string} userId
 */
export async function getProfile(userId) {
  const user = await findUserById(userId);
  if (!user || !user.is_active) {
    throw new NotFoundError('User not found');
  }
  return mapUserProfile(user);
}

/**
 * @param {object} params
 * @param {import('express').Request} params.req
 * @param {string} params.userId
 * @param {string} params.currentPassword
 * @param {string} params.newPassword
 */
export async function changePassword({ req, userId, currentPassword, newPassword }) {
  if (!currentPassword || !newPassword) {
    throw new ValidationError('Current and new passwords are required');
  }
  validatePasswordStrength(newPassword);

  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) {
    await auditAuthEvent({
      req,
      userId,
      clinicId: user.clinic_id,
      action: 'password_change_failed',
      diff: { reason: 'invalid_current_password' }
    });
    throw new UnauthorizedError('Current password is incorrect');
  }

  const passwordHash = await hashPassword(newPassword);
  await query(
    `
      UPDATE users
         SET password_hash = $2,
             must_change_password = false,
             revision = revision + 1
       WHERE id = $1
    `,
    [userId, passwordHash]
  );

  await revokeAllUserSessions(userId);

  await auditAuthEvent({
    req,
    userId,
    clinicId: user.clinic_id,
    action: 'password_change',
    diff: { sessionsRevoked: true }
  });

  return { success: true };
}

/**
 * @param {string} userId
 */
async function revokeAllUserSessions(userId) {
  await query(
    `
      UPDATE user_sessions
         SET revoked_at = now()
       WHERE user_id = $1
         AND revoked_at IS NULL
    `,
    [userId]
  );
}

/**
 * @param {object} params
 * @param {import('express').Request} params.req
 * @param {string} params.email
 */
export async function requestPasswordReset({ req, email }) {
  if (!email?.trim()) {
    throw new ValidationError('Email is required');
  }

  const user = await findUserByEmail(email);

  // Always return success to prevent email enumeration.
  const response = {
    success: true,
    message: 'If an account exists for that email, a reset link has been issued.'
  };

  if (!user || !user.is_active) {
    return response;
  }

  const resetToken = generateSecureToken(48);
  const tokenHash = hashToken(resetToken);
  const expiresAt = new Date(Date.now() + env.auth.passwordResetExpiresMs);

  await query(
    `
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `,
    [user.id, tokenHash, expiresAt]
  );

  const clinicBase = env.auth.clinicPublicUrl.replace(/\/$/, '');
  const apiBase = env.auth.appPublicUrl.replace(/\/$/, '');
  const resetUrl = `${clinicBase}/reset-password.html?token=${encodeURIComponent(resetToken)}&api=${encodeURIComponent(apiBase)}`;

  const mailResult = await sendPasswordResetEmail({ to: user.email, resetUrl });

  if (!mailResult.sent) {
    if (env.isDevelopment) {
      logger.info({ resetUrl, email: user.email }, 'Password reset link (SMTP not configured — development only)');
    } else {
      logger.warn(
        { email: user.email, reason: mailResult.reason },
        'Password reset token created but email was not sent — configure SMTP_* env vars'
      );
    }
  }

  await auditAuthEvent({
    req,
    userId: user.id,
    clinicId: user.clinic_id,
    action: 'password_reset_requested',
    diff: { expiresAt: expiresAt.toISOString() }
  });

  return response;
}

/**
 * @param {object} params
 * @param {import('express').Request} params.req
 * @param {string} params.token
 * @param {string} params.newPassword
 */
export async function confirmPasswordReset({ req, token, newPassword }) {
  if (!token?.trim() || !newPassword) {
    throw new ValidationError('Token and new password are required');
  }
  validatePasswordStrength(newPassword);

  const tokenHash = hashToken(token);

  const { rows } = await query(
    `
      SELECT
        t.id,
        t.user_id,
        t.expires_at,
        t.used_at,
        u.clinic_id
      FROM password_reset_tokens t
      JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = $1
      LIMIT 1
    `,
    [tokenHash]
  );

  const row = rows[0];
  if (!row || row.used_at || new Date(row.expires_at) <= new Date()) {
    throw new ValidationError('Invalid or expired reset token');
  }

  const passwordHash = await hashPassword(newPassword);

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE users SET password_hash = $2, must_change_password = false, revision = revision + 1 WHERE id = $1`,
      [row.user_id, passwordHash]
    );

    await client.query(
      `UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`,
      [row.id]
    );

    await client.query(
      `
        UPDATE user_sessions
           SET revoked_at = now()
         WHERE user_id = $1
           AND revoked_at IS NULL
      `,
      [row.user_id]
    );
  });

  await auditAuthEvent({
    req,
    userId: row.user_id,
    clinicId: row.clinic_id,
    action: 'password_reset_completed',
    diff: { tokenId: row.id }
  });

  return { success: true };
}

/**
 * Seed default clinic and admin user when database is empty.
 */
export async function seedDefaultClinicAndAdmin() {
  if (env.isProduction && !env.seed.allowProduction) {
    throw new Error(
      'Production seed is disabled. Set ALLOW_PRODUCTION_SEED=true and provide SEED_ADMIN_PASSWORD.'
    );
  }

  const { rows: clinicRows } = await query(`SELECT id FROM clinics LIMIT 1`);
  if (clinicRows.length) {
    return { seeded: false, reason: 'clinic_exists' };
  }

  let plainPassword = env.seed.adminPassword;
  let generatedPassword = false;

  if (!plainPassword) {
    if (env.isProduction) {
      throw new Error('SEED_ADMIN_PASSWORD is required for production seed');
    }
    plainPassword = generateSecureToken(18);
    generatedPassword = true;
  }

  validatePasswordStrength(plainPassword);

  const passwordHash = await hashPassword(plainPassword);

  const { rows } = await query(
    `
      WITH new_clinic AS (
        INSERT INTO clinics (name, slug, status)
        VALUES ($1, $2, 'active')
        RETURNING id
      )
      INSERT INTO users (
        clinic_id,
        email,
        password_hash,
        full_name,
        role,
        is_active,
        must_change_password
      )
      SELECT
        new_clinic.id,
        $3,
        $4,
        $5,
        'admin',
        true,
        true
      FROM new_clinic
      RETURNING id, clinic_id, email
    `,
    [
      env.seed.clinicName,
      env.seed.clinicSlug,
      env.seed.adminEmail.trim().toLowerCase(),
      passwordHash,
      env.seed.adminName
    ]
  );

  const result = {
    seeded: true,
    clinicId: rows[0].clinic_id,
    adminUserId: rows[0].id,
    adminEmail: rows[0].email,
    generatedPassword: generatedPassword ? plainPassword : undefined
  };

  if (generatedPassword) {
    logger.warn(
      { adminEmail: result.adminEmail },
      'Generated one-time seed password — save immediately and change on first login'
    );
  }

  return result;
}

import { query } from '../db/pool.js';
import { env } from '../config/env.js';
import { hashPassword, generateSecureToken } from '../core/auth-crypto.js';
import { ValidationError, UnauthorizedError } from '../core/errors.js';
import { resolveSsoDefaultRole } from './ssoConfig.js';

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
    u.auth_provider,
    u.external_subject,
    c.name AS clinic_name,
    c.slug AS clinic_slug,
    c.status AS clinic_status
  FROM users u
  JOIN clinics c ON c.id = u.clinic_id
`;

/**
 * @param {string} clinicId
 * @param {string} provider
 * @param {string} subject
 */
async function findUserByExternalSubject(clinicId, provider, subject) {
  const { rows } = await query(
    `${USER_SELECT}
     WHERE u.clinic_id = $1 AND u.auth_provider = $2 AND u.external_subject = $3
     LIMIT 1`,
    [clinicId, provider, subject]
  );
  return rows[0] || null;
}

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
 * @returns {Promise<string>}
 */
async function resolveDefaultClinicId() {
  if (env.sso.defaultClinicId) return env.sso.defaultClinicId;
  const { rows } = await query(
    `SELECT id FROM clinics WHERE status = 'active' ORDER BY created_at ASC LIMIT 1`
  );
  if (!rows[0]?.id) {
    throw new ValidationError('No active clinic configured for SSO provisioning');
  }
  return rows[0].id;
}

/**
 * Link or provision a user from SSO identity.
 * @param {{ provider: 'ldap' | 'oidc', subject: string, email: string, fullName: string }} identity
 */
export async function resolveSsoUser(identity) {
  const email = identity.email?.trim().toLowerCase();
  const fullName = identity.fullName?.trim();
  const subject = identity.subject?.trim();
  const provider = identity.provider;

  if (!email || !subject || !fullName) {
    throw new ValidationError('SSO identity missing required fields');
  }

  const clinicId = await resolveDefaultClinicId();

  let user = await findUserByExternalSubject(clinicId, provider, subject);
  if (user) {
    if (!user.is_active || user.clinic_status !== 'active') {
      throw new UnauthorizedError('Account is inactive or clinic suspended');
    }
    return user;
  }

  user = await findUserByEmail(email);
  if (user) {
    if (!user.is_active || user.clinic_status !== 'active') {
      throw new UnauthorizedError('Account is inactive or clinic suspended');
    }
    if (user.auth_provider === 'local' || user.auth_provider === provider) {
      const { rows } = await query(
        `
          UPDATE users
             SET auth_provider = $2,
                 external_subject = $3,
                 full_name = COALESCE(NULLIF($4, ''), full_name),
                 revision = revision + 1
           WHERE id = $1
           RETURNING *
        `,
        [user.id, provider, subject, fullName]
      );
      const updated = rows[0];
      const { rows: joined } = await query(
        `${USER_SELECT} WHERE u.id = $1 LIMIT 1`,
        [updated.id]
      );
      return joined[0];
    }
    throw new UnauthorizedError('Email already registered with a different sign-in method');
  }

  if (!env.sso.autoProvision) {
    throw new UnauthorizedError('No matching account — contact your administrator to enable SSO provisioning');
  }

  const role = resolveSsoDefaultRole(env.sso.defaultRole);
  const passwordHash = await hashPassword(generateSecureToken(32));

  const { rows } = await query(
    `
      INSERT INTO users (
        clinic_id, email, password_hash, full_name, role,
        is_active, must_change_password, auth_provider, external_subject
      )
      VALUES ($1, $2, $3, $4, $5, true, false, $6, $7)
      RETURNING id
    `,
    [clinicId, email, passwordHash, fullName, role, provider, subject]
  );

  const { rows: joined } = await query(
    `${USER_SELECT} WHERE u.id = $1 LIMIT 1`,
    [rows[0].id]
  );
  return joined[0];
}

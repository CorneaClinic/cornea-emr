import { query } from '../db/pool.js';
import { hashPassword } from '../core/auth-crypto.js';
import { ROLE_LABELS, ROLES, isValidRole } from '../core/permissions.js';
import {
  defaultSectionsForRole,
  resolveEmrSections,
  validateEmrSectionOverride,
  getEmrSectionCatalog
} from '../core/emr-sections.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../core/errors.js';
import { validatePasswordStrength } from '../core/password-policy.js';

/**
 * @param {object} row
 */
function mapUserRow(row) {
  const override = row.emr_sections ?? null;
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    roleLabel: ROLE_LABELS[row.role] || row.role,
    isActive: row.is_active,
    mustChangePassword: !!row.must_change_password,
    emrSectionOverride: override,
    emrSections: resolveEmrSections(row.role, override),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const USER_LIST_SELECT = `
  SELECT id, email, full_name, role, is_active, must_change_password,
         emr_sections, created_at, updated_at
    FROM users
   WHERE clinic_id = $1
`;

/**
 * @param {string} clinicId
 */
export async function listClinicUsers(clinicId) {
  const { rows } = await query(
    `${USER_LIST_SELECT} ORDER BY full_name ASC, email ASC`,
    [clinicId]
  );
  return { users: rows.map(mapUserRow) };
}

/**
 * @param {string} clinicId
 * @param {string} userId
 */
export async function getClinicUser(clinicId, userId) {
  const { rows } = await query(
    `${USER_LIST_SELECT} AND id = $2 LIMIT 1`,
    [clinicId, userId]
  );
  if (!rows[0]) throw new NotFoundError('User not found');
  return mapUserRow(rows[0]);
}

export function getSectionCatalog() {
  return {
    sections: getEmrSectionCatalog(),
    roles: ROLES.map((id) => ({ id, label: ROLE_LABELS[id] || id })),
    roleDefaults: Object.fromEntries(
      ROLES.map((role) => [role, defaultSectionsForRole(role)])
    )
  };
}

/**
 * @param {object} params
 * @param {string} params.clinicId
 * @param {string} params.email
 * @param {string} params.fullName
 * @param {string} params.role
 * @param {string} params.password
 * @param {object | null} [params.emrSections]
 */
export async function createClinicUser({
  clinicId,
  email,
  fullName,
  role,
  password,
  emrSections = null
}) {
  if (!email?.trim() || !fullName?.trim() || !password) {
    throw new ValidationError('Email, full name, and password are required');
  }
  if (!isValidRole(role)) {
    throw new ValidationError(`Invalid role. Allowed: ${ROLES.join(', ')}`);
  }
  validatePasswordStrength(password);
  const sectionOverride = validateEmrSectionOverride(emrSections);

  const passwordHash = await hashPassword(password);

  try {
    const { rows } = await query(
      `
        INSERT INTO users (
          clinic_id, email, full_name, role, password_hash,
          must_change_password, emr_sections
        )
        VALUES ($1, $2, $3, $4, $5, true, $6)
        RETURNING id, email, full_name, role, is_active, must_change_password,
                  emr_sections, created_at, updated_at
      `,
      [
        clinicId,
        email.trim().toLowerCase(),
        fullName.trim(),
        role,
        passwordHash,
        sectionOverride ? JSON.stringify(sectionOverride) : null
      ]
    );
    return { user: mapUserRow(rows[0]) };
  } catch (err) {
    if (err.code === '23505') {
      throw new ValidationError('A user with this email already exists in the clinic');
    }
    throw err;
  }
}

/**
 * @param {object} params
 * @param {string} params.clinicId
 * @param {string} params.userId
 * @param {string} params.actorUserId
 * @param {object} params.patch
 */
export async function updateClinicUser({ clinicId, userId, actorUserId, patch }) {
  const existing = await getClinicUser(clinicId, userId);

  const fullName = patch.fullName !== undefined ? String(patch.fullName).trim() : existing.fullName;
  const role = patch.role !== undefined ? patch.role : existing.role;
  let isActive = patch.isActive !== undefined ? !!patch.isActive : existing.isActive;

  if (!fullName) throw new ValidationError('Full name is required');
  if (!isValidRole(role)) {
    throw new ValidationError(`Invalid role. Allowed: ${ROLES.join(', ')}`);
  }

  if (userId === actorUserId && isActive === false) {
    throw new ForbiddenError('You cannot deactivate your own account');
  }
  if (userId === actorUserId && role !== 'admin' && existing.role === 'admin') {
    throw new ForbiddenError('You cannot remove your own admin role');
  }

  let emrSections = existing.emrSectionOverride;
  if (patch.emrSections !== undefined) {
    emrSections = validateEmrSectionOverride(patch.emrSections);
  }
  if (patch.resetEmrSections === true) {
    emrSections = null;
  }

  const { rows } = await query(
    `
      UPDATE users
         SET full_name = $3,
             role = $4,
             is_active = $5,
             emr_sections = $6,
             revision = revision + 1
       WHERE clinic_id = $1 AND id = $2
       RETURNING id, email, full_name, role, is_active, must_change_password,
                 emr_sections, created_at, updated_at
    `,
    [
      clinicId,
      userId,
      fullName,
      role,
      isActive,
      emrSections ? JSON.stringify(emrSections) : null
    ]
  );

  if (!rows[0]) throw new NotFoundError('User not found');
  return { user: mapUserRow(rows[0]) };
}

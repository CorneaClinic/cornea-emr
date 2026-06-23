/**
 * EMR UI sections — admin can override per user (users.emr_sections JSONB).
 * null override = role defaults.
 */

export const EMR_SECTIONS = Object.freeze([
  'dashboard',
  'patient_form',
  'records',
  'audit_trail',
  'patient_flow',
  'keratoplasty',
  'kc_registry',
  'clinical_media',
  'database',
  'user_admin'
]);

/** @typedef {typeof EMR_SECTIONS[number]} EmrSection */

export const EMR_SECTION_LABELS = Object.freeze({
  dashboard: 'Dashboard',
  patient_form: 'Patient Form (clinical visit)',
  records: 'Patient Records',
  audit_trail: 'Audit Trail (who changed records)',
  patient_flow: 'Patient Flow (clinic stations)',
  keratoplasty: 'Keratoplasty Register',
  kc_registry: 'KC & CXL Registry',
  clinical_media: 'Clinical Media Library',
  database: 'Database & export/import',
  user_admin: 'User & section access (admin)'
});

/** @type {Record<string, Record<EmrSection, boolean>>} */
export const ROLE_DEFAULT_EMR_SECTIONS = Object.freeze({
  admin: {
    dashboard: true,
    patient_form: true,
    records: true,
    audit_trail: true,
    patient_flow: true,
    keratoplasty: true,
    kc_registry: true,
    clinical_media: true,
    database: true,
    user_admin: true
  },
  cornea_consultant: {
    dashboard: true,
    patient_form: true,
    records: true,
    audit_trail: true,
    patient_flow: true,
    keratoplasty: true,
    kc_registry: true,
    clinical_media: true,
    database: false,
    user_admin: false
  },
  ophthalmologist: {
    dashboard: true,
    patient_form: true,
    records: true,
    audit_trail: true,
    patient_flow: true,
    keratoplasty: true,
    kc_registry: true,
    clinical_media: true,
    database: false,
    user_admin: false
  },
  doctor_in_training: {
    dashboard: true,
    patient_form: true,
    records: true,
    audit_trail: true,
    patient_flow: true,
    keratoplasty: true,
    kc_registry: true,
    clinical_media: true,
    database: false,
    user_admin: false
  },
  optometrist: {
    dashboard: true,
    patient_form: true,
    records: true,
    audit_trail: true,
    patient_flow: true,
    keratoplasty: false,
    kc_registry: true,
    clinical_media: true,
    database: false,
    user_admin: false
  },
  technician: {
    dashboard: true,
    patient_form: true,
    records: true,
    audit_trail: true,
    patient_flow: true,
    keratoplasty: false,
    kc_registry: true,
    clinical_media: true,
    database: false,
    user_admin: false
  },
  receptionist: {
    dashboard: true,
    patient_form: false,
    records: true,
    audit_trail: true,
    patient_flow: true,
    keratoplasty: false,
    kc_registry: false,
    clinical_media: false,
    database: false,
    user_admin: false
  }
});

/**
 * @param {string | null | undefined} role
 * @returns {Record<EmrSection, boolean>}
 */
export function defaultSectionsForRole(role) {
  const defaults = ROLE_DEFAULT_EMR_SECTIONS[role];
  if (!defaults) {
    return Object.fromEntries(EMR_SECTIONS.map((k) => [k, false]));
  }
  return { ...defaults };
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, boolean>}
 */
function isSectionOverride(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).every((k) => EMR_SECTIONS.includes(k) && typeof value[k] === 'boolean');
}

/**
 * @param {string} role
 * @param {unknown} override
 * @returns {Record<EmrSection, boolean>}
 */
export function resolveEmrSections(role, override) {
  const base = defaultSectionsForRole(role);
  if (override == null) return base;
  if (!isSectionOverride(override)) return base;
  const resolved = { ...base };
  for (const key of EMR_SECTIONS) {
    if (Object.prototype.hasOwnProperty.call(override, key)) {
      resolved[key] = !!override[key];
    }
  }
  return resolved;
}

/**
 * @param {unknown} override
 */
export function validateEmrSectionOverride(override) {
  if (override == null) return null;
  if (!isSectionOverride(override)) {
    throw new Error('emrSections must be an object of section keys to boolean values');
  }
  const cleaned = {};
  for (const key of EMR_SECTIONS) {
    if (Object.prototype.hasOwnProperty.call(override, key)) {
      cleaned[key] = !!override[key];
    }
  }
  return cleaned;
}

/**
 * Catalog for admin UI.
 */
export function getEmrSectionCatalog() {
  return EMR_SECTIONS.map((id) => ({
    id,
    label: EMR_SECTION_LABELS[id]
  }));
}

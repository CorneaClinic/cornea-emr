import { query } from '../db/pool.js';

/**
 * Next clinic-wide patient MRN (CC-YYYY-NNNN). Same ID is used in Patient Records
 * and linked from specialty registries (keratoplasty, KC, dry eye, etc.).
 * @param {string} clinicId
 */
export async function nextMrn(clinicId) {
  const year = new Date().getFullYear();
  const prefix = `CC-${year}-`;
  const { rows } = await query(
    `
      SELECT mrn
        FROM patients
       WHERE clinic_id = $1
         AND mrn LIKE $2
       ORDER BY mrn DESC
       LIMIT 1
    `,
    [clinicId, `${prefix}%`]
  );
  const last = rows[0]?.mrn || `${prefix}0000`;
  const num = parseInt(String(last).slice(prefix.length), 10) || 0;
  return `${prefix}${String(num + 1).padStart(4, '0')}`;
}

/**
 * Resolve optional registry link fields from a human MRN.
 * @param {string} clinicId
 * @param {unknown} mrn
 */
export async function resolveEmrPatientLink(clinicId, mrn) {
  const normalized = mrn != null ? String(mrn).trim() : '';
  if (!normalized) {
    return { emrPatientUuid: null, emrPatientMrn: null };
  }
  const { rows } = await query(
    `SELECT id, mrn FROM patients WHERE clinic_id = $1 AND mrn = $2`,
    [clinicId, normalized]
  );
  if (!rows[0]) {
    return { emrPatientUuid: null, emrPatientMrn: normalized };
  }
  return { emrPatientUuid: rows[0].id, emrPatientMrn: rows[0].mrn };
}

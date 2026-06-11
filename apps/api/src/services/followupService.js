import { query } from '../db/pool.js';
import { NotFoundError } from '../core/errors.js';
import {
  optionalString,
  parseDate,
  parseEnum,
  formatDate
} from '../core/validation.js';
import { auditMutation } from './auditService.js';
import { assertVisitAccessible } from './visitService.js';

const SEVERITY_VALUES = ['severe', 'moderate', 'mild'];

/**
 * @param {Record<string, unknown>} row
 */
export function mapFollowup(row) {
  return {
    visitId: row.visit_id,
    clinicId: row.clinic_id,
    followUpDate: formatDate(row.follow_up_date),
    intervalCode: row.interval_code,
    customDate: formatDate(row.custom_date),
    place: row.place,
    purpose: row.purpose,
    severity: row.severity,
    remarks: row.remarks,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * @param {Record<string, unknown>} body
 */
function parseFollowupInput(body) {
  return {
    followUpDate: parseDate(body.followUpDate, 'followUpDate'),
    intervalCode: optionalString(body.intervalCode, 'intervalCode'),
    customDate: parseDate(body.customDate, 'customDate'),
    place: optionalString(body.place, 'place'),
    purpose: optionalString(body.purpose, 'purpose'),
    severity: parseEnum(body.severity, 'severity', SEVERITY_VALUES),
    remarks: optionalString(body.remarks, 'remarks')
  };
}

/**
 * @param {string} clinicId
 * @param {string} visitId
 */
export async function getFollowup(clinicId, visitId) {
  await assertVisitAccessible(clinicId, visitId);

  const { rows } = await query(
    `SELECT * FROM followups WHERE visit_id = $1 AND clinic_id = $2`,
    [visitId, clinicId]
  );
  if (!rows[0]) throw new NotFoundError('Follow-up not found');
  return mapFollowup(rows[0]);
}

/**
 * @param {import('express').Request} req
 * @param {string} visitId
 * @param {Record<string, unknown>} body
 */
export async function upsertFollowup(req, visitId, body) {
  const clinicId = req.user.clinicId;
  await assertVisitAccessible(clinicId, visitId);

  const input = parseFollowupInput(body);

  const { rows } = await query(
    `
      INSERT INTO followups (
        visit_id, clinic_id, follow_up_date, interval_code, custom_date,
        place, purpose, severity, remarks
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (visit_id) DO UPDATE SET
        follow_up_date = EXCLUDED.follow_up_date,
        interval_code = EXCLUDED.interval_code,
        custom_date = EXCLUDED.custom_date,
        place = EXCLUDED.place,
        purpose = EXCLUDED.purpose,
        severity = EXCLUDED.severity,
        remarks = EXCLUDED.remarks
      RETURNING *
    `,
    [
      visitId,
      clinicId,
      input.followUpDate,
      input.intervalCode,
      input.customDate,
      input.place,
      input.purpose,
      input.severity,
      input.remarks
    ]
  );

  const followup = mapFollowup(rows[0]);
  await auditMutation(req, 'followup', visitId, 'upsert', {
    followUpDate: input.followUpDate,
    severity: input.severity
  });
  return followup;
}

/**
 * @param {import('express').Request} req
 * @param {string} visitId
 */
export async function deleteFollowup(req, visitId) {
  const clinicId = req.user.clinicId;

  const { rowCount } = await query(
    `DELETE FROM followups WHERE visit_id = $1 AND clinic_id = $2`,
    [visitId, clinicId]
  );
  if (!rowCount) throw new NotFoundError('Follow-up not found');

  await auditMutation(req, 'followup', visitId, 'delete', {});
  return { success: true };
}

/**
 * @param {string} clinicId
 * @param {Record<string, unknown>} queryParams
 */
export async function listFollowups(clinicId, queryParams) {
  const params = [clinicId];
  const filters = ['f.clinic_id = $1'];

  const severity = parseEnum(queryParams.severity, 'severity', SEVERITY_VALUES);
  if (severity) {
    params.push(severity);
    filters.push(`f.severity = $${params.length}`);
  }

  const followUpDateFrom = parseDate(queryParams.followUpDateFrom, 'followUpDateFrom');
  if (followUpDateFrom) {
    params.push(followUpDateFrom);
    filters.push(`f.follow_up_date >= $${params.length}`);
  }

  const followUpDateTo = parseDate(queryParams.followUpDateTo, 'followUpDateTo');
  if (followUpDateTo) {
    params.push(followUpDateTo);
    filters.push(`f.follow_up_date <= $${params.length}`);
  }

  const { rows } = await query(
    `
      SELECT f.*, v.visit_date, p.mrn, p.full_name
        FROM followups f
        JOIN visits v ON v.id = f.visit_id
        JOIN patients p ON p.id = v.patient_id
       WHERE ${filters.join(' AND ')}
       ORDER BY f.follow_up_date ASC NULLS LAST, f.updated_at DESC
       LIMIT 500
    `,
    params
  );

  return {
    data: rows.map((r) => ({
      ...mapFollowup(r),
      visitDate: formatDate(r.visit_date),
      patientMrn: r.mrn,
      patientName: r.full_name
    }))
  };
}

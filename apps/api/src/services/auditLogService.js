import { query } from '../db/pool.js';
import { NotFoundError } from '../core/errors.js';

const CLINICAL_ENTITY_TYPES = ['visit', 'patient'];

/**
 * @param {string} clinicId
 * @param {object} [opts]
 */
export async function listClinicAuditLogs(clinicId, opts = {}) {
  const limit = Math.min(Math.max(parseInt(opts.limit, 10) || 100, 1), 500);
  const offset = Math.max(parseInt(opts.offset, 10) || 0, 0);
  const action = opts.action?.trim() || null;
  const userName = opts.userName?.trim() || null;
  const patient = opts.patient?.trim() || null;
  const dateFrom = opts.dateFrom?.trim() || null;
  const dateTo = opts.dateTo?.trim() || null;
  const clinicalOnly = opts.clinicalOnly !== 'false';

  const conditions = ['al.clinic_id = $1'];
  const params = [clinicId];
  let idx = 2;

  if (clinicalOnly) {
    conditions.push(`al.entity_type = ANY($${idx++})`);
    params.push(CLINICAL_ENTITY_TYPES);
  }

  if (action) {
    conditions.push(`al.action = $${idx++}`);
    params.push(action);
  }

  if (userName) {
    conditions.push(`(u.full_name ILIKE $${idx} OR u.email ILIKE $${idx})`);
    params.push(`%${userName}%`);
    idx++;
  }

  if (patient) {
    conditions.push(`(
      al.entity_id::text ILIKE $${idx}
      OR al.diff->>'patientId' ILIKE $${idx}
      OR al.diff->>'fullName' ILIKE $${idx}
      OR al.diff->>'mrn' ILIKE $${idx}
      OR al.diff->>'patientName' ILIKE $${idx}
    )`);
    params.push(`%${patient}%`);
    idx++;
  }

  if (dateFrom) {
    conditions.push(`al.created_at >= $${idx++}::date`);
    params.push(dateFrom);
  }

  if (dateTo) {
    conditions.push(`al.created_at < ($${idx++}::date + interval '1 day')`);
    params.push(dateTo);
  }

  const where = conditions.join(' AND ');

  const { rows } = await query(
    `
      SELECT
        al.id,
        al.user_id,
        al.entity_type,
        al.entity_id,
        al.action,
        al.diff,
        al.created_at,
        u.full_name AS user_name,
        u.email AS user_email
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE ${where}
      ORDER BY al.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `,
    [...params, limit, offset]
  );

  return {
    logs: rows.map(mapAuditRow)
  };
}

/**
 * @param {object} row
 */
function mapAuditRow(row) {
  const diff = row.diff || null;
  let patientId = null;
  let patientName = null;
  let oldValue = null;
  let newValue = null;

  if (diff && typeof diff === 'object') {
    patientId = diff.patientId ?? diff.mrn ?? null;
    patientName = diff.fullName ?? diff.patientName ?? null;
    oldValue = diff.old ?? diff.before ?? diff.previous ?? null;
    newValue = diff.new ?? diff.after ?? null;
    if (newValue == null && diff.visitDate != null) {
      newValue = {
        patientId: diff.patientId,
        fullName: diff.fullName,
        visitDate: diff.visitDate
      };
    }
  } else if (diff != null) {
    newValue = diff;
  }

  if (row.entity_type === 'patient' || row.entity_type === 'visit') {
    patientId = patientId || diff?.patientId || row.entity_id;
  }

  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    patientId,
    patientName,
    oldValue,
    newValue,
    diff: row.diff,
    createdAt: row.created_at
  };
}

/**
 * @param {string} clinicId
 * @param {string} logId
 */
export async function getClinicAuditLog(clinicId, logId) {
  const { rows } = await query(
    `
      SELECT al.id, al.created_at
        FROM audit_logs al
       WHERE al.clinic_id = $1 AND al.id = $2
       LIMIT 1
    `,
    [clinicId, logId]
  );
  if (!rows[0]) throw new NotFoundError('Audit log not found');
  return rows[0];
}

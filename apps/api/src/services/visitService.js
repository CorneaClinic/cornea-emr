import { query, withTransaction } from '../db/pool.js';
import { NotFoundError, ConflictError, ValidationError } from '../core/errors.js';
import {
  parsePagination,
  buildPaginationMeta,
  parseSort,
  appendSearch,
  requireDate,
  parseDate,
  parseEnum,
  requireUuid,
  optionalObject,
  optionalInt,
  formatDate
} from '../core/validation.js';
import { auditMutation } from './auditService.js';
import { getPatientById } from './patientService.js';

const STATUS_VALUES = ['draft', 'finalized', 'cancelled'];
const SORT_FIELDS = {
  visitDate: 'v.visit_date',
  updatedAt: 'v.updated_at',
  createdAt: 'v.created_at',
  status: 'v.status'
};

/**
 * @param {Record<string, unknown>} row
 * @param {Record<string, unknown>} [patient]
 */
export function mapVisit(row, patient) {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    patientId: row.patient_id,
    visitDate: formatDate(row.visit_date),
    status: row.status,
    payload: row.payload || {},
    legacyLocalId: row.legacy_local_id,
    revision: row.revision,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    patient: patient
      ? {
          id: patient.id,
          mrn: patient.mrn,
          fullName: patient.full_name,
          phone: patient.phone,
          dob: formatDate(patient.dob),
          sex: patient.sex
        }
      : undefined
  };
}

/**
 * @param {string} clinicId
 * @param {Record<string, unknown>} queryParams
 */
export async function listVisits(clinicId, queryParams) {
  const { page, limit, offset } = parsePagination(queryParams, { defaultLimit: 100, maxLimit: 500 });
  const sort = parseSort(queryParams.sort, SORT_FIELDS, 'updatedAt:desc');
  const params = [clinicId];
  const filters = ['v.clinic_id = $1'];

  const status = parseEnum(queryParams.status, 'status', STATUS_VALUES);
  if (status) {
    params.push(status);
    filters.push(`v.status = $${params.length}`);
  } else if (queryParams.includeCancelled !== 'true') {
    filters.push(`v.status != 'cancelled'`);
  }

  if (queryParams.patientId) {
    requireUuid(queryParams.patientId, 'patientId');
    params.push(queryParams.patientId);
    filters.push(`v.patient_id = $${params.length}`);
  }

  const visitDateFrom = parseDate(queryParams.visitDateFrom, 'visitDateFrom');
  if (visitDateFrom) {
    params.push(visitDateFrom);
    filters.push(`v.visit_date >= $${params.length}`);
  }

  const visitDateTo = parseDate(queryParams.visitDateTo, 'visitDateTo');
  if (visitDateTo) {
    params.push(visitDateTo);
    filters.push(`v.visit_date <= $${params.length}`);
  }

  const search = appendSearch(String(queryParams.q || ''), [
    'p.mrn',
    'p.full_name',
    'p.phone'
  ], params);
  if (search.clause) {
    filters.push(search.clause);
  }

  const where = filters.join(' AND ');

  const countResult = await query(
    `
      SELECT COUNT(*)::int AS total
        FROM visits v
        JOIN patients p ON p.id = v.patient_id
       WHERE ${where}
    `,
    params
  );

  params.push(limit, offset);
  const { rows } = await query(
    `
      SELECT
        v.*,
        p.mrn,
        p.full_name,
        p.phone,
        p.dob,
        p.sex
      FROM visits v
      JOIN patients p ON p.id = v.patient_id
     WHERE ${where}
     ORDER BY ${sort}
     LIMIT $${params.length - 1}
    OFFSET $${params.length}
    `,
    params
  );

  return {
    data: rows.map((r) =>
      mapVisit(r, {
        id: r.patient_id,
        mrn: r.mrn,
        full_name: r.full_name,
        phone: r.phone,
        dob: r.dob,
        sex: r.sex
      })
    ),
    pagination: buildPaginationMeta(countResult.rows[0].total, page, limit)
  };
}

/**
 * @param {string} clinicId
 * @param {string} id
 */
export async function getVisitById(clinicId, id) {
  requireUuid(id, 'id');
  const { rows } = await query(
    `
      SELECT v.*, p.mrn, p.full_name, p.phone, p.dob, p.sex, p.address
        FROM visits v
        JOIN patients p ON p.id = v.patient_id
       WHERE v.id = $1 AND v.clinic_id = $2
    `,
    [id, clinicId]
  );
  if (!rows[0]) throw new NotFoundError('Visit not found');
  return mapVisit(rows[0], rows[0]);
}

/**
 * @param {string} clinicId
 * @param {number} legacyLocalId
 */
export async function getVisitByLegacyId(clinicId, legacyLocalId) {
  const localId = optionalInt(legacyLocalId, 'legacyLocalId');
  if (localId == null) throw new ValidationError('legacyLocalId is required');

  const { rows } = await query(
    `
      SELECT v.*, p.mrn, p.full_name, p.phone, p.dob, p.sex, p.address
        FROM visits v
        JOIN patients p ON p.id = v.patient_id
       WHERE v.clinic_id = $1 AND v.legacy_local_id = $2
    `,
    [clinicId, localId]
  );
  if (!rows[0]) throw new NotFoundError('Visit not found');
  return mapVisit(rows[0], rows[0]);
}

/**
 * @param {string} clinicId
 * @param {string} mrn
 */
export async function listVisitsByMrn(clinicId, mrn) {
  const { rows: patients } = await query(
    `SELECT id FROM patients WHERE clinic_id = $1 AND mrn = $2`,
    [clinicId, String(mrn).trim()]
  );
  if (!patients[0]) {
    return { data: [] };
  }

  const { rows } = await query(
    `
      SELECT
        v.*,
        p.mrn,
        p.full_name,
        p.phone,
        p.dob,
        p.sex,
        p.address,
        v.payload->>'chiefComplaint' AS chief_complaint,
        v.payload->>'diagnosis' AS diagnosis
      FROM visits v
      JOIN patients p ON p.id = v.patient_id
     WHERE v.patient_id = $1
       AND v.status != 'cancelled'
     ORDER BY v.visit_date ASC, v.created_at ASC
    `,
    [patients[0].id]
  );

  return {
    data: rows.map((r) => ({
      ...mapVisit(r, r),
      chiefComplaint: r.chief_complaint,
      diagnosis: r.diagnosis
    }))
  };
}

/**
 * @param {string} clinicId
 */
export async function getVisitStats(clinicId) {
  const today = new Date().toISOString().slice(0, 10);

  const { rows: totalRows } = await query(
    `SELECT COUNT(*)::int AS total FROM visits WHERE clinic_id = $1 AND status != 'cancelled'`,
    [clinicId]
  );
  const { rows: todayRows } = await query(
    `SELECT COUNT(*)::int AS today FROM visits WHERE clinic_id = $1 AND visit_date = $2`,
    [clinicId, today]
  );
  const { rows: sexRows } = await query(
    `
      SELECT p.sex, COUNT(*)::int AS cnt
        FROM visits v
        JOIN patients p ON p.id = v.patient_id
       WHERE v.clinic_id = $1
       GROUP BY p.sex
    `,
    [clinicId]
  );
  const { rows: recentRows } = await query(
    `
      SELECT v.id, v.legacy_local_id, v.updated_at, v.visit_date,
             p.full_name, p.mrn
        FROM visits v
        JOIN patients p ON p.id = v.patient_id
       WHERE v.clinic_id = $1
       ORDER BY v.updated_at DESC
       LIMIT 5
    `,
    [clinicId]
  );

  let maleCount = 0;
  let femaleCount = 0;
  sexRows.forEach((r) => {
    if (r.sex === 'Male') maleCount = r.cnt;
    if (r.sex === 'Female') femaleCount = r.cnt;
  });

  return {
    total: totalRows[0].total,
    todayVisits: todayRows[0].today,
    sexRatio: { male: maleCount, female: femaleCount },
    recent: recentRows.map((r) => ({
      id: r.id,
      legacyLocalId: r.legacy_local_id,
      updatedAt: r.updated_at,
      visitDate: formatDate(r.visit_date),
      fullName: r.full_name,
      mrn: r.mrn
    }))
  };
}

/**
 * @param {import('express').Request} req
 * @param {Record<string, unknown>} body
 */
export async function createVisit(req, body) {
  const clinicId = req.user.clinicId;
  const userId = req.user.sub;
  const patientId = requireUuid(body.patientId, 'patientId');
  await getPatientById(clinicId, patientId);

  const visitDate = body.visitDate ? requireDate(body.visitDate, 'visitDate') : new Date().toISOString().slice(0, 10);
  const status = parseEnum(body.status, 'status', STATUS_VALUES) || 'draft';
  const payload = optionalObject(body.payload, 'payload');
  let legacyLocalId = optionalInt(body.legacyLocalId, 'legacyLocalId');

  if (legacyLocalId == null) {
    const maxRes = await query(
      `SELECT COALESCE(MAX(legacy_local_id), 0) + 1 AS next_id FROM visits WHERE clinic_id = $1`,
      [clinicId]
    );
    legacyLocalId = maxRes.rows[0].next_id;
  }

  try {
    const { rows } = await query(
      `
        INSERT INTO visits (
          clinic_id, patient_id, visit_date, status, payload,
          legacy_local_id, created_by, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        RETURNING *
      `,
      [clinicId, patientId, visitDate, status, payload, legacyLocalId, userId]
    );

    const visit = await getVisitById(clinicId, rows[0].id);
    await auditMutation(req, 'visit', visit.id, 'create', {
      patientId,
      visitDate,
      status,
      legacyLocalId
    });
    return visit;
  } catch (err) {
    if (err.code === '23505') {
      throw new ConflictError('A visit with this legacy local id already exists', { legacyLocalId });
    }
    throw err;
  }
}

/**
 * @param {import('express').Request} req
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function updateVisit(req, id, body) {
  requireUuid(id, 'id');
  const clinicId = req.user.clinicId;
  const userId = req.user.sub;
  const existing = await getVisitById(clinicId, id);

  if (existing.status === 'cancelled') {
    throw new ConflictError('Cannot update a cancelled visit');
  }

  const revision = body.revision != null ? Number(body.revision) : existing.revision;
  if (Number.isNaN(revision)) {
    throw new ValidationError('revision must be a number');
  }

  const patientId = body.patientId != null ? requireUuid(body.patientId, 'patientId') : existing.patientId;
  if (body.patientId != null) {
    await getPatientById(clinicId, patientId);
  }

  const visitDate = body.visitDate != null ? requireDate(body.visitDate, 'visitDate') : existing.visitDate;
  const status = body.status != null ? parseEnum(body.status, 'status', STATUS_VALUES) : existing.status;
  const payload = body.payload !== undefined ? optionalObject(body.payload, 'payload') : existing.payload;

  const { rows } = await query(
    `
      UPDATE visits
         SET patient_id = $3,
             visit_date = $4,
             status = $5,
             payload = $6,
             updated_by = $7,
             revision = revision + 1
       WHERE id = $1
         AND clinic_id = $2
         AND revision = $8
         AND status != 'cancelled'
      RETURNING id
    `,
    [id, clinicId, patientId, visitDate, status, payload, userId, revision]
  );

  if (!rows[0]) {
    const current = await query(
      `SELECT revision, status FROM visits WHERE id = $1 AND clinic_id = $2`,
      [id, clinicId]
    );
    if (!current.rows[0]) throw new NotFoundError('Visit not found');
    throw new ConflictError('Visit was modified by another user', {
      expectedRevision: revision,
      currentRevision: current.rows[0].revision
    });
  }

  const visit = await getVisitById(clinicId, id);
  await auditMutation(req, 'visit', id, 'update', {
    before: { status: existing.status, revision: existing.revision },
    after: { status, revision: visit.revision }
  });
  return visit;
}

/**
 * @param {import('express').Request} req
 * @param {string} id
 */
export async function finalizeVisit(req, id) {
  requireUuid(id, 'id');
  const clinicId = req.user.clinicId;
  const userId = req.user.sub;

  const { rows } = await query(
    `
      UPDATE visits
         SET status = 'finalized',
             updated_by = $3,
             revision = revision + 1
       WHERE id = $1
         AND clinic_id = $2
         AND status = 'draft'
      RETURNING id
    `,
    [id, clinicId, userId]
  );

  if (!rows[0]) {
    const current = await getVisitById(clinicId, id).catch(() => null);
    if (!current) throw new NotFoundError('Visit not found');
    throw new ConflictError('Only draft visits can be finalized', { status: current.status });
  }

  const visit = await getVisitById(clinicId, id);
  await auditMutation(req, 'visit', id, 'finalize', { status: 'finalized' });
  return visit;
}

/**
 * @param {import('express').Request} req
 * @param {string} id
 */
export async function cancelVisit(req, id) {
  requireUuid(id, 'id');
  const clinicId = req.user.clinicId;
  const userId = req.user.sub;

  const { rowCount } = await query(
    `
      UPDATE visits
         SET status = 'cancelled',
             updated_by = $3,
             revision = revision + 1
       WHERE id = $1
         AND clinic_id = $2
         AND status != 'cancelled'
    `,
    [id, clinicId, userId]
  );

  if (!rowCount) {
    const current = await getVisitById(clinicId, id).catch(() => null);
    if (!current) throw new NotFoundError('Visit not found');
    if (current.status === 'cancelled') {
      return { success: true, alreadyCancelled: true };
    }
    throw new ConflictError('Visit could not be cancelled');
  }

  await auditMutation(req, 'visit', id, 'cancel', { status: 'cancelled' });
  return { success: true };
}

/**
 * @param {string} clinicId
 * @param {string} visitId
 */
export async function assertVisitAccessible(clinicId, visitId) {
  requireUuid(visitId, 'visitId');
  const visit = await getVisitById(clinicId, visitId);
  if (visit.status === 'cancelled') {
    throw new ConflictError('Visit is cancelled');
  }
  return visit;
}

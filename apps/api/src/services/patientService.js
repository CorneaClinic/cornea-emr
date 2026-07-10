import { query } from '../db/pool.js';
import { NotFoundError, ConflictError, ValidationError } from '../core/errors.js';
import {
  parsePagination,
  buildPaginationMeta,
  parseSort,
  appendSearch,
  requireString,
  optionalString,
  parseDate,
  parseEnum,
  requireUuid,
  formatDate
} from '../core/validation.js';
import { auditMutation } from './auditService.js';

const SEX_VALUES = ['Male', 'Female', 'Other'];
const SORT_FIELDS = {
  fullName: 'p.full_name',
  mrn: 'p.mrn',
  createdAt: 'p.created_at',
  updatedAt: 'p.updated_at'
};

/**
 * @param {Record<string, unknown>} row
 */
export function mapPatient(row) {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    mrn: row.mrn,
    fullName: row.full_name,
    dob: formatDate(row.dob),
    sex: row.sex,
    phone: row.phone,
    address: row.address,
    nationalId: row.national_id,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * @param {string} clinicId
 * @param {Record<string, unknown>} queryParams
 */
export async function listPatients(clinicId, queryParams) {
  const { page, limit, offset } = parsePagination(queryParams);
  const sort = parseSort(queryParams.sort, SORT_FIELDS, 'fullName:asc');
  const params = [clinicId];
  const filters = ['p.clinic_id = $1'];

  const sex = parseEnum(queryParams.sex, 'sex', SEX_VALUES);
  if (sex) {
    params.push(sex);
    filters.push(`p.sex = $${params.length}`);
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
    `SELECT COUNT(*)::int AS total FROM patients p WHERE ${where}`,
    params
  );

  params.push(limit, offset);
  const { rows } = await query(
    `
      SELECT p.*
        FROM patients p
       WHERE ${where}
       ORDER BY ${sort}
       LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `,
    params
  );

  return {
    data: rows.map(mapPatient),
    pagination: buildPaginationMeta(countResult.rows[0].total, page, limit)
  };
}

/**
 * @param {string} clinicId
 * @param {string} id
 */
export async function getPatientById(clinicId, id) {
  requireUuid(id, 'id');
  const { rows } = await query(
    `SELECT * FROM patients WHERE id = $1 AND clinic_id = $2`,
    [id, clinicId]
  );
  if (!rows[0]) throw new NotFoundError('Patient not found');
  return mapPatient(rows[0]);
}

/**
 * @param {string} clinicId
 * @param {string} mrn
 */
export async function getPatientByMrn(clinicId, mrn) {
  const normalized = requireString(mrn, 'mrn');
  const { rows } = await query(
    `SELECT * FROM patients WHERE clinic_id = $1 AND mrn = $2`,
    [clinicId, normalized]
  );
  if (!rows[0]) throw new NotFoundError('Patient not found');
  return mapPatient(rows[0]);
}

/**
 * @param {import('express').Request} req
 * @param {Record<string, unknown>} body
 */
export async function createPatient(req, body) {
  const clinicId = req.user.clinicId;
  const mrn = requireString(body.mrn, 'mrn');
  const fullName = requireString(body.fullName, 'fullName');
  const dob = parseDate(body.dob, 'dob');
  const sex = parseEnum(body.sex, 'sex', SEX_VALUES);
  const phone = optionalString(body.phone, 'phone');
  const nationalId = optionalString(body.nationalId, 'nationalId');
  const address = optionalString(body.address, 'address');

  try {
    const { rows } = await query(
      `
        INSERT INTO patients (clinic_id, mrn, full_name, dob, sex, phone, address, national_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [clinicId, mrn, fullName, dob, sex, phone, address, nationalId]
    );

    const patient = mapPatient(rows[0]);
    await auditMutation(req, 'patient', patient.id, 'create', { mrn, fullName });
    return patient;
  } catch (err) {
    if (err.code === '23505') {
      const detail = err.detail || '';
      if (detail.includes('national_id')) {
        throw new ConflictError('A patient with this national ID already exists', { nationalId });
      }
      throw new ConflictError('A patient with this MRN already exists', { mrn });
    }
    throw err;
  }
}

/**
 * @param {import('express').Request} req
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function updatePatient(req, id, body) {
  requireUuid(id, 'id');
  const clinicId = req.user.clinicId;
  const existing = await getPatientById(clinicId, id);

  const revision = body.revision != null ? Number(body.revision) : existing.revision;
  if (Number.isNaN(revision)) {
    throw new ValidationError('revision must be a number');
  }

  const mrn = body.mrn != null ? requireString(body.mrn, 'mrn') : existing.mrn;
  const fullName = body.fullName != null ? requireString(body.fullName, 'fullName') : existing.fullName;
  const dob = body.dob !== undefined ? parseDate(body.dob, 'dob') : existing.dob;
  const sex = body.sex !== undefined ? parseEnum(body.sex, 'sex', SEX_VALUES) : existing.sex;
  const phone = body.phone !== undefined ? optionalString(body.phone, 'phone') : existing.phone;
  const address = body.address !== undefined ? optionalString(body.address, 'address') : existing.address;
  const nationalId = body.nationalId !== undefined
    ? optionalString(body.nationalId, 'nationalId')
    : existing.nationalId;

  try {
    const { rows } = await query(
      `
        UPDATE patients
           SET mrn = $3,
               full_name = $4,
               dob = $5,
               sex = $6,
               phone = $7,
               address = $8,
               national_id = $9,
               revision = revision + 1
         WHERE id = $1
           AND clinic_id = $2
           AND revision = $10
        RETURNING *
      `,
      [id, clinicId, mrn, fullName, dob, sex, phone, address, nationalId, revision]
    );

    if (!rows[0]) {
      const stillExists = await query(
        `SELECT revision FROM patients WHERE id = $1 AND clinic_id = $2`,
        [id, clinicId]
      );
      if (!stillExists.rows[0]) throw new NotFoundError('Patient not found');
      throw new ConflictError('Patient was modified by another user', {
        expectedRevision: revision,
        currentRevision: stillExists.rows[0].revision
      });
    }

    const patient = mapPatient(rows[0]);
    await auditMutation(req, 'patient', patient.id, 'update', {
      before: { mrn: existing.mrn, fullName: existing.fullName },
      after: { mrn, fullName }
    });
    return patient;
  } catch (err) {
    if (err.code === '23505') {
      const detail = err.detail || '';
      if (detail.includes('national_id')) {
        throw new ConflictError('A patient with this national ID already exists', { nationalId });
      }
      throw new ConflictError('A patient with this MRN already exists', { mrn });
    }
    throw err;
  }
}

/**
 * @param {string} clinicId
 * @param {string} patientId
 * @param {Record<string, unknown>} queryParams
 */
export async function listPatientVisits(clinicId, patientId, queryParams) {
  requireUuid(patientId, 'patientId');
  await getPatientById(clinicId, patientId);

  const { page, limit, offset } = parsePagination(queryParams, { defaultLimit: 100 });
  const params = [clinicId, patientId];
  const filters = ['v.clinic_id = $1', 'v.patient_id = $2'];

  const status = parseEnum(queryParams.status, 'status', ['draft', 'finalized', 'cancelled']);
  if (status) {
    params.push(status);
    filters.push(`v.status = $${params.length}`);
  } else {
    filters.push(`v.status != 'cancelled'`);
  }

  const where = filters.join(' AND ');
  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM visits v WHERE ${where}`,
    params
  );

  params.push(limit, offset);
  const { rows } = await query(
    `
      SELECT v.id, v.visit_date, v.status, v.legacy_local_id, v.revision, v.created_at, v.updated_at
        FROM visits v
       WHERE ${where}
       ORDER BY v.visit_date DESC, v.created_at DESC
       LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `,
    params
  );

  return {
    data: rows.map((r) => ({
      id: r.id,
      visitDate: formatDate(r.visit_date),
      status: r.status,
      legacyLocalId: r.legacy_local_id,
      revision: r.revision,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    })),
    pagination: buildPaginationMeta(countResult.rows[0].total, page, limit)
  };
}

/**
 * Remove a patient row when they have no active (non-cancelled) visits.
 * @param {import('pg').PoolClient} client
 * @param {string} clinicId
 * @param {string} patientId
 * @returns {Promise<boolean>} true when the patient row was deleted
 */
export async function deletePatientIfOrphaned(client, clinicId, patientId) {
  if (!patientId) return false;

  const { rows } = await client.query(
    `
      SELECT COUNT(*)::int AS active_visits
        FROM visits
       WHERE clinic_id = $1
         AND patient_id = $2
         AND status != 'cancelled'
    `,
    [clinicId, patientId]
  );

  if (rows[0].active_visits > 0) return false;

  const { rowCount } = await client.query(
    `DELETE FROM patients WHERE id = $1 AND clinic_id = $2`,
    [patientId, clinicId]
  );
  return rowCount > 0;
}

/**
 * Remove patient rows that only have cancelled visits (or no visits).
 * @param {string} clinicId
 */
export async function purgeOrphanPatients(clinicId) {
  await query(
    `
      DELETE FROM patients p
       WHERE p.clinic_id = $1
         AND NOT EXISTS (
           SELECT 1
             FROM visits v
            WHERE v.clinic_id = p.clinic_id
              AND v.patient_id = p.id
              AND v.status != 'cancelled'
         )
    `,
    [clinicId]
  );
}

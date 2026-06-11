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
  optionalInt,
  optionalNumber,
  requireUuid,
  formatDate
} from '../core/validation.js';
import { auditMutation } from './auditService.js';

const SORT_FIELDS = {
  fullName: 'kp.full_name',
  status: 'kp.status',
  regDate: 'kp.reg_date',
  updatedAt: 'kp.updated_at',
  kpPatientId: 'kp.kp_patient_id'
};

/**
 * @param {Record<string, unknown>} row
 */
export function mapKeratoplastyPatient(row) {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    kpPatientId: row.kp_patient_id,
    fullName: row.full_name,
    age: row.age,
    gender: row.gender,
    phone: row.phone,
    address: row.address,
    eye: row.eye,
    diagnosis: row.diagnosis,
    procedure: row.procedure,
    prognosis: row.prognosis,
    urgency: row.urgency,
    cornealSizeMm: row.corneal_size_mm != null ? Number(row.corneal_size_mm) : null,
    donorAgePref: row.donor_age_pref,
    endothelialReq: row.endothelial_req,
    infection: row.infection,
    visualAxis: row.visual_axis,
    status: row.status,
    regDate: formatDate(row.reg_date),
    surgeryDate: formatDate(row.surgery_date),
    notes: row.notes,
    recommendedTissueId: row.recommended_tissue_id,
    legacyLocalId: row.legacy_local_id,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * @param {Record<string, unknown>} body
 */
function parseKeratoplastyPatientInput(body) {
  return {
    kpPatientId: optionalString(body.kpPatientId, 'kpPatientId'),
    fullName: body.fullName != null ? requireString(body.fullName, 'fullName') : undefined,
    age: optionalInt(body.age, 'age'),
    gender: optionalString(body.gender, 'gender'),
    phone: optionalString(body.phone, 'phone'),
    address: optionalString(body.address, 'address'),
    eye: optionalString(body.eye, 'eye'),
    diagnosis: optionalString(body.diagnosis, 'diagnosis'),
    procedure: optionalString(body.procedure, 'procedure'),
    prognosis: optionalString(body.prognosis, 'prognosis'),
    urgency: optionalString(body.urgency, 'urgency'),
    cornealSizeMm: optionalNumber(body.cornealSizeMm, 'cornealSizeMm'),
    donorAgePref: optionalString(body.donorAgePref, 'donorAgePref'),
    endothelialReq: optionalInt(body.endothelialReq, 'endothelialReq'),
    infection: optionalString(body.infection, 'infection'),
    visualAxis: optionalString(body.visualAxis, 'visualAxis'),
    status: optionalString(body.status, 'status') || 'Waiting',
    regDate: parseDate(body.regDate, 'regDate'),
    surgeryDate: parseDate(body.surgeryDate, 'surgeryDate'),
    notes: optionalString(body.notes, 'notes'),
    recommendedTissueId: body.recommendedTissueId != null
      ? requireUuid(body.recommendedTissueId, 'recommendedTissueId')
      : null,
    legacyLocalId: optionalInt(body.legacyLocalId, 'legacyLocalId')
  };
}

/**
 * @param {string} clinicId
 */
export async function getKeratoplastyOverview(clinicId) {
  const { rows: pStats } = await query(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'Waiting')::int AS waiting,
        COUNT(*) FILTER (WHERE urgency = 'Emergency')::int AS emergency,
        COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed
      FROM keratoplasty_patients
     WHERE clinic_id = $1
    `,
    [clinicId]
  );

  const { rows: tStats } = await query(
    `
      SELECT
        COUNT(*) FILTER (WHERE tissue_status = 'Available')::int AS available,
        COUNT(*) FILTER (WHERE tissue_status = 'Reserved')::int AS reserved,
        COUNT(*) FILTER (WHERE tissue_status = 'Expired' OR expiry_date < CURRENT_DATE)::int AS expiring
      FROM corneal_tissues
     WHERE clinic_id = $1
    `,
    [clinicId]
  );

  return { patients: pStats[0], tissues: tStats[0] };
}

/**
 * @param {string} clinicId
 * @param {Record<string, unknown>} queryParams
 */
export async function listKeratoplastyPatients(clinicId, queryParams) {
  const { page, limit, offset } = parsePagination(queryParams);
  const sort = parseSort(queryParams.sort, SORT_FIELDS, 'updatedAt:desc');
  const params = [clinicId];
  const filters = ['kp.clinic_id = $1'];

  if (queryParams.status) {
    params.push(String(queryParams.status).trim());
    filters.push(`kp.status = $${params.length}`);
  }

  if (queryParams.urgency) {
    params.push(String(queryParams.urgency).trim());
    filters.push(`kp.urgency = $${params.length}`);
  }

  const search = appendSearch(String(queryParams.q || ''), [
    'kp.kp_patient_id',
    'kp.full_name',
    'kp.phone',
    'kp.diagnosis'
  ], params);
  if (search.clause) {
    filters.push(search.clause);
  }

  const where = filters.join(' AND ');
  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM keratoplasty_patients kp WHERE ${where}`,
    params
  );

  params.push(limit, offset);
  const { rows } = await query(
    `
      SELECT kp.*
        FROM keratoplasty_patients kp
       WHERE ${where}
       ORDER BY ${sort}
       LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `,
    params
  );

  return {
    data: rows.map(mapKeratoplastyPatient),
    pagination: buildPaginationMeta(countResult.rows[0].total, page, limit)
  };
}

/**
 * @param {string} clinicId
 * @param {string} id
 */
export async function getKeratoplastyPatientById(clinicId, id) {
  requireUuid(id, 'id');
  const { rows } = await query(
    `SELECT * FROM keratoplasty_patients WHERE id = $1 AND clinic_id = $2`,
    [id, clinicId]
  );
  if (!rows[0]) throw new NotFoundError('Keratoplasty patient not found');
  return mapKeratoplastyPatient(rows[0]);
}

/**
 * @param {string} clinicId
 */
async function nextKpPatientId(clinicId) {
  const { rows } = await query(
    `
      SELECT kp_patient_id
        FROM keratoplasty_patients
       WHERE clinic_id = $1
       ORDER BY created_at DESC
       LIMIT 1
    `,
    [clinicId]
  );
  const last = rows[0]?.kp_patient_id || 'KP-P-0000';
  const num = parseInt(String(last).replace(/\D/g, ''), 10) || 0;
  return `KP-P-${String(num + 1).padStart(4, '0')}`;
}

/**
 * @param {import('express').Request} req
 * @param {Record<string, unknown>} body
 */
export async function createKeratoplastyPatient(req, body) {
  const clinicId = req.user.clinicId;
  const input = parseKeratoplastyPatientInput(body);

  if (!input.fullName) {
    throw new ValidationError('fullName is required');
  }

  if (!input.kpPatientId) {
    input.kpPatientId = await nextKpPatientId(clinicId);
  }

  try {
    const { rows } = await query(
      `
        INSERT INTO keratoplasty_patients (
          clinic_id, kp_patient_id, full_name, age, gender, phone, address,
          eye, diagnosis, procedure, prognosis, urgency, corneal_size_mm,
          donor_age_pref, endothelial_req, infection, visual_axis, status,
          reg_date, surgery_date, notes, recommended_tissue_id, legacy_local_id
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
        )
        RETURNING *
      `,
      [
        clinicId,
        input.kpPatientId,
        input.fullName,
        input.age,
        input.gender,
        input.phone,
        input.address,
        input.eye,
        input.diagnosis,
        input.procedure,
        input.prognosis,
        input.urgency,
        input.cornealSizeMm,
        input.donorAgePref,
        input.endothelialReq,
        input.infection,
        input.visualAxis,
        input.status,
        input.regDate,
        input.surgeryDate,
        input.notes,
        input.recommendedTissueId,
        input.legacyLocalId
      ]
    );

    const patient = mapKeratoplastyPatient(rows[0]);
    await auditMutation(req, 'keratoplasty_patient', patient.id, 'create', {
      kpPatientId: patient.kpPatientId,
      fullName: patient.fullName
    });
    return patient;
  } catch (err) {
    if (err.code === '23505') {
      throw new ConflictError('Keratoplasty patient ID already exists', {
        kpPatientId: input.kpPatientId
      });
    }
    throw err;
  }
}

/**
 * @param {import('express').Request} req
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function updateKeratoplastyPatient(req, id, body) {
  requireUuid(id, 'id');
  const clinicId = req.user.clinicId;
  const existing = await getKeratoplastyPatientById(clinicId, id);
  const parsed = parseKeratoplastyPatientInput({ ...existing, ...body, fullName: body.fullName ?? existing.fullName });

  const revision = body.revision != null ? Number(body.revision) : existing.revision;
  if (Number.isNaN(revision)) {
    throw new ValidationError('revision must be a number');
  }

  try {
    const { rows } = await query(
      `
        UPDATE keratoplasty_patients
           SET kp_patient_id = $3,
               full_name = $4,
               age = $5,
               gender = $6,
               phone = $7,
               address = $8,
               eye = $9,
               diagnosis = $10,
               procedure = $11,
               prognosis = $12,
               urgency = $13,
               corneal_size_mm = $14,
               donor_age_pref = $15,
               endothelial_req = $16,
               infection = $17,
               visual_axis = $18,
               status = $19,
               reg_date = $20,
               surgery_date = $21,
               notes = $22,
               recommended_tissue_id = $23,
               legacy_local_id = $24,
               revision = revision + 1
         WHERE id = $1
           AND clinic_id = $2
           AND revision = $25
        RETURNING *
      `,
      [
        id,
        clinicId,
        parsed.kpPatientId || existing.kpPatientId,
        parsed.fullName || existing.fullName,
        parsed.age,
        parsed.gender,
        parsed.phone,
        parsed.address,
        parsed.eye,
        parsed.diagnosis,
        parsed.procedure,
        parsed.prognosis,
        parsed.urgency,
        parsed.cornealSizeMm,
        parsed.donorAgePref,
        parsed.endothelialReq,
        parsed.infection,
        parsed.visualAxis,
        parsed.status,
        parsed.regDate,
        parsed.surgeryDate,
        parsed.notes,
        parsed.recommendedTissueId,
        parsed.legacyLocalId ?? existing.legacyLocalId,
        revision
      ]
    );

    if (!rows[0]) {
      throw new ConflictError('Keratoplasty patient was modified by another user', {
        expectedRevision: revision,
        currentRevision: existing.revision
      });
    }

    const patient = mapKeratoplastyPatient(rows[0]);
    await auditMutation(req, 'keratoplasty_patient', id, 'update', {
      status: patient.status
    });
    return patient;
  } catch (err) {
    if (err.code === '23505') {
      throw new ConflictError('Keratoplasty patient ID already exists');
    }
    throw err;
  }
}

/**
 * @param {import('express').Request} req
 * @param {string} id
 */
export async function deleteKeratoplastyPatient(req, id) {
  requireUuid(id, 'id');
  const clinicId = req.user.clinicId;

  const { rowCount } = await query(
    `DELETE FROM keratoplasty_patients WHERE id = $1 AND clinic_id = $2`,
    [id, clinicId]
  );
  if (!rowCount) throw new NotFoundError('Keratoplasty patient not found');

  await auditMutation(req, 'keratoplasty_patient', id, 'delete', {});
  return { success: true };
}

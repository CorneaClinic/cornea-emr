import { query, withTransaction } from '../db/pool.js';
import { NotFoundError, ConflictError, ValidationError } from '../core/errors.js';
import {
  parsePagination,
  buildPaginationMeta,
  parseSort,
  appendSearch,
  optionalString,
  parseDate,
  optionalInt,
  optionalNumber,
  requireUuid,
  formatDate
} from '../core/validation.js';
import { auditMutation } from './auditService.js';
import { getKeratoplastyPatientById } from './keratoplastyPatientService.js';

const SORT_FIELDS = {
  kpTissueId: 'ct.kp_tissue_id',
  tissueStatus: 'ct.tissue_status',
  expiryDate: 'ct.expiry_date',
  updatedAt: 'ct.updated_at'
};

/**
 * @param {Record<string, unknown>} row
 */
export function mapCornealTissue(row) {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    kpTissueId: row.kp_tissue_id,
    donorAge: row.donor_age,
    donorGender: row.donor_gender,
    deathToPreservationHrs: row.death_to_preservation_hrs != null
      ? Number(row.death_to_preservation_hrs)
      : null,
    preservationDate: formatDate(row.preservation_date),
    expiryDate: formatDate(row.expiry_date),
    specularCount: row.specular_count,
    edema: row.edema,
    clarity: row.clarity,
    infectionRisk: row.infection_risk,
    opticalGrade: row.optical_grade,
    therapeuticGrade: row.therapeutic_grade,
    tissueStatus: row.tissue_status,
    storageMedium: row.storage_medium,
    storageLocation: row.storage_location,
    eyeBank: row.eye_bank,
    reservedKpPatientId: row.reserved_kp_patient_id,
    reservedForKpPatientId: row.reserved_for_kp_patient_id,
    legacyLocalId: row.legacy_local_id,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * @param {Record<string, unknown>} body
 */
function parseCornealTissueInput(body) {
  return {
    kpTissueId: optionalString(body.kpTissueId, 'kpTissueId'),
    donorAge: optionalInt(body.donorAge, 'donorAge'),
    donorGender: optionalString(body.donorGender, 'donorGender'),
    deathToPreservationHrs: optionalNumber(body.deathToPreservationHrs, 'deathToPreservationHrs'),
    preservationDate: parseDate(body.preservationDate, 'preservationDate'),
    expiryDate: parseDate(body.expiryDate, 'expiryDate'),
    specularCount: optionalInt(body.specularCount, 'specularCount'),
    edema: optionalString(body.edema, 'edema'),
    clarity: optionalString(body.clarity, 'clarity'),
    infectionRisk: optionalString(body.infectionRisk, 'infectionRisk'),
    opticalGrade: optionalString(body.opticalGrade, 'opticalGrade'),
    therapeuticGrade: optionalString(body.therapeuticGrade, 'therapeuticGrade'),
    tissueStatus: optionalString(body.tissueStatus, 'tissueStatus') || 'Available',
    storageMedium: optionalString(body.storageMedium, 'storageMedium'),
    storageLocation: optionalString(body.storageLocation, 'storageLocation'),
    eyeBank: optionalString(body.eyeBank, 'eyeBank'),
    reservedKpPatientId: body.reservedKpPatientId != null
      ? requireUuid(body.reservedKpPatientId, 'reservedKpPatientId')
      : null,
    reservedForKpPatientId: optionalString(body.reservedForKpPatientId, 'reservedForKpPatientId'),
    legacyLocalId: optionalInt(body.legacyLocalId, 'legacyLocalId')
  };
}

/**
 * @param {string} clinicId
 */
async function nextKpTissueId(clinicId) {
  const { rows } = await query(
    `
      SELECT kp_tissue_id
        FROM corneal_tissues
       WHERE clinic_id = $1
       ORDER BY created_at DESC
       LIMIT 1
    `,
    [clinicId]
  );
  const last = rows[0]?.kp_tissue_id || 'KP-T-0000';
  const num = parseInt(String(last).replace(/\D/g, ''), 10) || 0;
  return `KP-T-${String(num + 1).padStart(4, '0')}`;
}

/**
 * @param {string} clinicId
 * @param {Record<string, unknown>} queryParams
 */
export async function listCornealTissues(clinicId, queryParams) {
  const { page, limit, offset } = parsePagination(queryParams);
  const sort = parseSort(queryParams.sort, SORT_FIELDS, 'updatedAt:desc');
  const params = [clinicId];
  const filters = ['ct.clinic_id = $1'];

  if (queryParams.tissueStatus) {
    params.push(String(queryParams.tissueStatus).trim());
    filters.push(`ct.tissue_status = $${params.length}`);
  }

  if (queryParams.available === 'true') {
    filters.push(`ct.tissue_status = 'Available'`);
  }

  if (queryParams.expiringBefore) {
    const date = parseDate(queryParams.expiringBefore, 'expiringBefore');
    if (date) {
      params.push(date);
      filters.push(`ct.expiry_date IS NOT NULL AND ct.expiry_date <= $${params.length}`);
    }
  }

  const search = appendSearch(String(queryParams.q || ''), [
    'ct.kp_tissue_id',
    'ct.eye_bank',
    'ct.storage_location'
  ], params);
  if (search.clause) {
    filters.push(search.clause);
  }

  const where = filters.join(' AND ');
  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM corneal_tissues ct WHERE ${where}`,
    params
  );

  params.push(limit, offset);
  const { rows } = await query(
    `
      SELECT ct.*
        FROM corneal_tissues ct
       WHERE ${where}
       ORDER BY ${sort}
       LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `,
    params
  );

  return {
    data: rows.map(mapCornealTissue),
    pagination: buildPaginationMeta(countResult.rows[0].total, page, limit)
  };
}

/**
 * @param {string} clinicId
 * @param {string} id
 */
export async function getCornealTissueById(clinicId, id) {
  requireUuid(id, 'id');
  const { rows } = await query(
    `SELECT * FROM corneal_tissues WHERE id = $1 AND clinic_id = $2`,
    [id, clinicId]
  );
  if (!rows[0]) throw new NotFoundError('Corneal tissue not found');
  return mapCornealTissue(rows[0]);
}

/**
 * @param {import('express').Request} req
 * @param {Record<string, unknown>} body
 */
export async function createCornealTissue(req, body) {
  const clinicId = req.user.clinicId;
  const input = parseCornealTissueInput(body);

  if (!input.kpTissueId) {
    input.kpTissueId = await nextKpTissueId(clinicId);
  }

  try {
    const { rows } = await query(
      `
        INSERT INTO corneal_tissues (
          clinic_id, kp_tissue_id, donor_age, donor_gender, death_to_preservation_hrs,
          preservation_date, expiry_date, specular_count, edema, clarity, infection_risk,
          optical_grade, therapeutic_grade, tissue_status, storage_medium,
          storage_location, eye_bank, reserved_kp_patient_id, reserved_for_kp_patient_id,
          legacy_local_id
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
        )
        RETURNING *
      `,
      [
        clinicId,
        input.kpTissueId,
        input.donorAge,
        input.donorGender,
        input.deathToPreservationHrs,
        input.preservationDate,
        input.expiryDate,
        input.specularCount,
        input.edema,
        input.clarity,
        input.infectionRisk,
        input.opticalGrade,
        input.therapeuticGrade,
        input.tissueStatus,
        input.storageMedium,
        input.storageLocation,
        input.eyeBank,
        input.reservedKpPatientId,
        input.reservedForKpPatientId,
        input.legacyLocalId
      ]
    );

    const tissue = mapCornealTissue(rows[0]);
    await auditMutation(req, 'corneal_tissue', tissue.id, 'create', {
      kpTissueId: tissue.kpTissueId
    });
    return tissue;
  } catch (err) {
    if (err.code === '23505') {
      throw new ConflictError('Corneal tissue ID already exists', { kpTissueId: input.kpTissueId });
    }
    throw err;
  }
}

/**
 * @param {import('express').Request} req
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function updateCornealTissue(req, id, body) {
  requireUuid(id, 'id');
  const clinicId = req.user.clinicId;
  const existing = await getCornealTissueById(clinicId, id);
  const input = parseCornealTissueInput({ ...existing, ...body });

  const revision = body.revision != null ? Number(body.revision) : existing.revision;
  if (Number.isNaN(revision)) {
    throw new ValidationError('revision must be a number');
  }

  try {
    const { rows } = await query(
      `
        UPDATE corneal_tissues
           SET kp_tissue_id = $3,
               donor_age = $4,
               donor_gender = $5,
               death_to_preservation_hrs = $6,
               preservation_date = $7,
               expiry_date = $8,
               specular_count = $9,
               edema = $10,
               clarity = $11,
               infection_risk = $12,
               optical_grade = $13,
               therapeutic_grade = $14,
               tissue_status = $15,
               storage_medium = $16,
               storage_location = $17,
               eye_bank = $18,
               reserved_kp_patient_id = $19,
               reserved_for_kp_patient_id = $20,
               legacy_local_id = $21,
               revision = revision + 1
         WHERE id = $1
           AND clinic_id = $2
           AND revision = $22
        RETURNING *
      `,
      [
        id,
        clinicId,
        input.kpTissueId || existing.kpTissueId,
        input.donorAge,
        input.donorGender,
        input.deathToPreservationHrs,
        input.preservationDate,
        input.expiryDate,
        input.specularCount,
        input.edema,
        input.clarity,
        input.infectionRisk,
        input.opticalGrade,
        input.therapeuticGrade,
        input.tissueStatus,
        input.storageMedium,
        input.storageLocation,
        input.eyeBank,
        input.reservedKpPatientId,
        input.reservedForKpPatientId,
        input.legacyLocalId ?? existing.legacyLocalId,
        revision
      ]
    );

    if (!rows[0]) {
      throw new ConflictError('Corneal tissue was modified by another user', {
        expectedRevision: revision,
        currentRevision: existing.revision
      });
    }

    const tissue = mapCornealTissue(rows[0]);
    await auditMutation(req, 'corneal_tissue', id, 'update', {
      tissueStatus: tissue.tissueStatus
    });
    return tissue;
  } catch (err) {
    if (err.code === '23505') {
      throw new ConflictError('Corneal tissue ID already exists');
    }
    throw err;
  }
}

/**
 * @param {import('express').Request} req
 * @param {string} tissueId
 * @param {Record<string, unknown>} body
 */
export async function reserveCornealTissue(req, tissueId, body) {
  requireUuid(tissueId, 'tissueId');
  const clinicId = req.user.clinicId;
  const kpPatientId = requireUuid(body.kpPatientId, 'kpPatientId');

  const result = await withTransaction(async (client) => {
    const patientRes = await client.query(
      `SELECT * FROM keratoplasty_patients WHERE id = $1 AND clinic_id = $2 FOR UPDATE`,
      [kpPatientId, clinicId]
    );
    const tissueRes = await client.query(
      `SELECT * FROM corneal_tissues WHERE id = $1 AND clinic_id = $2 FOR UPDATE`,
      [tissueId, clinicId]
    );

    if (!patientRes.rows[0] || !tissueRes.rows[0]) {
      throw new NotFoundError('Keratoplasty patient or corneal tissue not found');
    }

    const tissue = tissueRes.rows[0];
    const patient = patientRes.rows[0];

    if (tissue.tissue_status !== 'Available') {
      throw new ConflictError('Tissue is not available for reservation', {
        tissueStatus: tissue.tissue_status
      });
    }

    await client.query(
      `
        UPDATE corneal_tissues
           SET tissue_status = 'Reserved',
               reserved_kp_patient_id = $2,
               reserved_for_kp_patient_id = $3,
               revision = revision + 1
         WHERE id = $1
      `,
      [tissueId, patient.id, patient.kp_patient_id]
    );

    await client.query(
      `
        UPDATE keratoplasty_patients
           SET status = 'Matched',
               recommended_tissue_id = $2,
               revision = revision + 1
         WHERE id = $1
      `,
      [patient.id, tissueId]
    );

    return { patientId: patient.id, tissueId };
  });

  await auditMutation(req, 'corneal_tissue', tissueId, 'reserve', {
    kpPatientId: result.patientId,
    kpTissueId: tissueId
  });

  return {
    success: true,
    tissueId,
    kpPatientId: result.patientId
  };
}

/**
 * @param {import('express').Request} req
 * @param {string} tissueId
 */
export async function releaseCornealTissue(req, tissueId) {
  requireUuid(tissueId, 'tissueId');
  const clinicId = req.user.clinicId;

  const result = await withTransaction(async (client) => {
    const tissueRes = await client.query(
      `SELECT * FROM corneal_tissues WHERE id = $1 AND clinic_id = $2 FOR UPDATE`,
      [tissueId, clinicId]
    );
    if (!tissueRes.rows[0]) {
      throw new NotFoundError('Corneal tissue not found');
    }

    const tissue = tissueRes.rows[0];
    const reservedPatientId = tissue.reserved_kp_patient_id;

    await client.query(
      `
        UPDATE corneal_tissues
           SET tissue_status = 'Available',
               reserved_kp_patient_id = NULL,
               reserved_for_kp_patient_id = NULL,
               revision = revision + 1
         WHERE id = $1
      `,
      [tissueId]
    );

    if (reservedPatientId) {
      await client.query(
        `
          UPDATE keratoplasty_patients
             SET recommended_tissue_id = NULL,
                 status = CASE WHEN status = 'Matched' THEN 'Waiting' ELSE status END,
                 revision = revision + 1
           WHERE id = $1
        `,
        [reservedPatientId]
      );
    }

    return { reservedPatientId };
  });

  await auditMutation(req, 'corneal_tissue', tissueId, 'release', {
    previousPatientId: result.reservedPatientId
  });

  return { success: true };
}

import { query, withTransaction } from '../db/pool.js';
import { NotFoundError, ValidationError } from '../core/errors.js';
import {
  optionalString,
  optionalInt,
  requireUuid
} from '../core/validation.js';
import { auditMutation } from './auditService.js';
import { assertVisitAccessible } from './visitService.js';

/**
 * @param {Record<string, unknown>} row
 */
export function mapPrescription(row) {
  return {
    id: row.id,
    visitId: row.visit_id,
    clinicId: row.clinic_id,
    sortOrder: row.sort_order,
    eye: row.eye,
    drugName: row.drug_name,
    route: row.route,
    duration: row.duration,
    frequency: row.frequency,
    form: row.form,
    instruction: row.instruction,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * @param {Record<string, unknown>} body
 */
function parsePrescriptionInput(body) {
  return {
    sortOrder: optionalInt(body.sortOrder, 'sortOrder') ?? 0,
    eye: optionalString(body.eye, 'eye'),
    drugName: optionalString(body.drugName, 'drugName'),
    route: optionalString(body.route, 'route'),
    duration: optionalString(body.duration, 'duration'),
    frequency: optionalString(body.frequency, 'frequency'),
    form: optionalString(body.form, 'form'),
    instruction: optionalString(body.instruction, 'instruction')
  };
}

/**
 * @param {string} clinicId
 * @param {string} visitId
 */
export async function listPrescriptions(clinicId, visitId) {
  await assertVisitAccessible(clinicId, visitId);

  const { rows } = await query(
    `
      SELECT *
        FROM prescriptions
       WHERE clinic_id = $1 AND visit_id = $2
       ORDER BY sort_order ASC, created_at ASC
    `,
    [clinicId, visitId]
  );

  return { data: rows.map(mapPrescription) };
}

/**
 * @param {string} clinicId
 * @param {string} id
 */
export async function getPrescriptionById(clinicId, id) {
  requireUuid(id, 'id');
  const { rows } = await query(
    `SELECT * FROM prescriptions WHERE id = $1 AND clinic_id = $2`,
    [id, clinicId]
  );
  if (!rows[0]) throw new NotFoundError('Prescription not found');
  return mapPrescription(rows[0]);
}

/**
 * @param {import('express').Request} req
 * @param {string} visitId
 * @param {Record<string, unknown>} body
 */
export async function createPrescription(req, visitId, body) {
  const clinicId = req.user.clinicId;
  await assertVisitAccessible(clinicId, visitId);

  const input = parsePrescriptionInput(body);
  if (input.sortOrder < 0) {
    throw new ValidationError('sortOrder must be >= 0');
  }

  const { rows } = await query(
    `
      INSERT INTO prescriptions (
        visit_id, clinic_id, sort_order, eye, drug_name,
        route, duration, frequency, form, instruction
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
    [
      visitId,
      clinicId,
      input.sortOrder,
      input.eye,
      input.drugName,
      input.route,
      input.duration,
      input.frequency,
      input.form,
      input.instruction
    ]
  );

  const prescription = mapPrescription(rows[0]);
  await auditMutation(req, 'prescription', prescription.id, 'create', {
    visitId,
    drugName: input.drugName
  });
  return prescription;
}

/**
 * @param {import('express').Request} req
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function updatePrescription(req, id, body) {
  const clinicId = req.user.clinicId;
  const existing = await getPrescriptionById(clinicId, id);
  await assertVisitAccessible(clinicId, existing.visitId);

  const input = parsePrescriptionInput({ ...existing, ...body });
  if (input.sortOrder < 0) {
    throw new ValidationError('sortOrder must be >= 0');
  }

  const { rows } = await query(
    `
      UPDATE prescriptions
         SET sort_order = $3,
             eye = $4,
             drug_name = $5,
             route = $6,
             duration = $7,
             frequency = $8,
             form = $9,
             instruction = $10
       WHERE id = $1 AND clinic_id = $2
      RETURNING *
    `,
    [
      id,
      clinicId,
      input.sortOrder,
      input.eye,
      input.drugName,
      input.route,
      input.duration,
      input.frequency,
      input.form,
      input.instruction
    ]
  );

  const prescription = mapPrescription(rows[0]);
  await auditMutation(req, 'prescription', id, 'update', {
    visitId: existing.visitId,
    before: { drugName: existing.drugName },
    after: { drugName: input.drugName }
  });
  return prescription;
}

/**
 * @param {import('express').Request} req
 * @param {string} id
 */
export async function deletePrescription(req, id) {
  const clinicId = req.user.clinicId;
  const existing = await getPrescriptionById(clinicId, id);

  const { rowCount } = await query(
    `DELETE FROM prescriptions WHERE id = $1 AND clinic_id = $2`,
    [id, clinicId]
  );
  if (!rowCount) throw new NotFoundError('Prescription not found');

  await auditMutation(req, 'prescription', id, 'delete', { visitId: existing.visitId });
  return { success: true };
}

/**
 * @param {import('express').Request} req
 * @param {string} visitId
 * @param {unknown[]} items
 */
export async function replacePrescriptions(req, visitId, items) {
  const clinicId = req.user.clinicId;
  await assertVisitAccessible(clinicId, visitId);

  if (!Array.isArray(items)) {
    throw new ValidationError('items must be an array');
  }

  const parsed = items.map((item, index) => {
    const input = parsePrescriptionInput(item || {});
    return { ...input, sortOrder: input.sortOrder ?? index };
  });

  const data = await withTransaction(async (client) => {
    await client.query(
      `DELETE FROM prescriptions WHERE visit_id = $1 AND clinic_id = $2`,
      [visitId, clinicId]
    );

    const created = [];
    for (const input of parsed) {
      const result = await client.query(
        `
          INSERT INTO prescriptions (
            visit_id, clinic_id, sort_order, eye, drug_name,
            route, duration, frequency, form, instruction
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `,
        [
          visitId,
          clinicId,
          input.sortOrder,
          input.eye,
          input.drugName,
          input.route,
          input.duration,
          input.frequency,
          input.form,
          input.instruction
        ]
      );
      created.push(mapPrescription(result.rows[0]));
    }
    return created;
  });

  await auditMutation(req, 'prescription', visitId, 'bulk_replace', {
    visitId,
    count: data.length
  });

  return { data };
}

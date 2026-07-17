import { query } from '../db/pool.js';
import { NotFoundError, ValidationError } from '../core/errors.js';
import {
  requireString,
  optionalString,
  parseDate,
  optionalInt,
  requireUuid,
  formatDate
} from '../core/validation.js';
import { auditMutation } from './auditService.js';

const STATUSES = ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled'];
const PROCEDURE_TYPES = [
  'PK', 'DALK', 'DSEK', 'DMEK', 'DSAEK', 'CXL', 'PTERYGIUM', 'AMNIOTIC_MEMBRANE',
  'CORNEAL_BIOPSY', 'GLAUCOMA_TUBE', 'OTHER'
];

export function mapOrCase(row) {
  return {
    id: row.id,
    caseNumber: row.case_number,
    appointmentId: row.appointment_id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    patientMrn: row.patient_mrn,
    procedureDate: formatDate(row.procedure_date),
    startTime: row.start_time ? String(row.start_time).slice(0, 5) : null,
    durationMinutes: row.duration_minutes,
    procedureType: row.procedure_type,
    surgeonName: row.surgeon_name,
    theatre: row.theatre,
    status: row.status,
    preopChecklist: row.preop_checklist || {},
    notes: row.notes,
    revision: row.revision
  };
}

async function nextCaseNumber(clinicId) {
  const { rows } = await query(
    `SELECT case_number FROM or_schedule_cases WHERE clinic_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [clinicId]
  );
  const prev = rows[0]?.case_number || 'OR-0000';
  const n = (parseInt(String(prev).match(/(\d+)$/)?.[1] || '0', 10) || 0) + 1;
  return `OR-${String(n).padStart(4, '0')}`;
}

export async function listOrCasesByDay(clinicId, dateStr) {
  const date = parseDate(dateStr, 'date', true);
  const { rows } = await query(
    `
      SELECT * FROM or_schedule_cases
      WHERE clinic_id = $1 AND procedure_date = $2 AND status <> 'cancelled'
      ORDER BY start_time NULLS LAST, case_number
    `,
    [clinicId, date]
  );
  return rows.map(mapOrCase);
}

export async function getOrCaseById(clinicId, id) {
  const { rows } = await query(
    `SELECT * FROM or_schedule_cases WHERE id = $1 AND clinic_id = $2`,
    [id, clinicId]
  );
  if (!rows[0]) throw new NotFoundError('OR case not found');
  return mapOrCase(rows[0]);
}

export async function createOrCase(req, body) {
  const clinicId = req.user.clinicId;
  const userId = req.user.sub;
  const patientName = requireString(body.patientName, 'patientName');
  const procedureDate = parseDate(body.procedureDate, 'procedureDate', true);
  const procedureType = requireString(body.procedureType, 'procedureType');
  if (!PROCEDURE_TYPES.includes(procedureType) && procedureType !== 'OTHER') {
    // allow free text mapped to OTHER
  }
  const status = optionalString(body.status, 'status') || 'scheduled';
  if (!STATUSES.includes(status)) throw new ValidationError('Invalid status');

  const caseNumber = await nextCaseNumber(clinicId);
  const patientId = body.patientId ? requireUuid(body.patientId, 'patientId') : null;

  const { rows } = await query(
    `
      INSERT INTO or_schedule_cases (
        clinic_id, case_number, appointment_id, patient_id, patient_name, patient_mrn,
        procedure_date, start_time, duration_minutes, procedure_type, surgeon_name,
        theatre, status, preop_checklist, notes, created_by, updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)
      RETURNING *
    `,
    [
      clinicId,
      caseNumber,
      optionalString(body.appointmentId, 'appointmentId'),
      patientId,
      patientName,
      optionalString(body.patientMrn, 'patientMrn'),
      procedureDate,
      body.startTime || null,
      optionalInt(body.durationMinutes, 'durationMinutes') ?? 60,
      procedureType,
      optionalString(body.surgeonName, 'surgeonName'),
      optionalString(body.theatre, 'theatre'),
      status,
      body.preopChecklist && typeof body.preopChecklist === 'object' ? body.preopChecklist : {},
      optionalString(body.notes, 'notes'),
      userId
    ]
  );
  await auditMutation(req, 'or_schedule.create', { entityId: rows[0].id, caseNumber });
  return mapOrCase(rows[0]);
}

export async function updateOrCase(req, id, body) {
  const clinicId = req.user.clinicId;
  const userId = req.user.sub;
  const existing = await getOrCaseById(clinicId, id);
  const revision = optionalInt(body.revision, 'revision') ?? existing.revision;
  if (revision !== existing.revision) {
    throw new ValidationError('Revision conflict — refresh and retry');
  }
  const status = body.status != null ? String(body.status) : existing.status;
  if (!STATUSES.includes(status)) throw new ValidationError('Invalid status');

  const { rows } = await query(
    `
      UPDATE or_schedule_cases SET
        patient_name = COALESCE($3, patient_name),
        patient_mrn = COALESCE($4, patient_mrn),
        procedure_date = COALESCE($5, procedure_date),
        start_time = COALESCE($6, start_time),
        duration_minutes = COALESCE($7, duration_minutes),
        procedure_type = COALESCE($8, procedure_type),
        surgeon_name = COALESCE($9, surgeon_name),
        theatre = COALESCE($10, theatre),
        status = $11,
        preop_checklist = COALESCE($12, preop_checklist),
        notes = COALESCE($13, notes),
        revision = revision + 1,
        updated_by = $14
      WHERE id = $1 AND clinic_id = $2
      RETURNING *
    `,
    [
      id,
      clinicId,
      body.patientName,
      body.patientMrn,
      body.procedureDate ? parseDate(body.procedureDate, 'procedureDate', true) : null,
      body.startTime,
      optionalInt(body.durationMinutes, 'durationMinutes'),
      body.procedureType,
      body.surgeonName,
      body.theatre,
      status,
      body.preopChecklist,
      body.notes,
      userId
    ]
  );
  await auditMutation(req, 'or_schedule.update', { entityId: id });
  return mapOrCase(rows[0]);
}

function timeToMinutes(value) {
  if (!value) return null;
  const [h, m] = String(value).slice(0, 5).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function rangesOverlap(startA, durA, startB, durB) {
  if (startA == null || startB == null) return true;
  const endA = startA + (durA || 60);
  const endB = startB + (durB || 60);
  return startA < endB && startB < endA;
}

/** Prevent double-booking theatre or surgeon on the same day. */
export async function checkOrScheduleConflict(clinicId, opts = {}) {
  const date = parseDate(opts.procedureDate, 'procedureDate', true);
  const theatre = optionalString(opts.theatre, 'theatre');
  const surgeonName = optionalString(opts.surgeonName, 'surgeonName');
  const startMin = timeToMinutes(opts.startTime);
  const duration = optionalInt(opts.durationMinutes, 'durationMinutes') ?? 60;
  const excludeCaseId = opts.excludeCaseId ? requireUuid(opts.excludeCaseId, 'excludeCaseId') : null;

  if (!theatre && !surgeonName) return null;

  const { rows } = await query(
    `
      SELECT id, case_number, theatre, surgeon_name, start_time, duration_minutes
      FROM or_schedule_cases
      WHERE clinic_id = $1
        AND procedure_date = $2
        AND status <> 'cancelled'
        AND ($3::uuid IS NULL OR id <> $3)
        AND (
          ($4::text IS NOT NULL AND theatre = $4)
          OR ($5::text IS NOT NULL AND surgeon_name = $5)
        )
    `,
    [clinicId, date, excludeCaseId, theatre, surgeonName]
  );

  for (const row of rows) {
    const otherStart = timeToMinutes(row.start_time);
    if (rangesOverlap(startMin, duration, otherStart, row.duration_minutes)) {
      const who =
        theatre && row.theatre === theatre
          ? `theatre ${theatre}`
          : `surgeon ${surgeonName || row.surgeon_name}`;
      throw new ValidationError(
        `Schedule conflict: ${who} already booked on ${date} (${row.case_number}).`
      );
    }
  }
  return null;
}

export { PROCEDURE_TYPES, STATUSES };

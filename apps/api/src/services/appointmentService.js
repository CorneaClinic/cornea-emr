import { query } from '../db/pool.js';
import { NotFoundError, ValidationError, ConflictError } from '../core/errors.js';
import {
  requireString,
  optionalString,
  parseDate,
  parseEnum,
  requireUuid,
  optionalInt,
  formatDate
} from '../core/validation.js';
import { auditMutation } from './auditService.js';
import { getPatientById } from './patientService.js';

const TYPE_VALUES = ['visit', 'recall', 'procedure', 'review'];
const STATUS_VALUES = ['scheduled', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show'];
const ACTIVE_STATUSES = ['scheduled', 'confirmed', 'arrived'];

export function mapAppointment(row) {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    appointmentId: row.appointment_id,
    patientId: row.patient_id,
    patientMrn: row.patient_mrn,
    patientName: row.patient_name,
    patientPhone: row.patient_phone,
    appointmentDate: formatDate(row.appointment_date),
    startTime: row.start_time ? String(row.start_time).slice(0, 5) : null,
    durationMinutes: row.duration_minutes,
    appointmentType: row.appointment_type,
    station: row.station,
    status: row.status,
    reason: row.reason,
    recallSourceVisitId: row.recall_source_visit_id,
    notes: row.notes,
    legacyLocalId: row.legacy_local_id,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function nextAppointmentId(clinicId) {
  const { rows } = await query(
    `
      SELECT appointment_id FROM appointments
       WHERE clinic_id = $1 AND appointment_id ~ '^APPT-[0-9]+$'
       ORDER BY CAST(SUBSTRING(appointment_id FROM 6) AS INTEGER) DESC
       LIMIT 1
    `,
    [clinicId]
  );
  const last = rows[0]?.appointment_id;
  const n = last ? parseInt(last.replace('APPT-', ''), 10) + 1 : 1;
  return `APPT-${String(n).padStart(4, '0')}`;
}

async function assertAppointment(clinicId, id) {
  requireUuid(id, 'id');
  const { rows } = await query(
    `SELECT * FROM appointments WHERE id = $1 AND clinic_id = $2`,
    [id, clinicId]
  );
  if (!rows[0]) throw new NotFoundError('Appointment not found');
  return rows[0];
}

function parseAppointmentInput(body, partial = false) {
  const input = {};
  if (!partial || body.patientName != null) {
    input.patientName = requireString(body.patientName, 'patientName');
  }
  if (!partial || body.appointmentDate != null) {
    input.appointmentDate = parseDate(body.appointmentDate, 'appointmentDate');
    if (!input.appointmentDate) throw new ValidationError('appointmentDate is required');
  }
  if (body.patientId != null) input.patientId = body.patientId ? requireUuid(body.patientId, 'patientId') : null;
  if (body.patientMrn != null) input.patientMrn = optionalString(body.patientMrn, 'patientMrn');
  if (body.patientPhone != null) input.patientPhone = optionalString(body.patientPhone, 'patientPhone');
  if (body.startTime != null) input.startTime = optionalString(body.startTime, 'startTime');
  if (body.durationMinutes != null) input.durationMinutes = optionalInt(body.durationMinutes, 'durationMinutes') || 15;
  if (body.appointmentType != null) input.appointmentType = parseEnum(body.appointmentType, 'appointmentType', TYPE_VALUES) || 'visit';
  if (body.station != null) input.station = optionalString(body.station, 'station');
  if (body.status != null) input.status = parseEnum(body.status, 'status', STATUS_VALUES) || 'scheduled';
  if (body.reason != null) input.reason = optionalString(body.reason, 'reason');
  if (body.recallSourceVisitId != null) {
    input.recallSourceVisitId = body.recallSourceVisitId
      ? requireUuid(body.recallSourceVisitId, 'recallSourceVisitId')
      : null;
  }
  if (body.notes != null) input.notes = optionalString(body.notes, 'notes');
  if (body.legacyLocalId != null) input.legacyLocalId = optionalInt(body.legacyLocalId, 'legacyLocalId');
  return input;
}

export async function listAppointmentsByDay(clinicId, dateStr) {
  const day = parseDate(dateStr, 'date');
  if (!day) throw new ValidationError('Valid date is required');

  const { rows } = await query(
    `
      SELECT * FROM appointments
       WHERE clinic_id = $1 AND appointment_date = $2
       ORDER BY start_time ASC NULLS LAST, patient_name ASC
    `,
    [clinicId, day]
  );

  return {
    date: day,
    data: rows.map(mapAppointment)
  };
}

export async function getRecallQueue(clinicId, queryParams = {}) {
  const days = Math.min(Math.max(parseInt(queryParams.days, 10) || 30, 1), 180);

  const [dueFollowups, recallAppointments] = await Promise.all([
    query(
      `
        SELECT
          f.visit_id,
          f.follow_up_date,
          f.purpose,
          f.severity,
          f.remarks,
          v.visit_date,
          p.id AS patient_id,
          p.mrn,
          p.full_name,
          p.phone
        FROM followups f
        JOIN visits v ON v.id = f.visit_id AND v.clinic_id = f.clinic_id
        JOIN patients p ON p.id = v.patient_id
       WHERE f.clinic_id = $1
         AND f.follow_up_date IS NOT NULL
         AND f.follow_up_date <= CURRENT_DATE + ($2::int * INTERVAL '1 day')
         AND NOT EXISTS (
           SELECT 1 FROM appointments a
            WHERE a.clinic_id = f.clinic_id
              AND a.patient_id = p.id
              AND a.appointment_date >= f.follow_up_date
              AND a.status = ANY($3::text[])
         )
       ORDER BY f.follow_up_date ASC
       LIMIT 200
      `,
      [clinicId, days, ACTIVE_STATUSES]
    ),
    query(
      `
        SELECT * FROM appointments
         WHERE clinic_id = $1
           AND appointment_type = 'recall'
           AND appointment_date <= CURRENT_DATE + ($2::int * INTERVAL '1 day')
           AND status = ANY($3::text[])
         ORDER BY appointment_date ASC, start_time ASC NULLS LAST
         LIMIT 200
      `,
      [clinicId, days, ACTIVE_STATUSES]
    )
  ]);

  return {
    days,
    dueFollowups: dueFollowups.rows.map((r) => ({
      source: 'followup',
      visitId: r.visit_id,
      patientId: r.patient_id,
      patientMrn: r.mrn,
      patientName: r.full_name,
      patientPhone: r.phone,
      dueDate: formatDate(r.follow_up_date),
      lastVisitDate: formatDate(r.visit_date),
      purpose: r.purpose,
      severity: r.severity,
      remarks: r.remarks
    })),
    scheduledRecalls: recallAppointments.rows.map(mapAppointment)
  };
}

export async function getAppointmentById(clinicId, id) {
  return mapAppointment(await assertAppointment(clinicId, id));
}

export async function createAppointment(req, body) {
  const clinicId = req.user.clinicId;
  const payload = { ...body };
  if (payload.patientId && !payload.patientName) {
    const patient = await getPatientById(clinicId, payload.patientId);
    payload.patientName = patient.fullName;
    payload.patientMrn = payload.patientMrn || patient.mrn;
    payload.patientPhone = payload.patientPhone || patient.phone;
  }
  const input = parseAppointmentInput(payload);
  const appointmentId = optionalString(body.appointmentId, 'appointmentId') || await nextAppointmentId(clinicId);

  let patientMrn = input.patientMrn;
  let patientPhone = input.patientPhone;
  if (input.patientId) {
    const patient = await getPatientById(clinicId, input.patientId);
    patientMrn = patient.mrn;
    patientPhone = patientPhone || patient.phone;
    if (!input.patientName) input.patientName = patient.fullName;
  }

  const { rows } = await query(
    `
      INSERT INTO appointments (
        clinic_id, appointment_id, patient_id, patient_mrn, patient_name, patient_phone,
        appointment_date, start_time, duration_minutes, appointment_type, station, status,
        reason, recall_source_visit_id, notes, legacy_local_id, created_by, updated_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17
      )
      RETURNING *
    `,
    [
      clinicId,
      appointmentId,
      input.patientId || null,
      patientMrn || null,
      input.patientName,
      patientPhone || null,
      input.appointmentDate,
      input.startTime || null,
      input.durationMinutes || 15,
      input.appointmentType || 'visit',
      input.station || null,
      input.status || 'scheduled',
      input.reason || null,
      input.recallSourceVisitId || null,
      input.notes || null,
      input.legacyLocalId ?? null,
      req.user.sub || null
    ]
  );

  await auditMutation(req, 'appointment', rows[0].id, 'create', {
    appointmentId,
    appointmentDate: input.appointmentDate,
    patientName: input.patientName
  });
  return mapAppointment(rows[0]);
}

export async function updateAppointment(req, id, body) {
  const clinicId = req.user.clinicId;
  const existing = await assertAppointment(clinicId, id);
  const input = parseAppointmentInput(body, true);

  if (body.revision != null && Number(body.revision) !== existing.revision) {
    throw new ConflictError('Appointment was updated elsewhere; refresh and retry');
  }

  const patientName = input.patientName ?? existing.patient_name;
  const appointmentDate = input.appointmentDate ?? formatDate(existing.appointment_date);
  const startTime = input.startTime !== undefined ? input.startTime : (existing.start_time ? String(existing.start_time).slice(0, 5) : null);
  const durationMinutes = input.durationMinutes ?? existing.duration_minutes;
  const appointmentType = input.appointmentType ?? existing.appointment_type;
  const station = input.station !== undefined ? input.station : existing.station;
  const status = input.status ?? existing.status;
  const reason = input.reason !== undefined ? input.reason : existing.reason;
  const notes = input.notes !== undefined ? input.notes : existing.notes;
  const patientId = input.patientId !== undefined ? input.patientId : existing.patient_id;
  const patientMrn = input.patientMrn !== undefined ? input.patientMrn : existing.patient_mrn;
  const patientPhone = input.patientPhone !== undefined ? input.patientPhone : existing.patient_phone;
  const recallSourceVisitId = input.recallSourceVisitId !== undefined
    ? input.recallSourceVisitId
    : existing.recall_source_visit_id;

  const { rows } = await query(
    `
      UPDATE appointments SET
        patient_id = $3,
        patient_mrn = $4,
        patient_name = $5,
        patient_phone = $6,
        appointment_date = $7,
        start_time = $8,
        duration_minutes = $9,
        appointment_type = $10,
        station = $11,
        status = $12,
        reason = $13,
        recall_source_visit_id = $14,
        notes = $15,
        updated_by = $16,
        revision = revision + 1
       WHERE id = $1 AND clinic_id = $2
       RETURNING *
    `,
    [
      id,
      clinicId,
      patientId,
      patientMrn,
      patientName,
      patientPhone,
      appointmentDate,
      startTime,
      durationMinutes,
      appointmentType,
      station,
      status,
      reason,
      recallSourceVisitId,
      notes,
      req.user.sub || null
    ]
  );

  await auditMutation(req, 'appointment', id, 'update', { status, appointmentDate });
  return mapAppointment(rows[0]);
}

export async function cancelAppointment(req, id) {
  return updateAppointment(req, id, { status: 'cancelled', revision: (await assertAppointment(req.user.clinicId, id)).revision });
}

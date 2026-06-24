import { query } from '../db/pool.js';
import { NotFoundError, ValidationError } from '../core/errors.js';
import {
  optionalString,
  parseDate,
  optionalInt,
  optionalNumber,
  formatDate,
  requireString
} from '../core/validation.js';
import { auditMutation } from './auditService.js';

async function assertKpPatient(clinicId, kpPatientId) {
  const { rows } = await query(
    `SELECT * FROM keratoplasty_patients WHERE id = $1 AND clinic_id = $2`,
    [kpPatientId, clinicId]
  );
  if (!rows[0]) throw new NotFoundError('Keratoplasty patient not found');
  return rows[0];
}

export function mapGraftExam(row) {
  return {
    id: row.id,
    kpPatientId: row.kp_patient_id,
    eye: row.eye,
    examDate: formatDate(row.exam_date),
    postOpInterval: row.post_op_interval,
    bcva: row.bcva,
    iop: row.iop != null ? Number(row.iop) : null,
    endothelialCount: row.endothelial_count,
    graftClarity: row.graft_clarity,
    cctUm: row.cct_um,
    medications: row.medications,
    visitUuid: row.visit_uuid,
    notes: row.notes,
    legacyLocalId: row.legacy_local_id,
    revision: row.revision
  };
}

export function mapRejection(row) {
  return {
    id: row.id,
    kpPatientId: row.kp_patient_id,
    eye: row.eye,
    onsetDate: formatDate(row.onset_date),
    resolvedDate: formatDate(row.resolved_date),
    rejectionGrade: row.rejection_grade,
    rejectionType: row.rejection_type,
    signs: row.signs,
    treatment: row.treatment,
    outcome: row.outcome,
    regraftDate: formatDate(row.regraft_date),
    notes: row.notes,
    legacyLocalId: row.legacy_local_id,
    revision: row.revision
  };
}

export async function getGraftOutcomesOverview(clinicId) {
  const { rows: examStats } = await query(
    `SELECT COUNT(*)::int AS exams FROM kp_post_graft_exams WHERE clinic_id = $1`,
    [clinicId]
  );
  const { rows: rejStats } = await query(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE outcome = 'Active')::int AS active,
        COUNT(*) FILTER (WHERE outcome = 'Resolved')::int AS resolved
      FROM kp_rejection_episodes WHERE clinic_id = $1
    `,
    [clinicId]
  );
  const { rows: graftStats } = await query(
    `
      SELECT COUNT(*) FILTER (WHERE graft_outcome_status = 'Surviving')::int AS surviving,
             COUNT(*) FILTER (WHERE graft_outcome_status = 'Failed')::int AS failed
      FROM keratoplasty_patients WHERE clinic_id = $1 AND status = 'Completed'
    `,
    [clinicId]
  );
  return {
    postGraftExams: examStats[0]?.exams || 0,
    rejectionEpisodes: rejStats[0]?.total || 0,
    activeRejections: rejStats[0]?.active || 0,
    resolvedRejections: rejStats[0]?.resolved || 0,
    survivingGrafts: graftStats[0]?.surviving || 0,
    failedGrafts: graftStats[0]?.failed || 0
  };
}

export async function listGraftExams(clinicId, kpPatientId) {
  await assertKpPatient(clinicId, kpPatientId);
  const { rows } = await query(
    `
      SELECT * FROM kp_post_graft_exams
       WHERE clinic_id = $1 AND kp_patient_id = $2
       ORDER BY exam_date DESC, eye ASC
    `,
    [clinicId, kpPatientId]
  );
  return { data: rows.map(mapGraftExam) };
}

export async function createGraftExam(req, kpPatientId, body) {
  const clinicId = req.user.clinicId;
  await assertKpPatient(clinicId, kpPatientId);
  const eye = requireString(body.eye, 'eye');
  const examDate = parseDate(body.examDate, 'examDate');
  if (!examDate) throw new ValidationError('examDate is required');

  const { rows } = await query(
    `
      INSERT INTO kp_post_graft_exams (
        clinic_id, kp_patient_id, eye, exam_date, post_op_interval, bcva, iop,
        endothelial_count, graft_clarity, cct_um, medications, visit_uuid, notes, legacy_local_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `,
    [
      clinicId, kpPatientId, eye, examDate,
      optionalString(body.postOpInterval, 'postOpInterval'),
      optionalString(body.bcva, 'bcva'),
      optionalNumber(body.iop, 'iop'),
      optionalInt(body.endothelialCount, 'endothelialCount'),
      optionalString(body.graftClarity, 'graftClarity'),
      optionalInt(body.cctUm, 'cctUm'),
      optionalString(body.medications, 'medications'),
      body.visitUuid || null,
      optionalString(body.notes, 'notes'),
      optionalInt(body.legacyLocalId, 'legacyLocalId')
    ]
  );

  await query(
    `UPDATE keratoplasty_patients SET graft_outcome_status = 'Post-op follow-up', revision = revision + 1
      WHERE id = $1 AND clinic_id = $2`,
    [kpPatientId, clinicId]
  );

  await auditMutation(req, {
    action: 'create',
    entityType: 'kp_graft_exam',
    entityId: rows[0].id,
    summary: `Post-graft exam ${eye} ${examDate}`
  });
  return mapGraftExam(rows[0]);
}

export async function listRejections(clinicId, kpPatientId) {
  await assertKpPatient(clinicId, kpPatientId);
  const { rows } = await query(
    `
      SELECT * FROM kp_rejection_episodes
       WHERE clinic_id = $1 AND kp_patient_id = $2
       ORDER BY onset_date DESC
    `,
    [clinicId, kpPatientId]
  );
  return { data: rows.map(mapRejection) };
}

export async function createRejection(req, kpPatientId, body) {
  const clinicId = req.user.clinicId;
  await assertKpPatient(clinicId, kpPatientId);
  const eye = requireString(body.eye, 'eye');
  const onsetDate = parseDate(body.onsetDate, 'onsetDate');
  if (!onsetDate) throw new ValidationError('onsetDate is required');

  const { rows } = await query(
    `
      INSERT INTO kp_rejection_episodes (
        clinic_id, kp_patient_id, eye, onset_date, resolved_date, rejection_grade,
        rejection_type, signs, treatment, outcome, regraft_date, notes, legacy_local_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `,
    [
      clinicId, kpPatientId, eye, onsetDate,
      parseDate(body.resolvedDate, 'resolvedDate'),
      optionalString(body.rejectionGrade, 'rejectionGrade'),
      optionalString(body.rejectionType, 'rejectionType'),
      optionalString(body.signs, 'signs'),
      optionalString(body.treatment, 'treatment'),
      optionalString(body.outcome, 'outcome') || 'Active',
      parseDate(body.regraftDate, 'regraftDate'),
      optionalString(body.notes, 'notes'),
      optionalInt(body.legacyLocalId, 'legacyLocalId')
    ]
  );

  await query(
    `UPDATE keratoplasty_patients SET graft_outcome_status = 'Rejection episode', revision = revision + 1
      WHERE id = $1 AND clinic_id = $2`,
    [kpPatientId, clinicId]
  );

  await auditMutation(req, {
    action: 'create',
    entityType: 'kp_rejection',
    entityId: rows[0].id,
    summary: `Rejection episode ${eye} from ${onsetDate}`
  });
  return mapRejection(rows[0]);
}

export async function getGraftTimeline(clinicId, kpPatientId) {
  const patient = await assertKpPatient(clinicId, kpPatientId);
  const exams = await listGraftExams(clinicId, kpPatientId);
  const rejections = await listRejections(clinicId, kpPatientId);
  const events = [];

  if (patient.surgery_date) {
    events.push({ type: 'surgery', date: formatDate(patient.surgery_date), label: `Transplant — ${patient.procedure || 'procedure'}` });
  }
  for (const e of exams.data) {
    events.push({
      type: 'exam',
      date: e.examDate,
      eye: e.eye,
      label: `Follow-up ${e.eye}: ECD ${e.endothelialCount ?? '—'}, clarity ${e.graftClarity || '—'}`,
      id: e.id
    });
  }
  for (const r of rejections.data) {
    events.push({
      type: 'rejection',
      date: r.onsetDate,
      eye: r.eye,
      label: `Rejection ${r.eye} (${r.rejectionType || r.rejectionGrade || 'episode'}) — ${r.outcome}`,
      id: r.id
    });
  }
  events.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return { patientId: kpPatientId, events };
}

import { query } from '../db/pool.js';
import { NotFoundError, ConflictError } from '../core/errors.js';
import {
  parsePagination,
  buildPaginationMeta,
  appendSearch,
  requireString,
  optionalString,
  parseDate,
  optionalInt,
  optionalNumber,
  formatDate
} from '../core/validation.js';
import { auditMutation } from './auditService.js';
import { computeOsdIndexScore, osdIndexToSeverity } from './dryEyeScoring.js';

export function mapDryEyeCase(row) {
  return {
    id: row.id,
    caseId: row.case_id,
    emrPatientUuid: row.emr_patient_uuid,
    emrPatientMrn: row.emr_patient_mrn,
    fullName: row.full_name,
    primarySubtype: row.primary_subtype,
    status: row.status,
    onsetDate: formatDate(row.onset_date),
    notes: row.notes,
    legacyLocalId: row.legacy_local_id,
    revision: row.revision
  };
}

export function mapDryEyeAssessment(row) {
  return {
    id: row.id,
    caseId: row.case_id,
    assessedAt: formatDate(row.assessed_at),
    tbutOd: row.tbut_od != null ? Number(row.tbut_od) : null,
    tbutOs: row.tbut_os != null ? Number(row.tbut_os) : null,
    schirmerOd: row.schirmer_od != null ? Number(row.schirmer_od) : null,
    schirmerOs: row.schirmer_os != null ? Number(row.schirmer_os) : null,
    osdiScore: row.osdi_score,
    deq5Score: row.deq5_score,
    stainOd: row.stain_od,
    stainOs: row.stain_os,
    mgdGrade: row.mgd_grade,
    blepharitis: row.blepharitis,
    severity: row.severity,
    osdIndexScore: row.osd_index_score,
    treatmentPlan: row.treatment_plan,
    notes: row.notes,
    legacyLocalId: row.legacy_local_id,
    revision: row.revision
  };
}

async function assertCase(clinicId, id) {
  const { rows } = await query(
    `SELECT * FROM dry_eye_cases WHERE id = $1 AND clinic_id = $2`,
    [id, clinicId]
  );
  if (!rows[0]) throw new NotFoundError('Dry eye case not found');
  return rows[0];
}

async function nextCaseId(clinicId) {
  const { rows } = await query(
    `SELECT case_id FROM dry_eye_cases WHERE clinic_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [clinicId]
  );
  const prev = rows[0]?.case_id || 'DE-0000';
  const n = (parseInt(String(prev).match(/(\d+)$/)?.[1] || '0', 10) || 0) + 1;
  return `DE-${String(n).padStart(4, '0')}`;
}

export async function getDryEyeOverview(clinicId) {
  const { rows } = await query(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'Active')::int AS active,
        COUNT(*) FILTER (WHERE status = 'Stable')::int AS stable,
        COUNT(*) FILTER (WHERE status = 'Discharged')::int AS discharged
      FROM dry_eye_cases WHERE clinic_id = $1
    `,
    [clinicId]
  );
  const assess = await query(
    `
      SELECT COUNT(*)::int AS assessments,
             AVG(osd_index_score)::float AS avg_osd_index
      FROM dry_eye_assessments WHERE clinic_id = $1
    `,
    [clinicId]
  );
  return { ...rows[0], assessments: assess.rows[0]?.assessments || 0, avgOsdIndex: assess.rows[0]?.avg_osd_index };
}

export async function listDryEyeCases(clinicId, queryParams) {
  const { page, limit, offset } = parsePagination(queryParams);
  const params = [clinicId];
  const filters = ['clinic_id = $1'];
  if (queryParams.status) {
    params.push(String(queryParams.status).trim());
    filters.push(`status = $${params.length}`);
  }
  const search = appendSearch(String(queryParams.search || queryParams.q || ''), ['full_name', 'case_id', 'emr_patient_mrn'], params);
  if (search.clause) filters.push(search.clause);
  const where = filters.join(' AND ');
  const { rows: countRows } = await query(`SELECT COUNT(*)::int AS c FROM dry_eye_cases WHERE ${where}`, params);
  params.push(limit, offset);
  const { rows } = await query(
    `SELECT * FROM dry_eye_cases WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { data: rows.map(mapDryEyeCase), meta: buildPaginationMeta(page, limit, countRows[0].c) };
}

export async function getDryEyeCaseById(clinicId, id) {
  const row = await assertCase(clinicId, id);
  const { rows: assessments } = await query(
    `SELECT * FROM dry_eye_assessments WHERE case_id = $1 AND clinic_id = $2 ORDER BY assessed_at DESC`,
    [id, clinicId]
  );
  return { ...mapDryEyeCase(row), assessments: assessments.map(mapDryEyeAssessment) };
}

export async function createDryEyeCase(req, body) {
  const clinicId = req.user.clinicId;
  const caseId = await nextCaseId(clinicId);
  const fullName = requireString(body.fullName, 'fullName');
  const { rows } = await query(
    `
      INSERT INTO dry_eye_cases (
        clinic_id, case_id, emr_patient_uuid, emr_patient_mrn, full_name,
        primary_subtype, status, onset_date, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `,
    [
      clinicId,
      caseId,
      body.emrPatientUuid || null,
      optionalString(body.emrPatientMrn, 'emrPatientMrn'),
      fullName,
      optionalString(body.primarySubtype, 'primarySubtype'),
      optionalString(body.status, 'status') || 'Active',
      parseDate(body.onsetDate, 'onsetDate', false),
      optionalString(body.notes, 'notes')
    ]
  );
  await auditMutation(req, 'dry_eye_case', rows[0].id, 'create', { caseId });
  return mapDryEyeCase(rows[0]);
}

export async function updateDryEyeCase(req, id, body) {
  const clinicId = req.user.clinicId;
  const existing = await assertCase(clinicId, id);

  if (body.baseRevision != null && Number(body.baseRevision) !== Number(existing.revision)) {
    throw new ConflictError('Dry eye case revision conflict', {
      entityType: 'dry_eye_case',
      entityId: id,
      expectedRevision: body.baseRevision,
      serverRevision: existing.revision
    });
  }

  const fullName = body.fullName != null ? requireString(body.fullName, 'fullName') : existing.full_name;

  const { rows } = await query(
    `
      UPDATE dry_eye_cases SET
        emr_patient_uuid = COALESCE($3, emr_patient_uuid),
        emr_patient_mrn = COALESCE($4, emr_patient_mrn),
        full_name = $5,
        primary_subtype = COALESCE($6, primary_subtype),
        status = COALESCE($7, status),
        onset_date = COALESCE($8, onset_date),
        notes = COALESCE($9, notes),
        revision = revision + 1
      WHERE id = $1 AND clinic_id = $2
      RETURNING *
    `,
    [
      id,
      clinicId,
      body.emrPatientUuid !== undefined ? body.emrPatientUuid : undefined,
      body.emrPatientMrn !== undefined ? optionalString(body.emrPatientMrn, 'emrPatientMrn') : undefined,
      fullName,
      body.primarySubtype !== undefined ? optionalString(body.primarySubtype, 'primarySubtype') : undefined,
      body.status !== undefined ? optionalString(body.status, 'status') : undefined,
      body.onsetDate !== undefined ? parseDate(body.onsetDate, 'onsetDate', false) : undefined,
      body.notes !== undefined ? optionalString(body.notes, 'notes') : undefined
    ]
  );

  await auditMutation(req, 'dry_eye_case', id, 'update', { caseId: existing.case_id });
  return mapDryEyeCase(rows[0]);
}

export async function createDryEyeAssessment(req, caseUuid, body) {
  const clinicId = req.user.clinicId;
  await assertCase(clinicId, caseUuid);
  const assessedAt = parseDate(body.assessedAt, 'assessedAt', true);
  const osdIndexScore = computeOsdIndexScore({
    tbutOd: body.tbutOd,
    tbutOs: body.tbutOs,
    schirmerOd: body.schirmerOd,
    schirmerOs: body.schirmerOs,
    osdiScore: body.osdiScore,
    deq5Score: body.deq5Score,
    severity: body.severity,
    mgdGrade: body.mgdGrade,
    blepharitis: body.blepharitis
  });
  const severity = optionalString(body.severity, 'severity') || osdIndexToSeverity(osdIndexScore);
  const { rows } = await query(
    `
      INSERT INTO dry_eye_assessments (
        clinic_id, case_id, assessed_at, tbut_od, tbut_os, schirmer_od, schirmer_os,
        osdi_score, deq5_score, stain_od, stain_os, mgd_grade, blepharitis,
        severity, osd_index_score, treatment_plan, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *
    `,
    [
      clinicId,
      caseUuid,
      assessedAt,
      optionalNumber(body.tbutOd, 'tbutOd'),
      optionalNumber(body.tbutOs, 'tbutOs'),
      optionalNumber(body.schirmerOd, 'schirmerOd'),
      optionalNumber(body.schirmerOs, 'schirmerOs'),
      optionalInt(body.osdiScore, 'osdiScore'),
      optionalInt(body.deq5Score, 'deq5Score'),
      optionalString(body.stainOd, 'stainOd'),
      optionalString(body.stainOs, 'stainOs'),
      optionalString(body.mgdGrade, 'mgdGrade'),
      optionalString(body.blepharitis, 'blepharitis'),
      severity,
      osdIndexScore,
      optionalString(body.treatmentPlan, 'treatmentPlan'),
      optionalString(body.notes, 'notes')
    ]
  );
  await auditMutation(req, 'dry_eye_assessment.create', { entityId: rows[0].id, caseId: caseUuid });
  return mapDryEyeAssessment(rows[0]);
}

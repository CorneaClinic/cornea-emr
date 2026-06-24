import { query } from '../db/pool.js';
import { NotFoundError, ValidationError } from '../core/errors.js';
import {
  parsePagination,
  buildPaginationMeta,
  appendSearch,
  requireString,
  optionalString,
  parseDate,
  optionalInt,
  optionalNumber,
  optionalBool,
  formatDate
} from '../core/validation.js';
import { auditMutation } from './auditService.js';

function mapCase(row) {
  return {
    id: row.id,
    caseId: row.case_id,
    emrPatientUuid: row.emr_patient_uuid,
    emrPatientMrn: row.emr_patient_mrn,
    fullName: row.full_name,
    age: row.age,
    gender: row.gender,
    phone: row.phone,
    eye: row.eye,
    presentationDate: formatDate(row.presentation_date),
    etiology: row.etiology,
    contactLens: row.contact_lens,
    riskFactors: row.risk_factors,
    ulcerSizeMm: row.ulcer_size_mm != null ? Number(row.ulcer_size_mm) : null,
    depth: row.depth,
    hypopyonMm: row.hypopyon_mm != null ? Number(row.hypopyon_mm) : null,
    severityScore: row.severity_score,
    antimicrobialPlan: row.antimicrobial_plan,
    status: row.status,
    healingDate: formatDate(row.healing_date),
    notes: row.notes,
    legacyLocalId: row.legacy_local_id,
    revision: row.revision
  };
}

function mapCulture(row) {
  return {
    id: row.id,
    caseId: row.case_id,
    specimenDate: formatDate(row.specimen_date),
    specimenType: row.specimen_type,
    gramStain: row.gram_stain,
    organism: row.organism,
    sensitivity: row.sensitivity,
    notes: row.notes,
    legacyLocalId: row.legacy_local_id,
    revision: row.revision
  };
}

function mapAssessment(row) {
  return {
    id: row.id,
    caseId: row.case_id,
    assessedAt: formatDate(row.assessed_at),
    ulcerSizeMm: row.ulcer_size_mm != null ? Number(row.ulcer_size_mm) : null,
    epithelialDefectMm: row.epithelial_defect_mm != null ? Number(row.epithelial_defect_mm) : null,
    stromalInfiltrate: row.stromal_infiltrate,
    hypopyonMm: row.hypopyon_mm != null ? Number(row.hypopyon_mm) : null,
    bcva: row.bcva,
    painScore: row.pain_score,
    healingStatus: row.healing_status,
    antimicrobialPlan: row.antimicrobial_plan,
    notes: row.notes,
    legacyLocalId: row.legacy_local_id,
    revision: row.revision
  };
}

async function assertCase(clinicId, id) {
  const { rows } = await query(
    `SELECT * FROM keratitis_ulcer_cases WHERE id = $1 AND clinic_id = $2`,
    [id, clinicId]
  );
  if (!rows[0]) throw new NotFoundError('Keratitis case not found');
  return rows[0];
}

async function nextCaseId(clinicId) {
  const { rows } = await query(
    `SELECT case_id FROM keratitis_ulcer_cases WHERE clinic_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [clinicId]
  );
  const prev = rows[0]?.case_id || 'UK-P-0000';
  const n = (parseInt(String(prev).match(/(\d+)$/)?.[1] || '0', 10) || 0) + 1;
  return `UK-P-${String(n).padStart(4, '0')}`;
}

export async function getKeratitisOverview(clinicId) {
  const { rows } = await query(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'Active')::int AS active,
        COUNT(*) FILTER (WHERE status = 'Healing')::int AS healing,
        COUNT(*) FILTER (WHERE status = 'Resolved')::int AS resolved,
        COUNT(*) FILTER (WHERE contact_lens = true)::int AS contact_lens_related
      FROM keratitis_ulcer_cases WHERE clinic_id = $1
    `,
    [clinicId]
  );
  return rows[0];
}

export async function listKeratitisCases(clinicId, queryParams) {
  const { page, limit, offset } = parsePagination(queryParams);
  const params = [clinicId];
  const filters = ['clinic_id = $1'];
  if (queryParams.status) {
    params.push(String(queryParams.status).trim());
    filters.push(`status = $${params.length}`);
  }
  const search = appendSearch(String(queryParams.q || ''), ['case_id', 'full_name', 'phone', 'emr_patient_mrn'], params);
  if (search.clause) filters.push(search.clause);
  const where = filters.join(' AND ');
  const countRes = await query(`SELECT COUNT(*)::int AS total FROM keratitis_ulcer_cases WHERE ${where}`, params);
  params.push(limit, offset);
  const { rows } = await query(
    `
      SELECT * FROM keratitis_ulcer_cases WHERE ${where}
       ORDER BY presentation_date DESC, updated_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params
  );
  return { data: rows.map(mapCase), pagination: buildPaginationMeta(countRes.rows[0].total, page, limit) };
}

export async function getKeratitisCaseById(clinicId, id) {
  const row = await assertCase(clinicId, id);
  const patient = mapCase(row);
  const [cultures, assessments] = await Promise.all([
    query(`SELECT * FROM keratitis_cultures WHERE clinic_id = $1 AND case_id = $2 ORDER BY specimen_date DESC`, [clinicId, id]),
    query(`SELECT * FROM keratitis_daily_assessments WHERE clinic_id = $1 AND case_id = $2 ORDER BY assessed_at DESC`, [clinicId, id])
  ]);
  patient.cultures = cultures.rows.map(mapCulture);
  patient.assessments = assessments.rows.map(mapAssessment);
  return patient;
}

export async function createKeratitisCase(req, body) {
  const clinicId = req.user.clinicId;
  const fullName = requireString(body.fullName, 'fullName');
  const eye = requireString(body.eye, 'eye');
  const presentationDate = parseDate(body.presentationDate, 'presentationDate');
  if (!presentationDate) throw new ValidationError('presentationDate is required');
  const caseId = optionalString(body.caseId, 'caseId') || await nextCaseId(clinicId);

  const { rows } = await query(
    `
      INSERT INTO keratitis_ulcer_cases (
        clinic_id, case_id, emr_patient_uuid, emr_patient_mrn, full_name, age, gender, phone,
        eye, presentation_date, etiology, contact_lens, risk_factors, ulcer_size_mm, depth,
        hypopyon_mm, severity_score, antimicrobial_plan, status, notes, legacy_local_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING *
    `,
    [
      clinicId, caseId, body.emrPatientUuid || null, optionalString(body.emrPatientMrn, 'emrPatientMrn'),
      fullName, optionalInt(body.age, 'age'), optionalString(body.gender, 'gender'),
      optionalString(body.phone, 'phone'), eye, presentationDate,
      optionalString(body.etiology, 'etiology'), optionalBool(body.contactLens, 'contactLens'),
      optionalString(body.riskFactors, 'riskFactors'), optionalNumber(body.ulcerSizeMm, 'ulcerSizeMm'),
      optionalString(body.depth, 'depth'), optionalNumber(body.hypopyonMm, 'hypopyonMm'),
      optionalString(body.severityScore, 'severityScore'),
      optionalString(body.antimicrobialPlan, 'antimicrobialPlan'),
      optionalString(body.status, 'status') || 'Active',
      optionalString(body.notes, 'notes'), optionalInt(body.legacyLocalId, 'legacyLocalId')
    ]
  );
  await auditMutation(req, { action: 'create', entityType: 'keratitis_case', entityId: rows[0].id, summary: `Keratitis case ${caseId}` });
  return mapCase(rows[0]);
}

export async function createCulture(req, caseId, body) {
  const clinicId = req.user.clinicId;
  await assertCase(clinicId, caseId);
  const specimenDate = parseDate(body.specimenDate, 'specimenDate');
  if (!specimenDate) throw new ValidationError('specimenDate is required');
  const { rows } = await query(
    `
      INSERT INTO keratitis_cultures (
        clinic_id, case_id, specimen_date, specimen_type, gram_stain, organism, sensitivity, notes, legacy_local_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `,
    [
      clinicId, caseId, specimenDate,
      optionalString(body.specimenType, 'specimenType'),
      optionalString(body.gramStain, 'gramStain'),
      optionalString(body.organism, 'organism'),
      optionalString(body.sensitivity, 'sensitivity'),
      optionalString(body.notes, 'notes'),
      optionalInt(body.legacyLocalId, 'legacyLocalId')
    ]
  );
  return mapCulture(rows[0]);
}

export async function createAssessment(req, caseId, body) {
  const clinicId = req.user.clinicId;
  await assertCase(clinicId, caseId);
  const assessedAt = parseDate(body.assessedAt, 'assessedAt');
  if (!assessedAt) throw new ValidationError('assessedAt is required');
  const { rows } = await query(
    `
      INSERT INTO keratitis_daily_assessments (
        clinic_id, case_id, assessed_at, ulcer_size_mm, epithelial_defect_mm, stromal_infiltrate,
        hypopyon_mm, bcva, pain_score, healing_status, antimicrobial_plan, notes, legacy_local_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *
    `,
    [
      clinicId, caseId, assessedAt,
      optionalNumber(body.ulcerSizeMm, 'ulcerSizeMm'),
      optionalNumber(body.epithelialDefectMm, 'epithelialDefectMm'),
      optionalString(body.stromalInfiltrate, 'stromalInfiltrate'),
      optionalNumber(body.hypopyonMm, 'hypopyonMm'),
      optionalString(body.bcva, 'bcva'),
      optionalInt(body.painScore, 'painScore'),
      optionalString(body.healingStatus, 'healingStatus') || 'Unchanged',
      optionalString(body.antimicrobialPlan, 'antimicrobialPlan'),
      optionalString(body.notes, 'notes'),
      optionalInt(body.legacyLocalId, 'legacyLocalId')
    ]
  );
  return mapAssessment(rows[0]);
}

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
  optionalBool,
  requireUuid,
  formatDate
} from '../core/validation.js';
import { auditMutation } from './auditService.js';

const PATIENT_SORT = {
  fullName: 'kc.full_name',
  status: 'kc.status',
  indexDate: 'kc.index_date',
  updatedAt: 'kc.updated_at',
  kcRegistryId: 'kc.kc_registry_id'
};

const KMAX_PROGRESSION_THRESHOLD_D = 1.0;
const KMAX_PROGRESSION_MONTHS = 12;

export function mapKcPatient(row) {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    kcRegistryId: row.kc_registry_id,
    emrPatientUuid: row.emr_patient_uuid,
    emrPatientMrn: row.emr_patient_mrn,
    fullName: row.full_name,
    age: row.age,
    gender: row.gender,
    phone: row.phone,
    eyeInvolvement: row.eye_involvement,
    diagnosis: row.diagnosis,
    staging: row.staging,
    indexDate: formatDate(row.index_date),
    familyHistoryKc: row.family_history_kc,
    atopy: row.atopy,
    eyeRubbing: row.eye_rubbing,
    status: row.status,
    progressionStatus: row.progression_status,
    notes: row.notes,
    legacyLocalId: row.legacy_local_id,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapKcTopography(row) {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    kcPatientId: row.kc_patient_id,
    eye: row.eye,
    capturedAt: formatDate(row.captured_at),
    device: row.device,
    kmax: row.kmax != null ? Number(row.kmax) : null,
    kmean: row.kmean != null ? Number(row.kmean) : null,
    k1: row.k1 != null ? Number(row.k1) : null,
    k2: row.k2 != null ? Number(row.k2) : null,
    thinnestPachy: row.thinnest_pachy,
    centralPachy: row.central_pachy,
    badD: row.bad_d != null ? Number(row.bad_d) : null,
    abcd: row.abcd,
    coneSeverity: row.cone_severity,
    coneLocation: row.cone_location,
    anteriorElevation: row.anterior_elevation != null ? Number(row.anterior_elevation) : null,
    posteriorElevation: row.posterior_elevation != null ? Number(row.posterior_elevation) : null,
    progressionFlag: row.progression_flag,
    deltaKmax: row.delta_kmax != null ? Number(row.delta_kmax) : null,
    visitUuid: row.visit_uuid,
    mediaAssetId: row.media_asset_id,
    source: row.source,
    notes: row.notes,
    legacyLocalId: row.legacy_local_id,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapKcCxl(row) {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    kcPatientId: row.kc_patient_id,
    eye: row.eye,
    procedureDate: formatDate(row.procedure_date),
    protocol: row.protocol,
    epiType: row.epi_type,
    riboflavinType: row.riboflavin_type,
    riboflavinDurationMin: row.riboflavin_duration_min,
    uvEnergyJCm2: row.uv_energy_j_cm2 != null ? Number(row.uv_energy_j_cm2) : null,
    uvDurationSec: row.uv_duration_sec,
    uvPowerMwCm2: row.uv_power_mw_cm2 != null ? Number(row.uv_power_mw_cm2) : null,
    iontophoresis: row.iontophoresis,
    surgeon: row.surgeon,
    preKmax: row.pre_kmax != null ? Number(row.pre_kmax) : null,
    preKmean: row.pre_kmean != null ? Number(row.pre_kmean) : null,
    preThinnestPachy: row.pre_thinnest_pachy,
    postKmax3m: row.post_kmax_3m != null ? Number(row.post_kmax_3m) : null,
    postKmax6m: row.post_kmax_6m != null ? Number(row.post_kmax_6m) : null,
    postKmax12m: row.post_kmax_12m != null ? Number(row.post_kmax_12m) : null,
    postKmean3m: row.post_kmean_3m != null ? Number(row.post_kmean_3m) : null,
    postKmean6m: row.post_kmean_6m != null ? Number(row.post_kmean_6m) : null,
    postKmean12m: row.post_kmean_12m != null ? Number(row.post_kmean_12m) : null,
    outcome: row.outcome,
    complications: row.complications,
    visitUuid: row.visit_uuid,
    notes: row.notes,
    legacyLocalId: row.legacy_local_id,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function parseKcPatientInput(body) {
  return {
    kcRegistryId: optionalString(body.kcRegistryId, 'kcRegistryId'),
    emrPatientUuid: body.emrPatientUuid != null ? requireUuid(body.emrPatientUuid, 'emrPatientUuid') : null,
    emrPatientMrn: optionalString(body.emrPatientMrn, 'emrPatientMrn'),
    fullName: body.fullName != null ? requireString(body.fullName, 'fullName') : undefined,
    age: optionalInt(body.age, 'age'),
    gender: optionalString(body.gender, 'gender'),
    phone: optionalString(body.phone, 'phone'),
    eyeInvolvement: optionalString(body.eyeInvolvement, 'eyeInvolvement'),
    diagnosis: optionalString(body.diagnosis, 'diagnosis') || 'Keratoconus',
    staging: optionalString(body.staging, 'staging'),
    indexDate: parseDate(body.indexDate, 'indexDate'),
    familyHistoryKc: optionalBool(body.familyHistoryKc, 'familyHistoryKc'),
    atopy: optionalString(body.atopy, 'atopy'),
    eyeRubbing: optionalString(body.eyeRubbing, 'eyeRubbing'),
    status: optionalString(body.status, 'status') || 'Active',
    progressionStatus: optionalString(body.progressionStatus, 'progressionStatus') || 'None',
    notes: optionalString(body.notes, 'notes'),
    legacyLocalId: optionalInt(body.legacyLocalId, 'legacyLocalId')
  };
}

function parseTopographyInput(body) {
  return {
    eye: body.eye != null ? requireString(body.eye, 'eye') : undefined,
    capturedAt: parseDate(body.capturedAt, 'capturedAt'),
    device: optionalString(body.device, 'device'),
    kmax: optionalNumber(body.kmax, 'kmax'),
    kmean: optionalNumber(body.kmean, 'kmean'),
    k1: optionalNumber(body.k1, 'k1'),
    k2: optionalNumber(body.k2, 'k2'),
    thinnestPachy: optionalInt(body.thinnestPachy, 'thinnestPachy'),
    centralPachy: optionalInt(body.centralPachy, 'centralPachy'),
    badD: optionalNumber(body.badD, 'badD'),
    abcd: optionalString(body.abcd, 'abcd'),
    coneSeverity: optionalString(body.coneSeverity, 'coneSeverity'),
    coneLocation: optionalString(body.coneLocation, 'coneLocation'),
    anteriorElevation: optionalNumber(body.anteriorElevation, 'anteriorElevation'),
    posteriorElevation: optionalNumber(body.posteriorElevation, 'posteriorElevation'),
    progressionFlag: optionalString(body.progressionFlag, 'progressionFlag') || 'None',
    visitUuid: body.visitUuid != null ? requireUuid(body.visitUuid, 'visitUuid') : null,
    mediaAssetId: body.mediaAssetId != null ? requireUuid(body.mediaAssetId, 'mediaAssetId') : null,
    source: optionalString(body.source, 'source') || 'manual',
    notes: optionalString(body.notes, 'notes'),
    legacyLocalId: optionalInt(body.legacyLocalId, 'legacyLocalId')
  };
}

function parseCxlInput(body) {
  return {
    eye: body.eye != null ? requireString(body.eye, 'eye') : undefined,
    procedureDate: parseDate(body.procedureDate, 'procedureDate'),
    protocol: optionalString(body.protocol, 'protocol'),
    epiType: optionalString(body.epiType, 'epiType'),
    riboflavinType: optionalString(body.riboflavinType, 'riboflavinType'),
    riboflavinDurationMin: optionalInt(body.riboflavinDurationMin, 'riboflavinDurationMin'),
    uvEnergyJCm2: optionalNumber(body.uvEnergyJCm2, 'uvEnergyJCm2'),
    uvDurationSec: optionalInt(body.uvDurationSec, 'uvDurationSec'),
    uvPowerMwCm2: optionalNumber(body.uvPowerMwCm2, 'uvPowerMwCm2'),
    iontophoresis: optionalBool(body.iontophoresis, 'iontophoresis'),
    surgeon: optionalString(body.surgeon, 'surgeon'),
    preKmax: optionalNumber(body.preKmax, 'preKmax'),
    preKmean: optionalNumber(body.preKmean, 'preKmean'),
    preThinnestPachy: optionalInt(body.preThinnestPachy, 'preThinnestPachy'),
    postKmax3m: optionalNumber(body.postKmax3m, 'postKmax3m'),
    postKmax6m: optionalNumber(body.postKmax6m, 'postKmax6m'),
    postKmax12m: optionalNumber(body.postKmax12m, 'postKmax12m'),
    postKmean3m: optionalNumber(body.postKmean3m, 'postKmean3m'),
    postKmean6m: optionalNumber(body.postKmean6m, 'postKmean6m'),
    postKmean12m: optionalNumber(body.postKmean12m, 'postKmean12m'),
    outcome: optionalString(body.outcome, 'outcome') || 'Pending',
    complications: optionalString(body.complications, 'complications'),
    visitUuid: body.visitUuid != null ? requireUuid(body.visitUuid, 'visitUuid') : null,
    notes: optionalString(body.notes, 'notes'),
    legacyLocalId: optionalInt(body.legacyLocalId, 'legacyLocalId')
  };
}

async function nextKcRegistryId(clinicId) {
  const { rows } = await query(
    `SELECT kc_registry_id FROM kc_registry_patients WHERE clinic_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [clinicId]
  );
  const prev = rows[0]?.kc_registry_id || 'KC-P-0000';
  const num = parseInt(String(prev).replace(/\D/g, ''), 10) || 0;
  return `KC-P-${String(num + 1).padStart(4, '0')}`;
}

async function assertKcPatient(clinicId, id) {
  try {
    requireUuid(id, 'id');
  } catch {
    throw new NotFoundError('KC registry patient not found');
  }
  const { rows } = await query(
    `SELECT * FROM kc_registry_patients WHERE id = $1 AND clinic_id = $2`,
    [id, clinicId]
  );
  if (!rows[0]) throw new NotFoundError('KC registry patient not found');
  return rows[0];
}

export async function getKcRegistryOverview(clinicId) {
  const { rows: pStats } = await query(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'Active')::int AS active,
        COUNT(*) FILTER (WHERE status = 'Watch')::int AS watch,
        COUNT(*) FILTER (WHERE status = 'Post-CXL')::int AS post_cxl,
        COUNT(*) FILTER (WHERE progression_status ILIKE '%Confirmed%')::int AS progression_confirmed,
        COUNT(*) FILTER (WHERE progression_status ILIKE '%Suspect%')::int AS progression_suspect
      FROM kc_registry_patients
     WHERE clinic_id = $1
    `,
    [clinicId]
  );

  const { rows: cxlStats } = await query(
    `
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE outcome = 'Pending')::int AS pending_outcome
      FROM kc_cxl_procedures
     WHERE clinic_id = $1
    `,
    [clinicId]
  );

  const { rows: topoStats } = await query(
    `
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE progression_flag IN ('Suspect', 'Confirmed'))::int AS flagged
      FROM kc_topography_readings
     WHERE clinic_id = $1
    `,
    [clinicId]
  );

  return { patients: pStats[0], cxl: cxlStats[0], topography: topoStats[0] };
}

export async function listKcPatients(clinicId, queryParams) {
  const { page, limit, offset } = parsePagination(queryParams);
  const sort = parseSort(queryParams.sort, PATIENT_SORT, 'updatedAt:desc');
  const params = [clinicId];
  const filters = ['kc.clinic_id = $1'];

  if (queryParams.status) {
    params.push(String(queryParams.status).trim());
    filters.push(`kc.status = $${params.length}`);
  }
  if (queryParams.progressionStatus) {
    params.push(`%${String(queryParams.progressionStatus).trim()}%`);
    filters.push(`kc.progression_status ILIKE $${params.length}`);
  }

  const search = appendSearch(String(queryParams.q || ''), [
    'kc.kc_registry_id',
    'kc.full_name',
    'kc.phone',
    'kc.emr_patient_mrn',
    'kc.diagnosis'
  ], params);
  if (search.clause) filters.push(search.clause);

  const where = filters.join(' AND ');
  const countRes = await query(
    `SELECT COUNT(*)::int AS total FROM kc_registry_patients kc WHERE ${where}`,
    params
  );

  params.push(limit, offset);
  const { rows } = await query(
    `
      SELECT kc.*
        FROM kc_registry_patients kc
       WHERE ${where}
       ORDER BY ${sort}
       LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `,
    params
  );

  return {
    data: rows.map(mapKcPatient),
    pagination: buildPaginationMeta(countRes.rows[0].total, page, limit)
  };
}

export async function getKcPatientById(clinicId, id, opts = {}) {
  const row = await assertKcPatient(clinicId, id);
  const patient = mapKcPatient(row);

  if (opts.includeChildren !== false) {
    const [topo, cxl] = await Promise.all([
      listTopographyForPatient(clinicId, id, { limit: 500 }),
      listCxlForPatient(clinicId, id, { limit: 100 })
    ]);
    patient.topographyReadings = topo.data;
    patient.cxlProcedures = cxl.data;
    patient.progressionSummary = computeProgressionSummary(topo.data);
  }

  return patient;
}

export async function createKcPatient(req, body) {
  const clinicId = req.user.clinicId;
  const input = parseKcPatientInput(body);
  if (!input.fullName) throw new ValidationError('fullName is required');
  if (!input.kcRegistryId) input.kcRegistryId = await nextKcRegistryId(clinicId);

  const { rows } = await query(
    `
      INSERT INTO kc_registry_patients (
        clinic_id, kc_registry_id, emr_patient_uuid, emr_patient_mrn, full_name, age, gender, phone,
        eye_involvement, diagnosis, staging, index_date, family_history_kc, atopy, eye_rubbing,
        status, progression_status, notes, legacy_local_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING *
    `,
    [
      clinicId, input.kcRegistryId, input.emrPatientUuid, input.emrPatientMrn, input.fullName,
      input.age, input.gender, input.phone, input.eyeInvolvement, input.diagnosis, input.staging,
      input.indexDate, input.familyHistoryKc, input.atopy, input.eyeRubbing, input.status,
      input.progressionStatus, input.notes, input.legacyLocalId
    ]
  );

  const patient = mapKcPatient(rows[0]);
  await auditMutation(req, {
    action: 'create',
    entityType: 'kc_patient',
    entityId: patient.id,
    summary: `Enrolled KC patient ${patient.kcRegistryId}`,
    metadata: { kcRegistryId: patient.kcRegistryId }
  });
  return patient;
}

export async function updateKcPatient(req, id, body) {
  const clinicId = req.user.clinicId;
  const existing = await assertKcPatient(clinicId, id);
  const parsed = parseKcPatientInput(body);

  if (body.baseRevision != null && Number(body.baseRevision) !== Number(existing.revision)) {
    throw new ConflictError('KC patient revision conflict', {
      entityType: 'kc_patient',
      entityId: id,
      expectedRevision: body.baseRevision,
      serverRevision: existing.revision
    });
  }

  const { rows } = await query(
    `
      UPDATE kc_registry_patients SET
        kc_registry_id = COALESCE($3, kc_registry_id),
        emr_patient_uuid = $4,
        emr_patient_mrn = $5,
        full_name = COALESCE($6, full_name),
        age = $7, gender = $8, phone = $9, eye_involvement = $10,
        diagnosis = COALESCE($11, diagnosis), staging = $12, index_date = $13,
        family_history_kc = $14, atopy = $15, eye_rubbing = $16,
        status = COALESCE($17, status), progression_status = COALESCE($18, progression_status),
        notes = $19, legacy_local_id = COALESCE(legacy_local_id, $20),
        revision = revision + 1
      WHERE id = $1 AND clinic_id = $2
      RETURNING *
    `,
    [
      id, clinicId,
      parsed.kcRegistryId || existing.kc_registry_id,
      parsed.emrPatientUuid !== undefined ? parsed.emrPatientUuid : existing.emr_patient_uuid,
      parsed.emrPatientMrn !== undefined ? parsed.emrPatientMrn : existing.emr_patient_mrn,
      parsed.fullName || existing.full_name,
      parsed.age !== undefined ? parsed.age : existing.age,
      parsed.gender !== undefined ? parsed.gender : existing.gender,
      parsed.phone !== undefined ? parsed.phone : existing.phone,
      parsed.eyeInvolvement !== undefined ? parsed.eyeInvolvement : existing.eye_involvement,
      parsed.diagnosis || existing.diagnosis,
      parsed.staging !== undefined ? parsed.staging : existing.staging,
      parsed.indexDate !== undefined ? parsed.indexDate : existing.index_date,
      parsed.familyHistoryKc !== undefined ? parsed.familyHistoryKc : existing.family_history_kc,
      parsed.atopy !== undefined ? parsed.atopy : existing.atopy,
      parsed.eyeRubbing !== undefined ? parsed.eyeRubbing : existing.eye_rubbing,
      parsed.status || existing.status,
      parsed.progressionStatus || existing.progression_status,
      parsed.notes !== undefined ? parsed.notes : existing.notes,
      parsed.legacyLocalId !== undefined ? parsed.legacyLocalId : existing.legacy_local_id
    ]
  );

  const patient = mapKcPatient(rows[0]);
  await auditMutation(req, {
    action: 'update',
    entityType: 'kc_patient',
    entityId: patient.id,
    summary: `Updated KC patient ${patient.kcRegistryId}`
  });
  return patient;
}

export async function deleteKcPatient(req, id) {
  const clinicId = req.user.clinicId;
  const existing = await assertKcPatient(clinicId, id);
  await query(`DELETE FROM kc_registry_patients WHERE id = $1 AND clinic_id = $2`, [id, clinicId]);
  await auditMutation(req, {
    action: 'delete',
    entityType: 'kc_patient',
    entityId: id,
    summary: `Removed KC patient ${existing.kc_registry_id}`
  });
  return { id, deleted: true };
}

export async function listTopographyForPatient(clinicId, kcPatientId, queryParams = {}) {
  await assertKcPatient(clinicId, kcPatientId);
  const limit = Math.min(Number(queryParams.limit) || 200, 500);
  const { rows } = await query(
    `
      SELECT * FROM kc_topography_readings
       WHERE clinic_id = $1 AND kc_patient_id = $2
       ORDER BY captured_at DESC, eye ASC
       LIMIT $3
    `,
    [clinicId, kcPatientId, limit]
  );
  return { data: rows.map(mapKcTopography) };
}

export async function createTopographyReading(req, kcPatientId, body) {
  const clinicId = req.user.clinicId;
  await assertKcPatient(clinicId, kcPatientId);
  const input = parseTopographyInput(body);
  if (!input.eye) throw new ValidationError('eye is required');
  if (!input.capturedAt) throw new ValidationError('capturedAt is required');

  const deltaKmax = await computeDeltaKmax(clinicId, kcPatientId, input.eye, input.capturedAt, input.kmax);
  if (input.progressionFlag === 'None' && deltaKmax != null) {
    input.progressionFlag = deltaKmax >= KMAX_PROGRESSION_THRESHOLD_D ? 'Suspect' : 'None';
  }

  const { rows } = await query(
    `
      INSERT INTO kc_topography_readings (
        clinic_id, kc_patient_id, eye, captured_at, device, kmax, kmean, k1, k2,
        thinnest_pachy, central_pachy, bad_d, abcd, cone_severity, cone_location,
        anterior_elevation, posterior_elevation, progression_flag, delta_kmax,
        visit_uuid, media_asset_id, source, notes, legacy_local_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
      RETURNING *
    `,
    [
      clinicId, kcPatientId, input.eye, input.capturedAt, input.device, input.kmax, input.kmean,
      input.k1, input.k2, input.thinnestPachy, input.centralPachy, input.badD, input.abcd,
      input.coneSeverity, input.coneLocation, input.anteriorElevation, input.posteriorElevation,
      input.progressionFlag, deltaKmax, input.visitUuid, input.mediaAssetId, input.source,
      input.notes, input.legacyLocalId
    ]
  );

  await refreshPatientProgressionStatus(clinicId, kcPatientId);
  const reading = mapKcTopography(rows[0]);
  await auditMutation(req, {
    action: 'create',
    entityType: 'kc_topography',
    entityId: reading.id,
    summary: `KC topography ${reading.eye} ${reading.capturedAt}`
  });
  return reading;
}

export async function updateTopographyReading(req, kcPatientId, readingId, body) {
  const clinicId = req.user.clinicId;
  await assertKcPatient(clinicId, kcPatientId);
  const { rows: existingRows } = await query(
    `SELECT * FROM kc_topography_readings WHERE id = $1 AND clinic_id = $2 AND kc_patient_id = $3`,
    [readingId, clinicId, kcPatientId]
  );
  if (!existingRows[0]) throw new NotFoundError('Topography reading not found');
  const existing = existingRows[0];
  const input = parseTopographyInput(body);

  const eye = input.eye || existing.eye;
  const capturedAt = input.capturedAt !== undefined ? input.capturedAt : existing.captured_at;
  const kmax = input.kmax !== undefined ? input.kmax : (existing.kmax != null ? Number(existing.kmax) : null);
  const deltaKmax = await computeDeltaKmax(clinicId, kcPatientId, eye, capturedAt, kmax, readingId);

  const { rows } = await query(
    `
      UPDATE kc_topography_readings SET
        eye = $4, captured_at = $5, device = $6, kmax = $7, kmean = $8, k1 = $9, k2 = $10,
        thinnest_pachy = $11, central_pachy = $12, bad_d = $13, abcd = $14, cone_severity = $15,
        cone_location = $16, anterior_elevation = $17, posterior_elevation = $18,
        progression_flag = COALESCE($19, progression_flag), delta_kmax = $20,
        visit_uuid = $21, media_asset_id = $22, source = COALESCE($23, source),
        notes = $24, legacy_local_id = COALESCE(legacy_local_id, $25), revision = revision + 1
      WHERE id = $1 AND clinic_id = $2 AND kc_patient_id = $3
      RETURNING *
    `,
    [
      readingId, clinicId, kcPatientId, eye, capturedAt,
      input.device !== undefined ? input.device : existing.device,
      kmax,
      input.kmean !== undefined ? input.kmean : existing.kmean,
      input.k1 !== undefined ? input.k1 : existing.k1,
      input.k2 !== undefined ? input.k2 : existing.k2,
      input.thinnestPachy !== undefined ? input.thinnestPachy : existing.thinnest_pachy,
      input.centralPachy !== undefined ? input.centralPachy : existing.central_pachy,
      input.badD !== undefined ? input.badD : existing.bad_d,
      input.abcd !== undefined ? input.abcd : existing.abcd,
      input.coneSeverity !== undefined ? input.coneSeverity : existing.cone_severity,
      input.coneLocation !== undefined ? input.coneLocation : existing.cone_location,
      input.anteriorElevation !== undefined ? input.anteriorElevation : existing.anterior_elevation,
      input.posteriorElevation !== undefined ? input.posteriorElevation : existing.posterior_elevation,
      input.progressionFlag,
      deltaKmax,
      input.visitUuid !== undefined ? input.visitUuid : existing.visit_uuid,
      input.mediaAssetId !== undefined ? input.mediaAssetId : existing.media_asset_id,
      input.source,
      input.notes !== undefined ? input.notes : existing.notes,
      input.legacyLocalId !== undefined ? input.legacyLocalId : existing.legacy_local_id
    ]
  );

  await refreshPatientProgressionStatus(clinicId, kcPatientId);
  return mapKcTopography(rows[0]);
}

export async function deleteTopographyReading(req, kcPatientId, readingId) {
  const clinicId = req.user.clinicId;
  await assertKcPatient(clinicId, kcPatientId);
  await query(
    `DELETE FROM kc_topography_readings WHERE id = $1 AND clinic_id = $2 AND kc_patient_id = $3`,
    [readingId, clinicId, kcPatientId]
  );
  await refreshPatientProgressionStatus(clinicId, kcPatientId);
  return { id: readingId, deleted: true };
}

export async function listCxlForPatient(clinicId, kcPatientId, queryParams = {}) {
  await assertKcPatient(clinicId, kcPatientId);
  const limit = Math.min(Number(queryParams.limit) || 100, 200);
  const { rows } = await query(
    `
      SELECT * FROM kc_cxl_procedures
       WHERE clinic_id = $1 AND kc_patient_id = $2
       ORDER BY procedure_date DESC, eye ASC
       LIMIT $3
    `,
    [clinicId, kcPatientId, limit]
  );
  return { data: rows.map(mapKcCxl) };
}

export async function createCxlProcedure(req, kcPatientId, body) {
  const clinicId = req.user.clinicId;
  await assertKcPatient(clinicId, kcPatientId);
  const input = parseCxlInput(body);
  if (!input.eye) throw new ValidationError('eye is required');
  if (!input.procedureDate) throw new ValidationError('procedureDate is required');

  const { rows } = await query(
    `
      INSERT INTO kc_cxl_procedures (
        clinic_id, kc_patient_id, eye, procedure_date, protocol, epi_type, riboflavin_type,
        riboflavin_duration_min, uv_energy_j_cm2, uv_duration_sec, uv_power_mw_cm2, iontophoresis,
        surgeon, pre_kmax, pre_kmean, pre_thinnest_pachy,
        post_kmax_3m, post_kmax_6m, post_kmax_12m, post_kmean_3m, post_kmean_6m, post_kmean_12m,
        outcome, complications, visit_uuid, notes, legacy_local_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
      RETURNING *
    `,
    [
      clinicId, kcPatientId, input.eye, input.procedureDate, input.protocol, input.epiType,
      input.riboflavinType, input.riboflavinDurationMin, input.uvEnergyJCm2, input.uvDurationSec,
      input.uvPowerMwCm2, input.iontophoresis, input.surgeon, input.preKmax, input.preKmean,
      input.preThinnestPachy, input.postKmax3m, input.postKmax6m, input.postKmax12m,
      input.postKmean3m, input.postKmean6m, input.postKmean12m, input.outcome,
      input.complications, input.visitUuid, input.notes, input.legacyLocalId
    ]
  );

  await query(
    `UPDATE kc_registry_patients SET status = 'Post-CXL', revision = revision + 1
      WHERE id = $1 AND clinic_id = $2 AND status = 'Active'`,
    [kcPatientId, clinicId]
  );

  const proc = mapKcCxl(rows[0]);
  await auditMutation(req, {
    action: 'create',
    entityType: 'kc_cxl',
    entityId: proc.id,
    summary: `CXL ${proc.eye} ${proc.procedureDate}`
  });
  return proc;
}

export async function updateCxlProcedure(req, kcPatientId, cxlId, body) {
  const clinicId = req.user.clinicId;
  await assertKcPatient(clinicId, kcPatientId);
  const { rows: existingRows } = await query(
    `SELECT * FROM kc_cxl_procedures WHERE id = $1 AND clinic_id = $2 AND kc_patient_id = $3`,
    [cxlId, clinicId, kcPatientId]
  );
  if (!existingRows[0]) throw new NotFoundError('CXL procedure not found');
  const e = existingRows[0];
  const input = parseCxlInput(body);

  const { rows } = await query(
    `
      UPDATE kc_cxl_procedures SET
        eye = COALESCE($4, eye), procedure_date = COALESCE($5, procedure_date),
        protocol = $6, epi_type = $7, riboflavin_type = $8, riboflavin_duration_min = $9,
        uv_energy_j_cm2 = $10, uv_duration_sec = $11, uv_power_mw_cm2 = $12, iontophoresis = $13,
        surgeon = $14, pre_kmax = $15, pre_kmean = $16, pre_thinnest_pachy = $17,
        post_kmax_3m = $18, post_kmax_6m = $19, post_kmax_12m = $20,
        post_kmean_3m = $21, post_kmean_6m = $22, post_kmean_12m = $23,
        outcome = COALESCE($24, outcome), complications = $25, visit_uuid = $26, notes = $27,
        legacy_local_id = COALESCE(legacy_local_id, $28), revision = revision + 1
      WHERE id = $1 AND clinic_id = $2 AND kc_patient_id = $3
      RETURNING *
    `,
    [
      cxlId, clinicId, kcPatientId,
      input.eye || e.eye, input.procedureDate || e.procedure_date,
      input.protocol !== undefined ? input.protocol : e.protocol,
      input.epiType !== undefined ? input.epiType : e.epi_type,
      input.riboflavinType !== undefined ? input.riboflavinType : e.riboflavin_type,
      input.riboflavinDurationMin !== undefined ? input.riboflavinDurationMin : e.riboflavin_duration_min,
      input.uvEnergyJCm2 !== undefined ? input.uvEnergyJCm2 : e.uv_energy_j_cm2,
      input.uvDurationSec !== undefined ? input.uvDurationSec : e.uv_duration_sec,
      input.uvPowerMwCm2 !== undefined ? input.uvPowerMwCm2 : e.uv_power_mw_cm2,
      input.iontophoresis !== undefined ? input.iontophoresis : e.iontophoresis,
      input.surgeon !== undefined ? input.surgeon : e.surgeon,
      input.preKmax !== undefined ? input.preKmax : e.pre_kmax,
      input.preKmean !== undefined ? input.preKmean : e.pre_kmean,
      input.preThinnestPachy !== undefined ? input.preThinnestPachy : e.pre_thinnest_pachy,
      input.postKmax3m !== undefined ? input.postKmax3m : e.post_kmax_3m,
      input.postKmax6m !== undefined ? input.postKmax6m : e.post_kmax_6m,
      input.postKmax12m !== undefined ? input.postKmax12m : e.post_kmax_12m,
      input.postKmean3m !== undefined ? input.postKmean3m : e.post_kmean_3m,
      input.postKmean6m !== undefined ? input.postKmean6m : e.post_kmean_6m,
      input.postKmean12m !== undefined ? input.postKmean12m : e.post_kmean_12m,
      input.outcome || e.outcome,
      input.complications !== undefined ? input.complications : e.complications,
      input.visitUuid !== undefined ? input.visitUuid : e.visit_uuid,
      input.notes !== undefined ? input.notes : e.notes,
      input.legacyLocalId !== undefined ? input.legacyLocalId : e.legacy_local_id
    ]
  );
  return mapKcCxl(rows[0]);
}

export async function deleteCxlProcedure(req, kcPatientId, cxlId) {
  const clinicId = req.user.clinicId;
  await assertKcPatient(clinicId, kcPatientId);
  await query(
    `DELETE FROM kc_cxl_procedures WHERE id = $1 AND clinic_id = $2 AND kc_patient_id = $3`,
    [cxlId, clinicId, kcPatientId]
  );
  return { id: cxlId, deleted: true };
}

export async function getKcPatientTimeline(clinicId, kcPatientId) {
  const patient = await getKcPatientById(clinicId, kcPatientId, { includeChildren: true });
  const events = [];

  if (patient.indexDate) {
    events.push({ type: 'diagnosis', date: patient.indexDate, label: `Index diagnosis — ${patient.diagnosis}` });
  }

  for (const r of patient.topographyReadings || []) {
    events.push({
      type: 'topography',
      date: r.capturedAt,
      eye: r.eye,
      label: `Topography ${r.eye}: Kmax ${r.kmax ?? '—'} D, Kmean ${r.kmean ?? '—'} D`,
      progressionFlag: r.progressionFlag,
      id: r.id
    });
  }

  for (const c of patient.cxlProcedures || []) {
    events.push({
      type: 'cxl',
      date: c.procedureDate,
      eye: c.eye,
      label: `CXL ${c.eye} — ${c.protocol || 'protocol'} (${c.epiType || 'epi'})`,
      outcome: c.outcome,
      id: c.id
    });
  }

  events.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return { patient, events, progressionSummary: patient.progressionSummary };
}

async function computeDeltaKmax(clinicId, kcPatientId, eye, capturedAt, kmax, excludeId = null) {
  if (kmax == null || !capturedAt) return null;
  const params = [clinicId, kcPatientId, eye, capturedAt];
  let excludeClause = '';
  if (excludeId) {
    params.push(excludeId);
    excludeClause = ` AND id <> $${params.length}`;
  }
  const { rows } = await query(
    `
      SELECT kmax, captured_at FROM kc_topography_readings
       WHERE clinic_id = $1 AND kc_patient_id = $2 AND eye = $3
         AND captured_at <= $4 AND kmax IS NOT NULL ${excludeClause}
       ORDER BY captured_at DESC
       LIMIT 2
    `,
    params
  );
  if (rows.length < 2) return null;
  const prior = Number(rows[1].kmax);
  const current = Number(kmax);
  if (Number.isNaN(prior) || Number.isNaN(current)) return null;
  return Math.round((current - prior) * 100) / 100;
}

async function refreshPatientProgressionStatus(clinicId, kcPatientId) {
  const { rows } = await query(
    `
      SELECT eye, progression_flag FROM kc_topography_readings
       WHERE clinic_id = $1 AND kc_patient_id = $2
         AND progression_flag IN ('Suspect', 'Confirmed')
    `,
    [clinicId, kcPatientId]
  );
  if (!rows.length) {
    await query(
      `UPDATE kc_registry_patients SET progression_status = 'None', revision = revision + 1
        WHERE id = $1 AND clinic_id = $2 AND progression_status <> 'None'`,
      [kcPatientId, clinicId]
    );
    return;
  }
  const parts = [];
  for (const eye of ['OD', 'OS']) {
    const flags = rows.filter((r) => r.eye === eye).map((r) => r.progression_flag);
    if (flags.includes('Confirmed')) parts.push(`Confirmed ${eye}`);
    else if (flags.includes('Suspect')) parts.push(`Suspect ${eye}`);
  }
  const status = parts.length ? parts.join('; ') : 'None';
  await query(
    `UPDATE kc_registry_patients SET progression_status = $3, revision = revision + 1
      WHERE id = $1 AND clinic_id = $2`,
    [kcPatientId, clinicId, status]
  );
}

export function computeProgressionSummary(readings = []) {
  const byEye = { OD: [], OS: [] };
  for (const r of readings) {
    const eye = r.eye === 'OS' ? 'OS' : 'OD';
    if (r.kmax != null) byEye[eye].push({ date: r.capturedAt, kmax: Number(r.kmax), kmean: r.kmean != null ? Number(r.kmean) : null });
  }
  const summary = {};
  for (const eye of ['OD', 'OS']) {
    const series = byEye[eye].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (series.length < 2) {
      summary[eye] = { points: series.length, deltaKmax: null, flag: 'Insufficient data' };
      continue;
    }
    const first = series[0];
    const last = series[series.length - 1];
    const delta = Math.round((last.kmax - first.kmax) * 100) / 100;
    let flag = 'Stable';
    if (delta >= KMAX_PROGRESSION_THRESHOLD_D) flag = 'Progression suspect';
    if (delta >= 1.5) flag = 'Progression likely';
    summary[eye] = { points: series.length, deltaKmax: delta, firstKmax: first.kmax, lastKmax: last.kmax, flag };
  }
  return summary;
}

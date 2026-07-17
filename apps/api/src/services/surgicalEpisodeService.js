import { query } from '../db/pool.js';
import { NotFoundError, ValidationError } from '../core/errors.js';
import {
  requireString,
  optionalString,
  parseDate,
  optionalInt,
  requireUuid
} from '../core/validation.js';
import { auditMutation } from './auditService.js';
import {
  WORKFLOW_STAGES,
  SAFETY_CHECKLIST_ITEMS,
  PREOP_FIT_STATUSES,
  defaultSafetyChecklist,
  computeChecklistCompletion,
  validateAdvanceToStage,
  deriveSafetyFlags,
  nextStage,
  procedureRequiresTissue
} from '../core/surgical-workflow.js';
import { checkOrScheduleConflict, createOrCase, updateOrCase } from './orScheduleService.js';

const STAGES = new Set(WORKFLOW_STAGES.map((s) => s.id));
const STAGE_STATUS = new Set(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED']);
const WORKFLOW_STATUS = new Set(['OPEN', 'COMPLETED', 'CANCELLED']);
const PRIORITIES = new Set(['ELECTIVE', 'PRIORITY', 'URGENT', 'EMERGENCY']);
const CONSENT_STATUS = new Set(['INCOMPLETE', 'COMPLETE', 'OVERRIDDEN']);
const WHO_STATUS = new Set(['PENDING', 'COMPLETED', 'SKIPPED']);
const PREOP_FIT = new Set(PREOP_FIT_STATUSES);

const SAFETY_FLAG_DEFS = Object.freeze([
  { key: 'CONSENT_INCOMPLETE', label: 'Consent incomplete', mandatory: true },
  { key: 'WRONG_SIDE_UNVERIFIED', label: 'Wrong-side verification incomplete', mandatory: true },
  { key: 'MISSING_INVESTIGATIONS', label: 'Missing investigations', mandatory: false },
  { key: 'ALLERGY_ALERT', label: 'Allergy alert', mandatory: true },
  { key: 'MISSING_DONOR_TISSUE', label: 'Missing donor tissue', mandatory: false },
  { key: 'FAILED_CHECKLIST', label: 'Failed checklist', mandatory: true }
]);

function assertInSet(value, set, name) {
  if (value == null) return null;
  if (!set.has(value)) throw new ValidationError(`Invalid ${name}`);
  return value;
}

function parseJsonObject(value, fallback = {}) {
  if (value == null) return fallback;
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  return fallback;
}

export function mapSurgicalEpisode(row) {
  return {
    id: row.id,
    surgicalEpisodeId: row.surgical_episode_id,
    patientId: row.patient_id,
    visitId: row.visit_id,
    keratoplastyPatientId: row.keratoplasty_patient_id,
    orCaseId: row.or_case_id,
    tissueId: row.tissue_id,
    patientMrn: row.patient_mrn,
    patientName: row.patient_name,
    eye: row.eye,
    diagnosis: row.diagnosis,
    plannedProcedure: row.planned_procedure,
    actualProcedure: row.actual_procedure,
    surgeonName: row.surgeon_name,
    assistantName: row.assistant_name,
    anaesthesiaType: row.anaesthesia_type,
    priority: row.priority,
    stage: row.stage,
    stageStatus: row.stage_status,
    workflowStatus: row.workflow_status,
    decisionAt: row.decision_at,
    scheduledAt: row.scheduled_at,
    surgeryStartedAt: row.surgery_started_at,
    surgeryCompletedAt: row.surgery_completed_at,
    dischargedAt: row.discharged_at,
    finalOutcomeAt: row.final_outcome_at,
    preopStatus: row.preop_status,
    consentStatus: row.consent_status,
    whoSignInStatus: row.who_sign_in_status,
    whoTimeOutStatus: row.who_time_out_status,
    whoSignOutStatus: row.who_sign_out_status,
    preopAssessment: parseJsonObject(row.preop_assessment),
    safetyChecklist: parseJsonObject(row.safety_checklist),
    safetyOverride: row.safety_override || null,
    safetyChecklistPct: computeChecklistCompletion(
      parseJsonObject(row.safety_checklist),
      row.planned_procedure
    ),
    safetyFlags: row.safety_flags || [],
    stageHistory: row.stage_history || [],
    requiredActions: row.required_actions || [],
    linkedDocuments: row.linked_documents || [],
    notes: row.notes,
    revision: row.revision,
    updatedAt: row.updated_at
  };
}

export function getSurgicalWorkflowMeta() {
  return {
    stages: WORKFLOW_STAGES,
    safetyChecklistItems: SAFETY_CHECKLIST_ITEMS,
    preopFitStatuses: PREOP_FIT_STATUSES,
    safetyFlagDefinitions: SAFETY_FLAG_DEFS
  };
}

async function nextEpisodeId(clinicId) {
  const { rows } = await query(
    `SELECT surgical_episode_id FROM surgical_episodes WHERE clinic_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [clinicId]
  );
  const prev = rows[0]?.surgical_episode_id || 'SE-00000';
  const n = (parseInt(String(prev).match(/(\d+)$/)?.[1] || '0', 10) || 0) + 1;
  return `SE-${String(n).padStart(5, '0')}`;
}

function parseUuid(value, field) {
  return value ? requireUuid(value, field) : null;
}

function parseIsoDate(value, field) {
  if (!value) return null;
  return parseDate(value, field, true);
}

export async function resolveTissueFromKeratoplasty(clinicId, keratoplastyPatientId) {
  const kpId = requireUuid(keratoplastyPatientId, 'keratoplastyPatientId');
  const { rows } = await query(
    `SELECT recommended_tissue_id FROM keratoplasty_patients WHERE clinic_id = $1 AND id = $2`,
    [clinicId, kpId]
  );
  return rows[0]?.recommended_tissue_id || null;
}

function mapProcedureToOrType(plannedProcedure) {
  const p = String(plannedProcedure || '').toUpperCase();
  if (/\bDALK\b/.test(p)) return 'DALK';
  if (/\bDMEK\b/.test(p)) return 'DMEK';
  if (/\bDSAEK\b/.test(p)) return 'DSAEK';
  if (/\bDSEK\b/.test(p)) return 'DSEK';
  if (/\bPK(P)?\b/.test(p)) return 'PK';
  if (/\bCXL\b/.test(p)) return 'CXL';
  if (/\bPTERYGIUM\b/.test(p)) return 'PTERYGIUM';
  if (/\bAMT|AMNIOTIC\b/.test(p)) return 'AMNIOTIC_MEMBRANE';
  return 'OTHER';
}

export async function listSurgicalEpisodes(clinicId, filters = {}) {
  const values = [clinicId];
  const where = ['clinic_id = $1'];

  if (filters.stage) {
    values.push(assertInSet(String(filters.stage), STAGES, 'stage'));
    where.push(`stage = $${values.length}`);
  }
  if (filters.priority) {
    values.push(assertInSet(String(filters.priority), PRIORITIES, 'priority'));
    where.push(`priority = $${values.length}`);
  }
  if (filters.workflowStatus) {
    values.push(assertInSet(String(filters.workflowStatus), WORKFLOW_STATUS, 'workflowStatus'));
    where.push(`workflow_status = $${values.length}`);
  }

  const limit = Math.min(Math.max(optionalInt(filters.limit, 'limit') ?? 100, 1), 300);
  values.push(limit);

  const { rows } = await query(
    `
      SELECT * FROM surgical_episodes
      WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${values.length}
    `,
    values
  );
  return rows.map(mapSurgicalEpisode);
}

export async function getSurgicalEpisodeById(clinicId, id) {
  const { rows } = await query(
    `SELECT * FROM surgical_episodes WHERE clinic_id = $1 AND id = $2`,
    [clinicId, id]
  );
  if (!rows[0]) throw new NotFoundError('Surgical episode not found');
  return mapSurgicalEpisode(rows[0]);
}

export async function createSurgicalEpisode(req, body) {
  const clinicId = req.user.clinicId;
  const userId = req.user.sub;
  const episodeId = await nextEpisodeId(clinicId);

  const stage = assertInSet((body.stage || 'SURGICAL_DECISION').trim(), STAGES, 'stage');
  const stageStatus = assertInSet((body.stageStatus || 'PENDING').trim(), STAGE_STATUS, 'stageStatus');
  const priority = assertInSet((body.priority || 'ELECTIVE').trim(), PRIORITIES, 'priority');
  const workflowStatus = assertInSet((body.workflowStatus || 'OPEN').trim(), WORKFLOW_STATUS, 'workflowStatus');
  const consentStatus = assertInSet((body.consentStatus || 'INCOMPLETE').trim(), CONSENT_STATUS, 'consentStatus');

  let keratoplastyPatientId = parseUuid(body.keratoplastyPatientId, 'keratoplastyPatientId');
  let tissueId = parseUuid(body.tissueId, 'tissueId');
  if (!tissueId && keratoplastyPatientId) {
    tissueId = await resolveTissueFromKeratoplasty(clinicId, keratoplastyPatientId);
  }

  const safetyChecklist =
    body.safetyChecklist && typeof body.safetyChecklist === 'object'
      ? body.safetyChecklist
      : defaultSafetyChecklist();

  const stageHistory = Array.isArray(body.stageHistory) ? body.stageHistory : [];
  if (!stageHistory.length) {
    stageHistory.push({
      stage,
      status: stageStatus,
      at: new Date().toISOString(),
      by: userId
    });
  }

  const episodeDraft = {
    plannedProcedure: requireString(body.plannedProcedure, 'plannedProcedure'),
    preopStatus: optionalString(body.preopStatus, 'preopStatus'),
    consentStatus,
    safetyChecklist,
    tissueId,
    preopAssessment: parseJsonObject(body.preopAssessment),
    safetyOverride: body.safetyOverride || null,
    stage
  };
  const safetyFlags = deriveSafetyFlags(episodeDraft);

  const { rows } = await query(
    `
      INSERT INTO surgical_episodes (
        clinic_id, surgical_episode_id, patient_id, visit_id, keratoplasty_patient_id, or_case_id, tissue_id,
        patient_mrn, patient_name, eye, diagnosis, planned_procedure, actual_procedure,
        surgeon_name, assistant_name, anaesthesia_type, priority, stage, stage_status, workflow_status,
        decision_at, scheduled_at, surgery_started_at, surgery_completed_at, discharged_at, final_outcome_at,
        preop_status, consent_status, who_sign_in_status, who_time_out_status, who_sign_out_status,
        preop_assessment, safety_checklist, safety_override,
        safety_flags, stage_history, required_actions, linked_documents, notes,
        created_by, updated_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,$13,
        $14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,
        $27,$28,$29,$30,$31,
        $32,$33,$34,
        $35,$36,$37,$38,$39,
        $40,$40
      )
      RETURNING *
    `,
    [
      clinicId,
      episodeId,
      parseUuid(body.patientId, 'patientId'),
      parseUuid(body.visitId, 'visitId'),
      keratoplastyPatientId,
      parseUuid(body.orCaseId, 'orCaseId'),
      tissueId,
      optionalString(body.patientMrn, 'patientMrn'),
      requireString(body.patientName, 'patientName'),
      requireString(body.eye, 'eye').toUpperCase(),
      requireString(body.diagnosis, 'diagnosis'),
      requireString(body.plannedProcedure, 'plannedProcedure'),
      optionalString(body.actualProcedure, 'actualProcedure'),
      optionalString(body.surgeonName, 'surgeonName'),
      optionalString(body.assistantName, 'assistantName'),
      optionalString(body.anaesthesiaType, 'anaesthesiaType'),
      priority,
      stage,
      stageStatus,
      workflowStatus,
      parseIsoDate(body.decisionAt, 'decisionAt'),
      parseIsoDate(body.scheduledAt, 'scheduledAt'),
      parseIsoDate(body.surgeryStartedAt, 'surgeryStartedAt'),
      parseIsoDate(body.surgeryCompletedAt, 'surgeryCompletedAt'),
      parseIsoDate(body.dischargedAt, 'dischargedAt'),
      parseIsoDate(body.finalOutcomeAt, 'finalOutcomeAt'),
      optionalString(body.preopStatus, 'preopStatus'),
      consentStatus,
      assertInSet((body.whoSignInStatus || 'PENDING').trim(), WHO_STATUS, 'whoSignInStatus'),
      assertInSet((body.whoTimeOutStatus || 'PENDING').trim(), WHO_STATUS, 'whoTimeOutStatus'),
      assertInSet((body.whoSignOutStatus || 'PENDING').trim(), WHO_STATUS, 'whoSignOutStatus'),
      JSON.stringify(parseJsonObject(body.preopAssessment)),
      JSON.stringify(safetyChecklist),
      body.safetyOverride ? JSON.stringify(body.safetyOverride) : null,
      JSON.stringify(safetyFlags),
      JSON.stringify(stageHistory),
      JSON.stringify(Array.isArray(body.requiredActions) ? body.requiredActions : []),
      JSON.stringify(Array.isArray(body.linkedDocuments) ? body.linkedDocuments : []),
      optionalString(body.notes, 'notes'),
      userId
    ]
  );
  await auditMutation(req, 'surgical_episode', rows[0].id, 'create');
  return mapSurgicalEpisode(rows[0]);
}

export async function updateSurgicalEpisode(req, id, body) {
  const clinicId = req.user.clinicId;
  const userId = req.user.sub;
  const existing = await getSurgicalEpisodeById(clinicId, id);

  const stage = assertInSet((body.stage || existing.stage).trim(), STAGES, 'stage');
  const stageStatus = assertInSet((body.stageStatus || existing.stageStatus).trim(), STAGE_STATUS, 'stageStatus');
  const workflowStatus = assertInSet((body.workflowStatus || existing.workflowStatus).trim(), WORKFLOW_STATUS, 'workflowStatus');
  const priority = assertInSet((body.priority || existing.priority).trim(), PRIORITIES, 'priority');
  const consentStatus = assertInSet((body.consentStatus || existing.consentStatus).trim(), CONSENT_STATUS, 'consentStatus');

  if (stage !== existing.stage) {
    const gate = validateAdvanceToStage(
      {
        ...existing,
        stage,
        consentStatus,
        preopAssessment: parseJsonObject(body.preopAssessment ?? existing.preopAssessment),
        safetyChecklist: parseJsonObject(body.safetyChecklist ?? existing.safetyChecklist),
        safetyOverride: body.safetyOverride !== undefined ? body.safetyOverride : existing.safetyOverride
      },
      stage
    );
    if (!gate.ok) {
      throw new ValidationError(gate.message || 'Cannot advance to this stage', { code: gate.code, details: gate });
    }
  }

  const stageHistory = Array.isArray(body.stageHistory) ? body.stageHistory : existing.stageHistory || [];
  if (stage !== existing.stage || stageStatus !== existing.stageStatus) {
    stageHistory.push({ stage, status: stageStatus, at: new Date().toISOString(), by: userId });
  }

  let keratoplastyPatientId = parseUuid(body.keratoplastyPatientId ?? existing.keratoplastyPatientId, 'keratoplastyPatientId');
  let tissueId = parseUuid(body.tissueId ?? existing.tissueId, 'tissueId');
  if (!tissueId && keratoplastyPatientId) {
    tissueId = await resolveTissueFromKeratoplasty(clinicId, keratoplastyPatientId);
  }

  const preopAssessment = parseJsonObject(body.preopAssessment ?? existing.preopAssessment);
  const safetyChecklist = parseJsonObject(body.safetyChecklist ?? existing.safetyChecklist);
  const safetyOverride = body.safetyOverride !== undefined ? body.safetyOverride : existing.safetyOverride;
  const plannedProcedure = requireString(body.plannedProcedure ?? existing.plannedProcedure, 'plannedProcedure');
  const preopStatus = optionalString(body.preopStatus ?? existing.preopStatus, 'preopStatus');

  const safetyFlags = deriveSafetyFlags({
    plannedProcedure,
    preopStatus,
    consentStatus,
    safetyChecklist,
    tissueId,
    stage,
    preopAssessment,
    safetyOverride
  });

  const { rows } = await query(
    `
      UPDATE surgical_episodes
         SET patient_id = $3,
             visit_id = $4,
             keratoplasty_patient_id = $5,
             or_case_id = $6,
             tissue_id = $7,
             patient_mrn = $8,
             patient_name = $9,
             eye = $10,
             diagnosis = $11,
             planned_procedure = $12,
             actual_procedure = $13,
             surgeon_name = $14,
             assistant_name = $15,
             anaesthesia_type = $16,
             priority = $17,
             stage = $18,
             stage_status = $19,
             workflow_status = $20,
             decision_at = $21,
             scheduled_at = $22,
             surgery_started_at = $23,
             surgery_completed_at = $24,
             discharged_at = $25,
             final_outcome_at = $26,
             preop_status = $27,
             consent_status = $28,
             who_sign_in_status = $29,
             who_time_out_status = $30,
             who_sign_out_status = $31,
             preop_assessment = $32,
             safety_checklist = $33,
             safety_override = $34,
             safety_flags = $35,
             stage_history = $36,
             required_actions = $37,
             linked_documents = $38,
             notes = $39,
             updated_by = $40,
             revision = revision + 1
       WHERE clinic_id = $1 AND id = $2
      RETURNING *
    `,
    [
      clinicId,
      id,
      parseUuid(body.patientId ?? existing.patientId, 'patientId'),
      parseUuid(body.visitId ?? existing.visitId, 'visitId'),
      keratoplastyPatientId,
      parseUuid(body.orCaseId ?? existing.orCaseId, 'orCaseId'),
      tissueId,
      optionalString(body.patientMrn ?? existing.patientMrn, 'patientMrn'),
      requireString(body.patientName ?? existing.patientName, 'patientName'),
      requireString((body.eye ?? existing.eye), 'eye').toUpperCase(),
      requireString(body.diagnosis ?? existing.diagnosis, 'diagnosis'),
      plannedProcedure,
      optionalString(body.actualProcedure ?? existing.actualProcedure, 'actualProcedure'),
      optionalString(body.surgeonName ?? existing.surgeonName, 'surgeonName'),
      optionalString(body.assistantName ?? existing.assistantName, 'assistantName'),
      optionalString(body.anaesthesiaType ?? existing.anaesthesiaType, 'anaesthesiaType'),
      priority,
      stage,
      stageStatus,
      workflowStatus,
      parseIsoDate(body.decisionAt ?? existing.decisionAt, 'decisionAt'),
      parseIsoDate(body.scheduledAt ?? existing.scheduledAt, 'scheduledAt'),
      parseIsoDate(body.surgeryStartedAt ?? existing.surgeryStartedAt, 'surgeryStartedAt'),
      parseIsoDate(body.surgeryCompletedAt ?? existing.surgeryCompletedAt, 'surgeryCompletedAt'),
      parseIsoDate(body.dischargedAt ?? existing.dischargedAt, 'dischargedAt'),
      parseIsoDate(body.finalOutcomeAt ?? existing.finalOutcomeAt, 'finalOutcomeAt'),
      preopStatus,
      consentStatus,
      assertInSet((body.whoSignInStatus || existing.whoSignInStatus || 'PENDING').trim(), WHO_STATUS, 'whoSignInStatus'),
      assertInSet((body.whoTimeOutStatus || existing.whoTimeOutStatus || 'PENDING').trim(), WHO_STATUS, 'whoTimeOutStatus'),
      assertInSet((body.whoSignOutStatus || existing.whoSignOutStatus || 'PENDING').trim(), WHO_STATUS, 'whoSignOutStatus'),
      JSON.stringify(preopAssessment),
      JSON.stringify(safetyChecklist),
      safetyOverride ? JSON.stringify(safetyOverride) : null,
      JSON.stringify(safetyFlags),
      JSON.stringify(stageHistory),
      JSON.stringify(Array.isArray(body.requiredActions) ? body.requiredActions : existing.requiredActions || []),
      JSON.stringify(Array.isArray(body.linkedDocuments) ? body.linkedDocuments : existing.linkedDocuments || []),
      optionalString(body.notes ?? existing.notes, 'notes'),
      userId
    ]
  );
  if (!rows[0]) throw new NotFoundError('Surgical episode not found');
  await auditMutation(req, 'surgical_episode', id, 'update');
  return mapSurgicalEpisode(rows[0]);
}

export async function savePreopAssessment(req, id, body) {
  const clinicId = req.user.clinicId;
  const userId = req.user.sub;
  const existing = await getSurgicalEpisodeById(clinicId, id);

  const fitStatus = assertInSet(requireString(body.fitStatus, 'fitStatus').trim(), PREOP_FIT, 'fitStatus');
  const assessment = {
    ...parseJsonObject(existing.preopAssessment),
    fitStatus,
    assessedAt: new Date().toISOString(),
    assessedBy: userId,
    medicalHistory: optionalString(body.medicalHistory, 'medicalHistory'),
    medications: optionalString(body.medications, 'medications'),
    allergies: optionalString(body.allergies, 'allergies'),
    allergyAlert: body.allergyAlert === true || String(body.allergyAlert) === 'true',
    investigations: optionalString(body.investigations, 'investigations'),
    anaesthesiaPlan: optionalString(body.anaesthesiaPlan, 'anaesthesiaPlan'),
    conditions: optionalString(body.conditions, 'conditions'),
    notes: optionalString(body.notes, 'notes')
  };

  const preopStatus =
    fitStatus === 'FIT_FOR_SURGERY' || fitStatus === 'FIT_WITH_CONDITIONS'
      ? 'CLEARED'
      : fitStatus === 'NOT_FIT'
        ? 'NOT_FIT'
        : 'REQUIRES_REVIEW';

  const stage =
    existing.stage === 'SURGICAL_DECISION' || existing.stage === 'PATIENT_COUNSELLING'
      ? 'PRE_OP_ASSESSMENT'
      : existing.stage;

  const { rows } = await query(
    `
      UPDATE surgical_episodes
         SET preop_assessment = $3,
             preop_status = $4,
             stage = $5,
             stage_status = 'IN_PROGRESS',
             safety_flags = $6,
             updated_by = $7,
             revision = revision + 1
       WHERE clinic_id = $1 AND id = $2
      RETURNING *
    `,
    [
      clinicId,
      id,
      JSON.stringify(assessment),
      preopStatus,
      stage,
      JSON.stringify(
        deriveSafetyFlags({
          ...existing,
          preopStatus,
          preopAssessment: assessment,
          stage
        })
      ),
      userId
    ]
  );
  await auditMutation(req, 'surgical_episode', id, 'preop_assessment', { fitStatus });
  return mapSurgicalEpisode(rows[0]);
}

export async function saveSafetyChecklist(req, id, body) {
  const clinicId = req.user.clinicId;
  const userId = req.user.sub;
  const existing = await getSurgicalEpisodeById(clinicId, id);

  const incoming = parseJsonObject(body.checklist);
  const checklist = { ...defaultSafetyChecklist(), ...parseJsonObject(existing.safetyChecklist) };

  for (const item of SAFETY_CHECKLIST_ITEMS) {
    if (!incoming[item.key]) continue;
    const patch = incoming[item.key];
    checklist[item.key] = {
      done: patch.done === true,
      at: patch.done ? new Date().toISOString() : null,
      by: patch.done ? userId : null,
      note: optionalString(patch.note, `${item.key}.note`) || ''
    };
  }

  const { rows } = await query(
    `
      UPDATE surgical_episodes
         SET safety_checklist = $3,
             safety_flags = $4,
             updated_by = $5,
             revision = revision + 1
       WHERE clinic_id = $1 AND id = $2
      RETURNING *
    `,
    [
      clinicId,
      id,
      JSON.stringify(checklist),
      JSON.stringify(deriveSafetyFlags({ ...existing, safetyChecklist: checklist })),
      userId
    ]
  );
  await auditMutation(req, 'surgical_episode', id, 'safety_checklist');
  return mapSurgicalEpisode(rows[0]);
}

export async function applySafetyOverride(req, id, body) {
  const clinicId = req.user.clinicId;
  const userId = req.user.sub;
  const existing = await getSurgicalEpisodeById(clinicId, id);
  const reason = requireString(body.reason, 'reason');

  const override = {
    active: true,
    reason,
    at: new Date().toISOString(),
    by: userId,
    emergency: body.emergency === true || String(body.emergency) === 'true'
  };

  const { rows } = await query(
    `
      UPDATE surgical_episodes
         SET safety_override = $3,
             safety_flags = $4,
             updated_by = $5,
             revision = revision + 1
       WHERE clinic_id = $1 AND id = $2
      RETURNING *
    `,
    [
      clinicId,
      id,
      JSON.stringify(override),
      JSON.stringify(deriveSafetyFlags({ ...existing, safetyOverride: override })),
      userId
    ]
  );
  await auditMutation(req, 'surgical_episode', id, 'safety_override', { reason: reason.slice(0, 200) });
  return mapSurgicalEpisode(rows[0]);
}

export async function advanceSurgicalEpisodeStage(req, id, body = {}) {
  const existing = await getSurgicalEpisodeById(req.user.clinicId, id);
  const targetStage = body.stage
    ? assertInSet(String(body.stage).trim(), STAGES, 'stage')
    : nextStage(existing.stage);

  return updateSurgicalEpisode(req, id, {
    stage: targetStage,
    stageStatus: body.stageStatus || 'IN_PROGRESS'
  });
}

export async function scheduleEpisodeOt(req, id, body) {
  const clinicId = req.user.clinicId;
  const existing = await getSurgicalEpisodeById(clinicId, id);

  const procedureDate = parseDate(body.procedureDate, 'procedureDate', true);
  const startTime = body.startTime || null;
  const durationMinutes = optionalInt(body.durationMinutes, 'durationMinutes') ?? 60;
  const theatre = optionalString(body.theatre, 'theatre') || 'OR-1';
  const surgeonName = optionalString(body.surgeonName ?? existing.surgeonName, 'surgeonName');
  const procedureType = body.procedureType || mapProcedureToOrType(existing.plannedProcedure);

  await checkOrScheduleConflict(clinicId, {
    procedureDate,
    startTime,
    durationMinutes,
    theatre,
    surgeonName,
    excludeCaseId: existing.orCaseId
  });

  const orPayload = {
    patientName: existing.patientName,
    patientMrn: existing.patientMrn,
    patientId: existing.patientId,
    procedureDate,
    startTime,
    durationMinutes,
    procedureType,
    surgeonName,
    theatre,
    status: 'scheduled',
    notes: optionalString(body.notes, 'notes') || existing.notes
  };

  let orCase;
  if (existing.orCaseId) {
    orCase = await updateOrCase(req, existing.orCaseId, orPayload);
  } else {
    orCase = await createOrCase(req, orPayload);
  }

  let tissueId = existing.tissueId;
  if (!tissueId && existing.keratoplastyPatientId && procedureRequiresTissue(existing.plannedProcedure)) {
    tissueId = await resolveTissueFromKeratoplasty(clinicId, existing.keratoplastyPatientId);
  }

  const scheduledAt = `${procedureDate}T${startTime ? String(startTime).slice(0, 5) : '08:00'}:00.000Z`;

  const { rows } = await query(
    `
      UPDATE surgical_episodes
         SET or_case_id = $3,
             tissue_id = COALESCE($4, tissue_id),
             scheduled_at = $5,
             surgeon_name = COALESCE($6, surgeon_name),
             stage = 'OT_SCHEDULING',
             stage_status = 'IN_PROGRESS',
             updated_by = $7,
             revision = revision + 1
       WHERE clinic_id = $1 AND id = $2
      RETURNING *
    `,
    [clinicId, id, orCase.id, tissueId, scheduledAt, surgeonName, req.user.sub]
  );

  await auditMutation(req, 'surgical_episode', id, 'schedule_ot', { orCaseId: orCase.id, procedureDate });
  return { episode: mapSurgicalEpisode(rows[0]), orCase };
}

export async function getSurgicalCentreDashboard(clinicId, dateStr) {
  const day = parseDate(dateStr || new Date().toISOString().slice(0, 10), 'date', true);
  const { rows } = await query(
    `
      SELECT
        COUNT(*) FILTER (WHERE scheduled_at::date = $2) AS todays_cases,
        COUNT(*) FILTER (WHERE stage = 'PRE_OP_ASSESSMENT' AND stage_status <> 'COMPLETED') AS awaiting_preop,
        COUNT(*) FILTER (WHERE stage = 'BLOCK_ROOM' AND stage_status = 'IN_PROGRESS') AS in_block_room,
        COUNT(*) FILTER (WHERE stage = 'OPERATING_THEATRE' AND stage_status = 'IN_PROGRESS') AS in_ot,
        COUNT(*) FILTER (WHERE stage = 'RECOVERY' AND stage_status <> 'COMPLETED') AS in_recovery,
        COUNT(*) FILTER (WHERE workflow_status = 'COMPLETED' AND surgery_completed_at::date = $2) AS completed_cases,
        COUNT(*) FILTER (WHERE workflow_status = 'CANCELLED') AS cancelled_cases,
        COUNT(*) FILTER (WHERE priority = 'EMERGENCY' AND workflow_status = 'OPEN') AS emergency_cases,
        COUNT(*) FILTER (
          WHERE (consent_status <> 'COMPLETE' OR who_sign_in_status = 'PENDING' OR who_time_out_status = 'PENDING')
          AND workflow_status = 'OPEN'
        ) AS safety_alerts
      FROM surgical_episodes
      WHERE clinic_id = $1
    `,
    [clinicId, day]
  );
  const r = rows[0] || {};
  return {
    date: day,
    today: {
      todaysCases: Number(r.todays_cases || 0),
      awaitingPreop: Number(r.awaiting_preop || 0),
      inBlockRoom: Number(r.in_block_room || 0),
      inOt: Number(r.in_ot || 0),
      inRecovery: Number(r.in_recovery || 0),
      completedCases: Number(r.completed_cases || 0),
      cancelledCases: Number(r.cancelled_cases || 0),
      emergencyCases: Number(r.emergency_cases || 0),
      safetyAlerts: Number(r.safety_alerts || 0)
    },
    safetyFlagDefinitions: SAFETY_FLAG_DEFS
  };
}

/** Perioperative workflow stages, safety checklist, and gate rules. */

export const WORKFLOW_STAGES = Object.freeze([
  { id: 'SURGICAL_RECOMMENDATION', label: 'Surgical recommendation', phase: 'decision' },
  { id: 'SURGICAL_DECISION', label: 'Surgical decision', phase: 'decision' },
  { id: 'PATIENT_COUNSELLING', label: 'Patient counselling', phase: 'decision' },
  { id: 'CONSENT', label: 'Consent', phase: 'preop' },
  { id: 'PRE_OP_ASSESSMENT', label: 'Pre-operative assessment', phase: 'preop' },
  { id: 'SURGICAL_WAITING_LIST', label: 'Surgical waiting list', phase: 'preop' },
  { id: 'OT_SCHEDULING', label: 'OT scheduling', phase: 'preop' },
  { id: 'PRE_OP_VERIFICATION', label: 'Pre-op verification', phase: 'preop' },
  { id: 'BLOCK_ROOM', label: 'Block room', phase: 'intraop' },
  { id: 'OPERATING_THEATRE', label: 'Operating theatre', phase: 'intraop' },
  { id: 'RECOVERY', label: 'Recovery', phase: 'postop' },
  { id: 'WARD_DAY_CARE', label: 'Ward / day care', phase: 'postop' },
  { id: 'DISCHARGE', label: 'Discharge', phase: 'postop' },
  { id: 'POST_OP_DAY_1', label: 'Post-op day 1', phase: 'postop' },
  { id: 'POST_OP_WEEK_1', label: 'Post-op week 1', phase: 'postop' },
  { id: 'POST_OP_MONTH_1', label: 'Post-op month 1', phase: 'postop' },
  { id: 'POST_OP_MONTH_3', label: 'Post-op month 3', phase: 'postop' },
  { id: 'POST_OP_MONTH_6', label: 'Post-op month 6', phase: 'postop' },
  { id: 'LONG_TERM_FOLLOW_UP', label: 'Long-term follow-up', phase: 'postop' },
  { id: 'FINAL_SURGICAL_OUTCOME', label: 'Final surgical outcome', phase: 'postop' }
]);

export const PREOP_FIT_STATUSES = Object.freeze([
  'FIT_FOR_SURGERY',
  'FIT_WITH_CONDITIONS',
  'REQUIRES_REVIEW',
  'NOT_FIT'
]);

export const SAFETY_CHECKLIST_ITEMS = Object.freeze([
  { key: 'patient_identity', label: 'Patient identity verified', mandatory: true },
  { key: 'mrn_verified', label: 'MRN verified', mandatory: true },
  { key: 'correct_procedure', label: 'Correct procedure confirmed', mandatory: true },
  { key: 'correct_eye', label: 'Correct eye confirmed', mandatory: true },
  { key: 'site_marked', label: 'Surgical site marked', mandatory: true },
  { key: 'consent_complete', label: 'Consent completed', mandatory: true },
  { key: 'allergies_reviewed', label: 'Allergies reviewed', mandatory: true },
  { key: 'medications_reviewed', label: 'Medications reviewed', mandatory: true },
  { key: 'investigations_reviewed', label: 'Investigations reviewed', mandatory: false },
  { key: 'anaesthesia_plan', label: 'Anaesthesia plan confirmed', mandatory: true },
  { key: 'implant_available', label: 'Implant available (if applicable)', mandatory: false },
  { key: 'donor_tissue_confirmed', label: 'Donor tissue confirmed (if applicable)', mandatory: false },
  { key: 'equipment_available', label: 'Required equipment available', mandatory: true }
]);

const TISSUE_PROCEDURE_PATTERN =
  /\b(PKP|PK|DALK|DMEK|DSAEK|DSEK|TPK|KERATOPLASTY|PATCH\s*GRAFT|AMT|AMNIOTIC)\b/i;

export function stageIndex(stageId) {
  return WORKFLOW_STAGES.findIndex((s) => s.id === stageId);
}

export function nextStage(stageId) {
  const idx = stageIndex(stageId);
  if (idx < 0 || idx >= WORKFLOW_STAGES.length - 1) return stageId;
  return WORKFLOW_STAGES[idx + 1].id;
}

export function procedureRequiresTissue(plannedProcedure) {
  return TISSUE_PROCEDURE_PATTERN.test(String(plannedProcedure || ''));
}

export function defaultSafetyChecklist() {
  const checklist = {};
  for (const item of SAFETY_CHECKLIST_ITEMS) {
    checklist[item.key] = { done: false, at: null, by: null, note: '' };
  }
  return checklist;
}

export function computeChecklistCompletion(checklist, plannedProcedure) {
  const items = SAFETY_CHECKLIST_ITEMS.filter((item) => {
    if (item.key === 'donor_tissue_confirmed') return procedureRequiresTissue(plannedProcedure);
    if (item.key === 'implant_available') return false;
    return item.mandatory;
  });
  if (!items.length) return 100;
  const done = items.filter((item) => checklist?.[item.key]?.done === true).length;
  return Math.round((done / items.length) * 100);
}

export function mandatoryChecklistIncomplete(checklist, plannedProcedure) {
  return SAFETY_CHECKLIST_ITEMS.filter((item) => {
    if (!item.mandatory) return false;
    if (item.key === 'donor_tissue_confirmed') return procedureRequiresTissue(plannedProcedure);
    if (item.key === 'implant_available') return false;
    return checklist?.[item.key]?.done !== true;
  }).map((item) => item.key);
}

/** Stages that require completed pre-op + safety checklist unless override is active. */
export function stageRequiresSafetyGate(stageId) {
  const gated = new Set([
    'PRE_OP_VERIFICATION',
    'BLOCK_ROOM',
    'OPERATING_THEATRE',
    'RECOVERY',
    'DISCHARGE'
  ]);
  return gated.has(stageId);
}

export function validateAdvanceToStage(episode, targetStage) {
  if (!stageRequiresSafetyGate(targetStage)) return { ok: true };

  const override = episode.safetyOverride;
  if (override?.active && override?.reason) return { ok: true, overridden: true };

  const incomplete = mandatoryChecklistIncomplete(
    episode.safetyChecklist || {},
    episode.plannedProcedure
  );
  if (incomplete.length) {
    return {
      ok: false,
      code: 'SAFETY_CHECKLIST_INCOMPLETE',
      incomplete,
      message: 'Mandatory pre-operative safety checklist items are incomplete.'
    };
  }

  const fit = episode.preopStatus;
  if (fit === 'NOT_FIT' || fit === 'REQUIRES_REVIEW') {
    return {
      ok: false,
      code: 'PREOP_NOT_CLEARED',
      message: 'Pre-operative clearance is not complete for this patient.'
    };
  }

  if (episode.consentStatus !== 'COMPLETE' && episode.consentStatus !== 'OVERRIDDEN') {
    return {
      ok: false,
      code: 'CONSENT_INCOMPLETE',
      message: 'Consent must be completed before proceeding to OT.'
    };
  }

  if (procedureRequiresTissue(episode.plannedProcedure) && !episode.tissueId) {
    return {
      ok: false,
      code: 'MISSING_DONOR_TISSUE',
      message: 'Donor tissue must be linked for this procedure.'
    };
  }

  return { ok: true };
}

export function deriveSafetyFlags(episode) {
  const flags = [];
  if (episode.consentStatus === 'INCOMPLETE') flags.push('CONSENT_INCOMPLETE');
  if (mandatoryChecklistIncomplete(episode.safetyChecklist, episode.plannedProcedure).includes('correct_eye')) {
    flags.push('WRONG_SIDE_UNVERIFIED');
  }
  if (procedureRequiresTissue(episode.plannedProcedure) && !episode.tissueId) {
    flags.push('MISSING_DONOR_TISSUE');
  }
  const pct = computeChecklistCompletion(episode.safetyChecklist, episode.plannedProcedure);
  if (pct < 100 && stageRequiresSafetyGate(episode.stage)) flags.push('FAILED_CHECKLIST');
  if (episode.preopAssessment?.allergyAlert) flags.push('ALLERGY_ALERT');
  if (episode.whoSignInStatus === 'PENDING' && ['BLOCK_ROOM', 'OPERATING_THEATRE'].includes(episode.stage)) {
    flags.push('WHO_SIGNIN_PENDING');
  }
  if (episode.whoTimeOutStatus === 'PENDING' && episode.stage === 'OPERATING_THEATRE') {
    flags.push('WHO_TIMEOUT_PENDING');
  }
  return flags;
}

/** WHO Surgical Safety Checklist — three phases. */
export const WHO_CHECKLIST_PHASES = Object.freeze([
  {
    id: 'sign_in',
    label: 'Sign in (before anaesthesia)',
    statusField: 'whoSignInStatus',
    items: [
      { key: 'identity_confirmed', label: 'Patient identity confirmed', mandatory: true },
      { key: 'site_marked', label: 'Site marked and confirmed', mandatory: true },
      { key: 'anaesthesia_check', label: 'Anaesthesia safety check complete', mandatory: true },
      { key: 'pulse_oximeter', label: 'Pulse oximeter on and functioning', mandatory: true },
      { key: 'allergy_confirmed', label: 'Known allergy confirmed', mandatory: true },
      { key: 'airway_risk', label: 'Difficult airway / aspiration risk assessed', mandatory: true }
    ]
  },
  {
    id: 'time_out',
    label: 'Time out (before skin incision)',
    statusField: 'whoTimeOutStatus',
    items: [
      { key: 'team_intro', label: 'Team members introduced by name and role', mandatory: true },
      { key: 'procedure_confirmed', label: 'Procedure and site confirmed', mandatory: true },
      { key: 'antibiotic_given', label: 'Antibiotic prophylaxis given (if indicated)', mandatory: false },
      { key: 'critical_steps', label: 'Anticipated critical events reviewed', mandatory: true },
      { key: 'imaging_displayed', label: 'Essential imaging displayed (if applicable)', mandatory: false }
    ]
  },
  {
    id: 'sign_out',
    label: 'Sign out (before leaving theatre)',
    statusField: 'whoSignOutStatus',
    items: [
      { key: 'procedure_recorded', label: 'Procedure name recorded', mandatory: true },
      { key: 'instrument_count', label: 'Instrument / sponge / needle counts correct', mandatory: true },
      { key: 'specimen_labelled', label: 'Specimen labelled (if applicable)', mandatory: false },
      { key: 'equipment_issues', label: 'Equipment problems addressed', mandatory: true }
    ]
  }
]);

export const POSTOP_MILESTONE_STAGES = Object.freeze([
  { id: 'POST_OP_DAY_1', label: 'Post-op day 1' },
  { id: 'POST_OP_WEEK_1', label: 'Post-op week 1' },
  { id: 'POST_OP_MONTH_1', label: 'Post-op month 1' },
  { id: 'POST_OP_MONTH_3', label: 'Post-op month 3' },
  { id: 'POST_OP_MONTH_6', label: 'Post-op month 6' },
  { id: 'LONG_TERM_FOLLOW_UP', label: 'Long-term follow-up' },
  { id: 'FINAL_SURGICAL_OUTCOME', label: 'Final surgical outcome' }
]);

export function defaultWhoChecklist() {
  const checklist = {};
  for (const phase of WHO_CHECKLIST_PHASES) {
    checklist[phase.id] = {};
    for (const item of phase.items) {
      checklist[phase.id][item.key] = { done: false, at: null, by: null, note: '' };
    }
  }
  return checklist;
}

export function whoPhaseComplete(checklist, phaseId) {
  const phase = WHO_CHECKLIST_PHASES.find((p) => p.id === phaseId);
  if (!phase) return false;
  const entries = checklist?.[phaseId] || {};
  return phase.items
    .filter((item) => item.mandatory)
    .every((item) => entries[item.key]?.done === true);
}

export function deriveRequiredActions(episode) {
  const actions = [];
  if (episode.consentStatus === 'INCOMPLETE') actions.push('Complete consent');
  if (episode.preopStatus === 'REQUIRES_REVIEW' || episode.preopStatus === 'NOT_FIT') {
    actions.push('Resolve pre-operative clearance');
  }
  if (mandatoryChecklistIncomplete(episode.safetyChecklist, episode.plannedProcedure).length) {
    actions.push('Complete pre-operative safety checklist');
  }
  if (procedureRequiresTissue(episode.plannedProcedure) && !episode.tissueId) {
    actions.push('Link donor tissue from eye bank');
  }
  if (episode.whoSignInStatus === 'PENDING' && ['BLOCK_ROOM', 'OPERATING_THEATRE', 'RECOVERY'].includes(episode.stage)) {
    actions.push('Complete WHO sign-in');
  }
  if (episode.whoTimeOutStatus === 'PENDING' && ['OPERATING_THEATRE', 'RECOVERY'].includes(episode.stage)) {
    actions.push('Complete WHO time-out');
  }
  if (episode.whoSignOutStatus === 'PENDING' && ['RECOVERY', 'DISCHARGE', 'WARD_DAY_CARE'].includes(episode.stage)) {
    actions.push('Complete WHO sign-out');
  }
  return actions;
}

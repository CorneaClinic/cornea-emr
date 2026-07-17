-- Surgical Centre Phase 1 foundation
-- Longitudinal surgical episode spanning decision -> pre-op -> OT -> post-op.

CREATE TABLE surgical_episodes (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id                   UUID NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
  surgical_episode_id         TEXT NOT NULL,
  patient_id                  UUID REFERENCES patients (id) ON DELETE SET NULL,
  visit_id                    UUID REFERENCES visits (id) ON DELETE SET NULL,
  keratoplasty_patient_id     UUID REFERENCES keratoplasty_patients (id) ON DELETE SET NULL,
  or_case_id                  UUID REFERENCES or_schedule_cases (id) ON DELETE SET NULL,
  tissue_id                   UUID REFERENCES corneal_tissues (id) ON DELETE SET NULL,

  patient_mrn                 TEXT,
  patient_name                TEXT NOT NULL,
  eye                         TEXT NOT NULL,
  diagnosis                   TEXT NOT NULL,
  planned_procedure           TEXT NOT NULL,
  actual_procedure            TEXT,
  surgeon_name                TEXT,
  assistant_name              TEXT,
  anaesthesia_type            TEXT,

  priority                    TEXT NOT NULL DEFAULT 'ELECTIVE',
  stage                       TEXT NOT NULL DEFAULT 'SURGICAL_DECISION',
  stage_status                TEXT NOT NULL DEFAULT 'PENDING',
  workflow_status             TEXT NOT NULL DEFAULT 'OPEN',

  decision_at                 TIMESTAMPTZ,
  scheduled_at                TIMESTAMPTZ,
  surgery_started_at          TIMESTAMPTZ,
  surgery_completed_at        TIMESTAMPTZ,
  discharged_at               TIMESTAMPTZ,
  final_outcome_at            TIMESTAMPTZ,

  preop_status                TEXT,
  consent_status              TEXT NOT NULL DEFAULT 'INCOMPLETE',
  who_sign_in_status          TEXT NOT NULL DEFAULT 'PENDING',
  who_time_out_status         TEXT NOT NULL DEFAULT 'PENDING',
  who_sign_out_status         TEXT NOT NULL DEFAULT 'PENDING',

  safety_flags                JSONB NOT NULL DEFAULT '[]'::jsonb,
  stage_history               JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_actions            JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_documents            JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes                       TEXT,

  revision                    INTEGER NOT NULL DEFAULT 1,
  created_by                  UUID,
  updated_by                  UUID,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT surgical_episodes_episode_id_unique UNIQUE (clinic_id, surgical_episode_id),
  CONSTRAINT surgical_episodes_patient_name_not_blank CHECK (btrim(patient_name) <> ''),
  CONSTRAINT surgical_episodes_eye_valid CHECK (eye IN ('OD', 'OS', 'OU')),
  CONSTRAINT surgical_episodes_priority_valid CHECK (priority IN ('ELECTIVE', 'PRIORITY', 'URGENT', 'EMERGENCY')),
  CONSTRAINT surgical_episodes_stage_valid CHECK (
    stage IN (
      'SURGICAL_RECOMMENDATION',
      'SURGICAL_DECISION',
      'PATIENT_COUNSELLING',
      'CONSENT',
      'PRE_OP_ASSESSMENT',
      'SURGICAL_WAITING_LIST',
      'OT_SCHEDULING',
      'PRE_OP_VERIFICATION',
      'BLOCK_ROOM',
      'OPERATING_THEATRE',
      'RECOVERY',
      'WARD_DAY_CARE',
      'DISCHARGE',
      'POST_OP_DAY_1',
      'POST_OP_WEEK_1',
      'POST_OP_MONTH_1',
      'POST_OP_MONTH_3',
      'POST_OP_MONTH_6',
      'LONG_TERM_FOLLOW_UP',
      'FINAL_SURGICAL_OUTCOME'
    )
  ),
  CONSTRAINT surgical_episodes_stage_status_valid CHECK (stage_status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED')),
  CONSTRAINT surgical_episodes_workflow_status_valid CHECK (workflow_status IN ('OPEN', 'COMPLETED', 'CANCELLED')),
  CONSTRAINT surgical_episodes_who_state_valid CHECK (
    who_sign_in_status IN ('PENDING', 'COMPLETED', 'SKIPPED') AND
    who_time_out_status IN ('PENDING', 'COMPLETED', 'SKIPPED') AND
    who_sign_out_status IN ('PENDING', 'COMPLETED', 'SKIPPED')
  ),
  CONSTRAINT surgical_episodes_consent_valid CHECK (consent_status IN ('INCOMPLETE', 'COMPLETE', 'OVERRIDDEN')),
  CONSTRAINT surgical_episodes_json_arrays CHECK (
    jsonb_typeof(safety_flags) = 'array' AND
    jsonb_typeof(stage_history) = 'array' AND
    jsonb_typeof(required_actions) = 'array' AND
    jsonb_typeof(linked_documents) = 'array'
  ),
  CONSTRAINT surgical_episodes_revision_positive CHECK (revision >= 1)
);

CREATE INDEX idx_surgical_episodes_clinic_stage
  ON surgical_episodes (clinic_id, stage, stage_status);

CREATE INDEX idx_surgical_episodes_clinic_priority
  ON surgical_episodes (clinic_id, priority, workflow_status);

CREATE INDEX idx_surgical_episodes_clinic_patient
  ON surgical_episodes (clinic_id, patient_id, created_at DESC);

CREATE INDEX idx_surgical_episodes_clinic_or_case
  ON surgical_episodes (clinic_id, or_case_id);

CREATE TRIGGER surgical_episodes_set_updated_at
  BEFORE UPDATE ON surgical_episodes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

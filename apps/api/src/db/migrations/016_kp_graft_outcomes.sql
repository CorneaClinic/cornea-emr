-- Cornea EMR — Keratoplasty graft outcomes & rejection registry (Project 5)

ALTER TABLE keratoplasty_patients
  ADD COLUMN IF NOT EXISTS emr_patient_uuid UUID,
  ADD COLUMN IF NOT EXISTS emr_patient_mrn TEXT,
  ADD COLUMN IF NOT EXISTS graft_outcome_status TEXT NOT NULL DEFAULT 'Not applicable';

ALTER TABLE keratoplasty_patients
  DROP CONSTRAINT IF EXISTS keratoplasty_patients_emr_patient_fk;

ALTER TABLE keratoplasty_patients
  ADD CONSTRAINT keratoplasty_patients_emr_patient_fk
    FOREIGN KEY (emr_patient_uuid) REFERENCES patients (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_keratoplasty_patients_emr_patient
  ON keratoplasty_patients (clinic_id, emr_patient_uuid)
  WHERE emr_patient_uuid IS NOT NULL;

-- ---------------------------------------------------------------------------
-- kp_post_graft_exams — serial post-operative follow-up
-- ---------------------------------------------------------------------------

CREATE TABLE kp_post_graft_exams (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID NOT NULL,
  kp_patient_id       UUID NOT NULL,
  eye                 TEXT NOT NULL,
  exam_date           DATE NOT NULL,
  post_op_interval    TEXT,
  bcva                TEXT,
  iop                 NUMERIC(5, 1),
  endothelial_count   INTEGER,
  graft_clarity       TEXT,
  cct_um              INTEGER,
  medications         TEXT,
  visit_uuid          UUID,
  notes               TEXT,
  legacy_local_id     INTEGER,
  revision            INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT kp_post_graft_exams_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT kp_post_graft_exams_kp_patient_fk
    FOREIGN KEY (kp_patient_id) REFERENCES keratoplasty_patients (id) ON DELETE CASCADE,
  CONSTRAINT kp_post_graft_exams_eye_not_blank
    CHECK (btrim(eye) <> ''),
  CONSTRAINT kp_post_graft_exams_revision_positive
    CHECK (revision >= 1)
);

CREATE INDEX idx_kp_post_graft_exams_patient_date
  ON kp_post_graft_exams (clinic_id, kp_patient_id, exam_date DESC);

CREATE UNIQUE INDEX idx_kp_post_graft_exams_legacy_local_id
  ON kp_post_graft_exams (clinic_id, legacy_local_id)
  WHERE legacy_local_id IS NOT NULL;

CREATE TRIGGER kp_post_graft_exams_set_updated_at
  BEFORE UPDATE ON kp_post_graft_exams
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- kp_rejection_episodes
-- ---------------------------------------------------------------------------

CREATE TABLE kp_rejection_episodes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID NOT NULL,
  kp_patient_id       UUID NOT NULL,
  eye                 TEXT NOT NULL,
  onset_date          DATE NOT NULL,
  resolved_date       DATE,
  rejection_grade     TEXT,
  rejection_type      TEXT,
  signs               TEXT,
  treatment           TEXT,
  outcome             TEXT NOT NULL DEFAULT 'Active',
  regraft_date        DATE,
  notes               TEXT,
  legacy_local_id     INTEGER,
  revision            INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT kp_rejection_episodes_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT kp_rejection_episodes_kp_patient_fk
    FOREIGN KEY (kp_patient_id) REFERENCES keratoplasty_patients (id) ON DELETE CASCADE,
  CONSTRAINT kp_rejection_episodes_revision_positive
    CHECK (revision >= 1)
);

CREATE INDEX idx_kp_rejection_episodes_patient
  ON kp_rejection_episodes (clinic_id, kp_patient_id, onset_date DESC);

CREATE UNIQUE INDEX idx_kp_rejection_episodes_legacy_local_id
  ON kp_rejection_episodes (clinic_id, legacy_local_id)
  WHERE legacy_local_id IS NOT NULL;

CREATE TRIGGER kp_rejection_episodes_set_updated_at
  BEFORE UPDATE ON kp_rejection_episodes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

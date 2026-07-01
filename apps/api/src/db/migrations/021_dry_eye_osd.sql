-- P7: Dry eye / ocular surface disease (OSD) clinic module

CREATE TABLE dry_eye_cases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID NOT NULL,
  case_id             TEXT NOT NULL,
  emr_patient_uuid    UUID,
  emr_patient_mrn     TEXT,
  full_name           TEXT NOT NULL,
  primary_subtype     TEXT,
  status              TEXT NOT NULL DEFAULT 'Active',
  onset_date          DATE,
  notes               TEXT,
  legacy_local_id     INTEGER,
  revision            INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT dry_eye_cases_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT dry_eye_cases_emr_patient_fk
    FOREIGN KEY (emr_patient_uuid) REFERENCES patients (id) ON DELETE SET NULL,
  CONSTRAINT dry_eye_cases_clinic_case_id_unique
    UNIQUE (clinic_id, case_id),
  CONSTRAINT dry_eye_cases_full_name_not_blank
    CHECK (btrim(full_name) <> ''),
  CONSTRAINT dry_eye_cases_revision_positive
    CHECK (revision >= 1)
);

CREATE INDEX idx_dry_eye_cases_clinic_status
  ON dry_eye_cases (clinic_id, status);

CREATE UNIQUE INDEX idx_dry_eye_cases_legacy_local_id
  ON dry_eye_cases (clinic_id, legacy_local_id)
  WHERE legacy_local_id IS NOT NULL;

CREATE TRIGGER dry_eye_cases_set_updated_at
  BEFORE UPDATE ON dry_eye_cases
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE dry_eye_assessments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID NOT NULL,
  case_id             UUID NOT NULL,
  assessed_at         DATE NOT NULL,
  tbut_od             NUMERIC(4, 1),
  tbut_os             NUMERIC(4, 1),
  schirmer_od         NUMERIC(4, 1),
  schirmer_os         NUMERIC(4, 1),
  osdi_score          INTEGER,
  deq5_score          INTEGER,
  stain_od            TEXT,
  stain_os            TEXT,
  mgd_grade           TEXT,
  blepharitis         TEXT,
  severity            TEXT,
  osd_index_score     INTEGER,
  treatment_plan      TEXT,
  notes               TEXT,
  legacy_local_id     INTEGER,
  revision            INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT dry_eye_assessments_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT dry_eye_assessments_case_fk
    FOREIGN KEY (case_id) REFERENCES dry_eye_cases (id) ON DELETE CASCADE,
  CONSTRAINT dry_eye_assessments_revision_positive
    CHECK (revision >= 1)
);

CREATE INDEX idx_dry_eye_assessments_case_date
  ON dry_eye_assessments (case_id, assessed_at DESC);

CREATE TRIGGER dry_eye_assessments_set_updated_at
  BEFORE UPDATE ON dry_eye_assessments
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

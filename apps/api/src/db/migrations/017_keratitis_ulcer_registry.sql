-- Cornea EMR — Infectious keratitis & corneal ulcer service module (Project 3)

-- ---------------------------------------------------------------------------
-- keratitis_ulcer_cases
-- ---------------------------------------------------------------------------

CREATE TABLE keratitis_ulcer_cases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID NOT NULL,
  case_id             TEXT NOT NULL,
  emr_patient_uuid    UUID,
  emr_patient_mrn     TEXT,
  full_name           TEXT NOT NULL,
  age                 INTEGER,
  gender              TEXT,
  phone               TEXT,
  eye                 TEXT NOT NULL,
  presentation_date   DATE NOT NULL,
  etiology            TEXT,
  contact_lens        BOOLEAN,
  risk_factors        TEXT,
  ulcer_size_mm       NUMERIC(5, 2),
  depth               TEXT,
  hypopyon_mm         NUMERIC(4, 1),
  severity_score      TEXT,
  antimicrobial_plan  TEXT,
  status              TEXT NOT NULL DEFAULT 'Active',
  healing_date        DATE,
  notes               TEXT,
  legacy_local_id     INTEGER,
  revision            INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT keratitis_ulcer_cases_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT keratitis_ulcer_cases_emr_patient_fk
    FOREIGN KEY (emr_patient_uuid) REFERENCES patients (id) ON DELETE SET NULL,
  CONSTRAINT keratitis_ulcer_cases_clinic_case_id_unique
    UNIQUE (clinic_id, case_id),
  CONSTRAINT keratitis_ulcer_cases_full_name_not_blank
    CHECK (btrim(full_name) <> ''),
  CONSTRAINT keratitis_ulcer_cases_revision_positive
    CHECK (revision >= 1)
);

CREATE INDEX idx_keratitis_ulcer_cases_clinic_status
  ON keratitis_ulcer_cases (clinic_id, status);

CREATE UNIQUE INDEX idx_keratitis_ulcer_cases_legacy_local_id
  ON keratitis_ulcer_cases (clinic_id, legacy_local_id)
  WHERE legacy_local_id IS NOT NULL;

CREATE TRIGGER keratitis_ulcer_cases_set_updated_at
  BEFORE UPDATE ON keratitis_ulcer_cases
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- keratitis_cultures — microbiology
-- ---------------------------------------------------------------------------

CREATE TABLE keratitis_cultures (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID NOT NULL,
  case_id             UUID NOT NULL,
  specimen_date       DATE NOT NULL,
  specimen_type       TEXT,
  gram_stain          TEXT,
  organism            TEXT,
  sensitivity         TEXT,
  notes               TEXT,
  legacy_local_id     INTEGER,
  revision            INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT keratitis_cultures_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT keratitis_cultures_case_fk
    FOREIGN KEY (case_id) REFERENCES keratitis_ulcer_cases (id) ON DELETE CASCADE,
  CONSTRAINT keratitis_cultures_revision_positive
    CHECK (revision >= 1)
);

CREATE INDEX idx_keratitis_cultures_case
  ON keratitis_cultures (clinic_id, case_id, specimen_date DESC);

-- ---------------------------------------------------------------------------
-- keratitis_daily_assessments — serial ulcer monitoring
-- ---------------------------------------------------------------------------

CREATE TABLE keratitis_daily_assessments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID NOT NULL,
  case_id             UUID NOT NULL,
  assessed_at         DATE NOT NULL,
  ulcer_size_mm       NUMERIC(5, 2),
  epithelial_defect_mm NUMERIC(5, 2),
  stromal_infiltrate  TEXT,
  hypopyon_mm         NUMERIC(4, 1),
  bcva                TEXT,
  pain_score          INTEGER,
  healing_status      TEXT NOT NULL DEFAULT 'Unchanged',
  antimicrobial_plan  TEXT,
  notes               TEXT,
  legacy_local_id     INTEGER,
  revision            INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT keratitis_daily_assessments_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT keratitis_daily_assessments_case_fk
    FOREIGN KEY (case_id) REFERENCES keratitis_ulcer_cases (id) ON DELETE CASCADE,
  CONSTRAINT keratitis_daily_assessments_revision_positive
    CHECK (revision >= 1)
);

CREATE INDEX idx_keratitis_daily_assessments_case_date
  ON keratitis_daily_assessments (clinic_id, case_id, assessed_at DESC);

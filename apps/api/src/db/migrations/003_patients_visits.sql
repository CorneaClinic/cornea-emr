-- Cornea EMR — patients and visits (v1.0)

-- ---------------------------------------------------------------------------
-- patients (master demographics per clinic)
-- ---------------------------------------------------------------------------

CREATE TABLE patients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID NOT NULL,
  mrn         TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  dob         DATE,
  sex         TEXT,
  phone       TEXT,
  address     TEXT,
  revision    INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT patients_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT patients_clinic_mrn_unique
    UNIQUE (clinic_id, mrn),
  CONSTRAINT patients_sex_check
    CHECK (sex IS NULL OR sex IN ('Male', 'Female', 'Other')),
  CONSTRAINT patients_mrn_not_blank
    CHECK (btrim(mrn) <> ''),
  CONSTRAINT patients_full_name_not_blank
    CHECK (btrim(full_name) <> ''),
  CONSTRAINT patients_revision_positive
    CHECK (revision >= 1),
  CONSTRAINT patients_dob_not_future
    CHECK (dob IS NULL OR dob <= CURRENT_DATE)
);

CREATE INDEX idx_patients_clinic_name
  ON patients (clinic_id, full_name);

CREATE INDEX idx_patients_clinic_phone
  ON patients (clinic_id, phone)
  WHERE phone IS NOT NULL;

CREATE INDEX idx_patients_clinic_updated
  ON patients (clinic_id, updated_at DESC);

CREATE TRIGGER patients_set_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- visits (encounter header + legacy JSONB payload for Phase A hybrid model)
-- ---------------------------------------------------------------------------

CREATE TABLE visits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL,
  patient_id      UUID NOT NULL,
  visit_date      DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft',
  payload         JSONB NOT NULL DEFAULT '{}',
  legacy_local_id INTEGER,
  revision        INTEGER NOT NULL DEFAULT 1,
  created_by      UUID,
  updated_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT visits_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT visits_patient_fk
    FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT visits_created_by_fk
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT visits_updated_by_fk
    FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT visits_status_check
    CHECK (status IN ('draft', 'finalized', 'cancelled')),
  CONSTRAINT visits_revision_positive
    CHECK (revision >= 1),
  CONSTRAINT visits_visit_date_not_future
    CHECK (visit_date <= CURRENT_DATE + INTERVAL '1 day')
);

CREATE INDEX idx_visits_patient_date
  ON visits (patient_id, visit_date DESC);

CREATE INDEX idx_visits_clinic_updated
  ON visits (clinic_id, updated_at DESC);

CREATE INDEX idx_visits_clinic_status
  ON visits (clinic_id, status);

CREATE INDEX idx_visits_clinic_visit_date
  ON visits (clinic_id, visit_date DESC);

CREATE INDEX idx_visits_payload_gin
  ON visits USING gin (payload jsonb_path_ops);

CREATE UNIQUE INDEX idx_visits_clinic_legacy_local_id
  ON visits (clinic_id, legacy_local_id)
  WHERE legacy_local_id IS NOT NULL;

CREATE TRIGGER visits_set_updated_at
  BEFORE UPDATE ON visits
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER visits_enforce_patient_clinic
  BEFORE INSERT OR UPDATE OF clinic_id, patient_id ON visits
  FOR EACH ROW
  EXECUTE FUNCTION enforce_visit_patient_clinic();

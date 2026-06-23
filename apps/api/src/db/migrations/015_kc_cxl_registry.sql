-- Cornea EMR — Keratoconus & CXL longitudinal registry (Project 2)

-- ---------------------------------------------------------------------------
-- kc_registry_patients — programme enrolment
-- ---------------------------------------------------------------------------

CREATE TABLE kc_registry_patients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID NOT NULL,
  kc_registry_id      TEXT NOT NULL,
  emr_patient_uuid    UUID,
  emr_patient_mrn     TEXT,
  full_name           TEXT NOT NULL,
  age                 INTEGER,
  gender              TEXT,
  phone               TEXT,
  eye_involvement     TEXT,
  diagnosis           TEXT NOT NULL DEFAULT 'Keratoconus',
  staging             TEXT,
  index_date          DATE,
  family_history_kc   BOOLEAN,
  atopy               TEXT,
  eye_rubbing         TEXT,
  status              TEXT NOT NULL DEFAULT 'Active',
  progression_status  TEXT NOT NULL DEFAULT 'None',
  notes               TEXT,
  legacy_local_id     INTEGER,
  revision            INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT kc_registry_patients_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT kc_registry_patients_emr_patient_fk
    FOREIGN KEY (emr_patient_uuid) REFERENCES patients (id) ON DELETE SET NULL,
  CONSTRAINT kc_registry_patients_clinic_kc_id_unique
    UNIQUE (clinic_id, kc_registry_id),
  CONSTRAINT kc_registry_patients_kc_id_not_blank
    CHECK (btrim(kc_registry_id) <> ''),
  CONSTRAINT kc_registry_patients_full_name_not_blank
    CHECK (btrim(full_name) <> ''),
  CONSTRAINT kc_registry_patients_status_not_blank
    CHECK (btrim(status) <> ''),
  CONSTRAINT kc_registry_patients_age_non_negative
    CHECK (age IS NULL OR age >= 0),
  CONSTRAINT kc_registry_patients_revision_positive
    CHECK (revision >= 1)
);

CREATE INDEX idx_kc_registry_patients_clinic_status
  ON kc_registry_patients (clinic_id, status);

CREATE INDEX idx_kc_registry_patients_clinic_index_date
  ON kc_registry_patients (clinic_id, index_date DESC);

CREATE INDEX idx_kc_registry_patients_emr_patient
  ON kc_registry_patients (clinic_id, emr_patient_uuid)
  WHERE emr_patient_uuid IS NOT NULL;

CREATE UNIQUE INDEX idx_kc_registry_patients_clinic_legacy_local_id
  ON kc_registry_patients (clinic_id, legacy_local_id)
  WHERE legacy_local_id IS NOT NULL;

CREATE TRIGGER kc_registry_patients_set_updated_at
  BEFORE UPDATE ON kc_registry_patients
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- kc_topography_readings — serial topography / tomography
-- ---------------------------------------------------------------------------

CREATE TABLE kc_topography_readings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id             UUID NOT NULL,
  kc_patient_id         UUID NOT NULL,
  eye                   TEXT NOT NULL,
  captured_at           DATE NOT NULL,
  device                TEXT,
  kmax                  NUMERIC(6, 2),
  kmean                 NUMERIC(6, 2),
  k1                    NUMERIC(6, 2),
  k2                    NUMERIC(6, 2),
  thinnest_pachy        INTEGER,
  central_pachy         INTEGER,
  bad_d                 NUMERIC(6, 2),
  abcd                  TEXT,
  cone_severity         TEXT,
  cone_location         TEXT,
  anterior_elevation    NUMERIC(8, 2),
  posterior_elevation   NUMERIC(8, 2),
  progression_flag      TEXT NOT NULL DEFAULT 'None',
  delta_kmax            NUMERIC(6, 2),
  visit_uuid            UUID,
  media_asset_id        UUID,
  source                TEXT NOT NULL DEFAULT 'manual',
  notes                 TEXT,
  legacy_local_id       INTEGER,
  revision              INTEGER NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT kc_topography_readings_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT kc_topography_readings_kc_patient_fk
    FOREIGN KEY (kc_patient_id) REFERENCES kc_registry_patients (id) ON DELETE CASCADE,
  CONSTRAINT kc_topography_readings_visit_fk
    FOREIGN KEY (visit_uuid) REFERENCES visits (id) ON DELETE SET NULL,
  CONSTRAINT kc_topography_readings_media_fk
    FOREIGN KEY (media_asset_id) REFERENCES media_assets (id) ON DELETE SET NULL,
  CONSTRAINT kc_topography_readings_eye_not_blank
    CHECK (btrim(eye) <> ''),
  CONSTRAINT kc_topography_readings_revision_positive
    CHECK (revision >= 1)
);

CREATE INDEX idx_kc_topography_readings_patient_eye_date
  ON kc_topography_readings (kc_patient_id, eye, captured_at DESC);

CREATE INDEX idx_kc_topography_readings_clinic_captured
  ON kc_topography_readings (clinic_id, captured_at DESC);

CREATE UNIQUE INDEX idx_kc_topography_readings_legacy_local_id
  ON kc_topography_readings (clinic_id, legacy_local_id)
  WHERE legacy_local_id IS NOT NULL;

CREATE TRIGGER kc_topography_readings_set_updated_at
  BEFORE UPDATE ON kc_topography_readings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- kc_cxl_procedures — cross-linking protocol & outcomes
-- ---------------------------------------------------------------------------

CREATE TABLE kc_cxl_procedures (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id               UUID NOT NULL,
  kc_patient_id           UUID NOT NULL,
  eye                     TEXT NOT NULL,
  procedure_date          DATE NOT NULL,
  protocol                TEXT,
  epi_type                TEXT,
  riboflavin_type         TEXT,
  riboflavin_duration_min INTEGER,
  uv_energy_j_cm2         NUMERIC(6, 2),
  uv_duration_sec         INTEGER,
  uv_power_mw_cm2         NUMERIC(8, 2),
  iontophoresis           BOOLEAN,
  surgeon                 TEXT,
  pre_kmax                NUMERIC(6, 2),
  pre_kmean               NUMERIC(6, 2),
  pre_thinnest_pachy      INTEGER,
  post_kmax_3m            NUMERIC(6, 2),
  post_kmax_6m            NUMERIC(6, 2),
  post_kmax_12m           NUMERIC(6, 2),
  post_kmean_3m           NUMERIC(6, 2),
  post_kmean_6m           NUMERIC(6, 2),
  post_kmean_12m          NUMERIC(6, 2),
  outcome                 TEXT NOT NULL DEFAULT 'Pending',
  complications           TEXT,
  visit_uuid              UUID,
  notes                   TEXT,
  legacy_local_id         INTEGER,
  revision                INTEGER NOT NULL DEFAULT 1,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT kc_cxl_procedures_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT kc_cxl_procedures_kc_patient_fk
    FOREIGN KEY (kc_patient_id) REFERENCES kc_registry_patients (id) ON DELETE CASCADE,
  CONSTRAINT kc_cxl_procedures_visit_fk
    FOREIGN KEY (visit_uuid) REFERENCES visits (id) ON DELETE SET NULL,
  CONSTRAINT kc_cxl_procedures_eye_not_blank
    CHECK (btrim(eye) <> ''),
  CONSTRAINT kc_cxl_procedures_outcome_not_blank
    CHECK (btrim(outcome) <> ''),
  CONSTRAINT kc_cxl_procedures_revision_positive
    CHECK (revision >= 1)
);

CREATE INDEX idx_kc_cxl_procedures_patient_date
  ON kc_cxl_procedures (kc_patient_id, procedure_date DESC);

CREATE INDEX idx_kc_cxl_procedures_clinic_date
  ON kc_cxl_procedures (clinic_id, procedure_date DESC);

CREATE UNIQUE INDEX idx_kc_cxl_procedures_legacy_local_id
  ON kc_cxl_procedures (clinic_id, legacy_local_id)
  WHERE legacy_local_id IS NOT NULL;

CREATE TRIGGER kc_cxl_procedures_set_updated_at
  BEFORE UPDATE ON kc_cxl_procedures
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

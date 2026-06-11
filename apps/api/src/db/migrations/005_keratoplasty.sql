-- Cornea EMR — keratoplasty register (v1.0)

-- ---------------------------------------------------------------------------
-- keratoplasty_patients
-- ---------------------------------------------------------------------------

CREATE TABLE keratoplasty_patients (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id             UUID NOT NULL,
  kp_patient_id         TEXT NOT NULL,
  full_name             TEXT NOT NULL,
  age                   INTEGER,
  gender                TEXT,
  phone                 TEXT,
  address               TEXT,
  eye                   TEXT,
  diagnosis             TEXT,
  procedure             TEXT,
  prognosis             TEXT,
  urgency               TEXT,
  corneal_size_mm       NUMERIC(5, 1),
  donor_age_pref        TEXT,
  endothelial_req       INTEGER,
  infection             TEXT,
  visual_axis           TEXT,
  status                TEXT NOT NULL DEFAULT 'Waiting',
  reg_date              DATE,
  surgery_date          DATE,
  notes                 TEXT,
  recommended_tissue_id UUID,
  legacy_local_id       INTEGER,
  revision              INTEGER NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT keratoplasty_patients_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT keratoplasty_patients_clinic_kp_id_unique
    UNIQUE (clinic_id, kp_patient_id),
  CONSTRAINT keratoplasty_patients_kp_id_not_blank
    CHECK (btrim(kp_patient_id) <> ''),
  CONSTRAINT keratoplasty_patients_full_name_not_blank
    CHECK (btrim(full_name) <> ''),
  CONSTRAINT keratoplasty_patients_status_not_blank
    CHECK (btrim(status) <> ''),
  CONSTRAINT keratoplasty_patients_age_non_negative
    CHECK (age IS NULL OR age >= 0),
  CONSTRAINT keratoplasty_patients_corneal_size_positive
    CHECK (corneal_size_mm IS NULL OR corneal_size_mm > 0),
  CONSTRAINT keratoplasty_patients_endothelial_non_negative
    CHECK (endothelial_req IS NULL OR endothelial_req >= 0),
  CONSTRAINT keratoplasty_patients_revision_positive
    CHECK (revision >= 1)
);

CREATE INDEX idx_keratoplasty_patients_clinic_status
  ON keratoplasty_patients (clinic_id, status);

CREATE INDEX idx_keratoplasty_patients_clinic_reg_date
  ON keratoplasty_patients (clinic_id, reg_date DESC);

CREATE UNIQUE INDEX idx_keratoplasty_patients_clinic_legacy_local_id
  ON keratoplasty_patients (clinic_id, legacy_local_id)
  WHERE legacy_local_id IS NOT NULL;

CREATE TRIGGER keratoplasty_patients_set_updated_at
  BEFORE UPDATE ON keratoplasty_patients
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- corneal_tissues
-- ---------------------------------------------------------------------------

CREATE TABLE corneal_tissues (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id                  UUID NOT NULL,
  kp_tissue_id               TEXT NOT NULL,
  donor_age                  INTEGER,
  donor_gender               TEXT,
  death_to_preservation_hrs  NUMERIC(6, 1),
  preservation_date          DATE,
  expiry_date                DATE,
  specular_count             INTEGER,
  edema                      TEXT,
  clarity                    TEXT,
  infection_risk             TEXT,
  optical_grade              TEXT,
  therapeutic_grade          TEXT,
  tissue_status              TEXT NOT NULL DEFAULT 'Available',
  storage_medium             TEXT,
  storage_location           TEXT,
  eye_bank                   TEXT,
  reserved_kp_patient_id     UUID,
  reserved_for_kp_patient_id TEXT,
  legacy_local_id            INTEGER,
  revision                   INTEGER NOT NULL DEFAULT 1,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT corneal_tissues_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT corneal_tissues_clinic_tissue_id_unique
    UNIQUE (clinic_id, kp_tissue_id),
  CONSTRAINT corneal_tissues_kp_tissue_id_not_blank
    CHECK (btrim(kp_tissue_id) <> ''),
  CONSTRAINT corneal_tissues_tissue_status_not_blank
    CHECK (btrim(tissue_status) <> ''),
  CONSTRAINT corneal_tissues_donor_age_non_negative
    CHECK (donor_age IS NULL OR donor_age >= 0),
  CONSTRAINT corneal_tissues_death_to_preservation_non_negative
    CHECK (death_to_preservation_hrs IS NULL OR death_to_preservation_hrs >= 0),
  CONSTRAINT corneal_tissues_specular_non_negative
    CHECK (specular_count IS NULL OR specular_count >= 0),
  CONSTRAINT corneal_tissues_expiry_after_preservation
    CHECK (
      expiry_date IS NULL
      OR preservation_date IS NULL
      OR expiry_date >= preservation_date
    ),
  CONSTRAINT corneal_tissues_revision_positive
    CHECK (revision >= 1)
);

CREATE INDEX idx_corneal_tissues_clinic_status
  ON corneal_tissues (clinic_id, tissue_status);

CREATE INDEX idx_corneal_tissues_clinic_expiry
  ON corneal_tissues (clinic_id, expiry_date)
  WHERE expiry_date IS NOT NULL;

CREATE UNIQUE INDEX idx_corneal_tissues_clinic_legacy_local_id
  ON corneal_tissues (clinic_id, legacy_local_id)
  WHERE legacy_local_id IS NOT NULL;

CREATE INDEX idx_corneal_tissues_reserved_kp_patient
  ON corneal_tissues (reserved_kp_patient_id)
  WHERE reserved_kp_patient_id IS NOT NULL;

CREATE TRIGGER corneal_tissues_set_updated_at
  BEFORE UPDATE ON corneal_tissues
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Cross references (deferred to avoid circular dependency at CREATE time)
-- ---------------------------------------------------------------------------

ALTER TABLE keratoplasty_patients
  ADD CONSTRAINT keratoplasty_patients_recommended_tissue_fk
    FOREIGN KEY (recommended_tissue_id)
    REFERENCES corneal_tissues (id)
    ON DELETE SET NULL;

ALTER TABLE corneal_tissues
  ADD CONSTRAINT corneal_tissues_reserved_kp_patient_fk
    FOREIGN KEY (reserved_kp_patient_id)
    REFERENCES keratoplasty_patients (id)
    ON DELETE SET NULL;

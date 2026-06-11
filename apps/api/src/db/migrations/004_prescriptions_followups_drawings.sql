-- Cornea EMR — prescriptions, followups, drawings (v1.0)

-- ---------------------------------------------------------------------------
-- prescriptions (normalized medical advice / medication lines per visit)
-- ---------------------------------------------------------------------------

CREATE TABLE prescriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id     UUID NOT NULL,
  clinic_id    UUID NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  eye          TEXT,
  drug_name    TEXT,
  route        TEXT,
  duration     TEXT,
  frequency    TEXT,
  form         TEXT,
  instruction  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT prescriptions_visit_fk
    FOREIGN KEY (visit_id) REFERENCES visits (id) ON DELETE CASCADE,
  CONSTRAINT prescriptions_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT prescriptions_sort_order_non_negative
    CHECK (sort_order >= 0)
);

CREATE INDEX idx_prescriptions_visit_sort
  ON prescriptions (visit_id, sort_order);

CREATE INDEX idx_prescriptions_clinic
  ON prescriptions (clinic_id);

CREATE TRIGGER prescriptions_set_updated_at
  BEFORE UPDATE ON prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER prescriptions_enforce_clinic
  BEFORE INSERT OR UPDATE OF visit_id, clinic_id ON prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_child_clinic_matches_visit();

-- ---------------------------------------------------------------------------
-- followups (one row per visit)
-- ---------------------------------------------------------------------------

CREATE TABLE followups (
  visit_id       UUID PRIMARY KEY,
  clinic_id      UUID NOT NULL,
  follow_up_date DATE,
  interval_code  TEXT,
  custom_date    DATE,
  place          TEXT,
  purpose        TEXT,
  severity       TEXT,
  remarks        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT followups_visit_fk
    FOREIGN KEY (visit_id) REFERENCES visits (id) ON DELETE CASCADE,
  CONSTRAINT followups_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT followups_severity_check
    CHECK (severity IS NULL OR severity IN ('severe', 'moderate', 'mild'))
);

CREATE INDEX idx_followups_clinic_date
  ON followups (clinic_id, follow_up_date);

CREATE INDEX idx_followups_clinic_updated
  ON followups (clinic_id, updated_at DESC);

CREATE TRIGGER followups_set_updated_at
  BEFORE UPDATE ON followups
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER followups_enforce_clinic
  BEFORE INSERT OR UPDATE OF visit_id, clinic_id ON followups
  FOR EACH ROW
  EXECUTE FUNCTION enforce_child_clinic_matches_visit();

-- ---------------------------------------------------------------------------
-- drawings (anterior segment annotation + object-storage references)
-- ---------------------------------------------------------------------------

CREATE TABLE drawings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id         UUID NOT NULL,
  clinic_id        UUID NOT NULL,
  annotation_json  JSONB NOT NULL DEFAULT '{}',
  storage_key      TEXT,
  svg_storage_key  TEXT,
  mime_type        TEXT NOT NULL DEFAULT 'image/png',
  byte_size        BIGINT,
  checksum         TEXT,
  revision         INTEGER NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT drawings_visit_fk
    FOREIGN KEY (visit_id) REFERENCES visits (id) ON DELETE CASCADE,
  CONSTRAINT drawings_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT drawings_visit_unique
    UNIQUE (visit_id),
  CONSTRAINT drawings_mime_type_check
    CHECK (mime_type IN ('image/png', 'image/svg+xml')),
  CONSTRAINT drawings_byte_size_non_negative
    CHECK (byte_size IS NULL OR byte_size >= 0),
  CONSTRAINT drawings_revision_positive
    CHECK (revision >= 1)
);

CREATE INDEX idx_drawings_clinic
  ON drawings (clinic_id);

CREATE INDEX idx_drawings_clinic_updated
  ON drawings (clinic_id, updated_at DESC);

CREATE TRIGGER drawings_set_updated_at
  BEFORE UPDATE ON drawings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER drawings_enforce_clinic
  BEFORE INSERT OR UPDATE OF visit_id, clinic_id ON drawings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_child_clinic_matches_visit();

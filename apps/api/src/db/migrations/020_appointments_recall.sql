-- Cornea EMR — Appointments & recall (P5)

CREATE TABLE appointments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id               UUID NOT NULL,
  appointment_id          TEXT NOT NULL,
  patient_id              UUID,
  patient_mrn             TEXT,
  patient_name            TEXT NOT NULL,
  patient_phone           TEXT,
  appointment_date        DATE NOT NULL,
  start_time              TIME,
  duration_minutes        INTEGER NOT NULL DEFAULT 15,
  appointment_type        TEXT NOT NULL DEFAULT 'visit',
  station                 TEXT,
  status                  TEXT NOT NULL DEFAULT 'scheduled',
  reason                  TEXT,
  recall_source_visit_id  UUID,
  notes                   TEXT,
  legacy_local_id         INTEGER,
  revision                INTEGER NOT NULL DEFAULT 1,
  created_by              UUID,
  updated_by              UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT appointments_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT appointments_patient_fk
    FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE SET NULL,
  CONSTRAINT appointments_recall_visit_fk
    FOREIGN KEY (recall_source_visit_id) REFERENCES visits (id) ON DELETE SET NULL,
  CONSTRAINT appointments_created_by_fk
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT appointments_updated_by_fk
    FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT appointments_clinic_appt_id_unique
    UNIQUE (clinic_id, appointment_id),
  CONSTRAINT appointments_type_check
    CHECK (appointment_type IN ('visit', 'recall', 'procedure', 'review')),
  CONSTRAINT appointments_status_check
    CHECK (status IN ('scheduled', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show')),
  CONSTRAINT appointments_duration_positive
    CHECK (duration_minutes > 0 AND duration_minutes <= 480),
  CONSTRAINT appointments_name_not_blank
    CHECK (btrim(patient_name) <> ''),
  CONSTRAINT appointments_revision_positive
    CHECK (revision >= 1)
);

CREATE INDEX idx_appointments_clinic_date
  ON appointments (clinic_id, appointment_date, start_time);

CREATE INDEX idx_appointments_clinic_status
  ON appointments (clinic_id, status);

CREATE INDEX idx_appointments_clinic_patient
  ON appointments (clinic_id, patient_id);

CREATE INDEX idx_appointments_clinic_updated
  ON appointments (clinic_id, updated_at DESC);

CREATE UNIQUE INDEX idx_appointments_clinic_legacy_local_id
  ON appointments (clinic_id, legacy_local_id)
  WHERE legacy_local_id IS NOT NULL;

CREATE TRIGGER appointments_set_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

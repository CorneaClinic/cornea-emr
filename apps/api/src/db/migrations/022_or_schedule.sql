-- P7: OR scheduling prototype (corneal surgery theatre list)

CREATE TABLE or_schedule_cases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID NOT NULL,
  case_number         TEXT NOT NULL,
  appointment_id      TEXT,
  patient_id          UUID,
  patient_name        TEXT NOT NULL,
  patient_mrn         TEXT,
  procedure_date      DATE NOT NULL,
  start_time          TIME,
  duration_minutes    INTEGER NOT NULL DEFAULT 60,
  procedure_type      TEXT NOT NULL,
  surgeon_name        TEXT,
  theatre             TEXT,
  status              TEXT NOT NULL DEFAULT 'scheduled',
  preop_checklist     JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes               TEXT,
  revision            INTEGER NOT NULL DEFAULT 1,
  created_by          UUID,
  updated_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT or_schedule_cases_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT or_schedule_cases_patient_fk
    FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE SET NULL,
  CONSTRAINT or_schedule_cases_clinic_case_number_unique
    UNIQUE (clinic_id, case_number),
  CONSTRAINT or_schedule_cases_patient_name_not_blank
    CHECK (btrim(patient_name) <> ''),
  CONSTRAINT or_schedule_cases_revision_positive
    CHECK (revision >= 1),
  CONSTRAINT or_schedule_cases_duration_positive
    CHECK (duration_minutes > 0)
);

CREATE INDEX idx_or_schedule_cases_clinic_date
  ON or_schedule_cases (clinic_id, procedure_date, start_time);

CREATE INDEX idx_or_schedule_cases_clinic_status
  ON or_schedule_cases (clinic_id, status);

CREATE TRIGGER or_schedule_cases_set_updated_at
  BEFORE UPDATE ON or_schedule_cases
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

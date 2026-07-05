-- Project 2 — duplicate patient prevention (optional national ID + search index)

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS national_id TEXT;

ALTER TABLE patients
  ADD CONSTRAINT patients_national_id_not_blank
  CHECK (national_id IS NULL OR btrim(national_id) <> '');

CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_clinic_national_id
  ON patients (clinic_id, national_id)
  WHERE national_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patients_clinic_dob_sex
  ON patients (clinic_id, dob, sex)
  WHERE dob IS NOT NULL;

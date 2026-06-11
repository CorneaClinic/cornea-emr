-- Security hardening: account lockout, forced password change, clinic ICD credentials

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_failed_login_count_nonneg;

ALTER TABLE users
  ADD CONSTRAINT users_failed_login_count_nonneg
    CHECK (failed_login_count >= 0);

CREATE TABLE IF NOT EXISTS icd_credentials (
  clinic_id                 UUID PRIMARY KEY,
  client_id                 TEXT NOT NULL,
  client_secret_encrypted   TEXT NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT icd_credentials_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT icd_credentials_client_id_not_blank
    CHECK (btrim(client_id) <> ''),
  CONSTRAINT icd_credentials_secret_not_blank
    CHECK (btrim(client_secret_encrypted) <> '')
);

DROP TRIGGER IF EXISTS icd_credentials_set_updated_at ON icd_credentials;

CREATE TRIGGER icd_credentials_set_updated_at
  BEFORE UPDATE ON icd_credentials
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

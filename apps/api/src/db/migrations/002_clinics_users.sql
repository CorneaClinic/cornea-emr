-- Cornea EMR — clinics and users (v1.0)
--
-- Requires a database with only foundation tables (000_foundation.sql).
-- Legacy v0.1 tables (organizations, users, encounters, kp_*) must not exist.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('organizations', 'encounters', 'kp_patients', 'kp_tissues')
  ) THEN
    RAISE EXCEPTION
      'Legacy v0.1 schema detected (organizations/encounters/kp_*). '
      'Apply these migrations on a fresh database, or drop legacy tables first.';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = 'users'
       AND NOT EXISTS (
         SELECT 1
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'clinic_id'
       )
  ) THEN
    RAISE EXCEPTION
      'Existing users table without clinic_id (legacy v0.1). '
      'Use a fresh database before applying v1.0 clinical schema migrations.';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- clinics (tenant root)
-- ---------------------------------------------------------------------------

CREATE TABLE clinics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  settings    JSONB NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'active'
    CONSTRAINT clinics_status_check
      CHECK (status IN ('active', 'suspended')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clinics_slug_unique UNIQUE (slug),
  CONSTRAINT clinics_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT clinics_slug_not_blank CHECK (btrim(slug) <> '')
);

CREATE INDEX idx_clinics_status ON clinics (status);

CREATE TRIGGER clinics_set_updated_at
  BEFORE UPDATE ON clinics
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL,
  email           TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'doctor',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  revision        INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT users_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT users_clinic_email_unique
    UNIQUE (clinic_id, email),
  CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'doctor', 'refractionist', 'nurse', 'clerk')),
  CONSTRAINT users_email_not_blank
    CHECK (btrim(email) <> ''),
  CONSTRAINT users_full_name_not_blank
    CHECK (btrim(full_name) <> ''),
  CONSTRAINT users_password_hash_not_blank
    CHECK (btrim(password_hash) <> ''),
  CONSTRAINT users_revision_positive
    CHECK (revision >= 1)
);

CREATE INDEX idx_users_clinic_active
  ON users (clinic_id, is_active)
  WHERE is_active = true;

CREATE INDEX idx_users_clinic_role
  ON users (clinic_id, role);

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

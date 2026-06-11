-- Cornea EMR — authentication sessions and password reset (v1.1)
-- Updates user roles and adds refresh-token session storage.

-- ---------------------------------------------------------------------------
-- Role migration (legacy v1.0 → production RBAC)
-- ---------------------------------------------------------------------------

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

UPDATE users
   SET role = CASE role
     WHEN 'doctor' THEN 'ophthalmologist'
     WHEN 'refractionist' THEN 'optometrist'
     WHEN 'nurse' THEN 'technician'
     WHEN 'clerk' THEN 'receptionist'
     ELSE role
   END
 WHERE role IN ('doctor', 'refractionist', 'nurse', 'clerk');

ALTER TABLE users ALTER COLUMN role SET DEFAULT 'ophthalmologist';

ALTER TABLE users
  ADD CONSTRAINT users_role_check
    CHECK (role IN (
      'admin',
      'cornea_consultant',
      'ophthalmologist',
      'optometrist',
      'technician',
      'receptionist'
    ));

-- ---------------------------------------------------------------------------
-- user_sessions (rotating refresh token families)
-- ---------------------------------------------------------------------------

CREATE TABLE user_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,
  clinic_id    UUID NOT NULL,
  family_id    UUID NOT NULL,
  token_hash   TEXT NOT NULL,
  user_agent   TEXT,
  ip_address   INET,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  replaced_by  UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT user_sessions_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT user_sessions_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT user_sessions_replaced_by_fk
    FOREIGN KEY (replaced_by) REFERENCES user_sessions (id) ON DELETE SET NULL,
  CONSTRAINT user_sessions_token_hash_not_blank
    CHECK (btrim(token_hash) <> ''),
  CONSTRAINT user_sessions_expires_after_create
    CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX idx_user_sessions_token_hash
  ON user_sessions (token_hash);

CREATE INDEX idx_user_sessions_user_active
  ON user_sessions (user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX idx_user_sessions_family
  ON user_sessions (family_id);

CREATE INDEX idx_user_sessions_clinic
  ON user_sessions (clinic_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- password_reset_tokens (single-use, time-limited)
-- ---------------------------------------------------------------------------

CREATE TABLE password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT password_reset_tokens_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT password_reset_tokens_token_hash_not_blank
    CHECK (btrim(token_hash) <> ''),
  CONSTRAINT password_reset_tokens_expires_after_create
    CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX idx_password_reset_tokens_hash
  ON password_reset_tokens (token_hash)
  WHERE used_at IS NULL;

CREATE INDEX idx_password_reset_tokens_user
  ON password_reset_tokens (user_id, created_at DESC);

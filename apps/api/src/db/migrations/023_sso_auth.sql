-- SSO / LDAP / OIDC identity linking (backlog B4)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS external_subject TEXT;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_auth_provider_check;
ALTER TABLE users
  ADD CONSTRAINT users_auth_provider_check
    CHECK (auth_provider IN ('local', 'ldap', 'oidc'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_password_hash_not_blank;
ALTER TABLE users
  ADD CONSTRAINT users_password_hash_check
    CHECK (auth_provider <> 'local' OR btrim(password_hash) <> '');

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_external_identity
  ON users (clinic_id, auth_provider, external_subject)
  WHERE external_subject IS NOT NULL;

INSERT INTO app_metadata (key, value)
VALUES (
  'sso_auth',
  jsonb_build_object('version', '1.0.0', 'installed_at', now())
)
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();

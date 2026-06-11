-- Cornea EMR — foundation schema (v0.2)
-- Platform tables only; clinical EMR tables ship in legacy migrations.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Application metadata (version tracking, future feature flags)
CREATE TABLE IF NOT EXISTS app_metadata (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_metadata (key, value)
VALUES ('foundation', jsonb_build_object('version', '0.2.0', 'installed_at', now()))
ON CONFLICT (key) DO NOTHING;

-- Per-user EMR section visibility overrides (admin-assigned).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS emr_sections JSONB NULL;

COMMENT ON COLUMN users.emr_sections IS
  'Optional override map of EMR UI section id -> boolean. NULL = role defaults.';

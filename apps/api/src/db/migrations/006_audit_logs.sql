-- Cornea EMR — audit logs (v1.0)

-- ---------------------------------------------------------------------------
-- audit_logs (append-only, tenant-scoped activity trail)
-- ---------------------------------------------------------------------------

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID NOT NULL,
  user_id     UUID,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  action      TEXT NOT NULL,
  diff        JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT audit_logs_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT audit_logs_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT audit_logs_entity_type_not_blank
    CHECK (btrim(entity_type) <> ''),
  CONSTRAINT audit_logs_entity_id_not_blank
    CHECK (btrim(entity_id) <> ''),
  CONSTRAINT audit_logs_action_not_blank
    CHECK (btrim(action) <> '')
);

CREATE INDEX idx_audit_logs_clinic_time
  ON audit_logs (clinic_id, created_at DESC);

CREATE INDEX idx_audit_logs_user_time
  ON audit_logs (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX idx_audit_logs_entity
  ON audit_logs (clinic_id, entity_type, entity_id);

CREATE INDEX idx_audit_logs_action
  ON audit_logs (clinic_id, action, created_at DESC);

CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION audit_logs_deny_mutation();

-- ---------------------------------------------------------------------------
-- Schema version marker
-- ---------------------------------------------------------------------------

INSERT INTO app_metadata (key, value)
VALUES (
  'clinical_schema',
  jsonb_build_object(
    'version', '1.0.0',
    'tables', jsonb_build_array(
      'clinics',
      'users',
      'patients',
      'visits',
      'prescriptions',
      'followups',
      'drawings',
      'keratoplasty_patients',
      'corneal_tissues',
      'audit_logs'
    ),
    'installed_at', now()
  )
)
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();

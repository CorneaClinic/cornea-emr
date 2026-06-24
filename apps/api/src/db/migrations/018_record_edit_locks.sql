-- Cornea EMR — collaborative edit locks (Project 8)

CREATE TABLE record_edit_locks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID NOT NULL,
  entity_type         TEXT NOT NULL,
  entity_id           UUID NOT NULL,
  locked_by_user_id   UUID NOT NULL,
  locked_by_name      TEXT,
  device_id           TEXT,
  acquired_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL,

  CONSTRAINT record_edit_locks_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT record_edit_locks_user_fk
    FOREIGN KEY (locked_by_user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT record_edit_locks_entity_type_check
    CHECK (entity_type IN ('visit', 'kp_patient', 'kp_tissue')),
  CONSTRAINT record_edit_locks_unique_entity
    UNIQUE (clinic_id, entity_type, entity_id)
);

CREATE INDEX idx_record_edit_locks_expires
  ON record_edit_locks (expires_at);

CREATE INDEX idx_record_edit_locks_clinic_type
  ON record_edit_locks (clinic_id, entity_type, expires_at DESC);

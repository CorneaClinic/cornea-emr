-- Cornea EMR — sync infrastructure (v1.2)
-- Idempotent mutations, pull cursors, conflict tracking, sync logs.

-- ---------------------------------------------------------------------------
-- client_mutations (idempotent push replay)
-- ---------------------------------------------------------------------------

CREATE TABLE client_mutations (
  mutation_id   UUID PRIMARY KEY,
  clinic_id     UUID NOT NULL,
  user_id       UUID,
  device_id     TEXT,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT,
  operation     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'applied'
    CONSTRAINT client_mutations_status_check
      CHECK (status IN ('applied', 'conflict', 'error')),
  result        JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT client_mutations_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT client_mutations_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX idx_client_mutations_clinic_time
  ON client_mutations (clinic_id, created_at DESC);

CREATE INDEX idx_client_mutations_entity
  ON client_mutations (clinic_id, entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- sync_cursors (per-device pull position)
-- ---------------------------------------------------------------------------

CREATE TABLE sync_cursors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID NOT NULL,
  user_id       UUID NOT NULL,
  device_id     TEXT NOT NULL,
  cursor_token  TEXT NOT NULL DEFAULT '0',
  last_pull_at  TIMESTAMPTZ,
  last_push_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sync_cursors_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT sync_cursors_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT sync_cursors_device_not_blank
    CHECK (btrim(device_id) <> ''),
  CONSTRAINT sync_cursors_unique_device
    UNIQUE (clinic_id, user_id, device_id)
);

-- ---------------------------------------------------------------------------
-- sync_conflicts (server-side conflict registry)
-- ---------------------------------------------------------------------------

CREATE TABLE sync_conflicts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID NOT NULL,
  user_id             UUID,
  device_id           TEXT,
  entity_type         TEXT NOT NULL,
  entity_id           TEXT NOT NULL,
  client_mutation_id  UUID,
  client_revision     INTEGER,
  server_revision     INTEGER,
  client_state        JSONB,
  server_state        JSONB,
  status              TEXT NOT NULL DEFAULT 'open'
    CONSTRAINT sync_conflicts_status_check
      CHECK (status IN ('open', 'resolved_server', 'resolved_client', 'dismissed')),
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sync_conflicts_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT sync_conflicts_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX idx_sync_conflicts_clinic_open
  ON sync_conflicts (clinic_id, status, created_at DESC)
  WHERE status = 'open';

-- ---------------------------------------------------------------------------
-- sync_logs (server-side sync activity trail)
-- ---------------------------------------------------------------------------

CREATE TABLE sync_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID NOT NULL,
  user_id     UUID,
  device_id   TEXT,
  direction   TEXT NOT NULL
    CONSTRAINT sync_logs_direction_check
      CHECK (direction IN ('push', 'pull', 'conflict', 'system')),
  level       TEXT NOT NULL DEFAULT 'info'
    CONSTRAINT sync_logs_level_check
      CHECK (level IN ('debug', 'info', 'warn', 'error')),
  message     TEXT NOT NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sync_logs_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT sync_logs_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX idx_sync_logs_clinic_time
  ON sync_logs (clinic_id, created_at DESC);

CREATE INDEX idx_sync_logs_device
  ON sync_logs (clinic_id, device_id, created_at DESC)
  WHERE device_id IS NOT NULL;

-- Cornea EMR — Eye bank traceability (Project 10)

ALTER TABLE corneal_tissues
  ADD COLUMN IF NOT EXISTS donor_id TEXT,
  ADD COLUMN IF NOT EXISTS lot_number TEXT,
  ADD COLUMN IF NOT EXISTS tissue_laterality TEXT,
  ADD COLUMN IF NOT EXISTS serology_hiv TEXT,
  ADD COLUMN IF NOT EXISTS serology_hbv TEXT,
  ADD COLUMN IF NOT EXISTS serology_hcv TEXT,
  ADD COLUMN IF NOT EXISTS serology_syphilis TEXT,
  ADD COLUMN IF NOT EXISTS serology_cmv TEXT,
  ADD COLUMN IF NOT EXISTS serology_cleared_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quarantine_status TEXT NOT NULL DEFAULT 'Cleared',
  ADD COLUMN IF NOT EXISTS quarantine_reason TEXT,
  ADD COLUMN IF NOT EXISTS quarantine_until DATE,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

ALTER TABLE corneal_tissues
  DROP CONSTRAINT IF EXISTS corneal_tissues_quarantine_status_check;

ALTER TABLE corneal_tissues
  ADD CONSTRAINT corneal_tissues_quarantine_status_check
    CHECK (quarantine_status IN ('Quarantine', 'Cleared', 'Failed', 'Released'));

CREATE INDEX IF NOT EXISTS idx_corneal_tissues_quarantine
  ON corneal_tissues (clinic_id, quarantine_status);

-- ---------------------------------------------------------------------------
-- eye_bank_custody_events — chain of custody
-- ---------------------------------------------------------------------------

CREATE TABLE eye_bank_custody_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL,
  tissue_id       UUID NOT NULL,
  event_type      TEXT NOT NULL,
  from_party      TEXT,
  to_party        TEXT,
  actor_name      TEXT,
  location        TEXT,
  notes           TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  legacy_local_id INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT eye_bank_custody_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT eye_bank_custody_tissue_fk
    FOREIGN KEY (tissue_id) REFERENCES corneal_tissues (id) ON DELETE CASCADE,
  CONSTRAINT eye_bank_custody_event_type_check
    CHECK (event_type IN (
      'Received', 'Quarantine', 'Released', 'Reserved', 'Transferred',
      'Shipped', 'Implanted', 'Discarded', 'Audit'
    ))
);

CREATE INDEX idx_eye_bank_custody_tissue_time
  ON eye_bank_custody_events (tissue_id, occurred_at DESC);

CREATE UNIQUE INDEX idx_eye_bank_custody_legacy_local_id
  ON eye_bank_custody_events (clinic_id, legacy_local_id)
  WHERE legacy_local_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- eye_bank_cold_chain_events — temperature / storage checks
-- ---------------------------------------------------------------------------

CREATE TABLE eye_bank_cold_chain_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL,
  tissue_id       UUID NOT NULL,
  event_type      TEXT NOT NULL,
  temperature_c   NUMERIC(5, 2),
  location        TEXT,
  in_range        BOOLEAN,
  notes           TEXT,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by     TEXT,
  legacy_local_id INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT eye_bank_cold_chain_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT eye_bank_cold_chain_tissue_fk
    FOREIGN KEY (tissue_id) REFERENCES corneal_tissues (id) ON DELETE CASCADE,
  CONSTRAINT eye_bank_cold_chain_event_type_check
    CHECK (event_type IN ('Storage check', 'Transfer', 'Out of range', 'Corrected', 'Alarm'))
);

CREATE INDEX idx_eye_bank_cold_chain_tissue_time
  ON eye_bank_cold_chain_events (tissue_id, recorded_at DESC);

CREATE UNIQUE INDEX idx_eye_bank_cold_chain_legacy_local_id
  ON eye_bank_cold_chain_events (clinic_id, legacy_local_id)
  WHERE legacy_local_id IS NOT NULL;

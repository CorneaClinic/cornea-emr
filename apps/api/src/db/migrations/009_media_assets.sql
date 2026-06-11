-- Cornea EMR — clinical media assets (v1.0)
-- Files stored on disk/object storage; metadata and links kept separately from visit payloads.

-- ---------------------------------------------------------------------------
-- media_assets (binary file metadata — not embedded in patient/visit JSON)
-- ---------------------------------------------------------------------------

CREATE TABLE media_assets (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id          UUID NOT NULL,
  category           TEXT NOT NULL,
  original_filename  TEXT NOT NULL,
  storage_key        TEXT NOT NULL,
  mime_type          TEXT NOT NULL,
  byte_size          BIGINT NOT NULL,
  checksum           TEXT NOT NULL,
  width              INTEGER,
  height             INTEGER,
  metadata           JSONB NOT NULL DEFAULT '{}',
  status             TEXT NOT NULL DEFAULT 'ready',
  created_by         UUID,
  updated_by         UUID,
  revision           INTEGER NOT NULL DEFAULT 1,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ,

  CONSTRAINT media_assets_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT media_assets_created_by_fk
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT media_assets_updated_by_fk
    FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT media_assets_category_check
    CHECK (category IN (
      'slit_lamp',
      'corneal_topography',
      'as_oct',
      'donor_cornea',
      'anterior_drawing'
    )),
  CONSTRAINT media_assets_status_check
    CHECK (status IN ('pending', 'ready', 'deleted')),
  CONSTRAINT media_assets_byte_size_non_negative
    CHECK (byte_size >= 0),
  CONSTRAINT media_assets_revision_positive
    CHECK (revision >= 1),
  CONSTRAINT media_assets_storage_key_clinic_unique
    UNIQUE (clinic_id, storage_key),
  CONSTRAINT media_assets_original_filename_not_blank
    CHECK (btrim(original_filename) <> ''),
  CONSTRAINT media_assets_storage_key_not_blank
    CHECK (btrim(storage_key) <> ''),
  CONSTRAINT media_assets_checksum_not_blank
    CHECK (btrim(checksum) <> '')
);

CREATE INDEX idx_media_assets_clinic_category
  ON media_assets (clinic_id, category)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_media_assets_clinic_updated
  ON media_assets (clinic_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_media_assets_clinic_status
  ON media_assets (clinic_id, status)
  WHERE deleted_at IS NULL;

CREATE TRIGGER media_assets_set_updated_at
  BEFORE UPDATE ON media_assets
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- media_asset_links (associate files with visits, patients, KP entities)
-- ---------------------------------------------------------------------------

CREATE TABLE media_asset_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id  UUID NOT NULL,
  clinic_id       UUID NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  eye             TEXT,
  label           TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT media_asset_links_media_fk
    FOREIGN KEY (media_asset_id) REFERENCES media_assets (id) ON DELETE CASCADE,
  CONSTRAINT media_asset_links_clinic_fk
    FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
  CONSTRAINT media_asset_links_entity_type_check
    CHECK (entity_type IN ('visit', 'patient', 'keratoplasty_patient', 'corneal_tissue')),
  CONSTRAINT media_asset_links_sort_order_non_negative
    CHECK (sort_order >= 0),
  CONSTRAINT media_asset_links_unique
    UNIQUE (media_asset_id, entity_type, entity_id)
);

CREATE INDEX idx_media_asset_links_entity
  ON media_asset_links (clinic_id, entity_type, entity_id);

CREATE INDEX idx_media_asset_links_media
  ON media_asset_links (media_asset_id);

-- ---------------------------------------------------------------------------
-- drawings — link rendered PNG/SVG to media_assets (annotation stays in-row)
-- ---------------------------------------------------------------------------

ALTER TABLE drawings
  ADD COLUMN IF NOT EXISTS png_media_asset_id UUID,
  ADD COLUMN IF NOT EXISTS svg_media_asset_id UUID;

ALTER TABLE drawings
  DROP CONSTRAINT IF EXISTS drawings_png_media_asset_fk;

ALTER TABLE drawings
  ADD CONSTRAINT drawings_png_media_asset_fk
    FOREIGN KEY (png_media_asset_id) REFERENCES media_assets (id) ON DELETE SET NULL;

ALTER TABLE drawings
  DROP CONSTRAINT IF EXISTS drawings_svg_media_asset_fk;

ALTER TABLE drawings
  ADD CONSTRAINT drawings_svg_media_asset_fk
    FOREIGN KEY (svg_media_asset_id) REFERENCES media_assets (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Schema version marker
-- ---------------------------------------------------------------------------

INSERT INTO app_metadata (key, value)
VALUES (
  'clinical_schema',
  jsonb_build_object(
    'version', '1.1.0',
    'tables', jsonb_build_array(
      'clinics',
      'users',
      'patients',
      'visits',
      'prescriptions',
      'followups',
      'drawings',
      'media_assets',
      'media_asset_links',
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

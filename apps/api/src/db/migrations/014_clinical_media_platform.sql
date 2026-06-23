-- Cornea EMR — Clinical Media Platform (persistent object storage readiness)
-- Expands categories, adds storage provider metadata, rich patient linking, indexes.

ALTER TABLE media_assets DROP CONSTRAINT IF EXISTS media_assets_category_check;

ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS bucket TEXT,
  ADD COLUMN IF NOT EXISTS etag TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_key TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE media_assets
  ADD CONSTRAINT media_assets_storage_provider_check
    CHECK (storage_provider IN ('local', 's3'));

ALTER TABLE media_assets
  ADD CONSTRAINT media_assets_category_check
    CHECK (category IN (
      'slit_lamp',
      'corneal_topography',
      'topography',
      'tomography',
      'as_oct',
      'specular',
      'confocal',
      'anterior_drawing',
      'corneal_drawing',
      'operative_photo',
      'video',
      'pdf_report',
      'donor_cornea',
      'referral',
      'teaching_case',
      'research',
      'other'
    ));

CREATE INDEX IF NOT EXISTS idx_media_assets_clinic_checksum
  ON media_assets (clinic_id, checksum)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_media_assets_archived
  ON media_assets (clinic_id, archived_at)
  WHERE deleted_at IS NULL;

-- Rich clinical linking on media_asset_links
ALTER TABLE media_asset_links
  ADD COLUMN IF NOT EXISTS module_name TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis_label TEXT,
  ADD COLUMN IF NOT EXISTS procedure_label TEXT,
  ADD COLUMN IF NOT EXISTS provider_user_id UUID,
  ADD COLUMN IF NOT EXISTS capture_location TEXT,
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;

ALTER TABLE media_asset_links
  DROP CONSTRAINT IF EXISTS media_asset_links_provider_user_fk;

ALTER TABLE media_asset_links
  ADD CONSTRAINT media_asset_links_provider_user_fk
    FOREIGN KEY (provider_user_id) REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_media_asset_links_patient_timeline
  ON media_asset_links (clinic_id, entity_type, entity_id, captured_at DESC NULLS LAST);

INSERT INTO app_metadata (key, value)
VALUES (
  'clinical_media_platform',
  jsonb_build_object(
    'version', '1.0.0',
    'installed_at', now(),
    'features', jsonb_build_array(
      's3_storage_provider',
      'expanded_categories',
      'media_library',
      'patient_timeline',
      'signed_urls',
      'teaching_tags'
    )
  )
)
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();

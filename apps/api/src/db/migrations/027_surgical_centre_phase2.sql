-- Surgical Centre Phase 2 — pre-op assessment, safety checklist, scheduling metadata

ALTER TABLE surgical_episodes
  ADD COLUMN IF NOT EXISTS preop_assessment JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS safety_checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS safety_override JSONB;

ALTER TABLE surgical_episodes
  ADD CONSTRAINT surgical_episodes_preop_assessment_object
    CHECK (jsonb_typeof(preop_assessment) = 'object');

ALTER TABLE surgical_episodes
  ADD CONSTRAINT surgical_episodes_safety_checklist_object
    CHECK (jsonb_typeof(safety_checklist) = 'object');

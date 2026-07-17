-- Surgical Centre Phase 3/4 — WHO checklist detail, post-op follow-ups

ALTER TABLE surgical_episodes
  ADD COLUMN IF NOT EXISTS who_checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS postop_followups JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE surgical_episodes
  ADD CONSTRAINT surgical_episodes_who_checklist_object
    CHECK (jsonb_typeof(who_checklist) = 'object');

ALTER TABLE surgical_episodes
  ADD CONSTRAINT surgical_episodes_postop_followups_array
    CHECK (jsonb_typeof(postop_followups) = 'array');

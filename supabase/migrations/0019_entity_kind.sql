-- Entity kind + current_role.
-- Per PROBE spec §2.1: entities carry a "kind" (person / org / etc.)
-- that drives how the entity is projected. The existing
-- entity_type column from 0002 already has the right values; we add
-- a "kind" alias for spec consistency and a few new fields:
--   - kind: spec vocabulary (person / org / institution / concept /
--     event). Mirrors entity_type for now; chat tools write to both.
--   - current_role: short label for "what they do right now" — used
--     by both character profiles and entity-page headers. Currently
--     denormalized on character_profiles; pull it up so any entity
--     can carry it.
--   - bio_md / bio_html: structured bio. character_profiles will
--     remain as a denormalized cache for person-kind entities, but
--     the canonical bio lives on the entity row.
--
-- The migration is additive: existing entity_type stays. New code can
-- write kind; reading falls back to entity_type when kind is null.

ALTER TABLE entities ADD COLUMN kind TEXT
  CHECK (kind IN ('person','org','institution','concept','event','place','program','instrument'));
ALTER TABLE entities ADD COLUMN current_role TEXT;
ALTER TABLE entities ADD COLUMN bio_md TEXT;
ALTER TABLE entities ADD COLUMN bio_html TEXT;

-- Backfill kind from entity_type. The PROBE vocabulary is a subset of
-- the existing entity_type list; map cleanly.
UPDATE entities SET kind = CASE entity_type
  WHEN 'person' THEN 'person'
  WHEN 'organization' THEN 'org'
  WHEN 'corporation' THEN 'org'
  WHEN 'institution' THEN 'institution'
  WHEN 'department' THEN 'institution'
  WHEN 'office' THEN 'institution'
  WHEN 'legislation' THEN 'concept'
  WHEN 'event' THEN 'event'
  WHEN 'concept' THEN 'concept'
  WHEN 'location' THEN 'place'
  ELSE 'concept'
END WHERE kind IS NULL;

CREATE INDEX entities_user_kind_idx ON entities (user_id, kind) WHERE kind IS NOT NULL;

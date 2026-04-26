-- Migration 0006 — Entities + entity_mentions
-- See canopticon-schema-v1.0.md §5.
--
-- entity_mentions ships in Sprint 1 with entity_id NULLABLE; resolution to a
-- canonical entity_id is Sprint 2 work (see canopticon-entity-resolution-v1.0.md).
-- Mentions with NULL entity_id are unresolved and the operator triages them
-- via the ingestion review surface.

CREATE TABLE public.entities (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  entity_type     entity_type NOT NULL,
  canonical_name  TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  aliases         TEXT[] NOT NULL DEFAULT '{}',
  description     TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  slug            TEXT,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_excluded     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE INDEX idx_entities_user_type
  ON public.entities (user_id, entity_type);
CREATE INDEX idx_entities_canonical_trgm
  ON public.entities USING gin (canonical_name gin_trgm_ops);
CREATE INDEX idx_entities_aliases
  ON public.entities USING gin (aliases);

COMMENT ON TABLE public.entities IS
  'Graph nodes. People, organizations, events, legislation, concepts.';
COMMENT ON COLUMN public.entities.aliases IS
  'Alternative names and references. Used by entity resolution to merge mentions.';

CREATE TABLE public.entity_mentions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_id               UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  entity_id               UUID REFERENCES public.entities(id) ON DELETE SET NULL,
  mention_text            TEXT NOT NULL,
  context_excerpt         TEXT,
  position_start          INTEGER,
  position_end            INTEGER,
  resolution_confidence   NUMERIC(3,2),
  resolved_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entity_mentions_source
  ON public.entity_mentions (source_id);
CREATE INDEX idx_entity_mentions_entity
  ON public.entity_mentions (entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX idx_entity_mentions_unresolved
  ON public.entity_mentions (user_id, source_id) WHERE entity_id IS NULL;

COMMENT ON TABLE public.entity_mentions IS
  'Raw mentions of entities in sources, before resolution to canonical entity. Mentions with NULL entity_id are unresolved.';

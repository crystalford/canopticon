-- Migration 0005 — Sources, ingestion critic reports, ingestion actions
-- See canopticon-schema-v1.0.md §4.

CREATE TABLE public.sources (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_type         source_type NOT NULL,
  title               TEXT NOT NULL,
  url                 TEXT,
  publication         TEXT,
  author              TEXT,
  published_at        TIMESTAMPTZ,
  retrieved_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  admiralty_grade     admiralty_grade NOT NULL,
  bias_profile        JSONB,
  ingestion_mode      ingestion_mode NOT NULL,
  ingestion_state     ingestion_state NOT NULL DEFAULT 'pending_critic',
  storage_uri         TEXT,
  raw_text            TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  slug                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE INDEX idx_sources_user_state
  ON public.sources (user_id, ingestion_state, retrieved_at DESC);
CREATE INDEX idx_sources_user_grade
  ON public.sources (user_id, admiralty_grade);
CREATE INDEX idx_sources_url
  ON public.sources (user_id, url) WHERE url IS NOT NULL;
CREATE INDEX idx_sources_title_trgm
  ON public.sources USING gin (title gin_trgm_ops);

COMMENT ON TABLE public.sources IS
  'Source Registry. Every source ever ingested with provenance and grading.';
COMMENT ON COLUMN public.sources.bias_profile IS
  'Structured bias notes (lean, ownership, prior known errors). JSON shape: { lean: string, ownership: string, notes: string[] }';

CREATE TABLE public.ingestion_critic_reports (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_id               UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  role_invocation_id      UUID,
  proposed_grade          admiralty_grade NOT NULL,
  bias_assessment         TEXT NOT NULL,
  compatibility_check     TEXT NOT NULL,
  contradiction_flags     JSONB NOT NULL DEFAULT '[]'::jsonb,
  watch_set_matches       JSONB NOT NULL DEFAULT '[]'::jsonb,
  paid_op_required        BOOLEAN NOT NULL DEFAULT FALSE,
  paid_op_estimate_cents  INTEGER,
  reasoning               TEXT NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_critic_reports_source
  ON public.ingestion_critic_reports (source_id);

COMMENT ON TABLE public.ingestion_critic_reports IS
  'Ingestion Critic role outputs. Every source has at least one report before approval.';

CREATE TABLE public.ingestion_actions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_id   UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  action      ingestion_state NOT NULL
              CHECK (action IN ('approved', 'deferred', 'rejected')),
  notes       TEXT,
  acted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ingestion_actions_source
  ON public.ingestion_actions (source_id, acted_at DESC);

COMMENT ON TABLE public.ingestion_actions IS
  'Operator decisions on pending ingestions. Append-only.';

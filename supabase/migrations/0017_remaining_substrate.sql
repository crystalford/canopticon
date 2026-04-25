-- Migration 0017 — remaining substrate tables.
--
-- Adds the analytical tables that the publication-gate roles, predictions
-- ledger, articles surface, and book graph all need. Schemas mirror
-- canopticon-schema-v1.0.md §8–§10, §13. RLS owner-only on every table.

-- 8.1 assumptions ---------------------------------------------------------

CREATE TYPE assumption_status AS ENUM ('holding', 'shaken', 'broken', 'retired');

CREATE TABLE public.assumptions (
  id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id                       UUID REFERENCES public.theses(id) ON DELETE CASCADE,
  text                            TEXT NOT NULL,
  status                          assumption_status NOT NULL DEFAULT 'holding',
  is_linchpin                     BOOLEAN NOT NULL DEFAULT FALSE,
  consequence_if_failed           TEXT,
  last_audited_at                 TIMESTAMPTZ,
  last_audit_role_invocation_id   UUID,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assumptions_thesis ON public.assumptions (thesis_id) WHERE thesis_id IS NOT NULL;
CREATE INDEX idx_assumptions_linchpin ON public.assumptions (user_id) WHERE is_linchpin = TRUE;
CREATE INDEX idx_assumptions_status ON public.assumptions (user_id, status);

ALTER TABLE public.assumptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY assumptions_owner_all ON public.assumptions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_assumptions_updated_at
  BEFORE UPDATE ON public.assumptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8.2 assumption_supporting_claims ----------------------------------------

CREATE TABLE public.assumption_supporting_claims (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assumption_id   UUID NOT NULL REFERENCES public.assumptions(id) ON DELETE CASCADE,
  claim_id        UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  supports        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assumption_id, claim_id)
);

CREATE INDEX idx_asc_assumption ON public.assumption_supporting_claims (assumption_id);
CREATE INDEX idx_asc_claim ON public.assumption_supporting_claims (claim_id);

ALTER TABLE public.assumption_supporting_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY asc_owner_all ON public.assumption_supporting_claims
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 8.3 indicators + observations -------------------------------------------

CREATE TABLE public.indicators (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id           UUID REFERENCES public.theses(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  definition          TEXT NOT NULL,
  source_uri          TEXT,
  cadence             TEXT,
  threshold           JSONB,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  validation_role_invocation_id UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_indicators_user ON public.indicators (user_id, is_active);
CREATE INDEX idx_indicators_thesis ON public.indicators (thesis_id) WHERE thesis_id IS NOT NULL;

ALTER TABLE public.indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY indicators_owner_all ON public.indicators
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_indicators_updated_at
  BEFORE UPDATE ON public.indicators
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.indicator_observations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  indicator_id    UUID NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  source_id       UUID REFERENCES public.sources(id) ON DELETE SET NULL,
  observed_value  JSONB NOT NULL,
  observed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_indicator_observations_indicator
  ON public.indicator_observations (indicator_id, observed_at DESC);

ALTER TABLE public.indicator_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY indicator_observations_owner_all ON public.indicator_observations
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 8.5 contradictions ------------------------------------------------------

CREATE TYPE contradiction_severity AS ENUM ('minor', 'notable', 'major');
CREATE TYPE contradiction_status AS ENUM ('open', 'resolved', 'machloket', 'dismissed');

CREATE TABLE public.contradictions (
  id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id                       UUID REFERENCES public.theses(id) ON DELETE CASCADE,
  target_claim_id                 UUID REFERENCES public.claims(id) ON DELETE SET NULL,
  objection_text                  TEXT NOT NULL,
  evidence_gap                    TEXT,
  severity                        contradiction_severity NOT NULL DEFAULT 'minor',
  status                          contradiction_status NOT NULL DEFAULT 'open',
  resolution_note                 TEXT,
  resolved_at                     TIMESTAMPTZ,
  generated_by                    TEXT NOT NULL,
  generated_by_role_invocation_id UUID,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contradictions_thesis ON public.contradictions (thesis_id) WHERE thesis_id IS NOT NULL;
CREATE INDEX idx_contradictions_target ON public.contradictions (target_claim_id) WHERE target_claim_id IS NOT NULL;
CREATE INDEX idx_contradictions_status ON public.contradictions (user_id, status);

ALTER TABLE public.contradictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY contradictions_owner_all ON public.contradictions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_contradictions_updated_at
  BEFORE UPDATE ON public.contradictions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9 predictions -----------------------------------------------------------

CREATE TYPE prediction_status AS ENUM (
  'active',
  'resolved_correct',
  'resolved_incorrect',
  'resolved_ambiguous',
  'retired'
);

CREATE TABLE public.predictions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id               UUID REFERENCES public.theses(id) ON DELETE SET NULL,
  text                    TEXT NOT NULL,
  probability             NUMERIC(4,3) NOT NULL CHECK (probability >= 0 AND probability <= 1),
  ipcc_qualifier          ipcc_likelihood,
  resolution_criteria     TEXT NOT NULL,
  resolution_horizon_at   TIMESTAMPTZ,
  status                  prediction_status NOT NULL DEFAULT 'active',
  resolved_at             TIMESTAMPTZ,
  brier_contribution      NUMERIC(5,4),
  domain                  TEXT,
  premortem_role_invocation_id UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_predictions_user_status ON public.predictions (user_id, status, created_at DESC);
CREATE INDEX idx_predictions_thesis ON public.predictions (thesis_id) WHERE thesis_id IS NOT NULL;

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY predictions_owner_all ON public.predictions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_predictions_updated_at
  BEFORE UPDATE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 10 articles -------------------------------------------------------------

CREATE TYPE article_status AS ENUM ('draft', 'published', 'corrected', 'retracted');

CREATE TABLE public.articles (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id               UUID REFERENCES public.theses(id) ON DELETE SET NULL,
  current_version_id      UUID,
  title                   TEXT NOT NULL,
  slug                    TEXT NOT NULL,
  status                  article_status NOT NULL DEFAULT 'draft',
  is_public               BOOLEAN NOT NULL DEFAULT FALSE,
  published_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE INDEX idx_articles_user_status ON public.articles (user_id, status);
CREATE INDEX idx_articles_public ON public.articles (user_id, is_public) WHERE is_public = TRUE;

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY articles_owner_all ON public.articles
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY articles_public_read ON public.articles
  FOR SELECT USING (is_public = TRUE);

CREATE TRIGGER trg_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.article_versions (
  id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id                      UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id                         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  version_number                  INTEGER NOT NULL CHECK (version_number > 0),
  is_current                      BOOLEAN NOT NULL DEFAULT FALSE,
  body                            TEXT NOT NULL,
  bluf                            TEXT,
  ipcc_likelihood                 ipcc_likelihood,
  written_by_role                 role_name,
  written_by_role_invocation_id   UUID,
  change_summary                  TEXT,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (article_id, version_number)
);

CREATE INDEX idx_article_versions_current ON public.article_versions (article_id) WHERE is_current = TRUE;

ALTER TABLE public.articles
  ADD CONSTRAINT fk_articles_current_version
  FOREIGN KEY (current_version_id) REFERENCES public.article_versions(id);

ALTER TABLE public.article_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY article_versions_owner_all ON public.article_versions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.article_claims (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  article_id  UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  claim_id    UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (article_id, claim_id)
);

CREATE INDEX idx_article_claims_article ON public.article_claims (article_id);

ALTER TABLE public.article_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY article_claims_owner_all ON public.article_claims
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.article_corrections (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  article_id      UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  correction_text TEXT NOT NULL,
  is_public       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_article_corrections_article ON public.article_corrections (article_id, created_at DESC);

ALTER TABLE public.article_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY article_corrections_owner_all ON public.article_corrections
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY article_corrections_public_read ON public.article_corrections
  FOR SELECT USING (is_public = TRUE);

-- 13 books ----------------------------------------------------------------

CREATE TYPE book_ingest_mode AS ENUM ('surface', 'substrate', 'influence');

CREATE TABLE public.books (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  authors             TEXT[] NOT NULL DEFAULT '{}',
  isbn                TEXT,
  publication_year    INTEGER,
  publisher           TEXT,
  ingest_mode         book_ingest_mode NOT NULL,
  source_id           UUID REFERENCES public.sources(id),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_books_user ON public.books (user_id);

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY books_owner_all ON public.books
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_books_updated_at
  BEFORE UPDATE ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

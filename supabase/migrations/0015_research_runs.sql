-- Migration 0015 — research_runs
--
-- One row per AI research mission. The operator submits a topic; the
-- agent loops with tool use (web_search, fetch_url, register_source,
-- query_substrate, mark_done) until done or budget exhausted; this row
-- captures the run's state, conversation history, and tallies.
--
-- conversation is the full Anthropic messages array — keeping it inline
-- means a research run can be replayed, audited, or resumed without
-- additional joins. For runs with very long histories we may later move
-- to R2-backed storage; until then JSONB is fine.

CREATE TABLE public.research_runs (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id               UUID REFERENCES public.theses(id) ON DELETE SET NULL,
  topic                   TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'running'
                          CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  started_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at                TIMESTAMPTZ,
  iterations              INTEGER NOT NULL DEFAULT 0,
  sources_registered      INTEGER NOT NULL DEFAULT 0,
  claims_extracted        INTEGER NOT NULL DEFAULT 0,
  total_cost_cents        INTEGER NOT NULL DEFAULT 0,
  budget_cents            INTEGER NOT NULL CHECK (budget_cents > 0),
  max_iterations          INTEGER NOT NULL DEFAULT 10 CHECK (max_iterations > 0),
  conversation            JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_summary          TEXT,
  error_detail            TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX idx_research_runs_user_status
  ON public.research_runs (user_id, status, started_at DESC);
CREATE INDEX idx_research_runs_thesis
  ON public.research_runs (thesis_id, started_at DESC) WHERE thesis_id IS NOT NULL;

COMMENT ON TABLE public.research_runs IS
  'AI research missions. Each row is one operator-initiated research session — the agent loops with tool use until done, exhausted, or cancelled. conversation holds the full Anthropic messages array for replay/audit.';
COMMENT ON COLUMN public.research_runs.budget_cents IS
  'Hard ceiling for this run. The cost gate blocks further iterations once total_cost_cents approaches budget_cents.';

-- updated_at trigger
CREATE TRIGGER trg_research_runs_updated_at
  BEFORE UPDATE ON public.research_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.research_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY research_runs_owner_all ON public.research_runs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

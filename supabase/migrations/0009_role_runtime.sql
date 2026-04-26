-- Migration 0009 — Role definitions, invocations, orchestrator events, cascade runs
-- See canopticon-schema-v1.0.md §11.

CREATE TABLE public.role_definitions (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name                        role_name NOT NULL,
  prompt_template             TEXT NOT NULL,
  default_model               TEXT NOT NULL,
  uses_citations_api          BOOLEAN NOT NULL DEFAULT FALSE,
  uses_structured_output      BOOLEAN NOT NULL DEFAULT FALSE,
  output_schema               JSONB,
  skill_md_hash               TEXT,
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

COMMENT ON TABLE public.role_definitions IS
  'Role configurations. Per-user so operators can tune their own prompt templates. Seeded for new users via trigger or signup hook (0012).';

CREATE TABLE public.role_invocations (
  id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_name                       role_name NOT NULL,
  triggered_by                    TEXT NOT NULL,
  input_substrate                 JSONB NOT NULL,
  prompt_used                     TEXT NOT NULL,
  model                           TEXT NOT NULL,
  tokens_input                    INTEGER,
  tokens_output                   INTEGER,
  cost_cents                      INTEGER,
  cost_ledger_id                  UUID REFERENCES public.cost_ledger(id),
  output_text                     TEXT,
  output_structured               JSONB,
  citations_returned              JSONB,
  status                          TEXT NOT NULL
                                  CHECK (status IN ('success', 'error', 'partial')),
  error_detail                    TEXT,
  cross_model_verification_id     UUID,
  started_at                      TIMESTAMPTZ NOT NULL,
  ended_at                        TIMESTAMPTZ NOT NULL,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ended_at >= started_at)
);

CREATE INDEX idx_role_invocations_user_role
  ON public.role_invocations (user_id, role_name, created_at DESC);
CREATE INDEX idx_role_invocations_triggered
  ON public.role_invocations (user_id, triggered_by, created_at DESC);

COMMENT ON TABLE public.role_invocations IS
  'Audit log of every role run. Required for the role-log surface in operator UI and for cost reconciliation.';

CREATE TABLE public.orchestrator_events (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type                  TEXT NOT NULL,
  entity_id                   UUID,
  entity_type_str             TEXT,
  payload                     JSONB NOT NULL DEFAULT '{}'::jsonb,
  triggered_role_invocations  UUID[] DEFAULT '{}',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orch_events_user_type
  ON public.orchestrator_events (user_id, event_type, created_at DESC);
CREATE INDEX idx_orch_events_entity
  ON public.orchestrator_events (entity_id, created_at DESC);

COMMENT ON TABLE public.orchestrator_events IS
  'Event bus. Event types follow noun.verb_past_tense naming. The SSE endpoint (/v1/orchestrator/events) tails this table.';

CREATE TABLE public.cascade_runs (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  triggered_by                TEXT NOT NULL
                              CHECK (triggered_by IN ('cron', 'operator_manual')),
  started_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at                    TIMESTAMPTZ,
  status                      TEXT NOT NULL DEFAULT 'running'
                              CHECK (status IN ('running', 'completed', 'failed', 'partial')),
  sources_ingested            INTEGER NOT NULL DEFAULT 0,
  claims_written              INTEGER NOT NULL DEFAULT 0,
  questions_generated         INTEGER NOT NULL DEFAULT 0,
  contradictions_detected     INTEGER NOT NULL DEFAULT 0,
  total_cost_cents            INTEGER NOT NULL DEFAULT 0,
  role_invocation_ids         UUID[] DEFAULT '{}',
  error_summary               TEXT,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX idx_cascade_runs_user
  ON public.cascade_runs (user_id, started_at DESC);

COMMENT ON TABLE public.cascade_runs IS
  'Per-execution log of morning cascade. Surfaced on Live screen as last-run stats.';

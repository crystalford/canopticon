-- Migration 0013 — workflow_runs
-- See canopticon-workflows-v1.0.md §0.3.
--
-- Generic workflow status table for non-cascade workflows (ingestion-only,
-- watch-set-update, contradiction-resolution, etc.). The morning cascade
-- has its own dedicated cascade_runs table (0009) because of its
-- distinctive aggregate metrics.
--
-- steps_completed is a JSONB array of step-name strings; the orchestrator
-- writes a step name BEFORE work begins (so a partial-failure replay knows
-- the step started) and AGAIN AFTER work completes (so a successful step
-- is idempotent on retry). See workflows-v1.0 §0.4 on idempotency.

CREATE TABLE public.workflow_runs (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workflow_name           TEXT NOT NULL,
  triggered_by            TEXT NOT NULL,
  started_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at                TIMESTAMPTZ,
  status                  TEXT NOT NULL DEFAULT 'running'
                          CHECK (status IN ('running', 'completed', 'failed', 'partial')),
  steps_completed         JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_cost_cents        INTEGER NOT NULL DEFAULT 0,
  role_invocation_ids     UUID[] DEFAULT '{}',
  error_step              TEXT,
  error_detail            TEXT,
  output_summary          JSONB,
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX idx_workflow_runs_user
  ON public.workflow_runs (user_id, started_at DESC);
CREATE INDEX idx_workflow_runs_name
  ON public.workflow_runs (user_id, workflow_name, started_at DESC);

COMMENT ON TABLE public.workflow_runs IS
  'Per-execution log of non-cascade workflows. Idempotency contract: every step appends to steps_completed before AND after work; replays read steps_completed and skip done steps.';

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY workflow_runs_owner_all ON public.workflow_runs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

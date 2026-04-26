-- Migration 0004 — Cost ledger + whitelists
-- See canopticon-schema-v1.0.md §3.2, §3.3.
--
-- Append-only log of every paid operation. The chokepoint that enforces the
-- no-silent-spending discipline. cost_whitelists holds per-operation
-- pre-approval rules so routine cheap ops don't prompt every time.

CREATE TABLE public.cost_ledger (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  operation_type              cost_operation_type NOT NULL,
  provider                    TEXT NOT NULL,
  model_or_sku                TEXT,
  cost_cents                  INTEGER NOT NULL CHECK (cost_cents >= 0),
  related_role_invocation_id  UUID,
  related_source_id           UUID,
  metadata                    JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_by_operator        BOOLEAN NOT NULL,
  occurred_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cost_ledger_user_month
  ON public.cost_ledger (user_id, occurred_at DESC);
CREATE INDEX idx_cost_ledger_operation_type
  ON public.cost_ledger (user_id, operation_type, occurred_at DESC);

COMMENT ON TABLE public.cost_ledger IS
  'Append-only log of every paid operation. Sums per user per month determine ceiling enforcement.';
COMMENT ON COLUMN public.cost_ledger.approved_by_operator IS
  'Was the operation approved via the cost-approval modal? False means it ran on a pre-approved whitelist.';

CREATE TABLE public.cost_whitelists (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  operation_type      cost_operation_type NOT NULL,
  per_op_max_cents    INTEGER NOT NULL CHECK (per_op_max_cents >= 0),
  daily_max_cents     INTEGER CHECK (daily_max_cents IS NULL OR daily_max_cents >= 0),
  monthly_max_cents   INTEGER CHECK (monthly_max_cents IS NULL OR monthly_max_cents >= 0),
  enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, operation_type)
);

COMMENT ON TABLE public.cost_whitelists IS
  'Per-operation pre-approval rules. If an operation matches a whitelist row and is under the cap, it runs without prompting.';

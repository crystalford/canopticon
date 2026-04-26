-- Migration 0016 — cost_approvals
--
-- The cost gate's "operator approval required" branch needs somewhere to
-- park a proposed paid operation while waiting for the operator's
-- decision. cost_approvals is that table.
--
-- Lifecycle:
--   1. Cost gate decides operator approval is needed for a paid op.
--   2. Inserts a cost_approvals row with status='pending', returns the
--      proposal_id to the caller and emits a cost.operation_proposed event.
--   3. The web app's cost-approval modal sees the SSE event, lets the
--      operator approve or deny.
--   4. POST /v1/orchestrator/approve-cost flips the row's status and
--      records the decision.
--   5. The pending caller (or its retry) re-runs the cost gate with the
--      proposal_id; the gate consumes the matching approval and proceeds.
--
-- Approvals are single-use: status='approved' + consumed_at NULL means
-- "ready for the caller to use"; consumed_at NOT NULL means "spent".

CREATE TABLE public.cost_approvals (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  operation_type          cost_operation_type NOT NULL,
  estimate_cents          INTEGER NOT NULL CHECK (estimate_cents >= 0),
  provider                TEXT NOT NULL,
  model_or_sku            TEXT,
  /** Free-form context the cost gate / requester provides (research_run_id,
      claim_id, etc.) — surfaced to the operator in the approval modal. */
  context                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  /** Stable token the requester uses to claim the approval after the
      operator decides. Generated server-side at proposal time. */
  proposal_id             UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
  responded_at            TIMESTAMPTZ,
  /** When the approval was actually used to gate a paid operation. NULL
      means the approval is still claimable. */
  consumed_at             TIMESTAMPTZ,
  /** Operator-supplied note when denying (e.g., "too expensive"). */
  decision_note           TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at              TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes'
);

CREATE INDEX idx_cost_approvals_user_status
  ON public.cost_approvals (user_id, status, created_at DESC);
CREATE INDEX idx_cost_approvals_pending
  ON public.cost_approvals (user_id) WHERE status = 'pending';

COMMENT ON TABLE public.cost_approvals IS
  'Pending / responded operator approvals for paid operations the cost gate cannot auto-approve. proposal_id is the claim token; consumed_at marks single-use.';

ALTER TABLE public.cost_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY cost_approvals_owner_all ON public.cost_approvals
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

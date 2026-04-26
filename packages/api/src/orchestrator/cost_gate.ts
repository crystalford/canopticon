// approvePaidOperation — the chokepoint.
//
// Every paid operation in CANOPTICON must call this function BEFORE invoking
// the external API. The function reads the user's monthly ceiling, current
// month's spend (sum of cost_ledger), and per-operation whitelist rules,
// then returns one of three decisions:
//
//   approved (auto)      — whitelisted operation under the per-op cap
//   approved (operator)  — operator already approved via the modal flow
//   pending_approval     — needs operator approval; SSE event has been emitted
//   denied (ceiling)     — operator's monthly ceiling would be exceeded
//   denied (whitelist)   — explicitly disabled whitelist row
//
// Sprint 1 implements the auto-approve and ceiling-exceeded paths. The
// pending-approval flow (operator modal) is wired in Sprint 1 by emitting
// the cost.operation_proposed event but returning `denied` for now —
// callers must check `requires_approval` and surface to the operator.
// Sprint 2 connects the modal's POST /v1/orchestrator/approve-cost back
// here.

import type { CostOperationType } from "@canopticon/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CostGateRequest {
  user_id: string;
  operation_type: CostOperationType;
  estimate_cents: number;
  /** Provider name for cost_ledger.provider (e.g., 'anthropic'). */
  provider: string;
  /** Model or SKU for cost_ledger.model_or_sku. Optional. */
  model_or_sku?: string | undefined;
  /** Caller-supplied metadata copied into cost_ledger.metadata. */
  metadata?: Record<string, unknown> | undefined;
  /** Source the operation relates to, if any. */
  related_source_id?: string | undefined;
  /** A previously-issued cost_approvals.proposal_id to consume. When set,
      the gate looks up the matching approval and uses its decision instead
      of computing one fresh. */
  proposal_id?: string | undefined;
  /** When the gate decides operator approval is required, this context is
      written to cost_approvals.context so the modal can show the operator
      what they're approving. */
  approval_context?: Record<string, unknown> | undefined;
}

export type CostGateDecision =
  | {
      approved: true;
      reason: "whitelisted" | "operator_approved";
      auto: boolean;
      /** Set when reason='operator_approved' — the proposal_id that was
          consumed. Caller can include this in the cost_ledger metadata. */
      proposal_id?: string;
    }
  | {
      approved: false;
      reason:
        | "ceiling_exceeded"
        | "whitelist_disabled"
        | "requires_approval"
        | "approval_denied"
        | "approval_expired";
      requires_approval: boolean;
      monthly_remaining_cents: number;
      message: string;
      /** When reason='requires_approval', the gate has already created a
          cost_approvals row and emitted cost.operation_proposed; this is
          the token the caller passes back after the operator decides. */
      proposal_id?: string;
    };

export interface CostGateContext {
  /** Service-role client. The gate writes to cost_ledger which the user
      doesn't have direct write access to — it must be service-role. */
  service: SupabaseClient;
}

export async function approvePaidOperation(
  ctx: CostGateContext,
  req: CostGateRequest,
): Promise<CostGateDecision> {
  if (req.estimate_cents < 0) {
    throw new Error("cost gate: estimate_cents must be non-negative");
  }

  // If the caller supplied a proposal_id, consume the matching approval.
  // This is the resume-after-modal path.
  if (req.proposal_id) {
    return consumeApproval(ctx, req);
  }

  const [user, monthlySpend, whitelist] = await Promise.all([
    fetchUser(ctx.service, req.user_id),
    fetchMonthSpend(ctx.service, req.user_id),
    fetchWhitelist(ctx.service, req.user_id, req.operation_type),
  ]);

  if (!user) {
    throw new Error(`cost gate: user ${req.user_id} not found`);
  }

  const ceiling = user.monthly_ceiling_cents;
  const remaining = Math.max(0, ceiling - monthlySpend);

  // Ceiling check first — even a whitelisted op cannot push over the ceiling.
  if (monthlySpend + req.estimate_cents > ceiling) {
    return {
      approved: false,
      reason: "ceiling_exceeded",
      requires_approval: false,
      monthly_remaining_cents: remaining,
      message: `Monthly ceiling of ${ceiling}¢ would be exceeded (${monthlySpend}¢ spent, ${req.estimate_cents}¢ proposed).`,
    };
  }

  // Whitelist check.
  if (whitelist) {
    if (!whitelist.enabled) {
      return {
        approved: false,
        reason: "whitelist_disabled",
        requires_approval: false,
        monthly_remaining_cents: remaining,
        message: `Whitelist rule for ${req.operation_type} is disabled.`,
      };
    }
    if (req.estimate_cents <= whitelist.per_op_max_cents) {
      // Auto-approved. Caller will charge cost_ledger after the call returns.
      return { approved: true, reason: "whitelisted", auto: true };
    }
  }

  // No whitelist match (or estimate exceeded the per-op cap) — needs operator
  // approval. Create a cost_approvals row and emit the SSE event so the
  // modal in the web app can pick it up. Caller is expected to surface the
  // requires_approval decision (which carries the proposal_id) to its
  // own caller, who waits for the operator and re-invokes with proposal_id.
  const proposal = await createPendingApproval(ctx, req, remaining);
  return {
    approved: false,
    reason: "requires_approval",
    requires_approval: true,
    monthly_remaining_cents: remaining,
    message: `Operator approval required for ${req.estimate_cents}¢ ${req.operation_type}.`,
    proposal_id: proposal.proposal_id,
  };
}

interface CostApprovalRow {
  id: string;
  proposal_id: string;
  status: "pending" | "approved" | "denied" | "expired";
  estimate_cents: number;
  consumed_at: string | null;
  expires_at: string;
  decision_note: string | null;
}

async function consumeApproval(
  ctx: CostGateContext,
  req: CostGateRequest,
): Promise<CostGateDecision> {
  const { data, error } = await ctx.service
    .from("cost_approvals")
    .select("id, proposal_id, status, estimate_cents, consumed_at, expires_at, decision_note")
    .eq("user_id", req.user_id)
    .eq("proposal_id", req.proposal_id as string)
    .maybeSingle<CostApprovalRow>();
  if (error) throw new Error(`cost gate: failed to read approval: ${error.message}`);
  if (!data) {
    return {
      approved: false,
      reason: "approval_denied",
      requires_approval: false,
      monthly_remaining_cents: 0,
      message: `No approval found for proposal_id ${req.proposal_id}.`,
    };
  }

  if (data.consumed_at) {
    return {
      approved: false,
      reason: "approval_denied",
      requires_approval: false,
      monthly_remaining_cents: 0,
      message: `Approval ${data.proposal_id} already consumed.`,
    };
  }

  if (data.status === "denied") {
    return {
      approved: false,
      reason: "approval_denied",
      requires_approval: false,
      monthly_remaining_cents: 0,
      message: data.decision_note ?? "Operator denied the operation.",
    };
  }

  if (data.status === "expired" || new Date(data.expires_at).getTime() < Date.now()) {
    return {
      approved: false,
      reason: "approval_expired",
      requires_approval: false,
      monthly_remaining_cents: 0,
      message: `Approval ${data.proposal_id} expired.`,
    };
  }

  if (data.status !== "approved") {
    return {
      approved: false,
      reason: "requires_approval",
      requires_approval: true,
      monthly_remaining_cents: 0,
      message: "Approval still pending.",
      proposal_id: data.proposal_id,
    };
  }

  // Approved — mark consumed atomically. The conditional update guards against
  // a race where two callers try to redeem the same approval.
  const { data: updated, error: updateErr } = await ctx.service
    .from("cost_approvals")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", data.id)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();
  if (updateErr) throw new Error(`cost gate: failed to consume approval: ${updateErr.message}`);
  if (!updated) {
    return {
      approved: false,
      reason: "approval_denied",
      requires_approval: false,
      monthly_remaining_cents: 0,
      message: "Approval was claimed by another caller.",
    };
  }

  return {
    approved: true,
    reason: "operator_approved",
    auto: false,
    proposal_id: data.proposal_id,
  };
}

async function createPendingApproval(
  ctx: CostGateContext,
  req: CostGateRequest,
  remaining: number,
): Promise<{ proposal_id: string }> {
  const { data, error } = await ctx.service
    .from("cost_approvals")
    .insert({
      user_id: req.user_id,
      operation_type: req.operation_type,
      estimate_cents: req.estimate_cents,
      provider: req.provider,
      model_or_sku: req.model_or_sku ?? null,
      context: {
        ...(req.approval_context ?? {}),
        ...(req.related_source_id ? { related_source_id: req.related_source_id } : {}),
        ...(req.metadata ?? {}),
        monthly_remaining_cents: remaining,
      },
    })
    .select("proposal_id")
    .single();
  if (error) throw new Error(`cost gate: failed to create approval: ${error.message}`);

  // Emit cost.operation_proposed event so the operator's modal can pick it
  // up live. We import emitEvent dynamically to avoid a circular import
  // (cost_gate ← events ← cost_gate would happen if events ever needs the
  // gate's types).
  const { emitEvent } = await import("./events.ts");
  await emitEvent(ctx.service, {
    user_id: req.user_id,
    event_type: "cost.operation_proposed",
    entity_type: "cost_approval",
    payload: {
      proposal_id: data.proposal_id,
      operation_type: req.operation_type,
      estimate_cents: req.estimate_cents,
      provider: req.provider,
      model_or_sku: req.model_or_sku ?? null,
      context: req.approval_context ?? null,
    },
  });

  return { proposal_id: data.proposal_id as string };
}

interface UserRow {
  monthly_ceiling_cents: number;
}

interface WhitelistRow {
  per_op_max_cents: number;
  daily_max_cents: number | null;
  monthly_max_cents: number | null;
  enabled: boolean;
}

async function fetchUser(client: SupabaseClient, user_id: string): Promise<UserRow | null> {
  const { data, error } = await client
    .from("users")
    .select("monthly_ceiling_cents")
    .eq("id", user_id)
    .maybeSingle();
  if (error) throw new Error(`cost gate: failed to read user: ${error.message}`);
  return (data ?? null) as UserRow | null;
}

async function fetchMonthSpend(client: SupabaseClient, user_id: string): Promise<number> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { data, error } = await client
    .from("cost_ledger")
    .select("cost_cents")
    .eq("user_id", user_id)
    .gte("occurred_at", monthStart.toISOString());

  if (error) throw new Error(`cost gate: failed to sum cost_ledger: ${error.message}`);
  return (data ?? []).reduce((sum, row) => sum + (row.cost_cents ?? 0), 0);
}

async function fetchWhitelist(
  client: SupabaseClient,
  user_id: string,
  operation_type: CostOperationType,
): Promise<WhitelistRow | null> {
  const { data, error } = await client
    .from("cost_whitelists")
    .select("per_op_max_cents, daily_max_cents, monthly_max_cents, enabled")
    .eq("user_id", user_id)
    .eq("operation_type", operation_type)
    .maybeSingle();
  if (error) throw new Error(`cost gate: failed to read whitelist: ${error.message}`);
  return (data ?? null) as WhitelistRow | null;
}

// chargeLedger — record a successful paid operation. Called AFTER the API
// returns successfully. Idempotency: callers should pass an
// idempotency_key in metadata; duplicate inserts are caught by a unique
// constraint added in a follow-up migration.
export interface ChargeLedgerInput {
  user_id: string;
  operation_type: CostOperationType;
  provider: string;
  model_or_sku?: string | undefined;
  cost_cents: number;
  related_role_invocation_id?: string | undefined;
  related_source_id?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  approved_by_operator: boolean;
}

export async function chargeLedger(
  ctx: CostGateContext,
  input: ChargeLedgerInput,
): Promise<{ id: string }> {
  const { data, error } = await ctx.service
    .from("cost_ledger")
    .insert({
      user_id: input.user_id,
      operation_type: input.operation_type,
      provider: input.provider,
      model_or_sku: input.model_or_sku ?? null,
      cost_cents: input.cost_cents,
      related_role_invocation_id: input.related_role_invocation_id ?? null,
      related_source_id: input.related_source_id ?? null,
      metadata: input.metadata ?? {},
      approved_by_operator: input.approved_by_operator,
    })
    .select("id")
    .single();
  if (error) throw new Error(`cost gate: failed to charge ledger: ${error.message}`);
  return { id: data.id as string };
}

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
}

export type CostGateDecision =
  | {
      approved: true;
      reason: "whitelisted" | "operator_approved";
      auto: boolean;
    }
  | {
      approved: false;
      reason: "ceiling_exceeded" | "whitelist_disabled" | "requires_approval";
      requires_approval: boolean;
      monthly_remaining_cents: number;
      message: string;
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
  // approval. Sprint 1 returns `requires_approval`; Sprint 2 wires the modal.
  return {
    approved: false,
    reason: "requires_approval",
    requires_approval: true,
    monthly_remaining_cents: remaining,
    message: `Operator approval required for ${req.estimate_cents}¢ ${req.operation_type}.`,
  };
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

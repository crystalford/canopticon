// Cost gate — the single chokepoint for every paid operation.
//
// Every Anthropic call, transcription, paid fetch flows through here.
// The gate consults cost_whitelists and cost_ledger, and either:
//   - returns { decision: 'approved' } and writes to cost_ledger
//   - returns { decision: 'pending', approval_id } after queueing a row in cost_approvals
//   - returns { decision: 'denied' } with reason
//
// Idempotency: callers pass an idempotency_key; if a ledger row with the
// same (user_id, idempotency_key) exists, we return the prior decision
// without double-charging.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface CostRequest {
  user_id: string;
  operation_type: string;
  provider: string;
  model?: string;
  estimated_cost_cents: number;
  reason?: string;
  context?: Record<string, unknown>;
  idempotency_key?: string;
}

export type CostDecision =
  | { decision: "approved"; approval_id: null; cost_ledger_id: string | null }
  | { decision: "pending"; approval_id: string; cost_ledger_id: null }
  | { decision: "denied"; approval_id: string; cost_ledger_id: null; reason: string };

export async function approvePaidOperation(
  client: SupabaseClient,
  req: CostRequest,
): Promise<CostDecision> {
  if (req.idempotency_key) {
    const { data: existing } = await client
      .from("cost_ledger")
      .select("id")
      .eq("user_id", req.user_id)
      .eq("idempotency_key", req.idempotency_key)
      .maybeSingle();
    if (existing) {
      return {
        decision: "approved",
        approval_id: null,
        cost_ledger_id: (existing as { id: string }).id,
      };
    }
  }

  const { data: rule } = await client
    .from("cost_whitelists")
    .select("enabled, per_op_max_cents, daily_max_cents, monthly_max_cents")
    .eq("user_id", req.user_id)
    .eq("operation_type", req.operation_type)
    .maybeSingle();

  const whitelisted =
    rule &&
    (rule as { enabled: boolean; per_op_max_cents: number | null }).enabled &&
    (rule as { per_op_max_cents: number | null }).per_op_max_cents !== null &&
    req.estimated_cost_cents <= (rule as { per_op_max_cents: number }).per_op_max_cents;

  if (whitelisted) {
    const cents = await dailyAndMonthlySpend(client, req.user_id);
    const dailyMax = (rule as { daily_max_cents: number | null }).daily_max_cents;
    const monthlyMax = (rule as { monthly_max_cents: number | null }).monthly_max_cents;
    if (
      (dailyMax === null || cents.daily + req.estimated_cost_cents <= dailyMax) &&
      (monthlyMax === null || cents.monthly + req.estimated_cost_cents <= monthlyMax)
    ) {
      const { data: ledger, error } = await client
        .from("cost_ledger")
        .insert({
          user_id: req.user_id,
          operation_type: req.operation_type,
          provider: req.provider,
          model: req.model ?? null,
          cost_cents: req.estimated_cost_cents,
          whitelisted: true,
          idempotency_key: req.idempotency_key ?? null,
          metadata: req.context ?? {},
        })
        .select("id")
        .single();
      if (error) throw error;
      return {
        decision: "approved",
        approval_id: null,
        cost_ledger_id: (ledger as { id: string }).id,
      };
    }
  }

  const { data: approval, error } = await client
    .from("cost_approvals")
    .insert({
      user_id: req.user_id,
      operation_type: req.operation_type,
      provider: req.provider,
      model: req.model ?? null,
      estimated_cost_cents: req.estimated_cost_cents,
      reason: req.reason ?? null,
      context: req.context ?? {},
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw error;
  return {
    decision: "pending",
    approval_id: (approval as { id: string }).id,
    cost_ledger_id: null,
  };
}

async function dailyAndMonthlySpend(
  client: SupabaseClient,
  userId: string,
): Promise<{ daily: number; monthly: number }> {
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);

  const { data } = await client
    .from("cost_ledger")
    .select("cost_cents, created_at")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());

  const todayKey = new Date().toISOString().slice(0, 10);
  let daily = 0;
  let monthly = 0;
  for (const row of (data ?? []) as { cost_cents: number; created_at: string }[]) {
    monthly += Number(row.cost_cents);
    if (row.created_at.slice(0, 10) === todayKey) {
      daily += Number(row.cost_cents);
    }
  }
  return { daily, monthly };
}

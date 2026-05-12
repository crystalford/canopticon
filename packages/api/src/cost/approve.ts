// Cost gate — the single chokepoint for every paid operation.
//
// Every Anthropic call flows through here. Workers AI calls bypass the
// gate (zero cost) but still write a $0 ledger row via recordActualCost
// so the by-operation breakdown in the System screen stays honest.
//
// The gate consults cost_whitelists and cost_ledger, and either:
//   - returns { decision: 'approved' } and writes a provisional ledger row
//   - returns { decision: 'pending' } after queueing a cost_approvals row
//
// Idempotency: callers pass an idempotency_key; if a ledger row with the
// same (user_id, idempotency_key) exists, we return the prior decision
// without double-charging.

import { all, insertOne, one, run } from "../lib/d1";

export interface CostRequest {
  user_id: string;
  operation_type: string;
  provider: string;
  model?: string | undefined;
  estimated_cost_cents: number;
  reason?: string | undefined;
  context?: Record<string, unknown> | undefined;
  idempotency_key?: string | undefined;
}

export type CostDecision =
  | { decision: "approved"; approval_id: null; cost_ledger_id: string }
  | { decision: "pending"; approval_id: string; cost_ledger_id: null }
  | { decision: "denied"; approval_id: string; cost_ledger_id: null; reason: string };

export async function approvePaidOperation(
  db: D1Database,
  req: CostRequest,
): Promise<CostDecision> {
  // Workers AI is free — short-circuit straight to a $0 ledger row.
  if (req.provider === "workers_ai" || req.estimated_cost_cents <= 0) {
    const id = await writeLedger(db, req, 0, true);
    return { decision: "approved", approval_id: null, cost_ledger_id: id };
  }

  if (req.idempotency_key) {
    const existing = await one<{ id: string }>(
      db,
      "SELECT id FROM cost_ledger WHERE user_id = ? AND idempotency_key = ?",
      [req.user_id, req.idempotency_key],
    );
    if (existing) {
      return { decision: "approved", approval_id: null, cost_ledger_id: existing.id };
    }
  }

  const rule = await one<{
    enabled: number;
    per_op_max_cents: number | null;
    daily_max_cents: number | null;
    monthly_max_cents: number | null;
  }>(
    db,
    `SELECT enabled, per_op_max_cents, daily_max_cents, monthly_max_cents
     FROM cost_whitelists WHERE user_id = ? AND operation_type = ?`,
    [req.user_id, req.operation_type],
  );

  const whitelisted =
    rule &&
    rule.enabled === 1 &&
    rule.per_op_max_cents !== null &&
    req.estimated_cost_cents <= rule.per_op_max_cents;

  if (whitelisted) {
    const cents = await dailyAndMonthlySpend(db, req.user_id);
    const dailyMax = rule.daily_max_cents;
    const monthlyMax = rule.monthly_max_cents;
    if (
      (dailyMax === null || cents.daily + req.estimated_cost_cents <= dailyMax) &&
      (monthlyMax === null || cents.monthly + req.estimated_cost_cents <= monthlyMax)
    ) {
      const id = await writeLedger(db, req, req.estimated_cost_cents, true);
      return { decision: "approved", approval_id: null, cost_ledger_id: id };
    }
  }

  const approvalId = await insertOne(db, "cost_approvals", {
    user_id: req.user_id,
    operation_type: req.operation_type,
    provider: req.provider,
    model: req.model ?? null,
    estimated_cost_cents: req.estimated_cost_cents,
    reason: req.reason ?? null,
    context: req.context ?? {},
    status: "pending",
  });
  return { decision: "pending", approval_id: approvalId, cost_ledger_id: null };
}

/** Amend a ledger row with the actual post-call cost and token counts.
 *  Overwrites metadata with the supplied object (caller is expected to
 *  pass the full final blob). */
export async function recordActualCost(
  db: D1Database,
  ledgerId: string,
  actual_cost_cents: number,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await run(db, "UPDATE cost_ledger SET cost_cents = ?, metadata = ? WHERE id = ?", [
    actual_cost_cents,
    JSON.stringify(metadata),
    ledgerId,
  ]);
}

async function writeLedger(
  db: D1Database,
  req: CostRequest,
  cents: number,
  whitelisted: boolean,
): Promise<string> {
  return insertOne(db, "cost_ledger", {
    user_id: req.user_id,
    operation_type: req.operation_type,
    provider: req.provider,
    model: req.model ?? null,
    cost_cents: cents,
    whitelisted,
    idempotency_key: req.idempotency_key ?? null,
    metadata: req.context ?? {},
  });
}

async function dailyAndMonthlySpend(
  db: D1Database,
  userId: string,
): Promise<{ daily: number; monthly: number }> {
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);

  const rows = await all<{ cost_cents: number; created_at: string }>(
    db,
    `SELECT cost_cents, created_at FROM cost_ledger
     WHERE user_id = ? AND created_at >= ?`,
    [userId, since.toISOString()],
  );

  const todayKey = new Date().toISOString().slice(0, 10);
  let daily = 0;
  let monthly = 0;
  for (const row of rows) {
    monthly += Number(row.cost_cents);
    if (row.created_at.slice(0, 10) === todayKey) {
      daily += Number(row.cost_cents);
    }
  }
  return { daily, monthly };
}

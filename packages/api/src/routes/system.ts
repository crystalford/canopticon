// System routes — operator-facing observability.
//
//   GET /v1/system/health        process health (always 200 if reachable)
//   GET /v1/system/costs         monthly + 30-day cost rollup
//   GET /v1/system/role-activity per-role invocation rollup (last 7d / 30d)

import { Hono } from "hono";
import type { AuthContext } from "../auth/middleware.ts";
import { requireAuth } from "../auth/middleware.ts";
import { userClient } from "../lib/supabase.ts";

const system = new Hono<AuthContext>();
system.use("*", requireAuth());

system.get("/health", (c) => c.json({ data: { ok: true, ts: new Date().toISOString() } }));

interface CostRow {
  cost_cents: number;
  operation_type: string;
  occurred_at: string;
  approved_by_operator: boolean;
}

interface UserRow {
  monthly_ceiling_cents: number;
}

system.get("/costs", async (c) => {
  const userId = c.get("user_id");
  const client = userClient(c.env, c.get("jwt"));

  const monthStart = monthStartIso();
  const windowStart = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const [{ data: ledger, error: ledgerErr }, { data: user, error: userErr }] = await Promise.all([
    client
      .from("cost_ledger")
      .select("cost_cents, operation_type, occurred_at, approved_by_operator")
      .eq("user_id", userId)
      .gte("occurred_at", windowStart)
      .order("occurred_at", { ascending: false })
      .returns<CostRow[]>(),
    client.from("users").select("monthly_ceiling_cents").eq("id", userId).maybeSingle<UserRow>(),
  ]);

  if (ledgerErr) throw new Error(`system.costs.ledger: ${ledgerErr.message}`);
  if (userErr) throw new Error(`system.costs.user: ${userErr.message}`);

  const rows: CostRow[] = ledger ?? [];
  const monthly = rows
    .filter((r) => r.occurred_at >= monthStart)
    .reduce((sum, r) => sum + r.cost_cents, 0);
  const window30 = rows.reduce((sum, r) => sum + r.cost_cents, 0);

  // Per-operation-type breakdown for the last 30 days.
  const byOp: Record<string, { cents: number; count: number }> = {};
  for (const r of rows) {
    const slot = byOp[r.operation_type] ?? { cents: 0, count: 0 };
    slot.cents += r.cost_cents;
    slot.count += 1;
    byOp[r.operation_type] = slot;
  }
  const by_operation_type = Object.entries(byOp)
    .map(([operation_type, agg]) => ({ operation_type, ...agg }))
    .sort((a, b) => b.cents - a.cents);

  // Approved-by-operator vs auto split.
  const approved_split = rows.reduce(
    (acc, r) => {
      if (r.approved_by_operator) acc.approved += r.cost_cents;
      else acc.auto += r.cost_cents;
      return acc;
    },
    { approved: 0, auto: 0 },
  );

  // Daily series for a sparkline.
  const daily: Record<string, number> = {};
  for (const r of rows) {
    const day = r.occurred_at.slice(0, 10);
    daily[day] = (daily[day] ?? 0) + r.cost_cents;
  }
  const daily_series = Object.entries(daily)
    .map(([day, cents]) => ({ day, cents }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return c.json({
    data: {
      monthly_cents: monthly,
      monthly_ceiling_cents: user?.monthly_ceiling_cents ?? 5000,
      monthly_remaining_cents: Math.max(0, (user?.monthly_ceiling_cents ?? 5000) - monthly),
      window_30d_cents: window30,
      by_operation_type,
      approved_split,
      daily_series,
      operation_count: rows.length,
    },
  });
});

interface InvocationRow {
  role_name: string;
  status: string;
  cost_cents: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  created_at: string;
}

system.get("/role-activity", async (c) => {
  const userId = c.get("user_id");
  const client = userClient(c.env, c.get("jwt"));

  const windowStart = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const { data, error } = await client
    .from("role_invocations")
    .select("role_name, status, cost_cents, tokens_input, tokens_output, created_at")
    .eq("user_id", userId)
    .gte("created_at", windowStart)
    .order("created_at", { ascending: false })
    .limit(2000)
    .returns<InvocationRow[]>();
  if (error) throw new Error(`system.role-activity: ${error.message}`);

  const rows: InvocationRow[] = data ?? [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  // Per-role rollup.
  const byRole: Record<
    string,
    {
      total: number;
      success: number;
      error: number;
      partial: number;
      total_cost_cents: number;
      tokens_input: number;
      tokens_output: number;
      last_run_at: string | null;
      last_7d: number;
    }
  > = {};
  for (const r of rows) {
    const slot = byRole[r.role_name] ?? {
      total: 0,
      success: 0,
      error: 0,
      partial: 0,
      total_cost_cents: 0,
      tokens_input: 0,
      tokens_output: 0,
      last_run_at: null,
      last_7d: 0,
    };
    slot.total++;
    if (r.status === "success") slot.success++;
    else if (r.status === "error") slot.error++;
    else if (r.status === "partial") slot.partial++;
    slot.total_cost_cents += r.cost_cents ?? 0;
    slot.tokens_input += r.tokens_input ?? 0;
    slot.tokens_output += r.tokens_output ?? 0;
    if (!slot.last_run_at || r.created_at > slot.last_run_at) slot.last_run_at = r.created_at;
    if (r.created_at >= sevenDaysAgo) slot.last_7d++;
    byRole[r.role_name] = slot;
  }

  const roles = Object.entries(byRole)
    .map(([role_name, agg]) => ({ role_name, ...agg }))
    .sort((a, b) => b.total - a.total);

  return c.json({ data: { window_30d: roles, total_invocations: rows.length } });
});

function monthStartIso(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export default system;

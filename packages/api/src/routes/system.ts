// System cockpit data: cost panel, cascade status, role health, Brier.

import { Hono } from "hono";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { all, one, run, updateById } from "../lib/d1.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/", async (c) => {
  const userId = c.get("user_id");
  const db = c.env.DB;

  const sinceMonth = new Date();
  sinceMonth.setUTCDate(1);
  sinceMonth.setUTCHours(0, 0, 0, 0);
  const sinceMonthIso = sinceMonth.toISOString();
  const sinceDayIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [ledger, lastCascades, roles, preds, userRow] = await Promise.all([
    all<{ operation_type: string; cost_cents: number }>(
      db,
      "SELECT operation_type, cost_cents FROM cost_ledger WHERE user_id = ? AND created_at >= ?",
      [userId, sinceMonthIso],
    ),
    all<{
      id: string;
      status: string;
      started_at: string | null;
      completed_at: string | null;
      spent_cents: number;
      stats: string;
      error_message: string | null;
    }>(
      db,
      "SELECT id, status, started_at, completed_at, spent_cents, stats, error_message FROM cascade_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10",
      [userId],
    ),
    all<{ role_name: string; status: string }>(
      db,
      "SELECT role_name, status FROM role_invocations WHERE user_id = ? AND created_at >= ?",
      [userId, sinceDayIso],
    ),
    all<{ status: string; brier_contribution: number | null; domain: string | null }>(
      db,
      "SELECT status, brier_contribution, domain FROM predictions WHERE user_id = ?",
      [userId],
    ),
    one<{
      monthly_ceiling_cents: number;
      ingestion_apis_enabled: number;
      cascade_cron_expr: string | null;
      named_operator: string | null;
    }>(
      db,
      "SELECT monthly_ceiling_cents, ingestion_apis_enabled, cascade_cron_expr, named_operator FROM users WHERE id = ?",
      [userId],
    ),
  ]);

  let monthlySpend = 0;
  const byOp: Record<string, number> = {};
  for (const row of ledger) {
    monthlySpend += Number(row.cost_cents);
    byOp[row.operation_type] = (byOp[row.operation_type] ?? 0) + Number(row.cost_cents);
  }

  const roleStats: Record<string, { count: number; errors: number }> = {};
  for (const row of roles) {
    const cur = roleStats[row.role_name] ?? { count: 0, errors: 0 };
    cur.count++;
    if (row.status === "failed") cur.errors++;
    roleStats[row.role_name] = cur;
  }

  let brierTotal = 0;
  let brierResolved = 0;
  let active = 0;
  for (const row of preds) {
    if (row.status === "active") active++;
    if (row.brier_contribution !== null) {
      brierTotal += Number(row.brier_contribution);
      brierResolved++;
    }
  }
  const rollingBrier = brierResolved > 0 ? brierTotal / brierResolved : null;

  return c.json({
    cost: {
      monthly_spend_cents: monthlySpend,
      monthly_ceiling_cents: userRow?.monthly_ceiling_cents ?? 0,
      by_operation: byOp,
    },
    cascade: { last_runs: lastCascades },
    roles: roleStats,
    brier: { rolling: rollingBrier, resolved_count: brierResolved, active_count: active },
    settings: {
      ingestion_apis_enabled: (userRow?.ingestion_apis_enabled ?? 0) === 1,
      cascade_cron_expr: userRow?.cascade_cron_expr ?? null,
      named_operator: userRow?.named_operator ?? null,
    },
  });
});

app.patch("/settings", async (c) => {
  const userId = c.get("user_id");
  const body = (await c.req.json()) as Record<string, unknown>;
  const allowed = [
    "monthly_ceiling_cents",
    "ingestion_apis_enabled",
    "cascade_cron_expr",
    "named_operator",
    "operator_credentials",
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }
  if (Object.keys(update).length === 0) return c.json({ ok: true, updated: 0 });
  await updateById(c.env.DB, "users", userId, update);
  // Suppress unused-import warning if updateById is the only thing changing here.
  void run;
  return c.json({ ok: true, updated: Object.keys(update).length });
});

export default app;

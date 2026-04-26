// Operations cockpit data: cost panel, cascade status, role health, Brier.
// Powers the System screen in the operator app.

import { Hono } from "hono";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { internal } from "../lib/errors.ts";
import { userClient } from "../lib/supabase.ts";
import { getPublicUserId } from "../lib/user.ts";

const app = new Hono<AuthContext>();

app.use("*", requireAuth());

app.get("/", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));

  const sinceMonth = new Date();
  sinceMonth.setUTCDate(1);
  sinceMonth.setUTCHours(0, 0, 0, 0);

  const [ledgerR, lastCascadeR, rolesR, predsR, userRowR] = await Promise.all([
    client
      .from("cost_ledger")
      .select("operation_type, cost_cents, created_at")
      .eq("user_id", userId)
      .gte("created_at", sinceMonth.toISOString()),
    client
      .from("cascade_runs")
      .select("id, status, started_at, completed_at, spent_cents, stats, error_message")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    client
      .from("role_invocations")
      .select("role_name, status")
      .eq("user_id", userId)
      .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
    client.from("predictions").select("status, brier_contribution, domain").eq("user_id", userId),
    client
      .from("users")
      .select("monthly_ceiling_cents, ingestion_apis_enabled, cascade_cron_expr, named_operator")
      .eq("id", userId)
      .single(),
  ]);

  if (ledgerR.error || lastCascadeR.error || rolesR.error || predsR.error || userRowR.error) {
    throw internal("system query failed");
  }

  const monthlySpend = (ledgerR.data ?? []).reduce(
    (s, r) => s + Number((r as { cost_cents: number }).cost_cents),
    0,
  );
  const byOp: Record<string, number> = {};
  for (const r of ledgerR.data ?? []) {
    const row = r as { operation_type: string; cost_cents: number };
    byOp[row.operation_type] = (byOp[row.operation_type] ?? 0) + Number(row.cost_cents);
  }

  const roleStats: Record<string, { count: number; errors: number }> = {};
  for (const r of rolesR.data ?? []) {
    const row = r as { role_name: string; status: string };
    const cur = roleStats[row.role_name] ?? { count: 0, errors: 0 };
    cur.count++;
    if (row.status === "failed") cur.errors++;
    roleStats[row.role_name] = cur;
  }

  let brierTotal = 0;
  let brierResolved = 0;
  let active = 0;
  for (const r of predsR.data ?? []) {
    const row = r as { status: string; brier_contribution: number | null };
    if (row.status === "active") active++;
    if (row.brier_contribution !== null) {
      brierTotal += Number(row.brier_contribution);
      brierResolved++;
    }
  }
  const rollingBrier = brierResolved > 0 ? brierTotal / brierResolved : null;

  const userRow = userRowR.data as {
    monthly_ceiling_cents: number;
    ingestion_apis_enabled: boolean;
    cascade_cron_expr: string | null;
    named_operator: string | null;
  };

  return c.json({
    cost: {
      monthly_spend_cents: monthlySpend,
      monthly_ceiling_cents: userRow.monthly_ceiling_cents,
      by_operation: byOp,
    },
    cascade: {
      last_runs: lastCascadeR.data ?? [],
    },
    roles: roleStats,
    brier: {
      rolling: rollingBrier,
      resolved_count: brierResolved,
      active_count: active,
    },
    settings: {
      ingestion_apis_enabled: userRow.ingestion_apis_enabled,
      cascade_cron_expr: userRow.cascade_cron_expr,
      named_operator: userRow.named_operator,
    },
  });
});

app.patch("/settings", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
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
  if (Object.keys(update).length === 0) {
    return c.json({ ok: true, updated: 0 });
  }

  const { error } = await client.from("users").update(update).eq("id", userId);
  if (error) throw error;
  return c.json({ ok: true, updated: Object.keys(update).length });
});

export default app;

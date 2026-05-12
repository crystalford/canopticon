// Cost approvals, ledger, whitelists.

import { Hono } from "hono";
import { z } from "zod";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { all, insertOne, one, run, updateById } from "../lib/d1.ts";
import { badRequest } from "../lib/errors.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/approvals", async (c) => {
  const userId = c.get("user_id");
  const approvals = await all(
    c.env.DB,
    "SELECT * FROM cost_approvals WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC",
    [userId],
  );
  return c.json({ approvals });
});

const decisionSchema = z.object({
  decision: z.enum(["approve_once", "approve_and_whitelist", "deny"]),
  notes: z.string().optional(),
});

app.post("/approvals/:id/decide", async (c) => {
  const userId = c.get("user_id");
  const parsed = decisionSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid decision", { issues: parsed.error.issues });

  const id = c.req.param("id");
  const approval = await one<{
    id: string;
    operation_type: string;
    provider: string;
    model: string | null;
    estimated_cost_cents: number;
  }>(c.env.DB, "SELECT * FROM cost_approvals WHERE id = ? AND user_id = ?", [id, userId]);
  if (!approval) throw badRequest("approval not found");

  if (parsed.data.decision === "deny") {
    await updateById(c.env.DB, "cost_approvals", id, {
      status: "denied",
      decided_at: new Date().toISOString(),
      decision_notes: parsed.data.notes ?? null,
    });
    return c.json({ ok: true });
  }

  await updateById(c.env.DB, "cost_approvals", id, {
    status: "approved",
    decided_at: new Date().toISOString(),
    decision_notes: parsed.data.notes ?? null,
  });
  await insertOne(c.env.DB, "cost_ledger", {
    user_id: userId,
    operation_type: approval.operation_type,
    provider: approval.provider,
    model: approval.model,
    cost_cents: approval.estimated_cost_cents,
    whitelisted: false,
    approval_id: approval.id,
  });

  if (parsed.data.decision === "approve_and_whitelist") {
    const existing = await one<{ id: string }>(
      c.env.DB,
      "SELECT id FROM cost_whitelists WHERE user_id = ? AND operation_type = ?",
      [userId, approval.operation_type],
    );
    if (existing) {
      await updateById(c.env.DB, "cost_whitelists", existing.id, {
        enabled: true,
        per_op_max_cents: approval.estimated_cost_cents * 2,
      });
    } else {
      await insertOne(c.env.DB, "cost_whitelists", {
        user_id: userId,
        operation_type: approval.operation_type,
        enabled: true,
        per_op_max_cents: approval.estimated_cost_cents * 2,
      });
    }
  }
  void run;
  return c.json({ ok: true });
});

app.get("/whitelists", async (c) => {
  const userId = c.get("user_id");
  const whitelists = await all(
    c.env.DB,
    "SELECT * FROM cost_whitelists WHERE user_id = ? ORDER BY operation_type",
    [userId],
  );
  return c.json({ whitelists });
});

app.get("/ledger", async (c) => {
  const userId = c.get("user_id");
  const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "100", 10), 500);
  const entries = await all(
    c.env.DB,
    "SELECT * FROM cost_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    [userId, limit],
  );
  return c.json({ entries });
});

export default app;

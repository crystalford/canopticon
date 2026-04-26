// Cost panel data: pending approvals, ledger, whitelist rules.
// Powers the cost-approval modal and System cost panel.

import { Hono } from "hono";
import { z } from "zod";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { badRequest } from "../lib/errors.ts";
import { userClient } from "../lib/supabase.ts";
import { getPublicUserId } from "../lib/user.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/approvals", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const { data, error } = await client
    .from("cost_approvals")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return c.json({ approvals: data ?? [] });
});

const decisionSchema = z.object({
  decision: z.enum(["approve_once", "approve_and_whitelist", "deny"]),
  notes: z.string().optional(),
});

app.post("/approvals/:id/decide", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const parsed = decisionSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid decision", { issues: parsed.error.issues });

  const id = c.req.param("id");
  const { data: approval, error } = await client
    .from("cost_approvals")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  const a = approval as {
    id: string;
    operation_type: string;
    provider: string;
    model: string | null;
    estimated_cost_cents: number;
  };

  if (parsed.data.decision === "deny") {
    await client
      .from("cost_approvals")
      .update({
        status: "denied",
        decided_at: new Date().toISOString(),
        decision_notes: parsed.data.notes ?? null,
      })
      .eq("id", id);
    return c.json({ ok: true });
  }

  await client
    .from("cost_approvals")
    .update({
      status: "approved",
      decided_at: new Date().toISOString(),
      decision_notes: parsed.data.notes ?? null,
    })
    .eq("id", id);

  await client.from("cost_ledger").insert({
    user_id: userId,
    operation_type: a.operation_type,
    provider: a.provider,
    model: a.model,
    cost_cents: a.estimated_cost_cents,
    whitelisted: false,
    approval_id: a.id,
  });

  if (parsed.data.decision === "approve_and_whitelist") {
    await client.from("cost_whitelists").upsert(
      {
        user_id: userId,
        operation_type: a.operation_type,
        enabled: true,
        per_op_max_cents: a.estimated_cost_cents * 2,
      },
      { onConflict: "user_id,operation_type" },
    );
  }

  return c.json({ ok: true });
});

app.get("/whitelists", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const { data, error } = await client
    .from("cost_whitelists")
    .select("*")
    .eq("user_id", userId)
    .order("operation_type");
  if (error) throw error;
  return c.json({ whitelists: data ?? [] });
});

app.get("/ledger", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "100", 10), 500);
  const { data, error } = await client
    .from("cost_ledger")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return c.json({ entries: data ?? [] });
});

export default app;

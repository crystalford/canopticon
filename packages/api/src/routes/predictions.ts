// Predictions: list, create, resolve. Brier score endpoint.

import { Hono } from "hono";
import { z } from "zod";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { type Outcome, brierContribution, computeRollingBrier } from "../lib/brier.ts";
import { badRequest } from "../lib/errors.ts";
import { userClient } from "../lib/supabase.ts";
import { getPublicUserId } from "../lib/user.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const status = c.req.query("status");
  let q = client
    .from("predictions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return c.json({ predictions: data ?? [] });
});

const createSchema = z.object({
  statement: z.string().min(1),
  confidence_pct: z.number().int().min(0).max(100),
  resolution_criterion: z.string().min(1),
  resolution_horizon: z.string(),
  thesis_id: z.string().uuid().optional(),
  claim_id: z.string().uuid().optional(),
  domain: z.string().optional(),
  ipcc_likelihood: z
    .enum([
      "virtually_certain",
      "extremely_likely",
      "very_likely",
      "likely",
      "more_likely_than_not",
      "about_as_likely_as_not",
      "unlikely",
      "very_unlikely",
      "extremely_unlikely",
      "exceptionally_unlikely",
    ])
    .optional(),
});

app.post("/", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const parsed = createSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const { data, error } = await client
    .from("predictions")
    .insert({ user_id: userId, ...parsed.data })
    .select("id")
    .single();
  if (error) throw error;
  return c.json({ id: (data as { id: string }).id }, 201);
});

const resolveSchema = z.object({
  outcome: z.enum(["correct", "incorrect", "ambiguous"]),
  resolved_outcome: z.string().min(1),
});

app.post("/:id/resolve", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const id = c.req.param("id");
  const parsed = resolveSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const { data: pred, error: getErr } = await client
    .from("predictions")
    .select("confidence_pct")
    .eq("id", id)
    .single();
  if (getErr) throw getErr;

  const probability = (pred as { confidence_pct: number }).confidence_pct / 100;
  const brier = brierContribution(probability, parsed.data.outcome as Outcome);
  const status =
    parsed.data.outcome === "correct"
      ? "resolved_correct"
      : parsed.data.outcome === "incorrect"
        ? "resolved_incorrect"
        : "resolved_ambiguous";

  const { error } = await client
    .from("predictions")
    .update({
      status,
      resolved_at: new Date().toISOString(),
      resolved_outcome: parsed.data.resolved_outcome,
      brier_contribution: brier,
    })
    .eq("id", id);
  if (error) throw error;
  return c.json({ ok: true, brier_contribution: brier });
});

app.get("/brier", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const { data, error } = await client
    .from("predictions")
    .select("brier_contribution")
    .eq("user_id", userId);
  if (error) throw error;
  const summary = computeRollingBrier((data ?? []) as Array<{ brier_contribution: number | null }>);
  return c.json(summary);
});

export default app;

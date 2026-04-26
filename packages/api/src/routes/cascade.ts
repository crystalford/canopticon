// Cascade routes — see canopticon-api-v1.0.md §11.
//
//   POST /v1/cascade/run       Operator-triggered cascade execution
//   GET  /v1/cascade/runs      Recent cascade runs
//   GET  /v1/cascade/runs/:id  Single cascade run detail
//
// Runs synchronously in the Worker as long as it fits. When the cascade
// grows past the Worker CPU budget, this route hands off to a Durable
// Object — same orchestrator code, different host.

import { Hono } from "hono";
import { z } from "zod";
import type { AuthContext } from "../auth/middleware.ts";
import { requireAuth } from "../auth/middleware.ts";
import { AnthropicClient } from "../lib/anthropic.ts";
import { badRequest, notFound } from "../lib/errors.ts";
import { serviceClient, userClient } from "../lib/supabase.ts";
import { runCascade } from "../orchestrator/cascade.ts";

const cascade = new Hono<AuthContext>();
cascade.use("*", requireAuth());

const runSchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
});

cascade.post("/run", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = runSchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw badRequest("Invalid cascade run payload", { issues: parsed.error.issues });
  }

  const ctx = {
    service: serviceClient(c.env),
    anthropic: new AnthropicClient({ apiKey: c.env.ANTHROPIC_API_KEY }),
  };

  const result = await runCascade(ctx, {
    user_id: c.get("user_id"),
    triggered_by: "operator_manual",
    ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
  });

  return c.json({ data: result }, 202);
});

cascade.get("/runs", async (c) => {
  const limit = Number(c.req.query("limit") ?? 20);
  const client = userClient(c.env, c.get("jwt"));
  const { data, error } = await client
    .from("cascade_runs")
    .select(
      "id, triggered_by, started_at, ended_at, status, sources_ingested, claims_written, questions_generated, total_cost_cents",
    )
    .order("started_at", { ascending: false })
    .limit(Math.min(Math.max(1, limit), 100));
  if (error) throw new Error(`cascade.runs: ${error.message}`);
  return c.json({ data });
});

cascade.get("/runs/:id", async (c) => {
  const id = c.req.param("id");
  const client = userClient(c.env, c.get("jwt"));
  const { data, error } = await client.from("cascade_runs").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`cascade.runs.get: ${error.message}`);
  if (!data) throw notFound("Cascade run not found");
  return c.json({ data });
});

export default cascade;

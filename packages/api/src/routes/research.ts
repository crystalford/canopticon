// Research routes — the AI research loop entry point.
//
//   POST /v1/research            kick off a research run
//   GET  /v1/research/runs       list recent runs
//   GET  /v1/research/runs/:id   one run detail (incl. full conversation)
//
// Sprint-1-style demo framing intentionally absent. This is the primary
// ingestion surface; an operator opens the app, types a topic, and watches
// the substrate fill.

import { Hono } from "hono";
import { z } from "zod";
import type { AuthContext } from "../auth/middleware.ts";
import { requireAuth } from "../auth/middleware.ts";
import { AnthropicClient } from "../lib/anthropic.ts";
import { badRequest, notFound } from "../lib/errors.ts";
import { serviceClient, userClient } from "../lib/supabase.ts";
import { runResearch } from "../orchestrator/research.ts";

const research = new Hono<AuthContext>();
research.use("*", requireAuth());

const startSchema = z.object({
  topic: z.string().min(3).max(500),
  thesis_id: z.string().uuid().optional(),
  budget_cents: z.number().int().min(1).max(10_000).optional(),
  max_iterations: z.number().int().min(1).max(30).optional(),
  model: z.string().optional(),
});

research.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");

  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid research request", { issues: parsed.error.issues });
  }

  // The research run is synchronous in the Worker for now — typical runs
  // finish well within Worker CPU budget when budget_cents is the natural
  // throttle. For long-running missions we'll move to a Durable Object;
  // see canopticon-build-handoff-v1.0.md §1.
  const ctx = {
    service: serviceClient(c.env),
    anthropic: new AnthropicClient({ apiKey: c.env.ANTHROPIC_API_KEY }),
  };

  const result = await runResearch(ctx, {
    user_id: c.get("user_id"),
    topic: parsed.data.topic,
    thesis_id: parsed.data.thesis_id ?? null,
    ...(parsed.data.budget_cents !== undefined ? { budget_cents: parsed.data.budget_cents } : {}),
    ...(parsed.data.max_iterations !== undefined
      ? { max_iterations: parsed.data.max_iterations }
      : {}),
    ...(parsed.data.model ? { model: parsed.data.model } : {}),
  });

  return c.json({ data: result }, 202);
});

research.get("/runs", async (c) => {
  const limit = Math.min(Math.max(1, Number(c.req.query("limit") ?? 20)), 100);
  const client = userClient(c.env, c.get("jwt"));
  const { data, error } = await client
    .from("research_runs")
    .select(
      "id, topic, thesis_id, status, started_at, ended_at, iterations, sources_registered, total_cost_cents, budget_cents, output_summary",
    )
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`research.runs: ${error.message}`);
  return c.json({ data });
});

research.get("/runs/:id", async (c) => {
  const id = c.req.param("id");
  const client = userClient(c.env, c.get("jwt"));
  const { data, error } = await client.from("research_runs").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`research.runs.get: ${error.message}`);
  if (!data) throw notFound("Research run not found");
  return c.json({ data });
});

export default research;

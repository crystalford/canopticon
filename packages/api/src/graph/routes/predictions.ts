// Predictions: list, create, resolve, Brier.

import { Hono } from "hono";
import { z } from "zod";
import { type AuthContext, requireAuth } from "../../auth/middleware.ts";
import { type Outcome, brierContribution, computeRollingBrier } from "../../lib/brier.ts";
import { all, insertOne, one, updateById } from "../../lib/d1.ts";
import { badRequest } from "../../lib/errors.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/", async (c) => {
  const userId = c.get("user_id");
  const status = c.req.query("status");
  const predictions = status
    ? await all(
        c.env.DB,
        "SELECT * FROM predictions WHERE user_id = ? AND status = ? ORDER BY created_at DESC",
        [userId, status],
      )
    : await all(c.env.DB, "SELECT * FROM predictions WHERE user_id = ? ORDER BY created_at DESC", [
        userId,
      ]);
  return c.json({ predictions });
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
  const userId = c.get("user_id");
  const parsed = createSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const id = await insertOne(c.env.DB, "predictions", { user_id: userId, ...parsed.data });
  return c.json({ id }, 201);
});

const resolveSchema = z.object({
  outcome: z.enum(["correct", "incorrect", "ambiguous"]),
  resolved_outcome: z.string().min(1),
});

app.post("/:id/resolve", async (c) => {
  const id = c.req.param("id");
  const parsed = resolveSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const pred = await one<{ confidence_pct: number }>(
    c.env.DB,
    "SELECT confidence_pct FROM predictions WHERE id = ?",
    [id],
  );
  if (!pred) throw badRequest("prediction not found");
  const probability = pred.confidence_pct / 100;
  const brier = brierContribution(probability, parsed.data.outcome as Outcome);
  const status =
    parsed.data.outcome === "correct"
      ? "resolved_correct"
      : parsed.data.outcome === "incorrect"
        ? "resolved_incorrect"
        : "resolved_ambiguous";
  await updateById(c.env.DB, "predictions", id, {
    status,
    resolved_at: new Date().toISOString(),
    resolved_outcome: parsed.data.resolved_outcome,
    brier_contribution: brier,
  });
  return c.json({ ok: true, brier_contribution: brier });
});

app.get("/brier", async (c) => {
  const userId = c.get("user_id");
  const rows = await all<{ brier_contribution: number | null }>(
    c.env.DB,
    "SELECT brier_contribution FROM predictions WHERE user_id = ?",
    [userId],
  );
  const summary = computeRollingBrier(rows);
  return c.json(summary);
});

export default app;

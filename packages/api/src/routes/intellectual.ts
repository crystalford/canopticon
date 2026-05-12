// Argument maps, solution inventories, frame genealogies, five-whys.

import { Hono } from "hono";
import { z } from "zod";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { all, insertOne, one, updateById } from "../lib/d1.ts";
import { badRequest } from "../lib/errors.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/argument-maps", async (c) => {
  const userId = c.get("user_id");
  const maps = await all(
    c.env.DB,
    "SELECT * FROM argument_maps WHERE user_id = ? ORDER BY created_at DESC",
    [userId],
  );
  return c.json({ maps });
});

app.get("/argument-maps/:id", async (c) => {
  const id = c.req.param("id");
  const map = await one(c.env.DB, "SELECT * FROM argument_maps WHERE id = ?", [id]);
  const layers = await all(
    c.env.DB,
    "SELECT * FROM argument_layers WHERE map_id = ? ORDER BY layer_number",
    [id],
  );
  return c.json({ map, layers });
});

app.get("/solution-inventories", async (c) => {
  const userId = c.get("user_id");
  const inventories = await all(
    c.env.DB,
    "SELECT * FROM solution_inventories WHERE user_id = ? ORDER BY created_at DESC",
    [userId],
  );
  return c.json({ inventories });
});

app.get("/solution-inventories/:id", async (c) => {
  const id = c.req.param("id");
  const inventory = await one(c.env.DB, "SELECT * FROM solution_inventories WHERE id = ?", [id]);
  const entries = await all(c.env.DB, "SELECT * FROM solution_entries WHERE inventory_id = ?", [
    id,
  ]);
  return c.json({ inventory, entries });
});

app.get("/frame-genealogies", async (c) => {
  const userId = c.get("user_id");
  const genealogies = await all(
    c.env.DB,
    "SELECT * FROM frame_genealogies WHERE user_id = ? ORDER BY created_at DESC",
    [userId],
  );
  return c.json({ genealogies });
});

app.get("/frame-genealogies/:id", async (c) => {
  const id = c.req.param("id");
  const genealogy = await one(c.env.DB, "SELECT * FROM frame_genealogies WHERE id = ?", [id]);
  const events = await all(
    c.env.DB,
    "SELECT * FROM frame_propagation_events WHERE genealogy_id = ? ORDER BY occurred_at",
    [id],
  );
  return c.json({ genealogy, events });
});

app.get("/five-whys", async (c) => {
  const userId = c.get("user_id");
  const chains = await all(
    c.env.DB,
    "SELECT * FROM five_whys_chains WHERE user_id = ? ORDER BY created_at DESC",
    [userId],
  );
  return c.json({ chains });
});

app.get("/five-whys/:id", async (c) => {
  const id = c.req.param("id");
  const chain = await one(c.env.DB, "SELECT * FROM five_whys_chains WHERE id = ?", [id]);
  const levels = await all(
    c.env.DB,
    "SELECT * FROM five_whys_levels WHERE chain_id = ? ORDER BY level",
    [id],
  );
  return c.json({ chain, levels });
});

const fiveWhysCreateSchema = z.object({
  thesis_id: z.string().uuid().optional(),
  question: z.string().min(1),
});

app.post("/five-whys", async (c) => {
  const userId = c.get("user_id");
  const parsed = fiveWhysCreateSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const id = await insertOne(c.env.DB, "five_whys_chains", { user_id: userId, ...parsed.data });
  return c.json({ id }, 201);
});

const levelSchema = z.object({
  level: z.enum([
    "why_1_proximate",
    "why_2_immediate_mechanism",
    "why_3_systemic_pattern",
    "why_4_structural_condition",
    "why_5_root_design_choice",
  ]),
  question: z.string().min(1),
  answer: z.string().min(1),
  intervention_tier: z.enum(["symptom", "mechanism", "structural"]).optional(),
  supporting_claim_ids: z.array(z.string().uuid()).optional(),
});

app.post("/five-whys/:id/levels", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  const parsed = levelSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  await insertOne(c.env.DB, "five_whys_levels", {
    user_id: userId,
    chain_id: id,
    ...parsed.data,
    supporting_claim_ids: parsed.data.supporting_claim_ids ?? [],
  });
  if (
    (parsed.data.level === "why_4_structural_condition" ||
      parsed.data.level === "why_5_root_design_choice") &&
    parsed.data.intervention_tier === "structural"
  ) {
    await updateById(c.env.DB, "five_whys_chains", id, { reached_root: true });
  }
  return c.json({ ok: true });
});

export default app;

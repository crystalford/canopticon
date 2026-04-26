// Intellectual output: argument maps, solution inventories, frame
// genealogies, five-whys chains. CRUD for these substrate first-class
// outputs that surface in the public site.

import { Hono } from "hono";
import { z } from "zod";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { badRequest } from "../lib/errors.ts";
import { userClient } from "../lib/supabase.ts";
import { getPublicUserId } from "../lib/user.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

// Argument maps.
app.get("/argument-maps", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const { data, error } = await client
    .from("argument_maps")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return c.json({ maps: data ?? [] });
});

app.get("/argument-maps/:id", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const id = c.req.param("id");
  const { data, error } = await client.from("argument_maps").select("*").eq("id", id).single();
  if (error) throw error;
  const { data: layers } = await client
    .from("argument_layers")
    .select("*")
    .eq("map_id", id)
    .order("layer_number");
  return c.json({ map: data, layers: layers ?? [] });
});

// Solution inventories.
app.get("/solution-inventories", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const { data, error } = await client
    .from("solution_inventories")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return c.json({ inventories: data ?? [] });
});

app.get("/solution-inventories/:id", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const id = c.req.param("id");
  const { data, error } = await client
    .from("solution_inventories")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  const { data: entries } = await client
    .from("solution_entries")
    .select("*")
    .eq("inventory_id", id);
  return c.json({ inventory: data, entries: entries ?? [] });
});

// Frame genealogies.
app.get("/frame-genealogies", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const { data, error } = await client
    .from("frame_genealogies")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return c.json({ genealogies: data ?? [] });
});

app.get("/frame-genealogies/:id", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const id = c.req.param("id");
  const { data, error } = await client.from("frame_genealogies").select("*").eq("id", id).single();
  if (error) throw error;
  const { data: events } = await client
    .from("frame_propagation_events")
    .select("*")
    .eq("genealogy_id", id)
    .order("occurred_at");
  return c.json({ genealogy: data, events: events ?? [] });
});

// Five-whys chains.
app.get("/five-whys", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const { data, error } = await client
    .from("five_whys_chains")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return c.json({ chains: data ?? [] });
});

app.get("/five-whys/:id", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const id = c.req.param("id");
  const { data, error } = await client.from("five_whys_chains").select("*").eq("id", id).single();
  if (error) throw error;
  const { data: levels } = await client
    .from("five_whys_levels")
    .select("*")
    .eq("chain_id", id)
    .order("level");
  return c.json({ chain: data, levels: levels ?? [] });
});

const fiveWhysCreateSchema = z.object({
  thesis_id: z.string().uuid().optional(),
  question: z.string().min(1),
});

app.post("/five-whys", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const parsed = fiveWhysCreateSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const { data, error } = await client
    .from("five_whys_chains")
    .insert({ user_id: userId, ...parsed.data })
    .select("id")
    .single();
  if (error) throw error;
  return c.json({ id: (data as { id: string }).id }, 201);
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
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const id = c.req.param("id");
  const parsed = levelSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const { error } = await client.from("five_whys_levels").insert({
    user_id: userId,
    chain_id: id,
    ...parsed.data,
  });
  if (error) throw error;
  // If level 4 or 5 is added with structural tier, mark reached_root.
  if (
    (parsed.data.level === "why_4_structural_condition" ||
      parsed.data.level === "why_5_root_design_choice") &&
    parsed.data.intervention_tier === "structural"
  ) {
    await client.from("five_whys_chains").update({ reached_root: true }).eq("id", id);
  }
  return c.json({ ok: true });
});

export default app;

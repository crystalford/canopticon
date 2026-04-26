// Theses CRUD: list, fetch, create, update, watch-set management.

import { Hono } from "hono";
import { z } from "zod";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { badRequest } from "../lib/errors.ts";
import { userClient } from "../lib/supabase.ts";
import { getPublicUserId } from "../lib/user.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const { data, error } = await client
    .from("theses")
    .select(`
      id, title, seed_summary, cynefin_domain, coined_phrase, ipcc_likelihood,
      is_public, public_slug, primary_operator, archived_at, created_at, updated_at,
      current_version:thesis_versions!theses_current_version_fk (id, version_number, tier_bluf, tier_80)
    `)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return c.json({ theses: data ?? [] });
});

app.get("/:id", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const id = c.req.param("id");
  const { data, error } = await client.from("theses").select("*").eq("id", id).single();
  if (error) throw error;

  const [versions, claims, watchSet, spine, inbox] = await Promise.all([
    client
      .from("thesis_versions")
      .select("*")
      .eq("thesis_id", id)
      .order("version_number", { ascending: false }),
    client
      .from("thesis_claims")
      .select("*")
      .eq(
        "thesis_version_id",
        (data as { current_version_id: string }).current_version_id ??
          "00000000-0000-0000-0000-000000000000",
      ),
    client.from("thesis_watch_sets").select("*").eq("thesis_id", id),
    client.from("thesis_concept_spine").select("*").eq("thesis_id", id),
    client.from("thesis_inbox").select("*").eq("thesis_id", id).eq("status", "pending"),
  ]);
  return c.json({
    thesis: data,
    versions: versions.data ?? [],
    claims: claims.data ?? [],
    watch_set: watchSet.data ?? [],
    concept_spine: spine.data ?? [],
    inbox: inbox.data ?? [],
  });
});

const createSchema = z.object({
  title: z.string().min(1),
  seed_summary: z.string().optional(),
  cynefin_domain: z.enum(["simple", "complicated", "complex", "chaotic"]).optional(),
  coined_phrase: z.string().optional(),
});

app.post("/", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const parsed = createSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const { data, error } = await client
    .from("theses")
    .insert({ user_id: userId, ...parsed.data })
    .select("id")
    .single();
  if (error) throw error;
  return c.json({ id: (data as { id: string }).id }, 201);
});

const updateSchema = z.object({
  title: z.string().optional(),
  seed_summary: z.string().optional(),
  coined_phrase: z.string().optional(),
  coined_phrase_definition: z.string().optional(),
  falsifying_observation: z.string().optional(),
  is_falsifiable: z.boolean().optional(),
  primary_operator: z.string().optional(),
  teachable_diagram_uri: z.string().optional(),
  public_graph_artifact_uri: z.string().optional(),
});

app.patch("/:id", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const id = c.req.param("id");
  const parsed = updateSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const { error } = await client.from("theses").update(parsed.data).eq("id", id);
  if (error) throw error;
  return c.json({ ok: true });
});

const watchAddSchema = z.object({
  entity_id: z.string().uuid(),
  excluded: z.boolean().optional(),
});

app.post("/:id/watch-set", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const id = c.req.param("id");
  const parsed = watchAddSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const { error } = await client.from("thesis_watch_sets").insert({
    user_id: userId,
    thesis_id: id,
    entity_id: parsed.data.entity_id,
    excluded: parsed.data.excluded ?? false,
  });
  if (error) throw error;
  return c.json({ ok: true });
});

app.delete("/:id/watch-set/:entity_id", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const id = c.req.param("id");
  const eid = c.req.param("entity_id");
  await client.from("thesis_watch_sets").delete().eq("thesis_id", id).eq("entity_id", eid);
  return c.json({ ok: true });
});

export default app;

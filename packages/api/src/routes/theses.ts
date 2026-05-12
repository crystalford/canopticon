// Theses CRUD.

import { Hono } from "hono";
import { z } from "zod";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { all, insertOne, one, run, updateById } from "../lib/d1.ts";
import { badRequest } from "../lib/errors.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/", async (c) => {
  const userId = c.get("user_id");
  const theses = await all(
    c.env.DB,
    `SELECT t.id, t.title, t.seed_summary, t.cynefin_domain, t.coined_phrase, t.ipcc_likelihood,
            t.is_public, t.public_slug, t.primary_operator, t.archived_at, t.created_at, t.updated_at,
            tv.id AS version_id, tv.version_number, tv.tier_bluf, tv.tier_80
     FROM theses t
     LEFT JOIN thesis_versions tv ON tv.id = t.current_version_id
     WHERE t.user_id = ?
     ORDER BY t.updated_at DESC`,
    [userId],
  );
  return c.json({ theses });
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const thesis = await one<{ current_version_id: string | null }>(
    c.env.DB,
    "SELECT * FROM theses WHERE id = ?",
    [id],
  );
  const [versions, claims, watch_set, concept_spine, inbox] = await Promise.all([
    all(
      c.env.DB,
      "SELECT * FROM thesis_versions WHERE thesis_id = ? ORDER BY version_number DESC",
      [id],
    ),
    thesis?.current_version_id
      ? all(c.env.DB, "SELECT * FROM thesis_claims WHERE thesis_version_id = ?", [
          thesis.current_version_id,
        ])
      : Promise.resolve([]),
    all(c.env.DB, "SELECT * FROM thesis_watch_sets WHERE thesis_id = ?", [id]),
    all(c.env.DB, "SELECT * FROM thesis_concept_spine WHERE thesis_id = ?", [id]),
    all(c.env.DB, "SELECT * FROM thesis_inbox WHERE thesis_id = ? AND status = 'pending'", [id]),
  ]);
  return c.json({ thesis, versions, claims, watch_set, concept_spine, inbox });
});

const createSchema = z.object({
  title: z.string().min(1),
  seed_summary: z.string().optional(),
  cynefin_domain: z.enum(["simple", "complicated", "complex", "chaotic"]).optional(),
  coined_phrase: z.string().optional(),
});

app.post("/", async (c) => {
  const userId = c.get("user_id");
  const parsed = createSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const id = await insertOne(c.env.DB, "theses", { user_id: userId, ...parsed.data });
  return c.json({ id }, 201);
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
  const id = c.req.param("id");
  const parsed = updateSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  await updateById(c.env.DB, "theses", id, parsed.data);
  return c.json({ ok: true });
});

const watchAddSchema = z.object({
  entity_id: z.string().uuid(),
  excluded: z.boolean().optional(),
});

app.post("/:id/watch-set", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  const parsed = watchAddSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  await insertOne(c.env.DB, "thesis_watch_sets", {
    user_id: userId,
    thesis_id: id,
    entity_id: parsed.data.entity_id,
    excluded: parsed.data.excluded ?? false,
  });
  return c.json({ ok: true });
});

app.delete("/:id/watch-set/:entity_id", async (c) => {
  const id = c.req.param("id");
  const eid = c.req.param("entity_id");
  await run(c.env.DB, "DELETE FROM thesis_watch_sets WHERE thesis_id = ? AND entity_id = ?", [
    id,
    eid,
  ]);
  return c.json({ ok: true });
});

export default app;

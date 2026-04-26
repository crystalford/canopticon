// Claims: list, fetch, queue actions for entity resolution and dedup.
// Powers operator screens that surface claim cards and the dedup queue tab.

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
  const layer = c.req.query("layer");
  const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "50", 10), 200);

  let q = client
    .from("claims")
    .select(`
      id, layer, admiralty_grade, verification_status, ipcc_likelihood, intervention_tier, public_slug, created_at,
      current_version:claim_versions!claims_current_version_fk (id, version_number, claim_text, qualifier)
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (layer) q = q.eq("layer", layer);
  const { data, error } = await q;
  if (error) throw error;
  return c.json({ claims: data ?? [] });
});

app.get("/:id", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const id = c.req.param("id");
  const { data, error } = await client.from("claims").select("*").eq("id", id).single();
  if (error) throw error;
  const { data: versions } = await client
    .from("claim_versions")
    .select("*")
    .eq("claim_id", id)
    .order("version_number", { ascending: false });
  const { data: sources } = await client
    .from("claim_sources")
    .select("source_id, supports, citation_excerpt, citation_locator")
    .eq("claim_id", id);
  return c.json({ claim: data, versions: versions ?? [], sources: sources ?? [] });
});

app.get("/dedup-queue", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const { data, error } = await client
    .from("claim_deduplication_queue")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return c.json({ queue: data ?? [] });
});

const dedupDecisionSchema = z.object({
  decision: z.enum(["duplicate", "refinement", "contradiction", "distinct"]),
  notes: z.string().optional(),
});

app.post("/dedup-queue/:id/decide", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const id = c.req.param("id");
  const parsed = dedupDecisionSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid decision", { issues: parsed.error.issues });
  const { error } = await client
    .from("claim_deduplication_queue")
    .update({
      status: "resolved",
      decided_at: new Date().toISOString(),
      decision_notes: parsed.data.notes ?? null,
      proposed_relation: parsed.data.decision,
    })
    .eq("id", id);
  if (error) throw error;
  return c.json({ ok: true });
});

export default app;

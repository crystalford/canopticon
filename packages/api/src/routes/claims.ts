// Claims: list, fetch, dedup queue actions.

import { Hono } from "hono";
import { z } from "zod";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { all, one, updateById } from "../lib/d1.ts";
import { badRequest } from "../lib/errors.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/", async (c) => {
  const userId = c.get("user_id");
  const layer = c.req.query("layer");
  const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "50", 10), 200);
  const sql = layer
    ? `SELECT c.id, c.layer, c.admiralty_grade, c.verification_status, c.ipcc_likelihood, c.intervention_tier, c.public_slug, c.created_at,
              cv.id AS version_id, cv.version_number, cv.claim_text, cv.qualifier
       FROM claims c LEFT JOIN claim_versions cv ON cv.id = c.current_version_id
       WHERE c.user_id = ? AND c.layer = ? ORDER BY c.created_at DESC LIMIT ?`
    : `SELECT c.id, c.layer, c.admiralty_grade, c.verification_status, c.ipcc_likelihood, c.intervention_tier, c.public_slug, c.created_at,
              cv.id AS version_id, cv.version_number, cv.claim_text, cv.qualifier
       FROM claims c LEFT JOIN claim_versions cv ON cv.id = c.current_version_id
       WHERE c.user_id = ? ORDER BY c.created_at DESC LIMIT ?`;
  const params = layer ? [userId, layer, limit] : [userId, limit];
  const claims = await all(c.env.DB, sql, params);
  return c.json({ claims });
});

app.get("/dedup-queue", async (c) => {
  const userId = c.get("user_id");
  const queue = await all(
    c.env.DB,
    "SELECT * FROM claim_deduplication_queue WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC",
    [userId],
  );
  return c.json({ queue });
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const claim = await one(c.env.DB, "SELECT * FROM claims WHERE id = ?", [id]);
  const versions = await all(
    c.env.DB,
    "SELECT * FROM claim_versions WHERE claim_id = ? ORDER BY version_number DESC",
    [id],
  );
  const sources = await all(
    c.env.DB,
    "SELECT source_id, supports, citation_excerpt, citation_locator FROM claim_sources WHERE claim_id = ?",
    [id],
  );
  return c.json({ claim, versions, sources });
});

const dedupDecisionSchema = z.object({
  decision: z.enum(["duplicate", "refinement", "contradiction", "distinct"]),
  notes: z.string().optional(),
});

app.post("/dedup-queue/:id/decide", async (c) => {
  const id = c.req.param("id");
  const parsed = dedupDecisionSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid decision", { issues: parsed.error.issues });
  await updateById(c.env.DB, "claim_deduplication_queue", id, {
    status: "resolved",
    decided_at: new Date().toISOString(),
    decision_notes: parsed.data.notes ?? null,
    proposed_relation: parsed.data.decision,
  });
  return c.json({ ok: true });
});

export default app;

// Characters: operator CRUD for the character compartment.
// Public reads live in src/routes/public.ts under /v1/public/characters.

import { Hono } from "hono";
import { z } from "zod";
import { type AuthContext, requireAuth } from "../../auth/middleware.ts";
import { all, insertOne, one, parseJson, run } from "../../lib/d1.ts";
import { badRequest, notFound } from "../../lib/errors.ts";
import {
  demoteCharacter,
  listCharacters,
  promoteToCharacter,
  seedCharacterFromWikipedia,
} from "../lib/character.ts";
import { computeHeatScore } from "../lib/heat-score.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/", async (c) => {
  const userId = c.get("user_id");
  const characters = await listCharacters(c.env, userId, { limit: 200 });
  return c.json({ characters });
});

app.get("/:slug", async (c) => {
  const userId = c.get("user_id");
  const slug = c.req.param("slug");
  const profile = await one<{
    id: string;
    entity_id: string;
    canonical_name: string;
    slug: string;
    current_role: string | null;
    bio_md: string;
    wikipedia_url: string | null;
    portrait_url: string | null;
    last_synced_at: string | null;
    version_count: number;
    visibility: string;
    created_at: string;
    updated_at: string;
  }>(c.env.DB, "SELECT * FROM character_profiles WHERE slug = ? AND user_id = ?", [slug, userId]);
  if (!profile) throw notFound();
  const entity = await one<{ heat_score: number; metadata: string | null }>(
    c.env.DB,
    "SELECT heat_score, metadata FROM entities WHERE id = ?",
    [profile.entity_id],
  );
  const timeline = await all(
    c.env.DB,
    "SELECT * FROM character_timeline_events WHERE entity_id = ? ORDER BY event_date DESC",
    [profile.entity_id],
  );
  const proposals = await all(
    c.env.DB,
    `SELECT id, kind, proposed_payload, rationale, source_claim_ids, status, created_at
       FROM character_update_proposals WHERE entity_id = ? AND status = 'pending'
       ORDER BY created_at DESC`,
    [profile.entity_id],
  );
  return c.json({
    profile,
    heat_score: entity?.heat_score ?? 0,
    heat_breakdown: parseJson<Record<string, unknown>>(entity?.metadata, {}).heat_breakdown ?? null,
    timeline: timeline.map((t) => ({
      ...t,
      source_claim_ids: parseJson((t as { source_claim_ids: unknown }).source_claim_ids, []),
    })),
    proposals: proposals.map((p) => ({
      ...p,
      proposed_payload: parseJson((p as { proposed_payload: unknown }).proposed_payload, {}),
      source_claim_ids: parseJson((p as { source_claim_ids: unknown }).source_claim_ids, []),
    })),
  });
});

const seedSchema = z.object({
  entity_id: z.string(),
  wikipedia_title: z.string().optional(),
});

app.post("/seed", async (c) => {
  const userId = c.get("user_id");
  const parsed = seedSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const result = await seedCharacterFromWikipedia(
    c.env,
    userId,
    parsed.data.entity_id,
    parsed.data.wikipedia_title ? { wikipediaTitle: parsed.data.wikipedia_title } : {},
  );
  return c.json({ ok: true, result });
});

app.post("/:entityId/promote", async (c) => {
  const userId = c.get("user_id");
  const result = await promoteToCharacter(c.env, userId, c.req.param("entityId"));
  return c.json({ ok: true, result });
});

app.post("/:entityId/demote", async (c) => {
  const userId = c.get("user_id");
  await demoteCharacter(c.env, userId, c.req.param("entityId"));
  return c.json({ ok: true });
});

app.post("/:entityId/recompute-heat", async (c) => {
  const userId = c.get("user_id");
  const breakdown = await computeHeatScore(c.env, userId, c.req.param("entityId"));
  return c.json({ breakdown });
});

const editBioSchema = z.object({
  bio_md: z.string().min(1),
  change_summary: z.string().optional(),
});

app.patch("/:slug/bio", async (c) => {
  const userId = c.get("user_id");
  const parsed = editBioSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const profile = await one<{ id: string; entity_id: string; version_count: number }>(
    c.env.DB,
    "SELECT id, entity_id, version_count FROM character_profiles WHERE slug = ? AND user_id = ?",
    [c.req.param("slug"), userId],
  );
  if (!profile) throw notFound();
  const nextVersion = (profile.version_count ?? 0) + 1;
  await insertOne(c.env.DB, "character_profile_versions", {
    entity_id: profile.entity_id,
    version_number: nextVersion,
    bio_md: parsed.data.bio_md,
    change_summary: parsed.data.change_summary ?? "Operator edit",
  });
  await run(
    c.env.DB,
    "UPDATE character_profiles SET bio_md = ?, version_count = ?, updated_at = ? WHERE id = ?",
    [parsed.data.bio_md, nextVersion, new Date().toISOString(), profile.id],
  );
  return c.json({ ok: true, version: nextVersion });
});

const proposalDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  edited_payload: z.record(z.unknown()).optional(),
  reason: z.string().optional(),
});

app.post("/proposals/:id/decide", async (c) => {
  const userId = c.get("user_id");
  const parsed = proposalDecisionSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });

  const proposal = await one<{
    id: string;
    entity_id: string;
    kind: string;
    proposed_payload: string;
    source_claim_ids: string;
    status: string;
  }>(
    c.env.DB,
    `SELECT cup.id, cup.entity_id, cup.kind, cup.proposed_payload,
            cup.source_claim_ids, cup.status
       FROM character_update_proposals cup
       JOIN character_profiles cp ON cp.entity_id = cup.entity_id
      WHERE cup.id = ? AND cp.user_id = ?`,
    [c.req.param("id"), userId],
  );
  if (!proposal) throw notFound();
  if (proposal.status !== "pending") throw badRequest(`already ${proposal.status}`);

  if (parsed.data.decision === "reject") {
    await run(
      c.env.DB,
      "UPDATE character_update_proposals SET status = 'rejected', reviewed_at = ? WHERE id = ?",
      [new Date().toISOString(), proposal.id],
    );
    return c.json({ ok: true, decision: "rejected" });
  }

  const payload = parsed.data.edited_payload ?? parseJson(proposal.proposed_payload, {});
  const sourceClaimIds = parseJson<string[]>(proposal.source_claim_ids, []);

  if (proposal.kind === "timeline_event") {
    await insertOne(c.env.DB, "character_timeline_events", {
      entity_id: proposal.entity_id,
      event_date: String((payload as Record<string, unknown>).event_date ?? ""),
      event_title: String((payload as Record<string, unknown>).event_title ?? ""),
      event_body: ((payload as Record<string, unknown>).event_body as string | undefined) ?? null,
      source_claim_ids: sourceClaimIds,
      significance: String((payload as Record<string, unknown>).significance ?? "context"),
      status: "confirmed",
      proposed_by: "agent",
      reviewed_at: new Date().toISOString(),
    });
  } else if (proposal.kind === "bio_revision") {
    const profile = await one<{ id: string; bio_md: string; version_count: number }>(
      c.env.DB,
      "SELECT id, bio_md, version_count FROM character_profiles WHERE entity_id = ?",
      [proposal.entity_id],
    );
    if (profile) {
      const newBody = `${profile.bio_md.trim()}\n\n${String(
        (payload as Record<string, unknown>).paragraph_md ?? "",
      )}`;
      const nextVersion = (profile.version_count ?? 0) + 1;
      await insertOne(c.env.DB, "character_profile_versions", {
        entity_id: proposal.entity_id,
        version_number: nextVersion,
        bio_md: newBody,
        change_summary: `Approved proposal ${proposal.id}`,
      });
      await run(
        c.env.DB,
        "UPDATE character_profiles SET bio_md = ?, version_count = ?, updated_at = ? WHERE id = ?",
        [newBody, nextVersion, new Date().toISOString(), profile.id],
      );
    }
  } else if (proposal.kind === "role_change") {
    await run(
      c.env.DB,
      "UPDATE character_profiles SET current_role = ?, updated_at = ? WHERE entity_id = ?",
      [
        String((payload as Record<string, unknown>).to_role ?? ""),
        new Date().toISOString(),
        proposal.entity_id,
      ],
    );
  }

  await run(
    c.env.DB,
    "UPDATE character_update_proposals SET status = 'approved', reviewed_at = ? WHERE id = ?",
    [new Date().toISOString(), proposal.id],
  );
  return c.json({ ok: true, decision: "approved" });
});

export default app;

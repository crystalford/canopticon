// Findings routes — see canopticon-api-v1.0.md §16 and migration 0018.
//
//   GET    /v1/findings                              list (filter status,
//                                                     novelty_grade,
//                                                     pattern_type, thesis_id)
//   GET    /v1/findings/:id                          one finding with
//                                                     supporting claims
//   POST   /v1/findings                              declare manually
//   PATCH  /v1/findings/:id                          edit fields, change
//                                                     status (draft →
//                                                     confirmed → public)
//   POST   /v1/findings/:id/publish                  flip is_public + set
//                                                     status='public'
//   POST   /v1/findings/:id/retract                  status='retracted'
//                                                     with retraction note
//   POST   /v1/findings/:id/supporting_claims        attach a supporting
//                                                     claim (with linchpin
//                                                     flag)
//   DELETE /v1/findings/:id/supporting_claims/:claim_id
//                                                     detach
//   POST   /v1/theses/:thesis_id/surface-findings    fire the Novelty
//                                                     Surfacer over a thesis

import { Hono } from "hono";
import { z } from "zod";
import type { AuthContext } from "../auth/middleware.ts";
import { requireAuth } from "../auth/middleware.ts";
import { AnthropicClient } from "../lib/anthropic.ts";
import { badRequest, notFound } from "../lib/errors.ts";
import { serviceClient, userClient } from "../lib/supabase.ts";
import { runNoveltySurfacer } from "../orchestrator/novelty_surfacer.ts";

const PATTERN_TYPES = [
  "recurring_actor",
  "transaction_chain",
  "mechanism_overlap",
  "structural_homology",
  "negative_space",
  "conflict_of_interest",
  "temporal_correlation",
  "jurisdictional_arbitrage",
  "other",
] as const;

const findings = new Hono<AuthContext>();
findings.use("*", requireAuth());

findings.get("/", async (c) => {
  const status = c.req.query("status");
  const grade = c.req.query("novelty_grade");
  const pattern = c.req.query("pattern_type");
  const thesisId = c.req.query("thesis_id");
  const client = userClient(c.env, c.get("jwt"));
  let q = client
    .from("findings")
    .select(
      "id, thesis_id, title, slug, narrative, novelty_grade, pattern_type, confidence, status, is_public, surfaced_by, published_at, retracted_at, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) q = q.eq("status", status);
  if (grade) q = q.eq("novelty_grade", grade);
  if (pattern) q = q.eq("pattern_type", pattern);
  if (thesisId) q = q.eq("thesis_id", thesisId);
  const { data, error } = await q;
  if (error) throw new Error(`findings.list: ${error.message}`);
  return c.json({ data });
});

findings.get("/:id", async (c) => {
  const id = c.req.param("id");
  const client = userClient(c.env, c.get("jwt"));

  const { data: finding, error } = await client
    .from("findings")
    .select(
      "id, thesis_id, title, slug, narrative, novelty_grade, pattern_type, confidence, status, is_public, surfaced_by, surfaced_by_role_invocation_id, published_at, retracted_at, retraction_note, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`findings.get: ${error.message}`);
  if (!finding) throw notFound("Finding not found");
  const f = finding as { id: string };

  const { data: supporting } = await client
    .from("finding_supporting_claims")
    .select("id, claim_id, is_linchpin, added_at")
    .eq("finding_id", f.id);
  const claimIds = (supporting ?? []).map((row) => (row as { claim_id: string }).claim_id);
  const claimMap: Record<
    string,
    { admiralty_grade: string; verification_status: string; claim_text: string }
  > = {};
  if (claimIds.length > 0) {
    const { data: claims } = await client
      .from("claims")
      .select("id, admiralty_grade, verification_status, current_version_id")
      .in("id", claimIds);
    const versionIds = (claims ?? [])
      .map((row) => (row as { current_version_id: string | null }).current_version_id)
      .filter((v): v is string => Boolean(v));
    const textById: Record<string, string> = {};
    if (versionIds.length > 0) {
      const { data: cv } = await client
        .from("claim_versions")
        .select("claim_id, claim_text")
        .in("id", versionIds);
      for (const row of cv ?? []) {
        const r = row as { claim_id: string; claim_text: string };
        textById[r.claim_id] = r.claim_text;
      }
    }
    for (const c2 of claims ?? []) {
      const r = c2 as {
        id: string;
        admiralty_grade: string;
        verification_status: string;
      };
      claimMap[r.id] = {
        admiralty_grade: r.admiralty_grade,
        verification_status: r.verification_status,
        claim_text: textById[r.id] ?? "",
      };
    }
  }

  const supporting_claims = (supporting ?? []).map((row) => {
    const r = row as { id: string; claim_id: string; is_linchpin: boolean; added_at: string };
    const claim = claimMap[r.claim_id];
    return {
      id: r.id,
      claim_id: r.claim_id,
      is_linchpin: r.is_linchpin,
      added_at: r.added_at,
      admiralty_grade: claim?.admiralty_grade ?? "",
      verification_status: claim?.verification_status ?? "",
      claim_text: claim?.claim_text ?? "",
    };
  });

  return c.json({ data: { ...finding, supporting_claims } });
});

const createSchema = z.object({
  thesis_id: z.string().uuid().nullable().optional(),
  title: z.string().min(3).max(500),
  slug: z
    .string()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase alphanumeric + dashes"),
  narrative: z.string().min(20).max(8000),
  novelty_grade: z.enum(["incremental", "notable", "breakthrough"]).default("incremental"),
  pattern_type: z.enum(PATTERN_TYPES).default("other"),
  confidence: z.number().min(0).max(1).optional(),
});

findings.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid finding payload", { issues: parsed.error.issues });
  }
  const userId = c.get("user_id");
  const client = userClient(c.env, c.get("jwt"));

  const { data, error } = await client
    .from("findings")
    .insert({
      user_id: userId,
      thesis_id: parsed.data.thesis_id ?? null,
      title: parsed.data.title,
      slug: parsed.data.slug,
      narrative: parsed.data.narrative,
      novelty_grade: parsed.data.novelty_grade,
      pattern_type: parsed.data.pattern_type,
      confidence: parsed.data.confidence ?? null,
      status: "draft",
      is_public: false,
      surfaced_by: "operator",
    })
    .select("id, slug, created_at")
    .single();
  if (error) {
    if (error.code === "23505") throw badRequest("A finding with that slug already exists");
    throw new Error(`findings.create: ${error.message}`);
  }
  return c.json({ data }, 201);
});

const patchSchema = z.object({
  title: z.string().min(3).max(500).optional(),
  narrative: z.string().min(20).max(8000).optional(),
  novelty_grade: z.enum(["incremental", "notable", "breakthrough"]).optional(),
  pattern_type: z.enum(PATTERN_TYPES).optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  status: z.enum(["draft", "confirmed", "public", "retracted"]).optional(),
});

findings.patch("/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid patch payload", { issues: parsed.error.issues });
  }
  const client = userClient(c.env, c.get("jwt"));

  const patch: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "confirmed") patch.confirmed_at = new Date().toISOString();

  const { data, error } = await client
    .from("findings")
    .update(patch)
    .eq("id", id)
    .select("id, status, novelty_grade, pattern_type, updated_at")
    .single();
  if (error) throw new Error(`findings.patch: ${error.message}`);
  return c.json({ data });
});

findings.post("/:id/publish", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const client = userClient(c.env, c.get("jwt"));

  const { data: existing } = await client
    .from("findings")
    .select("status, published_at, confirmed_at")
    .eq("id", id)
    .maybeSingle<{ status: string; published_at: string | null; confirmed_at: string | null }>();
  if (!existing) throw notFound("Finding not found");
  if (existing.status === "draft") {
    throw badRequest("Confirm the finding before publishing");
  }
  if (existing.status === "retracted") {
    throw badRequest("Cannot publish a retracted finding");
  }

  const publishedAt = existing.published_at ?? new Date().toISOString();
  const { data, error } = await client
    .from("findings")
    .update({
      is_public: true,
      status: "public",
      published_at: publishedAt,
    })
    .eq("id", id)
    .select("id, status, is_public, published_at")
    .single();
  if (error) throw new Error(`findings.publish: ${error.message}`);
  return c.json({ data });
});

const retractSchema = z.object({
  retraction_note: z.string().min(10).max(2000),
});

findings.post("/:id/retract", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = retractSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid retraction payload", { issues: parsed.error.issues });
  }
  const client = userClient(c.env, c.get("jwt"));

  const { data, error } = await client
    .from("findings")
    .update({
      status: "retracted",
      retracted_at: new Date().toISOString(),
      retraction_note: parsed.data.retraction_note,
    })
    .eq("id", id)
    .select("id, status, retracted_at, retraction_note")
    .single();
  if (error) throw new Error(`findings.retract: ${error.message}`);
  return c.json({ data });
});

const supportingSchema = z.object({
  claim_id: z.string().uuid(),
  is_linchpin: z.boolean().optional(),
});

findings.post("/:id/supporting_claims", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = supportingSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid supporting-claim payload", { issues: parsed.error.issues });
  }
  const userId = c.get("user_id");
  const client = userClient(c.env, c.get("jwt"));

  const { data, error } = await client
    .from("finding_supporting_claims")
    .insert({
      user_id: userId,
      finding_id: id,
      claim_id: parsed.data.claim_id,
      is_linchpin: parsed.data.is_linchpin ?? false,
    })
    .select("id, claim_id, is_linchpin, added_at")
    .single();
  if (error) {
    if (error.code === "23505") throw badRequest("Claim already linked to this finding");
    throw new Error(`findings.supporting: ${error.message}`);
  }
  return c.json({ data }, 201);
});

findings.delete("/:id/supporting_claims/:claim_id", async (c) => {
  const id = c.req.param("id");
  const claimId = c.req.param("claim_id");
  if (!id || !claimId) throw badRequest("Missing parameter");
  const client = userClient(c.env, c.get("jwt"));

  const { error } = await client
    .from("finding_supporting_claims")
    .delete()
    .eq("finding_id", id)
    .eq("claim_id", claimId);
  if (error) throw new Error(`findings.supporting.remove: ${error.message}`);
  return c.json({ data: { finding_id: id, claim_id: claimId, removed: true } });
});

// --- thesis-scoped surfacing entry point --------------------------------

findings.post("/surface/:thesis_id", async (c) => {
  const thesisId = c.req.param("thesis_id");
  if (!thesisId) throw badRequest("Missing :thesis_id parameter");
  const userId = c.get("user_id");

  const ctx = {
    service: serviceClient(c.env),
    anthropic: new AnthropicClient({ apiKey: c.env.ANTHROPIC_API_KEY }),
  };

  const result = await runNoveltySurfacer(ctx, {
    user_id: userId,
    triggered_by: "findings.surface",
    thesis_id: thesisId,
  });

  if (result.status === "denied") {
    return c.json({ data: { status: "pending_approval", decision: result.decision } }, 202);
  }
  if (result.status === "skipped") {
    return c.json({ data: { status: "skipped", reason: result.reason } });
  }
  return c.json({ data: { ...result.report, role_invocation_id: result.role_invocation_id } });
});

export default findings;

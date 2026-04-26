// Theses routes — see canopticon-api-v1.0.md §7.
//
//   GET  /v1/theses                       list with status filter
//   GET  /v1/theses/:id                   thesis with current version,
//                                          claims by layer, open questions
//   POST /v1/theses                       declare a new thesis
//   POST /v1/theses/:id/versions          add a new version (BLUF, tiers,
//                                          IPCC qualifier)
//   GET  /v1/theses/:id/claims            integrated claims with layer
//   POST /v1/theses/:id/claims            integrate a claim at a layer
//   DELETE /v1/theses/:id/claims/:claim_id remove integration
//   POST /v1/theses/:id/interrogate       fire the Interrogator on demand
//   POST /v1/theses/:id/publish           mark is_public=TRUE; fires the
//                                          publication-gate roles inline

import { CLAIM_LAYERS, IPCC_LIKELIHOODS } from "@canopticon/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthContext } from "../auth/middleware.ts";
import { requireAuth } from "../auth/middleware.ts";
import { AnthropicClient } from "../lib/anthropic.ts";
import { badRequest, notFound } from "../lib/errors.ts";
import { serviceClient, userClient } from "../lib/supabase.ts";
import { runGapSurfacer } from "../orchestrator/gap_surfacer.ts";
import { runInterrogator } from "../orchestrator/interrogator.ts";
import { runNoveltySurfacer } from "../orchestrator/novelty_surfacer.ts";
import { runPublicationGate } from "../orchestrator/publication.ts";

const theses = new Hono<AuthContext>();
theses.use("*", requireAuth());

// --- list / get ----------------------------------------------------------

theses.get("/", async (c) => {
  const status = c.req.query("status");
  const client = userClient(c.env, c.get("jwt"));
  let q = client
    .from("theses")
    .select(
      "id, title, slug, status, declared_at, cynefin_domain, is_public, created_at, updated_at",
    )
    .order("declared_at", { ascending: false })
    .limit(100);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(`theses.list: ${error.message}`);
  return c.json({ data });
});

theses.get("/:id", async (c) => {
  const id = c.req.param("id");
  const client = userClient(c.env, c.get("jwt"));

  const [{ data: thesis, error: tErr }, { data: version, error: vErr }] = await Promise.all([
    client
      .from("theses")
      .select(
        "id, title, slug, status, declared_at, cynefin_domain, is_public, current_version_id, created_at, updated_at",
      )
      .eq("id", id)
      .maybeSingle(),
    client
      .from("thesis_versions")
      .select(
        "id, version_number, seed_paragraph, bluf, tier_80, tier_800, tier_full, ipcc_likelihood, change_summary, created_at",
      )
      .eq("thesis_id", id)
      .eq("is_current", true)
      .maybeSingle(),
  ]);

  if (tErr) throw new Error(`theses.get: ${tErr.message}`);
  if (!thesis) throw notFound("Thesis not found");
  if (vErr) throw new Error(`theses.get.version: ${vErr.message}`);

  return c.json({ data: { ...thesis, current_version: version } });
});

// --- create --------------------------------------------------------------

const createSchema = z.object({
  title: z.string().min(3).max(500),
  slug: z
    .string()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase alphanumeric + dashes"),
  seed_paragraph: z.string().min(20).max(4000),
  cynefin_domain: z.enum(["clear", "complicated", "complex", "chaotic", "disorder"]).optional(),
});

theses.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid thesis payload", { issues: parsed.error.issues });
  }
  const userId = c.get("user_id");
  const client = userClient(c.env, c.get("jwt"));

  // Insert thesis row first (without current_version_id), then the
  // initial thesis_versions row, then patch current_version_id.
  const { data: thesisRow, error: tErr } = await client
    .from("theses")
    .insert({
      user_id: userId,
      title: parsed.data.title,
      slug: parsed.data.slug,
      status: "declared",
      cynefin_domain: parsed.data.cynefin_domain ?? null,
    })
    .select("id")
    .single();
  if (tErr) throw new Error(`theses.create: ${tErr.message}`);

  const thesisId = thesisRow.id as string;

  const { data: versionRow, error: vErr } = await client
    .from("thesis_versions")
    .insert({
      thesis_id: thesisId,
      user_id: userId,
      version_number: 1,
      is_current: true,
      seed_paragraph: parsed.data.seed_paragraph,
      change_summary: "initial declaration",
    })
    .select("id")
    .single();
  if (vErr) throw new Error(`theses.create.version: ${vErr.message}`);

  await client
    .from("theses")
    .update({ current_version_id: versionRow.id as string })
    .eq("id", thesisId);

  return c.json({ data: { id: thesisId, version_id: versionRow.id } }, 201);
});

// --- new version ---------------------------------------------------------

const versionSchema = z.object({
  seed_paragraph: z.string().min(20).max(4000),
  bluf: z.string().max(500).optional(),
  tier_80: z.string().max(800).optional(),
  tier_800: z.string().max(8000).optional(),
  tier_full: z.string().max(80_000).optional(),
  ipcc_likelihood: z.enum(IPCC_LIKELIHOODS as readonly [string, ...string[]]).optional(),
  change_summary: z.string().max(500).optional(),
});

theses.post("/:id/versions", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = versionSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid version payload", { issues: parsed.error.issues });
  }
  const userId = c.get("user_id");
  const client = userClient(c.env, c.get("jwt"));

  const { data: existing, error: existingErr } = await client
    .from("thesis_versions")
    .select("version_number")
    .eq("thesis_id", id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingErr) throw new Error(`theses.versions: ${existingErr.message}`);
  const nextVersion = ((existing?.version_number as number) ?? 0) + 1;

  const { data: row, error: insertErr } = await client
    .from("thesis_versions")
    .insert({
      thesis_id: id,
      user_id: userId,
      version_number: nextVersion,
      is_current: true,
      seed_paragraph: parsed.data.seed_paragraph,
      bluf: parsed.data.bluf ?? null,
      tier_80: parsed.data.tier_80 ?? null,
      tier_800: parsed.data.tier_800 ?? null,
      tier_full: parsed.data.tier_full ?? null,
      ipcc_likelihood: parsed.data.ipcc_likelihood ?? null,
      change_summary: parsed.data.change_summary ?? "manual update",
    })
    .select("id, version_number")
    .single();
  if (insertErr) throw new Error(`theses.versions.insert: ${insertErr.message}`);

  await client
    .from("theses")
    .update({ current_version_id: row.id as string })
    .eq("id", id);

  return c.json({ data: row });
});

// --- claims --------------------------------------------------------------

theses.get("/:id/claims", async (c) => {
  const id = c.req.param("id");
  const client = userClient(c.env, c.get("jwt"));

  const { data: tcs, error: tcErr } = await client
    .from("thesis_claims")
    .select("claim_id, layer, added_at")
    .eq("thesis_id", id)
    .is("removed_at", null);
  if (tcErr) throw new Error(`theses.claims: ${tcErr.message}`);

  const ids = (tcs ?? []).map((row) => (row as { claim_id: string }).claim_id);
  if (ids.length === 0) return c.json({ data: [] });

  const { data: claims, error: cErr } = await client
    .from("claims")
    .select("id, layer, admiralty_grade, verification_status, current_version_id")
    .in("id", ids);
  if (cErr) throw new Error(`theses.claims.fetch: ${cErr.message}`);

  // Pull current version texts so the studio screen can render claim_text
  // without an extra round-trip per claim.
  const versionIds = (claims ?? [])
    .map((row) => (row as { current_version_id: string | null }).current_version_id)
    .filter((v): v is string => Boolean(v));
  const versionsById: Record<string, { claim_text: string; data: string }> = {};
  if (versionIds.length > 0) {
    const { data: versions } = await client
      .from("claim_versions")
      .select("id, claim_id, claim_text, data")
      .in("id", versionIds);
    for (const v of versions ?? []) {
      const row = v as { id: string; claim_text: string; data: string };
      versionsById[row.id] = { claim_text: row.claim_text, data: row.data };
    }
  }

  const integrationByClaim: Record<string, { layer: string; added_at: string }> = {};
  for (const tc of tcs ?? []) {
    const row = tc as { claim_id: string; layer: string; added_at: string };
    integrationByClaim[row.claim_id] = { layer: row.layer, added_at: row.added_at };
  }

  const merged = (claims ?? []).map((row) => {
    const claim = row as {
      id: string;
      layer: string;
      admiralty_grade: string;
      verification_status: string;
      current_version_id: string | null;
    };
    const text = claim.current_version_id
      ? versionsById[claim.current_version_id]?.claim_text
      : null;
    const integration = integrationByClaim[claim.id];
    return {
      id: claim.id,
      layer: integration?.layer ?? claim.layer,
      admiralty_grade: claim.admiralty_grade,
      verification_status: claim.verification_status,
      claim_text: text ?? "",
      added_at: integration?.added_at ?? null,
    };
  });

  return c.json({ data: merged });
});

const integrateSchema = z.object({
  claim_id: z.string().uuid(),
  layer: z.enum(CLAIM_LAYERS as readonly [string, ...string[]]),
});

theses.post("/:id/claims", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = integrateSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid integration payload", { issues: parsed.error.issues });
  }
  const userId = c.get("user_id");
  const client = userClient(c.env, c.get("jwt"));

  const { data, error } = await client
    .from("thesis_claims")
    .insert({
      user_id: userId,
      thesis_id: id,
      claim_id: parsed.data.claim_id,
      layer: parsed.data.layer,
    })
    .select("id, layer, added_at")
    .single();
  if (error) {
    if (error.code === "23505") {
      throw badRequest("Claim already integrated at that layer");
    }
    throw new Error(`theses.claims.integrate: ${error.message}`);
  }

  return c.json({ data }, 201);
});

theses.delete("/:id/claims/:claim_id", async (c) => {
  const id = c.req.param("id");
  const claimId = c.req.param("claim_id");
  if (!id || !claimId) throw badRequest("Missing parameter");
  const client = userClient(c.env, c.get("jwt"));

  const { error } = await client
    .from("thesis_claims")
    .update({ removed_at: new Date().toISOString() })
    .eq("thesis_id", id)
    .eq("claim_id", claimId)
    .is("removed_at", null);
  if (error) throw new Error(`theses.claims.remove: ${error.message}`);

  return c.json({ data: { thesis_id: id, claim_id: claimId, removed: true } });
});

// --- questions ------------------------------------------------------------

theses.get("/:id/questions", async (c) => {
  const id = c.req.param("id");
  const client = userClient(c.env, c.get("jwt"));
  const { data, error } = await client
    .from("questions")
    .select(
      "id, text, rationale, evidence_targets, expected_information_gain, status, generated_by, created_at",
    )
    .eq("thesis_id", id)
    .order("expected_information_gain", { ascending: false })
    .limit(100);
  if (error) throw new Error(`theses.questions: ${error.message}`);
  return c.json({ data });
});

theses.post("/:id/interrogate", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const userId = c.get("user_id");

  const ctx = {
    service: serviceClient(c.env),
    anthropic: new AnthropicClient({ apiKey: c.env.ANTHROPIC_API_KEY }),
  };

  const result = await runInterrogator(ctx, {
    user_id: userId,
    thesis_id: id,
    triggered_by: "manual",
  });

  if (result.status === "denied") {
    return c.json({ data: { status: "pending_approval", decision: result.decision } }, 202);
  }
  return c.json({ data: result });
});

// --- publish (publication-gate roles) ------------------------------------

theses.post("/:id/publish", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const userId = c.get("user_id");

  const ctx = {
    service: serviceClient(c.env),
    anthropic: new AnthropicClient({ apiKey: c.env.ANTHROPIC_API_KEY }),
  };

  const result = await runPublicationGate(ctx, {
    user_id: userId,
    thesis_id: id,
    triggered_by: "operator_manual",
  });

  return c.json({ data: result });
});

// --- gap surfacer + novelty surfacer (manual fire) ----------------------

theses.post("/:id/surface-gaps", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const userId = c.get("user_id");

  const ctx = {
    service: serviceClient(c.env),
    anthropic: new AnthropicClient({ apiKey: c.env.ANTHROPIC_API_KEY }),
  };

  const result = await runGapSurfacer(ctx, {
    user_id: userId,
    thesis_id: id,
    triggered_by: "operator_manual",
  });

  if (result.status === "denied") {
    return c.json({ data: { status: "pending_approval", decision: result.decision } }, 202);
  }
  if (result.status === "skipped") {
    return c.json({ data: { status: "skipped", reason: result.reason } });
  }
  return c.json({
    data: { ...result.report, questions_written: result.questions_written },
  });
});

theses.post("/:id/surface-findings", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const userId = c.get("user_id");

  const ctx = {
    service: serviceClient(c.env),
    anthropic: new AnthropicClient({ apiKey: c.env.ANTHROPIC_API_KEY }),
  };

  const result = await runNoveltySurfacer(ctx, {
    user_id: userId,
    thesis_id: id,
    triggered_by: "operator_manual",
  });

  if (result.status === "denied") {
    return c.json({ data: { status: "pending_approval", decision: result.decision } }, 202);
  }
  if (result.status === "skipped") {
    return c.json({ data: { status: "skipped", reason: result.reason } });
  }
  return c.json({ data: result.report });
});

export default theses;

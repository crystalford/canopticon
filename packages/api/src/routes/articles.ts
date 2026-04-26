// Articles routes — see canopticon-api-v1.0.md §10 and schema-v1.0 §10.
//
//   GET    /v1/articles                          list (filter status, thesis_id)
//   GET    /v1/articles/:id                      one article with current version,
//                                                  cited claims, corrections, version
//                                                  history
//   POST   /v1/articles                          draft a new article (optionally
//                                                  scoped to a thesis); writes the
//                                                  initial article_versions row
//   POST   /v1/articles/:id/versions             write a new version (operator
//                                                  edit). Becomes is_current.
//   POST   /v1/articles/:id/claims               cite a claim (article_claims row)
//   DELETE /v1/articles/:id/claims/:claim_id     un-cite a claim
//   POST   /v1/articles/:id/publish              flip is_public=TRUE; status →
//                                                  published; sets published_at if
//                                                  not already set
//   POST   /v1/articles/:id/corrections          append a correction (operator
//                                                  visible by default; passes
//                                                  is_public so the correction
//                                                  surfaces under the article on
//                                                  the public site)
//   POST   /v1/articles/:id/retract              status → retracted; is_public stays
//                                                  TRUE so the public surface keeps
//                                                  the audit trail visible

import { IPCC_LIKELIHOODS } from "@canopticon/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthContext } from "../auth/middleware.ts";
import { requireAuth } from "../auth/middleware.ts";
import { badRequest, notFound } from "../lib/errors.ts";
import { userClient } from "../lib/supabase.ts";

const articles = new Hono<AuthContext>();
articles.use("*", requireAuth());

// --- list ----------------------------------------------------------------

articles.get("/", async (c) => {
  const status = c.req.query("status");
  const thesisId = c.req.query("thesis_id");
  const client = userClient(c.env, c.get("jwt"));
  let q = client
    .from("articles")
    .select(
      "id, thesis_id, title, slug, status, is_public, published_at, current_version_id, created_at, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(100);
  if (status) q = q.eq("status", status);
  if (thesisId) q = q.eq("thesis_id", thesisId);
  const { data, error } = await q;
  if (error) throw new Error(`articles.list: ${error.message}`);
  return c.json({ data });
});

// --- detail --------------------------------------------------------------

articles.get("/:id", async (c) => {
  const id = c.req.param("id");
  const client = userClient(c.env, c.get("jwt"));

  const { data: article, error } = await client
    .from("articles")
    .select(
      "id, thesis_id, title, slug, status, is_public, published_at, current_version_id, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`articles.get: ${error.message}`);
  if (!article) throw notFound("Article not found");
  const a = article as { id: string; current_version_id: string | null };

  const [versions, citedClaims, corrections] = await Promise.all([
    client
      .from("article_versions")
      .select(
        "id, version_number, is_current, body, bluf, ipcc_likelihood, change_summary, written_by_role, created_at",
      )
      .eq("article_id", a.id)
      .order("version_number", { ascending: false }),
    client.from("article_claims").select("id, claim_id, added_at").eq("article_id", a.id),
    client
      .from("article_corrections")
      .select("id, correction_text, is_public, created_at")
      .eq("article_id", a.id)
      .order("created_at", { ascending: false }),
  ]);

  const versionRows = (versions.data ?? []) as Array<{ id: string; is_current: boolean }>;
  const current = versionRows.find((v) => v.is_current) ?? null;

  // Pull claim_text for every cited claim so the editor can render an
  // inline-citations sidebar without an extra round-trip per claim.
  const claimIds = (citedClaims.data ?? []).map((row) => (row as { claim_id: string }).claim_id);
  const claimsById: Record<
    string,
    { id: string; admiralty_grade: string; verification_status: string; claim_text: string }
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
        .select("id, claim_id, claim_text")
        .in("id", versionIds);
      for (const row of cv ?? []) {
        const r = row as { claim_id: string; claim_text: string };
        textById[r.claim_id] = r.claim_text;
      }
    }
    for (const claim of claims ?? []) {
      const r = claim as {
        id: string;
        admiralty_grade: string;
        verification_status: string;
      };
      claimsById[r.id] = {
        id: r.id,
        admiralty_grade: r.admiralty_grade,
        verification_status: r.verification_status,
        claim_text: textById[r.id] ?? "",
      };
    }
  }

  const cited = (citedClaims.data ?? []).map((row) => {
    const r = row as { id: string; claim_id: string; added_at: string };
    const claim = claimsById[r.claim_id];
    return {
      id: r.id,
      claim_id: r.claim_id,
      added_at: r.added_at,
      claim_text: claim?.claim_text ?? "",
      admiralty_grade: claim?.admiralty_grade ?? "",
      verification_status: claim?.verification_status ?? "",
    };
  });

  return c.json({
    data: {
      ...article,
      current_version: current
        ? (versionRows.find((v) => v.id === current.id) ?? null)
        : (versionRows[0] ?? null),
      versions: versionRows,
      cited_claims: cited,
      corrections: corrections.data ?? [],
    },
  });
});

// --- create --------------------------------------------------------------

const createSchema = z.object({
  thesis_id: z.string().uuid().nullable().optional(),
  title: z.string().min(3).max(500),
  slug: z
    .string()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase alphanumeric + dashes"),
  body: z.string().min(20).max(200_000),
  bluf: z.string().max(500).optional(),
  ipcc_likelihood: z.enum(IPCC_LIKELIHOODS as readonly [string, ...string[]]).optional(),
  change_summary: z.string().max(500).optional(),
});

articles.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid article payload", { issues: parsed.error.issues });
  }
  const userId = c.get("user_id");
  const client = userClient(c.env, c.get("jwt"));

  const { data: articleRow, error: aErr } = await client
    .from("articles")
    .insert({
      user_id: userId,
      thesis_id: parsed.data.thesis_id ?? null,
      title: parsed.data.title,
      slug: parsed.data.slug,
      status: "draft",
      is_public: false,
    })
    .select("id")
    .single();
  if (aErr) {
    if (aErr.code === "23505") throw badRequest("An article with that slug already exists");
    throw new Error(`articles.create: ${aErr.message}`);
  }
  const articleId = articleRow.id as string;

  const { data: versionRow, error: vErr } = await client
    .from("article_versions")
    .insert({
      article_id: articleId,
      user_id: userId,
      version_number: 1,
      is_current: true,
      body: parsed.data.body,
      bluf: parsed.data.bluf ?? null,
      ipcc_likelihood: parsed.data.ipcc_likelihood ?? null,
      change_summary: parsed.data.change_summary ?? "initial draft",
    })
    .select("id")
    .single();
  if (vErr) throw new Error(`articles.create.version: ${vErr.message}`);

  await client
    .from("articles")
    .update({ current_version_id: versionRow.id as string })
    .eq("id", articleId);

  return c.json({ data: { id: articleId, version_id: versionRow.id } }, 201);
});

// --- new version ---------------------------------------------------------

const versionSchema = z.object({
  body: z.string().min(20).max(200_000),
  bluf: z.string().max(500).optional(),
  ipcc_likelihood: z.enum(IPCC_LIKELIHOODS as readonly [string, ...string[]]).optional(),
  change_summary: z.string().max(500).optional(),
});

articles.post("/:id/versions", async (c) => {
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

  const { data: existing } = await client
    .from("article_versions")
    .select("version_number")
    .eq("article_id", id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle<{ version_number: number }>();
  const nextVersion = (existing?.version_number ?? 0) + 1;

  // Demote any previously-current version. Doing this BEFORE insert means
  // a brief window with no is_current row, but article_versions has no
  // unique-only-one-current constraint so two-currents would not break
  // RLS — and the flip is fast.
  await client
    .from("article_versions")
    .update({ is_current: false })
    .eq("article_id", id)
    .eq("is_current", true);

  const { data: row, error: insertErr } = await client
    .from("article_versions")
    .insert({
      article_id: id,
      user_id: userId,
      version_number: nextVersion,
      is_current: true,
      body: parsed.data.body,
      bluf: parsed.data.bluf ?? null,
      ipcc_likelihood: parsed.data.ipcc_likelihood ?? null,
      change_summary: parsed.data.change_summary ?? "operator edit",
    })
    .select("id, version_number")
    .single();
  if (insertErr) throw new Error(`articles.versions.insert: ${insertErr.message}`);

  await client
    .from("articles")
    .update({ current_version_id: row.id as string })
    .eq("id", id);

  return c.json({ data: row });
});

// --- claims --------------------------------------------------------------

const citeSchema = z.object({ claim_id: z.string().uuid() });

articles.post("/:id/claims", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = citeSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid citation payload", { issues: parsed.error.issues });
  }
  const userId = c.get("user_id");
  const client = userClient(c.env, c.get("jwt"));

  const { data, error } = await client
    .from("article_claims")
    .insert({
      user_id: userId,
      article_id: id,
      claim_id: parsed.data.claim_id,
    })
    .select("id, claim_id, added_at")
    .single();
  if (error) {
    if (error.code === "23505") throw badRequest("Claim already cited by this article");
    throw new Error(`articles.claims.cite: ${error.message}`);
  }
  return c.json({ data }, 201);
});

articles.delete("/:id/claims/:claim_id", async (c) => {
  const id = c.req.param("id");
  const claimId = c.req.param("claim_id");
  if (!id || !claimId) throw badRequest("Missing parameter");
  const client = userClient(c.env, c.get("jwt"));

  const { error } = await client
    .from("article_claims")
    .delete()
    .eq("article_id", id)
    .eq("claim_id", claimId);
  if (error) throw new Error(`articles.claims.uncite: ${error.message}`);

  return c.json({ data: { article_id: id, claim_id: claimId, removed: true } });
});

// --- publish -------------------------------------------------------------

articles.post("/:id/publish", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const client = userClient(c.env, c.get("jwt"));

  const { data: existing } = await client
    .from("articles")
    .select("published_at")
    .eq("id", id)
    .maybeSingle<{ published_at: string | null }>();

  const publishedAt = existing?.published_at ?? new Date().toISOString();

  const { data, error } = await client
    .from("articles")
    .update({
      is_public: true,
      status: "published",
      published_at: publishedAt,
    })
    .eq("id", id)
    .select("id, status, is_public, published_at")
    .single();
  if (error) throw new Error(`articles.publish: ${error.message}`);

  return c.json({ data });
});

// --- corrections ---------------------------------------------------------

const correctionSchema = z.object({
  correction_text: z.string().min(10).max(4000),
  is_public: z.boolean().optional(),
});

articles.post("/:id/corrections", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = correctionSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid correction payload", { issues: parsed.error.issues });
  }
  const userId = c.get("user_id");
  const client = userClient(c.env, c.get("jwt"));

  const { data: correction, error } = await client
    .from("article_corrections")
    .insert({
      user_id: userId,
      article_id: id,
      correction_text: parsed.data.correction_text,
      is_public: parsed.data.is_public ?? true,
    })
    .select("id, correction_text, is_public, created_at")
    .single();
  if (error) throw new Error(`articles.corrections: ${error.message}`);

  // Bump the parent article's status to "corrected" if it was published.
  await client
    .from("articles")
    .update({ status: "corrected" })
    .eq("id", id)
    .eq("status", "published");

  return c.json({ data: correction }, 201);
});

// --- retract -------------------------------------------------------------

articles.post("/:id/retract", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const client = userClient(c.env, c.get("jwt"));

  const { data, error } = await client
    .from("articles")
    .update({ status: "retracted" })
    .eq("id", id)
    .select("id, status, is_public")
    .single();
  if (error) throw new Error(`articles.retract: ${error.message}`);

  return c.json({ data });
});

export default articles;

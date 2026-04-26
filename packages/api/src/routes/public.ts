// Public routes — see canopticon-api-v1.0.md §11.
//
// These endpoints return ONLY content where is_public=TRUE on the thesis
// or article. They use the service client (bypasses RLS) but apply
// is_public filters explicitly. No auth required.
//
//   GET /v1/public/theses                            list public theses
//   GET /v1/public/theses/:slug                      one public thesis
//                                                     with current tiers,
//                                                     contradictions,
//                                                     linchpin assumptions
//   GET /v1/public/predictions                       all public-thesis
//                                                     predictions across
//                                                     the platform
//   GET /v1/public/articles                          published articles
//   GET /v1/public/articles/:slug                    one published article
//                                                     with current version
//                                                     + corrections
//   GET /v1/public/contradictions                    open contradictions
//                                                     across public theses

import { Hono } from "hono";
import type { AuthContext } from "../auth/middleware.ts";
import { notFound } from "../lib/errors.ts";
import { serviceClient } from "../lib/supabase.ts";

const pub = new Hono<AuthContext>();

// --- theses --------------------------------------------------------------

pub.get("/theses", async (c) => {
  const client = serviceClient(c.env);
  const { data, error } = await client
    .from("theses")
    .select(
      "id, title, slug, status, declared_at, cynefin_domain, is_public, current_version_id, updated_at",
    )
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`public.theses: ${error.message}`);

  // Pull current versions in a single follow-up query for the BLUF/IPCC.
  const versionIds = (data ?? [])
    .map((row) => (row as { current_version_id: string | null }).current_version_id)
    .filter((v): v is string => Boolean(v));

  const versionsById: Record<string, { bluf: string | null; ipcc_likelihood: string | null }> = {};
  if (versionIds.length > 0) {
    const { data: versions } = await client
      .from("thesis_versions")
      .select("id, bluf, ipcc_likelihood")
      .in("id", versionIds);
    for (const v of versions ?? []) {
      const row = v as { id: string; bluf: string | null; ipcc_likelihood: string | null };
      versionsById[row.id] = { bluf: row.bluf, ipcc_likelihood: row.ipcc_likelihood };
    }
  }

  const merged = (data ?? []).map((row) => {
    const r = row as {
      id: string;
      title: string;
      slug: string;
      status: string;
      declared_at: string;
      cynefin_domain: string | null;
      is_public: boolean;
      current_version_id: string | null;
      updated_at: string;
    };
    const v = r.current_version_id ? versionsById[r.current_version_id] : null;
    return {
      id: r.id,
      title: r.title,
      slug: r.slug,
      status: r.status,
      declared_at: r.declared_at,
      cynefin_domain: r.cynefin_domain,
      updated_at: r.updated_at,
      bluf: v?.bluf ?? null,
      ipcc_likelihood: v?.ipcc_likelihood ?? null,
    };
  });

  return c.json({ data: merged });
});

pub.get("/theses/:slug", async (c) => {
  const slug = c.req.param("slug");
  const client = serviceClient(c.env);

  const { data: thesis, error } = await client
    .from("theses")
    .select(
      "id, title, slug, status, declared_at, cynefin_domain, is_public, current_version_id, updated_at",
    )
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();
  if (error) throw new Error(`public.thesis: ${error.message}`);
  if (!thesis) throw notFound("Public thesis not found");
  const t = thesis as {
    id: string;
    title: string;
    slug: string;
    current_version_id: string | null;
  };

  const [version, contradictions, assumptions, predictions] = await Promise.all([
    t.current_version_id
      ? client
          .from("thesis_versions")
          .select(
            "id, version_number, seed_paragraph, bluf, tier_80, tier_800, tier_full, ipcc_likelihood, change_summary, created_at",
          )
          .eq("id", t.current_version_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    client
      .from("contradictions")
      .select("id, objection_text, evidence_gap, severity, status, generated_by, created_at")
      .eq("thesis_id", t.id)
      .neq("status", "dismissed")
      .order("created_at", { ascending: false })
      .limit(50),
    client
      .from("assumptions")
      .select("id, text, status, is_linchpin, consequence_if_failed, last_audited_at")
      .eq("thesis_id", t.id)
      .eq("is_linchpin", true)
      .neq("status", "retired")
      .order("created_at", { ascending: false })
      .limit(50),
    client
      .from("predictions")
      .select(
        "id, text, probability, ipcc_qualifier, resolution_criteria, resolution_horizon_at, status, brier_contribution, created_at",
      )
      .eq("thesis_id", t.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return c.json({
    data: {
      ...thesis,
      current_version: version.data ?? null,
      contradictions: contradictions.data ?? [],
      linchpin_assumptions: assumptions.data ?? [],
      predictions: predictions.data ?? [],
    },
  });
});

// --- predictions ---------------------------------------------------------

pub.get("/predictions", async (c) => {
  const client = serviceClient(c.env);
  // Only return predictions whose thesis is public.
  const { data: publicTheses } = await client
    .from("theses")
    .select("id, title, slug")
    .eq("is_public", true);
  const publicMap: Record<string, { title: string; slug: string }> = {};
  for (const t of publicTheses ?? []) {
    const row = t as { id: string; title: string; slug: string };
    publicMap[row.id] = { title: row.title, slug: row.slug };
  }
  const ids = Object.keys(publicMap);
  if (ids.length === 0) return c.json({ data: { predictions: [], summary: emptySummary() } });

  const { data, error } = await client
    .from("predictions")
    .select(
      "id, thesis_id, text, probability, ipcc_qualifier, resolution_criteria, resolution_horizon_at, status, resolved_at, brier_contribution, domain, created_at",
    )
    .in("thesis_id", ids)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`public.predictions: ${error.message}`);

  const merged = (data ?? []).map((row) => {
    const r = row as { thesis_id: string };
    const meta = publicMap[r.thesis_id];
    return { ...row, thesis_title: meta?.title ?? null, thesis_slug: meta?.slug ?? null };
  });
  const summary = computeSummary((data ?? []) as Array<{ brier_contribution: number | null }>);
  return c.json({ data: { predictions: merged, summary } });
});

// --- articles ------------------------------------------------------------

pub.get("/articles", async (c) => {
  const client = serviceClient(c.env);
  const { data, error } = await client
    .from("articles")
    .select(
      "id, thesis_id, title, slug, status, is_public, published_at, current_version_id, updated_at",
    )
    .eq("is_public", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) throw new Error(`public.articles: ${error.message}`);
  return c.json({ data: data ?? [] });
});

pub.get("/articles/:slug", async (c) => {
  const slug = c.req.param("slug");
  const client = serviceClient(c.env);

  const { data: article, error } = await client
    .from("articles")
    .select(
      "id, thesis_id, title, slug, status, is_public, published_at, current_version_id, created_at, updated_at",
    )
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();
  if (error) throw new Error(`public.article: ${error.message}`);
  if (!article) throw notFound("Public article not found");
  const a = article as { id: string; current_version_id: string | null };

  const [version, corrections, claimRows] = await Promise.all([
    a.current_version_id
      ? client
          .from("article_versions")
          .select(
            "id, version_number, body, bluf, ipcc_likelihood, change_summary, created_at, written_by_role",
          )
          .eq("id", a.current_version_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    client
      .from("article_corrections")
      .select("id, correction_text, is_public, created_at")
      .eq("article_id", a.id)
      .eq("is_public", true)
      .order("created_at", { ascending: false }),
    client.from("article_claims").select("claim_id").eq("article_id", a.id),
  ]);

  return c.json({
    data: {
      ...article,
      current_version: version.data ?? null,
      corrections: corrections.data ?? [],
      claim_count: (claimRows.data ?? []).length,
    },
  });
});

// --- findings ------------------------------------------------------------

pub.get("/findings", async (c) => {
  const grade = c.req.query("novelty_grade");
  const pattern = c.req.query("pattern_type");
  const client = serviceClient(c.env);

  const { data: publicTheses } = await client
    .from("theses")
    .select("id, title, slug")
    .eq("is_public", true);
  const thesisMap: Record<string, { title: string; slug: string }> = {};
  for (const t of publicTheses ?? []) {
    const row = t as { id: string; title: string; slug: string };
    thesisMap[row.id] = { title: row.title, slug: row.slug };
  }

  let q = client
    .from("findings")
    .select(
      "id, thesis_id, title, slug, narrative, novelty_grade, pattern_type, confidence, status, published_at, created_at",
    )
    .eq("is_public", true)
    .in("status", ["public", "retracted"])
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(100);
  if (grade) q = q.eq("novelty_grade", grade);
  if (pattern) q = q.eq("pattern_type", pattern);
  const { data, error } = await q;
  if (error) throw new Error(`public.findings: ${error.message}`);

  const merged = (data ?? []).map((row) => {
    const r = row as { thesis_id: string | null };
    const meta = r.thesis_id ? thesisMap[r.thesis_id] : null;
    return {
      ...row,
      thesis_title: meta?.title ?? null,
      thesis_slug: meta?.slug ?? null,
    };
  });
  return c.json({ data: merged });
});

pub.get("/findings/:slug", async (c) => {
  const slug = c.req.param("slug");
  const client = serviceClient(c.env);

  const { data: finding, error } = await client
    .from("findings")
    .select(
      "id, thesis_id, title, slug, narrative, novelty_grade, pattern_type, confidence, status, published_at, retracted_at, retraction_note, created_at",
    )
    .eq("slug", slug)
    .eq("is_public", true)
    .in("status", ["public", "retracted"])
    .maybeSingle();
  if (error) throw new Error(`public.finding: ${error.message}`);
  if (!finding) throw notFound("Public finding not found");
  const f = finding as { id: string; thesis_id: string | null };

  let thesis_title: string | null = null;
  let thesis_slug: string | null = null;
  if (f.thesis_id) {
    const { data: thesis } = await client
      .from("theses")
      .select("title, slug, is_public")
      .eq("id", f.thesis_id)
      .maybeSingle<{ title: string; slug: string; is_public: boolean }>();
    if (thesis?.is_public) {
      thesis_title = thesis.title;
      thesis_slug = thesis.slug;
    }
  }

  // Pull supporting claims that the operator chose to surface — only
  // claims whose grade is at least B and whose verification_status is
  // grounded or partial. We don't expose unverified or contradicted
  // claims via the public surface even when they support a finding.
  const { data: support } = await client
    .from("finding_supporting_claims")
    .select("claim_id, is_linchpin")
    .eq("finding_id", f.id);
  const claimIds = (support ?? []).map((row) => (row as { claim_id: string }).claim_id);
  const supportingClaims: Array<{
    claim_id: string;
    is_linchpin: boolean;
    admiralty_grade: string;
    claim_text: string;
  }> = [];
  if (claimIds.length > 0) {
    const { data: claims } = await client
      .from("claims")
      .select("id, admiralty_grade, verification_status, current_version_id")
      .in("id", claimIds);
    const allowed = (claims ?? []).filter((row) => {
      const r = row as { admiralty_grade: string; verification_status: string };
      const goodGrade = ["A", "B", "C"].includes(r.admiralty_grade);
      const goodVerification = ["grounded", "partial"].includes(r.verification_status);
      return goodGrade && goodVerification;
    });
    const versionIds = allowed
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
    const linchpinMap: Record<string, boolean> = {};
    for (const s of support ?? []) {
      const r = s as { claim_id: string; is_linchpin: boolean };
      linchpinMap[r.claim_id] = r.is_linchpin;
    }
    for (const c2 of allowed) {
      const row = c2 as { id: string; admiralty_grade: string };
      supportingClaims.push({
        claim_id: row.id,
        is_linchpin: linchpinMap[row.id] ?? false,
        admiralty_grade: row.admiralty_grade,
        claim_text: textById[row.id] ?? "",
      });
    }
  }

  return c.json({
    data: {
      ...finding,
      thesis_title,
      thesis_slug,
      supporting_claims: supportingClaims,
    },
  });
});

// --- contradictions ------------------------------------------------------

pub.get("/contradictions", async (c) => {
  const client = serviceClient(c.env);
  const { data: publicTheses } = await client
    .from("theses")
    .select("id, title, slug")
    .eq("is_public", true);
  const publicMap: Record<string, { title: string; slug: string }> = {};
  for (const t of publicTheses ?? []) {
    const row = t as { id: string; title: string; slug: string };
    publicMap[row.id] = { title: row.title, slug: row.slug };
  }
  const ids = Object.keys(publicMap);
  if (ids.length === 0) return c.json({ data: [] });

  const { data, error } = await client
    .from("contradictions")
    .select(
      "id, thesis_id, objection_text, evidence_gap, severity, status, generated_by, created_at",
    )
    .in("thesis_id", ids)
    .neq("status", "dismissed")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`public.contradictions: ${error.message}`);

  const merged = (data ?? []).map((row) => {
    const r = row as { thesis_id: string };
    const meta = publicMap[r.thesis_id];
    return { ...row, thesis_title: meta?.title ?? null, thesis_slug: meta?.slug ?? null };
  });
  return c.json({ data: merged });
});

interface PredictionSummary {
  resolved_count: number;
  active_count: number;
  rolling_brier: number | null;
}

function emptySummary(): PredictionSummary {
  return { resolved_count: 0, active_count: 0, rolling_brier: null };
}

function computeSummary(rows: Array<{ brier_contribution: number | null }>): PredictionSummary {
  let resolved = 0;
  let active = 0;
  let total = 0;
  for (const row of rows) {
    if (row.brier_contribution !== null && row.brier_contribution !== undefined) {
      resolved++;
      total += Number(row.brier_contribution);
    } else {
      active++;
    }
  }
  return {
    resolved_count: resolved,
    active_count: active,
    rolling_brier: resolved > 0 ? Math.round((total / resolved) * 10000) / 10000 : null,
  };
}

export default pub;

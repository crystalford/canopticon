// Publish-prep: 7 undismissability gates + root-striking + 4 BLOCK conditions.

import { Hono } from "hono";
import { z } from "zod";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { all, insertOne, one, updateById } from "../lib/d1.ts";
import { badRequest } from "../lib/errors.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

interface GateResult {
  name: string;
  status: "pass" | "warn" | "block";
  detail: string;
}

app.post("/theses/:id/check", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");

  const thesis = await one<Record<string, unknown>>(c.env.DB, "SELECT * FROM theses WHERE id = ?", [
    id,
  ]);
  if (!thesis) throw badRequest("thesis not found");
  const preds = await all<{ id: string }>(
    c.env.DB,
    "SELECT id FROM predictions WHERE thesis_id = ?",
    [id],
  );
  const premortem = await one<{ fatal: number }>(
    c.env.DB,
    "SELECT fatal FROM premortem_reports WHERE thesis_id = ? ORDER BY created_at DESC LIMIT 1",
    [id],
  );
  const red = await all<{ severity: string; resolved: number }>(
    c.env.DB,
    "SELECT severity, resolved FROM red_team_objections WHERE thesis_id = ?",
    [id],
  );
  const fiveWhys = await one<{ reached_root: number; override_reason: string | null }>(
    c.env.DB,
    "SELECT reached_root, override_reason FROM five_whys_chains WHERE thesis_id = ? ORDER BY created_at DESC LIMIT 1",
    [id],
  );

  const t = thesis;
  const gates: GateResult[] = [
    {
      name: "evidence_density_sufficient",
      status: preds.length >= 3 ? "pass" : "warn",
      detail: `${preds.length} predictions banked`,
    },
    {
      name: "coined_phrase_declared",
      status: t.coined_phrase ? "pass" : "block",
      detail: t.coined_phrase ? `phrase: ${String(t.coined_phrase)}` : "no coined_phrase set",
    },
    {
      name: "predictions_at_least_3",
      status: preds.length >= 3 ? "pass" : "block",
      detail: `${preds.length} predictions (need ≥ 3)`,
    },
    {
      name: "teachable_diagram_linked",
      status: t.teachable_diagram_uri ? "pass" : "block",
      detail: t.teachable_diagram_uri ? "diagram linked" : "no teachable_diagram_uri",
    },
    {
      name: "methodology_appendix",
      status: "warn",
      detail: "checked at tier_full generation; verify before confirm",
    },
    {
      name: "public_graph_artifact_wired",
      status: t.public_graph_artifact_uri ? "pass" : "warn",
      detail: t.public_graph_artifact_uri ? "graph artifact ready" : "auto-generated on publish",
    },
    {
      name: "named_operator_declared",
      status: t.primary_operator ? "pass" : "block",
      detail: t.primary_operator
        ? `operator: ${String(t.primary_operator)}`
        : "no primary_operator set",
    },
    {
      name: "root_striking",
      status: fiveWhys?.reached_root === 1 ? "pass" : fiveWhys?.override_reason ? "warn" : "block",
      detail:
        fiveWhys?.reached_root === 1
          ? "five-whys chain reached_root = true"
          : fiveWhys?.override_reason
            ? `override: ${fiveWhys.override_reason}`
            : "no five-whys chain or chain has not reached root",
    },
  ];

  const blocks: string[] = [];
  if (!t.is_falsifiable) blocks.push("not_falsifiable");
  if (premortem?.fatal === 1) blocks.push("fatal_failure_mode");
  if (red.some((r) => r.severity === "fatal" && r.resolved !== 1))
    blocks.push("fatal_red_team_objection");

  const canPublish = gates.every((g) => g.status !== "block") && blocks.length === 0;

  await insertOne(c.env.DB, "workflow_runs", {
    user_id: userId,
    workflow_name: "publish_prep_check",
    target_kind: "thesis",
    target_id: id,
    status: canPublish ? "completed" : "awaiting_operator",
    result: { gates, blocks, can_publish: canPublish },
    completed_at: new Date().toISOString(),
  });

  return c.json({ gates, blocks, can_publish: canPublish });
});

const confirmSchema = z.object({
  override_warns: z.boolean().optional(),
  override_reason: z.string().optional(),
});

app.post("/theses/:id/confirm", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  const parsed = confirmSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });

  const thesis = await one<{
    id: string;
    user_id: string;
    title: string;
    seed_summary: string | null;
    coined_phrase: string | null;
    ipcc_likelihood: string | null;
    public_slug: string | null;
    primary_operator: string | null;
    current_version_id: string | null;
  }>(c.env.DB, "SELECT * FROM theses WHERE id = ? AND user_id = ?", [id, userId]);
  if (!thesis) throw badRequest("thesis not found");

  const publishedAt = new Date().toISOString();
  const slug = thesis.public_slug ?? slugify(thesis.title);
  await updateById(c.env.DB, "theses", id, {
    is_public: true,
    public_slug: slug,
    published_at: publishedAt,
  });

  // Populate the public cache so the published thesis surfaces on /p.
  const version = thesis.current_version_id
    ? await one<{
        tier_bluf: string;
        tier_80: string;
        tier_800: string;
        tier_full: string | null;
        version_number: number;
      }>(
        c.env.DB,
        "SELECT tier_bluf, tier_80, tier_800, tier_full, version_number FROM thesis_versions WHERE id = ?",
        [thesis.current_version_id],
      )
    : null;
  if (!version) throw badRequest("thesis has no current_version_id; cannot publish");

  await c.env.DB.prepare(
    `INSERT OR REPLACE INTO pub_theses_cache
       (thesis_id, user_id, slug, title, seed_summary, coined_phrase, ipcc_likelihood,
        tier_bluf, tier_80, tier_800, tier_full, version_number, primary_operator,
        published_at, payload, refreshed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?)`,
  )
    .bind(
      thesis.id,
      thesis.user_id,
      slug,
      thesis.title,
      thesis.seed_summary,
      thesis.coined_phrase,
      thesis.ipcc_likelihood,
      version.tier_bluf,
      version.tier_80,
      version.tier_800,
      version.tier_full,
      version.version_number,
      thesis.primary_operator,
      publishedAt,
      publishedAt,
    )
    .run();

  return c.json({ ok: true, slug });
});

app.post("/articles/:id/confirm", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  const parsed = confirmSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });

  const article = await one<{
    id: string;
    user_id: string;
    article_type: string;
    title: string;
    subtitle: string | null;
    author: string | null;
    byline_date: string | null;
    public_slug: string | null;
    current_version_id: string | null;
  }>(c.env.DB, "SELECT * FROM articles WHERE id = ? AND user_id = ?", [id, userId]);
  if (!article) throw badRequest("article not found");
  if (!article.current_version_id) throw badRequest("article has no current_version_id");

  const version = await one<{
    body_md: string;
    word_count: number | null;
    reading_time_minutes: number | null;
  }>(
    c.env.DB,
    "SELECT body_md, word_count, reading_time_minutes FROM article_versions WHERE id = ?",
    [article.current_version_id],
  );
  if (!version) throw badRequest("article_version not found");

  const publishedAt = new Date().toISOString();
  const slug = article.public_slug ?? slugify(article.title);
  await updateById(c.env.DB, "articles", id, {
    is_public: true,
    public_slug: slug,
    published_at: publishedAt,
  });

  await c.env.DB.prepare(
    `INSERT OR REPLACE INTO pub_articles_cache
       (article_id, user_id, slug, article_type, title, subtitle, author, byline_date,
        body_md, word_count, reading_time_minutes, published_at, payload, refreshed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?)`,
  )
    .bind(
      article.id,
      article.user_id,
      slug,
      article.article_type,
      article.title,
      article.subtitle,
      article.author,
      article.byline_date,
      version.body_md,
      version.word_count,
      version.reading_time_minutes,
      publishedAt,
      publishedAt,
    )
    .run();

  return c.json({ ok: true, slug });
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default app;

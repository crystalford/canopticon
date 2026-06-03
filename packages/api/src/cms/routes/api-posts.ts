// CMS: posts CRUD + publish.
//
// The publish endpoint is the seam. After it sets status='published' it
// optionally fires the graph hook (a source row + cascade) when
// GRAPH_ENABLED=true. The public site can render the post regardless of
// whether the graph hook succeeds or even runs.

import { Hono } from "hono";
import { type AuthContext, requireAuth } from "../../auth/middleware.ts";
import { all, insertOne, one, run } from "../../lib/d1.ts";
import { badRequest, notFound } from "../../lib/errors.ts";
import { ulid } from "../../shared/id.ts";
import { runPublishPrep } from "../lib/publish-prep.ts";
import { renderMarkdown, slugify } from "../lib/render-post.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

interface PostRow {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  body_md: string;
  body_html: string | null;
  post_type: "article" | "thesis" | "note";
  status: "draft" | "published" | "withdrawn";
  byline: string;
  tags: string;
  cited_claim_ids: string;
  is_forensic: number;
  visibility: string;
  contributed_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

app.post("/", async (c) => {
  const userId = c.get("user_id");
  const body = (await c.req.json()) as {
    title?: string;
    subtitle?: string;
    body_md?: string;
    post_type?: "article" | "thesis" | "note";
    byline?: string;
    tags?: string[];
    is_forensic?: boolean;
  };
  if (!body.title || !body.body_md) throw badRequest("title and body_md are required");

  const id = await insertOne(c.env.DB, "posts", {
    user_id: userId,
    slug: slugify(body.title) || `post-${ulid().slice(-8).toLowerCase()}`,
    title: body.title,
    subtitle: body.subtitle ?? null,
    body_md: body.body_md,
    post_type: body.post_type ?? "article",
    byline: body.byline ?? "",
    tags: JSON.stringify(body.tags ?? []),
    is_forensic: body.is_forensic ? 1 : 0,
  });

  await insertOne(c.env.DB, "post_versions", {
    post_id: id,
    version: 1,
    body_md: body.body_md,
    change_summary: "Initial draft",
  });

  return c.json({ id, slug: slugify(body.title) }, 201);
});

app.get("/", async (c) => {
  const userId = c.get("user_id");
  const status = c.req.query("status");
  const postType = c.req.query("post_type");
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);

  const conditions = ["user_id = ?"];
  const params: unknown[] = [userId];
  if (status && status !== "all") {
    conditions.push("status = ?");
    params.push(status);
  }
  if (postType && postType !== "all") {
    conditions.push("post_type = ?");
    params.push(postType);
  }
  params.push(limit);

  const rows = await all<PostRow>(
    c.env.DB,
    `SELECT id, slug, title, subtitle, post_type, status, byline, tags, is_forensic,
            created_at, updated_at, published_at
       FROM posts WHERE ${conditions.join(" AND ")}
      ORDER BY COALESCE(published_at, updated_at) DESC LIMIT ?`,
    params,
  );
  return c.json({ posts: rows });
});

app.get("/:id", async (c) => {
  const userId = c.get("user_id");
  const post = await one<PostRow>(c.env.DB, "SELECT * FROM posts WHERE id = ? AND user_id = ?", [
    c.req.param("id"),
    userId,
  ]);
  if (!post) throw notFound("post");
  const versions = await all(
    c.env.DB,
    "SELECT id, version, change_summary, saved_at FROM post_versions WHERE post_id = ? ORDER BY version DESC",
    [post.id],
  );
  return c.json({ post, versions });
});

app.patch("/:id", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  const body = (await c.req.json()) as Record<string, unknown>;

  const post = await one<PostRow>(c.env.DB, "SELECT * FROM posts WHERE id = ? AND user_id = ?", [
    id,
    userId,
  ]);
  if (!post) throw notFound("post");

  const updates: string[] = [];
  const params: unknown[] = [];
  const editable: Array<keyof PostRow> = [
    "title",
    "subtitle",
    "body_md",
    "post_type",
    "byline",
    "tags",
    "is_forensic",
  ];
  for (const field of editable) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(
        field === "tags"
          ? JSON.stringify(body[field])
          : field === "is_forensic"
            ? body[field]
              ? 1
              : 0
            : (body[field] as string | null),
      );
    }
  }
  // If body_md changed AND the post is already published, re-render
  // body_html so the public site reflects the edit. Publishing the
  // first time renders body_html in the publish handler; this keeps it
  // in sync on subsequent edits.
  if (typeof body.body_md === "string" && post.status === "published") {
    updates.push("body_html = ?");
    params.push(renderMarkdown(body.body_md));
  }
  if (typeof body.slug === "string" && body.slug.length > 0) {
    updates.push("slug = ?");
    params.push(slugify(body.slug));
  }
  if (updates.length === 0) throw badRequest("no editable fields supplied");

  updates.push("updated_at = ?");
  params.push(new Date().toISOString());
  params.push(id, userId);
  await run(
    c.env.DB,
    `UPDATE posts SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`,
    params,
  );

  // If the body changed, bump a new version.
  if (typeof body.body_md === "string" && body.body_md !== post.body_md) {
    const nextVersion = await one<{ max: number | null }>(
      c.env.DB,
      "SELECT MAX(version) AS max FROM post_versions WHERE post_id = ?",
      [id],
    );
    await insertOne(c.env.DB, "post_versions", {
      post_id: id,
      version: (nextVersion?.max ?? 0) + 1,
      body_md: body.body_md,
      change_summary: typeof body.change_summary === "string" ? body.change_summary : null,
    });
  }

  return c.json({ ok: true });
});

app.post("/:id/publish", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as {
    slug?: string;
    is_forensic?: boolean;
    override_warns?: boolean;
  };

  const post = await one<PostRow>(c.env.DB, "SELECT * FROM posts WHERE id = ? AND user_id = ?", [
    id,
    userId,
  ]);
  if (!post) throw notFound("post");

  // Re-publishing an already-published post is allowed: it re-renders
  // body_html from the current body_md so any edits made after the
  // first publish reach the public site. The PATCH endpoint also does
  // this in lockstep, but operators sometimes hit Publish after edits.
  const isRepublish = post.status === "published";

  const publishedAt = new Date().toISOString();
  const finalSlug = body.slug ? slugify(body.slug) : post.slug;
  const bodyHtml = renderMarkdown(post.body_md);
  const isForensic = body.is_forensic !== undefined ? (body.is_forensic ? 1 : 0) : post.is_forensic;

  // Forensic-mode publish: run all 8 gates. Block on any failure unless
  // the operator passes override_warns=true (only valid for "warn"-class
  // gates in future; for now any failure blocks).
  if (isForensic === 1) {
    const prep = await runPublishPrep(c.env, userId, id);
    if (!prep.pass) {
      return c.json(
        {
          error: {
            code: "publish_prep_failed",
            message: "Forensic publish-prep gates failed",
            failed_gates: prep.failed_gates,
            gates: prep.gates,
          },
        },
        400,
      );
    }
  }

  // Preserve the original published_at on republish; only stamp it on
  // the first publish.
  const publishedAtFinal = post.published_at ?? publishedAt;
  await run(
    c.env.DB,
    `UPDATE posts
        SET status = 'published', published_at = ?, slug = ?, body_html = ?, is_forensic = ?,
            updated_at = ?
      WHERE id = ? AND user_id = ?`,
    [publishedAtFinal, finalSlug, bodyHtml, isForensic, publishedAt, id, userId],
  );

  // Graph hook: only on first publish, and only if the compartment is
  // enabled. CMS publish has already completed by this point — the
  // public render works regardless. Republish skips the hook so we
  // don't duplicate cascade work on every edit.
  if (!isRepublish && c.env.GRAPH_ENABLED === "true") {
    c.executionCtx.waitUntil(graphIngestFromPost(c.env, userId, id, post.title, post.body_md));
  }

  return c.json({
    ok: true,
    slug: finalSlug,
    published_at: publishedAtFinal,
    republish: isRepublish,
  });
});

// Dry-run publish-prep: tells the operator which forensic gates would
// fail without actually publishing. Useful before the final commit.
app.get("/:id/publish-prep", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  const post = await one<{ id: string }>(
    c.env.DB,
    "SELECT id FROM posts WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  if (!post) throw notFound("post");
  const prep = await runPublishPrep(c.env, userId, id);
  return c.json(prep);
});

app.delete("/:id", async (c) => {
  const userId = c.get("user_id");
  await run(
    c.env.DB,
    "UPDATE posts SET status = 'withdrawn', updated_at = ? WHERE id = ? AND user_id = ?",
    [new Date().toISOString(), c.req.param("id"), userId],
  );
  return c.json({ ok: true });
});

// Graph hook: inserts a `sources` row of kind='post' so the existing cascade
// can pick it up. This is the one cross-compartment touchpoint and it's
// optional + fire-and-forget. If the graph compartment is gone, this function
// is never called.
async function graphIngestFromPost(
  env: AuthContext["Bindings"],
  userId: string,
  postId: string,
  title: string,
  bodyMd: string,
): Promise<void> {
  try {
    await insertOne(env.DB, "sources", {
      user_id: userId,
      source_type: "operator_note",
      ingestion_state: "pending_critic",
      title,
      content_text: bodyMd,
      ingested_via: "cms_publish",
      metadata: JSON.stringify({ post_id: postId, kind: "post" }),
    });
    // The existing auto-cascade would normally fire from create_source, but
    // this is a direct insert. Phase 6 introduces IngestWorkflow; for now
    // the graph picks this up when the operator next runs a manual cascade
    // or when migration to IngestWorkflow lands.
  } catch (err) {
    console.error("graph hook failed", { post_id: postId, err: (err as Error).message });
  }
}

export default app;

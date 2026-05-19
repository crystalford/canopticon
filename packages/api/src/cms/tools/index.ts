// CMS chat tools — always registered, no feature flag. These keep the
// chat → draft → publish loop working with zero graph dependency.

import type { ToolDef } from "../../graph/tools/index";
import { all, insertOne, one, run } from "../../lib/d1";
import { runPublishPrep } from "../lib/publish-prep.ts";
import { renderMarkdown, slugify } from "../lib/render-post.ts";

const draftPost: ToolDef = {
  name: "draft_post",
  description:
    "Create or update a draft post in the CMS. Use when the operator says 'draft a post about X' or pastes a long block intended as a post. Returns the post id and a draft URL.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      subtitle: { type: "string" },
      body_md: { type: "string" },
      post_type: { enum: ["article", "thesis", "note"] },
      tags: { type: "array", items: { type: "string" } },
      update_post_id: {
        type: "string",
        description: "If provided, updates the existing draft instead of creating new.",
      },
    },
    required: ["title", "body_md"],
  },
  confirm: false,
  async exec({ env, userId }, input) {
    const title = String(input.title);
    const bodyMd = String(input.body_md);
    const postType =
      typeof input.post_type === "string" && ["article", "thesis", "note"].includes(input.post_type)
        ? input.post_type
        : "article";

    if (typeof input.update_post_id === "string" && input.update_post_id) {
      const updateId = input.update_post_id;
      await run(
        env.DB,
        `UPDATE posts
            SET title = ?, subtitle = ?, body_md = ?, post_type = ?, tags = ?, updated_at = ?
          WHERE id = ? AND user_id = ?`,
        [
          title,
          (input.subtitle as string | undefined) ?? null,
          bodyMd,
          postType,
          JSON.stringify(input.tags ?? []),
          new Date().toISOString(),
          updateId,
          userId,
        ],
      );
      const nextVersion = await one<{ max: number | null }>(
        env.DB,
        "SELECT MAX(version) AS max FROM post_versions WHERE post_id = ?",
        [updateId],
      );
      await insertOne(env.DB, "post_versions", {
        post_id: updateId,
        version: (nextVersion?.max ?? 0) + 1,
        body_md: bodyMd,
        change_summary: "Updated via chat",
      });
      return {
        output: `Updated draft ${updateId}: "${title}".`,
        side_effects: [{ kind: "post", id: updateId, summary: title }],
      };
    }

    const id = await insertOne(env.DB, "posts", {
      user_id: userId,
      slug: slugify(title) || `post-${Date.now().toString(36)}`,
      title,
      subtitle: (input.subtitle as string | undefined) ?? null,
      body_md: bodyMd,
      post_type: postType,
      byline: "",
      tags: JSON.stringify(input.tags ?? []),
    });
    await insertOne(env.DB, "post_versions", {
      post_id: id,
      version: 1,
      body_md: bodyMd,
      change_summary: "Initial draft",
    });
    return {
      output: `Saved as draft ${id}: "${title}". Publish when ready.`,
      side_effects: [{ kind: "post", id, summary: title }],
    };
  },
};

const listDrafts: ToolDef = {
  name: "list_drafts",
  description:
    "List all drafts for the operator. Use when the operator asks 'what am I working on' or 'show me my drafts'.",
  input_schema: {
    type: "object",
    properties: { limit: { type: "integer", minimum: 1, maximum: 100 } },
  },
  confirm: false,
  async exec({ env, userId }, input) {
    const limit = typeof input.limit === "number" ? Math.min(input.limit, 100) : 20;
    const rows = await all<{
      id: string;
      title: string;
      post_type: string;
      updated_at: string;
    }>(
      env.DB,
      `SELECT id, title, post_type, updated_at
         FROM posts WHERE user_id = ? AND status = 'draft'
        ORDER BY updated_at DESC LIMIT ?`,
      [userId, limit],
    );
    if (rows.length === 0) {
      return { output: "No drafts.", side_effects: [] };
    }
    const lines = rows.map(
      (r) =>
        `- **${r.title}** (${r.post_type}, ${r.id}) — updated ${new Date(r.updated_at).toLocaleString()}`,
    );
    return { output: lines.join("\n"), side_effects: [] };
  },
};

const listPosts: ToolDef = {
  name: "list_posts",
  description:
    "List the operator's posts with optional filters. Use when the operator asks about their published work.",
  input_schema: {
    type: "object",
    properties: {
      status: { enum: ["draft", "published", "withdrawn", "all"] },
      post_type: { enum: ["article", "thesis", "note", "all"] },
      limit: { type: "integer", minimum: 1, maximum: 100 },
    },
  },
  confirm: false,
  async exec({ env, userId }, input) {
    const conditions = ["user_id = ?"];
    const params: unknown[] = [userId];
    const status = typeof input.status === "string" && input.status !== "all" ? input.status : null;
    const postType =
      typeof input.post_type === "string" && input.post_type !== "all" ? input.post_type : null;
    if (status) {
      conditions.push("status = ?");
      params.push(status);
    } else {
      conditions.push("status != 'withdrawn'");
    }
    if (postType) {
      conditions.push("post_type = ?");
      params.push(postType);
    }
    const limit = typeof input.limit === "number" ? Math.min(input.limit, 100) : 20;
    params.push(limit);
    const rows = await all<{
      id: string;
      title: string;
      slug: string;
      post_type: string;
      status: string;
      published_at: string | null;
    }>(
      env.DB,
      `SELECT id, title, slug, post_type, status, published_at
         FROM posts WHERE ${conditions.join(" AND ")}
        ORDER BY COALESCE(published_at, updated_at) DESC LIMIT ?`,
      params,
    );
    if (rows.length === 0) {
      return { output: "No posts match.", side_effects: [] };
    }
    const lines = rows.map((r) => {
      const when = r.published_at ? new Date(r.published_at).toLocaleDateString() : "draft";
      return `- **${r.title}** (${r.post_type} · ${r.status} · ${when}) — ${r.id}${r.published_at ? ` → /p/${r.slug}` : ""}`;
    });
    return { output: lines.join("\n"), side_effects: [] };
  },
};

const publishPost: ToolDef = {
  name: "publish_post",
  description:
    "Publish a draft to canopticon.com/p/<slug>. If is_forensic is true, the post is marked for additional rigor (publish-prep gates land in Phase 7).",
  input_schema: {
    type: "object",
    properties: {
      post_id: { type: "string" },
      slug: { type: "string" },
      is_forensic: { type: "boolean" },
    },
    required: ["post_id"],
  },
  confirm: false,
  async exec({ env, userId }, input) {
    const postId = String(input.post_id);
    const post = await one<{
      slug: string;
      title: string;
      body_md: string;
      status: string;
      is_forensic: number;
    }>(
      env.DB,
      "SELECT slug, title, body_md, status, is_forensic FROM posts WHERE id = ? AND user_id = ?",
      [postId, userId],
    );
    if (!post) return { output: `Post ${postId} not found.`, side_effects: [] };
    if (post.status === "published") {
      return {
        output: `Already published at /p/${post.slug}.`,
        side_effects: [{ kind: "post", id: postId, summary: post.title }],
      };
    }

    const publishedAt = new Date().toISOString();
    const finalSlug =
      typeof input.slug === "string" && input.slug.length > 0 ? slugify(input.slug) : post.slug;
    const bodyHtml = renderMarkdown(post.body_md);
    const isForensic =
      typeof input.is_forensic === "boolean" ? (input.is_forensic ? 1 : 0) : post.is_forensic;

    await run(
      env.DB,
      `UPDATE posts
          SET status = 'published', published_at = ?, slug = ?, body_html = ?, is_forensic = ?,
              updated_at = ?
        WHERE id = ? AND user_id = ?`,
      [publishedAt, finalSlug, bodyHtml, isForensic, publishedAt, postId, userId],
    );

    // Graph hook fires from the operator's calling context if GRAPH_ENABLED.
    // The tool itself doesn't have ctx.waitUntil, so the hook is best-effort
    // synchronous here. Phase 6 reworks this with IngestWorkflow.
    if (env.GRAPH_ENABLED === "true") {
      try {
        await insertOne(env.DB, "sources", {
          user_id: userId,
          source_type: "operator_note",
          ingestion_state: "pending_critic",
          title: post.title,
          content_text: post.body_md,
          ingested_via: "cms_publish",
          metadata: JSON.stringify({ post_id: postId, kind: "post" }),
        });
      } catch {
        // The publish itself succeeded; graph hook failure is non-blocking.
      }
    }

    return {
      output: `Published "${post.title}" at /p/${finalSlug}.`,
      side_effects: [{ kind: "post", id: postId, summary: post.title }],
    };
  },
};

const updatePost: ToolDef = {
  name: "update_post",
  description:
    "Update a post's title, body, tags, or forensic flag. Bumps a new version. Use when the operator wants to edit an existing post.",
  input_schema: {
    type: "object",
    properties: {
      post_id: { type: "string" },
      title: { type: "string" },
      subtitle: { type: "string" },
      body_md: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      is_forensic: { type: "boolean" },
      change_summary: { type: "string" },
    },
    required: ["post_id"],
  },
  confirm: false,
  async exec({ env, userId }, input) {
    const postId = String(input.post_id);
    const post = await one<{ body_md: string; title: string }>(
      env.DB,
      "SELECT body_md, title FROM posts WHERE id = ? AND user_id = ?",
      [postId, userId],
    );
    if (!post) return { output: `Post ${postId} not found.`, side_effects: [] };

    const sets: string[] = [];
    const params: unknown[] = [];
    if (typeof input.title === "string") {
      sets.push("title = ?");
      params.push(input.title);
    }
    if (typeof input.subtitle === "string") {
      sets.push("subtitle = ?");
      params.push(input.subtitle);
    }
    if (typeof input.body_md === "string") {
      sets.push("body_md = ?");
      params.push(input.body_md);
    }
    if (Array.isArray(input.tags)) {
      sets.push("tags = ?");
      params.push(JSON.stringify(input.tags));
    }
    if (typeof input.is_forensic === "boolean") {
      sets.push("is_forensic = ?");
      params.push(input.is_forensic ? 1 : 0);
    }
    if (sets.length === 0) {
      return { output: "Nothing to update.", side_effects: [] };
    }
    sets.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(postId, userId);

    await run(env.DB, `UPDATE posts SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`, params);

    if (typeof input.body_md === "string" && input.body_md !== post.body_md) {
      const nextVersion = await one<{ max: number | null }>(
        env.DB,
        "SELECT MAX(version) AS max FROM post_versions WHERE post_id = ?",
        [postId],
      );
      await insertOne(env.DB, "post_versions", {
        post_id: postId,
        version: (nextVersion?.max ?? 0) + 1,
        body_md: input.body_md,
        change_summary:
          typeof input.change_summary === "string" ? input.change_summary : "Edit via chat",
      });
    }

    return {
      output: `Updated "${typeof input.title === "string" ? input.title : post.title}".`,
      side_effects: [{ kind: "post", id: postId, summary: post.title }],
    };
  },
};

const runPublishPrepTool: ToolDef = {
  name: "run_publish_prep",
  description:
    "Run the 8 forensic-mode publish-prep gates against a draft (evidence density, coined phrase, banked predictions, teachable diagram, methodology appendix, named byline, intervention level, public graph artifact). Dry-run only — does not publish. Use when the operator asks 'is this ready to publish as forensic?' or 'run publish-prep on draft N'.",
  input_schema: {
    type: "object",
    properties: { post_id: { type: "string" } },
    required: ["post_id"],
  },
  confirm: false,
  async exec({ env, userId }, input) {
    const postId = String(input.post_id);
    const prep = await runPublishPrep(env, userId, postId);
    const lines = [`Forensic publish-prep for ${postId}: **${prep.pass ? "PASS" : "BLOCK"}**`];
    for (const g of prep.gates) {
      lines.push(`- ${g.pass ? "✓" : "✗"} ${g.name}: ${g.detail}`);
    }
    if (!prep.pass) {
      lines.push(`\nFailed gates: ${prep.failed_gates.join(", ")}`);
    }
    return { output: lines.join("\n"), side_effects: [] };
  },
};

export const CMS_TOOLS: ToolDef[] = [
  draftPost,
  listDrafts,
  listPosts,
  publishPost,
  updatePost,
  runPublishPrepTool,
];

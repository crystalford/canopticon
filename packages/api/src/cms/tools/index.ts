// CMS chat tools — always registered, no feature flag. These keep the
// chat → draft → publish loop working with zero graph dependency.

import type { Env } from "../../env";
import type { ToolDef } from "../../graph/tools/index";
import { all, insertOne, one, run } from "../../lib/d1";
import { runPublishPrep } from "../lib/publish-prep.ts";
import { renderMarkdown, slugify } from "../lib/render-post.ts";

// Llama 3.3 70B sometimes shortcuts a long body_md to a placeholder
// like "... (rest of the article)". That writes garbage to the DB.
// Detect the most common placeholders so the tool returns a refusal
// the model can react to instead of silently saving junk.
const PLACEHOLDER_PATTERNS = [
  /\(\s*rest of (the )?(article|post|content|body)[^)]*\)/i,
  /\[\s*(content continues?|rest of (the )?(article|post|body)|full body here|continued)\s*\]/i,
  /\.\.\.\s*\(?\s*(continued|truncated|full body|rest)\s*\)?/i,
  /\bTODO:\s*fill in\b/i,
  /^\s*\.\.\.\s*$/m,
];

function detectPlaceholderBody(bodyMd: string): string | null {
  for (const p of PLACEHOLDER_PATTERNS) {
    const m = p.exec(bodyMd);
    if (m) return m[0];
  }
  return null;
}

// Load the full extracted body of an attached file for use as a post's
// body_md. The model can't reliably echo long files through a JSON
// parameter (1500-4000 max_tokens out), so the chat tools accept a
// source_file_id instead and we read the body server-side here.
//
// Storage layout: extract.ts caps uploaded_files.extracted_text at
// INLINE_TEXT_MAX (8KB) and stashes any overflow in R2 at the key
// `extracted/<file_id>.txt`. So R2 is the source of truth for long
// files; D1 is the fallback for short ones.
async function loadBodyFromFile(
  env: Env,
  userId: string,
  fileId: string,
): Promise<{ body_md: string; filename: string } | { error: string }> {
  const row = await one<{
    extraction_status: string;
    extracted_text: string | null;
    original_filename: string;
  }>(
    env.DB,
    "SELECT extraction_status, extracted_text, original_filename FROM uploaded_files WHERE id = ? AND user_id = ?",
    [fileId, userId],
  );
  if (!row) {
    return { error: `source_file_id ${fileId} not found or not owned by you` };
  }
  if (row.extraction_status !== "extracted") {
    return {
      error: `file ${fileId} not extracted yet (status=${row.extraction_status}) — wait a moment or pass body_md directly`,
    };
  }
  // R2 first (full content for files >8KB), D1 fallback (sub-8KB files
  // never get the R2 overflow object written).
  let body_md = "";
  try {
    const obj = await env.FILES.get(`extracted/${fileId}.txt`);
    if (obj) body_md = await obj.text();
  } catch {
    // R2 fetch failure is non-fatal; fall through to D1.
  }
  if (!body_md) body_md = row.extracted_text ?? "";
  if (!body_md) {
    return { error: `file ${fileId} has no extracted content` };
  }
  return { body_md, filename: row.original_filename };
}

const draftPost: ToolDef = {
  name: "draft_post",
  description:
    "Create or update a draft post in the CMS. Use when the operator says 'draft a post about X' or pastes a long block intended as a post. Returns the post id and a draft URL.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      subtitle: { type: "string" },
      body_md: {
        type: "string",
        description:
          "The complete article body in markdown. Use when writing fresh prose, or editing/extending an attached file. For saving an attached file verbatim, prefer source_file_id instead.",
      },
      source_file_id: {
        type: "string",
        description:
          "Pass this to save an uploaded file's full content as the post body — preferred over echoing body_md when the operator wants a file saved as-is. The server reads the file from storage. Do not also include body_md unless you want body_md to override the file content.",
      },
      post_type: { enum: ["article", "thesis", "note"] },
      tags: { type: "array", items: { type: "string" } },
      update_post_id: {
        type: "string",
        description: "If provided, updates the existing draft instead of creating new.",
      },
    },
    required: ["title"],
  },
  confirm: false,
  async exec({ env, userId }, input) {
    const title = String(input.title);
    const postType =
      typeof input.post_type === "string" && ["article", "thesis", "note"].includes(input.post_type)
        ? input.post_type
        : "article";

    // Resolve body precedence: explicit body_md wins; else source_file_id
    // loads from R2/D1; else refuse.
    let bodyMd: string | null = null;
    let sourceFileId: string | null = null;
    let sourceFilename: string | null = null;
    if (typeof input.body_md === "string" && input.body_md.length > 0) {
      bodyMd = input.body_md;
      const placeholder = detectPlaceholderBody(bodyMd);
      if (placeholder) {
        return {
          output: `Refused: body_md contains a placeholder ("${placeholder}"). Write out the complete article body — placeholders are forbidden. If you don't have enough source material, ask the operator instead of calling this tool. If the operator wants to save an attached file as-is, pass source_file_id and omit body_md.`,
          side_effects: [],
        };
      }
    } else if (typeof input.source_file_id === "string" && input.source_file_id.length > 0) {
      sourceFileId = input.source_file_id;
      const loaded = await loadBodyFromFile(env, userId, sourceFileId);
      if ("error" in loaded) {
        return { output: `Refused: ${loaded.error}`, side_effects: [] };
      }
      bodyMd = loaded.body_md;
      sourceFilename = loaded.filename;
    } else {
      return {
        output:
          "Refused: provide either body_md (the complete article body) or source_file_id " +
          "(an uploaded file's id from the <attached_file> block).",
        side_effects: [],
      };
    }

    const sourceSideEffect =
      sourceFileId && sourceFilename
        ? [{ kind: "upload" as const, id: sourceFileId, summary: sourceFilename }]
        : [];

    if (typeof input.update_post_id === "string" && input.update_post_id) {
      const updateId = input.update_post_id;
      // If the target is already published, re-render body_html so the
      // public site reflects the edit. Drafts leave body_html null.
      const target = await one<{ status: string }>(
        env.DB,
        "SELECT status FROM posts WHERE id = ? AND user_id = ?",
        [updateId, userId],
      );
      const bodyHtmlUpdate = target?.status === "published" ? renderMarkdown(bodyMd) : null;
      await run(
        env.DB,
        bodyHtmlUpdate !== null
          ? `UPDATE posts
                SET title = ?, subtitle = ?, body_md = ?, body_html = ?, post_type = ?,
                    tags = ?, updated_at = ?
              WHERE id = ? AND user_id = ?`
          : `UPDATE posts
                SET title = ?, subtitle = ?, body_md = ?, post_type = ?, tags = ?, updated_at = ?
              WHERE id = ? AND user_id = ?`,
        bodyHtmlUpdate !== null
          ? [
              title,
              (input.subtitle as string | undefined) ?? null,
              bodyMd,
              bodyHtmlUpdate,
              postType,
              JSON.stringify(input.tags ?? []),
              new Date().toISOString(),
              updateId,
              userId,
            ]
          : [
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
        change_summary: sourceFileId
          ? `Updated via chat from file ${sourceFilename ?? sourceFileId}`
          : "Updated via chat",
      });
      return {
        output: `Updated draft ${updateId}: "${title}".`,
        side_effects: [{ kind: "post", id: updateId, summary: title }, ...sourceSideEffect],
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
      change_summary: sourceFileId
        ? `Initial draft from file ${sourceFilename ?? sourceFileId}`
        : "Initial draft",
    });
    return {
      output: `Saved as draft ${id}: "${title}". Publish when ready.`,
      side_effects: [{ kind: "post", id, summary: title }, ...sourceSideEffect],
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
      body_md: {
        type: "string",
        description:
          "The complete new body in markdown. For replacing the body with an attached file's contents, prefer source_file_id.",
      },
      source_file_id: {
        type: "string",
        description:
          "Pass this to replace the post body with an uploaded file's full content. The server reads the file from storage. If both body_md and source_file_id are present, body_md wins.",
      },
      tags: { type: "array", items: { type: "string" } },
      is_forensic: { type: "boolean" },
      change_summary: { type: "string" },
    },
    required: ["post_id"],
  },
  confirm: false,
  async exec({ env, userId }, input) {
    const postId = String(input.post_id);
    const post = await one<{ body_md: string; title: string; status: string }>(
      env.DB,
      "SELECT body_md, title, status FROM posts WHERE id = ? AND user_id = ?",
      [postId, userId],
    );
    if (!post) return { output: `Post ${postId} not found.`, side_effects: [] };

    // Resolve new body: explicit body_md wins; else source_file_id loads
    // from R2/D1; else leave body unchanged.
    let newBody: string | null = null;
    let sourceFileId: string | null = null;
    let sourceFilename: string | null = null;
    if (typeof input.body_md === "string" && input.body_md.length > 0) {
      const placeholder = detectPlaceholderBody(input.body_md);
      if (placeholder) {
        return {
          output: `Refused: body_md contains a placeholder ("${placeholder}"). Re-call update_post with the COMPLETE article body. Never abbreviate with '(rest of the article)' or similar — write the full markdown out. If the operator wants to replace the body with an attached file, pass source_file_id and omit body_md.`,
          side_effects: [],
        };
      }
      newBody = input.body_md;
    } else if (typeof input.source_file_id === "string" && input.source_file_id.length > 0) {
      sourceFileId = input.source_file_id;
      const loaded = await loadBodyFromFile(env, userId, sourceFileId);
      if ("error" in loaded) {
        return { output: `Refused: ${loaded.error}`, side_effects: [] };
      }
      newBody = loaded.body_md;
      sourceFilename = loaded.filename;
    }

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
    if (newBody !== null) {
      sets.push("body_md = ?");
      params.push(newBody);
      // Re-render body_html if the post is already public — keeps the
      // public render in sync with the new body_md without requiring
      // a manual re-publish.
      if (post.status === "published") {
        sets.push("body_html = ?");
        params.push(renderMarkdown(newBody));
      }
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

    if (newBody !== null && newBody !== post.body_md) {
      const nextVersion = await one<{ max: number | null }>(
        env.DB,
        "SELECT MAX(version) AS max FROM post_versions WHERE post_id = ?",
        [postId],
      );
      const changeSummary =
        typeof input.change_summary === "string"
          ? input.change_summary
          : sourceFileId
            ? `Edit via chat from file ${sourceFilename ?? sourceFileId}`
            : "Edit via chat";
      await insertOne(env.DB, "post_versions", {
        post_id: postId,
        version: (nextVersion?.max ?? 0) + 1,
        body_md: newBody,
        change_summary: changeSummary,
      });
    }

    const sourceSideEffect =
      sourceFileId && sourceFilename
        ? [{ kind: "upload" as const, id: sourceFileId, summary: sourceFilename }]
        : [];

    return {
      output: `Updated "${typeof input.title === "string" ? input.title : post.title}".`,
      side_effects: [{ kind: "post", id: postId, summary: post.title }, ...sourceSideEffect],
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

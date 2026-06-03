// Piece chat tools — the new PROBE-shaped publishing path. A piece is
// the unit of publication: essay / research-report / documented-record /
// thesis / synthesis. Replaces the legacy post tools.
//
//   draft_piece    — create or update a piece (working-material default)
//   update_piece   — edit an existing piece; re-renders body_html if live
//   publish_piece  — working-material → published → canonical
//   list_pieces    — list pieces by status
//   file_piece_under_topic — map a piece to a topic (anti-orphan)
//
// Reuses the shared body-source helpers (placeholder guard +
// source_file_id loader) so long attachments don't have to be echoed
// through the model.

import type { ToolDef } from "../../graph/tools/index";
import { all, insertOne, one, run } from "../../lib/d1";
import { detectPlaceholderBody, loadBodyFromFile } from "../lib/body-source.ts";
import { renderMarkdown, slugify } from "../lib/render-post.ts";

const KINDS = [
  "essay",
  "research-report",
  "documented-record",
  "thesis",
  "synthesis",
  "brief",
  "note",
];

const draftPiece: ToolDef = {
  name: "draft_piece",
  description:
    "Create or update a piece (essay / research-report / documented-record / thesis / synthesis / brief / note). The unit of publication in Canopticon. Use when the operator says 'draft a piece on X', 'save this as a research report', or drops a document to ingest. Defaults to working-material status (no public page until published).",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      subtitle: { type: "string" },
      kind: {
        enum: KINDS,
        description:
          "The editorial form. Default 'essay' for original prose, 'research-report' for sourced research, 'documented-record' for a dated chronology.",
      },
      subtype: {
        type: "string",
        description: "Optional sub-label (e.g. 'Brief', 'Foundations', 'flagship').",
      },
      body_md: {
        type: "string",
        description:
          "The complete body in markdown. For saving an attached file verbatim, prefer source_file_id.",
      },
      source_file_id: {
        type: "string",
        description:
          "Pass this to use an uploaded file's full content as the body — preferred over echoing body_md for long files. The server reads it from storage.",
      },
      byline: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      update_piece_id: {
        type: "string",
        description: "If provided, updates the existing piece instead of creating new.",
      },
    },
    required: ["title"],
  },
  confirm: false,
  async exec({ env, userId }, input) {
    const title = String(input.title);
    const kind =
      typeof input.kind === "string" && KINDS.includes(input.kind) ? input.kind : "essay";

    // Resolve body: explicit body_md wins; else source_file_id; else
    // (when creating) refuse, (when updating metadata-only) keep existing.
    let bodyMd: string | null = null;
    let sourceFilename: string | null = null;
    if (typeof input.body_md === "string" && input.body_md.length > 0) {
      const placeholder = detectPlaceholderBody(input.body_md);
      if (placeholder) {
        return {
          output: `Refused: body_md contains a placeholder ("${placeholder}"). Write out the complete body, or pass source_file_id to use an attached file verbatim.`,
          side_effects: [],
        };
      }
      bodyMd = input.body_md;
    } else if (typeof input.source_file_id === "string" && input.source_file_id.length > 0) {
      const loaded = await loadBodyFromFile(env, userId, String(input.source_file_id));
      if ("error" in loaded) return { output: `Refused: ${loaded.error}`, side_effects: [] };
      bodyMd = loaded.body_md;
      sourceFilename = loaded.filename;
    }

    const isUpdate = typeof input.update_piece_id === "string" && input.update_piece_id.length > 0;

    if (isUpdate) {
      const id = String(input.update_piece_id);
      const existing = await one<{ status: string; body_md: string }>(
        env.DB,
        "SELECT publication_status AS status, body_md FROM pieces WHERE id = ? AND user_id = ?",
        [id, userId],
      );
      if (!existing) return { output: `Piece ${id} not found.`, side_effects: [] };
      const newBody = bodyMd ?? existing.body_md;
      const bodyHtml =
        existing.status === "published" || existing.status === "canonical"
          ? renderMarkdown(newBody)
          : null;
      await run(
        env.DB,
        `UPDATE pieces SET title = ?, subtitle = ?, kind = ?, subtype = ?,
            body_md = ?, body_html = COALESCE(?, body_html), byline = ?,
            tags = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
        [
          title,
          (input.subtitle as string | undefined) ?? null,
          kind,
          (input.subtype as string | undefined) ?? null,
          newBody,
          bodyHtml,
          (input.byline as string | undefined) ?? null,
          JSON.stringify(input.tags ?? []),
          new Date().toISOString(),
          id,
          userId,
        ],
      );
      await bumpVersion(
        env.DB,
        id,
        newBody,
        sourceFilename ? `Updated from ${sourceFilename}` : "Updated via chat",
      );
      return {
        output: `Updated piece "${title}".`,
        side_effects: [{ kind: "post", id, summary: title }],
      };
    }

    if (!bodyMd) {
      return {
        output:
          "Refused: provide body_md (the complete body) or source_file_id (an uploaded file's id).",
        side_effects: [],
      };
    }

    const id = await insertOne(env.DB, "pieces", {
      user_id: userId,
      slug: slugify(title) || `piece-${Date.now().toString(36)}`,
      title,
      subtitle: (input.subtitle as string | undefined) ?? null,
      kind,
      subtype: (input.subtype as string | undefined) ?? null,
      publication_status: "working-material",
      body_md: bodyMd,
      byline: (input.byline as string | undefined) ?? null,
      tags: JSON.stringify(input.tags ?? []),
    });
    await bumpVersion(
      env.DB,
      id,
      bodyMd,
      sourceFilename ? `Initial draft from ${sourceFilename}` : "Initial draft",
    );
    return {
      output: `Saved piece "${title}" as ${kind} (working material, id ${id}). Publish when ready, and file it under a topic so it isn't an orphan.`,
      side_effects: [{ kind: "post", id, summary: title }],
    };
  },
};

const publishPiece: ToolDef = {
  name: "publish_piece",
  description:
    "Move a piece to published (gets a public page) or canonical (the single public face of a chain). Renders the public HTML. Requires the piece to be filed under at least one topic (anti-orphan).",
  input_schema: {
    type: "object",
    properties: {
      piece_id: { type: "string" },
      status: {
        enum: ["published", "canonical"],
        description: "Target status. Default 'published'.",
      },
    },
    required: ["piece_id"],
  },
  confirm: true,
  async exec({ env, userId }, input) {
    const id = String(input.piece_id);
    const target = input.status === "canonical" ? "canonical" : "published";
    const piece = await one<{ body_md: string; title: string; slug: string }>(
      env.DB,
      "SELECT body_md, title, slug FROM pieces WHERE id = ? AND user_id = ?",
      [id, userId],
    );
    if (!piece) return { output: `Piece ${id} not found.`, side_effects: [] };

    const topicCount = await one<{ n: number }>(
      env.DB,
      "SELECT COUNT(*) AS n FROM topic_pieces WHERE piece_id = ?",
      [id],
    );
    if ((topicCount?.n ?? 0) === 0) {
      return {
        output: `Refused: piece "${piece.title}" isn't filed under any topic. Every published piece must have a topic home (anti-orphan rule). Use file_piece_under_topic first.`,
        side_effects: [],
      };
    }

    const bodyHtml = renderMarkdown(piece.body_md);
    const now = new Date().toISOString();
    await run(
      env.DB,
      `UPDATE pieces SET publication_status = ?, body_html = ?,
          published_at = COALESCE(published_at, ?), updated_at = ?
        WHERE id = ? AND user_id = ?`,
      [target, bodyHtml, now, now, id, userId],
    );
    return {
      output: `Published "${piece.title}" (${target}). Live at /investigations/${piece.slug}.`,
      side_effects: [{ kind: "post", id, summary: piece.title }],
    };
  },
};

const listPieces: ToolDef = {
  name: "list_pieces",
  description:
    "List pieces, optionally filtered by status (working-material / published / canonical) or kind.",
  input_schema: {
    type: "object",
    properties: {
      status: { enum: ["working-material", "published", "canonical", "all"] },
      limit: { type: "integer", minimum: 1, maximum: 100 },
    },
  },
  confirm: false,
  async exec({ env, userId }, input) {
    const status = typeof input.status === "string" ? input.status : "all";
    const limit = Math.min(Number(input.limit ?? 30), 100);
    const rows =
      status && status !== "all"
        ? await all<{ id: string; title: string; kind: string; publication_status: string }>(
            env.DB,
            `SELECT id, title, kind, publication_status FROM pieces
              WHERE user_id = ? AND publication_status = ?
              ORDER BY updated_at DESC LIMIT ?`,
            [userId, status, limit],
          )
        : await all<{ id: string; title: string; kind: string; publication_status: string }>(
            env.DB,
            `SELECT id, title, kind, publication_status FROM pieces
              WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?`,
            [userId, limit],
          );
    if (rows.length === 0) return { output: "No pieces.", side_effects: [] };
    const lines = rows.map((r) => `- [${r.id}] ${r.title} · ${r.kind} · ${r.publication_status}`);
    return { output: lines.join("\n"), side_effects: [] };
  },
};

const fileUnderTopic: ToolDef = {
  name: "file_piece_under_topic",
  description:
    "File a piece under a topic so it has a contextual home (required before publishing — the anti-orphan rule). Creates the topic if it doesn't exist yet.",
  input_schema: {
    type: "object",
    properties: {
      piece_id: { type: "string" },
      topic_slug: { type: "string" },
      topic_label: {
        type: "string",
        description: "Required if the topic doesn't exist yet.",
      },
    },
    required: ["piece_id", "topic_slug"],
  },
  confirm: false,
  async exec({ env, userId }, input) {
    const pieceId = String(input.piece_id);
    const slug = slugify(String(input.topic_slug));
    let topic = await one<{ id: string; label: string }>(
      env.DB,
      "SELECT id, label FROM topics WHERE user_id = ? AND slug = ?",
      [userId, slug],
    );
    if (!topic) {
      const label = typeof input.topic_label === "string" ? input.topic_label : slug;
      const topicId = await insertOne(env.DB, "topics", {
        user_id: userId,
        slug,
        label,
        overview_md: "",
      });
      topic = { id: topicId, label };
    }
    // Idempotent join insert.
    const existing = await one(
      env.DB,
      "SELECT 1 AS one FROM topic_pieces WHERE topic_id = ? AND piece_id = ?",
      [topic.id, pieceId],
    );
    if (!existing) {
      await insertOne(env.DB, "topic_pieces", {
        topic_id: topic.id,
        piece_id: pieceId,
        user_id: userId,
      });
    }
    return {
      output: `Filed piece under topic "${topic.label}" (/topics/${slug}).`,
      side_effects: [{ kind: "post", id: pieceId, summary: `filed under ${topic.label}` }],
    };
  },
};

async function bumpVersion(
  db: D1Database,
  pieceId: string,
  bodyMd: string,
  summary: string,
): Promise<void> {
  const max = await one<{ max: number | null }>(
    db,
    "SELECT MAX(version) AS max FROM piece_versions WHERE piece_id = ?",
    [pieceId],
  );
  await insertOne(db, "piece_versions", {
    piece_id: pieceId,
    version: (max?.max ?? 0) + 1,
    body_md: bodyMd,
    change_summary: summary,
  });
}

export const PIECE_TOOLS: ToolDef[] = [draftPiece, publishPiece, listPieces, fileUnderTopic];

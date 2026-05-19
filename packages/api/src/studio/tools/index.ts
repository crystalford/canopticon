// Studio chat tools — operator-facing wrappers for the audio production
// pipeline. Gated by STUDIO_ENABLED in graph/tools/index.ts.
//
// Tools (10):
//   propose_script_from_post, propose_script_from_claims, approve_script,
//   list_productions, show_production, start_recording,
//   pause_production, resume_production, stitch_production, archive_production

import type { ToolDef } from "../../graph/tools/index";
import { all, insertOne, one, run } from "../../lib/d1";
import { ideateFromClaims, ideateFromPost } from "../roles/script-ideator";

const proposeFromPost: ToolDef = {
  name: "propose_script_from_post",
  description:
    "Turn an existing post (article/thesis/note) into a spoken-word script proposal. Generates a beat sequence (6-14 beats, 5-8 minutes target). State starts as 'script_proposed' — the operator approves or edits before recording.",
  input_schema: {
    type: "object",
    properties: {
      post_id: { type: "string" },
      post_slug: { type: "string" },
      use_anthropic: {
        type: "boolean",
        description: "Use Claude Sonnet instead of Llama (better prose, ~10x cost).",
      },
    },
  },
  confirm: true,
  async exec({ env, userId }, input) {
    const post = await findPost(env, userId, input);
    if (!post) return { output: "Post not found.", side_effects: [] };
    const useAnthropic = Boolean(input.use_anthropic);
    const ideated = await ideateFromPost(env, {
      userId,
      postTitle: post.title,
      postBody: post.body_md,
      useAnthropic,
    });
    if (!ideated.beats || ideated.beats.length === 0) {
      return { output: "Ideator returned no beats.", side_effects: [] };
    }
    const productionId = await persistProduction(env.DB, {
      userId,
      title: ideated.title ?? post.title,
      sourceKind: "post",
      sourcePostId: post.id,
      useAnthropic,
      beats: ideated.beats,
    });
    return {
      output: `Proposed script for **${post.title}** (${ideated.beats.length} beats).\nProduction id: ${productionId}\nOpen at /studio to review and approve.`,
      side_effects: [{ kind: "post", id: productionId, summary: ideated.title ?? post.title }],
    };
  },
};

const proposeFromClaims: ToolDef = {
  name: "propose_script_from_claims",
  description:
    "Turn a cluster of claims into a spoken-word script proposal. Same beat structure as propose_script_from_post but the script is built around the supplied claims directly.",
  input_schema: {
    type: "object",
    properties: {
      topic: { type: "string" },
      claim_ids: { type: "array", items: { type: "string" }, minItems: 1 },
      use_anthropic: { type: "boolean" },
    },
    required: ["topic", "claim_ids"],
  },
  confirm: true,
  async exec({ env, userId }, input) {
    const claimIds = (input.claim_ids ?? []) as string[];
    if (claimIds.length === 0) return { output: "No claim ids.", side_effects: [] };
    const placeholders = claimIds.map(() => "?").join(",");
    const claims = await all<{ id: string; text: string; evidence_text: string }>(
      env.DB,
      `SELECT c.id, cv.claim_text AS text, cv.data AS evidence_text
         FROM claims c
         JOIN claim_versions cv ON cv.id = c.current_version_id
        WHERE c.id IN (${placeholders}) AND c.user_id = ?`,
      [...claimIds, userId],
    );
    if (claims.length === 0) return { output: "No matching claims.", side_effects: [] };
    const useAnthropic = Boolean(input.use_anthropic);
    const ideated = await ideateFromClaims(env, {
      userId,
      topic: String(input.topic),
      claims,
      useAnthropic,
    });
    if (!ideated.beats || ideated.beats.length === 0) {
      return { output: "Ideator returned no beats.", side_effects: [] };
    }
    const productionId = await persistProduction(env.DB, {
      userId,
      title: ideated.title ?? String(input.topic),
      sourceKind: "claims",
      sourcePostId: null,
      useAnthropic,
      beats: ideated.beats,
    });
    return {
      output: `Proposed claim-based script (${ideated.beats.length} beats). Production: ${productionId}.`,
      side_effects: [],
    };
  },
};

const approveScript: ToolDef = {
  name: "approve_script",
  description:
    "Mark a proposed production's script as approved and ready to record. After this, start_recording opens the recording overlay.",
  input_schema: {
    type: "object",
    properties: { production_id: { type: "string" } },
    required: ["production_id"],
  },
  confirm: true,
  async exec({ env, userId }, input) {
    const id = String(input.production_id);
    await mustOwn(env.DB, userId, id);
    await run(
      env.DB,
      "UPDATE studio_productions SET state = 'script_approved', updated_at = ? WHERE id = ?",
      [new Date().toISOString(), id],
    );
    return { output: `Approved. Say "start recording ${id}" when you're ready.`, side_effects: [] };
  },
};

const listProductions: ToolDef = {
  name: "list_productions",
  description: "List studio productions, newest first. Filter by state if needed.",
  input_schema: {
    type: "object",
    properties: {
      state: {
        enum: [
          "script_proposed",
          "script_approved",
          "recording",
          "paused",
          "stitching",
          "rendered",
          "archived",
        ],
      },
    },
  },
  confirm: false,
  async exec({ env, userId }, input) {
    const state = input.state ? String(input.state) : null;
    const rows = await all<{
      id: string;
      title: string;
      state: string;
      script_total_seconds: number | null;
      updated_at: string;
    }>(
      env.DB,
      state
        ? `SELECT id, title, state, script_total_seconds, updated_at
             FROM studio_productions WHERE user_id = ? AND state = ?
             ORDER BY updated_at DESC LIMIT 50`
        : `SELECT id, title, state, script_total_seconds, updated_at
             FROM studio_productions WHERE user_id = ?
             ORDER BY updated_at DESC LIMIT 50`,
      state ? [userId, state] : [userId],
    );
    if (rows.length === 0) return { output: "No productions.", side_effects: [] };
    const lines = rows.map(
      (r) =>
        `- [${r.id}] ${r.title} · ${r.state}${r.script_total_seconds ? ` · ~${Math.round(r.script_total_seconds / 60)} min` : ""}`,
    );
    return { output: lines.join("\n"), side_effects: [] };
  },
};

const showProduction: ToolDef = {
  name: "show_production",
  description: "Show a production's script, beat list, and recording progress.",
  input_schema: {
    type: "object",
    properties: { production_id: { type: "string" } },
    required: ["production_id"],
  },
  confirm: false,
  async exec({ env, userId }, input) {
    const id = String(input.production_id);
    const production = await one<{
      title: string;
      state: string;
      script_total_seconds: number | null;
      coherence_notes: string | null;
    }>(
      env.DB,
      "SELECT title, state, script_total_seconds, coherence_notes FROM studio_productions WHERE id = ? AND user_id = ?",
      [id, userId],
    );
    if (!production) return { output: "Not found.", side_effects: [] };
    const beats = await all<{
      beat_index: number;
      role: string;
      cue: string | null;
      beat_text: string;
      target_seconds: number;
      recorded: number;
    }>(
      env.DB,
      "SELECT beat_index, role, cue, beat_text, target_seconds, recorded FROM studio_beats WHERE production_id = ? ORDER BY beat_index",
      [id],
    );
    const beatLines = beats.map(
      (b) =>
        `${b.recorded ? "✓" : "·"} ${b.beat_index + 1}. [${b.role}] ${b.cue ?? ""} — ${b.beat_text.slice(0, 80)}${b.beat_text.length > 80 ? "…" : ""}`,
    );
    const coherence = production.coherence_notes
      ? `\n\nCoherence notes:\n${production.coherence_notes}`
      : "";
    return {
      output: `**${production.title}** (${production.state})\nTarget: ~${Math.round((production.script_total_seconds ?? 0) / 60)} min · ${beats.length} beats\n\n${beatLines.join("\n")}${coherence}`,
      side_effects: [],
    };
  },
};

const startRecording: ToolDef = {
  name: "start_recording",
  description:
    "Move a production into the recording state and return the URL of the recording overlay UI.",
  input_schema: {
    type: "object",
    properties: { production_id: { type: "string" } },
    required: ["production_id"],
  },
  confirm: true,
  async exec({ env, userId }, input) {
    const id = String(input.production_id);
    await mustOwn(env.DB, userId, id);
    await run(
      env.DB,
      "UPDATE studio_productions SET state = 'recording', paused_at = NULL, updated_at = ? WHERE id = ?",
      [new Date().toISOString(), id],
    );
    return {
      output: `Recording overlay ready at /studio/record/${id}. Open in browser, allow mic access, and read each beat.`,
      side_effects: [],
    };
  },
};

const pauseProduction: ToolDef = {
  name: "pause_production",
  description: "Pause a production. State stays preserved; resume_production reopens it.",
  input_schema: {
    type: "object",
    properties: { production_id: { type: "string" } },
    required: ["production_id"],
  },
  confirm: false,
  async exec({ env, userId }, input) {
    const id = String(input.production_id);
    await mustOwn(env.DB, userId, id);
    const now = new Date().toISOString();
    await run(
      env.DB,
      "UPDATE studio_productions SET state = 'paused', paused_at = ?, updated_at = ? WHERE id = ?",
      [now, now, id],
    );
    return { output: `Paused. Resume any time with "resume production ${id}".`, side_effects: [] };
  },
};

const resumeProduction: ToolDef = {
  name: "resume_production",
  description: "Resume a paused production.",
  input_schema: {
    type: "object",
    properties: { production_id: { type: "string" } },
    required: ["production_id"],
  },
  confirm: false,
  async exec({ env, userId }, input) {
    const id = String(input.production_id);
    await mustOwn(env.DB, userId, id);
    await run(
      env.DB,
      "UPDATE studio_productions SET state = 'recording', paused_at = NULL, updated_at = ? WHERE id = ?",
      [new Date().toISOString(), id],
    );
    return { output: `Resumed. Open /studio/record/${id}.`, side_effects: [] };
  },
};

const stitchProduction: ToolDef = {
  name: "stitch_production",
  description:
    "Bundle every active take into the final audio asset. Writes a JSON manifest to R2 with all beat WebM keys in order; download via /studio for combining offline (ffmpeg) or import into a DAW.",
  input_schema: {
    type: "object",
    properties: { production_id: { type: "string" } },
    required: ["production_id"],
  },
  confirm: true,
  async exec({ env, userId }, input) {
    const id = String(input.production_id);
    await mustOwn(env.DB, userId, id);
    // Reuse the stitch route logic via direct DB calls — keeps the
    // tool free of HTTP self-calls inside the Worker.
    const beats = await all<{ id: string; beat_index: number; cue: string | null }>(
      env.DB,
      "SELECT id, beat_index, cue FROM studio_beats WHERE production_id = ? ORDER BY beat_index",
      [id],
    );
    const recordings = await all<{
      beat_id: string;
      take_number: number;
      r2_key: string;
      duration_ms: number | null;
      byte_size: number | null;
    }>(
      env.DB,
      "SELECT beat_id, take_number, r2_key, duration_ms, byte_size FROM studio_recordings WHERE production_id = ? AND superseded = 0",
      [id],
    );
    const byBeat = new Map(recordings.map((r) => [r.beat_id, r]));
    const production = await one<{ title: string }>(
      env.DB,
      "SELECT title FROM studio_productions WHERE id = ?",
      [id],
    );
    const manifest = {
      production_id: id,
      title: production?.title ?? "",
      beat_count: beats.length,
      total_recorded: recordings.length,
      beats: beats.map((b) => {
        const rec = byBeat.get(b.id);
        return {
          beat_index: b.beat_index,
          cue: b.cue,
          recording_key: rec?.r2_key ?? null,
          duration_ms: rec?.duration_ms ?? null,
          byte_size: rec?.byte_size ?? null,
        };
      }),
      stitched_at: new Date().toISOString(),
    };
    const manifestKey = `productions/${id}/manifest.json`;
    await env.FILES.put(manifestKey, JSON.stringify(manifest, null, 2), {
      httpMetadata: { contentType: "application/json" },
    });
    await run(
      env.DB,
      "UPDATE studio_productions SET state = 'rendered', rendered_audio_uri = ?, rendered_at = ?, updated_at = ? WHERE id = ?",
      [manifestKey, new Date().toISOString(), new Date().toISOString(), id],
    );
    return {
      output: `Stitched ${recordings.length}/${beats.length} beats. Manifest at ${manifestKey}. Download via /studio to combine offline.`,
      side_effects: [],
    };
  },
};

const archiveProduction: ToolDef = {
  name: "archive_production",
  description: "Archive a production. Hides it from the active list; recordings are kept in R2.",
  input_schema: {
    type: "object",
    properties: { production_id: { type: "string" } },
    required: ["production_id"],
  },
  confirm: true,
  async exec({ env, userId }, input) {
    const id = String(input.production_id);
    await mustOwn(env.DB, userId, id);
    const now = new Date().toISOString();
    await run(
      env.DB,
      "UPDATE studio_productions SET state = 'archived', archived_at = ?, updated_at = ? WHERE id = ?",
      [now, now, id],
    );
    return { output: `Archived production ${id}.`, side_effects: [] };
  },
};

async function findPost(
  env: { DB: D1Database },
  userId: string,
  input: { post_id?: unknown; post_slug?: unknown },
): Promise<{ id: string; title: string; body_md: string } | null> {
  if (input.post_id) {
    return await one(env.DB, "SELECT id, title, body_md FROM posts WHERE id = ? AND user_id = ?", [
      String(input.post_id),
      userId,
    ]);
  }
  if (input.post_slug) {
    return await one(
      env.DB,
      "SELECT id, title, body_md FROM posts WHERE slug = ? AND user_id = ?",
      [String(input.post_slug), userId],
    );
  }
  return null;
}

async function persistProduction(
  db: D1Database,
  args: {
    userId: string;
    title: string;
    sourceKind: "post" | "thesis" | "claims" | "blank";
    sourcePostId: string | null;
    useAnthropic: boolean;
    beats: Array<{
      beat_index: number;
      role: string;
      cue?: string;
      beat_text: string;
      next_preview?: string;
      target_seconds: number;
      cited_claim_id?: string;
    }>;
  },
): Promise<string> {
  const totalSeconds = args.beats.reduce((a, b) => a + (b.target_seconds ?? 0), 0);
  const productionId = await insertOne(db, "studio_productions", {
    user_id: args.userId,
    title: args.title,
    source_post_id: args.sourcePostId,
    source_kind: args.sourceKind,
    state: "script_proposed",
    script_total_seconds: totalSeconds,
    use_anthropic: args.useAnthropic ? 1 : 0,
  });
  for (const b of args.beats) {
    await insertOne(db, "studio_beats", {
      production_id: productionId,
      user_id: args.userId,
      beat_index: b.beat_index,
      role: b.role,
      cue: b.cue ?? null,
      beat_text: b.beat_text,
      next_preview: b.next_preview ?? null,
      target_seconds: b.target_seconds,
      cited_claim_id: b.cited_claim_id ?? null,
    });
  }
  return productionId;
}

async function mustOwn(db: D1Database, userId: string, productionId: string): Promise<void> {
  const owned = await one(db, "SELECT id FROM studio_productions WHERE id = ? AND user_id = ?", [
    productionId,
    userId,
  ]);
  if (!owned) throw new Error("production not found");
}

export const STUDIO_TOOLS: ToolDef[] = [
  proposeFromPost,
  proposeFromClaims,
  approveScript,
  listProductions,
  showProduction,
  startRecording,
  pauseProduction,
  resumeProduction,
  stitchProduction,
  archiveProduction,
];

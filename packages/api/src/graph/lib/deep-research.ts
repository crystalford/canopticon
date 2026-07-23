// Deep research for beats — the "free-ish" version of Claude's Research
// mode, built entirely on infrastructure this system already pays for
// (Brave Search, already-wired; Workers AI, already included).
//
// This is deliberately NOT a multi-round agent loop. expandRecord() (one
// search + up to 6 fetches) already runs close to the platform's execution
// ceiling on its own. Chaining a full plan -> search -> read -> refine ->
// search-again -> synthesize loop into ONE call would repeat the exact
// class of bug that took most of a session to track down and fix across
// entity-resolution.ts, surfacing.ts, and draft-reading.ts — and, it turned
// out, expandRecord() itself and this file's own extraction call below:
// real work that never gets a chance to finish. Confirmed live: digest_jobs
// rows stuck at status='running' with no heartbeat progress.
//
// Instead this is a SEPARATE, bounded, resumable step: expandRecord banks
// raw sources as it already does; later (same cron slot, mutually
// exclusive with a fresh expand — see autonomous-expand.ts), ONE call here
// takes whatever a beat's last expand banked and writes a single
// synthesized research report from it via the "writer" role — the same
// LLM call budget draft-reading.ts already spends per candidate. The
// report becomes a new document, stored and QUEUED for extraction through
// the exact same verbatim-quote pipeline as anything the operator uploads
// by hand (the every-minute cron drain, not run inline here — same fix as
// expandRecord): the firewall doesn't move, only where the document came
// from does.

import type { Env } from "../../env";
import { all, insertOne, one, run } from "../../lib/d1";
import { callRole } from "../../llm/router";
import { enqueueDigest } from "./digest-jobs";

const EXCERPT_CHARS_PER_SOURCE = 3000; // keeps the synthesis prompt bounded regardless of source length
const REPORT_MAX_TOKENS = 3000;

export interface SynthesisReport {
  synthesized: boolean;
  beatLabel?: string;
  pieceId?: string;
  reason?: string;
}

interface DueBeatForSynthesis {
  id: string;
  label: string;
  last_banked_piece_ids: string | null;
}

/** Picks the one beat whose most recent expand hasn't been synthesized
 *  yet, and writes its report. Returns {synthesized:false} when nothing
 *  is due — the caller (autonomous-expand.ts) then falls through to its
 *  normal expand-pick logic instead. */
export async function synthesizeDueBeatReport(env: Env, userId: string): Promise<SynthesisReport> {
  const beat = await one<DueBeatForSynthesis>(
    env.DB,
    `SELECT id, label, last_banked_piece_ids FROM coverage_beats
      WHERE user_id = ?
        AND last_banked_piece_ids IS NOT NULL
        AND (last_synthesized_at IS NULL OR last_synthesized_at < last_swept_at)
      ORDER BY last_swept_at ASC
      LIMIT 1`,
    [userId],
  ).catch(() => null);
  if (!beat) return { synthesized: false, reason: "no beat due" };

  let pieceIds: string[] = [];
  try {
    pieceIds = JSON.parse(beat.last_banked_piece_ids ?? "[]");
  } catch {
    pieceIds = [];
  }
  if (pieceIds.length === 0) {
    await run(env.DB, "UPDATE coverage_beats SET last_synthesized_at = ? WHERE id = ?", [
      new Date().toISOString(),
      beat.id,
    ]);
    return { synthesized: false, beatLabel: beat.label, reason: "last expand banked nothing" };
  }

  const placeholders = pieceIds.map(() => "?").join(",");
  const pieces = await all<{ title: string; body_md: string | null }>(
    env.DB,
    `SELECT title, body_md FROM pieces WHERE id IN (${placeholders}) AND user_id = ?`,
    [...pieceIds, userId],
  ).catch(() => []);
  if (pieces.length === 0) {
    await run(env.DB, "UPDATE coverage_beats SET last_synthesized_at = ? WHERE id = ?", [
      new Date().toISOString(),
      beat.id,
    ]);
    return { synthesized: false, beatLabel: beat.label, reason: "banked pieces no longer found" };
  }

  const excerpts = pieces
    .map((p) => `### ${p.title}\n${(p.body_md ?? "").slice(0, EXCERPT_CHARS_PER_SOURCE)}`)
    .join("\n\n");

  const out = await callRole(env, "writer", {
    userId,
    system: `You write a structured RESEARCH BRIEF synthesizing the supplied source excerpts about a subject the operator is standing-watch on (a "beat").

RULES:
- Organize by theme, not by source — pull the excerpts together into a coherent account.
- Every substantive claim should be traceable to something in the supplied excerpts. Do not invent facts the excerpts don't support.
- Close with a short "Still open" section: what these sources DON'T cover, or where they disagree.
- This is a briefing document for a researcher deciding what to look into next — not a final verdict, not a signed reading.
- Plain, direct prose. No throat-clearing intro, no "in conclusion."

Return markdown only — a title line, then the brief.`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Subject (beat): ${beat.label}\n\nSOURCE EXCERPTS:\n${excerpts}`,
          },
        ],
      },
    ],
    max_tokens: REPORT_MAX_TOKENS,
  });

  const reportText = (out.text ?? "").trim();
  if (reportText.length < 200) {
    await run(env.DB, "UPDATE coverage_beats SET last_synthesized_at = ? WHERE id = ?", [
      new Date().toISOString(),
      beat.id,
    ]);
    return { synthesized: false, beatLabel: beat.label, reason: "writer produced too little text" };
  }

  const now = new Date().toISOString();
  const title = `Research brief: ${beat.label} (${now.slice(0, 10)})`;
  const sourceId = await insertOne(env.DB, "sources", {
    user_id: userId,
    // sources.source_type has a fixed CHECK list (no "synthesis" option) —
    // "report" is the closest fit for a system-written research brief.
    source_type: "report",
    ingestion_state: "approved",
    title,
    url: null,
    authors: JSON.stringify(["Canopticon research agent"]),
    content_text: reportText,
  });
  const slug = await ensureUniqueSlug(env.DB, userId, slugify(title));
  const pieceId = await insertOne(env.DB, "pieces", {
    user_id: userId,
    slug,
    title,
    kind: "research-report",
    publication_status: "published",
    body_md: reportText,
    byline: "Canopticon research agent",
    tags: JSON.stringify(["auto-research", "beat"]),
    metadata: JSON.stringify({
      ingested_from: "deep-research",
      beat_id: beat.id,
      beat_label: beat.label,
      source_piece_ids: pieceIds,
    }),
  });

  // Enqueue only — the every-minute cron drain runs it, same as every
  // other digest job. Running it inline here, right after the "writer"
  // LLM call above, was the same execution-ceiling bug expandRecord had.
  await enqueueDigest(env, {
    userId,
    pieceId,
    slug,
    title,
    sourceId,
  });

  await run(env.DB, "UPDATE coverage_beats SET last_synthesized_at = ? WHERE id = ?", [
    now,
    beat.id,
  ]);
  await insertOne(env.DB, "orchestrator_events", {
    user_id: userId,
    event_type: "deep_research.synthesized",
    subject_kind: "beat",
    subject_id: beat.id,
    payload: { beat_label: beat.label, piece_id: pieceId, sources_used: pieces.length },
  }).catch(() => {});

  return { synthesized: true, beatLabel: beat.label, pieceId };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

async function ensureUniqueSlug(db: D1Database, userId: string, base: string): Promise<string> {
  const slug = base || `research-brief-${Date.now()}`;
  const existing = await one<{ slug: string }>(
    db,
    "SELECT slug FROM pieces WHERE user_id = ? AND slug LIKE ? ORDER BY slug DESC LIMIT 1",
    [userId, `${slug}%`],
  );
  if (!existing) return slug;
  const m = existing.slug.match(
    new RegExp(`^${slug.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}(?:-(\\d+))?$`),
  );
  const next = m?.[1] ? Number(m[1]) + 1 : 2;
  return `${slug}-${next}`;
}

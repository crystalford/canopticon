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
// raw sources as it already does; later, ONE call here takes a set of
// already-banked pieces and writes a single synthesized research report
// from them via the "writer" role — the same LLM call budget
// draft-reading.ts already spends per candidate.
//
// synthesizeDueBeatReport (the autonomous-cron path, picked a beat's last
// expand automatically and PUBLISHED the result with no operator ever
// reading it) is retired along with the sweep that called it — see
// index.ts's scheduled(). Left in place, unwired, not deleted: dormant
// code, not a live path. researchOnDemand below is the replacement — the
// operator triggers it (from "Research this" or a watchlist entry), and
// what it writes lands as working-material, not published: readable only
// via the operator review screen (operator/routes.ts's
// /library/research/:id/review) until explicitly published from there.
// Extraction into the typed graph is deferred to that same publish step
// too — an unreviewed draft doesn't get to seed graph facts either.

import type { Env } from "../../env";
import { all, insertOne, one, run } from "../../lib/d1";
import { callRole } from "../../llm/router";

const EXCERPT_CHARS_PER_SOURCE = 3000; // keeps the synthesis prompt bounded regardless of source length
const REPORT_MAX_TOKENS = 3000;

export interface SynthesisReport {
  synthesized: boolean;
  beatLabel?: string | undefined;
  pieceId?: string | undefined;
  reason?: string | undefined;
}

interface WriteBriefResult {
  ok: boolean;
  pieceId?: string;
  slug?: string;
  sourceId?: string;
  title?: string;
  reason?: string;
}

/** The shared core: given a label and a set of already-banked piece ids,
 *  write one synthesized research brief from their bodies. Used by both
 *  the (dormant) autonomous beat path and the on-demand path below —
 *  `publish` is the only behavioral fork between them. Never enqueues
 *  extraction itself; callers decide when (or if) that happens. */
async function writeResearchBrief(
  env: Env,
  userId: string,
  label: string,
  pieceIds: string[],
  opts: { publish: boolean; angleHint?: string | undefined },
): Promise<WriteBriefResult> {
  if (pieceIds.length === 0) return { ok: false, reason: "no banked sources to synthesize from" };

  const placeholders = pieceIds.map(() => "?").join(",");
  const pieces = await all<{ title: string; body_md: string | null }>(
    env.DB,
    `SELECT title, body_md FROM pieces WHERE id IN (${placeholders}) AND user_id = ?`,
    [...pieceIds, userId],
  ).catch(() => []);
  if (pieces.length === 0) return { ok: false, reason: "banked pieces no longer found" };

  const excerpts = pieces
    .map((p) => `### ${p.title}\n${(p.body_md ?? "").slice(0, EXCERPT_CHARS_PER_SOURCE)}`)
    .join("\n\n");

  const angleLine = opts.angleHint
    ? `\n\nTHE OPERATOR ASKED SPECIFICALLY ABOUT: "${opts.angleHint.slice(0, 300)}"\nFocus the brief on this if the excerpts support it. If they don't, say so honestly rather than forcing an answer the sources don't have.`
    : "";

  const out = await callRole(env, "writer", {
    userId,
    system: `You write a structured RESEARCH BRIEF synthesizing the supplied source excerpts about a subject the operator asked to have researched.

RULES:
- Organize by theme, not by source — pull the excerpts together into a coherent account.
- Every substantive claim should be traceable to something in the supplied excerpts. Do not invent facts the excerpts don't support.
- Close with a short "Still open" section: what these sources DON'T cover, or where they disagree.
- This is a briefing document for a researcher deciding what to look into next — not a final verdict, not a signed reading.
- Plain, direct prose. No throat-clearing intro, no "in conclusion."${angleLine}

Return markdown only — a title line, then the brief.`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Subject: ${label}\n\nSOURCE EXCERPTS:\n${excerpts}`,
          },
        ],
      },
    ],
    max_tokens: REPORT_MAX_TOKENS,
  });

  const reportText = (out.text ?? "").trim();
  if (reportText.length < 200) return { ok: false, reason: "writer produced too little text" };

  const now = new Date().toISOString();
  const title = `Research brief: ${label} (${now.slice(0, 10)})`;
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
    publication_status: opts.publish ? "published" : "working-material",
    body_md: reportText,
    byline: "Canopticon research agent",
    tags: JSON.stringify(["auto-research", opts.publish ? "beat" : "on-demand"]),
    metadata: JSON.stringify({
      ingested_from: "deep-research",
      label,
      angle: opts.angleHint ?? null,
      source_piece_ids: pieceIds,
      source_id: sourceId,
    }),
  });

  return { ok: true, pieceId, slug, sourceId, title };
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

  const result = await writeResearchBrief(env, userId, beat.label, pieceIds, { publish: true });
  const now = new Date().toISOString();
  await run(env.DB, "UPDATE coverage_beats SET last_synthesized_at = ? WHERE id = ?", [
    now,
    beat.id,
  ]);
  if (!result.ok) {
    return { synthesized: false, beatLabel: beat.label, reason: result.reason };
  }

  // Publish path still enqueues extraction immediately — dormant code
  // (nothing calls synthesizeDueBeatReport anymore), kept behaviorally
  // identical to before rather than silently changed underneath a name
  // nothing invokes.
  const { enqueueDigest } = await import("./digest-jobs");
  await enqueueDigest(env, {
    userId,
    pieceId: result.pieceId as string,
    slug: result.slug as string,
    title: result.title as string,
    sourceId: result.sourceId as string,
  });

  await insertOne(env.DB, "orchestrator_events", {
    user_id: userId,
    event_type: "deep_research.synthesized",
    subject_kind: "beat",
    subject_id: beat.id,
    payload: { beat_label: beat.label, piece_id: result.pieceId, sources_used: pieces.length },
  }).catch(() => {});

  return { synthesized: true, beatLabel: beat.label, pieceId: result.pieceId };
}

/** Operator-triggered research: search + fetch + bank sources on `label`
 *  right now (expandRecord), then synthesize a brief from whatever gets
 *  banked. Lands as working-material, NOT published, NOT queued for
 *  extraction — only readable via the operator review screen
 *  (operator/routes.ts's /library/research/:id/review), which is also
 *  where publishing (and, only then, extraction) actually happens. */
export async function researchOnDemand(
  env: Env,
  userId: string,
  label: string,
  angleHint?: string,
): Promise<WriteBriefResult> {
  const { expandRecord } = await import("./record-builder");
  const expandReport = await expandRecord(env, userId, label);
  if (expandReport.banked_piece_ids.length === 0) {
    return {
      ok: false,
      reason: expandReport.errors.length
        ? expandReport.errors.slice(0, 3).join("; ")
        : "no usable sources found",
    };
  }
  const result = await writeResearchBrief(env, userId, label, expandReport.banked_piece_ids, {
    publish: false,
    angleHint,
  });
  await insertOne(env.DB, "orchestrator_events", {
    user_id: userId,
    event_type: result.ok ? "deep_research.drafted" : "deep_research.draft_failed",
    subject_kind: "query",
    subject_id: null,
    payload: { label, angle: angleHint ?? null, piece_id: result.pieceId, reason: result.reason },
  }).catch(() => {});
  return result;
}

export interface ResearchStep {
  label: string;
  state: "done" | "active" | "pending" | "warn";
  detail?: string | undefined;
}

export interface ResearchStatus {
  terminal: boolean;
  warn: boolean;
  headline: string;
  steps: ResearchStep[];
  reviewUrl?: string;
}

/** The richer status researchOnDemand's callers poll — getExpandStatus
 *  (record-builder.ts) alone stops narrating once the search/fetch/bank/
 *  extract phase ends, with no idea a synthesis step runs after it. This
 *  wraps it with that missing phase, plus turns the single replacing
 *  status line into a milestone checklist (search → fetch/bank → extract
 *  → write) so a poller can show real progress, not just a spinner. */
export async function getResearchStatus(
  env: Env,
  userId: string,
  label: string,
  opts: { includeSynthesis?: boolean } = {},
): Promise<ResearchStatus | null> {
  const includeSynthesis = opts.includeSynthesis ?? true;
  const { getExpandStatus } = await import("./record-builder");
  const expand = await getExpandStatus(env, userId, label);
  if (!expand) return null;

  const events = await all<{ event_type: string; payload: string }>(
    env.DB,
    `SELECT event_type, payload FROM orchestrator_events
      WHERE user_id = ?
        AND event_type LIKE 'record.expand.%'
        AND json_extract(payload, '$.subject') = ?
        AND created_at > datetime('now','-15 minutes')
      ORDER BY created_at ASC LIMIT 100`,
    [userId, label],
  ).catch(() => []);
  const has = (t: string) => events.some((e) => e.event_type === t);
  const bankedCount = events.filter((e) => e.event_type === "record.expand.source_banked").length;
  const fetchingCount = events.filter(
    (e) => e.event_type === "record.expand.source_fetching",
  ).length;

  const steps: ResearchStep[] = [];
  steps.push({
    label: "Search the web",
    state: has("record.expand.skipped")
      ? "warn"
      : has("record.expand.started")
        ? "done"
        : "pending",
  });
  steps.push({
    label: "Fetch and bank sources",
    state: has("record.expand.failed")
      ? "warn"
      : has("record.expand.completed")
        ? "done"
        : has("record.expand.search_done")
          ? "active"
          : "pending",
    detail: has("record.expand.search_done")
      ? `${bankedCount} banked${fetchingCount > bankedCount ? `, fetching ${fetchingCount}` : ""}`
      : undefined,
  });
  const extractDone = expand.terminal && !expand.line.startsWith("Banked");
  steps.push({
    label: "Extract verbatim facts",
    state: has("record.expand.completed") ? (extractDone ? "done" : "active") : "pending",
    detail: extractDone
      ? `${expand.factsAdded} fact${expand.factsAdded === 1 ? "" : "s"}`
      : undefined,
  });

  // The phase getExpandStatus has zero visibility into — only relevant
  // once expand itself has actually finished, and only for callers that
  // actually run a synthesis step afterward (plain "Expand this file" —
  // record-builder.ts's expandRecord with no researchOnDemand wrapper —
  // never will; a deep_research event for its label would never arrive).
  if (extractDone && includeSynthesis) {
    const draftEvent = await one<{ event_type: string; payload: string }>(
      env.DB,
      `SELECT event_type, payload FROM orchestrator_events
        WHERE user_id = ? AND event_type IN ('deep_research.drafted', 'deep_research.draft_failed')
          AND json_extract(payload, '$.label') = ?
          AND created_at > datetime('now','-15 minutes')
        ORDER BY created_at DESC LIMIT 1`,
      [userId, label],
    ).catch(() => null);

    if (!draftEvent) {
      steps.push({ label: "Write a synthesis", state: "active" });
      return {
        terminal: false,
        warn: false,
        headline: "Writing a synthesis from what was found…",
        steps,
      };
    }
    if (draftEvent.event_type === "deep_research.drafted") {
      let pieceId: string | undefined;
      try {
        pieceId = JSON.parse(draftEvent.payload)?.piece_id;
      } catch {
        pieceId = undefined;
      }
      steps.push({ label: "Write a synthesis", state: "done", detail: "draft ready" });
      return {
        terminal: true,
        warn: false,
        headline: "Draft brief ready — review it before it can publish.",
        steps,
        ...(pieceId ? { reviewUrl: `/op/library/research/${pieceId}/review` } : {}),
      };
    }
    let reason = "unknown reason";
    try {
      reason = JSON.parse(draftEvent.payload)?.reason ?? reason;
    } catch {
      // keep default
    }
    steps.push({ label: "Write a synthesis", state: "warn", detail: reason });
    return {
      terminal: true,
      warn: true,
      headline: `Sources banked, but no brief written — ${reason}.`,
      steps,
    };
  }

  return { terminal: expand.terminal, warn: expand.warn, headline: expand.line, steps };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

// Exact-match probing, not a LIKE prefix scan — see record-builder.ts's
// ensureUniqueSlug for why (D1 threw "LIKE or GLOB pattern too complex"
// live on this exact pattern shape).
async function ensureUniqueSlug(db: D1Database, userId: string, base: string): Promise<string> {
  const slug = base || `research-brief-${Date.now()}`;
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? slug : `${slug}-${n + 1}`;
    const existing = await one<{ id: string }>(
      db,
      "SELECT id FROM pieces WHERE user_id = ? AND slug = ? LIMIT 1",
      [userId, candidate],
    );
    if (!existing) return candidate;
  }
  return `${slug}-${Date.now()}`;
}

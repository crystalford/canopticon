// Deep research — the "free-ish" version of Claude's Research mode, built
// entirely on infrastructure this system already pays for (Brave Search,
// already-wired; Workers AI, already included).
//
// Two passes, each bounded and separately safe:
//   Pass 1 (researchOnDemand, runs in the operator's own request via
//     waitUntil): expandRecord banks sources on the label, then ONE writer
//     call synthesizes a brief AND proposes up to MAX_FOLLOWUP_QUERIES
//     specific follow-up searches for whatever it couldn't cover. If it
//     has none, pass 1's own output IS the final draft.
//   Pass 2 (advanceResearchRun, picked up by the existing every-2-minute
//     cron drain — one run per tick, NOT chained into pass 1's own
//     execution): runs the follow-up searches, then re-synthesizes over
//     the combined source pool into the final draft.
//
// Why two passes are two SEPARATE executions, not one call that chains
// search -> synthesize -> search-again -> synthesize-again: that exact
// chaining shape is the class of bug that took most of a session to track
// down across entity-resolution.ts, surfacing.ts, draft-reading.ts, and
// this file's own original single-pass version — real work that silently
// never gets a chance to finish inside Cloudflare's execution ceiling.
// settle-pipeline.ts's one-step-per-tick shape is the proven-safe pattern;
// this reuses it via research_runs (migration 0042) tracking which phase
// each run is in.
//
// synthesizeDueBeatReport (the retired autonomous-cron path — picked a
// beat's last expand automatically and PUBLISHED the result with no
// operator ever reading it) is left in place, unwired, dormant: nothing
// calls it since index.ts's scheduled() dropped the sweep. researchOnDemand
// below is the live replacement — operator-triggered, and what it writes
// lands as working-material, not published: readable only via the
// operator review screen (operator/routes.ts's
// /library/research/:id/review) until explicitly published from there.
// Extraction into the typed graph is deferred to that same publish step
// too — an unreviewed draft doesn't get to seed graph facts either.

import type { Env } from "../../env";
import { all, insertOne, one, run, updateById } from "../../lib/d1";
import { callResearchWriter } from "../../llm/router";

const EXCERPT_CHARS_PER_SOURCE = 5000; // was 3000 — more raw material now that the writer is gpt-oss-120b, not Scout
const REPORT_MAX_TOKENS = 4000; // matches hard_extraction's proven-safe budget for this exact model+effort
const MAX_FOLLOWUP_QUERIES = 2; // pass 2's added searches — each runs its own expandRecord
const MAX_TOTAL_SOURCES_FOR_SYNTHESIS = 12; // hard cap on sources any one synthesis call reads, pass1+pass2 combined
// expandRecord's free fetch-fallback chain (record-builder.ts: plain fetch
// -> Jina Reader -> Wayback Machine -> Browser Rendering, up to 4 stacked
// ~15s timeouts per blocked source) can now legitimately run long on a
// source that needs every fallback. Pass 1 is the ONE step in this file
// that still runs everything inline in the operator's own request (see
// file header) — bound it so it ALWAYS reaches a terminal DB write.
// Confirmed live: without this, a slow expand left a research_runs row
// stuck at 'pass1_pending' forever — the execution died mid-flight before
// ever updating it, with no error recorded anywhere.
const EXPAND_BUDGET_MS = 45_000;

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
  reason?: string | undefined;
}

interface SynthesizeResult {
  ok: boolean;
  title?: string;
  bodyMd?: string;
  followupQueries?: string[];
  reason?: string;
}

/** The LLM half only — no DB writes beyond reading the source pieces.
 *  Separated from persistBrief() because pass 1 needs to know the
 *  follow-up queries BEFORE deciding whether this synthesis is the final
 *  draft or just scratch work for planning pass 2. */
async function synthesizeBrief(
  env: Env,
  userId: string,
  label: string,
  pieceIds: string[],
  opts: { angleHint?: string | undefined; wantFollowups: boolean },
): Promise<SynthesizeResult> {
  if (pieceIds.length === 0) return { ok: false, reason: "no banked sources to synthesize from" };
  const cappedIds = pieceIds.slice(0, MAX_TOTAL_SOURCES_FOR_SYNTHESIS);

  const placeholders = cappedIds.map(() => "?").join(",");
  const pieces = await all<{ title: string; body_md: string | null }>(
    env.DB,
    `SELECT title, body_md FROM pieces WHERE id IN (${placeholders}) AND user_id = ?`,
    [...cappedIds, userId],
  ).catch(() => []);
  if (pieces.length === 0) return { ok: false, reason: "banked pieces no longer found" };

  const excerpts = pieces
    .map((p) => `### ${p.title}\n${(p.body_md ?? "").slice(0, EXCERPT_CHARS_PER_SOURCE)}`)
    .join("\n\n");

  const angleLine = opts.angleHint
    ? `\n\nTHE OPERATOR ASKED SPECIFICALLY ABOUT: "${opts.angleHint.slice(0, 300)}"\nFocus the brief on this if the excerpts support it. If they don't, say so honestly rather than forcing an answer the sources don't have.`
    : "";
  const followupLine = opts.wantFollowups
    ? `\n\nAlso identify up to ${MAX_FOLLOWUP_QUERIES} SPECIFIC follow-up web searches that would fill the most important gaps these sources leave — concrete search queries a researcher would actually type, not vague topics. If these sources already cover the subject thoroughly, return an empty list. Put these in "followup_queries".`
    : "";

  const out = await callResearchWriter(env, {
    userId,
    system: `You write a structured RESEARCH BRIEF synthesizing the supplied source excerpts about a subject the operator asked to have researched.

RULES:
- Organize by theme, not by source — pull the excerpts together into a coherent, comprehensive account. Aim for real depth, not a summary paragraph — this should read like a researcher's dossier, not an abstract.
- Every substantive claim should be traceable to something in the supplied excerpts. Do not invent facts the excerpts don't support.
- Close with a short "Still open" section: what these sources DON'T cover, or where they disagree.
- This is a briefing document for a researcher deciding what to look into next — not a final verdict, not a signed reading.
- Plain, direct prose. No throat-clearing intro, no "in conclusion."${angleLine}${followupLine}

Return ONLY JSON:
{
  "title": "a short title for the brief",
  "body_md": "the full markdown brief",
  "followup_queries": ["query 1", "query 2"]
}`,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: `Subject: ${label}\n\nSOURCE EXCERPTS:\n${excerpts}` }],
      },
    ],
    max_tokens: REPORT_MAX_TOKENS,
    response_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        body_md: { type: "string" },
        followup_queries: { type: "array", items: { type: "string" } },
      },
      required: ["title", "body_md"],
    },
  });

  const parsed = (out.structured ?? safeParseJson(out.text)) as {
    title?: string;
    body_md?: string;
    followup_queries?: string[];
  } | null;
  const bodyMd = (parsed?.body_md ?? "").trim();
  if (bodyMd.length < 200) return { ok: false, reason: "writer produced too little text" };

  return {
    ok: true,
    title: parsed?.title?.trim() || label,
    bodyMd,
    followupQueries: opts.wantFollowups
      ? (parsed?.followup_queries ?? []).filter(Boolean).slice(0, MAX_FOLLOWUP_QUERIES)
      : [],
  };
}

interface PersistResult {
  pieceId: string;
  slug: string;
  sourceId: string;
  title: string;
}

/** The DB-write half — turns a finished synthesis into a real `pieces`
 *  row. Never enqueues extraction itself; callers decide when (or if)
 *  that happens. */
async function persistBrief(
  env: Env,
  userId: string,
  label: string,
  title: string,
  bodyMd: string,
  sourcePieceIds: string[],
  opts: { publish: boolean; angleHint?: string | undefined },
): Promise<PersistResult> {
  const sourceId = await insertOne(env.DB, "sources", {
    user_id: userId,
    // sources.source_type has a fixed CHECK list (no "synthesis" option) —
    // "report" is the closest fit for a system-written research brief.
    source_type: "report",
    ingestion_state: "approved",
    title,
    url: null,
    authors: JSON.stringify(["Canopticon research agent"]),
    content_text: bodyMd,
  });
  const slug = await ensureUniqueSlug(env.DB, userId, slugify(title));
  const pieceId = await insertOne(env.DB, "pieces", {
    user_id: userId,
    slug,
    title,
    kind: "research-report",
    publication_status: opts.publish ? "published" : "working-material",
    body_md: bodyMd,
    byline: "Canopticon research agent",
    tags: JSON.stringify(["auto-research", opts.publish ? "beat" : "on-demand"]),
    metadata: JSON.stringify({
      ingested_from: "deep-research",
      label,
      angle: opts.angleHint ?? null,
      source_piece_ids: sourcePieceIds,
      source_id: sourceId,
    }),
  });
  return { pieceId, slug, sourceId, title };
}

/** Single-pass write: synthesize + persist in one call. Only used by the
 *  dormant synthesizeDueBeatReport path below now — researchOnDemand
 *  needs the two halves separately (see file comment). */
async function writeResearchBrief(
  env: Env,
  userId: string,
  label: string,
  pieceIds: string[],
  opts: { publish: boolean; angleHint?: string | undefined },
): Promise<WriteBriefResult> {
  const synth = await synthesizeBrief(env, userId, label, pieceIds, {
    angleHint: opts.angleHint,
    wantFollowups: false,
  });
  if (!synth.ok || !synth.bodyMd || !synth.title) {
    return { ok: false, reason: synth.reason };
  }
  const persisted = await persistBrief(
    env,
    userId,
    label,
    synth.title,
    synth.bodyMd,
    pieceIds,
    opts,
  );
  return { ok: true, ...persisted };
}

interface DueBeatForSynthesis {
  id: string;
  label: string;
  last_banked_piece_ids: string | null;
}

/** Picks the one beat whose most recent expand hasn't been synthesized
 *  yet, and writes its report. Returns {synthesized:false} when nothing
 *  is due. DORMANT — nothing calls this since the autonomous sweep that
 *  used to (autonomous-expand.ts) was retired; left in place because
 *  draftOne-style single-pass logic here is still worth having around. */
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
  const now = new Date().toISOString();
  // coverage_beats has no updated_at column — updateById() unconditionally
  // sets one, so a plain UPDATE is used here instead (matches this table's
  // pre-existing convention elsewhere).
  if (pieceIds.length === 0) {
    await run(env.DB, "UPDATE coverage_beats SET last_synthesized_at = ? WHERE id = ?", [
      now,
      beat.id,
    ]);
    return { synthesized: false, beatLabel: beat.label, reason: "last expand banked nothing" };
  }

  const result = await writeResearchBrief(env, userId, beat.label, pieceIds, { publish: true });
  await run(env.DB, "UPDATE coverage_beats SET last_synthesized_at = ? WHERE id = ?", [
    now,
    beat.id,
  ]);
  if (!result.ok) {
    return { synthesized: false, beatLabel: beat.label, reason: result.reason };
  }

  // Publish path still enqueues extraction immediately — dormant code,
  // kept behaviorally identical to before rather than silently changed
  // underneath a name nothing invokes.
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
    payload: { beat_label: beat.label, piece_id: result.pieceId },
  }).catch(() => {});

  return { synthesized: true, beatLabel: beat.label, pieceId: result.pieceId };
}

/** Operator-triggered research, pass 1. Banks sources on `label` right
 *  now (expandRecord), synthesizes a brief AND asks the writer what
 *  follow-up searches would help. No gaps flagged -> this synthesis IS
 *  the final draft, persisted immediately. Gaps flagged -> nothing is
 *  persisted yet; state is saved to research_runs and pass 2
 *  (advanceResearchRun) picks it up on the next cron tick. Either way,
 *  the eventual draft lands as working-material, not published — see
 *  the file comment. */
export async function researchOnDemand(
  env: Env,
  userId: string,
  label: string,
  angleHint?: string,
): Promise<WriteBriefResult> {
  const runId = await insertOne(env.DB, "research_runs", {
    user_id: userId,
    label,
    angle: angleHint ?? null,
    status: "pass1_pending",
  });

  const { expandRecord } = await import("./record-builder");
  const expandReport = await withExpandBudget(expandRecord(env, userId, label), label);
  if (expandReport.banked_piece_ids.length === 0) {
    const reason = describeEmptyExpand(expandReport);
    await updateById(env.DB, "research_runs", runId, { status: "failed", error: reason });
    await emitDraftFailed(env, userId, label, angleHint, reason);
    return { ok: false, reason };
  }

  const synth = await synthesizeBrief(env, userId, label, expandReport.banked_piece_ids, {
    angleHint,
    wantFollowups: true,
  });
  if (!synth.ok || !synth.bodyMd || !synth.title) {
    await updateById(env.DB, "research_runs", runId, {
      status: "failed",
      error: synth.reason ?? "synthesis failed",
      pass1_piece_ids: JSON.stringify(expandReport.banked_piece_ids),
    });
    await emitDraftFailed(env, userId, label, angleHint, synth.reason);
    return { ok: false, reason: synth.reason };
  }

  const followups = synth.followupQueries ?? [];
  if (followups.length === 0) {
    const persisted = await persistBrief(
      env,
      userId,
      label,
      synth.title,
      synth.bodyMd,
      expandReport.banked_piece_ids,
      { publish: false, angleHint },
    );
    await updateById(env.DB, "research_runs", runId, {
      status: "done",
      pass1_piece_ids: JSON.stringify(expandReport.banked_piece_ids),
      final_piece_id: persisted.pieceId,
    });
    await emitDrafted(env, userId, label, angleHint, persisted.pieceId);
    return { ok: true, ...persisted };
  }

  // There's more to chase — defer to the cron drain (see file comment on
  // why this isn't just another expandRecord+synthesizeBrief call right
  // here).
  await updateById(env.DB, "research_runs", runId, {
    status: "pass2_pending",
    pass1_piece_ids: JSON.stringify(expandReport.banked_piece_ids),
    followup_queries: JSON.stringify(followups),
  });
  await insertOne(env.DB, "orchestrator_events", {
    user_id: userId,
    event_type: "deep_research.pass2_queued",
    subject_kind: "query",
    subject_id: null,
    payload: { label, angle: angleHint ?? null, followup_queries: followups },
  }).catch(() => {});
  return { ok: false, reason: "digging deeper — follow-up research queued" };
}

export interface AdvanceRunReport {
  advanced: boolean;
  label?: string;
  reason?: string | undefined;
}

/** Research pass 2 — one research_runs row per call, oldest first. Runs
 *  the follow-up searches pass 1's writer proposed, then re-synthesizes
 *  over the COMBINED source pool (pass 1 + pass 2 sources) into the final
 *  draft. Wired into index.ts's every-2-minute cron drain. */
export async function advanceResearchRun(env: Env, userId: string): Promise<AdvanceRunReport> {
  const runRow = await one<{
    id: string;
    label: string;
    angle: string | null;
    pass1_piece_ids: string | null;
    followup_queries: string | null;
  }>(
    env.DB,
    `SELECT id, label, angle, pass1_piece_ids, followup_queries FROM research_runs
      WHERE user_id = ? AND status = 'pass2_pending'
      ORDER BY created_at ASC LIMIT 1`,
    [userId],
  ).catch(() => null);
  if (!runRow) return { advanced: false, reason: "no run due" };

  const pass1Ids = parseJsonArray(runRow.pass1_piece_ids);
  const queries = parseJsonArray(runRow.followup_queries);

  if (queries.length === 0) {
    await updateById(env.DB, "research_runs", runRow.id, {
      status: "failed",
      error: "no follow-up queries recorded",
    });
    return { advanced: false, label: runRow.label, reason: "no follow-up queries recorded" };
  }

  const { expandRecord } = await import("./record-builder");
  const followupReports = await Promise.all(queries.map((q) => expandRecord(env, userId, q)));
  const pass2Ids = followupReports.flatMap((r) => r.banked_piece_ids);
  const combinedIds = [...new Set([...pass1Ids, ...pass2Ids])];

  const synth = await synthesizeBrief(env, userId, runRow.label, combinedIds, {
    angleHint: runRow.angle ?? undefined,
    wantFollowups: false,
  });
  if (!synth.ok || !synth.bodyMd || !synth.title) {
    await updateById(env.DB, "research_runs", runRow.id, {
      status: "failed",
      error: synth.reason ?? "final synthesis failed",
      pass2_piece_ids: JSON.stringify(pass2Ids),
    });
    await emitDraftFailed(env, userId, runRow.label, runRow.angle ?? undefined, synth.reason);
    return { advanced: false, label: runRow.label, reason: synth.reason };
  }

  const persisted = await persistBrief(
    env,
    userId,
    runRow.label,
    synth.title,
    synth.bodyMd,
    combinedIds,
    { publish: false, angleHint: runRow.angle ?? undefined },
  );
  await updateById(env.DB, "research_runs", runRow.id, {
    status: "done",
    pass2_piece_ids: JSON.stringify(pass2Ids),
    final_piece_id: persisted.pieceId,
  });
  await emitDrafted(env, userId, runRow.label, runRow.angle ?? undefined, persisted.pieceId);

  return { advanced: true, label: runRow.label };
}

const STALE_RUN_MS = 10 * 60 * 1000; // well past EXPAND_BUDGET_MS + a synthesis call

/** Safety net for the exact failure class EXPAND_BUDGET_MS above guards
 *  against — a pass1_pending/pass2_pending row whose execution died
 *  before ever reaching a terminal write (confirmed live: one from
 *  before that budget existed, and any future slow path this doesn't
 *  anticipate). Marks anything stuck past a generous ceiling as failed
 *  so the status UI (home.ts, the research page) stops showing
 *  "Researching…" forever for a run that's actually dead. Cheap — one
 *  UPDATE, no LLM calls — safe to run every cron tick. */
export async function reapStaleResearchRuns(env: Env, userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_RUN_MS).toISOString();
  await run(
    env.DB,
    `UPDATE research_runs SET status = 'failed', error = 'execution stalled — try again', updated_at = ?
      WHERE user_id = ? AND status IN ('pass1_pending', 'pass2_pending') AND created_at < ?`,
    [new Date().toISOString(), userId, cutoff],
  );
}

async function emitDrafted(
  env: Env,
  userId: string,
  label: string,
  angle: string | undefined,
  pieceId: string,
): Promise<void> {
  await insertOne(env.DB, "orchestrator_events", {
    user_id: userId,
    event_type: "deep_research.drafted",
    subject_kind: "query",
    subject_id: null,
    payload: { label, angle: angle ?? null, piece_id: pieceId },
  }).catch(() => {});
}

async function emitDraftFailed(
  env: Env,
  userId: string,
  label: string,
  angle: string | undefined,
  reason: string | undefined,
): Promise<void> {
  await insertOne(env.DB, "orchestrator_events", {
    user_id: userId,
    event_type: "deep_research.draft_failed",
    subject_kind: "query",
    subject_id: null,
    payload: { label, angle: angle ?? null, reason },
  }).catch(() => {});
}

function parseJsonArray(s: string | null): string[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
 *  extract phase ends, with no idea a synthesis (let alone a second
 *  research pass) runs after it. This wraps it with those missing phases,
 *  driven off research_runs' own status (authoritative, not reconstructed
 *  from an event log), plus turns the single replacing status line into a
 *  milestone checklist (search → fetch/bank → extract → write → dig
 *  deeper) so a poller can show real progress. */
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
  // never will; no research_runs row for its label would ever exist).
  if (extractDone && includeSynthesis) {
    const runRow = await one<{
      status: string;
      final_piece_id: string | null;
      error: string | null;
      followup_queries: string | null;
    }>(
      env.DB,
      `SELECT status, final_piece_id, error, followup_queries FROM research_runs
        WHERE user_id = ? AND label = ? AND created_at > datetime('now','-15 minutes')
        ORDER BY created_at DESC LIMIT 1`,
      [userId, label],
    ).catch(() => null);

    if (!runRow || runRow.status === "pass1_pending") {
      steps.push({ label: "Write a synthesis", state: "active" });
      return {
        terminal: false,
        warn: false,
        headline: "Writing a synthesis from what was found…",
        steps,
      };
    }

    if (runRow.status === "pass2_pending") {
      const queryCount = parseJsonArray(runRow.followup_queries).length;
      steps.push({ label: "Write a synthesis", state: "done", detail: "first pass done" });
      steps.push({
        label: `Dig deeper (${queryCount} follow-up search${queryCount === 1 ? "" : "es"})`,
        state: "active",
      });
      return {
        terminal: false,
        warn: false,
        headline: "First pass done — digging deeper on what it couldn't cover…",
        steps,
      };
    }

    if (runRow.status === "done" && runRow.final_piece_id) {
      steps.push({ label: "Write a synthesis", state: "done", detail: "draft ready" });
      return {
        terminal: true,
        warn: false,
        headline: "Draft brief ready — review it before it can publish.",
        steps,
        reviewUrl: `/op/library/research/${runRow.final_piece_id}/review`,
      };
    }

    const reason = runRow.error ?? "unknown reason";
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

// Races expandRecord against EXPAND_BUDGET_MS. On timeout, treats it as
// "nothing usable banked in time" — the same shape expandRecord itself
// returns when every source fails, which researchOnDemand's existing
// empty-expand path already handles (a clear, honest 'failed' status).
// Orphaned fetches/fallback attempts inside the real expandRecord() call
// keep running until Cloudflare reclaims the isolate on its own; nothing
// awaits their result once the budget elapses, so they can't block this
// function or the DB write that follows it.
async function withExpandBudget(
  expandPromise: ReturnType<typeof import("./record-builder").expandRecord>,
  label: string,
): ReturnType<typeof import("./record-builder").expandRecord> {
  const timeout = new Promise<Awaited<typeof expandPromise>>((resolve) => {
    setTimeout(
      () =>
        resolve({
          subject: label,
          configured: true,
          sources_found: 0,
          sources_fetched: 0,
          sources_banked: 0,
          sources_duplicate: 0,
          errors: [`expand timed out after ${EXPAND_BUDGET_MS}ms`],
          banked_piece_ids: [],
        }),
      EXPAND_BUDGET_MS,
    );
  });
  return Promise.race([expandPromise, timeout]);
}

// A precise, honest failure reason — not just "here's the last raw fetch
// error." Confirmed live: a re-run of an already-researched label mostly
// re-finds sources it already banked (duplicates, not errors) plus maybe
// one genuinely new-but-blocked source — the raw error text alone made
// that read as a random fetch failure instead of what it actually was
// ("nothing NEW to add, and the one new thing found couldn't be reached").
function describeEmptyExpand(report: {
  sources_found: number;
  sources_duplicate: number;
  errors: string[];
}): string {
  if (report.sources_found === 0) return "the web search itself turned up nothing";
  const errText = report.errors.slice(0, 3).join("; ");
  if (report.sources_duplicate > 0) {
    return errText
      ? `${report.sources_duplicate} source${report.sources_duplicate === 1 ? "" : "s"} already on record; the rest couldn't be fetched: ${errText}`
      : `every source found was already on record (${report.sources_duplicate} already known) — nothing new to add`;
  }
  return errText || "no usable sources found";
}

function safeParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence?.[1]) {
      try {
        return JSON.parse(fence[1]);
      } catch {
        return null;
      }
    }
    return null;
  }
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

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
  opts: { angleHint?: string | undefined; wantFollowups: boolean; writer?: string | null },
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

  const out = await callResearchWriter(
    env,
    {
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
    },
    { writer: opts.writer ?? null },
  );

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
  opts: { writer?: string | null } = {},
): Promise<WriteBriefResult> {
  const runId = await insertOne(env.DB, "research_runs", {
    user_id: userId,
    label,
    angle: angleHint ?? null,
    status: "pass1_pending",
    // Chosen per run and stored, so every later step — dispatched from a
    // different execution — writes with the same model as the first.
    writer: opts.writer ?? null,
  });

  const { expandRecord } = await import("./record-builder");
  const expandReport = await withExpandBudget(expandRecord(env, userId, label), label);
  if (expandReport.banked_piece_ids.length === 0) {
    const reason = describeEmptyExpand(expandReport);
    await updateById(env.DB, "research_runs", runId, { status: "failed", error: reason });
    await emitDraftFailed(env, userId, label, angleHint, reason);
    return { ok: false, reason };
  }

  // STOPS HERE. The synthesis used to run in this same execution, and that
  // is what stalled live: expandRecord had just fetched six pages and
  // extracted 273 facts, and a synthesis over up to twelve sources on top of
  // that is past Cloudflare's ceiling. The sources are banked and recorded;
  // writing from them is its own step, dispatched by advanceResearchRun.
  await updateById(env.DB, "research_runs", runId, {
    status: "synth_pending",
    pass1_piece_ids: JSON.stringify(expandReport.banked_piece_ids),
  });
  return {
    ok: false,
    reason: `${expandReport.banked_piece_ids.length} source${
      expandReport.banked_piece_ids.length === 1 ? "" : "s"
    } banked — writing the brief is the next step`,
  };
}

export interface AdvanceRunReport {
  advanced: boolean;
  label?: string;
  reason?: string | undefined;
}

/**
 * Do exactly ONE model-heavy step of the oldest run that has one due.
 *
 * Every branch below is a separate Worker execution, which is the whole point:
 * the previous shape ran an expand and a synthesis together in pass 1, and two
 * expands and a synthesis together in pass 2, and both were over Cloudflare's
 * ceiling. Observed live as "Sources banked, but no brief written — execution
 * stalled", with 273 facts successfully extracted immediately above it.
 *
 * Returns { advanced: false } when nothing is due, so a caller can press it
 * repeatedly without doing harm.
 */
export async function advanceResearchRun(env: Env, userId: string): Promise<AdvanceRunReport> {
  const runRow = await one<{
    id: string;
    label: string;
    angle: string | null;
    status: string;
    pass1_piece_ids: string | null;
    pass2_piece_ids: string | null;
    followup_queries: string | null;
    followups_done: string | null;
    writer: string | null;
  }>(
    env.DB,
    `SELECT id, label, angle, status, pass1_piece_ids, pass2_piece_ids,
            followup_queries, followups_done, writer
       FROM research_runs
      WHERE user_id = ?
        AND status IN ('synth_pending', 'pass2_pending', 'pass2_synth_pending')
      ORDER BY created_at ASC LIMIT 1`,
    [userId],
  ).catch(() => null);
  if (!runRow) return { advanced: false, reason: "no run due" };

  const angleHint = runRow.angle ?? undefined;
  const pass1Ids = parseJsonArray(runRow.pass1_piece_ids);
  const pass2Ids = parseJsonArray(runRow.pass2_piece_ids);

  // ---- step: the first synthesis --------------------------------------
  if (runRow.status === "synth_pending") {
    const synth = await synthesizeBrief(env, userId, runRow.label, pass1Ids, {
      angleHint,
      wantFollowups: true,
      writer: runRow.writer,
    });
    if (!synth.ok || !synth.bodyMd || !synth.title) {
      await updateById(env.DB, "research_runs", runRow.id, {
        status: "failed",
        error: synth.reason ?? "synthesis failed",
      });
      await emitDraftFailed(env, userId, runRow.label, angleHint, synth.reason);
      return { advanced: false, label: runRow.label, reason: synth.reason };
    }

    const followups = synth.followupQueries ?? [];
    if (followups.length === 0) {
      // Nothing left to chase, so this synthesis IS the draft.
      const persisted = await persistBrief(
        env,
        userId,
        runRow.label,
        synth.title,
        synth.bodyMd,
        pass1Ids,
        { publish: false, angleHint },
      );
      await updateById(env.DB, "research_runs", runRow.id, {
        status: "done",
        final_piece_id: persisted.pieceId,
      });
      await emitDrafted(env, userId, runRow.label, angleHint, persisted.pieceId);
      return { advanced: true, label: runRow.label };
    }

    await updateById(env.DB, "research_runs", runRow.id, {
      status: "pass2_pending",
      followup_queries: JSON.stringify(followups),
    });
    await insertOne(env.DB, "orchestrator_events", {
      user_id: userId,
      event_type: "deep_research.pass2_queued",
      subject_kind: "query",
      subject_id: null,
      payload: { label: runRow.label, angle: runRow.angle ?? null, followup_queries: followups },
    }).catch(() => {});
    return { advanced: true, label: runRow.label };
  }

  // ---- step: ONE follow-up search --------------------------------------
  //
  // One, not all of them. They used to run as Promise.all over every queued
  // query and then synthesize, in one execution — the same ceiling problem
  // pass 1 had, just with more fetches in it. followup_queries holds what is
  // STILL TO RUN, so each press pops one and the count visibly goes down.
  if (runRow.status === "pass2_pending") {
    // THE PLAN IS NOT CONSUMED. followup_queries holds every search the
    // writer proposed and is never rewritten; followups_done records which
    // have run. A list that deletes its own history cannot be shown, and the
    // plan taking shape is the most interesting thing a run produces — it is
    // the difference between a progress bar and a research tool.
    const plan = parseJsonArray(runRow.followup_queries);
    const done = parseJsonArray(runRow.followups_done);
    const next = plan.find((q) => !done.includes(q));

    if (!next) {
      // Everything planned has run (or there was never a plan). Go to the
      // final write rather than failing a run that has all it needs.
      await updateById(env.DB, "research_runs", runRow.id, { status: "pass2_synth_pending" });
      return { advanced: true, label: runRow.label };
    }

    const { expandRecord } = await import("./record-builder");
    const report = await withExpandBudget(expandRecord(env, userId, next), next);
    const banked = [...new Set([...pass2Ids, ...report.banked_piece_ids])];
    const nowDone = [...done, next];

    await updateById(env.DB, "research_runs", runRow.id, {
      // An expand that banks nothing is not a failure — the query simply had
      // no usable sources, and the remaining ones may still.
      status: nowDone.length < plan.length ? "pass2_pending" : "pass2_synth_pending",
      followups_done: JSON.stringify(nowDone),
      pass2_piece_ids: JSON.stringify(banked),
    });
    return { advanced: true, label: runRow.label };
  }

  // ---- step: the final synthesis ---------------------------------------
  const combinedIds = [...new Set([...pass1Ids, ...pass2Ids])];
  const synth = await synthesizeBrief(env, userId, runRow.label, combinedIds, {
    angleHint,
    wantFollowups: false,
    writer: runRow.writer,
  });
  if (!synth.ok || !synth.bodyMd || !synth.title) {
    await updateById(env.DB, "research_runs", runRow.id, {
      status: "failed",
      error: synth.reason ?? "final synthesis failed",
    });
    await emitDraftFailed(env, userId, runRow.label, angleHint, synth.reason);
    return { advanced: false, label: runRow.label, reason: synth.reason };
  }

  const persisted = await persistBrief(
    env,
    userId,
    runRow.label,
    synth.title,
    synth.bodyMd,
    combinedIds,
    { publish: false, angleHint },
  );
  await updateById(env.DB, "research_runs", runRow.id, {
    status: "done",
    final_piece_id: persisted.pieceId,
  });
  await emitDrafted(env, userId, runRow.label, angleHint, persisted.pieceId);
  return { advanced: true, label: runRow.label };
}

/** The host, for a source line the eye can scan. Never throws on a bad URL. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}

const STALE_RUN_MS = 10 * 60 * 1000; // well past EXPAND_BUDGET_MS, which is all pass 1 does now

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
    // pass1_pending ONLY. It is the single state with an execution actually in
    // flight — expandRecord running inside the operator's own request. Every
    // other pending state is a run WAITING FOR A PRESS, and reaping those
    // marked a perfectly healthy run "execution stalled" for the crime of
    // having been queued more than ten minutes ago, which is how long it takes
    // to go and get a coffee. pass2_pending was in this list.
    `UPDATE research_runs SET status = 'failed', error = 'execution stalled — try again', updated_at = ?
      WHERE user_id = ? AND status = 'pass1_pending' AND created_at < ?`,
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

/** A step the run cannot take by itself. Standing rule 4 says work happens
 *  when a person does something — so when a run is waiting on a press, the
 *  status has to carry the press, not just describe the wait. */
export interface ResearchAction {
  label: string;
  /** A POST endpoint. The banner renders it as a form, never a link. */
  postTo: string;
  /** Sent back so the operator lands on the same screen afterwards. */
  returnTo?: string;
  /**
   * The banner may take this step itself while the tab is open.
   *
   * Not a schedule (standing rule 4): it only happens because a person pressed
   * Research and is sitting there watching. Close the tab and it stops; an
   * idle site still costs nothing. The browser is the only thing driving it,
   * and the button stays visible so a failed auto-step is recoverable by hand.
   */
  auto?: boolean;
}

/** One search in the investigation's plan. */
export interface ResearchQuery {
  query: string;
  state: "done" | "running" | "queued";
  /** True for the operator's own question, false for a proposed follow-up. */
  opening: boolean;
}

/** One source the run actually read, as the expand logged it. */
export interface ResearchSource {
  title: string;
  url: string;
  /** Host only, for a compact line the eye can scan. */
  domain: string;
  chars?: number;
  state: "banked" | "fetching" | "duplicate";
}

export interface ResearchStatus {
  terminal: boolean;
  warn: boolean;
  action?: ResearchAction;
  /**
   * The searches this investigation is made of, in order.
   *
   * The single most valuable thing a research run produces and the last thing
   * that was visible: the writer proposes follow-up searches naming exactly
   * what the first pass could not cover, and they were stored and never shown.
   * A reader watching the plan fill in is watching an investigation take
   * shape; a reader watching "5 banked" is watching a progress bar.
   */
  plan?: ResearchQuery[];
  /** Every source read, newest first. Logged all along, never surfaced. */
  sources?: ResearchSource[];
  /** Verbatim facts extracted so far. */
  facts?: number;
  /** ISO timestamp the run started, so the screen can show elapsed time. */
  startedAt?: string;
  /** Which model is writing this run: 'anthropic', 'workers_ai', or null for the default. */
  writer?: string | null;
  /** The finished draft, once there is one. */
  draft?: { title: string; slug: string; reviewUrl: string };
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

  // The run is loaded BEFORE the events, because the plan decides which
  // events belong to this investigation. A follow-up expand logs under its
  // own query as the subject, not under the operator's original question —
  // so a query filtered on the label alone could only ever see the first
  // pass, and every source found by digging deeper was invisible.
  const run = await one<{
    id: string;
    status: string;
    final_piece_id: string | null;
    error: string | null;
    followup_queries: string | null;
    followups_done: string | null;
    created_at: string;
    writer: string | null;
  }>(
    env.DB,
    `SELECT id, status, final_piece_id, error, followup_queries, followups_done, created_at, writer
       FROM research_runs
      WHERE user_id = ? AND label = ? AND created_at > datetime('now','-1 day')
      ORDER BY created_at DESC LIMIT 1`,
    [userId, label],
  ).catch(() => null);

  const planQueries = parseJsonArray(run?.followup_queries ?? null);
  const planDone = parseJsonArray(run?.followups_done ?? null);
  const subjects = [label, ...planQueries];
  const subjectMarks = subjects.map(() => "?").join(",");

  const events = await all<{ event_type: string; payload: string }>(
    env.DB,
    `SELECT event_type, payload FROM orchestrator_events
      WHERE user_id = ?
        AND event_type LIKE 'record.expand.%'
        AND json_extract(payload, '$.subject') IN (${subjectMarks})
        AND created_at > datetime('now','-1 day')
      ORDER BY created_at ASC LIMIT 400`,
    [userId, ...subjects],
  ).catch(() => []);

  // ---- the material the run actually produced ---------------------------
  //
  // All of this was already being written on every run and then thrown away
  // at the point of display: the banner counted the events and showed "5
  // banked". A source list with real titles and real domains is the whole
  // difference between watching a job and watching a researcher work.
  const sources: ResearchSource[] = [];
  const seenUrls = new Set<string>();
  for (const e of [...events].reverse()) {
    const p = safeParseJson(e.payload) as { url?: string; title?: string; chars?: number } | null;
    const url = typeof p?.url === "string" ? p.url : "";
    if (!url || seenUrls.has(url)) continue;
    const state =
      e.event_type === "record.expand.source_banked"
        ? "banked"
        : e.event_type === "record.expand.source_duplicate"
          ? "duplicate"
          : e.event_type === "record.expand.source_fetching"
            ? "fetching"
            : null;
    if (!state) continue;
    seenUrls.add(url);
    sources.push({
      title: (typeof p?.title === "string" && p.title.trim()) || hostOf(url),
      url,
      domain: hostOf(url),
      ...(typeof p?.chars === "number" ? { chars: p.chars } : {}),
      state,
    });
  }

  const running = run?.status === "pass1_pending" || run?.status === "pass2_pending";
  const plan: ResearchQuery[] = [
    {
      query: label,
      opening: true,
      // The opening search is done the moment anything has been banked for it.
      state: run && run.status !== "pass1_pending" ? "done" : "running",
    },
    ...planQueries.map((q): ResearchQuery => {
      const isDone = planDone.includes(q);
      const isNext = !isDone && planDone.length === planQueries.indexOf(q);
      return {
        query: q,
        opening: false,
        state: isDone ? "done" : isNext && running ? "running" : "queued",
      };
    }),
  ];
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
    const runRow = run;

    // Every waiting state below is terminal for the POLLER — it will not
    // change on its own — and carries the press that moves it. The banner
    // advances automatically while the tab is open, so in practice the
    // operator presses once; the button is what it falls back to.
    //
    // `material` is attached to every return rather than to some of them: a
    // source list that vanished the moment the run finished would be the
    // worst possible time to lose it.
    const material = {
      plan,
      sources,
      facts: expand.factsAdded,
      ...(run ? { startedAt: run.created_at, writer: run.writer } : {}),
    };
    const advance = (label_: string) => ({
      label: label_,
      postTo: "/op/research/advance",
      returnTo: `/op/research?q=${encodeURIComponent(label)}`,
      auto: true,
    });

    if (!runRow || runRow.status === "pass1_pending") {
      steps.push({ label: "Write a synthesis", state: "pending" });
      return {
        terminal: false,
        warn: false,
        headline: "Banking sources…",
        steps,
        ...material,
      };
    }

    // Sources are in and the writing has not started. This is where it broke:
    // the synthesis used to run in the same execution as the expand that
    // banked those sources, and the two together went past the ceiling.
    if (runRow.status === "synth_pending") {
      steps.push({
        label: "Write a synthesis",
        state: "pending",
        detail: "sources banked — needs a press",
      });
      return {
        terminal: true,
        warn: false,
        headline: "Sources banked. Writing the brief is the next step.",
        steps,
        action: advance("Write the brief"),
        ...material,
      };
    }

    if (runRow.status === "pass2_pending") {
      const queryCount = parseJsonArray(runRow.followup_queries).length;
      steps.push({ label: "Write a synthesis", state: "done", detail: "first pass done" });
      // "pending", not "active" — rule 6. Nothing is running: the searches are
      // written down and waiting. Showing them as active was the lie that made
      // a waiting run look like a hung one.
      steps.push({
        label: `Dig deeper (${queryCount} follow-up search${queryCount === 1 ? "" : "es"} left)`,
        state: "pending",
        detail: "queued — needs a press",
      });
      return {
        terminal: true,
        warn: false,
        headline: `First pass done. ${queryCount} follow-up search${
          queryCount === 1 ? "" : "es"
        } left to run.`,
        steps,
        action: advance("Run the next search"),
        ...material,
      };
    }

    if (runRow.status === "pass2_synth_pending") {
      steps.push({ label: "Write a synthesis", state: "done", detail: "first pass done" });
      steps.push({ label: "Dig deeper", state: "done", detail: "follow-up sources banked" });
      steps.push({
        label: "Write the final brief",
        state: "pending",
        detail: "needs a press",
      });
      return {
        terminal: true,
        warn: false,
        headline: "Everything is banked. One step left: the final brief.",
        steps,
        action: advance("Write the final brief"),
        ...material,
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
        ...material,
      };
    }

    const reason = runRow?.error ?? "unknown reason";
    steps.push({ label: "Write a synthesis", state: "warn", detail: reason });
    return {
      terminal: true,
      warn: true,
      headline: `Sources banked, but no brief written — ${reason}.`,
      steps,
      ...material,
    };
  }

  return {
    terminal: expand.terminal,
    warn: expand.warn,
    headline: expand.line,
    steps,
    plan,
    sources,
    facts: expand.factsAdded,
    ...(run ? { startedAt: run.created_at } : {}),
  };
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

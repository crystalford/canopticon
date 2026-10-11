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
//
// WHAT A RUN BANKS. expandRecord writes each fetched page as a `sources` row
// and nothing else (record-builder.ts), and a run records those SOURCE ids in
// research_runs.pass1_source_ids / pass2_source_ids (migration 0059). The
// writer reads them back from `sources`. The older pass1_piece_ids /
// pass2_piece_ids columns are still read — a run started before that deploy
// holds piece ids, and loadBankedSources() below falls back to `pieces` for
// those so an in-flight run finishes. If those pieces have since been purged
// (/v1/admin/purge-web-fetched), the run fails with a stated reason — "start
// a new run" — rather than a crash. New runs never set the piece-id columns.

import type { Env } from "../../env";
import { all, insertOne, one, run, updateById } from "../../lib/d1";
import { callResearchWriter, resolveWriter } from "../../llm/router";
import { locateVerbatim } from "./digestion-typed";
import { readFullExtractedText } from "./extract";

/** docs/blackbox/RESEARCH-PROMPT.md "Stay on this question": research tools
 *  framed polling, fentanyl and feeds through McLuhan (23 documents), and
 *  pulled the author's projects into public findings. Every writer prompt
 *  carries this line. */
const STAY_ON_QUESTION = (where: string | null) =>
  `\n- STAY ON THIS QUESTION. Do not frame findings through Marshall McLuhan or media theory, and do not bring in the operator's other projects or earlier research, unless the subject is about them. ${
    where
      ? `If a connection seems to matter, put it in one sentence under ${where}, marked "outside the question".`
      : "If a connection seems to matter, leave it out: the gaps are written separately."
  }`;

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

// ---- the sectioned writer ------------------------------------------------
//
// "Deeper than that means more calls, not a bigger one." When the run's
// writer is Claude (1M context, its own 90s budget per call) the final brief
// is written in sections, one per press, instead of one 4,000-token call over
// 5,000-char excerpts. Workers AI's 25s window cannot write a thousand-word
// section reliably, so a Workers AI run keeps the single call above.
const OUTLINE_CHARS_PER_SOURCE = 8_000; // the outline call reads EVERY source, this much of each
const SECTION_CHARS_PER_SOURCE = 20_000; // a section reads its own sources near-whole
const OUTLINE_MIN_SECTIONS = 4;
const OUTLINE_MAX_SECTIONS = 7;
const SECTION_MAX_TOKENS = 3_000; // 600–1,200 words plus its quotes
const SECTION_MIN_CHARS = 1_200; // under this the writer did not write a section
const SECTION_MAX_QUOTES = 5;
const ASSEMBLE_MAX_TOKENS = 1_500; // a title, a paragraph and a list — no new claims

export type ResearchMode = "single" | "sectioned";

/** One planned section of a sectioned brief (research_runs.outline). */
export interface OutlineSection {
  heading: string;
  brief_of_section: string;
  /** `sources.id` rows this section draws on. Empty means "all of them". */
  source_ids: string[];
}

/** One written section (research_runs.sections_done). `body_md` already
 *  carries its verified quotes; the counts are what the review shows. */
export interface DoneSection {
  heading: string;
  body_md: string;
  quotes_ok: number;
  quotes_killed: number;
}

/**
 * Which way THIS run finishes. Sectioned when the resolved writer is Claude
 * by either transport; single otherwise. resolveWriter throws for a run that
 * asked for Claude and cannot have it — that run fails loudly at its first
 * writer call, exactly as before, so here it simply is not sectioned.
 */
export function decideResearchMode(env: Env, writer: string | null | undefined): ResearchMode {
  try {
    const p = resolveWriter(env, writer).provider;
    return p === "claude_gateway" || p === "anthropic" ? "sectioned" : "single";
  } catch {
    return "single";
  }
}

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

/** What a run banked, by which column it was recorded in. `sourceIds` are
 *  `sources.id` (every run since migration 0059); `pieceIds` are the legacy
 *  `pieces.id` a run started before that deploy holds. Either may be empty;
 *  a run that straddled the deploy has both. */
export interface BankedIds {
  sourceIds: string[];
  pieceIds: string[];
}

interface BankedText {
  /** `sources.id`; a legacy piece read has none. */
  id?: string;
  title: string;
  text: string;
}

/** Everything the writer may read for one synthesis, capped, in the order it
 *  was banked. Sources first: that is the live path. The `pieces` read is
 *  the compatibility path for a run that banked before 0059, and it is what
 *  the purge endpoint can pull out from under a run — so "no longer found"
 *  is a stated reason there, not an exception. */
async function loadBankedSources(
  env: Env,
  userId: string,
  banked: BankedIds,
  // The single-call synthesis keeps its cap; the sectioned writer reads every
  // source the run banked, because the context allows it and the outline is
  // only as good as what it saw.
  cap: number = MAX_TOTAL_SOURCES_FOR_SYNTHESIS,
): Promise<{ excerpts: BankedText[]; reason?: string }> {
  const cappedSourceIds = banked.sourceIds.slice(0, cap);
  const excerpts: BankedText[] = [];
  for (const id of cappedSourceIds) {
    // readFullExtractedText honours the 8KB-inline / R2-overflow rule
    // extract.ts writes uploads with; a fetched page is inline in full, so
    // it comes back whole either way. Returns empty on a missing row.
    const { text, title } = await readFullExtractedText(env, id, userId).catch(() => ({
      text: "",
      title: "",
    }));
    if (text) excerpts.push({ id, title: title || "Untitled source", text });
  }

  // Legacy piece ids fill whatever room the cap leaves after the sources.
  const pieceIds = banked.pieceIds.slice(0, MAX_TOTAL_SOURCES_FOR_SYNTHESIS);
  const cappedPieceIds = pieceIds.slice(
    0,
    Math.max(0, MAX_TOTAL_SOURCES_FOR_SYNTHESIS - excerpts.length),
  );
  if (cappedPieceIds.length > 0) {
    const placeholders = cappedPieceIds.map(() => "?").join(",");
    const pieces = await all<{ title: string; body_md: string | null }>(
      env.DB,
      `SELECT title, body_md FROM pieces WHERE id IN (${placeholders}) AND user_id = ?`,
      [...cappedPieceIds, userId],
    ).catch(() => []);
    for (const p of pieces) excerpts.push({ title: p.title, text: p.body_md ?? "" });
  }

  if (excerpts.length === 0) {
    const wanted = cappedSourceIds.length + cappedPieceIds.length;
    if (wanted === 0) return { excerpts, reason: "no banked sources to synthesize from" };
    return {
      excerpts,
      reason:
        cappedSourceIds.length > 0
          ? "banked sources no longer found — start a new run"
          : "banked pieces no longer found (purged) — sources unavailable, start a new run",
    };
  }
  return { excerpts };
}

/** The LLM half only — no DB writes beyond reading the banked sources.
 *  Separated from persistBrief() because pass 1 needs to know the
 *  follow-up queries BEFORE deciding whether this synthesis is the final
 *  draft or just scratch work for planning pass 2. */
async function synthesizeBrief(
  env: Env,
  userId: string,
  label: string,
  banked: BankedIds,
  opts: { angleHint?: string | undefined; wantFollowups: boolean; writer?: string | null },
): Promise<SynthesizeResult> {
  const loaded = await loadBankedSources(env, userId, banked);
  if (loaded.reason) return { ok: false, reason: loaded.reason };
  const pieces = loaded.excerpts;

  const excerpts = pieces
    .map((p) => `### ${p.title}\n${p.text.slice(0, EXCERPT_CHARS_PER_SOURCE)}`)
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
- Plain, direct prose. No throat-clearing intro, no "in conclusion."${STAY_ON_QUESTION('"Still open"')}${angleLine}${followupLine}

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
  banked: BankedIds,
  opts: {
    publish: boolean;
    angleHint?: string | undefined;
    /** Lineage (docs/the-record.md §5): the document this run grew from. */
    parentPieceId?: string | null | undefined;
    /** The sectioned writer's receipt: mode, section count, quotes kept and
     *  killed. Merged into the piece's metadata, never into the body. */
    extraMetadata?: Record<string, unknown> | undefined;
  },
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
    // Lineage: a brief is a child of the document whose lead started the run,
    // and `origin` is the question, verbatim. A free question has no parent.
    parent_piece_id: opts.parentPieceId ?? null,
    origin: label,
    tags: JSON.stringify(["auto-research", opts.publish ? "beat" : "on-demand"]),
    metadata: JSON.stringify({
      ingested_from: "deep-research",
      label,
      angle: opts.angleHint ?? null,
      // What the brief was written from: sources.id rows (every run since
      // 0059) and, for a run that banked before that deploy, pieces.id rows.
      source_ids: banked.sourceIds,
      source_piece_ids: banked.pieceIds,
      source_id: sourceId,
      ...(opts.extraMetadata ?? {}),
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
  banked: BankedIds,
  opts: {
    publish: boolean;
    angleHint?: string | undefined;
    /** Lineage (docs/the-record.md §5): the document this run grew from. */
    parentPieceId?: string | null | undefined;
  },
): Promise<WriteBriefResult> {
  const synth = await synthesizeBrief(env, userId, label, banked, {
    angleHint: opts.angleHint,
    wantFollowups: false,
  });
  if (!synth.ok || !synth.bodyMd || !synth.title) {
    return { ok: false, reason: synth.reason };
  }
  const persisted = await persistBrief(env, userId, label, synth.title, synth.bodyMd, banked, opts);
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

  // coverage_beats.last_banked_piece_ids predates 0059 and holds piece ids;
  // nothing writes it any more (autonomous-expand.ts is retired), so this
  // only ever reads the legacy path.
  const result = await writeResearchBrief(
    env,
    userId,
    beat.label,
    { sourceIds: [], pieceIds },
    { publish: true },
  );
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
  opts: {
    writer?: string | null;
    /** Lineage: the document whose lead/question/bridge/reading started this. */
    parentPieceId?: string | null;
    originKind?: string | null;
  } = {},
): Promise<WriteBriefResult> {
  const runId = await insertOne(env.DB, "research_runs", {
    user_id: userId,
    label,
    angle: angleHint ?? null,
    status: "pass1_pending",
    // Chosen per run and stored, so every later step — dispatched from a
    // different execution — writes with the same model as the first.
    writer: opts.writer ?? null,
    // Decided once, here, from the same writer choice every step reads back.
    mode: decideResearchMode(env, opts.writer ?? null),
    parent_piece_id: opts.parentPieceId ?? null,
    origin_kind: opts.originKind ?? "free",
  });

  const { expandRecord } = await import("./record-builder");
  const expandReport = await withExpandBudget(expandRecord(env, userId, label), label);
  if (expandReport.banked_source_ids.length === 0) {
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
    // Source ids, never piece ids: a fetched page has no piece (0059).
    pass1_source_ids: JSON.stringify(expandReport.banked_source_ids),
  });
  return {
    ok: false,
    reason: `${expandReport.banked_source_ids.length} source${
      expandReport.banked_source_ids.length === 1 ? "" : "s"
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
    pass1_source_ids: string | null;
    pass2_source_ids: string | null;
    pass1_piece_ids: string | null;
    pass2_piece_ids: string | null;
    followup_queries: string | null;
    followups_done: string | null;
    writer: string | null;
    parent_piece_id: string | null;
    mode: string | null;
    outline: string | null;
    sections_done: string | null;
  }>(
    env.DB,
    `SELECT id, label, angle, status, pass1_source_ids, pass2_source_ids, parent_piece_id,
            pass1_piece_ids, pass2_piece_ids,
            followup_queries, followups_done, writer, mode, outline, sections_done
       FROM research_runs
      WHERE user_id = ?
        AND status IN ('synth_pending', 'pass2_pending', 'pass2_synth_pending',
                       'outline_pending', 'section_pending', 'assemble_pending')
      ORDER BY created_at ASC LIMIT 1`,
    [userId],
  ).catch(() => null);
  if (!runRow) return { advanced: false, reason: "no run due" };

  const angleHint = runRow.angle ?? undefined;
  // Source ids are the live path. The piece-id columns are only ever set on
  // a run that banked before migration 0059; they are carried so that run
  // can still finish, and a new run leaves them empty.
  const pass1Ids = parseJsonArray(runRow.pass1_source_ids);
  const pass2Ids = parseJsonArray(runRow.pass2_source_ids);
  const pass1PieceIds = parseJsonArray(runRow.pass1_piece_ids);
  const pass2PieceIds = parseJsonArray(runRow.pass2_piece_ids);
  const pass1Banked: BankedIds = { sourceIds: pass1Ids, pieceIds: pass1PieceIds };
  // A run from before migration 0062 has no mode; it is decided now, from the
  // same stored writer choice, and written back so every later press agrees.
  const mode: ResearchMode =
    runRow.mode === "sectioned" || runRow.mode === "single"
      ? runRow.mode
      : decideResearchMode(env, runRow.writer);
  // Where a run goes once every planned search has run: the one-call final
  // synthesis, or the outline that starts the sectioned brief.
  const finalStatus = mode === "sectioned" ? "outline_pending" : "pass2_synth_pending";

  // ---- step: the first synthesis --------------------------------------
  if (runRow.status === "synth_pending") {
    const synth = await synthesizeBrief(env, userId, runRow.label, pass1Banked, {
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
    if (followups.length === 0 && mode === "sectioned") {
      // Nothing left to chase; the sectioned brief is written from here, one
      // section per press. The first synthesis was the planning pass and is
      // not kept — the sections read the sources whole.
      await updateById(env.DB, "research_runs", runRow.id, { status: "outline_pending", mode });
      return { advanced: true, label: runRow.label };
    }
    if (followups.length === 0) {
      // Nothing left to chase, so this synthesis IS the draft.
      const persisted = await persistBrief(
        env,
        userId,
        runRow.label,
        synth.title,
        synth.bodyMd,
        pass1Banked,
        { publish: false, angleHint, parentPieceId: runRow.parent_piece_id ?? null },
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
      mode,
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
      await updateById(env.DB, "research_runs", runRow.id, { status: finalStatus });
      return { advanced: true, label: runRow.label };
    }

    const { expandRecord } = await import("./record-builder");
    const report = await withExpandBudget(expandRecord(env, userId, next), next);
    const banked = [...new Set([...pass2Ids, ...report.banked_source_ids])];
    const nowDone = [...done, next];

    await updateById(env.DB, "research_runs", runRow.id, {
      // An expand that banks nothing is not a failure — the query simply had
      // no usable sources, and the remaining ones may still.
      status: nowDone.length < plan.length ? "pass2_pending" : finalStatus,
      followups_done: JSON.stringify(nowDone),
      // A legacy run's pass2_piece_ids is left as it was; new banks are
      // sources and go in the source column, and the final read merges both.
      pass2_source_ids: JSON.stringify(banked),
    });
    return { advanced: true, label: runRow.label };
  }

  const combinedIds = [...new Set([...pass1Ids, ...pass2Ids])];
  const combined: BankedIds = {
    sourceIds: combinedIds,
    pieceIds: [...new Set([...pass1PieceIds, ...pass2PieceIds])],
  };

  // ---- step: the outline (sectioned) -----------------------------------
  if (runRow.status === "outline_pending") {
    const outline = await proposeOutline(env, userId, runRow.label, combined, {
      angleHint,
      writer: runRow.writer,
    });
    if (!outline.ok || !outline.outline) {
      await updateById(env.DB, "research_runs", runRow.id, {
        status: "failed",
        error: outline.reason ?? "outline failed",
      });
      await emitDraftFailed(env, userId, runRow.label, angleHint, outline.reason);
      return { advanced: false, label: runRow.label, reason: outline.reason };
    }
    await updateById(env.DB, "research_runs", runRow.id, {
      status: "section_pending",
      outline: JSON.stringify(outline.outline),
      sections_done: JSON.stringify([]),
    });
    return { advanced: true, label: runRow.label };
  }

  // ---- step: ONE section (sectioned) -----------------------------------
  //
  // One per press, like the follow-up searches: the outline is the plan and
  // is never rewritten; sections_done is what has landed. The next section
  // is the first heading not yet in sections_done.
  if (runRow.status === "section_pending") {
    const outline = parseOutline(runRow.outline);
    const done = parseSections(runRow.sections_done);
    const next = outline[done.length];
    if (!next) {
      await updateById(env.DB, "research_runs", runRow.id, { status: "assemble_pending" });
      return { advanced: true, label: runRow.label };
    }
    const section = await writeSection(env, userId, runRow.label, combined, next, {
      angleHint,
      writer: runRow.writer,
      position: done.length + 1,
      total: outline.length,
    });
    if (!section.ok || !section.section) {
      await updateById(env.DB, "research_runs", runRow.id, {
        status: "failed",
        error: section.reason ?? `section ${done.length + 1} failed`,
      });
      await emitDraftFailed(env, userId, runRow.label, angleHint, section.reason);
      return { advanced: false, label: runRow.label, reason: section.reason };
    }
    const nowDone = [...done, section.section];
    await updateById(env.DB, "research_runs", runRow.id, {
      status: nowDone.length < outline.length ? "section_pending" : "assemble_pending",
      sections_done: JSON.stringify(nowDone),
    });
    return { advanced: true, label: runRow.label };
  }

  // ---- step: assemble (sectioned) --------------------------------------
  if (runRow.status === "assemble_pending") {
    const sections = parseSections(runRow.sections_done);
    if (sections.length === 0) {
      const reason = "no sections were written";
      await updateById(env.DB, "research_runs", runRow.id, { status: "failed", error: reason });
      await emitDraftFailed(env, userId, runRow.label, angleHint, reason);
      return { advanced: false, label: runRow.label, reason };
    }
    const assembled = await assembleBrief(env, userId, runRow.label, sections, {
      angleHint,
      writer: runRow.writer,
    });
    if (!assembled.ok || !assembled.bodyMd || !assembled.title) {
      await updateById(env.DB, "research_runs", runRow.id, {
        status: "failed",
        error: assembled.reason ?? "assembly failed",
      });
      await emitDraftFailed(env, userId, runRow.label, angleHint, assembled.reason);
      return { advanced: false, label: runRow.label, reason: assembled.reason };
    }
    const quotesOk = sections.reduce((n, x) => n + x.quotes_ok, 0);
    const quotesKilled = sections.reduce((n, x) => n + x.quotes_killed, 0);
    const persisted = await persistBrief(
      env,
      userId,
      runRow.label,
      assembled.title,
      assembled.bodyMd,
      combined,
      {
        publish: false,
        angleHint,
        parentPieceId: runRow.parent_piece_id ?? null,
        extraMetadata: {
          mode: "sectioned",
          sections: sections.length,
          quotes_ok: quotesOk,
          quotes_killed: quotesKilled,
        },
      },
    );
    await updateById(env.DB, "research_runs", runRow.id, {
      status: "done",
      final_piece_id: persisted.pieceId,
    });
    await emitDrafted(env, userId, runRow.label, angleHint, persisted.pieceId);
    return { advanced: true, label: runRow.label };
  }

  // ---- step: the final synthesis (single) -----------------------------
  const synth = await synthesizeBrief(env, userId, runRow.label, combined, {
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
    combined,
    { publish: false, angleHint, parentPieceId: runRow.parent_piece_id ?? null },
  );
  await updateById(env.DB, "research_runs", runRow.id, {
    status: "done",
    final_piece_id: persisted.pieceId,
  });
  await emitDrafted(env, userId, runRow.label, angleHint, persisted.pieceId);
  return { advanced: true, label: runRow.label };
}

// ---- the sectioned writer's three calls ----------------------------------

/** Sources labelled S1…Sn for the writer, and the map back to real ids. A
 *  model is reliable with short labels and unreliable with UUIDs. */
function labelSources(excerpts: BankedText[]): {
  labelled: Array<{ label: string; src: BankedText }>;
  idOf: Map<string, string>;
} {
  const labelled = excerpts.map((src, i) => ({ label: `S${i + 1}`, src }));
  const idOf = new Map<string, string>();
  for (const { label, src } of labelled) if (src.id) idOf.set(label, src.id);
  return { labelled, idOf };
}

/** ONE call: every source, OUTLINE_CHARS_PER_SOURCE of each, in → 4–7
 *  sections out, each naming the sources it should draw on. */
async function proposeOutline(
  env: Env,
  userId: string,
  label: string,
  banked: BankedIds,
  opts: { angleHint?: string | undefined; writer?: string | null },
): Promise<{ ok: boolean; outline?: OutlineSection[]; reason?: string }> {
  const loaded = await loadBankedSources(env, userId, banked, Number.POSITIVE_INFINITY);
  if (loaded.reason) return { ok: false, reason: loaded.reason };
  const { labelled, idOf } = labelSources(loaded.excerpts);
  const material = labelled
    .map(
      ({ label: l, src }) =>
        `### [${l}] ${src.title}\n${src.text.slice(0, OUTLINE_CHARS_PER_SOURCE)}`,
    )
    .join("\n\n");
  const angleLine = opts.angleHint
    ? `\n\nTHE OPERATOR ASKED SPECIFICALLY ABOUT: "${opts.angleHint.slice(0, 300)}"\nShape the outline around this where the sources support it; if they do not, one section should say so.`
    : "";

  const out = await callResearchWriter(
    env,
    {
      userId,
      system: `You are planning a RESEARCH BRIEF that will be written one section at a time from the supplied sources. Your only job now is the OUTLINE.

RULES:
- Propose between ${OUTLINE_MIN_SECTIONS} and ${OUTLINE_MAX_SECTIONS} sections, organised by theme, not by source. Together they should cover what these sources can actually establish about the subject, in an order a reader can follow.
- Each section gets a heading (short, specific, no numbering), a one-line brief saying what that section must establish, and the labels of the sources it should draw on (e.g. ["S1", "S4"]). Name only sources that actually bear on it; a section may have several.
- Do not propose a section the sources cannot support. Gaps are reported at assembly, not planned as sections.
- No introduction or conclusion sections: the summary and the gaps are written separately after every section exists.${STAY_ON_QUESTION(null)}${angleLine}

Return ONLY JSON:
{
  "sections": [
    { "heading": "…", "brief_of_section": "…", "sources": ["S1", "S2"] }
  ]
}`,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: `Subject: ${label}\n\nSOURCES:\n${material}` }],
        },
      ],
      max_tokens: 1_500,
      response_schema: {
        type: "object",
        properties: {
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                heading: { type: "string" },
                brief_of_section: { type: "string" },
                sources: { type: "array", items: { type: "string" } },
              },
              required: ["heading", "brief_of_section"],
            },
          },
        },
        required: ["sections"],
      },
    },
    { writer: opts.writer ?? null },
  );

  const parsed = (out.structured ?? safeParseJson(out.text)) as {
    sections?: Array<{ heading?: string; brief_of_section?: string; sources?: string[] }>;
  } | null;
  const outline: OutlineSection[] = (parsed?.sections ?? [])
    .filter((x) => typeof x?.heading === "string" && x.heading.trim().length > 0)
    .slice(0, OUTLINE_MAX_SECTIONS)
    .map((x) => ({
      heading: (x.heading as string).trim(),
      brief_of_section: (x.brief_of_section ?? "").trim(),
      // Unknown labels are dropped, not guessed; a section left with no
      // sources reads all of them (writeSection treats empty as "all").
      source_ids: (x.sources ?? [])
        .map((l) => idOf.get(String(l).trim().toUpperCase()))
        .filter((id): id is string => Boolean(id)),
    }));
  if (outline.length < 2) return { ok: false, reason: "writer proposed no usable outline" };
  return { ok: true, outline };
}

/** ONE call: one section from ITS sources, near-whole. The prose is the
 *  writer's; every quote is the SOURCE'S substring at the located offset or it
 *  is killed and counted — the same firewall answer-lead.ts runs. */
async function writeSection(
  env: Env,
  userId: string,
  label: string,
  banked: BankedIds,
  section: OutlineSection,
  opts: { angleHint?: string | undefined; writer?: string | null; position: number; total: number },
): Promise<{ ok: boolean; section?: DoneSection; reason?: string }> {
  const loaded = await loadBankedSources(env, userId, banked, Number.POSITIVE_INFINITY);
  if (loaded.reason) return { ok: false, reason: loaded.reason };
  const wanted = new Set(section.source_ids);
  const own = loaded.excerpts.filter((x) => x.id && wanted.has(x.id));
  // The outline named sources that no longer resolve (or none): read all.
  const excerpts = own.length > 0 ? own : loaded.excerpts;
  const { labelled } = labelSources(excerpts);
  const material = labelled
    .map(
      ({ label: l, src }) =>
        `### [${l}] ${src.title}\n${src.text.slice(0, SECTION_CHARS_PER_SOURCE)}`,
    )
    .join("\n\n");
  const angleLine = opts.angleHint
    ? `\n\nTHE OPERATOR ASKED SPECIFICALLY ABOUT: "${opts.angleHint.slice(0, 300)}"`
    : "";

  const out = await callResearchWriter(
    env,
    {
      userId,
      system: `You are writing ONE SECTION of a research brief. Other sections are written separately from the same plan; do not cover their ground, do not introduce the brief, do not conclude it.

THIS SECTION
Heading: ${section.heading}
What it must establish: ${section.brief_of_section || "(see heading)"}
Section ${opts.position} of ${opts.total}.

RULES:
- 600 to 1,200 words of plain, direct prose in Markdown. Sub-headings (###) only if they help. No preamble.
- Every substantive claim must be traceable to the supplied sources. Do not invent facts they do not support. Where the sources disagree, say so.
- Name the source in the prose where it matters ("the IAB guidance says…"), but DO NOT quote the sources in the prose. Put every quotation in "quotes" instead: 2 to ${SECTION_MAX_QUOTES} passages copied EXACTLY, character for character, from the source text, each at least one full sentence, with the source label. They will be checked mechanically against the source and any that do not match word for word will be dropped.${STAY_ON_QUESTION(null)}${angleLine}

Return ONLY JSON:
{
  "body_md": "the section's prose, without the heading",
  "quotes": [ { "text": "…exact passage…", "source": "S1" } ]
}`,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `Subject: ${label}\n\nSOURCES FOR THIS SECTION:\n${material}` },
          ],
        },
      ],
      max_tokens: SECTION_MAX_TOKENS,
      response_schema: {
        type: "object",
        properties: {
          body_md: { type: "string" },
          quotes: {
            type: "array",
            items: {
              type: "object",
              properties: { text: { type: "string" }, source: { type: "string" } },
              required: ["text"],
            },
          },
        },
        required: ["body_md"],
      },
    },
    { writer: opts.writer ?? null },
  );

  const parsed = (out.structured ?? safeParseJson(out.text)) as {
    body_md?: string;
    quotes?: unknown[];
  } | null;
  const bodyMd = (parsed?.body_md ?? "").trim();
  if (bodyMd.length < SECTION_MIN_CHARS) {
    return { ok: false, reason: `writer produced too little text for "${section.heading}"` };
  }
  const verified = verifySectionQuotes(
    Array.isArray(parsed?.quotes) ? parsed.quotes : [],
    excerpts,
  );
  const quoteBlock = verified.quotes
    .map((q) => `> ${q.text.replace(/\s*\n\s*/g, " ")}\n>\n> — ${q.title}`)
    .join("\n\n");
  return {
    ok: true,
    section: {
      heading: section.heading,
      body_md: quoteBlock ? `${bodyMd}\n\n${quoteBlock}` : bodyMd,
      quotes_ok: verified.quotes.length,
      quotes_killed: verified.killed,
    },
  };
}

/**
 * The verbatim firewall for a section, as answer-lead.ts's verify(): the
 * model PROPOSES a span, locateVerbatim decides, and what is kept is the
 * source's own substring — never the model's string. The source label the
 * model gave is not trusted either; every source is searched. Exported for
 * the test that matters most.
 */
export function verifySectionQuotes(
  proposed: unknown[],
  sources: Array<{ title: string; text: string }>,
): { quotes: Array<{ text: string; title: string }>; killed: number } {
  const quotes: Array<{ text: string; title: string }> = [];
  let killed = 0;
  for (const raw of proposed) {
    if (quotes.length >= SECTION_MAX_QUOTES) break;
    const text =
      typeof (raw as { text?: unknown })?.text === "string" ? (raw as { text: string }).text : "";
    if (!text.trim()) {
      killed++;
      continue;
    }
    let found: { text: string; title: string } | null = null;
    for (const src of sources) {
      const hit = locateVerbatim(src.text, text);
      if (hit) {
        found = { text: hit.text, title: src.title };
        break;
      }
    }
    if (!found) {
      killed++;
      continue;
    }
    if (quotes.some((q) => q.text === found.text)) continue;
    quotes.push(found);
  }
  return { quotes, killed };
}

/** ONE call over the finished sections: a title, a one-paragraph summary and
 *  the list of what the brief could not establish — no new claims. The body
 *  is assembled here by code: summary, the sections in outline order, gaps. */
async function assembleBrief(
  env: Env,
  userId: string,
  label: string,
  sections: DoneSection[],
  opts: { angleHint?: string | undefined; writer?: string | null },
): Promise<{ ok: boolean; title?: string; bodyMd?: string; reason?: string }> {
  const text = sections.map((s) => `## ${s.heading}\n\n${s.body_md}`).join("\n\n");
  const angleLine = opts.angleHint
    ? `\n\nTHE OPERATOR ASKED SPECIFICALLY ABOUT: "${opts.angleHint.slice(0, 300)}"`
    : "";
  const out = await callResearchWriter(
    env,
    {
      userId,
      system: `The sections of a research brief are finished. Write ONLY what frames them.

RULES:
- "title": a short title for the brief.
- "summary": ONE paragraph that stands alone, stating what the sections establish. Every sentence must be supported by a section below; introduce NO claim, figure or source the sections do not already contain.
- "gaps": a list of what this brief could not establish — questions the sections raise and leave open, points where the sources disagree, and figures given without a named source. Each item one sentence. Drawn from the sections only.
- Plain, direct prose. No throat-clearing.${STAY_ON_QUESTION('"gaps"')}${angleLine}

Return ONLY JSON:
{ "title": "…", "summary": "…", "gaps": ["…", "…"] }`,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: `Subject: ${label}\n\nSECTIONS:\n${text}` }],
        },
      ],
      max_tokens: ASSEMBLE_MAX_TOKENS,
      response_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          gaps: { type: "array", items: { type: "string" } },
        },
        required: ["title", "summary"],
      },
    },
    { writer: opts.writer ?? null },
  );
  const parsed = (out.structured ?? safeParseJson(out.text)) as {
    title?: string;
    summary?: string;
    gaps?: string[];
  } | null;
  const summary = (parsed?.summary ?? "").trim();
  if (summary.length < 80) return { ok: false, reason: "writer produced no usable summary" };
  const gaps = (parsed?.gaps ?? []).map((g) => String(g).trim()).filter(Boolean);
  const gapsBlock = `## What this brief could not establish\n\n${
    gaps.length ? gaps.map((g) => `- ${g}`).join("\n") : "- Nothing the sections flagged as open."
  }`;
  return {
    ok: true,
    title: parsed?.title?.trim() || label,
    bodyMd: [summary, text, gapsBlock].join("\n\n"),
  };
}

function parseOutline(s: string | null): OutlineSection[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x.heading === "string")
      .map((x) => ({
        heading: x.heading,
        brief_of_section: typeof x.brief_of_section === "string" ? x.brief_of_section : "",
        source_ids: Array.isArray(x.source_ids) ? x.source_ids.filter(Boolean) : [],
      }));
  } catch {
    return [];
  }
}

function parseSections(s: string | null): DoneSection[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x.heading === "string" && typeof x.body_md === "string")
      .map((x) => ({
        heading: x.heading,
        body_md: x.body_md,
        quotes_ok: Number(x.quotes_ok) || 0,
        quotes_killed: Number(x.quotes_killed) || 0,
      }));
  } catch {
    return [];
  }
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
  /** "rejected" is a page refused at fetch time (bot challenge, too short);
   *  it was never written anywhere, and `reason` says why. */
  state: "banked" | "fetching" | "duplicate" | "rejected";
  reason?: string;
}

/** One planned section, as the checklist under the plan shows it. */
export interface ResearchOutlineItem {
  heading: string;
  state: "done" | "writing" | "queued";
  /** Set once the section has landed. */
  quotesOk?: number;
  quotesKilled?: number;
}

/**
 * The finished brief, ready to be read on the workspace before it is
 * published (docs/the-record.md §6: "Read the draft, then Publish"). This is
 * what closes the loop on one screen: the document the run grew from, the
 * question, every section with the quotes that survived and the quotes that
 * were KILLED, the body, the gaps, and the two things the operator can do.
 * Everything here is read from rows the run already wrote — nothing is
 * composed at status time.
 */
export interface ResearchReviewSection {
  heading: string;
  bodyMd: string;
  quotesOk: number;
  quotesKilled: number;
}

export interface ResearchReview {
  pieceId: string;
  slug: string;
  title: string;
  /** The question, verbatim (`pieces.origin`, falling back to the run label). */
  question: string;
  /** The document the run grew from (`pieces.parent_piece_id`), if any. */
  parent: { id: string; slug: string; title: string } | null;
  mode: ResearchMode;
  /** Per section for a sectioned brief; EMPTY for a single-call brief, whose
   *  whole is `bodyMd` and whose counts are the totals. */
  sections: ResearchReviewSection[];
  bodyMd: string;
  /** The assembled "What this brief could not establish" block, as Markdown,
   *  when the body carries one; null when the writer produced none. */
  gapsMd: string | null;
  quotesOk: number;
  quotesKilled: number;
  /** The writer, in words: which model wrote this brief. */
  writer: string;
  /** True once the operator has published it; `url` is then its public page. */
  published: boolean;
  url: string | null;
  publishUrl: string;
  downloadUrl: string;
}

export interface ResearchStatus {
  terminal: boolean;
  warn: boolean;
  action?: ResearchAction;
  /** 'single' or 'sectioned' (migration 0062); absent on a run from before. */
  mode?: string | null;
  /**
   * The sectioned brief's plan, once the outline exists: every heading, with
   * the ones written ticked. Like `plan`, it is the run taking shape and is
   * shown as it fills in.
   */
  outline?: ResearchOutlineItem[];
  /** How many sections have landed, and how many the outline planned. */
  sectionsDone?: number;
  sectionsTotal?: number;
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
  /** Every source read, newest first — including the ones rejected. */
  sources?: ResearchSource[];
  /**
   * No longer produced. Fetched pages are sources, not documents, and are
   * not digested into the graph, so a run adds no verbatim facts. Left on
   * the shape (always absent) so the renderers compile; they should drop
   * the metric.
   */
  facts?: number;
  /** ISO timestamp the run started, so the screen can show elapsed time. */
  startedAt?: string;
  /** Which model is writing this run: 'anthropic', 'workers_ai', or null for the default. */
  writer?: string | null;
  /** The finished draft, once there is one. */
  draft?: { title: string; slug: string; reviewUrl: string };
  /** The finished brief, read in full, with its counts and its two actions.
   *  Present only on a done run whose piece still exists. */
  review?: ResearchReview;
  headline: string;
  steps: ResearchStep[];
  reviewUrl?: string;
}

/** The heading assembleBrief() writes the gaps under. Split out of the body
 *  for the review so the operator sees what the brief admits it could not
 *  establish before deciding to publish it. */
const GAPS_HEADING = "## What this brief could not establish";

/** Split the assembled body into the prose and its gaps block. A single-call
 *  brief, or one the writer left without a gaps block, has null gaps and the
 *  whole body as prose. */
export function splitGaps(bodyMd: string): { bodyMd: string; gapsMd: string | null } {
  const at = bodyMd.indexOf(`\n${GAPS_HEADING}`);
  if (at < 0) return { bodyMd, gapsMd: null };
  const rest = bodyMd.slice(at + 1);
  // The gaps block runs to the next "## " heading or the end of the body.
  const next = rest.indexOf("\n## ", GAPS_HEADING.length);
  const gaps = next < 0 ? rest : rest.slice(0, next);
  const body = `${bodyMd.slice(0, at)}${next < 0 ? "" : rest.slice(next)}`;
  return {
    bodyMd: body.trim(),
    gapsMd: gaps.slice(GAPS_HEADING.length).trim() || null,
  };
}

/** Which model wrote a run, in words. resolveWriter throws when a run asked
 *  for Claude and cannot have it — that run never wrote anything, so a name
 *  by request is the honest fallback here, never a guess at a model id. */
export function writerName(env: Env, writer: string | null): string {
  try {
    const w = resolveWriter(env, writer);
    return w.model;
  } catch {
    return writer === "anthropic"
      ? "Claude"
      : writer === "workers_ai"
        ? "Workers AI"
        : "the default writer";
  }
}

/**
 * The finished brief, read from its `pieces` row — plus the parent document
 * it grew from and the per-section receipt the run kept in `sections_done`.
 * Null when the piece is gone (discarded), so the status says "draft ready"
 * with nothing under it rather than inventing one.
 */
export async function loadResearchReview(
  env: Env,
  userId: string,
  args: {
    pieceId: string;
    label: string;
    mode: string | null;
    sections: DoneSection[];
    writer: string | null;
  },
): Promise<ResearchReview | null> {
  const piece = await one<{
    id: string;
    slug: string;
    title: string;
    body_md: string | null;
    publication_status: string;
    parent_piece_id: string | null;
    origin: string | null;
    metadata: string | null;
  }>(
    env.DB,
    `SELECT id, slug, title, body_md, publication_status, parent_piece_id, origin, metadata
       FROM pieces WHERE id = ? AND user_id = ?`,
    [args.pieceId, userId],
  );
  if (!piece) return null;
  const parent = piece.parent_piece_id
    ? await one<{ id: string; slug: string; title: string }>(
        env.DB,
        "SELECT id, slug, title FROM pieces WHERE id = ? AND user_id = ?",
        [piece.parent_piece_id, userId],
      ).catch(() => null)
    : null;
  const meta = (safeParseJson(piece.metadata ?? "{}") ?? {}) as {
    mode?: string;
    quotes_ok?: number;
    quotes_killed?: number;
  };
  const mode: ResearchMode = (meta.mode ?? args.mode) === "sectioned" ? "sectioned" : "single";
  const sections: ResearchReviewSection[] =
    mode === "sectioned"
      ? args.sections.map((x) => ({
          heading: x.heading,
          bodyMd: x.body_md,
          quotesOk: x.quotes_ok,
          quotesKilled: x.quotes_killed,
        }))
      : [];
  const quotesOk =
    typeof meta.quotes_ok === "number"
      ? meta.quotes_ok
      : sections.reduce((n, x) => n + x.quotesOk, 0);
  const quotesKilled =
    typeof meta.quotes_killed === "number"
      ? meta.quotes_killed
      : sections.reduce((n, x) => n + x.quotesKilled, 0);
  const split = splitGaps(piece.body_md ?? "");
  const published = piece.publication_status === "published";
  return {
    pieceId: piece.id,
    slug: piece.slug,
    title: piece.title,
    question: piece.origin || args.label,
    parent: parent ?? null,
    mode,
    sections,
    bodyMd: split.bodyMd,
    gapsMd: split.gapsMd,
    quotesOk,
    quotesKilled,
    writer: writerName(env, args.writer),
    published,
    url: published ? `/p/${piece.slug}` : null,
    publishUrl: `/op/library/research/${piece.id}/publish`,
    downloadUrl: `/op/library/research/${piece.id}/brief.md`,
  };
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
    mode: string | null;
    outline: string | null;
    sections_done: string | null;
  }>(
    env.DB,
    `SELECT id, status, final_piece_id, error, followup_queries, followups_done, created_at, writer,
            mode, outline, sections_done
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
    const p = safeParseJson(e.payload) as {
      url?: string;
      title?: string;
      chars?: number;
      reason?: string;
    } | null;
    const url = typeof p?.url === "string" ? p.url : "";
    if (!url || seenUrls.has(url)) continue;
    const state =
      e.event_type === "record.expand.source_banked"
        ? "banked"
        : e.event_type === "record.expand.source_duplicate"
          ? "duplicate"
          : e.event_type === "record.expand.source_rejected"
            ? "rejected"
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
      ...(state === "rejected" && typeof p?.reason === "string" ? { reason: p.reason } : {}),
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
  const rejectedCount = events.filter(
    (e) => e.event_type === "record.expand.source_rejected",
  ).length;
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
      ? `${bankedCount} banked${rejectedCount > 0 ? `, ${rejectedCount} rejected` : ""}${
          fetchingCount > bankedCount + rejectedCount ? `, fetching ${fetchingCount}` : ""
        }`
      : undefined,
  });
  // There is no extraction step any more: a banked page is a source for the
  // writer, not a document, and nothing is digested from it (record-builder.ts
  // header). "completed" from the expand is the end of the banking phase.
  const bankingDone = expand.terminal;

  // The phase getExpandStatus has zero visibility into — only relevant
  // once expand itself has actually finished, and only for callers that
  // actually run a synthesis step afterward (plain "Expand this file" —
  // record-builder.ts's expandRecord with no researchOnDemand wrapper —
  // never will; no research_runs row for its label would ever exist).
  if (bankingDone && includeSynthesis) {
    const runRow = run;

    // Every waiting state below is terminal for the POLLER — it will not
    // change on its own — and carries the press that moves it. The banner
    // advances automatically while the tab is open, so in practice the
    // operator presses once; the button is what it falls back to.
    //
    // `material` is attached to every return rather than to some of them: a
    // source list that vanished the moment the run finished would be the
    // worst possible time to lose it.
    // The sectioned brief's checklist. Present only once an outline exists;
    // a single-mode run never has one and the panel stays hidden.
    const outlinePlan = parseOutline(run?.outline ?? null);
    const sectionsDone = parseSections(run?.sections_done ?? null);
    const outline: ResearchOutlineItem[] = outlinePlan.map((o, i) => {
      const landed = sectionsDone[i];
      return landed
        ? {
            heading: o.heading,
            state: "done",
            quotesOk: landed.quotes_ok,
            quotesKilled: landed.quotes_killed,
          }
        : { heading: o.heading, state: "queued" };
    });
    const material = {
      plan,
      sources,
      ...(run ? { startedAt: run.created_at, writer: run.writer, mode: run.mode ?? null } : {}),
      ...(outline.length > 0
        ? { outline, sectionsDone: sectionsDone.length, sectionsTotal: outline.length }
        : {}),
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

    if (runRow.status === "outline_pending") {
      steps.push({ label: "Write a synthesis", state: "done", detail: "first pass done" });
      steps.push({ label: "Dig deeper", state: "done", detail: "follow-up sources banked" });
      steps.push({
        label: "Outline the brief",
        state: "pending",
        detail: "every source read whole — needs a press",
      });
      return {
        terminal: true,
        warn: false,
        headline: "Everything is banked. Next: outline the brief from every source.",
        steps,
        action: advance("Outline the brief"),
        ...material,
      };
    }

    if (runRow.status === "section_pending") {
      const n = sectionsDone.length;
      const total = outline.length;
      steps.push({ label: "Write a synthesis", state: "done", detail: "first pass done" });
      steps.push({ label: "Dig deeper", state: "done", detail: "follow-up sources banked" });
      steps.push({ label: "Outline the brief", state: "done", detail: `${total} sections` });
      steps.push({
        label: `Write the sections (${n} of ${total} written)`,
        state: "pending",
        detail: "one per press",
      });
      const next = outline[n]?.heading ?? "the next section";
      return {
        terminal: true,
        warn: false,
        headline: `Writing · ${n} of ${total} sections. Next: ${next}.`,
        steps,
        // A distinct label per section: the live layer will not press the
        // same labelled action twice, which is right for every other state.
        action: advance(`Write section ${n + 1} of ${total}`),
        ...material,
      };
    }

    if (runRow.status === "assemble_pending") {
      steps.push({ label: "Write a synthesis", state: "done", detail: "first pass done" });
      steps.push({ label: "Dig deeper", state: "done", detail: "follow-up sources banked" });
      steps.push({ label: "Outline the brief", state: "done" });
      steps.push({
        label: "Write the sections",
        state: "done",
        detail: `${sectionsDone.length} written`,
      });
      steps.push({
        label: "Assemble the brief",
        state: "pending",
        detail: "summary and gaps — needs a press",
      });
      return {
        terminal: true,
        warn: false,
        headline: "Every section is written. One step left: assemble the brief.",
        steps,
        action: advance("Assemble the brief"),
        ...material,
      };
    }

    if (runRow.status === "done" && runRow.final_piece_id) {
      steps.push({ label: "Write a synthesis", state: "done", detail: "draft ready" });
      const review = await loadResearchReview(env, userId, {
        pieceId: runRow.final_piece_id,
        label,
        mode: runRow.mode ?? null,
        sections: sectionsDone,
        writer: runRow.writer ?? null,
      }).catch(() => null);
      return {
        terminal: true,
        warn: false,
        headline: review?.published
          ? "Published. This brief is in the record."
          : "Draft brief ready — read it below, then publish it or take the file.",
        steps,
        reviewUrl: `/op/library/research/${runRow.final_piece_id}/review`,
        ...(review ? { review } : {}),
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
          sources_rejected: 0,
          errors: [`expand timed out after ${EXPAND_BUDGET_MS}ms`],
          rejected: [],
          banked_source_ids: [],
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

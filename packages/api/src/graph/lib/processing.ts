// THE PIPELINE — what happens to a document after upload, as one state
// machine with one status per row (docs/the-record.md §4).
//
//   title → digest(i/n) → findings → passage → section → done
//
// One step per request. `advanceProcessing()` does exactly one step for one
// document and returns; the library page's poller presses it again while the
// tab is open, and "Process everything" queues the whole corpus for the same
// poller. Nothing here schedules anything (standing rule 4): close the tab
// and it stops; open it and it resumes from the row's checkpoint.
//
// Why one step per request: a Worker execution is short, and the previous
// design ran digestion in the background of the upload request (`waitUntil`)
// where it got two chunks in before re-queuing itself for a cron that is off.
// A request that does one bounded piece of work and records where it got to
// cannot strand a document half-read.
//
// Every step is a model call frozen into rows (rule 5) or a query. Upload is
// authorization for all of it (rule 2): the lead passage is a verbatim span
// of a document the operator already published, located by code, so it goes
// live without a second click; a working title is replaced from the
// document's own words with the original kept and a one-click revert.

import type { Env } from "../../env";
import { WEB_FETCHED_SQL } from "../../lib/corpus-guards";
import { all, one, run } from "../../lib/d1";
import { looksLikeMachineFilename, looksLikeWorkingTitle } from "../../lib/title";
import { titleCandidates } from "../../lib/title-candidates";
import { gatewayConfigured, modelForRole } from "../../llm/router";
import { extractAeoAtoms } from "./aeo-extract";
import { digest } from "./digestion";
import { readFullExtractedText } from "./extract";
import { approveLede, proposeLede } from "./lede";
import { assignTopic } from "./topics";

export type ProcessingStep = "title" | "digest" | "findings" | "passage" | "section" | "done";
export type ProcessingStatus = "queued" | "running" | "done" | "failed";

export const STEP_ORDER: ProcessingStep[] = [
  "title",
  "digest",
  "findings",
  "passage",
  "section",
  "done",
];

/** Plain words for each step, for the row and the poller. */
export const STEP_LABEL: Record<ProcessingStep, string> = {
  title: "titling",
  digest: "reading",
  findings: "finding figures",
  passage: "choosing the passage",
  section: "filing",
  done: "done",
};

export interface ProcessingRow {
  piece_id: string;
  user_id: string;
  status: ProcessingStatus;
  step: ProcessingStep;
  chunks_done: number;
  chunk_count: number;
  error: string | null;
  model: string | null;
  attempts: number;
  heartbeat_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

/** What one press of "advance" did. The poller renders this. */
export interface AdvanceResult {
  piece_id: string | null;
  /** The row after the step (null when nothing was waiting). */
  row: ProcessingRow | null;
  /** How many rows are still queued or running after this step. */
  remaining: number;
  /** A one-line, human-readable account of the step, for the row. */
  note: string;
}

// A running row whose heartbeat is older than this is treated as dead (the
// request that owned it did not return) and may be picked up again.
const STALE_MS = 3 * 60_000;
// A step that throws is retried this many times before the row is failed.
// Deterministic failures (no text, hollow extraction) fail on the first.
const MAX_ATTEMPTS = 3;

// Digestion's per-request budget. With Claude through the gateway a chunk is
// one long call, so a step is one chunk and can take most of a minute; with
// Workers AI the chunks are small and two run per wave inside 20 seconds, as
// before. Both fit inside a single attended request.
const CLAUDE_CHUNK_CHARS = 24_000;
const CLAUDE_SOFT_BUDGET_MS = 60_000;
const CLAUDE_CHUNK_CONCURRENCY = 1;

export async function ensureProcessingTable(env: Env): Promise<void> {
  // Migration 0060 creates this on deploy; the fixture and tests do not run
  // migrations, so create-if-missing here too, as digest-jobs.ts does.
  await run(
    env.DB,
    `CREATE TABLE IF NOT EXISTS piece_processing (
      piece_id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued', step TEXT NOT NULL DEFAULT 'title',
      chunks_done INTEGER NOT NULL DEFAULT 0, chunk_count INTEGER NOT NULL DEFAULT 0,
      error TEXT, model TEXT, attempts INTEGER NOT NULL DEFAULT 0,
      heartbeat_at TEXT, started_at TEXT, finished_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
    [],
  ).catch(() => {});
}

/** Queue one document from the first step. Idempotent: a queued or running
 *  row is left alone; a done or failed one is restarted. */
export async function enqueueProcessing(
  env: Env,
  userId: string,
  pieceId: string,
  opts: { restart?: boolean } = {},
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await one<ProcessingRow>(
    env.DB,
    "SELECT * FROM piece_processing WHERE piece_id = ? AND user_id = ?",
    [pieceId, userId],
  );
  if (!existing) {
    await run(
      env.DB,
      `INSERT INTO piece_processing (piece_id, user_id, status, step, updated_at)
       VALUES (?, ?, 'queued', 'title', ?)`,
      [pieceId, userId, now],
    );
    return;
  }
  const inFlight = existing.status === "queued" || existing.status === "running";
  if (inFlight && !opts.restart) return;
  await run(
    env.DB,
    `UPDATE piece_processing
        SET status='queued', step='title', chunks_done=0, chunk_count=0, error=NULL,
            attempts=0, heartbeat_at=NULL, started_at=NULL, finished_at=NULL, updated_at=?
      WHERE piece_id = ? AND user_id = ?`,
    [now, pieceId, userId],
  );
}

/** Retry a failed row from the step it failed at. */
export async function retryProcessing(env: Env, userId: string, pieceId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const r = await run(
    env.DB,
    `UPDATE piece_processing
        SET status='queued', error=NULL, attempts=0, heartbeat_at=NULL, updated_at=?
      WHERE piece_id = ? AND user_id = ? AND status = 'failed'`,
    [now, pieceId, userId],
  );
  return Boolean(r.meta.changes);
}

/**
 * Queue every document that has never been processed to completion. Own
 * uploads and published research briefs only — never anything web-fetched,
 * which the corpus guard excludes, and never an unpublished draft, which has
 * no page to process for.
 */
export async function enqueueEverything(env: Env, userId: string): Promise<number> {
  const rows = await all<{ id: string }>(
    env.DB,
    `SELECT p.id FROM pieces p
      WHERE p.user_id = ?
        AND p.publication_status IN ('published','canonical')
        AND NOT ${WEB_FETCHED_SQL}
        AND NOT EXISTS (
          SELECT 1 FROM piece_processing x
           WHERE x.piece_id = p.id AND x.status IN ('queued','running','done'))
      ORDER BY COALESCE(p.published_at, p.created_at) DESC`,
    [userId],
  );
  for (const r of rows) await enqueueProcessing(env, userId, r.id, { restart: true });
  return rows.length;
}

export async function processingRows(
  env: Env,
  userId: string,
): Promise<Map<string, ProcessingRow>> {
  const rows = await all<ProcessingRow>(
    env.DB,
    "SELECT * FROM piece_processing WHERE user_id = ?",
    [userId],
  ).catch(() => [] as ProcessingRow[]);
  return new Map(rows.map((r) => [r.piece_id, r]));
}

export async function processingCounts(
  env: Env,
  userId: string,
): Promise<{ queued: number; running: number; failed: number; done: number; unprocessed: number }> {
  const c = await one<{ queued: number; running: number; failed: number; done: number }>(
    env.DB,
    `SELECT
       SUM(CASE WHEN status='queued' THEN 1 ELSE 0 END) AS queued,
       SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) AS running,
       SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
       SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) AS done
     FROM piece_processing WHERE user_id = ?`,
    [userId],
  ).catch(() => null);
  const u = await one<{ n: number }>(
    env.DB,
    `SELECT COUNT(*) AS n FROM pieces p
      WHERE p.user_id = ? AND p.publication_status IN ('published','canonical')
        AND NOT ${WEB_FETCHED_SQL}
        AND NOT EXISTS (
          SELECT 1 FROM piece_processing x
           WHERE x.piece_id = p.id AND x.status IN ('queued','running','done'))`,
    [userId],
  ).catch(() => null);
  return {
    queued: c?.queued ?? 0,
    running: c?.running ?? 0,
    failed: c?.failed ?? 0,
    done: c?.done ?? 0,
    unprocessed: u?.n ?? 0,
  };
}

/** One line for a row: "Processing 3/7 · reading", "Processed", "Failed at
 *  finding figures: …". The row and the poller both use this. */
export function describeProcessing(r: ProcessingRow | undefined): {
  state: "none" | "queued" | "running" | "done" | "failed";
  text: string;
} {
  if (!r) return { state: "none", text: "Not processed" };
  const idx = STEP_ORDER.indexOf(r.step);
  const total = STEP_ORDER.length - 1; // "done" is not a step you are at
  if (r.status === "done") return { state: "done", text: "Processed" };
  if (r.status === "failed") {
    return {
      state: "failed",
      text: `Failed at ${STEP_LABEL[r.step]}${r.error ? `: ${r.error}` : ""}`,
    };
  }
  const chunk =
    r.step === "digest" && r.chunk_count > 0 ? ` (${r.chunks_done}/${r.chunk_count})` : "";
  const state = r.status === "running" ? "running" : "queued";
  return {
    state,
    text: `${r.status === "running" ? "Processing" : "Queued"} ${idx + 1}/${total} · ${STEP_LABEL[r.step]}${chunk}`,
  };
}

/**
 * Do ONE step for ONE document and return. Picks the given piece, else the
 * oldest queued row, else a running row whose owner died. Returns
 * `piece_id: null` when nothing is waiting.
 */
export async function advanceProcessing(
  env: Env,
  userId: string,
  pieceId?: string,
): Promise<AdvanceResult> {
  await ensureProcessingTable(env);
  const now = new Date().toISOString();
  const stale = new Date(Date.now() - STALE_MS).toISOString();

  const candidate = pieceId
    ? await one<ProcessingRow>(
        env.DB,
        `SELECT * FROM piece_processing WHERE user_id = ? AND piece_id = ?
            AND (status = 'queued' OR (status = 'running' AND (heartbeat_at IS NULL OR heartbeat_at < ?)))`,
        [userId, pieceId, stale],
      )
    : await one<ProcessingRow>(
        env.DB,
        `SELECT * FROM piece_processing WHERE user_id = ?
            AND (status = 'queued' OR (status = 'running' AND (heartbeat_at IS NULL OR heartbeat_at < ?)))
          ORDER BY CASE status WHEN 'running' THEN 0 ELSE 1 END, updated_at ASC LIMIT 1`,
        [userId, stale],
      );
  if (!candidate) {
    return { piece_id: null, row: null, remaining: await remaining(env, userId), note: "" };
  }

  // Claim atomically: the WHERE repeats the pick so two overlapping presses
  // cannot both run the same step (the same shape digest-jobs.ts uses).
  const claim = await run(
    env.DB,
    `UPDATE piece_processing
        SET status='running', heartbeat_at=?, started_at=COALESCE(started_at, ?), updated_at=?
      WHERE piece_id = ? AND user_id = ?
        AND (status = 'queued' OR (status = 'running' AND (heartbeat_at IS NULL OR heartbeat_at < ?)))`,
    [now, now, now, candidate.piece_id, userId, stale],
  );
  if (!claim.meta.changes) {
    return { piece_id: null, row: null, remaining: await remaining(env, userId), note: "" };
  }

  const model = modelForRole("bulk_extraction", env).model;
  let note = "";
  try {
    switch (candidate.step) {
      case "title":
        note = await stepTitle(env, userId, candidate.piece_id);
        await moveTo(env, candidate, "digest", model);
        break;
      case "digest": {
        const d = await stepDigest(env, userId, candidate);
        note = d.note;
        if (d.more) {
          await run(
            env.DB,
            `UPDATE piece_processing SET status='queued', chunks_done=?, chunk_count=?, model=?, updated_at=?
              WHERE piece_id = ? AND user_id = ?`,
            [d.done, d.count, model, new Date().toISOString(), candidate.piece_id, userId],
          );
        } else if (d.failed) {
          await fail(env, candidate, d.failed, true);
        } else {
          await run(
            env.DB,
            "UPDATE piece_processing SET chunks_done=?, chunk_count=? WHERE piece_id = ? AND user_id = ?",
            [d.done, d.count, candidate.piece_id, userId],
          );
          await moveTo(env, candidate, "findings", model);
        }
        break;
      }
      case "findings": {
        const s = await extractAeoAtoms(env, userId, candidate.piece_id);
        note = `${s.findings} figure${s.findings === 1 ? "" : "s"}, ${s.questions_new + s.questions_merged} question${s.questions_new + s.questions_merged === 1 ? "" : "s"}${s.killed ? `, ${s.killed} span${s.killed === 1 ? "" : "s"} discarded` : ""}`;
        await moveTo(env, candidate, "passage", s.model);
        break;
      }
      case "passage": {
        const l = await proposeLede(env, userId, candidate.piece_id);
        if (l.ok) {
          await approveLede(env, userId, candidate.piece_id);
          note = "lead passage chosen";
        } else {
          // Not a failure of the document: "no passage" is an honest answer
          // the page renders by leaving the block out.
          note = `no lead passage — ${l.reason ?? "none found"}`;
        }
        await moveTo(env, candidate, "section", model);
        break;
      }
      case "section": {
        const t = await assignTopic(env, userId, candidate.piece_id);
        note = t.topic ? `filed under ${t.topic}` : "filed under Everything else";
        await run(
          env.DB,
          `UPDATE piece_processing
              SET status='done', step='done', error=NULL, finished_at=?, heartbeat_at=NULL, updated_at=?
            WHERE piece_id = ? AND user_id = ?`,
          [new Date().toISOString(), new Date().toISOString(), candidate.piece_id, userId],
        );
        break;
      }
      case "done":
        await run(
          env.DB,
          "UPDATE piece_processing SET status='done', heartbeat_at=NULL, updated_at=? WHERE piece_id = ? AND user_id = ?",
          [new Date().toISOString(), candidate.piece_id, userId],
        );
        break;
    }
  } catch (err) {
    const message = (err as Error).message ?? "unknown error";
    await fail(env, candidate, message, false);
    note = message;
  }

  const row = await one<ProcessingRow>(
    env.DB,
    "SELECT * FROM piece_processing WHERE piece_id = ? AND user_id = ?",
    [candidate.piece_id, userId],
  );
  return { piece_id: candidate.piece_id, row, remaining: await remaining(env, userId), note };
}

async function remaining(env: Env, userId: string): Promise<number> {
  const r = await one<{ n: number }>(
    env.DB,
    "SELECT COUNT(*) AS n FROM piece_processing WHERE user_id = ? AND status IN ('queued','running')",
    [userId],
  );
  return r?.n ?? 0;
}

async function moveTo(env: Env, row: ProcessingRow, step: ProcessingStep, model: string) {
  const now = new Date().toISOString();
  await run(
    env.DB,
    `UPDATE piece_processing
        SET status='queued', step=?, error=NULL, attempts=0, model=?, heartbeat_at=NULL, updated_at=?
      WHERE piece_id = ? AND user_id = ?`,
    [step, model, now, row.piece_id, row.user_id],
  );
}

async function fail(env: Env, row: ProcessingRow, reason: string, deterministic: boolean) {
  const attempts = row.attempts + 1;
  const giveUp = deterministic || attempts >= MAX_ATTEMPTS;
  const now = new Date().toISOString();
  await run(
    env.DB,
    `UPDATE piece_processing
        SET status=?, error=?, attempts=?, heartbeat_at=NULL, updated_at=?
      WHERE piece_id = ? AND user_id = ?`,
    [giveUp ? "failed" : "queued", reason, attempts, now, row.piece_id, row.user_id],
  );
}

// ---- the steps -------------------------------------------------------------

/**
 * A filename or a working title ("PASS 7-MINI — HARDENING DOSSIER") is replaced
 * by the best candidate lifted verbatim from the document. A real title is
 * never touched; a title a person already chose (title_approved_at) is never
 * touched; the original is kept and title_auto_at marks the machine's choice
 * so the row can offer a revert. The slug never changes.
 */
async function stepTitle(env: Env, userId: string, pieceId: string): Promise<string> {
  const p = await one<{
    title: string;
    body_md: string | null;
    title_approved_at: string | null;
  }>(env.DB, "SELECT title, body_md, title_approved_at FROM pieces WHERE id = ? AND user_id = ?", [
    pieceId,
    userId,
  ]);
  if (!p) throw new Error("piece not found");
  if (p.title_approved_at) return "title kept (chosen by you)";
  const weak = looksLikeMachineFilename(p.title) || looksLikeWorkingTitle(p.title);
  if (!weak) return "title kept";
  const [best] = titleCandidates(p.body_md ?? "");
  if (!best) return "working title kept — the document offers no better one";
  const now = new Date().toISOString();
  await run(
    env.DB,
    `UPDATE pieces
        SET original_title = COALESCE(original_title, title), title = ?, title_auto_at = ?, updated_at = ?
      WHERE id = ? AND user_id = ?`,
    [best, now, now, pieceId, userId],
  );
  return `retitled from the document's own words: "${best}"`;
}

async function stepDigest(
  env: Env,
  userId: string,
  row: ProcessingRow,
): Promise<{ note: string; more: boolean; done: number; count: number; failed?: string }> {
  const p = await one<{ slug: string; title: string; metadata: string | null }>(
    env.DB,
    "SELECT slug, title, metadata FROM pieces WHERE id = ? AND user_id = ?",
    [row.piece_id, userId],
  );
  if (!p) throw new Error("piece not found");
  let sourceId: string | undefined;
  try {
    sourceId = (JSON.parse(p.metadata ?? "{}") as { source_id?: string }).source_id;
  } catch {
    sourceId = undefined;
  }
  if (!sourceId)
    return { note: "", more: false, done: 0, count: 0, failed: "no stored source text" };
  const full = await readFullExtractedText(env, sourceId, userId);
  if (!full.text) return { note: "", more: false, done: 0, count: 0, failed: "source has no text" };

  const claude = gatewayConfigured(env);
  const result = await digest(
    env,
    {
      userId,
      pieceId: row.piece_id,
      pieceSlug: p.slug,
      title: full.title || p.title,
      body_md: full.text,
      sourceId,
    },
    {
      startChunk: row.chunks_done,
      ...(claude
        ? {
            chunkChars: CLAUDE_CHUNK_CHARS,
            chunkConcurrency: CLAUDE_CHUNK_CONCURRENCY,
            softBudgetMs: CLAUDE_SOFT_BUDGET_MS,
          }
        : {}),
      onProgress: async (chunksDone, chunkCount) => {
        const ts = new Date().toISOString();
        await run(
          env.DB,
          "UPDATE piece_processing SET chunks_done=?, chunk_count=?, heartbeat_at=?, updated_at=? WHERE piece_id = ? AND user_id = ?",
          [chunksDone, chunkCount, ts, ts, row.piece_id, userId],
        );
      },
    },
  );
  const count = result.chunk_count ?? 0;
  const done = result.chunks_done ?? row.chunks_done;
  if (result.more_chunks)
    return { note: `read ${done} of ${count} parts`, more: true, done, count };
  if (result.failed_step) {
    return {
      note: "",
      more: false,
      done,
      count,
      failed: result.failed_reason ?? "extraction failed",
    };
  }
  return {
    note: `${result.quotes_created ?? 0} verified quotes, ${result.nodes_created ?? 0} facts`,
    more: false,
    done,
    count,
  };
}

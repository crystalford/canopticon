// Durable digest-job queue — the safety net under document ingest.
//
// Uploads enqueue here AND fire runDigestJob() inline via waitUntil for
// instant feedback. A once-a-minute cron drain re-runs anything still queued
// or stalled (heartbeat older than ~2 min = the previous waitUntil run was
// killed by Cloudflare's wall-clock limit). Bounded retries; idempotent —
// retries clear the piece's prior claims before re-persisting so the graph
// never double-counts.
//
// Status machine: queued -> running -> (completed | failed)

import type { Env } from "../../env";
import { all, insertOne, one, run } from "../../lib/d1";
import { digest } from "./digestion";
import { readFullExtractedText } from "./extract";
import { runSurfacingL1 } from "./surfacing";

// Heartbeat staler than this = a running job whose Worker died mid-run.
const STALE_MS = 2 * 60 * 1000;
// Retry budget cut from 5 → 3. The cron drain was happily re-running
// deterministically-broken jobs to exhaustion (5x of "failed on every chunk"
// is just five copies of the same failure). 3 is enough headroom for one
// transient + one self-recovery, then dead-letter.
const MAX_ATTEMPTS = 3;

// digest_jobs is also created by migration 0025; this guard makes the runtime
// resilient to a missed/skipped migration step on first deploy.
export async function ensureJobsTable(env: Env): Promise<void> {
  try {
    await run(
      env.DB,
      `CREATE TABLE IF NOT EXISTS digest_jobs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        piece_id TEXT NOT NULL,
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        source_id TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        step TEXT NOT NULL DEFAULT 'queued',
        claims_count INTEGER NOT NULL DEFAULT 0,
        attempts INTEGER NOT NULL DEFAULT 0,
        chunks_done INTEGER NOT NULL DEFAULT 0,
        chunk_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        heartbeat_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )`,
    );
    // Older databases created before migration 0028 won't have the resumable
    // columns; add them best-effort so the runtime guard matches the schema.
    await run(
      env.DB,
      "ALTER TABLE digest_jobs ADD COLUMN chunks_done INTEGER NOT NULL DEFAULT 0",
    ).catch(() => {});
    await run(
      env.DB,
      "ALTER TABLE digest_jobs ADD COLUMN chunk_count INTEGER NOT NULL DEFAULT 0",
    ).catch(() => {});
    await run(
      env.DB,
      "CREATE INDEX IF NOT EXISTS digest_jobs_user_status_idx ON digest_jobs (user_id, status, created_at)",
    );
    await run(env.DB, "CREATE INDEX IF NOT EXISTS digest_jobs_piece_idx ON digest_jobs (piece_id)");
  } catch {
    // best-effort; the migration is the source of truth
  }
}

export interface EnqueueArgs {
  userId: string;
  pieceId: string;
  slug: string;
  title: string;
  sourceId: string | undefined;
}

// Idempotent enqueue. If this piece already has a `completed` digest job,
// return that job's id without queuing a new one — clicking Extract on an
// already-extracted doc should be a free no-op. (Re-running on `failed` or
// brand-new pieces still enqueues; runDigestJob is itself idempotent on
// claim re-writes when the cron retries a stalled job.)
export async function enqueueDigest(env: Env, args: EnqueueArgs): Promise<string> {
  const existing = await one<{ id: string }>(
    env.DB,
    `SELECT id FROM digest_jobs
       WHERE user_id = ? AND piece_id = ? AND status = 'completed'
       ORDER BY created_at DESC LIMIT 1`,
    [args.userId, args.pieceId],
  );
  if (existing) return existing.id;
  return insertOne(env.DB, "digest_jobs", {
    user_id: args.userId,
    piece_id: args.pieceId,
    slug: args.slug,
    title: args.title,
    source_id: args.sourceId ?? null,
    status: "queued",
    step: "queued",
  });
}

interface JobRow {
  id: string;
  user_id: string;
  piece_id: string;
  slug: string;
  title: string;
  source_id: string | null;
  status: string;
  attempts: number;
  chunks_done: number;
}

// Run one job for one tick. Resumable: extraction processes chunks starting
// from chunks_done and pauses at a soft time budget, checkpointing progress so
// a slow document finishes over multiple cron ticks with no lost work.
// `attempts` counts only FAILED ticks — a tick that makes forward progress
// resets it, so a long-but-healthy document never exhausts the retry budget.
export async function runDigestJob(env: Env, jobId: string): Promise<void> {
  const job = await one<JobRow>(
    env.DB,
    "SELECT id, user_id, piece_id, slug, title, source_id, status, attempts, chunks_done FROM digest_jobs WHERE id = ?",
    [jobId],
  );
  if (!job) return;
  if (job.status === "completed") return;

  // Claim the job (no attempt increment here — that only counts failures).
  const nowIso = new Date().toISOString();
  await run(
    env.DB,
    "UPDATE digest_jobs SET status='running', step='digesting', heartbeat_at=?, updated_at=? WHERE id=?",
    [nowIso, nowIso, jobId],
  );

  try {
    // First tick only: clear legacy flat claims for the piece. Typed-graph
    // rows are purged inside digest() on chunk 0. On a resume tick we must NOT
    // re-purge — that would wipe the chunks we already persisted.
    if (job.chunks_done === 0) {
      await run(env.DB, "DELETE FROM claims WHERE user_id = ? AND asserted_in_piece_id = ?", [
        job.user_id,
        job.piece_id,
      ]);
    }

    // Pull the full text (inline head + R2 overflow) for digestion.
    if (!job.source_id) {
      throw new Error("job has no source_id; cannot read extracted text");
    }
    const full = await readFullExtractedText(env, job.source_id, job.user_id);
    if (!full.text) throw new Error("source has no extracted text");

    const result = await digest(
      env,
      {
        userId: job.user_id,
        pieceId: job.piece_id,
        pieceSlug: job.slug,
        title: full.title || job.title,
        body_md: full.text,
        sourceId: job.source_id,
      },
      {
        startChunk: job.chunks_done,
        // Checkpoint chunks_done + node count + heartbeat after every chunk so
        // a mid-tick crash resumes cleanly and the cron never sees us as stale
        // while we're actually working.
        onProgress: async (chunksDone, chunkCount, nodeCount) => {
          const ts = new Date().toISOString();
          await run(
            env.DB,
            `UPDATE digest_jobs
                SET chunks_done=?, chunk_count=?, claims_count=?, step=?, heartbeat_at=?, updated_at=?
              WHERE id=?`,
            [chunksDone, chunkCount, nodeCount, `chunk ${chunksDone}/${chunkCount}`, ts, ts, jobId],
          );
        },
      },
    );

    const finishedIso = new Date().toISOString();

    // Paused with more chunks remaining → re-queue for the next tick. This is
    // progress, not a failure: reset attempts so a long doc can't dead-letter.
    if (result.more_chunks) {
      await run(
        env.DB,
        `UPDATE digest_jobs
            SET status='queued', step=?, attempts=0, heartbeat_at=?, updated_at=?
          WHERE id=?`,
        [`chunk ${result.chunks_done}/${result.chunk_count}`, finishedIso, finishedIso, jobId],
      );
      return;
    }

    const failed = !!result.failed_step;
    const reason = result.failed_reason ?? "";
    // Deterministic failures won't recover on retry — short-circuit to failed.
    const deterministic =
      reason.includes("failed on every chunk") ||
      reason.includes("no extracted text") ||
      reason.includes("hollow extraction");
    const willGiveUp = failed && (deterministic || job.attempts + 1 >= MAX_ATTEMPTS);
    await run(
      env.DB,
      `UPDATE digest_jobs
          SET status=?, step=?, claims_count=?, attempts=?, last_error=?, heartbeat_at=?, updated_at=?
        WHERE id=?`,
      [
        failed ? (willGiveUp ? "failed" : "queued") : "completed",
        failed ? (result.failed_step ?? "failed") : "completed",
        result.nodes_created ?? 0,
        failed ? job.attempts + 1 : job.attempts,
        failed ? reason || "unknown" : null,
        finishedIso,
        finishedIso,
        jobId,
      ],
    );
    if (willGiveUp) {
      await emitJobEvent(env, job, "feed.digest.dead_letter", {
        reason: reason || "unknown",
        attempts: job.attempts + 1,
        deterministic,
      });
    }
    // Surfacing Engine L1 + the proposer run when the CORPUS SETTLES — i.e.
    // this was the last queued/running job. During a 50-document bulk
    // extraction, re-running them after every single doc would churn the
    // proposal queue 50 times; waiting for the last job means the proposals
    // the operator finds reflect the WHOLE corpus (prime directive: the work
    // is already done when they look). Both best-effort.
    if (!failed) {
      const remaining = await one<{ n: number }>(
        env.DB,
        "SELECT COUNT(*) AS n FROM digest_jobs WHERE user_id = ? AND status IN ('queued','running') AND id != ?",
        [job.user_id, jobId],
      );
      if ((remaining?.n ?? 0) === 0) {
        try {
          await runSurfacingL1(env, job.user_id);
        } catch {
          // findings recompute on manual re-surface
        }
        // Theme surfacer — find what the corpus is engaging with. Runs
        // BEFORE the proposer so any newly-named themes are visible to it.
        try {
          const { runThemeSurfacer } = await import("./theme-surfacer");
          await runThemeSurfacer(env, job.user_id);
        } catch {
          // Themes resurface on the next corpus settle
        }
        // Page autoseeder — every entity, event, and theme node deserves a
        // page row. Catches up extraction's output so subject pages are
        // reachable the moment the corpus settles.
        try {
          const { autoseedPages } = await import("./autoseed-pages");
          await autoseedPages(env, job.user_id);
        } catch {
          // Safety net: also runs on /op/library page load
        }
        try {
          const { proposeBriefs } = await import("./briefs/proposer");
          await proposeBriefs(env, job.user_id);
        } catch {
          // Re-propose on /op/outputs covers a failed auto-run
        }
        // Auto-draft signed readings for subjects that crossed the threshold
        // (Phase 3) — the drafts are waiting when the operator opens OUT. The
        // prime directive: the work is already done when they look.
        try {
          const { draftReadings } = await import("./draft-reading");
          await draftReadings(env, job.user_id);
        } catch {
          // Re-read on /op/out covers a failed auto-run
        }
      }
    }
  } catch (err) {
    const message = (err as Error).message ?? "unknown error";
    const attempts = (job.attempts ?? 0) + 1;
    const giveUp = attempts >= MAX_ATTEMPTS;
    const nowIso2 = new Date().toISOString();
    if (giveUp) {
      await emitJobEvent(env, job, "feed.digest.dead_letter", {
        reason: message,
        attempts,
        deterministic: false,
        threw: true,
      });
    }
    await run(
      env.DB,
      `UPDATE digest_jobs
          SET status=?, step=?, attempts=?, last_error=?, heartbeat_at=?, updated_at=?
        WHERE id=?`,
      [
        giveUp ? "failed" : "queued",
        giveUp ? "failed" : "queued",
        attempts,
        message,
        nowIso2,
        nowIso2,
        jobId,
      ],
    );
  }
}

// Best-effort orchestrator_events emit from the job runner. Used to surface
// dead-letter terminations on the Feed activity log without needing to inspect
// digest_jobs.last_error. Failures here are swallowed — a missing breadcrumb
// must never mask the underlying job failure.
async function emitJobEvent(
  env: Env,
  job: JobRow,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await insertOne(env.DB, "orchestrator_events", {
      user_id: job.user_id,
      event_type: eventType,
      subject_kind: "piece",
      subject_id: job.piece_id,
      payload: { piece_slug: job.slug, job_id: job.id, ...payload },
    });
  } catch {
    // never let logging fail the job runner
  }
}

// Drain — called by the every-minute cron. Picks up:
//   - queued jobs (new uploads waiting)
//   - running jobs whose heartbeat is stale (the previous waitUntil died)
// LIMIT keeps each tick bounded.
export async function drainDigestJobs(env: Env, limit = 5): Promise<string[]> {
  await ensureJobsTable(env);
  const staleCutoff = new Date(Date.now() - STALE_MS).toISOString();
  const rows = await all<{ id: string }>(
    env.DB,
    `SELECT id FROM digest_jobs
      WHERE status = 'queued'
         OR (status = 'running' AND (heartbeat_at IS NULL OR heartbeat_at < ?))
      ORDER BY created_at
      LIMIT ?`,
    [staleCutoff, limit],
  );
  return rows.map((r) => r.id);
}

export interface JobStatusView {
  state: "queued" | "running" | "completed" | "failed";
  step: string;
  claims: number;
  attempts: number;
  stale: boolean;
  error: string | null;
}

export async function jobStatusForPiece(
  env: Env,
  userId: string,
  pieceId: string,
): Promise<JobStatusView | null> {
  const row = await one<{
    status: string;
    step: string;
    claims_count: number;
    attempts: number;
    heartbeat_at: string | null;
    last_error: string | null;
  }>(
    env.DB,
    `SELECT status, step, claims_count, attempts, heartbeat_at, last_error
       FROM digest_jobs
      WHERE user_id = ? AND piece_id = ?
      ORDER BY created_at DESC LIMIT 1`,
    [userId, pieceId],
  );
  if (!row) return null;
  const stale =
    row.status === "running" &&
    !!row.heartbeat_at &&
    Date.parse(row.heartbeat_at) < Date.now() - STALE_MS;
  return {
    state: row.status as JobStatusView["state"],
    step: row.step,
    claims: row.claims_count,
    attempts: row.attempts,
    stale,
    error: row.last_error,
  };
}

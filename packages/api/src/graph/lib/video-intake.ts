// Video-as-source-material ingestion — Phase 1 of the video-commentary
// intake idea (2026-07-24): the operator pastes a video URL, it's
// fetched + transcribed by the video Worker's Container (yt-dlp +
// whisperx, see packages/video-renderer/src/sourcing/transcribe-video.ts
// and packages/video/src/routes/transcribe.ts), and the transcript comes
// back here to become a `piece` — attributed to the video's channel,
// dated with the video's OWN publish date, fed through the exact same
// digestion pipeline as any uploaded document.
//
// This module owns the "ask for a transcript, turn a finished one into a
// piece" side. The video Worker's job is only fetch+transcribe — it has
// no concept of pieces, entities, or digestion.

import type { Env } from "../../env";
import { insertOne, one, updateById } from "../../lib/d1";
import { createAndExtract } from "../../operator/routes/upload";
import { enqueueDigest } from "./digest-jobs";

export interface VideoImportRow {
  id: string;
  user_id: string;
  source_url: string;
  video_job_id: string;
  status: "pending" | "succeeded" | "failed";
  piece_id: string | null;
  error: string | null;
  created_at: string;
}

interface TranscribeStartResponse {
  ok: boolean;
  jobId?: string;
  error?: string;
}

/** Kick off a video import: asks the video Worker to fetch+transcribe
 *  the URL, stores a local tracking row. Returns immediately — the
 *  transcription itself runs in the video Worker's own waitUntil, polled
 *  later via pollVideoImport. */
export async function requestVideoImport(
  env: Env,
  userId: string,
  url: string,
): Promise<{ ok: boolean; importId?: string; error?: string }> {
  if (!env.VIDEO_BASE || !env.VIDEO_INTERNAL_TOKEN) {
    return { ok: false, error: "VIDEO_BASE/VIDEO_INTERNAL_TOKEN not configured" };
  }
  let body: TranscribeStartResponse;
  try {
    const res = await fetch(`${env.VIDEO_BASE}/transcribe`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-token": env.VIDEO_INTERNAL_TOKEN,
      },
      body: JSON.stringify({ url }),
    });
    body = (await res.json()) as TranscribeStartResponse;
    if (!res.ok || !body.ok || !body.jobId) {
      return { ok: false, error: body.error ?? `video Worker returned ${res.status}` };
    }
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  const importId = await insertOne(env.DB, "video_imports", {
    user_id: userId,
    source_url: url,
    video_job_id: body.jobId,
    status: "pending",
  });
  return { ok: true, importId };
}

interface TranscribeJobResponse {
  ok: boolean;
  job?: {
    status: "queued" | "running" | "succeeded" | "failed";
    transcript: string | null;
    title: string | null;
    channel: string | null;
    published_at: string | null;
    duration_s: number | null;
    error: string | null;
  };
  error?: string;
}

/** Poll one import: if it's already terminal locally, just return it —
 *  no network call. Otherwise asks the video Worker for the underlying
 *  job's status; on success, turns the transcript into a piece (via the
 *  same createAndExtract the operator's plain file uploads use) and
 *  kicks off digestion exactly like any other upload. */
export async function pollVideoImport(
  env: Env,
  userId: string,
  importId: string,
): Promise<VideoImportRow | null> {
  const row = await one<VideoImportRow>(
    env.DB,
    "SELECT * FROM video_imports WHERE id = ? AND user_id = ?",
    [importId, userId],
  );
  if (!row || row.status !== "pending") return row;
  if (!env.VIDEO_BASE || !env.VIDEO_INTERNAL_TOKEN) return row;

  let body: TranscribeJobResponse;
  try {
    const res = await fetch(
      `${env.VIDEO_BASE}/transcribe/${encodeURIComponent(row.video_job_id)}`,
      {
        headers: { "x-internal-token": env.VIDEO_INTERNAL_TOKEN },
      },
    );
    body = (await res.json()) as TranscribeJobResponse;
  } catch {
    return row; // transient network error — leave pending, next poll retries
  }
  if (!body.ok || !body.job) return row;

  if (body.job.status === "failed") {
    await updateById(env.DB, "video_imports", importId, {
      status: "failed",
      error: body.job.error ?? "transcription failed",
    });
    return { ...row, status: "failed", error: body.job.error ?? "transcription failed" };
  }
  if (body.job.status !== "succeeded" || !body.job.transcript) {
    return row; // still queued/running
  }

  const title = body.job.title || `Video import — ${new Date().toISOString().slice(0, 10)}`;
  const bytes = new TextEncoder().encode(body.job.transcript);
  const created = await createAndExtract(
    env,
    userId,
    bytes,
    `${title}.txt`,
    "text/plain",
    bytes.length,
    {
      publishedAt: body.job.published_at ?? undefined,
      ingestedFrom: "video-transcript",
      extraMetadata: {
        source_url: row.source_url,
        video_channel: body.job.channel ?? null,
        video_duration_s: body.job.duration_s ?? null,
      },
    },
  );

  if (!created.duplicate && created.sourceId) {
    // Enqueue only — deliberately NOT kicking runDigestJob inline here.
    // pollVideoImport is a plain function with no executionCtx to
    // waitUntil into, and chaining real chunk-extraction LLM calls
    // synchronously onto a status-poll request is exactly this
    // codebase's own well-documented execution-ceiling failure class.
    // The every-2-minute cron drain (index.ts's drainDigestJobs) picks
    // this up on its own — same as any queued job that isn't kicked
    // inline from an upload route.
    await enqueueDigest(env, {
      userId,
      pieceId: created.pieceId,
      slug: created.slug,
      title: created.title,
      sourceId: created.sourceId,
    });
  }

  await updateById(env.DB, "video_imports", importId, {
    status: "succeeded",
    piece_id: created.pieceId,
  });
  return { ...row, status: "succeeded", piece_id: created.pieceId };
}

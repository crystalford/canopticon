// POST /transcribe, GET /transcribe/:jobId — server-to-server video
// ingestion for the publication's fact graph. Same shared-token auth as
// from-reading.ts (the api Worker calls this, not a browser). Mirrors
// queue.ts's approve/render job pattern but for the opposite direction:
// pulling a transcript OUT of a video URL, not rendering one.
//
// This Worker's job here is ONLY "fetch + transcribe" — it does not know
// what a `piece` or an `entity` is. The caller (api Worker) polls
// GET /transcribe/:jobId until status is terminal, then owns turning a
// succeeded transcript into fact-graph material itself.

import { Hono } from "hono";
import type { Env } from "../env";
import { transcribeVideo } from "../render/client";
import {
  createTranscribeJob,
  loadTranscribeJob,
  markTranscribeFailed,
  markTranscribeRunning,
  markTranscribeSucceeded,
} from "../storage/transcribe-jobs";

const app = new Hono<{ Bindings: Env }>();

function requireInternalToken(c: {
  env: Env;
  req: { header(name: string): string | undefined };
}): boolean {
  if (!c.env.VIDEO_INTERNAL_TOKEN) return false;
  return c.req.header("x-internal-token") === c.env.VIDEO_INTERNAL_TOKEN;
}

interface TranscribeRequestBody {
  url?: unknown;
}

app.post("/transcribe", async (c) => {
  if (!c.env.VIDEO_INTERNAL_TOKEN) {
    return c.json({ ok: false, error: "VIDEO_INTERNAL_TOKEN not configured" }, 503);
  }
  if (!requireInternalToken(c)) {
    return c.json({ ok: false, error: "unauthorized" }, 401);
  }

  const body = (await c.req.json().catch(() => null)) as TranscribeRequestBody | null;
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) return c.json({ ok: false, error: "missing url" }, 400);

  const jobId = await createTranscribeJob(c.env.DB, url);
  c.executionCtx.waitUntil(runTranscribeJob(c.env, jobId, url));
  return c.json({ ok: true, jobId });
});

app.get("/transcribe/:jobId", async (c) => {
  if (!requireInternalToken(c)) {
    return c.json({ ok: false, error: "unauthorized" }, 401);
  }
  const job = await loadTranscribeJob(c.env.DB, c.req.param("jobId"));
  if (!job) return c.json({ ok: false, error: "job not found" }, 404);
  return c.json({ ok: true, job });
});

async function runTranscribeJob(env: Env, jobId: string, url: string): Promise<void> {
  try {
    await markTranscribeRunning(env.DB, jobId);
    const result = await transcribeVideo(env.RENDER_CONTAINER, jobId, url);
    if (!result.ok || !result.transcript) {
      await markTranscribeFailed(env.DB, jobId, result.error ?? "unknown transcription failure");
      return;
    }
    await markTranscribeSucceeded(env.DB, jobId, {
      transcript: result.transcript,
      title: result.title ?? null,
      channel: result.channel ?? null,
      published_at: result.published_at ?? null,
      duration_s: result.duration_s ?? null,
    });
  } catch (err) {
    await markTranscribeFailed(env.DB, jobId, (err as Error).message ?? "unknown").catch(() => {});
  }
}

export default app;

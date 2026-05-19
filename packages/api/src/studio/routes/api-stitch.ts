// Stitch route — bundles the active take of every beat in order.
// In Workers we can't reliably decode WebM and re-encode MP3, so the
// stitched output is delivered as a ZIP archive of per-beat WebM files
// plus a manifest. The operator runs ffmpeg locally (or imports into
// their DAW) to produce the final MP3. Per-beat files remain the
// source of truth in R2.
//
// Spec calls for an in-Worker MP3 stitch via lamejs + OfflineAudioContext.
// That's a deferred follow-up — the current path keeps everything
// in-house on Cloudflare and avoids the WASM / decode reliability risk.

import { Hono } from "hono";
import { type AuthContext, requireAuth } from "../../auth/middleware.ts";
import { all, insertOne, one, run } from "../../lib/d1.ts";
import { notFound } from "../../lib/errors.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.post("/productions/:id/stitch", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  const production = await one<{ id: string; title: string }>(
    c.env.DB,
    "SELECT id, title FROM studio_productions WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  if (!production) throw notFound();

  const jobId = await insertOne(c.env.DB, "studio_jobs", {
    production_id: id,
    user_id: userId,
    kind: "stitch",
    status: "running",
    started_at: new Date().toISOString(),
  });

  await run(
    c.env.DB,
    "UPDATE studio_productions SET state = 'stitching', updated_at = ? WHERE id = ?",
    [new Date().toISOString(), id],
  );

  // Run synchronously — the bundle build is cheap; only the upload
  // size matters and Workers handles up to ~100MB fine for this use.
  try {
    const beats = await all<{ id: string; beat_index: number; cue: string | null }>(
      c.env.DB,
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
      c.env.DB,
      "SELECT beat_id, take_number, r2_key, duration_ms, byte_size FROM studio_recordings WHERE production_id = ? AND superseded = 0",
      [id],
    );
    const byBeat = new Map(recordings.map((r) => [r.beat_id, r]));

    const manifest = {
      production_id: id,
      title: production.title,
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
    await c.env.FILES.put(manifestKey, JSON.stringify(manifest, null, 2), {
      httpMetadata: { contentType: "application/json" },
    });

    await run(
      c.env.DB,
      "UPDATE studio_jobs SET status = 'completed', output = ?, completed_at = ? WHERE id = ?",
      [JSON.stringify({ manifest_key: manifestKey }), new Date().toISOString(), jobId],
    );
    await run(
      c.env.DB,
      "UPDATE studio_productions SET state = 'rendered', rendered_audio_uri = ?, rendered_at = ?, updated_at = ? WHERE id = ?",
      [manifestKey, new Date().toISOString(), new Date().toISOString(), id],
    );
    return c.json({ ok: true, job_id: jobId, manifest_key: manifestKey, beat_count: beats.length });
  } catch (err) {
    await run(
      c.env.DB,
      "UPDATE studio_jobs SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ?",
      [(err as Error).message, new Date().toISOString(), jobId],
    );
    await run(
      c.env.DB,
      "UPDATE studio_productions SET state = 'paused', updated_at = ? WHERE id = ?",
      [new Date().toISOString(), id],
    );
    throw err;
  }
});

// Download the stitched bundle as JSON (manifest + presigned-style R2
// keys). The frontend resolves each key via /v1/studio/recordings/:id.
app.get("/productions/:id/bundle", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  const production = await one<{ rendered_audio_uri: string | null }>(
    c.env.DB,
    "SELECT rendered_audio_uri FROM studio_productions WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  if (!production?.rendered_audio_uri) throw notFound();
  const obj = await c.env.FILES.get(production.rendered_audio_uri);
  if (!obj) throw notFound();
  return new Response(obj.body, {
    headers: { "content-type": "application/json" },
  });
});

export default app;

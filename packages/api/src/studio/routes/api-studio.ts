// Studio routes — productions CRUD, beats list, recordings upload.
// All gated on STUDIO_ENABLED via the route mount in src/index.ts.

import { Hono } from "hono";
import { z } from "zod";
import { type AuthContext, requireAuth } from "../../auth/middleware.ts";
import { all, insertOne, one, parseJson, run } from "../../lib/d1.ts";
import { badRequest, notFound } from "../../lib/errors.ts";
import { checkCoherence } from "../roles/script-coherence.ts";
import { ideateFromClaims, ideateFromPost } from "../roles/script-ideator.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/productions", async (c) => {
  const userId = c.get("user_id");
  const state = c.req.query("state");
  const rows = state
    ? await all(
        c.env.DB,
        "SELECT * FROM studio_productions WHERE user_id = ? AND state = ? ORDER BY updated_at DESC",
        [userId, state],
      )
    : await all(
        c.env.DB,
        "SELECT * FROM studio_productions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 200",
        [userId],
      );
  return c.json({ productions: rows });
});

app.get("/productions/:id", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  const production = await one(
    c.env.DB,
    "SELECT * FROM studio_productions WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  if (!production) throw notFound();
  const beats = await all(
    c.env.DB,
    "SELECT * FROM studio_beats WHERE production_id = ? ORDER BY beat_index",
    [id],
  );
  const recordings = await all(
    c.env.DB,
    "SELECT * FROM studio_recordings WHERE production_id = ? AND superseded = 0 ORDER BY beat_id, take_number",
    [id],
  );
  return c.json({ production, beats, recordings });
});

const proposeFromPostSchema = z.object({
  post_id: z.string(),
  use_anthropic: z.boolean().optional(),
});

app.post("/productions/from-post", async (c) => {
  const userId = c.get("user_id");
  const parsed = proposeFromPostSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });

  const post = await one<{ id: string; title: string; body_md: string }>(
    c.env.DB,
    "SELECT id, title, body_md FROM posts WHERE id = ? AND user_id = ?",
    [parsed.data.post_id, userId],
  );
  if (!post) throw notFound();

  const ideated = await ideateFromPost(c.env, {
    userId,
    postTitle: post.title,
    postBody: post.body_md,
    useAnthropic: parsed.data.use_anthropic ?? false,
  });

  const productionId = await createProductionWithBeats(c.env.DB, {
    userId,
    title: ideated.title ?? post.title,
    sourceKind: "post",
    sourcePostId: post.id,
    sourceThesisId: null,
    useAnthropic: parsed.data.use_anthropic ?? false,
    beats: ideated.beats,
  });
  return c.json({ ok: true, production_id: productionId });
});

const proposeFromClaimsSchema = z.object({
  topic: z.string(),
  claim_ids: z.array(z.string()).min(1),
  use_anthropic: z.boolean().optional(),
});

app.post("/productions/from-claims", async (c) => {
  const userId = c.get("user_id");
  const parsed = proposeFromClaimsSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });

  const placeholders = parsed.data.claim_ids.map(() => "?").join(",");
  const claims = await all<{ id: string; text: string; evidence_text: string }>(
    c.env.DB,
    `SELECT c.id, cv.claim_text AS text, cv.data AS evidence_text
       FROM claims c
       JOIN claim_versions cv ON cv.id = c.current_version_id
      WHERE c.id IN (${placeholders}) AND c.user_id = ?`,
    [...parsed.data.claim_ids, userId],
  );
  if (claims.length === 0) throw badRequest("no matching claims");

  const ideated = await ideateFromClaims(c.env, {
    userId,
    topic: parsed.data.topic,
    claims,
    useAnthropic: parsed.data.use_anthropic ?? false,
  });

  const productionId = await createProductionWithBeats(c.env.DB, {
    userId,
    title: ideated.title ?? parsed.data.topic,
    sourceKind: "claims",
    sourcePostId: null,
    sourceThesisId: null,
    useAnthropic: parsed.data.use_anthropic ?? false,
    beats: ideated.beats,
  });
  return c.json({ ok: true, production_id: productionId });
});

app.post("/productions/:id/approve", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  await mustOwn(c.env.DB, userId, id);
  await run(
    c.env.DB,
    "UPDATE studio_productions SET state = 'script_approved', updated_at = ? WHERE id = ?",
    [new Date().toISOString(), id],
  );
  return c.json({ ok: true });
});

app.post("/productions/:id/start-recording", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  await mustOwn(c.env.DB, userId, id);
  await run(
    c.env.DB,
    "UPDATE studio_productions SET state = 'recording', paused_at = NULL, updated_at = ? WHERE id = ?",
    [new Date().toISOString(), id],
  );
  return c.json({ ok: true, recording_url: `/studio/record/${id}` });
});

app.post("/productions/:id/pause", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  await mustOwn(c.env.DB, userId, id);
  const now = new Date().toISOString();
  await run(
    c.env.DB,
    "UPDATE studio_productions SET state = 'paused', paused_at = ?, updated_at = ? WHERE id = ?",
    [now, now, id],
  );
  return c.json({ ok: true });
});

app.post("/productions/:id/resume", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  await mustOwn(c.env.DB, userId, id);
  await run(
    c.env.DB,
    "UPDATE studio_productions SET state = 'recording', paused_at = NULL, updated_at = ? WHERE id = ?",
    [new Date().toISOString(), id],
  );
  return c.json({ ok: true });
});

app.post("/productions/:id/archive", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  await mustOwn(c.env.DB, userId, id);
  const now = new Date().toISOString();
  await run(
    c.env.DB,
    "UPDATE studio_productions SET state = 'archived', archived_at = ?, updated_at = ? WHERE id = ?",
    [now, now, id],
  );
  return c.json({ ok: true });
});

app.post("/productions/:id/coherence", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  const production = await one<{ title: string }>(
    c.env.DB,
    "SELECT title FROM studio_productions WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  if (!production) throw notFound();
  const beats = await all<{
    beat_index: number;
    role: string;
    cue: string;
    beat_text: string;
    target_seconds: number;
  }>(
    c.env.DB,
    "SELECT beat_index, role, cue, beat_text, target_seconds FROM studio_beats WHERE production_id = ? ORDER BY beat_index",
    [id],
  );
  const notes = await checkCoherence(c.env, { userId, title: production.title, beats });
  await run(
    c.env.DB,
    "UPDATE studio_productions SET coherence_notes = ?, updated_at = ? WHERE id = ?",
    [notes, new Date().toISOString(), id],
  );
  return c.json({ notes });
});

// Beat-audio upload. Multipart body: field "audio" carries the blob,
// field "duration_ms" optional. Marks any prior takes as superseded.
app.post("/beats/:beatId/audio", async (c) => {
  const userId = c.get("user_id");
  const beatId = c.req.param("beatId");
  const beat = await one<{ id: string; production_id: string }>(
    c.env.DB,
    "SELECT id, production_id FROM studio_beats WHERE id = ? AND user_id = ?",
    [beatId, userId],
  );
  if (!beat) throw notFound();

  const form = await c.req.formData();
  const audio = form.get("audio") as unknown as
    | { arrayBuffer: () => Promise<ArrayBuffer>; type: string }
    | null;
  if (!audio || typeof audio.arrayBuffer !== "function") {
    throw badRequest("audio field required");
  }
  const durationMsRaw = form.get("duration_ms");
  const durationMs = typeof durationMsRaw === "string" ? Number(durationMsRaw) : null;

  const prevCount = await one<{ n: number }>(
    c.env.DB,
    "SELECT COUNT(*) AS n FROM studio_recordings WHERE beat_id = ?",
    [beatId],
  );
  const takeNumber = (prevCount?.n ?? 0) + 1;

  const key = `productions/${beat.production_id}/beats/${beatId}/take-${takeNumber}.webm`;
  const bytes = await audio.arrayBuffer();
  await c.env.FILES.put(key, bytes, {
    httpMetadata: { contentType: audio.type || "audio/webm" },
  });

  await run(
    c.env.DB,
    "UPDATE studio_recordings SET superseded = 1 WHERE beat_id = ? AND superseded = 0",
    [beatId],
  );
  const recordingId = await insertOne(c.env.DB, "studio_recordings", {
    beat_id: beatId,
    production_id: beat.production_id,
    user_id: userId,
    take_number: takeNumber,
    r2_key: key,
    mime_type: audio.type || "audio/webm",
    duration_ms: durationMs,
    byte_size: bytes.byteLength,
    superseded: 0,
  });
  await run(c.env.DB, "UPDATE studio_beats SET recorded = 1 WHERE id = ?", [beatId]);

  return c.json({ ok: true, recording_id: recordingId, take_number: takeNumber });
});

// Serve a recorded take. Streamed straight from R2.
app.get("/recordings/:id", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  const rec = await one<{ r2_key: string; mime_type: string }>(
    c.env.DB,
    "SELECT r2_key, mime_type FROM studio_recordings WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  if (!rec) throw notFound();
  const obj = await c.env.FILES.get(rec.r2_key);
  if (!obj) throw notFound();
  return new Response(obj.body, {
    headers: { "content-type": rec.mime_type, "cache-control": "private, max-age=3600" },
  });
});

async function createProductionWithBeats(
  db: D1Database,
  args: {
    userId: string;
    title: string;
    sourceKind: "post" | "thesis" | "claims" | "blank";
    sourcePostId: string | null;
    sourceThesisId: string | null;
    useAnthropic: boolean;
    beats: Array<{
      beat_index: number;
      role: string;
      cue?: string;
      beat_text: string;
      next_preview?: string;
      target_seconds: number;
      cited_claim_id?: string;
    }>;
  },
): Promise<string> {
  const totalSeconds = args.beats.reduce((a, b) => a + (b.target_seconds ?? 0), 0);
  const productionId = await insertOne(db, "studio_productions", {
    user_id: args.userId,
    title: args.title,
    source_post_id: args.sourcePostId,
    source_thesis_id: args.sourceThesisId,
    source_kind: args.sourceKind,
    state: "script_proposed",
    script_total_seconds: totalSeconds,
    use_anthropic: args.useAnthropic ? 1 : 0,
  });
  for (const b of args.beats) {
    await insertOne(db, "studio_beats", {
      production_id: productionId,
      user_id: args.userId,
      beat_index: b.beat_index,
      role: b.role,
      cue: b.cue ?? null,
      beat_text: b.beat_text,
      next_preview: b.next_preview ?? null,
      target_seconds: b.target_seconds,
      cited_claim_id: b.cited_claim_id ?? null,
    });
  }
  return productionId;
}

async function mustOwn(db: D1Database, userId: string, productionId: string): Promise<void> {
  const owned = await one(
    db,
    "SELECT id FROM studio_productions WHERE id = ? AND user_id = ?",
    [productionId, userId],
  );
  if (!owned) throw notFound();
}

// Keep parseJson reachable for future endpoints that need it.
void parseJson;

export default app;

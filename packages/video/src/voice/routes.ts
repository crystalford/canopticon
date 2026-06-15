// /voice — operator's voice clone training surface.
//
// GET  /voice              — recording UI (one of the rare places we
//                            allow client JS, for MediaRecorder)
// POST /voice/upload       — append one recorded chunk to R2
// POST /voice/train        — kick off MiniMax clone with the uploaded
//                            samples, store voice_id in voice_profile

import { Hono } from "hono";
import { type AuthState, requireOperator } from "../auth";
import type { Env } from "../env";
import { renderVoicePage } from "../pages/voice";
import { trainVoiceClone } from "./minimax";
import {
  listVoiceSampleKeys,
  loadVoiceProfile,
  putVoiceSample,
  upsertVoiceProfile,
} from "./storage";

const app = new Hono<{ Bindings: Env; Variables: AuthState }>();

const OPERATOR_USER_ID = "op-1"; // single-operator system
const SAMPLE_PREFIX = "voice-samples/";

app.get("/", async (c) => {
  const gate = await requireOperator(c);
  if (gate) return gate;
  const profile = await loadVoiceProfile(c.env.DB).catch(() => null);
  const sampleKeys = await listVoiceSampleKeys(c.env.ASSETS, SAMPLE_PREFIX).catch(() => []);
  return renderVoicePage({ profile, sampleCount: sampleKeys.length });
});

app.post("/upload", async (c) => {
  const gate = await requireOperator(c);
  if (gate) return gate;
  const body = await c.req.arrayBuffer();
  if (!body || body.byteLength < 1000) {
    return new Response("sample too short", { status: 400 });
  }
  const key = `${SAMPLE_PREFIX}${Date.now()}-${crypto.randomUUID()}.webm`;
  await putVoiceSample(c.env.ASSETS, key, body, c.req.header("content-type") ?? "audio/webm");
  return c.json({ ok: true, key });
});

app.post("/train", async (c) => {
  const gate = await requireOperator(c);
  if (gate) return gate;
  const apiKey = c.env.MINIMAX_API_KEY;
  if (!apiKey) {
    return new Response("MINIMAX_API_KEY not configured — wrangler secret put MINIMAX_API_KEY", {
      status: 503,
    });
  }
  const keys = await listVoiceSampleKeys(c.env.ASSETS, SAMPLE_PREFIX);
  if (keys.length < 3) {
    return new Response("need at least 3 voice samples (≥ ~5 min total) before training", {
      status: 400,
    });
  }
  // Public sample URLs MiniMax can fetch. Worker proxies these via
  // the existing /voice/sample/:key route below — keeps the bucket
  // private and avoids minting signed URLs every request.
  const sampleUrls = keys.map((k) => `${c.env.VIDEO_BASE}/voice/sample/${encodeURIComponent(k)}`);
  const customId = `canopticon-narrator-${new Date().toISOString().slice(0, 10)}`;
  const result = await trainVoiceClone({
    apiKey,
    sample_urls: sampleUrls,
    custom_voice_id: customId,
  });
  if (!result.ok || !result.voice_id) {
    return new Response(`clone failed: ${result.error ?? "unknown"}`, { status: 500 });
  }
  await upsertVoiceProfile(c.env.DB, {
    user_id: OPERATOR_USER_ID,
    minimax_voice_id: result.voice_id,
    samples_json: JSON.stringify({ keys, trained_at: new Date().toISOString() }),
  });
  return c.redirect("/voice?msg=trained", 302);
});

// Public-ish read of an individual sample. Locked to anyone who can
// guess the (random) key; we don't expose a listing endpoint.
app.get("/sample/:key", async (c) => {
  const key = decodeURIComponent(c.req.param("key"));
  if (!key.startsWith(SAMPLE_PREFIX)) {
    return new Response("not found", { status: 404 });
  }
  const obj = await c.env.ASSETS.get(key);
  if (!obj) return new Response("not found", { status: 404 });
  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType ?? "audio/webm",
      "cache-control": "public, max-age=3600",
    },
  });
});

export default app;

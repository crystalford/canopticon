// NARRATION ROUTES. Speak it, measure it, serve it.
//
// Narration is not an add-on here: the spine the whole film is cut against
// comes from these calls, so this runs BEFORE the cut is meaningful rather
// than being attached to a finished film afterwards.

import { Hono } from "hono";
import type { Env } from "../env.ts";
import { newId, nowIso, run } from "../lib/d1.ts";
import { narrateSpans } from "../narrate/store.ts";
import {
  TTS_CANDIDATES,
  VOICES,
  describeShape,
  sniff,
  synthesise,
  toBytes,
} from "../narrate/tts.ts";
import { loadFilm, saveFilm } from "./film.ts";

const app = new Hono<{ Bindings: Env }>();

app.get("/voices", (c) => c.json({ voices: VOICES }));

/** SPEAK THE FILM. Long — one TTS and one ASR call per span — so it runs
 *  in `waitUntil` and the caller polls. A 60-second film is 4-6 spans. */
app.post("/film/:id/narrate", async (c) => {
  const film = await loadFilm(c.env, c.req.param("id"));
  if (!film) return c.json({ error: "no such film" }, 404);
  const body = await c.req.json().catch(() => ({}));
  const voice =
    typeof body.voice === "string" ? body.voice : (film.narration.voice ?? VOICES[0]?.id);
  if (!voice) return c.json({ error: "no voice" }, 400);

  const job = newId("nar");
  await c.env.FILES.put(
    `films/${film.filmId}/jobs/${job}.json`,
    JSON.stringify({ state: "running", startedAt: nowIso(), spans: film.narration.spans.length }),
  );

  const work = async () => {
    const out = await narrateSpans(c.env, film, voice);
    const next = {
      ...film,
      narration: { voice, spans: out.spans },
      assets: [...film.assets, ...out.assets],
    };
    await saveFilm(c.env, next, `narrated ${out.spoken.length}/${out.spans.length} spans`);
    await c.env.FILES.put(
      `films/${film.filmId}/jobs/${job}.json`,
      JSON.stringify({
        state: "done",
        finishedAt: nowIso(),
        spoken: out.spoken.length,
        spans: out.spans.length,
        measured: out.spoken.filter((s) => s.method === "measured").length,
        failures: out.failures,
      }),
    );
  };
  c.executionCtx.waitUntil(
    work().catch(async (err) => {
      // A failure must be visible, not a job that polls forever.
      await c.env.FILES.put(
        `films/${film.filmId}/jobs/${job}.json`,
        JSON.stringify({ state: "failed", error: String(err), finishedAt: nowIso() }),
      );
    }),
  );
  return c.json({ started: true, job, spans: film.narration.spans.length }, 202);
});

app.get("/film/:id/narrate/:job", async (c) => {
  const obj = await c.env.FILES.get(`films/${c.req.param("id")}/jobs/${c.req.param("job")}.json`);
  if (!obj) return c.json({ error: "no such job" }, 404);
  return c.json(JSON.parse(await obj.text()));
});

/** Stream one span's audio. Etag is the artifact's own hash — the same
 *  span re-narrated is a different artifact and must not hit a stale
 *  cache. */
app.get("/film/:id/vo/:spanId", async (c) => {
  const film = await loadFilm(c.env, c.req.param("id"));
  if (!film) return c.json({ error: "no such film" }, 404);
  const span = film.narration.spans.find((s) => s.spanId === c.req.param("spanId"));
  const asset = span?.voAssetId ? film.assets.find((a) => a.assetId === span.voAssetId) : null;
  if (!asset) return c.json({ error: "not narrated" }, 404);
  const obj = await c.env.FILES.get(asset.r2Key);
  if (!obj) return c.json({ error: "the recording is missing from storage" }, 404);
  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType ?? "audio/mpeg",
      etag: `"${asset.sha256}"`,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
});

/** WHAT DOES THE BINDING ACTUALLY RETURN? The last serious bug in this
 *  system was an unverified assumption about exactly that, so this asks
 *  rather than assumes, and reports the shape it could not use. */
app.post("/tts/probe", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const text = typeof body.text === "string" && body.text ? body.text : "It rewards winning now.";
  const voice = typeof body.voice === "string" ? body.voice : (VOICES[0]?.id as string);
  const attempts: unknown[] = [];
  for (const candidate of TTS_CANDIDATES) {
    try {
      const raw = await c.env.AI.run(
        candidate.model as never,
        candidate.input(text, voice) as never,
      );
      const unwrapped = await toBytes(raw);
      const bytes = unwrapped ? unwrapped.bytes : null;
      attempts.push({
        model: candidate.model,
        shape: describeShape(raw),
        bytes: bytes ? bytes.length : 0,
        sniffed: bytes ? sniff(bytes) : null,
      });
    } catch (err) {
      attempts.push({ model: candidate.model, threw: String(err) });
    }
  }
  return c.json({ attempts });
});

app.post("/voice/audition", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const voice = typeof body.voice === "string" ? body.voice : (VOICES[0]?.id as string);
  const text =
    typeof body.text === "string" && body.text
      ? body.text
      : "The medium doesn't reward having been right before.";
  const said = await synthesise(c.env.AI, text, voice);
  if (!said.ok) return c.json({ error: said.reason, attempts: said.attempts }, 502);
  const kind = sniff(said.bytes);
  return new Response(said.bytes as unknown as BodyInit, {
    headers: { "content-type": kind.contentType, "cache-control": "no-store" },
  });
});

export default app;
export { run };

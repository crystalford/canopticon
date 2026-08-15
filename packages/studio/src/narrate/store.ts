// SPEAK IT ONCE, MEASURE IT, FREEZE IT.
//
// Replaces the deleted narrate/index.ts, span-keyed rather than
// scene-keyed — and with the bug that motivated the whole reset fixed.
//
// THE BUG: the old `loadAlignments` parsed the measured word timings out
// of the stored artifact and then rebuilt the object WITHOUT them
// (`{sceneId, chunks}`). Both consumers read `.words`, always got nothing,
// and silently fell back to even division. The word spine had been
// measured, hashed into R2, and read by nothing since the day it was
// built. `loadSpans` below carries `words`, and everything stands on it.

import type { Env } from "../env.ts";
import type { Asset, Film, NarrationSpan } from "../film/schema.ts";
import { type TimedWord, measureAudio } from "./asr.ts";
import { sha256Hex, sniff, synthesise } from "./tts.ts";

export interface SpokenSpan {
  spanId: string;
  audio: Asset;
  alignment: Asset;
  durationMs: number;
  words: TimedWord[];
  method: "measured" | "duration-only";
}

export interface NarrateOutcome {
  spans: NarrationSpan[];
  assets: Asset[];
  spoken: SpokenSpan[];
  failures: string[];
}

/** Speak every span that needs it. Failures are per span: one that will
 *  not synthesise must not silence the film. */
export async function narrateSpans(env: Env, film: Film, voice: string): Promise<NarrateOutcome> {
  const assets: Asset[] = [];
  const spoken: SpokenSpan[] = [];
  const failures: string[] = [];
  const spans = film.narration.spans.map((s) => ({ ...s }));

  // Bounded lanes: serial makes a film wait for every span end to end;
  // unbounded points a dozen simultaneous requests at one binding.
  const queue = spans.map((s, i) => ({ span: s, i }));
  const lane = async () => {
    for (;;) {
      const job = queue.shift();
      if (!job) return;
      const { span } = job;
      try {
        const said = await synthesise(env.AI, span.text, voice);
        if (!said.ok) {
          failures.push(`${span.spanId}: ${said.reason}`);
          continue;
        }
        const kind = sniff(said.bytes);
        const audioHash = await sha256Hex(said.bytes);
        const audioKey = `films/${film.filmId}/vo/${span.spanId}_${audioHash.slice(0, 12)}${kind.extension}`;
        await env.FILES.put(audioKey, said.bytes, {
          httpMetadata: { contentType: kind.contentType },
        });
        const audio: Asset = {
          assetId: `a_${span.spanId}_${audioHash.slice(0, 8)}`,
          kind: "audio",
          r2Key: audioKey,
          sha256: audioHash,
          provenance: {
            generatedBy: said.model,
            params: { voice },
            createdAt: new Date().toISOString(),
            sourceText: span.text,
          },
        };

        const heard = await measureAudio(env.AI, said.bytes);
        const payload = {
          spanId: span.spanId,
          durationMs: heard.durationMs,
          words: heard.words,
          model: heard.model ?? null,
        };
        const alignJson = JSON.stringify(payload);
        const alignHash = await sha256Hex(alignJson);
        const alignKey = `films/${film.filmId}/align/${span.spanId}_${alignHash.slice(0, 12)}.json`;
        await env.FILES.put(alignKey, alignJson, {
          httpMetadata: { contentType: "application/json" },
        });
        const alignment: Asset = {
          assetId: `al_${span.spanId}_${alignHash.slice(0, 8)}`,
          kind: "alignment",
          r2Key: alignKey,
          sha256: alignHash,
          provenance: {
            generatedBy: heard.model ?? "none",
            params: { words: heard.words.length },
            createdAt: new Date().toISOString(),
            sourceText: span.text,
          },
        };

        span.voAssetId = audio.assetId;
        span.alignmentAssetId = alignment.assetId;
        assets.push(audio, alignment);
        spoken.push({
          spanId: span.spanId,
          audio,
          alignment,
          durationMs: heard.durationMs,
          words: heard.words,
          method: heard.words.length > 0 ? "measured" : "duration-only",
        });
        if (!heard.ok) failures.push(`${span.spanId}: not measured — ${heard.reason}`);
      } catch (err) {
        failures.push(`${span.spanId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, spans.length) }, lane));

  spoken.sort(
    (a, b) =>
      spans.findIndex((s) => s.spanId === a.spanId) - spans.findIndex((s) => s.spanId === b.spanId),
  );
  return { spans, assets, spoken, failures };
}

/** Read the frozen measurements back — WITH their words.
 *
 *  The sha256 on the asset is re-verified against the bytes, because an
 *  artifact that has drifted from its own hash is not the artifact the
 *  film was compiled against. */
export async function loadSpans(
  env: Env,
  film: Film,
): Promise<{ spoken: SpokenSpan[]; stale: string[] }> {
  const spoken: SpokenSpan[] = [];
  const stale: string[] = [];
  const byId = new Map(film.assets.map((a) => [a.assetId, a]));

  for (const span of film.narration.spans) {
    const audio = span.voAssetId ? byId.get(span.voAssetId) : undefined;
    const alignment = span.alignmentAssetId ? byId.get(span.alignmentAssetId) : undefined;
    if (!audio || !alignment) continue;
    // The prose moved after it was recorded. Say so rather than playing
    // the old line under the new words.
    if (audio.provenance.sourceText !== undefined && audio.provenance.sourceText !== span.text) {
      stale.push(`${span.spanId}: the writing changed after it was recorded`);
      continue;
    }
    const obj = await env.FILES.get(alignment.r2Key);
    if (!obj) {
      stale.push(`${span.spanId}: the measurement is missing from storage`);
      continue;
    }
    const text = await obj.text();
    if ((await sha256Hex(text)) !== alignment.sha256) {
      stale.push(`${span.spanId}: the measurement does not match its own hash`);
      continue;
    }
    const parsed = JSON.parse(text) as {
      durationMs?: number;
      words?: TimedWord[];
    };
    spoken.push({
      spanId: span.spanId,
      audio,
      alignment,
      durationMs: parsed.durationMs ?? 0,
      // CARRIED. This is the one line the old engine dropped.
      words: parsed.words ?? [],
      method: (parsed.words?.length ?? 0) > 0 ? "measured" : "duration-only",
    });
  }
  return { spoken, stale };
}

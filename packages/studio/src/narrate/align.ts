// Alignment — narration audio in, timed chunks out.
//
// This is the artifact the whole timing architecture was built around.
// Anchors name a chunk, never a frame, precisely so that re-recording a
// line re-times the film instead of desynchronising it (Master Spec Part
// 3, standing rule 2). Until this module existed, every scene resolved
// through `nominalAlignment` — a character-count guess at how long a
// sentence takes to say — and every scene carried a `missing_alignment`
// flag saying so. The flag was honest. It was also the single largest gap
// between what the system claims and what it does.
//
// WHAT THIS IS AND IS NOT. It is not forced alignment. There is no forced
// aligner on Workers AI. What there is: an ASR model that returns word
// timings for audio we generated ourselves, from text we already have.
// That is a strictly easier problem than transcription — we are not asking
// what was said, we know what was said — and it gives real word-boundary
// times measured off the real audio.
//
// The mapping from those words to the scene's sentences is proportional by
// token share, and the method is recorded on the artifact as
// `asr-proportional` rather than dressed up as `forced`. A sentence's
// boundary therefore lands on a real word boundary at a real measured
// time, which is a different and better thing than a character-count
// guess — and it is not the same thing as knowing which word it was.
// Determinism is claimed honestly (standing rule 7); so is alignment.

import type { Alignment, AlignmentChunk } from "../compile/solver.ts";
import { splitSentences } from "../compile/solver.ts";
import { describeShape, toBase64 } from "./tts.ts";

export interface TimedWord {
  word: string;
  startMs: number;
  endMs: number;
}

export type AlignmentMethod = "asr-proportional" | "asr-duration" | "declined";

export interface AlignmentResult {
  ok: boolean;
  /** Scene-LOCAL times, starting at 0. The film's absolute placement is
   *  the solver's business, not this module's — see `sequenceAlignments`. */
  alignment: Alignment | null;
  method: AlignmentMethod;
  durationMs: number;
  model?: string;
  words?: number;
  reason?: string;
  attempts: Array<{ model: string; outcome: string; shape?: string }>;
}

interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

/** Tried in order, same discipline as the TTS ladder and for the same
 *  reason: the parameter names differ between these models and being wrong
 *  about one should cost the next candidate, not the feature. */
export const ASR_CANDIDATES: Array<{
  model: string;
  input: (bytes: Uint8Array) => Record<string, unknown>;
}> = [
  {
    model: "@cf/openai/whisper-large-v3-turbo",
    input: (bytes) => ({ audio: toBase64(bytes), language: "en", task: "transcribe" }),
  },
  {
    model: "@cf/openai/whisper",
    input: (bytes) => ({ audio: [...bytes] }),
  },
];

export async function alignAudio(
  ai: AiBinding | undefined,
  bytes: Uint8Array,
  sceneId: string,
  text: string,
): Promise<AlignmentResult> {
  const attempts: Array<{ model: string; outcome: string; shape?: string }> = [];
  if (!ai || typeof ai.run !== "function") {
    return {
      ok: false,
      alignment: null,
      method: "declined",
      durationMs: 0,
      reason: "no AI binding — cannot measure the audio",
      attempts,
    };
  }

  for (const candidate of ASR_CANDIDATES) {
    let out: unknown;
    try {
      out = await ai.run(candidate.model, candidate.input(bytes));
    } catch (err) {
      attempts.push({
        model: candidate.model,
        outcome: `threw: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }
    const read = readTimings(out);
    if (!read.durationMs) {
      attempts.push({
        model: candidate.model,
        outcome: "returned no usable timings",
        shape: describeShape(out),
      });
      continue;
    }

    const chunks = read.words.length
      ? chunksFromWords(sceneId, text, read.words)
      : chunksFromDuration(sceneId, text, read.durationMs);

    return {
      ok: true,
      alignment: withEndpoints(sceneId, chunks),
      method: read.words.length ? "asr-proportional" : "asr-duration",
      durationMs: read.durationMs,
      model: candidate.model,
      words: read.words.length,
      attempts,
    };
  }

  return {
    ok: false,
    alignment: null,
    method: "declined",
    durationMs: 0,
    reason: "no ASR candidate returned timings",
    attempts,
  };
}

/** Pull word timings and a total duration out of whatever came back.
 *
 *  Whisper has returned `words: [{word, start, end}]`, and the turbo
 *  variant returns `segments: [{start, end, text, words?}]` with a
 *  `transcription_info.duration`. Both are read; neither is assumed. */
export function readTimings(out: unknown): { words: TimedWord[]; durationMs: number } {
  const empty = { words: [] as TimedWord[], durationMs: 0 };
  if (!out || typeof out !== "object") return empty;
  const root = out as Record<string, unknown>;
  // Some bindings wrap the payload one level down.
  const o = (
    root.result && typeof root.result === "object" ? (root.result as Record<string, unknown>) : root
  ) as Record<string, unknown>;

  const words: TimedWord[] = [];
  const push = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    const w = v as Record<string, unknown>;
    const text = typeof w.word === "string" ? w.word : typeof w.text === "string" ? w.text : "";
    const start = num(w.start ?? w.start_time ?? w.startMs);
    const end = num(w.end ?? w.end_time ?? w.endMs);
    if (!text.trim() || start === null || end === null || end < start) return;
    words.push({ word: text.trim(), startMs: toMs(start), endMs: toMs(end) });
  };

  if (Array.isArray(o.words)) for (const w of o.words) push(w);
  if (Array.isArray(o.segments)) {
    for (const seg of o.segments) {
      if (!seg || typeof seg !== "object") continue;
      const s = seg as Record<string, unknown>;
      if (Array.isArray(s.words)) for (const w of s.words) push(w);
    }
  }

  let durationMs = words.length ? Math.max(...words.map((w) => w.endMs)) : 0;

  const info = o.transcription_info;
  if (info && typeof info === "object") {
    const d = num((info as Record<string, unknown>).duration);
    if (d !== null) durationMs = Math.max(durationMs, toMs(d));
  }
  if (!durationMs && Array.isArray(o.segments)) {
    for (const seg of o.segments) {
      if (!seg || typeof seg !== "object") continue;
      const end = num((seg as Record<string, unknown>).end);
      if (end !== null) durationMs = Math.max(durationMs, toMs(end));
    }
  }

  return { words, durationMs: Math.round(durationMs) };
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Whisper reports seconds. A value large enough to be milliseconds
 *  already is left alone rather than multiplied into an hour of audio. */
function toMs(v: number): number {
  return v > 1000 ? Math.round(v) : Math.round(v * 1000);
}

/** Sentence chunks whose boundaries land on real word boundaries.
 *
 *  Each sentence takes a share of the ASR word stream proportional to its
 *  token count, and its window runs from the first of those words' start
 *  to the last of their end. The ASR transcript will not match the source
 *  text token for token — it is a transcription of synthesised speech —
 *  which is exactly why the split is by SHARE rather than by matching
 *  words: a mis-transcribed word shifts a boundary slightly, it does not
 *  throw the alignment out of order. */
export function chunksFromWords(
  sceneId: string,
  text: string,
  words: TimedWord[],
): AlignmentChunk[] {
  const sentences = splitSentences(text);
  if (sentences.length === 0 || words.length === 0) return [];

  const tokens = sentences.map((s) => Math.max(1, s.split(/\s+/).filter(Boolean).length));
  const totalTokens = tokens.reduce((a, b) => a + b, 0);

  const chunks: AlignmentChunk[] = [];
  let at = 0;
  sentences.forEach((sentence, i) => {
    const isLast = i === sentences.length - 1;
    const take = isLast
      ? words.length - at
      : Math.max(1, Math.round(((tokens[i] as number) / totalTokens) * words.length));
    const slice = words.slice(at, Math.min(words.length, at + take));
    const first = slice[0] ?? words[Math.min(at, words.length - 1)];
    const last = slice[slice.length - 1] ?? first;
    if (!first || !last) return;
    chunks.push({
      chunkId: `${sceneId}_c${i + 1}`,
      startMs: i === 0 ? 0 : first.startMs,
      endMs: last.endMs,
      text: sentence,
    });
    at += slice.length;
  });

  // Boundaries must tile: a gap between two chunks is a hole in the film's
  // timeline, and an overlap is two scenes claiming the same instant.
  for (let i = 1; i < chunks.length; i++) {
    const prev = chunks[i - 1] as AlignmentChunk;
    const cur = chunks[i] as AlignmentChunk;
    if (cur.startMs < prev.endMs) cur.startMs = prev.endMs;
    if (cur.endMs < cur.startMs) cur.endMs = cur.startMs;
  }
  return chunks;
}

/** No word timings, but a real measured duration — still strictly better
 *  than the nominal guess, because the total is now measured off the audio
 *  rather than estimated from character count. */
export function chunksFromDuration(
  sceneId: string,
  text: string,
  durationMs: number,
): AlignmentChunk[] {
  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    return [{ chunkId: `${sceneId}_c1`, startMs: 0, endMs: durationMs, text }];
  }
  const totalChars = sentences.reduce((a, t) => a + t.length, 0) || 1;
  let at = 0;
  return sentences.map((sentence, i) => {
    const share = (sentence.length / totalChars) * durationMs;
    const chunk: AlignmentChunk = {
      chunkId: `${sceneId}_c${i + 1}`,
      startMs: Math.round(at),
      endMs: i === sentences.length - 1 ? durationMs : Math.round(at + share),
      text: sentence,
    };
    at += share;
    return chunk;
  });
}

/** The segmenter anchors every scene to `{sceneId}_start` and
 *  `{sceneId}_end` before any narration exists — chunk ids that
 *  deliberately do not resolve yet, so the solver falls back to a nominal
 *  window and flags it. When the frozen alignment arrives it has to carry
 *  those two ids or the anchors would STILL not resolve and narration
 *  would change nothing. So the artifact carries both: per-sentence chunks
 *  for anything that wants to anchor inside a scene, plus the two
 *  scene-spanning chunks the authored anchors already name. */
export function withEndpoints(sceneId: string, chunks: AlignmentChunk[]): Alignment {
  if (chunks.length === 0) return { sceneId, chunks: [] };
  const first = chunks[0] as AlignmentChunk;
  const last = chunks[chunks.length - 1] as AlignmentChunk;
  return {
    sceneId,
    chunks: [
      ...chunks,
      { chunkId: `${sceneId}_start`, startMs: first.startMs, endMs: first.endMs },
      { chunkId: `${sceneId}_end`, startMs: last.startMs, endMs: last.endMs },
    ],
  };
}

/** Scene-local alignments → film-absolute ones.
 *
 *  Every alignment artifact is stored scene-local (starting at 0) because
 *  that is what it IS: a measurement of one audio file. The solver reads
 *  absolute times, because a scene's window is its position in the film.
 *  Walking the scenes in order and shifting each by the running cursor is
 *  the whole of the conversion — and it must happen against the IR's scene
 *  ORDER, not the map's iteration order, which is why it lives here rather
 *  than being done at load time.
 *
 *  Scenes with no artifact yet advance the cursor by their nominal
 *  duration and are left out of the returned map, so the solver still
 *  falls back and still flags them. A half-narrated film compiles. */
export function sequenceAlignments(
  scenes: Array<{ sceneId: string; timing: { minDurationMs: number } }>,
  local: Map<string, Alignment>,
): Map<string, Alignment> {
  const out = new Map<string, Alignment>();
  let cursor = 0;
  for (const scene of scenes) {
    const found = local.get(scene.sceneId);
    if (!found || found.chunks.length === 0) {
      cursor += Math.max(scene.timing.minDurationMs, 3000);
      continue;
    }
    const span = Math.max(...found.chunks.map((c) => c.endMs));
    out.set(scene.sceneId, {
      sceneId: scene.sceneId,
      chunks: found.chunks.map((c) => ({
        ...c,
        startMs: c.startMs + cursor,
        endMs: c.endMs + cursor,
      })),
    });
    cursor += span;
  }
  return out;
}

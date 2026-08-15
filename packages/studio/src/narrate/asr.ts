// MEASURING THE AUDIO. Extracted from the deleted align.ts.
//
// What is kept: the candidate ladder, and `readTimings` — which reads
// whatever shape came back rather than assuming one. That defensiveness is
// not decoration; the last serious bug in this system was an unverified
// assumption about a Workers AI response shape.
//
// What is DROPPED: `chunksFromWords`, `chunksFromDuration`, `withEndpoints`
// and `sequenceAlignments`. They split the ASR stream by token-count SHARE
// and never matched an ASR word to a source word — fine for a sentence
// boundary, useless for "this phrase lands when its word is spoken", which
// is the entire promise of the new engine. `timeline/words.ts` does the
// real alignment now.

import { describeShape, toBase64 } from "./tts.ts";

export interface TimedWord {
  word: string;
  startMs: number;
  endMs: number;
}

interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export interface AsrResult {
  ok: boolean;
  words: TimedWord[];
  durationMs: number;
  model?: string;
  reason?: string;
  attempts: { model: string; outcome: string; shape?: string }[];
}

/** Tried in order. The parameter names differ between these models, and
 *  being wrong about one should cost the next candidate, not the feature. */
export const ASR_CANDIDATES: {
  model: string;
  input: (bytes: Uint8Array) => Record<string, unknown>;
}[] = [
  {
    model: "@cf/openai/whisper-large-v3-turbo",
    input: (bytes) => ({ audio: toBase64(bytes), language: "en", task: "transcribe" }),
  },
  { model: "@cf/openai/whisper", input: (bytes) => ({ audio: [...bytes] }) },
];

export async function measureAudio(
  ai: AiBinding | undefined,
  bytes: Uint8Array,
): Promise<AsrResult> {
  const attempts: AsrResult["attempts"] = [];
  if (!ai || typeof ai.run !== "function") {
    return {
      ok: false,
      words: [],
      durationMs: 0,
      reason: "no AI binding — the audio cannot be measured outside the deployed Worker",
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
    return { ok: true, ...read, model: candidate.model, attempts };
  }
  return {
    ok: false,
    words: [],
    durationMs: 0,
    reason: "no ASR candidate returned timings",
    attempts,
  };
}

/** Pull word timings and a total duration out of whatever came back.
 *
 *  Whisper has returned `words: [{word,start,end}]`; the turbo variant
 *  returns `segments: [{start,end,text,words?}]` with a
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

/** Whisper reports seconds. A value already large enough to be
 *  milliseconds is left alone rather than multiplied into an hour. */
function toMs(v: number): number {
  return v > 1000 ? Math.round(v) : Math.round(v * 1000);
}

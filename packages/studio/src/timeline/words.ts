// THE WORD ALIGNER.
//
// The old code split the ASR word stream by TOKEN-COUNT SHARE and never
// matched an ASR word to a source word — its own docstring admitted it.
// That is adequate for a sentence boundary and useless for "this phrase
// appears when its own word is spoken", which is the whole promise of a
// narration-first engine.
//
// This does the real thing: Needleman–Wunsch between the essay's tokens and
// the transcript's. Spans are ~110 tokens, so the matrix is ~110×140 — a
// few microseconds, comfortably inside a Worker.
//
// AND IT REFUSES RATHER THAN GUESSES. Below a match-rate floor the
// alignment is discarded and the span falls back to proportional timing,
// marked unmeasured. Standing rule 7: determinism and measurement are
// claimed honestly or not at all.

import type { SpineWord } from "../film/schema.ts";
import type { TimedWord } from "../narrate/asr.ts";
import { type Located, normaliseToken } from "../text/prose.ts";

/** Below this share of matched source tokens the transcript is not a
 *  reading of this text, and pretending otherwise puts words on screen at
 *  the wrong moment. */
const MATCH_FLOOR = 0.6;

export interface AlignResult {
  words: SpineWord[];
  matchedFraction: number;
  measured: boolean;
}

/** Align one span's source words to its transcript.
 *
 *  @param sourceWords the essay's own words, WITH their char offsets
 *  @param heard       what the ASR returned, with times
 *  @param spanStartMs where this span begins on the film's clock
 *  @param durationMs  the span's measured duration
 */
export function alignSpan(
  sourceWords: Located[],
  heard: TimedWord[],
  spanStartMs: number,
  durationMs: number,
): AlignResult {
  if (sourceWords.length === 0) {
    return { words: [], matchedFraction: 0, measured: false };
  }
  if (heard.length === 0) {
    return {
      words: proportional(sourceWords, spanStartMs, durationMs),
      matchedFraction: 0,
      measured: false,
    };
  }

  const a = sourceWords.map((w) => normaliseToken(w.text));
  const b = heard.map((w) => normaliseToken(w.word));

  // ── Needleman–Wunsch ──────────────────────────────────────────────
  const GAP = -1;
  const n = a.length;
  const m = b.length;
  // Flat typed matrix: (n+1)×(m+1). Flat because a nested array of arrays
  // is a lie to the type checker at every index and a cache miss at every
  // read, and this is the one genuinely hot loop in the Worker.
  const W = m + 1;
  const score = new Int32Array((n + 1) * W);
  for (let i = 1; i <= n; i++) score[i * W] = i * GAP;
  for (let j = 1; j <= m; j++) score[j] = j * GAP;
  const at = (i: number, j: number) => score[i * W + j] as number;
  const pair = (i: number, j: number) => pairScore(a[i - 1] as string, b[j - 1] as string);

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      score[i * W + j] = Math.max(
        at(i - 1, j - 1) + pair(i, j),
        at(i - 1, j) + GAP,
        at(i, j - 1) + GAP,
      );
    }
  }

  // Trace back, recording which source token matched which heard token.
  const matchOf = new Int32Array(n).fill(-1);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const here = at(i, j);
    if (here === at(i - 1, j - 1) + pair(i, j)) {
      if (pair(i, j) > 0) matchOf[i - 1] = j - 1;
      i--;
      j--;
    } else if (here === at(i - 1, j) + GAP) {
      i--;
    } else {
      j--;
    }
  }

  const matched = [...matchOf].filter((x) => x >= 0).length;
  const matchedFraction = matched / n;
  if (matchedFraction < MATCH_FLOOR) {
    // NOT A READING OF THIS TEXT. Say so and fall back.
    return {
      words: proportional(sourceWords, spanStartMs, durationMs),
      matchedFraction,
      measured: false,
    };
  }

  // Matched tokens take the heard time. Unmatched ones are interpolated
  // between their matched neighbours and flagged — they are inferred, not
  // heard, and the spine must be able to say which is which.
  const out: SpineWord[] = sourceWords.map((w) => ({
    char: w.startChar,
    endChar: w.endChar,
    startMs: 0,
    endMs: 0,
    measured: false,
  }));
  for (let k = 0; k < n; k++) {
    const hit = matchOf[k] as number;
    if (hit < 0) continue;
    const h = heard[hit] as TimedWord;
    (out[k] as SpineWord).startMs = spanStartMs + h.startMs;
    (out[k] as SpineWord).endMs = spanStartMs + h.endMs;
    (out[k] as SpineWord).measured = true;
  }
  interpolate(out, spanStartMs, durationMs);
  return { words: out, matchedFraction, measured: true };
}

/** Exact match is worth most; a near-match rescues a plural or a hyphen. */
function pairScore(x: string, y: string): number {
  if (!x || !y) return -1;
  if (x === y) return 2;
  return similar(x, y) >= 0.7 ? 1 : -1;
}

/** Normalised edit distance, bounded so a long pair cannot dominate. */
function similar(x: string, y: string): number {
  const len = Math.max(x.length, y.length);
  if (len === 0) return 1;
  if (Math.abs(x.length - y.length) / len > 0.4) return 0;
  let prev = Array.from({ length: y.length + 1 }, (_, k) => k);
  for (let a = 1; a <= x.length; a++) {
    const row = [a];
    for (let b = 1; b <= y.length; b++) {
      row[b] = Math.min(
        (prev[b] as number) + 1,
        (row[b - 1] as number) + 1,
        (prev[b - 1] as number) + (x[a - 1] === y[b - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return 1 - (prev[y.length] as number) / len;
}

/** Fill unmeasured gaps from their neighbours; the ends from the span. */
function interpolate(words: SpineWord[], startMs: number, durationMs: number) {
  const n = words.length;
  let k = 0;
  while (k < n) {
    if ((words[k] as SpineWord).measured) {
      k++;
      continue;
    }
    let end = k;
    while (end < n && !(words[end] as SpineWord).measured) end++;
    const before = k > 0 ? (words[k - 1] as SpineWord).endMs : startMs;
    const after = end < n ? (words[end] as SpineWord).startMs : startMs + durationMs;
    const gap = Math.max(0, after - before);
    const each = gap / (end - k + 1);
    for (let q = k; q < end; q++) {
      const w = words[q] as SpineWord;
      w.startMs = Math.round(before + each * (q - k));
      w.endMs = Math.round(before + each * (q - k + 1));
    }
    k = end;
  }
}

/** No usable transcript: share the span's duration by word length. Every
 *  word is flagged unmeasured, so nothing downstream can mistake this for
 *  a measurement. */
function proportional(source: Located[], startMs: number, durationMs: number): SpineWord[] {
  const total = source.reduce((n, w) => n + w.text.length, 0) || 1;
  let at = startMs;
  return source.map((w) => {
    const dur = (durationMs * w.text.length) / total;
    const out: SpineWord = {
      char: w.startChar,
      endChar: w.endChar,
      startMs: Math.round(at),
      endMs: Math.round(at + dur),
      measured: false,
    };
    at += dur;
    return out;
  });
}

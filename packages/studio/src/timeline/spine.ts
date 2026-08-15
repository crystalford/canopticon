// THE AUTHORITATIVE TEMPORAL SPINE, from measured audio.
//
// Narration establishes the clock and the visual system answers to it.
// That is the inversion this engine exists for: the old one built pictures
// first and attached sound afterwards.
//
// The same `WordSpine` shape comes out of `estimate.ts` when there is no
// voice, so nothing downstream branches on whether a film is narrated.

import type { NarrationSpan, SpinePause, SpineWord, WordSpine } from "../film/schema.ts";
import type { TimedWord } from "../narrate/asr.ts";
import { locateWords } from "../text/prose.ts";
import { alignSpan } from "./words.ts";

const MIN_PAUSE_MS = 120;
const MAX_PAUSE_MS = 2400;

export interface MeasuredSpan {
  span: NarrationSpan;
  heard: TimedWord[];
  durationMs: number;
}

/** Assemble the film's spine from its measured spans. */
export function buildSpine(essay: string, measured: MeasuredSpan[]): WordSpine {
  const words: SpineWord[] = [];
  const pauses: SpinePause[] = [];
  let cursor = 0;
  let anyMeasured = false;
  let allMeasured = measured.length > 0;

  for (const [i, m] of measured.entries()) {
    // The essay's own words for this span, WITH their offsets — the
    // alignment is against the source text, not against a copy of it.
    const source = locateWords(essay.slice(m.span.range.startChar, m.span.range.endChar)).map(
      (w) => ({
        text: w.text,
        startChar: w.startChar + m.span.range.startChar,
        endChar: w.endChar + m.span.range.startChar,
      }),
    );
    const aligned = alignSpan(source, m.heard, cursor, m.durationMs);
    if (aligned.measured) anyMeasured = true;
    else allMeasured = false;
    words.push(...aligned.words);

    // Breaths INSIDE the span, from the gaps between its own words.
    for (let k = 1; k < aligned.words.length; k++) {
      const gap =
        (aligned.words[k] as SpineWord).startMs - (aligned.words[k - 1] as SpineWord).endMs;
      if (gap >= MIN_PAUSE_MS) {
        pauses.push({
          atMs: (aligned.words[k - 1] as SpineWord).endMs,
          ms: Math.min(gap, MAX_PAUSE_MS),
          kind: "breath",
        });
      }
    }

    cursor += m.durationMs;
    // The join between two spans is a real rest — the voice stopped and
    // started. It is the strongest cut point the film has.
    if (i < measured.length - 1) {
      pauses.push({ atMs: cursor, ms: 320, kind: "section" });
      cursor += 320;
    }
  }

  const spoken = words.length;
  const medianWpm =
    spoken > 1 && cursor > 0 ? Math.round((spoken / (cursor / 60_000)) * 10) / 10 : null;
  const source: WordSpine["source"] = allMeasured
    ? "measured"
    : anyMeasured
      ? "mixed"
      : "estimated";

  return {
    source,
    totalMs: Math.round(cursor),
    words,
    pauses,
    medianWpm,
    describes: describe(source, words, measured.length),
  };
}

/** The honest one-liner. The old timeline said this too, and it is the
 *  reason nobody ever mistook an estimate for a measurement there. */
function describe(source: WordSpine["source"], words: SpineWord[], spans: number): string {
  const heard = words.filter((w) => w.measured).length;
  if (source === "measured") {
    return `measured from ${spans} recorded span${spans === 1 ? "" : "s"} — every word timed to the voice`;
  }
  if (source === "mixed") {
    return `${heard} of ${words.length} words timed to the voice; the rest interpolated where the transcript did not match`;
  }
  return "no span aligned — timings are shares of the measured duration, not heard positions";
}

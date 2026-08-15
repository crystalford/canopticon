// THE SPINE WITHOUT NARRATION.
//
// This produces the IDENTICAL `WordSpine` shape that measured audio
// produces. That is the whole point: `buildCut` never asks whether the film
// has a voice. Narration is a branch of one architecture, not a plugin
// attached to a visuals-first pipeline — which is precisely what went wrong
// before.
//
// Every word here is `measured: false`, and `source` is `"estimated"`, so
// nothing downstream can mistake a rate model for a measurement.

import type { SpinePause, SpineWord, WordSpine } from "../film/schema.ts";
import type { Section } from "../film/schema.ts";
import { locateWords, plainProse } from "../text/prose.ts";

/** Documentary pace. The same number the Create page has always shown the
 *  writer as "spoken seconds" — one number, one meaning, in one place. */
export const BASE_WPM = 150;

const SENTENCE_PAUSE_MS = 280;
const PARAGRAPH_PAUSE_MS = 600;
const SECTION_PAUSE_MS = 900;

/** How fast each kind of section reads. A turn slows down; an escalation
 *  speeds up. This is the one place written structure is allowed to shape
 *  time in the absence of a voice. */
const RATE: Partial<Record<Section["function"], number>> = {
  hook: 0.9,
  turn: 0.85,
  escalation: 1.15,
  resolution: 0.9,
};

export function estimateSpine(essay: string, sections: Section[]): WordSpine {
  const words = locateWords(essay);
  if (words.length === 0) {
    return {
      source: "estimated",
      totalMs: 0,
      words: [],
      pauses: [],
      medianWpm: null,
      describes: "nothing to speak",
    };
  }

  const msPerWord = 60_000 / BASE_WPM;
  const out: SpineWord[] = [];
  const pauses: SpinePause[] = [];
  let at = 0;

  for (const [i, w] of words.entries()) {
    const section = sections.find(
      (s) => w.startChar >= s.range.startChar && w.startChar < s.range.endChar,
    );
    const rate = (section && RATE[section.function]) ?? 1;
    // Longer words take longer to say. Crude, and much better than a flat
    // per-word constant when a sentence is mostly "the" and "of".
    const lengthFactor = 0.72 + Math.min(1.6, w.text.length / 6) * 0.34;
    const dur = (msPerWord * lengthFactor) / rate;

    out.push({
      char: w.startChar,
      endChar: w.endChar,
      startMs: Math.round(at),
      endMs: Math.round(at + dur),
      measured: false,
    });
    at += dur;

    // What comes after this word, read off the punctuation between it and
    // the next one.
    const next = words[i + 1];
    if (!next) break;
    const between = essay.slice(w.endChar, next.startChar);
    const crossesSection =
      section !== undefined &&
      sections.some((s) => s !== section && next.startChar >= s.range.startChar) &&
      next.startChar >= section.range.endChar;
    const gap = crossesSection
      ? SECTION_PAUSE_MS
      : /\n\s*\n/.test(between)
        ? PARAGRAPH_PAUSE_MS
        : /[.!?]/.test(between)
          ? SENTENCE_PAUSE_MS
          : 0;
    if (gap > 0) {
      pauses.push({
        atMs: Math.round(at),
        ms: gap,
        kind: crossesSection ? "section" : /\n\s*\n/.test(between) ? "beat" : "breath",
      });
      at += gap;
    }
  }

  const totalMs = Math.round(at);
  const spoken = plainProse(essay).split(/\s+/).filter(Boolean).length;
  return {
    source: "estimated",
    totalMs,
    words: out,
    pauses,
    medianWpm: BASE_WPM,
    describes: `estimated from ${spoken} words at ${BASE_WPM}wpm — no narration was recorded`,
  };
}

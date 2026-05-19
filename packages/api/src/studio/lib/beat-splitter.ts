// Beat splitter — pure, deterministic. Turns a long markdown script
// into a list of beats with role tags + target durations. No AI; the
// AI runs upstream in script-ideator.ts and emits the structured beat
// list directly. This is the fallback for when an operator pastes a
// pre-written script and just wants it chunked.

export interface RawBeat {
  beat_index: number;
  role: "open" | "context" | "turn" | "evidence" | "reflect" | "close" | "transition";
  cue: string;
  beat_text: string;
  next_preview: string;
  target_seconds: number;
}

// Average spoken pace ~ 150 wpm = 2.5 wps.
const WORDS_PER_SECOND = 2.5;

const ROLE_BY_INDEX = (i: number, total: number): RawBeat["role"] => {
  if (i === 0) return "open";
  if (i === total - 1) return "close";
  if (i === Math.floor(total / 2)) return "turn";
  return "context";
};

/** Split a markdown script into beats by paragraph break. Each beat
 *  gets a target_seconds estimate from its word count. */
export function splitScript(script: string): RawBeat[] {
  const paragraphs = script
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !p.startsWith("#"));

  if (paragraphs.length === 0) return [];

  return paragraphs.map((text, i) => {
    const next = paragraphs[i + 1] ?? "";
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    return {
      beat_index: i,
      role: ROLE_BY_INDEX(i, paragraphs.length),
      cue: cueFor(text),
      beat_text: text,
      next_preview: next.slice(0, 120),
      target_seconds: Math.max(5, Math.round(wordCount / WORDS_PER_SECOND)),
    };
  });
}

function cueFor(text: string): string {
  const firstSentence = text.split(/[.!?]/)[0] ?? "";
  return firstSentence.split(/\s+/).slice(0, 4).join(" ").toUpperCase();
}

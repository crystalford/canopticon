// NARRATION SPANS — the unit the voice actually reads.
//
// The old engine spoke ONE SCENE PER CALL: 88 scenes meant 176 model
// calls, and the voice read clauses out of context so the prosody was
// flat. A paragraph is the natural unit of speech and the natural unit of
// an argument, and a 60-second film becomes 4-6 spans / 8-12 calls.

import type { EditorialModel, NarrationSpan } from "../film/schema.ts";
import { plainProse } from "../text/prose.ts";

/** Long enough to read naturally, short enough that one failure costs
 *  little and the aligner's matrix stays small. */
const MAX_WORDS = 110;

export function planSpans(essay: string, editorial: EditorialModel): NarrationSpan[] {
  const out: NarrationSpan[] = [];
  const sections = editorial.sections.length
    ? editorial.sections
    : [{ range: { startChar: 0, endChar: essay.length } }];

  for (const section of sections) {
    let { startChar } = section.range;
    const { endChar } = section.range;
    while (startChar < endChar) {
      let cut = endChar;
      // Walk back to a sentence end if the span is too long to read.
      if (countWords(essay.slice(startChar, endChar)) > MAX_WORDS) {
        const slice = essay.slice(startChar, endChar);
        let at = 0;
        let taken = 0;
        const re = /[.!?](?=\s|$)/g;
        let m = re.exec(slice);
        while (m !== null) {
          const words = countWords(slice.slice(at, m.index + 1));
          if (taken + words > MAX_WORDS && taken > 0) break;
          taken += words;
          at = m.index + 1;
          m = re.exec(slice);
        }
        // A single sentence longer than the cap is spoken whole rather
        // than chopped mid-clause.
        cut = at > 0 ? startChar + at : endChar;
      }
      const text = plainProse(essay.slice(startChar, cut)).trim();
      if (text) {
        out.push({
          spanId: `sp${out.length + 1}`,
          range: { startChar, endChar: cut },
          text,
        });
      }
      startChar = cut;
    }
  }
  return out;
}

const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;

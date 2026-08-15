// Essay → its own structure. Deterministic, no model, no visual anything.
//
// This is the honest half of the deleted `compile/segment.ts`: it finds the
// units the author actually wrote — headings, paragraphs, sentences — and
// stops. It does NOT decide what a sentence is about, does not create
// "scenes", and does not bind anything to a picture.

import { type Located, locateParagraphs, locateSentences, plainProse } from "../text/prose.ts";

export interface Block {
  /** A markdown heading the author wrote, or null for body prose. */
  heading: string | null;
  startChar: number;
  endChar: number;
  paragraphs: Located[];
}

export interface Segmentation {
  title: string;
  blocks: Block[];
  sentences: Located[];
  /** Words as spoken, for rate estimation. */
  spokenWords: number;
}

const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.+?)\s*$/;

/** Split the essay at the author's own headings, then by paragraph.
 *
 *  The author's paragraph is the most reliable structural signal in any
 *  essay and it is free. A blank line means something; guessing at topic
 *  boundaries when the writer already drew them is worse than reading. */
export function segmentEssay(essay: string): Segmentation {
  const paragraphs = locateParagraphs(essay);
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const para of paragraphs) {
    const heading = para.text.match(HEADING_RE);
    if (heading) {
      if (current) blocks.push(current);
      current = {
        heading: (heading[2] ?? "").trim(),
        startChar: para.startChar,
        endChar: para.endChar,
        paragraphs: [],
      };
      continue;
    }
    if (!current) {
      current = { heading: null, startChar: para.startChar, endChar: para.endChar, paragraphs: [] };
    }
    current.paragraphs.push(para);
    current.endChar = para.endChar;
  }
  if (current) blocks.push(current);

  // A heading with nothing under it is a title, not a section.
  const titled = blocks.length > 0 && blocks[0]?.paragraphs.length === 0;
  let title = titled ? (blocks[0]?.heading ?? "") : "";
  let body = titled ? blocks.slice(1) : blocks;
  // THE BARE TITLE LINE. Most people paste an essay whose first line is its
  // title with no `#`. Left alone it becomes a paragraph, and — because
  // sentence splitting needs terminal punctuation and a title has none —
  // it GLUES ITSELF TO THE FIRST REAL SENTENCE. The opening beat then
  // carries "Gimmick Economy Jeremy Hambly built a career…" as one unit.
  let titleEnd = 0;
  if (!titled) {
    const bare = firstLineTitle(essay);
    if (bare) {
      title = bare;
      titleEnd = essay.indexOf(bare) + bare.length;
      body = body
        .map((b) => ({ ...b, paragraphs: b.paragraphs.filter((p) => p.startChar >= titleEnd) }))
        .filter((b) => b.paragraphs.length > 0 || b.heading);
      const first = body[0];
      if (first && first.startChar < titleEnd) first.startChar = titleEnd;
    }
  }

  // Sentences are located in the BODY and shifted back into essay
  // coordinates — not located in the whole essay and filtered, which would
  // discard the first real sentence along with the title it is glued to.
  const sentences = locateSentences(essay.slice(titleEnd))
    .map((s) => ({
      text: s.text,
      startChar: s.startChar + titleEnd,
      endChar: s.endChar + titleEnd,
    }))
    .filter((s) => !HEADING_RE.test(s.text));

  return {
    title: title || "Untitled",
    blocks: body.length > 0 ? body : blocks,
    sentences,
    spokenWords: plainProse(essay.slice(titleEnd)).split(/\s+/).filter(Boolean).length,
  };
}

/** A bare first line, short and unpunctuated, is a title even without a
 *  `#`. Most people paste essays that way. */
function firstLineTitle(essay: string): string {
  const first = essay.split(/\n/, 1)[0]?.trim() ?? "";
  if (!first) return "";
  const looksLikeTitle = first.length <= 80 && !/[.!?]$/.test(first);
  return looksLikeTitle ? first.replace(HEADING_RE, "$2") : "";
}

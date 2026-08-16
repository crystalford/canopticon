// Reading prose as prose. No visual vocabulary anywhere in this file.
//
// `plainProse` is extracted verbatim from the deleted `compile/segment.ts`,
// including the rule that made it correct: markdown is stripped from what is
// SPOKEN and SHOWN, never from the stored essay. Every beat binds to the
// essay by character offset, so the source text must stay exactly as pasted.

/** Markdown → the words a voice would actually say. */
export function plainProse(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // [label](url) → label
    .replace(/(\*\*\*|___)(.+?)\1/g, "$2") // ***both***
    .replace(/(\*\*|__)(.+?)\1/g, "$2") // **bold**
    .replace(/(?<![\w*])[*_](?![\s*])(.+?)(?<![\s*])[*_](?![\w*])/g, "$1") // *emphasis*
    .replace(/`([^`]+)`/g, "$1") // `code`
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // # heading markers
    .replace(/^\s{0,3}>\s?/gm, "") // > quote markers
    .replace(/^\s{0,3}(?:[-*+]|\d+[.)])\s+/gm, "") // list bullets
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Split on sentence-ending punctuation followed by whitespace. Keeps the
 *  terminator with its sentence so the reconstructed text is lossless. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export interface Located {
  text: string;
  startChar: number;
  endChar: number;
}

/** Sentences WITH their offsets into the original essay.
 *
 *  Scanning forward from a moving cursor rather than using `indexOf` from
 *  zero: a sentence repeated verbatim later in the essay must bind to its
 *  OWN occurrence, not to the first one. That bug is cheap to write and
 *  produces a film whose highlight jumps to the wrong paragraph. */
export function locateSentences(essay: string): Located[] {
  const out: Located[] = [];
  let cursor = 0;
  for (const sentence of splitSentences(essay)) {
    const at = essay.indexOf(sentence, cursor);
    if (at < 0) continue;
    out.push({ text: sentence, startChar: at, endChar: at + sentence.length });
    cursor = at + sentence.length;
  }
  return out;
}

/** Paragraphs with offsets — blank-line separated, headings kept as their
 *  own paragraph so a section reader can see them. */
export function locateParagraphs(essay: string): Located[] {
  const out: Located[] = [];
  const re = /[^\n]+(?:\n(?!\s*\n)[^\n]+)*/g;
  let m = re.exec(essay);
  while (m !== null) {
    const text = m[0].trim();
    if (text.length > 0) {
      out.push({ text, startChar: m.index, endChar: m.index + m[0].length });
    }
    m = re.exec(essay);
  }
  return out;
}

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

/** Words with offsets. The unit the timeline is built from. */
export function locateWords(essay: string): Located[] {
  const out: Located[] = [];
  let m = WORD_RE.exec(essay);
  while (m !== null) {
    out.push({ text: m[0], startChar: m.index, endChar: m.index + m[0].length });
    m = WORD_RE.exec(essay);
  }
  WORD_RE.lastIndex = 0;
  return out;
}

/** One token, comparable across a TTS voice and an ASR transcript.
 *
 *  Digits are spelled out because this is the single most common mismatch
 *  in the whole alignment: the essay writes "41", the voice says "forty
 *  one", and the transcript writes what it heard. Without this the aligner
 *  drops every sentence containing a number. */
export function normaliseToken(word: string): string {
  const bare = word
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
  if (!/^\d+$/.test(bare)) return bare;
  return spellNumber(Number.parseInt(bare, 10)).replace(/[^a-z]/g, "");
}

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** Small-number spelling. Deliberately shallow: it exists to make token
 *  comparison work, not to be a number-to-words library. Anything above
 *  the range it handles falls back to the digits, which simply means those
 *  tokens align on their neighbours instead. */
export function spellNumber(n: number): string {
  if (!Number.isFinite(n) || n < 0) return String(n);
  if (n < 20) return ONES[n] as string;
  if (n < 100) {
    const t = TENS[Math.floor(n / 10)] as string;
    const r = n % 10;
    return r === 0 ? t : `${t}${ONES[r]}`;
  }
  if (n < 1000) {
    const h = `${ONES[Math.floor(n / 100)]}hundred`;
    const r = n % 100;
    return r === 0 ? h : `${h}${spellNumber(r)}`;
  }
  // Years read as pairs — "1997" is spoken "nineteen ninety seven".
  if (n >= 1100 && n < 2000) {
    return `${spellNumber(Math.floor(n / 100))}${spellNumber(n % 100)}`;
  }
  if (n < 1_000_000) {
    const th = `${spellNumber(Math.floor(n / 1000))}thousand`;
    const r = n % 1000;
    return r === 0 ? th : `${th}${spellNumber(r)}`;
  }
  return String(n);
}

const STOPWORDS = new Set(
  (
    "a an and are as at be been but by for from had has have he her his i if in is it its of on or " +
    "she that the their them there they this to was were what when which who will with you your"
  ).split(" "),
);

export const isStopword = (word: string) => STOPWORDS.has(normaliseToken(word));

/** A phrase may never begin or end on a function word. Extracted as a rule
 *  rather than a file: "of the temporary" reads as a mistake on screen, and
 *  every phrase the film promotes passes through here. */
export function trimToStrongEdges(phrase: string): string {
  const words = phrase.trim().split(/\s+/);
  while (words.length > 1 && isStopword(words[0] as string)) words.shift();
  while (words.length > 1 && isStopword(words[words.length - 1] as string)) words.pop();
  return words.join(" ").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

const FIGURE_RE =
  /(?:[$£€]\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:million|billion|thousand))?|\b\d[\d,]*(?:\.\d+)?\s?(?:%|per cent|percent)|\b(?:19|20)\d{2}\b|\b\d[\d,]{2,}(?:\.\d+)?\b)/;
const PROPER_RUN_RE =
  /\b(?:[A-Z][\w'’-]*)(?:\s+(?:of|the|and|for|de|van|von)?\s*[A-Z][\w'’-]*)*\b/g;

/** Whatever the essay's own words are, in a given char range, when nothing
 *  else has chosen text for it. Never invented — a printed figure, then a
 *  name, then the range's own strongest short clause. Verified as a literal
 *  substring at its own offset before it is ever returned, the same rule
 *  every promoted phrase in this codebase is held to.
 *
 *  A shared fallback rather than one written twice: both the rules editor
 *  (which builds phrases sentence-by-sentence) and the model verifier
 *  (which needs a last-resort phrase for a beat the model left empty) need
 *  the identical "find something real to show" logic, and a second copy is
 *  how the two drift apart. */
export function pickPhraseInRange(
  essay: string,
  startChar: number,
  endChar: number,
): { text: string; offset: number } | null {
  const slice = essay.slice(startChar, endChar);

  const fig = slice.match(FIGURE_RE);
  if (fig?.index !== undefined) {
    return verifiedAt(essay, startChar + fig.index, fig[0]);
  }

  const runs = [...slice.matchAll(PROPER_RUN_RE)]
    // Skip a capital that is only there because it opens the sentence.
    .filter((m) => (m.index ?? 0) > 0 || m[0].split(/\s+/).length > 1)
    .sort((a, b) => b[0].length - a[0].length);
  const run = runs[0];
  if (run?.index !== undefined && run[0].length >= 4) {
    return verifiedAt(essay, startChar + run.index, run[0]);
  }

  const clause = slice.split(/[,;:—.!?]/)[0] ?? slice;
  const trimmed = trimToStrongEdges(clause);
  const at = slice.indexOf(trimmed);
  const wordCount = trimmed.split(/\s+/).length;
  if (trimmed.length >= 4 && wordCount <= 7 && at >= 0) {
    return verifiedAt(essay, startChar + at, trimmed);
  }

  return null;
}

function verifiedAt(
  essay: string,
  offset: number,
  text: string,
): { text: string; offset: number } | null {
  return essay.slice(offset, offset + text.length) === text ? { text, offset } : null;
}

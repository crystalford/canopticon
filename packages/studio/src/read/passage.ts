// WHAT THIS PASSAGE IS, AND HOW IT RELATES TO THE LAST ONE.
//
// THE HOLE THIS FILLS, stated plainly because it is the largest mistake in
// this engine's history. Every visual decision the compositor made — which
// world, which register, which layout, which treatment, which cut — came from
// position in the film, an editorial role, a seed, and this:
//
//     Math.floor(beat.sourceRange.startChar / 420)
//
// A character counter, dressed up as "sections". The film changed worlds every
// 420 characters of essay, whatever the essay was doing. Nothing anywhere read
// what a sentence actually said. That was a deliberate rule — "no noun reaches
// a picture" — written into the header of every file as a virtue, and it is
// why the operator kept saying THE SAME THING, SAME THING: a film whose
// changes are uncaused reads as decoration, not as development. It cannot know
// the essay moved from rectangles to paper to demos, so it cannot go anywhere.
//
// THE CORRECTION, AND ITS LIMIT. The early engine DID read the sentence, and
// changed scene when the sentence changed — that part was right. What was
// wrong was the mapping: a lookup table from a noun to one of exactly two
// object generators, which is how every film ended up with the same centipede
// and the same smoke detector in it. The principle was sound and the
// vocabulary was two entries wide. Removing the principle to fix the
// vocabulary was the wrong repair.
//
// So this file reads KIND, not THING. It never names an object and there is no
// lexicon of nouns to draw. It answers three questions a reader could answer
// about any paragraph without interpreting it:
//
//   1. WHAT KIND of passage is this — a claim, a quantity, a list, a
//      question, a concession, an attribution, a negation, an exposition?
//   2. HOW FAR is it from the passage before it, in its own vocabulary?
//   3. HAS THIS BEEN HERE BEFORE — does it return to something earlier?
//
// All three are checkable against the prose the way a figure is, so this needs
// no model and no ratification. And (3) is what makes a film carry something
// through: a topic that comes back gets the world it had before, worn.

/** The kinds a passage can be. Deliberately about the SHAPE of the writing,
 *  never its subject — "this is a quantity" is a fact about the sentence;
 *  "this is about a city" is an interpretation. */
export const PASSAGE_KINDS = [
  "CLAIM",
  "QUANTITY",
  "ENUMERATION",
  "QUESTION",
  "ATTRIBUTED",
  "NEGATION",
  "CONCESSION",
  "DIRECTIVE",
  "EXPOSITION",
] as const;

export type PassageKind = (typeof PASSAGE_KINDS)[number];

export interface PassageReading {
  kind: PassageKind;
  /** Content words, lowercased, stopwords removed. The topic signature. */
  terms: string[];
  /** 0..1. How much of this passage's vocabulary is new since the last one.
   *  This is what decides whether the film changes or holds. */
  novelty: number;
  /** Index of an EARLIER passage this one substantially returns to, or null.
   *  A returning topic is the film's memory, and the reason anything carries
   *  through at all. */
  returnsTo: number | null;
  /** A DETERMINISTIC PROJECTION OF THIS PASSAGE'S VOCABULARY.
   *
   *  Twelve numbers in 0..1, produced by hashing each content word to a fixed
   *  direction and averaging. Crude by design — no model, no training, and
   *  checkable by running it twice — but real: two passages sharing vocabulary
   *  land near each other and two that share none land apart.
   *
   *  WHY THIS EXISTS. Measured across three genuinely different essays, the
   *  films' visual trajectories were 0.44–0.70 apart in a space where two
   *  random points average 1.4 — because the trajectory came from the SEED.
   *  Two essays with the same seed walked the same path and the writing only
   *  decided when to step, not where to go. That is a template however large
   *  the space is. This is what makes an essay about an audit land somewhere
   *  an essay about baking bread does not. */
  signature: number[];
  /** TEMPO — how fast this passage wants to be read, 0 slow to 1 urgent.
   *
   *  Read off the prose itself: short sentences and hard stops are quick,
   *  long subordinated ones are slow. Punctuation density is the strongest
   *  signal a text gives about its own pace and it costs nothing to read.
   *  This is what lets a film slow down for one thing and then rush. */
  tempo: number;
  /** WEIGHT — how much this passage deserves to be dwelt on. A short
   *  declarative sentence standing alone is a held moment; a clause inside a
   *  list is not. */
  weight: number;
  /** Surface facts, each checkable by reading the sentence. */
  hasFigure: boolean;
  hasProperNoun: boolean;
  isShort: boolean;
}

/** Words that carry no topic. Kept short and boring on purpose — a long
 *  hand-tuned stopword list is a place for opinions to hide. */
const STOP = new Set(
  (
    "a an and are as at be been but by for from had has have he her his i if in into is it its" +
    " me my no not of on or our out she so than that the their them then there these they this" +
    " to too was we were what when which who will with would you your"
  ).split(" "),
);

const FIGURE =
  /\b(\d[\d,.]*|one|two|three|four|five|six|seven|eight|nine|ten|dozens?|hundreds?|thousands?|millions?|billions?)\b/i;
const HEDGE =
  /\b(presented as|framed as|described as|said to|reportedly|allegedly|according to)\b/i;
const CONCEDE = /\b(but|however|although|though|even if|admittedly|granted|yet)\b/i;
const NEGATE = /\b(not|never|no longer|nothing|nobody|cannot|can't|didn't|doesn't|isn't|wasn't)\b/i;
const DIRECT = /\b(must|should|ought|need to|have to|let's|stop|build|do not|don't)\b/i;

export function termsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** Jaccard overlap. Used for NOVELTY, where symmetry is what is wanted. */
function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit++;
  return hit / (a.size + b.size - hit);
}

/** CONTAINMENT, for detecting a return.
 *
 *  Jaccard is the wrong instrument here and measuring it proved so: between
 *  two paragraphs of an essay it lands around 0.03 even when they are plainly
 *  about the same thing, because each has twenty words the other lacks. Every
 *  return in a real essay went undetected — the film's only memory mechanism
 *  never once fired. Containment asks the right question: how much of the
 *  SMALLER passage is present in the larger one. */
function contains(a: Set<string>, b: Set<string>): { score: number; shared: number } {
  if (a.size === 0 || b.size === 0) return { score: 0, shared: 0 };
  let hit = 0;
  for (const t of a) if (b.has(t)) hit++;
  return { score: hit / Math.min(a.size, b.size), shared: hit };
}

function kindOf(text: string, terms: string[]): PassageKind {
  if (/\?/.test(text)) return "QUESTION";
  if (FIGURE.test(text)) return "QUANTITY";
  if (HEDGE.test(text) || /["“”]/.test(text)) return "ATTRIBUTED";
  if (DIRECT.test(text)) return "DIRECTIVE";
  if (CONCEDE.test(text)) return "CONCESSION";
  if (NEGATE.test(text)) return "NEGATION";
  // Three or more commas, or an explicit series, is a list however it reads.
  if ((text.match(/,/g) ?? []).length >= 3) return "ENUMERATION";
  if (terms.length > 22) return "EXPOSITION";
  return "CLAIM";
}

/** Read every passage, in order, with each one able to see the ones before it.
 *
 *  Order matters and is the point: novelty and return are RELATIONS, and a
 *  passage read in isolation cannot have either. This is where a film gets a
 *  memory.
 */
/** Hash a word to a stable direction in `d` dimensions. Deterministic and
 *  cheap; the only property required is that different words disagree. */
function project(word: string, d: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < word.length; i++) {
    h ^= word.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[] = [];
  for (let k = 0; k < d; k++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    out.push(((h >>> 0) % 10000) / 10000 - 0.5);
  }
  return out;
}

const SIG_DIMS = 12;

export function readPassages(texts: string[]): PassageReading[] {
  const out: PassageReading[] = [];
  const sets: Set<string>[] = [];

  for (const [i, text] of texts.entries()) {
    const terms = termsOf(text);
    const set = new Set(terms);
    const prev = sets[i - 1];

    // How much of this is new. A passage that repeats the last one's
    // vocabulary is the same subject continuing and the film should hold; one
    // that shares almost nothing has moved and the film should move with it.
    const novelty = prev ? 1 - overlap(set, prev) : 1;

    // Does this come back to something from earlier? Adjacent passages are
    // excluded — that is continuation, not return, and treating it as return
    // would make every film loop on itself immediately.
    let returnsTo: number | null = null;
    let best = 0.17; // floor: below this it is coincidence, not a callback
    for (let j = 0; j < i - 1; j++) {
      const c = contains(set, sets[j] as Set<string>);
      // Two shared content words minimum. One is an accident of vocabulary;
      // a single common word must never be enough to make a film loop.
      if (c.shared >= 2 && c.score > best) {
        best = c.score;
        returnsTo = j;
      }
    }

    // Average the words' directions, then squash to 0..1. Averaging is what
    // makes it a topic rather than a hash: a passage's signature moves only a
    // little when one word changes and a lot when the subject does.
    const acc = new Array(SIG_DIMS).fill(0);
    for (const t of terms) {
      const v = project(t, SIG_DIMS);
      for (let k = 0; k < SIG_DIMS; k++) acc[k] += v[k] as number;
    }
    const n = Math.max(1, terms.length);
    const signature = acc.map((v) => {
      // √n normalisation: the mean of n random directions shrinks as 1/√n, so
      // dividing by n alone would make every long passage converge on 0.5 and
      // every film about anything would look the same.
      const z = (v / n) * Math.sqrt(n) * 2.2;
      return Math.max(0, Math.min(1, 0.5 + z));
    });

    // TEMPO AND WEIGHT, from the writing's own shape.
    const sentences = text.split(/[.!?]+/).filter((x) => x.trim().length > 0);
    const meanLen =
      sentences.length > 0
        ? sentences.reduce((n, x) => n + x.trim().split(/\s+/).length, 0) / sentences.length
        : terms.length;
    // A twenty-eight-word sentence and a five-word one are read at different
    // speeds by any reader; this is that, normalised.
    const tempo = Math.max(0, Math.min(1, 1 - (meanLen - 5) / 26));
    const stops = (text.match(/[.!?;:]/g) ?? []).length / Math.max(1, terms.length);
    const weight = Math.max(
      0,
      Math.min(
        1,
        (sentences.length <= 2 ? 0.6 : 0.2) + stops * 2.2 + (terms.length < 12 ? 0.3 : 0),
      ),
    );

    out.push({
      signature,
      tempo,
      weight,
      kind: kindOf(text, terms),
      terms: terms.slice(0, 24),
      novelty,
      returnsTo,
      hasFigure: FIGURE.test(text),
      hasProperNoun: /\b[A-Z][a-z]{2,}/.test(text.slice(1)),
      isShort: terms.length < 8,
    });
    sets.push(set);
  }
  return out;
}

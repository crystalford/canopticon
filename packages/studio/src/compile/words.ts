// WORDS — the sentence as a set of typographic objects.
//
// THE DISTINCTION THIS FILE EXISTS TO MAKE.
//
//   A CAPTION tells the viewer what the narration says.
//   TYPOGRAPHY interprets the narration visually.
//
// Those are different jobs and the system has only ever done the first.
// `phrase.ts` picks ONE phrase per scene — a good phrase, chosen not
// truncated — and hands it to whatever primitive takes a `text` param. A
// typographic film needs more than that: it needs to know which words can
// carry a frame alone, which are worth repeating forty times, which are
// the hinge of a contradiction, and which are merely grammar.
//
// So this ranks every word in a sentence and says WHAT KIND of object each
// one is. Nothing here is a model call. A word's rank comes from what it
// is — a printed figure, a proper noun, a named subject, the verb between
// two things — all of which are already checkable facts about the prose.
//
// WHY RANK RATHER THAN SELECT. A typographic scene is a COMPOSITION of
// several words at different scales, not one word blown up. "EACH
// DECISION" small, "DECISION" forty times, "TOGETHER" once, "SOMETHING
// ELSE" filling the frame — that is four ranks of one sentence, and a
// picker returning a single string cannot express it.

import type { DetectedSubject } from "./subject.ts";

export type WordRole =
  /** A number the prose printed. Never invented, never approximated —
   *  same firewall the figures keep everywhere else. */
  | "FIGURE"
  /** A capitalised name mid-sentence. */
  | "PROPER"
  /** A noun the subject lexicon knows. */
  | "SUBJECT"
  /** The verb between two named things. */
  | "ACTION"
  /** A word that negates or reverses — the hinge of a contradiction, and
   *  the most typographically useful word in most sentences. */
  | "TURN"
  /** An abstraction: system, decision, pattern, meaning. Undepictable and
   *  therefore exactly what typography is for. */
  | "CONCEPT"
  /** Everything else that is not grammar. */
  | "PLAIN";

export interface SignificantWord {
  text: string;
  /** As it appears in the prose, verbatim, so a typographic frame is
   *  checkable against the sentence exactly like a figure is. */
  verbatim: string;
  role: WordRole;
  /** 0..1. What this word could carry: 1 fills a frame alone. */
  weight: number;
  /** Character offset into the sentence. Ordering is meaning — "watch
   *  without looking" is not "looking without watch". */
  at: number;
}

/** Grammar. Never a typographic object on its own, and the reason a
 *  phrase must not be allowed to begin or end on one. */
const FUNCTION_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
  "for",
  "with",
  "from",
  "as",
  "is",
  "was",
  "are",
  "were",
  "be",
  "been",
  "being",
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
  "there",
  "their",
  "them",
  "they",
  "he",
  "she",
  "his",
  "her",
  "had",
  "has",
  "have",
  "not",
  "no",
  "so",
  "than",
  "then",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "whose",
  "what",
  "how",
  "why",
  "if",
  "into",
  "onto",
  "out",
  "up",
  "down",
  "over",
  "under",
  "about",
  "after",
  "before",
  "because",
  "while",
  "would",
  "could",
  "should",
  "may",
  "might",
  "will",
  "shall",
  "can",
  "do",
  "does",
  "did",
  "very",
  "just",
  "only",
  "also",
  "more",
  "most",
  "some",
  "any",
  "all",
  "each",
  "one",
]);

/** THE HINGE WORDS. A sentence turns on these, and a typographic cut that
 *  lands on the turn is doing editorial work rather than decoration.
 *  "watch WITHOUT looking" is the whole thesis of a paragraph in one
 *  preposition. */
const TURNS = new Set([
  "without",
  "never",
  "nobody",
  "nothing",
  "none",
  "no-one",
  "not",
  "yet",
  "but",
  "however",
  "although",
  "instead",
  "rather",
  "except",
  "until",
  "unless",
  "despite",
  "still",
  "already",
  "simply",
  "merely",
  "only",
  "together",
  "each",
  "every",
  "all",
  "eventually",
  "then",
  "suddenly",
  "again",
]);

/** Undepictable nouns — the ones a noun-renderer has nothing to do with
 *  and typography has everything to do with. Deliberately overlapping
 *  `subject.ts`'s abstraction list rather than importing it, because that
 *  list answers "can this be built" and this one answers "is this word
 *  worth setting". */
const CONCEPTS = new Set([
  "system",
  "decision",
  "decisions",
  "pattern",
  "patterns",
  "record",
  "records",
  "meaning",
  "convenience",
  "safety",
  "prediction",
  "connection",
  "connections",
  "identifier",
  "identifiers",
  "data",
  "database",
  "machine",
  "consent",
  "policy",
  "power",
  "control",
  "surveillance",
  "privacy",
  "evidence",
  "authority",
  "process",
  "procedure",
  "contract",
  "contracts",
  "register",
  "registers",
  "department",
  "departments",
  "field",
  "fields",
  "number",
  "numbers",
  "name",
  "names",
  "form",
  "forms",
  "routine",
  "convention",
  "fragment",
  "fragments",
  "whole",
  "sense",
]);

/** A number as the prose printed it — digits or the written word. Both
 *  count: "fourteen departments" is a figure and so is "14". */
const NUMERIC =
  /^(\d[\d,.]*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty|forty|fifty|hundred|hundreds|thousand|thousands|million|millions|dozens|billions)$/i;

/** Read a sentence as typographic material.
 *
 *  Deterministic and checkable: every returned word appears in the
 *  sentence, at the offset given, spelled the way the prose spelled it. */
export function significantWords(
  sentence: string,
  subjects: DetectedSubject[] = [],
  action?: string,
): SignificantWord[] {
  const named = new Set(subjects.flatMap((s) => s.text.toLowerCase().split(/\s+/)).filter(Boolean));
  const actionWords = new Set((action ?? "").toLowerCase().split(/\s+/).filter(Boolean));

  const out: SignificantWord[] = [];
  const rx = /[A-Za-z0-9][A-Za-z0-9'’.,$-]*/g;
  let m: RegExpExecArray | null = rx.exec(sentence);
  while (m !== null) {
    const verbatim = m[0].replace(/[.,]+$/, "");
    const at = m.index;
    m = rx.exec(sentence);
    if (!verbatim) continue;
    const lower = verbatim.toLowerCase();

    let role: WordRole = "PLAIN";
    let weight = 0.3;

    if (NUMERIC.test(verbatim)) {
      role = "FIGURE";
      weight = 0.95;
    } else if (TURNS.has(lower)) {
      role = "TURN";
      weight = 0.85;
    } else if (CONCEPTS.has(lower)) {
      role = "CONCEPT";
      weight = 0.8;
    } else if (named.has(lower)) {
      role = "SUBJECT";
      weight = 0.75;
    } else if (at > 0 && /^[A-Z]/.test(verbatim) && verbatim.length > 2) {
      role = "PROPER";
      weight = 0.7;
    } else if (actionWords.has(lower)) {
      role = "ACTION";
      weight = 0.6;
    } else if (FUNCTION_WORDS.has(lower)) {
      // Grammar is kept, at a weight that can never win a frame, because a
      // typographic composition sometimes wants the small words present —
      // "THE" tiny above "CITY" enormous is a real typographic idea.
      weight = 0.08;
    } else if (verbatim.length >= 6) {
      // A long word the lexicons do not know is still more typographically
      // useful than a short one. Length is a weak signal and it is
      // weighted like one.
      weight = 0.45;
    }

    out.push({ text: verbatim.toUpperCase(), verbatim, role, weight, at });
  }
  return out;
}

/** THE TYPOGRAPHIC COMPOSITION OF ONE SENTENCE.
 *
 *  Four ranks, because that is what a designer actually decides: what
 *  fills the frame, what sits under it, what repeats, and what the cut
 *  lands on. Any of them may be absent — a sentence with nothing to
 *  repeat should not invent a repetition. */
export interface TypeComposition {
  /** Fills the frame. The single strongest word. */
  headline: SignificantWord | null;
  /** Set small against it. Often the grammar the headline needs. */
  sub: SignificantWord | null;
  /** The word worth printing many times, and how many. */
  repeat: { word: SignificantWord; times: number } | null;
  /** The word the cut lands on — the turn, if the sentence has one. */
  hinge: SignificantWord | null;
  /** Every word above rank, for a language that wants to lay out the
   *  whole sentence rather than pick from it. */
  all: SignificantWord[];
}

/** How many times a word wants to be printed.
 *
 *  Read off the PROSE, never chosen for effect: "thousands of ordinary
 *  decisions" repeats because the sentence said thousands. A sentence
 *  that printed no multiplicity gets no repetition, which is the same
 *  discipline the quantity construction keeps about charts. */
const MULTIPLIERS: Record<string, number> = {
  dozens: 24,
  hundreds: 60,
  thousands: 96,
  millions: 140,
  billions: 180,
  many: 20,
  every: 32,
  all: 28,
  each: 16,
  repeatedly: 18,
  again: 8,
};

export function composeType(words: SignificantWord[], sentence: string): TypeComposition {
  const ranked = [...words].sort((a, b) => b.weight - a.weight || a.at - b.at);
  const headline = ranked[0] ?? null;
  const sub =
    ranked.find((w) => w !== headline && w.weight >= 0.3 && w.role !== headline?.role) ??
    ranked[1] ??
    null;
  const hinge = words.find((w) => w.role === "TURN") ?? null;

  // Multiplicity, from the sentence's own words.
  let repeat: TypeComposition["repeat"] = null;
  const lower = sentence.toLowerCase();
  for (const [word, times] of Object.entries(MULTIPLIERS)) {
    if (!new RegExp(`\\b${word}\\b`).test(lower)) continue;
    // Repeat the thing there are many OF, not the word "thousands" —
    // "thousands of ordinary decisions" prints DECISION ninety-six times,
    // which is the picture, where printing THOUSANDS once is the caption.
    const after = ranked.find(
      (w) =>
        w.at > (words.find((x) => x.verbatim.toLowerCase() === word)?.at ?? 0) && w.weight >= 0.4,
    );
    const subject = after ?? headline;
    if (subject) repeat = { word: subject, times };
    break;
  }

  return { headline, sub, repeat, hinge, all: ranked };
}

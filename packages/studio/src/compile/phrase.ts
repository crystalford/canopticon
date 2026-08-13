// WHAT GOES ON SCREEN — the words, chosen rather than truncated.
//
// The complaint that produced this file, verbatim: "a lot of repetitive
// titles, titles that don't make sense (ends with a word like in) instead
// of just saying for instance VIDEO ESSAY AND .. instead of just VIDEO
// ESSAY".
//
// Both halves were one bug. The phrase on screen was the scene's label cut
// to twenty-six characters at the nearest space. That is a truncation, not
// a title, and it fails in exactly the two ways reported:
//
//   IT ENDS ON A FUNCTION WORD. "THE PROGRAM WAS WOUND DOWN IN" — because
//   the twenty-sixth character happened to land after "in". A phrase
//   ending on a preposition reads as a rendering error at 46px, and it is
//   one: nothing chose those words, a character count did.
//
//   IT REPEATS. The label is the first five words of the sentence, and
//   institutional prose opens sentence after sentence the same way, so
//   twenty scenes read "THE FEDERAL GOVERNMENT" and a film that is
//   correctly cutting between twenty different chains still looks like one
//   shot.
//
// So this CHOOSES. Candidates are generated from the sentence — a verbatim
// figure, a proper-noun run, the depictable noun it names, its first
// strong clause — each is trimmed so it can never end (or begin) on a
// function word, and the best one that has not just been used wins.
//
// It is deterministic and it is not a model. Every candidate is a literal
// span of the sentence, which is the same standard a figure is held to:
// what appears on screen is something the essay actually says.

import type { Figure } from "../ir/schema.ts";
import { detectSubjects } from "./subject.ts";

/** Words a phrase must never end on. A title ending here is not a title,
 *  it is a sentence that was interrupted.
 *
 *  `up`, `out`, `off` and `down` are deliberately NOT here. They read as
 *  prepositions and behave as verb particles: "PHASED OUT" and "WOUND
 *  DOWN" are complete and are exactly the register an institutional essay
 *  writes in. Cutting them produced "PROGRAM WAS WOUND", which is the same
 *  defect this list exists to prevent, arriving from the other side. */
const NEVER_LAST = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "nor",
  "so",
  "yet",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "from",
  "by",
  "with",
  "into",
  "onto",
  "over",
  "under",
  "about",
  "after",
  "before",
  "during",
  "through",
  "between",
  "against",
  "than",
  "as",
  "that",
  "which",
  "who",
  "whom",
  "whose",
  "this",
  "these",
  "those",
  "its",
  "their",
  "his",
  "her",
  "our",
  "your",
  "my",
  "is",
  "was",
  "are",
  "were",
  "be",
  "been",
  "being",
  "has",
  "have",
  "had",
  "will",
  "would",
  "can",
  "could",
  "may",
  "might",
  "must",
  "should",
  "did",
  "does",
  "do",
  "not",
  "no",
  "if",
  "when",
  "while",
  "because",
  "since",
  "per",
  "via",
  "upon",
  "amid",
  "among",
  "it",
]);

/** Words a phrase should not START on either. A title opening on "and" or
 *  "but" is a fragment of the previous sentence. */
const NEVER_FIRST = new Set([
  "and",
  "or",
  "but",
  "nor",
  "so",
  "yet",
  "that",
  "which",
  "because",
  "although",
  "though",
  "while",
  "whereas",
  "if",
  "then",
  "thus",
  "however",
  "meanwhile",
  "instead",
  "therefore",
  "moreover",
  "also",
  "still",
  "a",
  "an",
  "the",
  "its",
  "their",
  "this",
  "these",
  "those",
  "it",
  "is",
  "was",
  "are",
  "were",
  "has",
  "have",
  "had",
  "of",
  "in",
  "on",
  "to",
  "at",
  "by",
  "for",
  "from",
  "with",
  "as",
]);

/** Where a clause ends. Cutting here keeps a phrase to one idea, which is
 *  what a title card is. */
const CLAUSE_BREAK =
  /\s+(?:which|who|whom|whose|that|because|although|though|while|whereas|but|and|or|so|since|after|before|unless|until|however)\s+/i;

export interface PhraseOptions {
  /** Phrases already on screen in the last few scenes. A repeat loses to
   *  its own runner-up, which is what stops twenty scenes reading "THE
   *  FEDERAL GOVERNMENT". */
  recent?: string[];
  /** Verbatim quantities lifted from this sentence. A figure beats every
   *  other candidate on a scene that carries one: on an institutional
   *  essay the number IS the finding, and it is already checked as a
   *  literal substring. */
  figures?: Figure[];
  /** Words, not characters. Four is about the limit of what reads as a
   *  title rather than a caption at documentary pace. */
  maxWords?: number;
}

export interface PhraseChoice {
  text: string;
  /** Which rule produced it, for the Compile view. A phrase nobody can
   *  account for is indistinguishable from a truncation. */
  source: "figure" | "proper-noun" | "subject" | "clause" | "label";
  /** Alternatives, best first, so a repeat can fall through to the next
   *  one rather than to a character count. */
  alternatives: string[];
}

export function choosePhrase(
  sentence: string,
  label: string,
  options: PhraseOptions = {},
): PhraseChoice {
  const maxWords = options.maxWords ?? 4;
  const recent = new Set((options.recent ?? []).map((r) => r.toUpperCase()));

  const candidates: Array<{ text: string; source: PhraseChoice["source"] }> = [];
  const add = (raw: string, source: PhraseChoice["source"]) => {
    const cleaned = trimPhrase(raw, maxWords);
    if (!cleaned) return;
    if (candidates.some((c) => c.text === cleaned)) return;
    candidates.push({ text: cleaned, source });
  };

  // 1. THE NUMBER, VERBATIM. Already checked as a literal substring of the
  //    sentence by figures.ts — an approximation of $282,345.84 is a
  //    different finding, so this is passed through untouched by the
  //    word-trimming below.
  for (const figure of options.figures ?? []) {
    if (figure.kind === "year") continue;
    const asIs = figure.text.trim().toUpperCase();
    if (asIs && !candidates.some((c) => c.text === asIs)) {
      candidates.push({ text: asIs, source: "figure" });
    }
  }

  // 2. A PROPER-NOUN RUN. A specific name is the most legible thing a
  //    sentence contains and the least likely to repeat.
  for (const run of properNounRuns(sentence)) add(run, "proper-noun");

  // 3. THE THING IT NAMES. The same detection that decides whether this
  //    scene depicts an object, so the words on screen and the thing on
  //    screen are about each other rather than merely adjacent.
  const subject = detectSubjects(sentence)[0];
  if (subject) add(subjectPhrase(sentence, subject.offset, subject.text.length), "subject");

  // 4. THE FIRST STRONG CLAUSE, which is what a person writing a shot list
  //    would have written down.
  add(firstClause(sentence), "clause");

  // 5. The segmenter's label, last. It is the old behaviour and it is kept
  //    only so there is always something rather than nothing.
  add(label, "label");

  const fresh = candidates.find((c) => !recent.has(c.text));
  const chosen = fresh ?? candidates[0];
  if (!chosen) {
    // Nothing survived trimming — a sentence made entirely of function
    // words. Say the label as it stands rather than an empty frame.
    const fallback = (label || sentence).trim().toUpperCase().slice(0, 26);
    return { text: fallback, source: "label", alternatives: [] };
  }
  return {
    text: chosen.text,
    source: chosen.source,
    alternatives: candidates.filter((c) => c.text !== chosen.text).map((c) => c.text),
  };
}

/** Cut to a phrase that can stand on its own.
 *
 *  Drops leading connectives and articles, cuts at a clause boundary, caps
 *  the word count, and then — the part the old truncation never did —
 *  keeps dropping the last word until the phrase no longer ends on a
 *  function word. "WOUND DOWN IN" becomes "WOUND DOWN". */
export function trimPhrase(raw: string, maxWords: number): string {
  if (!raw) return "";
  let text = raw
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    // Keep what belongs inside a word or a figure; drop the rest. A stray
    // bracket set at 46px reads as damage.
    .replace(/[^\w\s$%.,'-]/g, " ")
    .trim();

  const broken = text.split(CLAUSE_BREAK)[0];
  if (broken && broken.trim()) text = broken.trim();

  let words = text.split(/\s+/).filter(Boolean);

  // Leading function words carry nothing and cost a quarter of the line.
  while (words.length > 1 && NEVER_FIRST.has(strip(words[0] as string))) words.shift();

  if (words.length > maxWords) words = words.slice(0, maxWords);

  // THE ACTUAL FIX. Trailing function words are dropped until the phrase
  // ends on something that means anything.
  while (words.length > 1 && NEVER_LAST.has(strip(words[words.length - 1] as string))) {
    words.pop();
  }

  // A single function word left standing is not a phrase.
  if (words.length === 1 && NEVER_LAST.has(strip(words[0] as string))) return "";

  return words
    .join(" ")
    .replace(/[.,;:]+$/, "")
    .trim()
    .toUpperCase();
}

/** Runs of two or more capitalised words that are not sentence-initial.
 *  Deliberately not single capitals: one capitalised word at the head of a
 *  sentence is just a sentence. */
export function properNounRuns(sentence: string): string[] {
  const words = sentence.split(/\s+/);
  const runs: string[] = [];
  let run: string[] = [];
  words.forEach((word, i) => {
    const bare = word.replace(/[^\w'-]/g, "");
    const capital = /^[A-Z]/.test(bare) && bare.length > 1;
    // A word after a full stop is capitalised by grammar, not by being a
    // name. Skipped rather than counted.
    const sentenceInitial = i === 0 || /[.!?]$/.test(words[i - 1] ?? "");
    if (capital && !sentenceInitial) {
      run.push(bare);
    } else {
      if (run.length >= 2) runs.push(run.join(" "));
      run = capital && sentenceInitial ? [] : [];
    }
  });
  if (run.length >= 2) runs.push(run.join(" "));
  return runs;
}

/** The noun with a word or two of what qualifies it. "SMOKE DETECTOR" and
 *  "THE HOTEL CONTRACT" rather than a bare "DETECTOR". */
function subjectPhrase(sentence: string, offset: number, length: number): string {
  const before = sentence.slice(0, offset).split(/\s+/).filter(Boolean);
  const noun = sentence.slice(offset, offset + length);
  const lead = before.slice(-2).filter((w) => !NEVER_FIRST.has(strip(w)));
  return [...lead, noun].join(" ");
}

/** The sentence's opening idea, up to its first real break. */
function firstClause(sentence: string): string {
  const upToPunctuation = sentence.split(/[,;:—–]/)[0] ?? sentence;
  return upToPunctuation;
}

function strip(word: string): string {
  return word.toLowerCase().replace(/[^a-z']/g, "");
}

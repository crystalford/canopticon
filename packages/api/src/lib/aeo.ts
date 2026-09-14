// The two rules that decide what a research document is allowed to publish.
//
// Both are here rather than inline in a query because both are load-bearing
// and neither is obvious from reading SQL: one decides when two documents are
// answering the same question, the other decides whether a page exists at all.

/**
 * The merge key for questions.
 *
 * Two documents that ask the same thing in different words must land on ONE
 * page that accumulates both sources — not two pages that compete. Google's
 * generative-retrieval patents include domain diversity, so a site's own pages
 * displace each other rather than compounding; near-duplicate atoms are worse
 * than a single page carrying more evidence.
 *
 * Deliberately conservative. It strips case, punctuation, and the filler that
 * varies between phrasings of the same question — but it does NOT stem, cluster
 * or embed. A false merge silently fuses two distinct questions into one page
 * and loses one of them, which is worse than a false split the operator can
 * see and fix.
 */
const FILLER = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "do",
  "does",
  "did",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "by",
  "and",
  "or",
]);

export function normaliseQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w))
    .join(" ")
    .trim();
}

export function questionSlug(question: string): string {
  const base = question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 72)
    .replace(/-$/, "");
  return base || "question";
}

// ---------------------------------------------------------------------------
// The gate.

/** A question needs at least one verified span answering it. */
export const MIN_EVIDENCE = 1;
/** …and enough substance that the page is worth existing. */
export const MIN_ANSWER_WORDS = 40;

export interface GateInput {
  evidenceCount: number;
  answerWords: number;
}

export interface GateResult {
  publishable: boolean;
  reason: string | null;
}

/**
 * Whether a question may become a public page. A HARD gate, not a lint.
 *
 * Scaled-content enforcement is sitewide rather than per-page — the documented
 * failure mode is a domain deindexed over templated near-duplicates, not a
 * single page demoted. So the thin atom must never acquire a URL in the first
 * place, which is a different thing from publishing it with a warning.
 *
 * The thresholds are deliberately modest. The research establishes that a
 * minimum-substance gate is the single most important protection, but no
 * trustworthy source establishes a specific word count — so this is set low
 * enough to be honest about what it is (a floor against emptiness) rather than
 * pretending to a precision the evidence does not support.
 */
export function gateQuestion(input: GateInput): GateResult {
  if (input.evidenceCount < MIN_EVIDENCE) {
    return { publishable: false, reason: "no verified quote answers this question" };
  }
  if (input.answerWords < MIN_ANSWER_WORDS) {
    return {
      publishable: false,
      reason: `answer is ${input.answerWords} words; needs at least ${MIN_ANSWER_WORDS}`,
    };
  }
  return { publishable: true, reason: null };
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

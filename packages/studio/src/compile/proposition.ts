// PROPOSITION — what the sentence says is HAPPENING.
//
// THE LAYER THIS SYSTEM DID NOT HAVE, AND THE REASON A CENTIPEDE APPEARED.
//
// Traced on a real film: "The lolcow trajectory isn't a story about one
// person being uniquely self-deceived" put a thirty-segment, sixty-legged
// creature on screen. Not because of "lolcow" — that word matches nothing
// in any lexicon here. Because of "person", which `subject.ts` knows at
// weight 0.62, which made `body.fit` return 0.85, which emitted
// `creature_chain`. The leg count came off the film's visual-density dial.
//
// The rule that failure violates, stated once so every consumer can be
// checked against it:
//
//     A TOKEN MAY INFORM WHAT IS HAPPENING.
//     A TOKEN MAY NEVER NAME WHAT IS DRAWN.
//
// A verb reaching BECOMES is legal: it is what the sentence asserts, and
// it names no object. A printed figure reaching the chart family is legal:
// it is checkable by anyone. A noun reaching `creature_chain` is not: it
// names the object.
//
// WHY THIS IS NOT ANOTHER DICTIONARY. Every input below already exists,
// and `subjects[0].kind` is deliberately not among them:
//
//   argument role   promote.ts's roleOf — what the sentence DOES in the
//                   argument. Computed film-wide. Needs no depictable noun.
//   contrast        promote.ts's X-NOT-Y shapes. Needs no depictable noun.
//   verb structure  the CONSEQUENCE table, over an action span or the
//                   sentence itself
//   negation        assert or deny
//   register        the claim markers the hedge floor already reads
//   multiplicity    counts the prose printed
//   film state      what has persisted, what is returning
//
// Two of those — role and contrast — are the whole unlock. They are what
// let an essay about ideas produce a reading at all, and the old
// `readRelation` gate (`if (subjects.length < 2) return null`) is exactly
// what stopped them from ever being asked.
//
// AND THE NEGATIVE RESULT MATTERS AS MUCH. This never returns null. A
// sentence naming nothing depictable still says something is happening,
// and a film that cannot read it is a film that will reach for a noun.

import type { ArgumentRole } from "./promote.ts";
import type { RelationKind } from "./semantic-scene.ts";

/** What a sentence asserts is happening, compositionally.
 *
 *  The eleven from `semantic-scene.ts` are kept verbatim — they are good,
 *  they are tested, and renaming them would be churn. The five additions
 *  each carry a stated detector below: a proposition with no checkable
 *  detector does not get added, however much one would like to have it. */
export type Proposition =
  | RelationKind
  /** Something is becoming a worse version of itself. A BECOMES with
   *  polarity — the distinction between "turned into a method" and
   *  "turned into a spectacle". */
  | "DEGRADES"
  /** The sentence reports something being PRESENTED as what it is not.
   *  Read from the claim markers the hedge floor already carries, which
   *  is why this costs no new word list. */
  | "PERFORMS"
  /** The same thing, again, after an absence. Comes from the film's own
   *  state rather than from the prose. */
  | "RECURS"
  /** The same thing, again, immediately — a refrain, or a multiplicity
   *  the prose printed. */
  | "REPEATS"
  /** Two things becoming one, or a thing losing the boundary that made it
   *  a thing. */
  | "COLLAPSES";

/** How much of the reading came from the prose itself.
 *
 *  This is the field that keeps the layer honest. A proposition read off a
 *  verbatim span is a claim about the text; one derived from the sentence's
 *  role in the argument is an inference. Both are useful and they are not
 *  the same, and a construction competing to realise one should know which
 *  it is looking at. */
export type PropositionConfidence = "verbatim" | "structural" | "inferred";

export interface PropositionReading {
  kind: Proposition;
  /** The words that produced it, verbatim from the prose where there were
   *  any — checkable the way a figure is. Empty when the reading came from
   *  the argument's shape rather than from a span. */
  because: string;
  confidence: PropositionConfidence;
  /** True when the sentence DENIES rather than asserts. Orthogonal to the
   *  proposition: "memory was never storage" is a BECOMES that did not
   *  happen, and that is a different picture from one that did. */
  negated: boolean;
}

export interface PropositionInput {
  sentence: string;
  role: ArgumentRole;
  /** The verbatim action span, when a relation was read. Absent on most
   *  sentences of an abstract essay, which is the case this layer exists
   *  to serve. */
  action?: string | null | undefined;
  /** A count the prose printed. */
  count?: number | null | undefined;
  /** True when the film has seen this scene's subject before, after a gap.
   *  Supplied by the caller from `FilmState`; this module holds no state. */
  recurring?: boolean | undefined;
  /** True when two identities merged in the film's state this scene. */
  merging?: boolean | undefined;
}

/* ── the detectors ──────────────────────────────────────────────────── */

/** X, NOT Y. The single most reliable shape an argumentative claim takes,
 *  and it needs no noun at all — which is why it is first.
 *
 *  "A POSITION, NOT A PERSON" · "EXPOSURE, NOT CORRUPTION" · "isn't a
 *  story about one person". The sentence is displacing one reading with
 *  another, which is OPPOSES, and it is the correct reading of the exact
 *  sentence that produced a centipede. */
const CONTRAST = [
  /\b([\w'’-]+(?:\s+[\w'’-]+){0,2}),\s+not\s+([\w'’-]+(?:\s+[\w'’-]+){0,2})/i,
  /\bnot\s+([\w'’-]+(?:\s+[\w'’-]+){0,2})\s+but\s+([\w'’-]+(?:\s+[\w'’-]+){0,2})/i,
  /\b([\w'’-]+(?:\s+[\w'’-]+){0,2})\s+(?:vs\.?|versus)\s+([\w'’-]+(?:\s+[\w'’-]+){0,2})/i,
  /\b(?:is|was|are|were)(?:n['’]t| not)\s+(?:a|an|the)\s+([\w'’-]+)/i,
];

/** PRESENTED AS. The register in which a claim is reported rather than
 *  made — and a claim about how a thing APPEARS is a claim about
 *  performance, which is a picture.
 *
 *  Deliberately the same markers `extract-reading.ts` already uses for the
 *  hedge floor. Reusing them costs nothing and means the two layers can
 *  never disagree about whether a sentence is reporting or asserting. */
const PERFORMS_MARKERS =
  /\b(?:presented? as|framed as|billed as|positioned as|described as|characteri[sz]ed as|passe[sd]? for|dressed up as|so-called|claim(?:s|ed|ing)? to be|purport\w*|on paper|in public|performance|perform\w*|display\w* as|brand)\b/i;

/** Polarity. A BECOMES with one of these in the sentence is a DEGRADES —
 *  the difference between "turned into a method" and "collapsed into a
 *  costume". Not a noun list: every one of these is a judgement the prose
 *  itself is making. */
const DECLINE =
  /\b(?:worse|degrad\w*|decay\w*|deterior\w*|collaps\w*|corrupt\w*|erod\w*|hollow\w*|rot\w*|declin\w*|fell apart|breaks? down|broke down|no longer)\b/i;

/** Two things becoming one, or a boundary going. */
const COLLAPSE =
  /\b(?:collaps\w*|merg\w*|dissolv\w*|indistinguishable|blur\w*|the same thing|becomes? one|fus\w*|conflat\w*)\b/i;

/** Again. Refrain-shaped words the prose uses about its own material. */
const AGAIN =
  /\b(?:again|repeat\w*|over and over|each time|every time|the same \w+ (?:again|twice)|continuously|recurring|recurs?|cycle|loop\w*)\b/i;

/** WHAT AN ACTION DOES, COMPOSITIONALLY.
 *
 *  Lifted verbatim from `semantic-scene.ts`, which had it right and could
 *  only ever run it when the lexicon found two nouns. Here it runs on the
 *  action span when there is one and on the whole sentence when there is
 *  not, which is the single change that makes an abstract essay legible.
 *
 *  Note what is NOT here, and `semantic-scene.ts` says it best: there is
 *  no `watches` and no `surveils`. "Watched", "monitored", "recorded" and
 *  "inspected" all mean OBSERVES compositionally. That is what stops this
 *  becoming a verb lexicon the way `subject.ts` became a noun lexicon. */
const CONSEQUENCE: Array<[RegExp, RelationKind]> = [
  [
    /\b(watch\w*|monitor\w*|observ\w*|survey\w*|surveill\w*|inspect\w*|photograph\w*|film(?:ed|s)?|track(?:ed|s)?)/i,
    "OBSERVES",
  ],
  [/\b(contain\w*|hold|held|hous\w*|enclos\w*|surround\w*|inside|within|cover\w*)/i, "CONTAINS"],
  [
    /\b(becam|become[s]?|turn|turned|transform|transformed|made into|grew into|was never|is never|replace[ds]?)\b/i,
    "BECOMES",
  ],
  [
    /\b(against|oppos\w*|resist\w*|refus\w*|contradict\w*|but|versus|rather than|instead of)/i,
    "OPPOSES",
  ],
  [
    /\b(accumulat\w*|gather\w*|pil(?:e|ed|ing)|collect\w*|amass\w*|multipl\w*|spread|grew)/i,
    "ACCUMULATES",
  ],
  [/\b(approach\w*|toward|towards|closer|nearer|arriv\w* at|converg\w*)/i, "APPROACHES"],
  [
    /\b(moved away|away from|reced\w*|withdrew|retreat\w*|depart\w*|left|further from|diverg\w*)/i,
    "DEPARTS",
  ],
  [/\b(reveal\w*|expos\w*|uncover\w*|disclos\w*|show(?:ed|s)? through|through)/i, "REVEALS"],
  [
    /\b(conceal\w*|hid|hidden|obscur\w*|cover(?:ed)? up|behind|buried|withheld|redact\w*)/i,
    "CONCEALS",
  ],
  [/\b(emerg\w*|arriv\w*|appear\w*|came out|rose|surfac\w*|issued|arose)/i, "EMERGES"],
  [/\b(carr\w*|connect\w*|link\w*|join\w*|sent|deliver\w*|between)/i, "CONNECTS"],
];

/** A DENIAL, INCLUDING THE CONTRACTED ONE.
 *
 *  `semantic-scene.ts`'s version is `\b(never|not|no longer|…)\b`, which
 *  cannot match "isn't" — the word boundary falls before "n't". So the
 *  most quotable shape in the whole essay, "The fallacy isn't a lapse",
 *  read as an assertion. `promote.ts`'s `DENIES` had this right already
 *  and is the pattern followed here; the two are now the same rule. */
const NEGATION =
  /\b(?:is|was|are|were|do|does|did|has|have|had|wo|ca|could|would|should)(?:n['’]t| not)\b|\b(never|not|no longer|nothing|without|failed to|neither|nor)\b/i;

/** What a sentence's JOB in the argument implies is happening, when the
 *  prose gave no verb to read.
 *
 *  This is the floor, and it is the reason this function never returns
 *  null. It is an inference rather than a reading, and it says so — every
 *  result from here is `confidence: "inferred"`, so a construction can
 *  weigh it accordingly instead of treating a guess as a fact.
 *
 *  DEVELOPMENT is the honest CONNECTS: a sentence carrying an argument
 *  forward relates what came before to what comes next, and claiming
 *  anything more specific would be this layer inventing. */
const ROLE_FLOOR: Record<ArgumentRole, RelationKind> = {
  TITLE: "EMERGES",
  PROBLEM: "EMERGES",
  THESIS: "OPPOSES",
  COUNTER: "OPPOSES",
  DIAGNOSTIC: "REVEALS",
  EXPLANATION: "REVEALS",
  MECHANISM: "CONNECTS",
  STANDARD: "OBSERVES",
  DEVELOPMENT: "CONNECTS",
  CONCLUSION: "BECOMES",
};

/** The verbatim words a regex matched, for the `because`. Empty rather
 *  than a paraphrase — a reading that cannot point at the prose is a
 *  reading that should be labelled inferred, not dressed up. */
function matched(re: RegExp, text: string): string {
  return text.match(re)?.[0]?.trim() ?? "";
}

/** READ WHAT IS HAPPENING.
 *
 *  Ordered most specific first, and each branch states why it outranks
 *  what follows it. Never returns null: see the header. */
export function readProposition(input: PropositionInput): PropositionReading {
  const { sentence, role } = input;
  const negated = NEGATION.test(sentence);

  // 1. A CONTRAST IS THE CLAIM. "A position, not a person" is not a
  //    sentence about a person — it is a sentence displacing one reading
  //    with another, and reading the noun instead of the shape is exactly
  //    the mistake that produced a centipede.
  for (const re of CONTRAST) {
    const hit = matched(re, sentence);
    if (hit) return { kind: "OPPOSES", because: hit, confidence: "verbatim", negated };
  }

  // 2. PRESENTED AS. Above the verb table because "displayed as a brand"
  //    contains no verb the table would read correctly, and because a
  //    claim about how a thing appears is a claim about performance.
  const performing = matched(PERFORMS_MARKERS, sentence);
  if (performing) {
    return { kind: "PERFORMS", because: performing, confidence: "verbatim", negated };
  }

  // 3. COLLAPSE, before the verb table's BECOMES: two things becoming
  //    indistinguishable is more specific than one thing becoming another.
  const collapsing = matched(COLLAPSE, sentence);
  if (collapsing || input.merging) {
    return {
      kind: "COLLAPSES",
      because: collapsing,
      confidence: collapsing ? "verbatim" : "structural",
      negated,
    };
  }

  // 4. THE VERB TABLE — on the action span when a relation was read, on
  //    the whole sentence when it was not. That second case is the entire
  //    point of this layer: it is what the two-noun gate forbade.
  const span = input.action?.trim() ? input.action : sentence;
  for (const [re, kind] of CONSEQUENCE) {
    const hit = matched(re, span);
    if (!hit) continue;
    // BECOMES WITH POLARITY. The prose is already making the judgement;
    // this only reads which way it points.
    if (kind === "BECOMES" && DECLINE.test(sentence)) {
      return {
        kind: "DEGRADES",
        because: `${hit} · ${matched(DECLINE, sentence)}`,
        confidence: "verbatim",
        negated,
      };
    }
    return {
      kind,
      because: hit,
      confidence: input.action?.trim() ? "verbatim" : "structural",
      negated,
    };
  }

  // 5. AGAIN. A refrain or a printed multiplicity, when no verb spoke.
  const again = matched(AGAIN, sentence);
  if (again) return { kind: "REPEATS", because: again, confidence: "verbatim", negated };
  if ((input.count ?? 0) > 2) {
    return {
      kind: "ACCUMULATES",
      because: `the prose printed ${input.count}`,
      confidence: "verbatim",
      negated,
    };
  }

  // 6. THE FILM'S OWN MEMORY. A thing returning after an absence is an
  //    event even when the sentence containing it is quiet — and it is
  //    the one reading that cannot come from the prose at all.
  if (input.recurring) {
    return { kind: "RECURS", because: "", confidence: "structural", negated };
  }

  // 7. THE ROLE. Never null, and honestly labelled.
  return { kind: ROLE_FLOOR[role] ?? "CONNECTS", because: "", confidence: "inferred", negated };
}

/** Human-readable, for the report and the Compile view. The director
 *  should be able to read what the compiler thought was happening without
 *  learning the vocabulary. */
export function describeProposition(p: PropositionReading): string {
  const base: Record<Proposition, string> = {
    OBSERVES: "one thing watching another",
    CONTAINS: "one thing inside another",
    BECOMES: "one thing turning into another",
    OPPOSES: "one reading displacing another",
    ACCUMULATES: "more of it, gathering",
    CONNECTS: "this related to that",
    EMERGES: "something arriving",
    REVEALS: "something shown through",
    CONCEALS: "something hidden behind",
    APPROACHES: "distance closing",
    DEPARTS: "distance opening",
    DEGRADES: "something becoming a worse version of itself",
    PERFORMS: "something presented as what it is not",
    RECURS: "the same thing, again, after an absence",
    REPEATS: "the same thing, again",
    COLLAPSES: "two things losing the boundary between them",
  };
  const what = base[p.kind] ?? "this related to that";
  const how =
    p.confidence === "verbatim"
      ? p.because
        ? ` — "${p.because}"`
        : ""
      : p.confidence === "structural"
        ? " — from the film's own structure"
        : " — inferred from what this sentence does in the argument";
  return `${p.negated ? "denied: " : ""}${what}${how}`;
}

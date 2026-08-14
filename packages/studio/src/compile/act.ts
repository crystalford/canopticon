// ACT — what KIND of visual change this moment is.
//
// THE LAYER BETWEEN "SHOULD THIS MOMENT BE ACTIVE" AND "WHAT CAN I DRAW".
//
// Measured on a real 65-scene film before this existed: fourteen distinct
// chain shapes across the whole runtime, thirty-four of the fifty-two
// non-empty scenes on ONE of them, and one construction producing 63% of
// the pictures. Not because the palette is small — it has 135 primitives.
// Because the compiler had exactly one verb. `allocate` decided whether a
// moment deserved an intervention, and every intervention that was not
// text or silence went into a single bucket called COMPOSE, which means
// "draw something" and therefore means nothing.
//
// So the question this file asks, once, per scene:
//
//     WHAT KIND OF CHANGE IS THIS?
//
// and it asks it BEFORE anything asks what can be drawn. That ordering is
// the whole design. A construction competition that runs first will always
// answer with whatever the semantic material can be bent into.
//
// THE RULE, INHERITED FROM `proposition.ts` AND EXTENDED:
//
//     A TOKEN MAY INFORM WHAT IS HAPPENING.
//     A TOKEN MAY NEVER NAME WHAT IS DRAWN.
//
// A new name may SUGGEST that something is being declared. It may never
// decide the picture. An act read from a verb, a negation, a hedge or a
// measured pause is as legitimate as one read from a noun — and on an
// essay of ideas it is very much more common.
//
// WHY THESE TWELVE AND NOT SOME OTHER TWELVE. Every act below satisfies
// three tests, and one that fails any of them is not here:
//
//   1. it is DECIDABLE from a signal this compiler already computes
//   2. it is REALISABLE by machinery this compiler already contains
//   3. it looks different on screen from its neighbours
//
// Two of the acts an editor would reasonably ask for fail test 2 and are
// deliberately absent. FRAGMENT would need `SPLIT`, and `SemanticRelation`
// is strictly binary — no reader in the package can produce a one-to-many
// relation, so there is no input that could decide it. TRACE would need a
// camera that survives a cut; `observe()` and `bridgeCamera()` are both
// written and neither has a production caller, because nothing carries a
// `Camera` on the world state. Both are named here so that their absence
// is a decision rather than an oversight.
//
// WHAT THIS FILE DOES NOT DO. It does not choose a primitive, a
// construction or a chain. It says what is happening; the compiler below
// it says what that looks like. The moment this file starts naming
// primitives it has become the thing it replaced.

import type { ArgumentRole } from "./promote.ts";
import { type PropositionReading, readProposition } from "./proposition.ts";

/** THE VISUAL ACT — what changes, not what is drawn.
 *
 *  Grouped by what they are about, because the groups are the argument for
 *  the vocabulary being this size: presence, quantity, argument, change.
 *  Four questions a moment of an essay can turn on. */
export type Act =
  /* ── PRESENCE ── */
  /** Something is put on screen that was not there. The only act that
   *  introduces, which is what stops every other act from being allowed to
   *  reach for a new object. */
  | "DECLARE"
  /** What is already there stays there. NOT the old `HOLD` — a sustain
   *  keeps the GROUND and lets the words go, which is the difference
   *  between a world that persists and a caption that will not leave. */
  | "SUSTAIN"
  /** Something goes. The essay drops a thread, denies a claim, or hides
   *  what it had shown. */
  | "WITHDRAW"
  /** Nothing on screen. Decided by the allocator at a passage boundary and
   *  carried here unchanged — this layer never invents silence and never
   *  overrules it. */
  | "NONE"

  /* ── QUANTITY ── */
  /** More of it. The prose printed a count, or said it gathered, or named
   *  again what it had already named. */
  | "ACCUMULATE"
  /** Distance closing, or a boundary going. Two things becoming near, or
   *  becoming one. */
  | "CONVERGE"

  /* ── ARGUMENT ── */
  /** One reading displacing another. The single most reliable shape an
   *  argumentative claim takes, and it needs no noun at all. */
  | "CONTRAST"
  /** The essay hedging, conceding or narrowing. Computed on every scene
   *  since this compiler was written, and destroyed into a score
   *  multiplier every time. */
  | "QUALIFY"
  /** Something shown through, or shown to be other than as presented. */
  | "REVEAL"

  /* ── CHANGE ── */
  /** One thing turning into another, including turning into a worse
   *  version of itself. */
  | "TRANSFORM"
  /** The same state, pressed harder. Read primarily from DELIVERY — the
   *  measured speech rate against the film's own median — which makes it
   *  the one act in the vocabulary that no lexicon can reach. */
  | "INTENSIFY"
  /** Something the film established earlier coming back. From the essay's
   *  own refrain, or from the film's memory of what it retired. */
  | "RECALL";

/** How much of the act came from the prose itself. Same three tiers as
 *  `PropositionReading`, and for the same reason: a consumer weighing an
 *  act should know whether it is looking at a claim about the text or at
 *  an inference about the argument. */
export type ActConfidence = "verbatim" | "structural" | "inferred";

export interface ActReading {
  act: Act;
  /** The words that produced it, verbatim, where there were any. Empty
   *  when the act came from the argument's shape, from the film's memory,
   *  or from the measured delivery. */
  because: string;
  confidence: ActConfidence;
  /** THE RECOVERED BOOLEAN.
   *
   *  A hedge has been detected on every scene since `promote.ts` was
   *  written and has only ever survived as `score *= 0.45` — so the film
   *  has never been able to tell a claim from a qualified claim, only that
   *  one of them scored lower. It is carried here whether or not it
   *  DECIDED the act, because a hedged TRANSFORM is still a hedged
   *  transform and should not be drawn at full strength. */
  hedged: boolean;
  /** True when the sentence denies rather than asserts. Carried up from
   *  the proposition because several acts read differently under denial:
   *  a denied BECOMES is a claim refusing to arrive, not a change. */
  negated: boolean;
  /** Human sentence for the report and the Compile view. An act nobody can
   *  account for is indistinguishable from a guess — the same bar
   *  `Intervention.why` already keeps. */
  why: string;
  /** Carried so consumers below do not re-read it. The act is a reading OF
   *  the proposition plus the film's state and its delivery; keeping both
   *  means a construction can see the specific relation when it wants one
   *  and the act when it does not. */
  proposition: PropositionReading;
}

export interface ActInput {
  sentence: string;
  role: ArgumentRole;
  /** The previous scene, for the signals that only exist across a cut.
   *  Absent on the first scene of the film. */
  previous?: { sentence: string; act: Act } | null;
  /** Lowercased names this sentence contains. */
  named?: readonly string[];
  /** What the film had standing BEFORE this scene. */
  standing?: ReadonlySet<string>;
  /** How many figures the prose printed here, and how many places a route
   *  named. Checkable material — the prose asking for a picture. */
  figures?: number;
  route?: number;
  /** A count the prose printed. */
  count?: number | null | undefined;
  /** The verbatim action span, when a relation was read. */
  action?: string | null | undefined;
  /** This is the Nth time the film has said this scene's refrain. 1 is the
   *  first time and is not a recall. */
  refrainOccurrence?: number;
  /** True when the film's own state says this subject is returning after a
   *  gap, or that two identities merged here. */
  recurring?: boolean;
  merging?: boolean;
  /** Measured delivery. `relativeRate` is this scene's speech rate against
   *  the film's median — 1 is the film's normal pace. Null when the film
   *  was never narrated, which is most of the time during authoring. */
  relativeRate?: number | null;
  /** The measured silence before this scene, and what kind of rest it was. */
  leadPause?: { ms: number; kind: "breath" | "beat" | "act" } | null;
  /** The allocator has already decided this moment is silent. */
  silent?: boolean;
}

/* ── the detectors ──────────────────────────────────────────────────── */

/** HEDGES.
 *
 *  This list lived in `promote.ts` and is moved here rather than copied,
 *  because two implementations of one rule is how the Lab and the Worker
 *  came to disagree about 57 of 88 scenes without anyone noticing. It is a
 *  state-change signal first — the essay qualifying — and a score
 *  multiplier second; `promote.ts` imports it for the second job.
 *
 *  Same discipline as `extract-reading.ts`'s hedge floor and for the same
 *  reason: an essay is allowed to be uncertain, and dramatising an
 *  uncertainty into a full-screen statement is the compiler putting words
 *  in the author's mouth. */
export const HEDGE =
  /\b(?:probably|perhaps|maybe|arguably|seems?|appears?|suggests?|might|may|could|allegedly|reportedly|apparently|roughly|approximately|tends? to|often|usually|sometimes)\b/i;

/** A DENIAL FOLLOWED BY AN ASSERTION, ACROSS THE CUT.
 *
 *  "The fallacy isn't a lapse. It's a diagnosis." — one claim in two
 *  sentences, which the segmenter has already cut into two scenes.
 *  `promote.ts` has detected this pair since it was written, and has only
 *  ever used the finding to make the two halves share a quota slot: the
 *  fact that the argument REVERSED across the cut has never reached the
 *  picture. These are moved here for the same reason as `HEDGE`. */
export const DENIES = /\b(?:is|was|are|were|do|does|did)(?:n['’]t| not)\b|\bnever\b/i;
export const ASSERTS = /^\s*(?:it|they|that|this|he|she)\b/i;

/** THE HINGE WORDS, SPLIT BY WHAT THEY DO.
 *
 *  `words.ts` carries the same thirty words as `TURNS`, all at one flat
 *  weight of 0.85, answering a different question — which word in a
 *  sentence is worth SHOWING. That question does not care whether a turn
 *  reverses, concedes, minimises or escalates. This one is about nothing
 *  else, so the list is differentiated here rather than shared: a single
 *  weight cannot express the distinction this layer exists to make.
 *
 *  Ordered most specific first, and every entry earns its act. A word that
 *  could plausibly be argued into two of them is not here. */
const HINGES: Array<[RegExp, Act]> = [
  // REVERSAL — the sentence turning against what preceded it.
  [/\b(?:instead|rather than|on the contrary|whereas|conversely|in fact|actually)\b/i, "CONTRAST"],
  // CONCESSION and MINIMISATION — the sentence giving ground, or shrinking
  // its own claim. Different moves in an argument, the same visual act:
  // less than was claimed.
  [
    /\b(?:although|though|despite|even if|even so|granted|admittedly|to be fair|of course)\b/i,
    "QUALIFY",
  ],
  [/\b(?:merely|simply|only just|barely|hardly|at most|little more than)\b/i, "QUALIFY"],
  // ESCALATION — the same thing, further along.
  [
    /\b(?:suddenly|eventually|increasingly|more and more|by then|before long|until finally)\b/i,
    "INTENSIFY",
  ],
  // ACCUMULATION — the sentence totalising.
  [/\b(?:altogether|one after another|each time|every time|over and over)\b/i, "ACCUMULATE"],
];

/** WHAT A PROPOSITION IS, AS AN ACT.
 *
 *  Not every proposition maps. `OBSERVES`, `CONTAINS` and `CONNECTS`
 *  describe a spatial ARRANGEMENT rather than a change — "one thing inside
 *  another" is a composition, not an event — so they deliberately fall
 *  through to the presence layer, where a scene that arranges rather than
 *  changes correctly reads as DECLARE or SUSTAIN.
 *
 *  This is also why the three roles that floor to those propositions —
 *  DEVELOPMENT, MECHANISM and STANDARD — are the roles that hold. That is
 *  the intended behaviour and not an accident of the table. */
const AS_ACT: Partial<Record<PropositionReading["kind"], Act>> = {
  ACCUMULATES: "ACCUMULATE",
  REPEATS: "ACCUMULATE",
  APPROACHES: "CONVERGE",
  COLLAPSES: "CONVERGE",
  OPPOSES: "CONTRAST",
  REVEALS: "REVEAL",
  PERFORMS: "REVEAL",
  CONCEALS: "WITHDRAW",
  DEPARTS: "WITHDRAW",
  BECOMES: "TRANSFORM",
  DEGRADES: "TRANSFORM",
  EMERGES: "DECLARE",
  RECURS: "RECALL",
};

/** Faster than this against the film's own median and the delivery is
 *  pressing rather than merely varying. Speech rate wanders by a few per
 *  cent on every sentence; a fifth faster than a film's own norm is the
 *  reader leaning in. */
const PRESSING = 1.2;
/** A sentence this short, after a long one, is the essay landing a blow.
 *  `scene-kind.ts` already uses seven words for the same judgement. */
const BLOW_WORDS = 7;
/** And the sentence before it has to have been long enough for the drop to
 *  be a compression rather than two short sentences in a row. */
const RUN_UP_WORDS = 16;

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function matched(re: RegExp, text: string): string {
  return text.match(re)?.[0]?.trim() ?? "";
}

/* ── the reading ────────────────────────────────────────────────────── */

/** READ WHAT KIND OF CHANGE THIS IS.
 *
 *  Ordered most specific first, in the discipline `readProposition`
 *  established: a verbatim span outranks the film's structure, which
 *  outranks an inference about the argument, and every branch states why
 *  it outranks what follows it.
 *
 *  Never returns null, for the same reason that one does not: a sentence
 *  the film cannot read is a sentence the film will reach for a noun to
 *  explain. */
export function readAct(input: ActInput): ActReading {
  const { sentence, role } = input;
  const proposition = readProposition({
    sentence,
    role,
    action: input.action,
    count: input.count,
    recurring: input.recurring,
    merging: input.merging,
  });
  const hedged = HEDGE.test(sentence);
  const negated = proposition.negated;
  const standing = input.standing ?? new Set<string>();
  const named = input.named ?? [];

  const read = (act: Act, because: string, confidence: ActConfidence, why: string): ActReading => ({
    act,
    because,
    confidence,
    hedged,
    negated,
    why,
    proposition,
  });

  // 0. SILENCE IS NOT THIS LAYER'S DECISION. The allocator decides where
  //    the film breathes, at the author's own paragraph boundaries. An act
  //    layer that could overrule it would be a second implementation of
  //    the same rule, disagreeing with the first.
  if (input.silent) {
    return read("NONE", "", "structural", "nothing on screen — the allocator called for a breath");
  }

  // 1. THE ESSAY SAYING IT AGAIN. A refrain returning outranks whatever
  //    shape the sentence is in, because the shape was already read the
  //    first time the essay used it — the event here is the RETURN.
  //
  //    `promote.ts` has counted these since it was written and thrown the
  //    counts away into a Set, so "this is the third time" has always been
  //    one line from existing and has never been available.
  if ((input.refrainOccurrence ?? 1) > 1) {
    const n = input.refrainOccurrence ?? 2;
    return read(
      "RECALL",
      "",
      "verbatim",
      `the ${n === 2 ? "second" : n === 3 ? "third" : `${n}th`} time the essay says this`,
    );
  }
  // The film's own memory, which cannot come from the prose at all.
  if (input.recurring) {
    return read("RECALL", "", "structural", "something the film retired is back");
  }

  // 2. THE ARGUMENT REVERSING ACROSS THE CUT. Detected since this compiler
  //    was written, used only to merge two quota slots, and never once
  //    drawn. It is verbatim on both halves and it spans a full stop,
  //    which is why no per-sentence pass can find it.
  if (input.previous && DENIES.test(input.previous.sentence) && ASSERTS.test(sentence)) {
    return read(
      "CONTRAST",
      matched(DENIES, input.previous.sentence),
      "verbatim",
      "the sentence before denied it; this one asserts",
    );
  }

  /* 3 and 5. WHAT THE SENTENCE SAYS IS HAPPENING.
   *
   *  Read TWICE, at two confidences, with the hinge words between them —
   *  and that split is a correction to this file's first version, which
   *  took the proposition only at `verbatim` and dropped it otherwise.
   *
   *  Measured, and the failure was total in the direction that matters:
   *  "Logic was just never the load-bearing thing" reads BECOMES off the
   *  verb table and came out SUSTAIN, because `readProposition` labels a
   *  reading `structural` when it ran the table over the WHOLE SENTENCE
   *  rather than over an action span — which is precisely what it does on
   *  an essay of ideas, which is precisely the material this layer exists
   *  to serve. Gating on `verbatim` discarded exactly the readings the
   *  layer was written for.
   *
   *  Only `inferred` now falls through, and that is the honest line:
   *  inferred means the ROLE was read and the sentence was not. */
  const fromProposition = AS_ACT[proposition.kind];
  const asProposition = (): ActReading | null => {
    if (!fromProposition) return null;
    // A DENIED BECOMES IS NOT A TRANSFORMATION. "Memory was never storage"
    // asserts that the change did not happen, and drawing it as one is the
    // compiler contradicting the sentence it is drawing.
    if (negated && fromProposition === "TRANSFORM") {
      return read(
        "WITHDRAW",
        proposition.because,
        proposition.confidence === "verbatim" ? "verbatim" : "structural",
        "the claim refusing to arrive — a change the sentence denies",
      );
    }
    return read(
      fromProposition,
      proposition.because,
      proposition.confidence === "verbatim" ? "verbatim" : "structural",
      describeAct(fromProposition),
    );
  };
  if (proposition.confidence === "verbatim") {
    const r = asProposition();
    if (r) return r;
  }

  // 4. THE HINGE. A connective that says what the sentence is doing to the
  //    one before it. Below a verbatim proposition, above a structural
  //    one: "instead" is in the text and tells you the shape of the move,
  //    where a verb read off a whole sentence may belong to a subordinate
  //    clause and mean nothing about the main claim.
  for (const [re, act] of HINGES) {
    const hit = matched(re, sentence);
    if (hit) return read(act, hit, "verbatim", `"${hit}" — ${describeAct(act)}`);
  }

  // 4b. THE COLON. An essay setting up a colon is promising to show you
  //     something, and the promise is in the punctuation rather than in
  //     any word. `candidatesFor` has scored this at 0.8 since it was
  //     written, for the same reason and without ever saying what it was.
  //     Not a bare list — there has to be something on both sides of it.
  if (/\w[^.!?:]{8,}:\s+\S+/.test(sentence)) {
    return read("REVEAL", "", "verbatim", "a colon — the essay about to show you something");
  }

  if (proposition.confidence === "structural") {
    const r = asProposition();
    if (r) return r;
  }

  // 5. THE HEDGE, RECOVERED.
  //
  //    It fires here rather than at the top, and the ordering is the whole
  //    argument for the field: a hedge MODIFIES a claim, it is not itself
  //    one. Where the prose states a change outright, the change is the
  //    act and `hedged` lowers how hard it is drawn. Where nothing else
  //    spoke, the qualification IS what the sentence is doing — and that
  //    is a very large share of argumentative prose, which is exactly what
  //    a `score *= 0.45` could never express.
  if (hedged) {
    return read(
      "QUALIFY",
      matched(HEDGE, sentence),
      "verbatim",
      "the essay qualifying rather than claiming",
    );
  }

  // 6. THE DELIVERY.
  //
  //    The one signal in the vocabulary that no lexicon can reach, and it
  //    has been computed on every narrated film and read at zero call
  //    sites. A passage spoken faster than this film's own median is the
  //    reader pressing; a long sentence followed by a short one is the
  //    essay compressing. Both are state changes with no new object in
  //    them at all, which is the case this whole layer exists for.
  if ((input.relativeRate ?? 0) > PRESSING) {
    return read(
      "INTENSIFY",
      "",
      "structural",
      `spoken ${Math.round(((input.relativeRate ?? 1) - 1) * 100)}% faster than this film's own pace`,
    );
  }
  if (
    input.previous &&
    wordCount(sentence) <= BLOW_WORDS &&
    wordCount(input.previous.sentence) >= RUN_UP_WORDS
  ) {
    return read("INTENSIFY", "", "structural", "a long sentence, then a short one");
  }
  // THE ESSAY COMMITTING. It hedged, and now it does not. Both halves have
  // been computed on every scene and never compared.
  if (input.previous && HEDGE.test(input.previous.sentence)) {
    return read("INTENSIFY", "", "structural", "the essay hedged, and has stopped hedging");
  }

  // 7. WHAT THE PROSE PRINTED. A figure or a route is checkable by anyone
  //    and is the prose asking for a picture — `promote.ts` has always
  //    treated it that way and this does not change the judgement, only
  //    the vocabulary it is expressed in.
  if ((input.count ?? 0) > 2) {
    return read("ACCUMULATE", "", "verbatim", `the prose printed ${input.count}`);
  }
  if ((input.figures ?? 0) > 0) {
    return read("DECLARE", "", "verbatim", "the prose printed a figure");
  }
  if ((input.route ?? 0) >= 2) {
    return read("DECLARE", "", "verbatim", "the prose drew a route");
  }

  // 8. PRESENCE.
  //
  //    Last, and that position is the point. Naming a thing is the WEAKEST
  //    reason to draw it, not the strongest — every branch above is a
  //    statement about what the sentence DOES, and this one is only a
  //    statement about what it mentions. The compiler used to ask this
  //    question first.
  const arriving = named.filter((n) => !standing.has(n));
  if (arriving.length > 0) {
    return read("DECLARE", "", "structural", `"${arriving[0]}" arrives`);
  }
  //    AND THE DISCARDED HALF OF THAT LINE. `promote.ts` computes
  //    `arriving` and has never computed its complement — a sentence
  //    RE-naming what the film already has standing. On its own that is
  //    development and holds; with the prose totalising, it is more of the
  //    same thing.
  const again = named.filter((n) => standing.has(n));
  if (again.length > 0 && /\b(?:all|every|each|both|these|those|many|most)\b/i.test(sentence)) {
    return read("ACCUMULATE", "", "structural", `"${again[0]}" again, and more of it`);
  }

  // 9. THE FLOOR. Something is standing and this sentence develops it;
  //    or nothing is, and the film has to start somewhere. Honestly
  //    labelled as an inference either way.
  if (standing.size > 0 || (input.previous ?? null) !== null) {
    return read("SUSTAIN", "", "inferred", "the argument develops, and the world stays as it is");
  }
  return read("DECLARE", "", "inferred", "the film has to begin somewhere");
}

/** Plain language, for the report and the Compile view. The director
 *  should be able to read what the compiler thought was happening without
 *  learning the vocabulary. */
export function describeAct(a: Act): string {
  const base: Record<Act, string> = {
    DECLARE: "something is put on screen",
    SUSTAIN: "what is there stays there",
    WITHDRAW: "something goes",
    NONE: "nothing on screen",
    ACCUMULATE: "more of it",
    CONVERGE: "the distance closing",
    CONTRAST: "one reading displacing another",
    QUALIFY: "the essay giving ground",
    REVEAL: "something shown through",
    TRANSFORM: "one thing turning into another",
    INTENSIFY: "the same thing, pressed harder",
    RECALL: "something from earlier, back",
  };
  return base[a];
}

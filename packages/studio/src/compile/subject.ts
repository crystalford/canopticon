// WHAT THE SENTENCE DEPICTS — read from the prose, with no model.
//
// The complaint that produced this file: "I've never seen it render an
// object yet." That was exactly true, and the reason was structural rather
// than aesthetic. The palette has precisely two object generators —
// `creature_chain` and `mounted_fixture` — and the ONLY path to either ran
// through `BODY_PLANS`, which is keyed on a ratified SemanticReading's
// subject kind. A reading is a model proposal that a human approves, the
// model declines rather than guesses, and most scenes therefore had no
// reading at all. So every route to the object families was gated behind a
// door that was almost always shut, and the film fell back to type.
//
// THE SAME DISTINCTION THAT LET FIGURES REACH THE CHART FAMILY.
//
// A *reading* — what a sentence MEANS — is an interpretation. It needs a
// model to propose it and a human to ratify it, and that gate is not
// negotiable.
//
// A *figure* is checkable by anyone against the text, so it needs neither.
//
// WHETHER A SENTENCE NAMES A DEPICTABLE THING is the second kind, not the
// first. "The smoke detector in room 214 had been disconnected" contains
// the word "detector". That is not an interpretation of the sentence, it
// is a fact about its surface, verifiable by reading it — and it is enough
// to know that this scene wants a fixture on screen rather than a caption.
//
// So this is a LEXICON, matched as whole words, with the matched span and
// its character offset recorded so any claim it makes can be checked
// against the prose the way a figure can. It never decides what a sentence
// argues. It decides what is in the room.
//
// WHAT IT DELIBERATELY DOES NOT DO. It does not outrank a ratified reading
// — a human-approved interpretation is better information than a word
// match and stays in front of it. It does not outrank a figure — on an
// institutional essay the number is the finding and a picture of a
// building is not an improvement on it. It declines rather than reaching:
// a sentence naming nothing depictable gets nothing from this file, and
// the film's own abstraction curve carries it, exactly as before.

import type { SemanticReading } from "../ir/schema.ts";

/** What kind of thing the sentence names, in the vocabulary the treatment
 *  planner already speaks. Deliberately the SAME union as a reading's
 *  subject kind, so a detected subject can be handed to `planTreatment`
 *  without a second code path — the body plans, the type bridges and the
 *  visual-language tails all already exist and all already work. */
export type SubjectKind = SemanticReading["subjects"][number]["kind"];

export interface DetectedSubject {
  /** The word as it appears in the prose. Verbatim, like a figure. */
  text: string;
  /** Where it appears, so the claim is checkable against the source. */
  offset: number;
  kind: SubjectKind;
  /** How specific this noun is, 0..1. "detector" is a thing you can draw;
   *  "system" is a word people use when they do not want to say which
   *  thing. Specific wins. */
  weight: number;
}

/** The lexicon.
 *
 *  Curated, not generated, and deliberately short. A body plan is a
 *  parameterised generator rather than an asset — `mounted_fixture` is a
 *  smoke detector, a camera dome, a sprinkler head or a speaker depending
 *  on its parameters — so a few dozen nouns reach a great deal of prose.
 *
 *  Weights are the honest part. A word that names a specific physical
 *  thing scores high; a word that names a category of things scores low
 *  enough to lose to anything more concrete in the same sentence, and low
 *  enough to lose to a figure. "Infrastructure" is not a picture.
 */
const LEXICON: Array<{ kind: SubjectKind; weight: number; words: string[] }> = [
  // ── things mounted in rooms. The palette's `mounted_fixture` body plan.
  {
    kind: "object",
    weight: 0.95,
    words: [
      "detector",
      "detectors",
      "alarm",
      "alarms",
      "sprinkler",
      "sprinklers",
      "camera",
      "cameras",
      "sensor",
      "sensors",
      "speaker",
      "speakers",
      "thermostat",
      "smoke alarm",
      "smoke detector",
      "security camera",
      "surveillance camera",
    ],
  },
  {
    kind: "object",
    weight: 0.85,
    words: [
      "door",
      "doors",
      "window",
      "windows",
      "lock",
      "locks",
      "gate",
      "gates",
      "fence",
      "fences",
      "turnstile",
      "turnstiles",
      "barrier",
      "barriers",
      "sign",
      "signs",
      "screen",
      "screens",
      "monitor",
      "monitors",
      "keypad",
      "badge",
      "badges",
      "bed",
      "beds",
      "mattress",
      "mattresses",
      "cot",
      "cots",
      "bus",
      "buses",
      "van",
      "vans",
      "truck",
      "trucks",
      "container",
      "containers",
      "pipe",
      "pipes",
      "valve",
      "valves",
      "meter",
      "meters",
      "cable",
      "cables",
      "server",
      "servers",
      "phone",
      "phones",
    ],
  },
  // ── bodies and things that move like them. `creature_chain`.
  {
    kind: "creature",
    weight: 0.95,
    words: [
      "centipede",
      "centipedes",
      "insect",
      "insects",
      "worm",
      "worms",
      "snake",
      "snakes",
      "spider",
      "spiders",
      "swarm",
      "swarms",
      "colony",
      "colonies",
      "parasite",
      "parasites",
      "organism",
      "organisms",
    ],
  },
  {
    kind: "creature",
    weight: 0.82,
    words: [
      "crowd",
      "crowds",
      "queue",
      "queues",
      "line-up",
      "procession",
      "convoy",
      "convoys",
      "migration",
      "chain of",
    ],
  },
  // ── paper. The palette's strongest and most literal register.
  {
    kind: "document",
    weight: 0.9,
    words: [
      "contract",
      "contracts",
      "invoice",
      "invoices",
      "memo",
      "memos",
      "memorandum",
      "report",
      "reports",
      "filing",
      "filings",
      "letter",
      "letters",
      "form",
      "forms",
      "ledger",
      "ledgers",
      "receipt",
      "receipts",
      "statement",
      "statements",
      "agreement",
      "agreements",
      "application",
      "applications",
      "permit",
      "permits",
      "licence",
      "license",
      "licences",
      "licenses",
      "minutes",
      "transcript",
      "transcripts",
      "email",
      "emails",
      "affidavit",
      "affidavits",
      "tender",
      "tenders",
      "audit",
      "audits",
      "disclosure",
      "disclosures",
      "clause",
      "clauses",
      "amendment",
      "amendments",
      "briefing",
      "briefings",
      "dossier",
      "dossiers",
      "record",
      "records",
      "file",
      "files",
    ],
  },
  // ── people, as roles rather than names. A named person is caught by the
  //    proper-noun rule in scene-kind and treated as attribution; a ROLE is
  //    a figure in a room and can be depicted.
  {
    kind: "person",
    weight: 0.75,
    words: [
      "minister",
      "ministers",
      "officer",
      "officers",
      "contractor",
      "contractors",
      "executive",
      "executives",
      "director",
      "directors",
      "auditor",
      "auditors",
      "inspector",
      "inspectors",
      "spokesperson",
      "official",
      "officials",
      "claimant",
      "claimants",
      "resident",
      "residents",
      "tenant",
      "tenants",
      "worker",
      "workers",
      "staff",
      "guard",
      "guards",
    ],
  },
  // ── people in general, at a deliberately lower weight than a named
  //    role. "People" is depictable — it is bodies — but it says nothing
  //    about WHICH bodies, so it must lose to any sentence that also
  //    names an inspector, a crowd or an insect.
  //
  //    Absent entirely until "the policy was designed to make people feel
  //    as though they were being watched" detected NO subject at all: the
  //    lexicon knew "claimant" and "tenant" because it was grown from one
  //    institutional essay, and had never needed the ordinary word.
  {
    kind: "person",
    weight: 0.62,
    words: [
      "people",
      "person",
      "persons",
      "man",
      "men",
      "woman",
      "women",
      "child",
      "children",
      "family",
      "families",
      "figure",
      "figures",
      "passenger",
      "passengers",
      "pedestrian",
      "pedestrians",
    ],
  },
  // ── somewhere. Not a named place — scene-kind already catches those —
  //    but a KIND of place, which is depictable as a space rather than a
  //    point on a map.
  //
  //    DELIBERATELY THE LOWEST WEIGHTS HERE. A place is usually the
  //    SETTING of a sentence rather than its subject: "the crowd of
  //    residents waited in the corridor" is about the crowd. Ranked above
  //    the others, "corridor" won and the film built an empty room —
  //    which is a correct reading of a lexicon and a wrong reading of the
  //    sentence.
  {
    kind: "place",
    weight: 0.58,
    words: [
      // The settlement scale. Absent until the sentence test asked for
      // "they walked around the cities like insects" and the compiler
      // could not see the cities at all — the lexicon had been grown
      // entirely from one institutional housing essay, so it knew
      // "corridor" and "shelter" and not "city". A missing noun is not a
      // ranking problem: the space construction was UNREACHABLE for that
      // sentence, which is a different and worse failure than losing.
      "city",
      "cities",
      "town",
      "towns",
      "street",
      "streets",
      "neighbourhood",
      "neighbourhoods",
      "neighborhood",
      "neighborhoods",
      "district",
      "districts",
      "block",
      "blocks",
      "hotel",
      "hotels",
      "motel",
      "motels",
      "building",
      "buildings",
      "facility",
      "facilities",
      "warehouse",
      "warehouses",
      "office",
      "offices",
      "corridor",
      "corridors",
      "hallway",
      "hallways",
      "room",
      "rooms",
      "floor",
      "floors",
      "basement",
      "lobby",
      "shelter",
      "shelters",
      "camp",
      "camps",
      "site",
      "sites",
      "border",
      "borders",
      "airport",
      "airports",
      "port",
      "ports",
      "terminal",
      "terminals",
      "station",
      "stations",
      "compound",
      "compounds",
    ],
  },
];

/** Nouns that sound concrete and cannot be drawn. Listed rather than
 *  filtered by a rule, because the rule people reach for — "abstract nouns
 *  end in -ion" — also excludes "detection" and includes "onion".
 *
 *  These lose to anything in the lexicon and, on their own, produce no
 *  subject at all. A film that renders a ceiling fixture every time an
 *  essay says "infrastructure" is worse than one that renders type. */
/** Nouns that name a real thing in the argument and no thing you can point
 *  a camera at. Used two ways, and the difference matters: a subject must
 *  be depictable to be BUILT, but a relation's participants need only be
 *  named — "the policy made the residents afraid" is a relation whose
 *  agent cannot be drawn, and refusing to read it because of that would
 *  discard the causal structure along with the picture. */
const NOT_DEPICTABLE = new Set([
  "system",
  "systems",
  "programme",
  "program",
  "programs",
  "policy",
  "policies",
  "framework",
  "frameworks",
  "infrastructure",
  "capacity",
  "process",
  "processes",
  "measure",
  "measures",
  "approach",
  "strategy",
  "initiative",
  "initiatives",
  "arrangement",
  "arrangements",
  "mechanism",
  "mechanisms",
  "structure",
  "structures",
]);

/** Every depictable noun this sentence names, best first.
 *
 *  Matched as whole words against the lowercased prose, and each result
 *  carries the offset at which it was found — so a claim this file makes
 *  can be checked against the source exactly the way a figure's can. */
export function detectSubjects(sentence: string): DetectedSubject[] {
  const lower = sentence.toLowerCase();
  const found: DetectedSubject[] = [];
  const seen = new Set<string>();

  for (const entry of LEXICON) {
    for (const word of entry.words) {
      if (seen.has(word)) continue;
      const offset = wholeWordIndex(lower, word);
      if (offset < 0) continue;
      seen.add(word);
      found.push({
        // Verbatim, as it appears — the prose's own casing, not the
        // lexicon's.
        text: sentence.slice(offset, offset + word.length),
        offset,
        kind: entry.kind,
        // A noun that arrives early in the sentence is more likely to be
        // its subject than one trailing a subordinate clause. Small
        // nudge — it breaks ties, it does not overrule specificity.
        weight: entry.weight - Math.min(0.08, (offset / Math.max(1, sentence.length)) * 0.12),
      });
    }
  }

  /* ONE NOUN, ONE SPAN.
   *
   * "smoke detector" and "detector" are both in the lexicon and both
   * match "A smoke detector was installed in every room" — at offsets 2
   * and 8, the second sitting INSIDE the first. Two subjects where the
   * prose named one.
   *
   * That is not cosmetic. `readRelation` orders by offset, takes the
   * first two and reads what sits between them; between offset 2+15 and
   * offset 8 there is nothing, so it returns null. Measured: EVERY
   * sentence containing a multi-word lexicon entry — smoke detector,
   * smoke alarm, security camera, surveillance camera, line-up, chain of
   * — silently lost its relation, and with it the whole
   * relation → semantic scene → composeFromMeaning path. Six entries, and
   * they are precisely the institutional vocabulary this was grown from.
   *
   * The longer span wins because it is the more specific reading: a
   * sentence that said "smoke detector" did not say "detector". */
  const spans = [...found].sort((a, b) => a.offset - b.offset || b.text.length - a.text.length);
  const kept: DetectedSubject[] = [];
  for (const s of spans) {
    const inside = kept.some(
      (k) => s.offset >= k.offset && s.offset + s.text.length <= k.offset + k.text.length,
    );
    if (!inside) kept.push(s);
  }

  return kept.sort((a, b) => b.weight - a.weight || a.offset - b.offset);
}

/** True when the sentence's only concrete-sounding nouns are the ones no
 *  one can draw. Exposed so the Compile view can say "nothing depictable"
 *  rather than leaving a silent fallback looking like a decision. */
export function namesOnlyAbstractions(sentence: string): boolean {
  if (detectSubjects(sentence).length > 0) return false;
  return sentence
    .toLowerCase()
    .split(/[^a-z-]+/)
    .some((w) => NOT_DEPICTABLE.has(w));
}

/** The abstractions a sentence names, with their offsets — the same shape
 *  as a detected subject so a relation can hold one at either end.
 *
 *  Weight is deliberately 0: these can never be BUILT, and returning them
 *  in the same shape is only safe because that zero makes them lose every
 *  comparison a construction makes. What they can do is stand at one end
 *  of a relation, which is a different question from what can be drawn. */
export function detectAbstractions(sentence: string): DetectedSubject[] {
  const lower = sentence.toLowerCase();
  const out: DetectedSubject[] = [];
  for (const word of NOT_DEPICTABLE) {
    const at = wholeWordIndex(lower, word);
    if (at < 0) continue;
    out.push({
      text: sentence.slice(at, at + word.length),
      offset: at,
      kind: "concept",
      weight: 0,
    });
  }
  return out.sort((a, b) => a.offset - b.offset);
}

/** A reading synthesised from what the prose NAMES, when no human-ratified
 *  one exists.
 *
 *  Returns null far more often than not, and that is correct: most
 *  sentences in an institutional essay name nothing you can point a camera
 *  at. What this catches is the minority that do — and until it existed,
 *  that minority rendered as type exactly like the rest.
 *
 *  `visualOpportunity` is picked from the sentence's own shape rather than
 *  guessed: a sentence naming one thing wants to be looked AT (inspect);
 *  one naming several wants them set against each other (contrast). */
export function subjectReading(
  sentence: string,
  label: string,
): (SemanticReading & { detected: DetectedSubject }) | null {
  const subjects = detectSubjects(sentence);
  const best = subjects[0];
  if (!best) return null;

  // Two DIFFERENT things named is a comparison; the same thing twice is
  // still one thing.
  const distinct = new Set(subjects.map((s) => s.text.toLowerCase()));

  return {
    sentence,
    subjects: [
      { label: best.text, kind: best.kind, weight: Math.min(1, best.weight) },
      ...subjects.slice(1, 3).map((s) => ({
        label: s.text,
        kind: s.kind,
        weight: Math.min(1, s.weight),
      })),
    ],
    visualOpportunity: distinct.size > 1 ? "contrast" : "inspect",
    // Set by the caller from the prose's own hedging. Named here so the
    // shape is complete; `compose.ts` overwrites it with `looksContested`.
    contested: false,
    detected: best,
    // Kept so a downstream view can print the label the segmenter derived
    // alongside the noun this actually found.
    ...(label ? {} : {}),
  };
}

/** A sentence whose subject is a pronoun pointing at the last thing named.
 *
 *  "Then there were dozens of THEM, moving through the streets in strange
 *  synchronized waves." names nothing depictable and is entirely about the
 *  insects from two sentences ago. Without this the film built creatures
 *  for the first beat and set type for the third — which is the "isolated
 *  shots" failure: every sentence inventing its own world, and a film that
 *  cannot hold an image for three sentences.
 *
 *  Deliberately narrow. It fires on a bare anaphor near the head of the
 *  sentence and nothing else; "it was a policy shift" is not a scene about
 *  a smoke detector because the word "it" appeared in it. Checkable
 *  against the prose like everything else here. */
/* WHAT COUNTS AS REFERRING BACK.
 *
 * "it" and "its" were in this list, and they are why five scenes of a
 * thirty-nine scene film were built from a noun that does not appear in
 * them — s005 "When the printed page arrived IT did not simply carry
 * speech" was built as a mounted fixture "from the word window", four
 * sentences after the last window.
 *
 * Singular "it" is the least referential pronoun in English. It is a
 * dummy subject far more often than a reference — "it is interesting",
 * "it is now a thing that happens", "it says" — and it also routinely
 * refers to something the sentence names ITSELF, as in the printed page
 * above. Treating it as "still talking about the last object" is not a
 * memory, it is a leak.
 *
 * The plural and demonstrative forms stay. They are strongly referential
 * and they are the case this mechanism was written for — "then there were
 * dozens of THEM, moving through the streets", which still works. */
const ANAPHOR = /\b(them|they|their|these|those)\b/i;

/** A subject specific enough that the sentence is plainly about it, rather
 *  than merely mentioning it. Above this, the sentence speaks for itself
 *  and needs no memory; at or below it, a setting has been named and the
 *  thing moving through that setting may still be two sentences back. */
const SPEAKS_FOR_ITSELF = 0.7;

export function refersBack(sentence: string): boolean {
  // Naming ANYTHING used to disqualify a sentence from referring back,
  // which quietly made the film's memory conditional on its prose never
  // mentioning a room. "Then there were dozens of them, moving through the
  // streets in strange synchronized waves" is the case that proved it: one
  // low-weight place noun and the insects the sentence is entirely about
  // were forgotten. A place is the SETTING; it does not displace a
  // subject, and it should not silence one either.
  if (detectSubjects(sentence).some((s) => s.weight > SPEAKS_FOR_ITSELF)) return false;
  const head = sentence.split(/[,;:]/)[0] ?? sentence;
  return ANAPHOR.test(head);
}

/** Whole-word search. "border" must not match "borderline", and "record"
 *  must not match "recorded" — a substring match here would put a filing
 *  cabinet on screen every time an essay used a verb. */
function wholeWordIndex(haystack: string, needle: string): number {
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) return -1;
    const before = at === 0 ? " " : haystack[at - 1];
    const after = haystack[at + needle.length] ?? " ";
    if (!isWordChar(before) && !isWordChar(after)) return at;
    from = at + 1;
  }
}

function isWordChar(c: string | undefined): boolean {
  return c !== undefined && /[a-z0-9-]/.test(c);
}

// DIRECTOR INTENT — what the director wants the audience to do, read
// deterministically, and turned into a bias on what the machine BUILDS.
//
// THE TEST THIS FILE EXISTS TO PASS.
//
//   "Take the sentence 'They walked around the cities like insects.'
//    Generate five candidates. Do not use the same underlying construction
//    or simply vary parameters... Then change DirectorIntent from 'make
//    this feel inevitable' to 'make this feel absurd' and demonstrate that
//    the candidate space changes, rather than merely changing colour,
//    speed, or an effect parameter."
//
// Run before this file existed, the compiler answered with four programs
// across two constructions, and the top two were the same construction
// differing by one operator — a picker offering the same thing twice. The
// cause was one line and it was a type signature:
//
//   fit(beat: Beat): number
//
// No Style. The director's state could not influence WHAT was built, only
// what was done to it afterwards. That is the definition of "different
// effects, not different ideas", and no amount of new primitives fixes it.
//
// WHAT AN INTENT IS HERE.
//
//   NOT A SLIDER. A slider would make intent another creative-state curve,
//   and the curves already exist. Intent is prose, because "make this feel
//   inevitable" is not a position on an axis.
//
//   NOT A MODEL CALL. It is read the way `subject.ts` reads what a
//   sentence NAMES: a curated lexicon, matched as whole words, each hit
//   carrying its verbatim text so the reading is checkable against what
//   the director actually typed. Whether the word "absurd" appears in the
//   direction is not a matter of interpretation, so it needs no model and
//   no ratification. The same distinction that lets a figure skip the
//   ratification gate applies here for the same reason.
//
//   NOT A TEMPLATE. A register names no construction outright; it moves
//   appetites, exactly as a visual language does. Two films directed
//   "make it absurd" over different sentences build different things.
//
// THE MECHANISM THAT MAKES CANDIDATES GENUINELY DIFFERENT: DISLOCATION.
//
// A sentence about people walking has one honest construction — a body —
// and every other reading of it is the same body wearing different
// operators. The interesting candidates are the ones that build the
// sentence as something it is not:
//
//   people as bodies         the literal reading
//   people as a network      each person a node, the walk a topology
//   people as a space        the city is the organism, not its occupants
//   people as type           the WORDS crawl; typography with a gait
//   people as evidence       the sentence as a document about people
//
// Those are five different cinematic interpretations and they need no new
// primitives at all — they are the constructions that already exist,
// reached for against the grain of the noun. Dislocation is how far
// against the grain the director is willing to go, and it is the single
// number that "inevitable" and "absurd" most disagree about.

/** What the director wants this beat to do to the audience. Every field
 *  optional, all of it prose, none of it required for a film to compile —
 *  a scene without intent falls back to the film's own curve, exactly as
 *  a scene without a ratified reading does. */
export interface DirectorIntent {
  /** What the audience should understand. */
  understand?: string | undefined;
  /** What it should feel like. */
  feel?: string | undefined;
  /** What the audience should notice. */
  notice?: string | undefined;
  /** What should be withheld. */
  hide?: string | undefined;
}

/** A directorial register, and what it makes the compiler reach for.
 *
 *  Deliberately small. Ten registers is not a claim that direction has
 *  ten flavours — it is the set that can be read off prose reliably
 *  enough to act on. A direction matching nothing is not an error; it
 *  leaves the curve in charge, which is the honest outcome. */
interface Register {
  id: string;
  /** Matched as whole words against the intent prose, lowercased. */
  words: string[];
  /** How far this register wants to build a thing as something it is not,
   *  0..1. The single most discriminating number here. */
  dislocation: number;
  /** Bias on a construction's score. Positive reaches for it. */
  constructions?: Record<string, number>;
  /** Bias on an operator's appetite, added on top of the language's. */
  ops?: Record<string, number>;
  /** WHAT THIS REGISTER DOES TO THE FILM'S OWN CURVES, per dial, -1..1.
   *
   *  The second half of the fix, and the half that is easy to stop short
   *  of. Moving which CONSTRUCTION wins is selection; this is execution.
   *  A register that could only reach `energy` and `density` left a body
   *  built to identical numbers under five different directions — same
   *  segments, same gait, same wander — with only the operator tail
   *  changing, which is the "different colour and post-processing"
   *  failure wearing a new hat.
   *
   *  Every construction already reads these dials to set its own
   *  parameters, so biasing the state reaches scale, speed, gait, wander,
   *  segment count, depth, haze and typographic weight without this file
   *  knowing any of those names. That is the point: a register states a
   *  disposition, not a parameter. */
  style?: Partial<Record<StyleDial, number>>;
}

/** The dials a register may bend. Named here rather than imported as
 *  `keyof Style` so this file states its own contract — a new dial on the
 *  creative state should be a deliberate decision to expose, not something
 *  a register silently gains access to. */
export type StyleDial =
  | "abstraction"
  | "density"
  | "energy"
  | "human"
  | "typography"
  | "archival"
  | "data"
  | "experimentalism"
  | "restraint"
  | "population"
  | "attention";

const REGISTERS: Register[] = [
  /* ── INEVITABLE. The thing was always going to happen.
   *
   * Deliberately the LOWEST dislocation in the table. Inevitability is a
   * property of watching the thing itself continue — a body that keeps
   * walking, a count that keeps rising. Build it as something else and
   * the inevitability is the director's assertion rather than the
   * picture's, which is the opposite of what was asked for. */
  {
    id: "inexorable",
    words: [
      "inevitable",
      "inevitably",
      "inexorable",
      "relentless",
      "relentlessly",
      "mounting",
      "accumulating",
      "accumulation",
      "unstoppable",
      "closing",
      "creeping",
      "encroaching",
      "steadily",
      "no way out",
    ],
    dislocation: 0.1,
    constructions: { body: 0.5, quantity: 0.45, network: 0.35, route: 0.3, type: -0.2 },
    ops: { grade: 0.2, soften: 0.15, sort: 0.2, split: -0.25, fragment: -0.3 },
    // Held, dense and unhurried. Inevitability is not speed — a thing
    // arriving fast is a shock; a thing arriving slowly and without pause
    // is inevitable.
    style: { energy: -0.14, density: 0.24, restraint: 0.18, experimentalism: -0.12 },
  },

  /* ── ABSURD. The thing is ridiculous and the picture should admit it.
   *
   * The HIGHEST dislocation, and this is the whole point of the pair. A
   * sentence built faithfully cannot be absurd — faithfulness is what
   * absurdity is a departure from. So absurdity is category error made
   * deliberately: build the people as a chart, the city as a creature,
   * the argument as a document nobody read. */
  {
    id: "absurd",
    words: [
      "absurd",
      "absurdity",
      "ridiculous",
      "ridiculously",
      "farcical",
      "farce",
      "preposterous",
      "comic",
      "comical",
      "silly",
      "grotesque",
      "ludicrous",
      "deadpan",
    ],
    dislocation: 0.95,
    constructions: { quantity: 0.4, paper: 0.35, type: 0.3, network: 0.25, space: 0.2 },
    ops: { halftone: 0.3, threshold: 0.25, pixelate: 0.2, split: 0.3, soften: -0.3 },
    // Loud, unrestrained and willing to look wrong. Archival weight comes
    // DOWN because the archival register is what lends a shot its air of
    // sober authority, and absurdity is the refusal of that air.
    style: {
      energy: 0.22,
      experimentalism: 0.4,
      restraint: -0.34,
      archival: -0.2,
      typography: 0.2,
    },
  },

  /* ── UNEASE. Something is wrong and the picture will not say what. */
  {
    id: "unease",
    words: [
      "unease",
      "uneasy",
      "dread",
      "dreadful",
      "sinister",
      "ominous",
      "menacing",
      "wrong",
      "unsettling",
      "unsettled",
      "creepy",
      "disquiet",
      "disturbing",
      "claustrophobic",
    ],
    dislocation: 0.5,
    constructions: { space: 0.45, fixture: 0.35, body: 0.2, quantity: -0.2 },
    ops: { grade: 0.3, soften: 0.25, scanline: 0.2, trace: 0.2, halftone: -0.2 },
    // Slower, closer, and a step further from the literal — the thing is
    // not quite being shown to you. Human presence UP because a body in
    // the frame is what makes an empty room uneasy rather than merely
    // empty.
    style: { energy: -0.26, abstraction: 0.16, human: 0.18, restraint: 0.12 },
  },

  /* ── CLINICAL. The register the Record already speaks in. */
  {
    id: "clinical",
    words: [
      "clinical",
      "clinically",
      "forensic",
      "forensically",
      "precise",
      "precisely",
      "procedural",
      "evidential",
      "documentary",
      "factual",
      "neutral",
      "dispassionate",
      "matter of fact",
    ],
    dislocation: 0.05,
    constructions: { paper: 0.5, quantity: 0.45, route: 0.35, body: -0.15 },
    ops: { trace: 0.3, threshold: 0.2, grade: -0.2, fragment: -0.35, split: -0.3 },
    // The most restrained entry in the table, and the only one that pulls
    // abstraction DOWN. A clinical picture is one that lets the thing be
    // seen; everything else here is a way of not quite showing it.
    style: {
      energy: -0.3,
      density: 0.18,
      abstraction: -0.26,
      restraint: 0.36,
      data: 0.26,
      archival: 0.2,
      experimentalism: -0.3,
    },
  },

  /* ── OVERWHELM. There is too much and that IS the point. */
  {
    id: "overwhelm",
    words: [
      "overwhelming",
      "overwhelmed",
      "overwhelm",
      "drowning",
      "flooded",
      "buried",
      "swamped",
      "too much",
      "relentless volume",
      "saturated",
      "deluge",
      "torrent",
    ],
    dislocation: 0.45,
    constructions: { quantity: 0.4, network: 0.4, body: 0.3, type: 0.2 },
    ops: { fragment: 0.3, sort: 0.25, pixelate: 0.2, soften: -0.3 },
    // More of everything at once, and no restraint left to stop it. This
    // is the register most visible in the picture itself: a body built
    // under it has more segments, moves faster and wanders further.
    //
    // POPULATION rises hard and ATTENTION falls: being overwhelmed is a
    // relation between one thing and a world with too much in it, so the
    // world has to be populated AND has to take the frame. Raising density
    // alone would give a busy texture around a subject still holding the
    // shot, which is a picture of a busy day rather than of drowning.
    style: {
      energy: 0.34,
      density: 0.48,
      restraint: -0.38,
      abstraction: 0.12,
      population: 0.5,
      attention: -0.22,
    },
  },

  /* ── ISOLATION. One thing, and space around it. */
  {
    id: "isolation",
    words: [
      "isolated",
      "isolation",
      "alone",
      "lonely",
      "abandoned",
      "empty",
      "emptiness",
      "singular",
      "solitary",
      "deserted",
      "silence",
      "still",
    ],
    dislocation: 0.3,
    constructions: { fixture: 0.45, space: 0.4, body: 0.15, network: -0.3, quantity: -0.25 },
    ops: { soften: 0.3, grade: 0.2, fragment: -0.35, sort: -0.3 },
    // The inverse of overwhelm, dial for dial, and deliberately so —
    // these are the two ends of the same axis and a register table that
    // did not make that obvious would be hiding its own structure.
    style: {
      energy: -0.38,
      density: -0.42,
      restraint: 0.3,
      human: -0.22,
      population: -0.5,
      attention: 0.26,
    },
  },

  /* ── INDIFFERENT. The world is busy and it does not care.
   *
   * The register this whole compositing pass earned. It is NOT isolation:
   * an empty street is one reading of "nobody noticed" and a crowded one
   * that simply carries on is the other, and the second is the harder and
   * more interesting picture — the viewer has to FIND the anomaly rather
   * than being handed it against negative space.
   *
   * So this is the only entry in the table that raises population while
   * lowering attention: a full world, and the subject small inside it.
   * Hopper and Bruegel, made directable. */
  {
    id: "indifferent",
    words: [
      "indifferent",
      "indifference",
      "unnoticed",
      "unremarked",
      "oblivious",
      "uncaring",
      "carries on",
      "carried on",
      "ordinary",
      "mundane",
      "routine",
      "unbothered",
      "nobody notices",
      "nobody noticed",
    ],
    // Low. Indifference is a fact about the world continuing, and building
    // that world as something it is not would make the indifference the
    // director's assertion rather than the picture's — the same argument
    // `inexorable` makes, applied to a different fact.
    dislocation: 0.2,
    constructions: { space: 0.45, body: 0.2, network: 0.2, type: -0.2 },
    ops: { grade: 0.2, soften: 0.15, fragment: -0.25 },
    style: { population: 0.45, attention: -0.36, energy: -0.1, restraint: 0.16 },
  },

  /* ── REVELATION. Something arrives that was there all along. */
  {
    id: "revelation",
    words: [
      "reveal",
      "reveals",
      "revealed",
      "revelation",
      "exposed",
      "expose",
      "uncovered",
      "becomes clear",
      "turns out",
      "discovers",
      "discovered",
      "emerges",
      "surfaces",
    ],
    dislocation: 0.4,
    constructions: { paper: 0.35, fixture: 0.3, route: 0.25, type: 0.25 },
    ops: { threshold: 0.3, trace: 0.3, dither: 0.2, soften: -0.2 },
    // Toward the literal, because a revelation is a thing becoming
    // legible. Abstraction rising at the moment of disclosure would be
    // the picture withholding exactly when the prose stops withholding.
    style: { energy: 0.18, abstraction: -0.14, typography: 0.18, restraint: -0.12 },
  },

  /* ── SCALE. The thing is far bigger or smaller than the sentence lets on. */
  {
    id: "scale",
    words: [
      "vast",
      "enormous",
      "immense",
      "huge",
      "dwarfed",
      "tiny",
      "minuscule",
      "microscopic",
      "sprawling",
      "endless",
      "scale",
      "monumental",
    ],
    dislocation: 0.55,
    constructions: { space: 0.5, network: 0.35, quantity: 0.3, fixture: -0.2 },
    ops: { grade: 0.2, soften: 0.2, pixelate: 0.15 },
    // Human presence DOWN: scale is legible only by what it dwarfs, and a
    // figure held large in frame is the thing that destroys the sense of
    // it. ATTENTION follows for the same reason — "enormous" is a claim
    // about the environment, so the environment has to be entitled to the
    // frame or the word reaches nothing but a grade.
    style: {
      density: 0.34,
      abstraction: 0.16,
      human: -0.24,
      energy: -0.1,
      population: 0.3,
      attention: -0.34,
    },
  },

  /* ── STRANGE. The director asking for the unfamiliar, in as many words.
   *
   * Kept separate from `absurd` because they are not the same request:
   * absurd is comic and wants category error; strange is serious and
   * wants the unfamiliar reading of the right category. */
  {
    id: "strange",
    words: [
      "strange",
      "stranger",
      "strangeness",
      "uncanny",
      "surreal",
      "dreamlike",
      "hallucinatory",
      "alien",
      "unfamiliar",
      "disorienting",
      "unreal",
    ],
    dislocation: 0.8,
    constructions: { body: 0.3, space: 0.3, network: 0.25, paper: -0.2 },
    ops: { split: 0.3, fragment: 0.3, sort: 0.25, trace: 0.2, threshold: -0.15 },
    // The most experimental entry, and unlike `absurd` it keeps its
    // restraint: strangeness that shouts is comedy, and this register is
    // the serious one of the pair.
    style: { energy: 0.24, abstraction: 0.38, experimentalism: 0.46, archival: -0.15 },
  },
];

/** What a direction was read to mean. Everything here is derived from
 *  words that are literally present in the intent prose, and `matched`
 *  carries them back verbatim so a director can see what was heard — the
 *  same courtesy `subject.ts` extends about nouns. */
export interface IntentReading {
  /** Registers that fired, strongest first. */
  registers: string[];
  /** The verbatim words that fired them, in the order found. */
  matched: string[];
  /** 0..1. How far the direction wants a thing built as something it is
   *  not. Zero when nothing matched — an unread direction never pushes
   *  the compiler off the literal reading. */
  dislocation: number;
  constructions: Record<string, number>;
  ops: Record<string, number>;
  /** Per-dial bias on the film's creative state at this beat. Applied by
   *  `bendStyle` — see it for why this is a bias rather than a value. */
  style: Partial<Record<StyleDial, number>>;
}

export const EMPTY_READING: IntentReading = {
  registers: [],
  matched: [],
  dislocation: 0,
  constructions: {},
  ops: {},
  style: {},
};

/** Is there anything here at all? An intent whose every field is blank is
 *  the same as no intent, and should not be reported as direction. */
export function hasIntent(intent: DirectorIntent | undefined): boolean {
  if (!intent) return false;
  return Boolean(
    intent.understand?.trim() ||
      intent.feel?.trim() ||
      intent.notice?.trim() ||
      intent.hide?.trim(),
  );
}

/** The prose of a direction, as one string, in a fixed order so the
 *  reading is deterministic. */
function proseOf(intent: DirectorIntent): string {
  return [intent.feel, intent.understand, intent.notice, intent.hide]
    .filter((s): s is string => Boolean(s?.trim()))
    .join(" · ")
    .toLowerCase();
}

/** Read a direction. No model, no network, no ratification gate.
 *
 *  A register fires on a whole-word match, or on a literal phrase match
 *  for the multi-word entries ("no way out" is not two words that happen
 *  to be adjacent to anything else). Multiple registers compound: the
 *  strongest sets the dislocation floor and the rest add their biases,
 *  because "absurd and overwhelming" is a real direction and should not
 *  have to pick one. */
export function readIntent(intent: DirectorIntent | undefined): IntentReading {
  if (!hasIntent(intent) || !intent) return EMPTY_READING;
  const prose = proseOf(intent);

  const hits: { register: Register; words: string[] }[] = [];
  for (const register of REGISTERS) {
    const words: string[] = [];
    for (const word of register.words) {
      // Whole word, or whole phrase. `\b` on both ends handles both, and
      // the escape keeps a lexicon entry from ever being a pattern.
      const rx = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
      if (rx.test(prose)) words.push(word);
    }
    if (words.length) hits.push({ register, words });
  }
  if (hits.length === 0) return EMPTY_READING;

  // Strongest first: more matched words is a stronger reading, and a tie
  // is broken by the lexicon's own order so the result never depends on
  // iteration accidents.
  hits.sort((a, b) => b.words.length - a.words.length);

  const constructions: Record<string, number> = {};
  const ops: Record<string, number> = {};
  const style: Partial<Record<StyleDial, number>> = {};
  // The strongest register sets the floor; the others can only raise it.
  // Averaging would let "clinical and absurd" read as neither, when what
  // it actually asks for is a clinical picture of an absurd thing.
  let dislocation = 0;

  for (const { register } of hits) {
    dislocation = Math.max(dislocation, register.dislocation);
    for (const [k, v] of Object.entries(register.constructions ?? {})) {
      constructions[k] = (constructions[k] ?? 0) + v;
    }
    for (const [k, v] of Object.entries(register.ops ?? {})) {
      ops[k] = (ops[k] ?? 0) + v;
    }
    for (const [k, v] of Object.entries(register.style ?? {})) {
      const dial = k as StyleDial;
      style[dial] = (style[dial] ?? 0) + v;
    }
  }

  return {
    registers: hits.map((h) => h.register.id),
    matched: hits.flatMap((h) => h.words),
    dislocation,
    constructions,
    ops,
    style,
  };
}

/** Bend the film's own curves by what this beat was directed to do.
 *
 *  A BIAS, NOT A VALUE, and that distinction is the whole reason this is
 *  safe. A direction never sets abstraction to 0.8; it says "further from
 *  the literal than this film already is". So an experimental film
 *  directed "make it strange" ends up stranger than a restrained one given
 *  the same words, which is what a director means by it — and the film's
 *  own curve is never overwritten, only leaned on.
 *
 *  Weighted at 0.6 rather than applied outright. At full strength a
 *  register could take a scene most of the way across a dial by itself,
 *  and the creative state the director authored across the whole film
 *  would become advisory. It is the film; this is one scene's opinion of
 *  it. */
export function bendStyle<T extends object>(style: T, reading: IntentReading): T {
  if (Object.keys(reading.style).length === 0) return style;
  const out = { ...style } as Record<string, unknown>;
  for (const [dial, bias] of Object.entries(reading.style)) {
    const base = out[dial];
    if (typeof base !== "number" || typeof bias !== "number") continue;
    out[dial] = Math.max(0, Math.min(1, base + bias * INTENT_WEIGHT));
  }
  return out as T;
}

/** How hard a direction leans on the film's curves. See `bendStyle`. */
const INTENT_WEIGHT = 0.6;

/** The direction, in a sentence a director can disagree with.
 *
 *  Reports what was HEARD, not what was said — the whole value of a
 *  deterministic reading is that the director can see it was misread and
 *  reword, which is impossible when the reading is a model's opinion. */
export function describeIntent(reading: IntentReading): string {
  if (reading.registers.length === 0) return "nothing read — the film's own curve decides";
  const heard = reading.matched
    .slice(0, 4)
    .map((w) => `"${w}"`)
    .join(", ");
  const how =
    reading.dislocation > 0.7
      ? "built as something it is not"
      : reading.dislocation > 0.35
        ? "allowed to depart from the literal reading"
        : "held to what the sentence names";
  return `${reading.registers.join(" + ")} — heard ${heard}; ${how}`;
}

// The Editorial IR — the source representation a film is compiled FROM.
//
// Master Spec Part 2, as amended by the Creative Constitution Part 10.1.
// Where the two conflicted, the Constitution won:
//
//   1. Flat per-act `vocabularyMix` is NOT the authoring model. Creative
//      State control points are. Vocabulary mix is a DERIVED output that
//      the director may override, not an input they must author.
//   2. Motifs are not a flat list — they carry occurrence history and a
//      current state, because a motif that cannot develop is just a
//      repeated asset.
//   3. Overrides are first-class (pin/constrain/exempt/break) and are
//      guaranteed to survive restyling.
//
// Two structural rules from the standing rules run through everything here:
// timing is ANCHOR-based (never frame ranges), and AI output appears only
// as an `assetId` reference to a frozen, hashed artifact — never as
// something regenerated during a compile.

import { z } from "zod";

/** Continuous parameters describing what the film currently *is*.
 *  Not settings for a block — the state of the film at a moment.
 *  Open-ended on purpose: the palette of expressible qualities should be
 *  able to grow without a schema migration. */
export const CreativeValuesSchema = z.record(z.string(), z.number().min(0).max(1));
export type CreativeValues = z.infer<typeof CreativeValuesSchema>;

/** Where a control point sits. Either bound to a structural landmark
 *  (act start/end, a specific scene) or to a normalized position on the
 *  runtime. Structural binding is preferred — it survives re-timing. */
export const ControlPointAtSchema = z.union([
  z.object({ actId: z.string(), position: z.enum(["start", "end"]) }),
  z.object({ sceneId: z.string() }),
  z.object({ position: z.number().min(0).max(1) }),
]);
export type ControlPointAt = z.infer<typeof ControlPointAtSchema>;

export const ControlPointSchema = z.object({
  at: ControlPointAtSchema,
  values: CreativeValuesSchema,
});
export type ControlPoint = z.infer<typeof ControlPointSchema>;

/** Floors and ceilings that hold across the whole film regardless of what
 *  the curves do. "Never let this feel like a corporate explainer" is
 *  expressible here, and — critically — when an invariant bites, the
 *  resolver reports it rather than silently absorbing it. */
export const InvariantSchema = z
  .object({
    param: z.string(),
    min: z.number().min(0).max(1).optional(),
    max: z.number().min(0).max(1).optional(),
  })
  .refine((v) => v.min !== undefined || v.max !== undefined, {
    message: "invariant must declare at least one of min/max",
  });
export type Invariant = z.infer<typeof InvariantSchema>;

export const CreativeStateSchema = z.object({
  /** Baseline identity values that apply everywhere unless a curve
   *  overrides them — "what kind of film this is" rather than "how it
   *  evolves". */
  identity: CreativeValuesSchema.default({}),
  controlPoints: z.array(ControlPointSchema).min(2),
  interpolation: z.enum(["smooth", "linear"]).default("smooth"),
  invariants: z.array(InvariantSchema).default([]),
});
export type CreativeState = z.infer<typeof CreativeStateSchema>;

/** A recurring visual idea. `states` is the development ladder — the
 *  same metaphor at escalating emotional pitch. The composition engine
 *  advances along it rather than inventing a new treatment, which is
 *  what makes a film read as authored instead of assembled. */
export const MotifSchema = z.object({
  motifId: z.string(),
  concept: z.string(),
  /** The primitive chain that carries this motif. */
  chain: z.array(z.string()).min(1),
  establishedAt: z.string().optional(),
  states: z.array(z.string()).min(1),
  developmentRule: z.enum(["escalate_with_abstraction", "escalate_with_density", "static"]),
});
export type Motif = z.infer<typeof MotifSchema>;

/** Creative constraints in the director's own language.
 *
 *  WHAT THIS ACTUALLY DOES, stated accurately. The docstring here used to
 *  say `hard` "cannot be violated by the composition engine", and that was
 *  not true of the code: `applicableCeiling` only ever returns a
 *  `maxAbstraction` ceiling, so both severities clamp a number and neither
 *  forbids anything. `severity` sorts which clamp wins and is reported when
 *  it bites; it is not a prohibition.
 *
 *  THREE KINDS WERE DELETED HERE, and the reason is worth keeping.
 *  `require_motif`, `minimum_hold` and `breathing_room` were declared and
 *  read by nothing — an enum value with no consumer is a promise the
 *  compiler silently does not keep, and `breathing_room` in particular
 *  named the exact capability the system most conspicuously lacks. Nothing
 *  reported the gap, because an unread enum value cannot fail. Whatever
 *  replaces them arrives with a reader attached. */
export const RuleSchema = z.object({
  ruleId: z.string(),
  statement: z.string(),
  severity: z.enum(["hard", "soft"]),
  kind: z.enum(["forbid_vocabulary", "narrative_guard"]),
  /** Scope the rule applies within — an actId, a narrativeFunction, or
   *  omitted for film-wide. */
  scope: z.string().optional(),
  /** Ceiling this rule imposes on abstraction, where applicable. */
  maxAbstraction: z.number().min(0).max(1).optional(),
  target: z.string().optional(),
});
export type Rule = z.infer<typeof RuleSchema>;

/** The director taking manual control. Never silently discarded: if a
 *  recompile would contradict an override, the system honours the
 *  override and REPORTS the tension. */
export const OverrideSchema = z.object({
  sceneId: z.string(),
  /* `exempt` and `break` were here and were read by nothing — the same
   * silent promise the deleted rule kinds made. Both are gone; what
   * replaces them will arrive with a consumer. */
  type: z.enum(["pin", "constrain"]),
  note: z.string().optional(),
  /** For `pin`: the exact chain to hold. For `constrain`: the chain to
   *  bias toward. */
  chain: z.array(z.string()).optional(),
  /** For `pin`: frozen parameter values. */
  params: z.record(z.string(), z.number()).optional(),
  /** For `constrain`: a DELTA on the film's creative state, for this scene
   *  only.
   *
   *  This is what a director's verb writes. "Make it stranger" is not a
   *  chain and it is not a pin — it is a nudge to the state this scene is
   *  composed against, so the engine keeps composing and the nudge
   *  survives a restyle, a re-read and a recompile. A pin bypasses
   *  composition; a constraint bends it, which is the difference between
   *  freezing a shot and directing one.
   *
   *  `constrain` has been in this union since the schema was written and
   *  nothing has ever produced one. This is what it was for. */
  styleNudge: z.record(z.string(), z.number()).optional(),
  createdAt: z.string().optional(),
});
export type Override = z.infer<typeof OverrideSchema>;

/** A VISUAL GRAMMAR — the film's look, named so it can be asked for again.
 *
 *  Not a chain and not a preset. A set of APPETITES: how much this film
 *  wants to grade, to scanline, to come apart. They sit on top of the
 *  director's curves and bias what the constructor reaches for, so the
 *  same grammar over a different essay builds different things in a
 *  recognisable way — which is what a house style actually is.
 *
 *  Captured from a film that already looks right rather than authored
 *  from nothing. See `compile/grammar.ts`. */
export const VisualGrammarSchema = z.object({
  name: z.string(),
  ops: z.record(z.string(), z.number()).default({}),
  representation: z.number().min(0).max(4).optional(),
  capturedFrom: z.object({ projectId: z.string(), scenes: z.number(), at: z.string() }).optional(),
});
export type VisualGrammarIR = z.infer<typeof VisualGrammarSchema>;

/** The director's instruction for one scene, in their own words.
 *
 *  Four optional fields, all prose, all short by convention rather than by
 *  constraint — a direction long enough to need scrolling is a note to
 *  self, not an instruction to a compiler. `hide` is deliberately included
 *  even though the compiler currently uses it only as register evidence:
 *  what a director wants WITHHELD is a real directorial statement and
 *  dropping the field would make it unsayable. See `compile/intent.ts`. */
export const DirectorIntentSchema = z.object({
  understand: z.string().optional(),
  feel: z.string().optional(),
  notice: z.string().optional(),
  hide: z.string().optional(),
});
export type DirectorIntentIR = z.infer<typeof DirectorIntentSchema>;

export const EntitySchema = z.object({
  id: z.string(),
  type: z.enum(["organization", "person", "document", "concept", "place"]),
  label: z.string(),
  state: z.string().optional(),
  visualIdentity: z
    .object({ primaryColor: z.string().optional(), styleId: z.string().optional() })
    .optional(),
});
export type Entity = z.infer<typeof EntitySchema>;

/** A frozen input artifact. `sha256` is what makes it trustworthy: the
 *  compiler verifies it rather than assuming the file behind the key is
 *  still what was approved. */
export const AssetSchema = z.object({
  assetId: z.string(),
  kind: z.enum(["audio", "alignment", "image", "data"]),
  r2Key: z.string(),
  sha256: z.string(),
  provenance: z.object({
    generatedBy: z.string(),
    params: z.record(z.string(), z.unknown()).default({}),
    createdAt: z.string(),
    sourceText: z.string().optional(),
  }),
});
export type Asset = z.infer<typeof AssetSchema>;

/** Anchor-based timing. An anchor names a chunk in the narration
 *  alignment plus an offset — so re-recording narration re-times the film
 *  correctly instead of desynchronising it, which a frame range would. */
export const AnchorSchema = z.object({
  chunkId: z.string(),
  offsetMs: z.number().default(0),
});
export type Anchor = z.infer<typeof AnchorSchema>;

export const TimingSchema = z.object({
  startAnchor: AnchorSchema,
  endAnchor: AnchorSchema,
  minDurationMs: z.number().nonnegative().default(0),
  maxDurationMs: z.number().positive().default(600_000),
  /** `elastic` scenes absorb slack from their neighbours; `rigid` ones
   *  force the cascade to shift everything downstream. */
  elasticity: z.enum(["rigid", "elastic"]).default("elastic"),
});
export type Timing = z.infer<typeof TimingSchema>;

export const NarrationSchema = z.object({
  text: z.string(),
  voAssetId: z.string().optional(),
  alignmentAssetId: z.string().optional(),
  alignmentGranularity: z.enum(["chunk", "word"]).default("chunk"),
});
export type Narration = z.infer<typeof NarrationSchema>;

/** What a scene's prose is ABOUT, as the compiler understands it.
 *
 *  A frozen input artifact: an LLM proposes it once at authoring time, the
 *  operator ratifies it, and it is stored in the IR thereafter. It lives in
 *  the IR rather than in the compiler because it is authored data — the
 *  compiler reads it, never writes it, and never regenerates it during a
 *  compile. That is what makes a treatment cacheable: the same reading
 *  always plans the same chain. */
/** A quantity found in the prose, with the exact span it was found in.
 *  `text` is authoritative for anything a viewer reads; `value` exists only
 *  so a chart can scale. See `compile/figures.ts` for why a model is never
 *  allowed near either. */
export const FigureSchema = z.object({
  text: z.string(),
  value: z.number(),
  kind: z.enum(["money", "count", "percent", "year"]),
  offset: z.number().int(),
});
export type Figure = z.infer<typeof FigureSchema>;

export const SemanticReadingSchema = z.object({
  sentence: z.string(),
  subjects: z
    .array(
      z.object({
        label: z.string(),
        kind: z.enum(["object", "creature", "document", "person", "place", "concept"]),
        weight: z.number().min(0).max(1),
      }),
    )
    .min(1),
  visualOpportunity: z.enum(["inspect", "establish", "contrast", "dissolve", "accumulate"]),
  /** True when the prose reports a claim rather than asserting a fact. Never
   *  silently dropped: a treatment may depict a claim differently, but it
   *  must never depict one as established. */
  contested: z.boolean(),
  /** Quantities lifted out of the sentence, VERBATIM, and the stages a
   *  quantity is routed through when the prose names them. Both are
   *  populated by a regex over the prose, never by the model — see
   *  `compile/figures.ts`. Carried here so a hand-authored reading is
   *  self-contained; `Scene.figures` is where the segmenter puts them. */
  figures: FigureSchema.array().optional(),
  route: z.array(z.string()).optional(),
});
export type SemanticReading = z.infer<typeof SemanticReadingSchema>;

/** How a scene is depicted. The subject is invariant; this is not. */
/** COLOUR, as four directorial numbers.
 *
 *  key         0 = dark ground, light drawn onto it · 1 = paper, marks on it
 *  temperature 0 = cold · 1 = warm
 *  saturation  0 = monochrome · 1 = saturated
 *  contrast    0 = flat · 1 = hard
 *
 *  Continuous on purpose. Named looks are coordinates in this space, not
 *  an enum — "slightly warmer" has to be a real position or the director
 *  is choosing from a filter menu again. */
export const ColourSchema = z.object({
  // Mirrors DEFAULT_COLOUR below, which is the authority.
  key: z.number().min(0).max(1).default(0.16),
  temperature: z.number().min(0).max(1).default(0.58),
  saturation: z.number().min(0).max(1).default(0.34),
  contrast: z.number().min(0).max(1).default(0.56),
  /** HOW MANY COLOURS THE FILM IS ALLOWED.
   *
   *  Saturation says how intense one colour is; this says how many there
   *  are. Until it existed a primitive could reach exactly one saturated
   *  hue, so a frame of ten thousand particles had one colour for all ten
   *  thousand — a pixel-art palette or a spectrum was impossible by
   *  construction rather than by choice.
   *
   *    0     one colour. Everything is the accent.
   *    0.3   a close harmony.
   *    0.7   a wide scheme, still recognisably one film.
   *    1     the whole wheel.
   *
   *  Resolved into eight stops by `resolvePalette`, which stays the only
   *  thing that turns a director's numbers into hex. */
  spread: z.number().min(0).max(1).default(0.22),
});
export type Colour = z.infer<typeof ColourSchema>;

/** WHAT A NEW FILM STARTS AS, and the ONLY place that decides it.
 *
 *  The previous constants put every frame at a near-black, half-
 *  desaturated ground — which is why 105 of 129 primitives measured below
 *  luminance 40/255. Moving off it was not enough on its own: the eight
 *  named looks in `lab/palette.js` were coherent, implemented, and
 *  reachable only from a row buried in the Directing drawer, so in
 *  practice every film ever made was this one ground whatever it said in
 *  the schema.
 *
 *  These coordinates are the `documentary` look — low-key, slightly warm,
 *  restrained, with enough saturation that a frame reads as a picture
 *  rather than a diagnostic buffer. It is the look a film should have to
 *  be talked out of rather than into. The front door can now choose any
 *  of the eight, so this is a starting point rather than a destination.
 *
 *  `ColourSchema`'s own field defaults mirror these, and so does
 *  `COLOUR_DEFAULT` in `lab/palette.js`. Three copies of four numbers is
 *  exactly the drift standing rule 9 warns about, so they are stated
 *  together here and the other two carry a pointer back. */
export const DEFAULT_COLOUR: Colour = {
  key: 0.16,
  temperature: 0.58,
  saturation: 0.34,
  contrast: 0.56,
  // Enough that a frame of many marks is not one flat colour, far short
  // of a spectrum. A film that wants the whole wheel asks for it.
  spread: 0.22,
};

/** How the film is photographed. Colour is built; camera and light are
 *  declared here as the place they will land, and are deliberately absent
 *  rather than stubbed — a field that exists and does nothing is the
 *  failure this project keeps repeating. */
export const CinematographySchema = z.object({
  colour: ColourSchema.default({}),
});
export type Cinematography = z.infer<typeof CinematographySchema>;

export const VisualLanguageSchema = z.enum([
  "documentary",
  "technical",
  "pixel",
  "surreal",
  "kinetic",
]);
export type VisualLanguage = z.infer<typeof VisualLanguageSchema>;

/** A block is a RECIPE — a convenient pre-composed default, not the
 *  director's vocabulary (Atlas Part 1.1). `chain` lets the composition
 *  engine reach past the recipe to the primitives themselves, which is
 *  the difference between a palette and four looks in rotation. */
export const BlockSchema = z.object({
  blockId: z.string(),
  type: z.string(),
  prominence: z.number().min(0).max(1).default(1),
  seed: z.number().int(),
  props: z.record(z.string(), z.unknown()).default({}),
  chain: z.array(z.string()).optional(),
});
export type Block = z.infer<typeof BlockSchema>;

export const SceneSchema = z.object({
  sceneId: z.string(),
  actId: z.string(),
  /** WHICH PARAGRAPH OF THE ESSAY THIS SENTENCE CAME FROM.
   *
   *  The level between the section and the sentence, and the one a
   *  director works at: a passage is one idea, and five sentences
   *  developing it deserve one visual development rather than five.
   *  Without it every sentence is a peer and the only available rhythm is
   *  per-sentence.
   *
   *  Optional because IRs stored before it existed do not carry it —
   *  a consumer that needs the grouping must handle its absence rather
   *  than assume a re-segment has happened. */
  passageId: z.string().optional(),
  label: z.string().default(""),
  narrativeFunction: z.enum(["hook", "establish", "evidence", "turn", "resolve"]),
  status: z.enum(["draft", "ready_for_review", "approved", "flagged"]).default("draft"),
  /** Binds the scene to its span of the essay. This is what makes the
   *  essay the single source of truth rather than a starting point that
   *  the IR then drifts away from. */
  sourceRange: z.object({ startChar: z.number().int(), endChar: z.number().int() }),
  narration: NarrationSchema,
  timing: TimingSchema,
  /** Entity ids referenced in this scene — the motif trigger. */
  entities: z.array(z.string()).default([]),
  blocks: z.array(BlockSchema).default([]),
  /** The frozen reading of this scene's prose. When present the composition
   *  engine plans a treatment from it instead of reaching for the
   *  abstraction ladder's default chain. */
  reading: SemanticReadingSchema.optional(),
  /** Quantities and routes lifted MECHANICALLY out of this scene's prose.
   *
   *  Deliberately separate from `reading`. A reading is an interpretation —
   *  a model proposes it, an operator ratifies it, and without one the
   *  compiler declines rather than guesses. A figure is not an
   *  interpretation. "$282,345.84" is in the sentence or it is not, and the
   *  answer is checkable by anyone.
   *
   *  Which means these need no model and no ratification, and a scene that
   *  carries them has something depictable in it even when nobody has read
   *  it yet. That is what lets an institutional essay compile to charts
   *  offline — see `compose.ts`, where prose alone is enough to plan a
   *  data-led treatment. */
  figures: FigureSchema.array().optional(),
  route: z.array(z.string()).optional(),
  /** Per-scene depiction override. Falls back to the film's default. */
  visualLanguage: VisualLanguageSchema.optional(),
  /** WHAT THE DIRECTOR WANTS THIS SCENE TO DO. Prose, not settings.
   *
   *  The third kind of input this compiler takes, and it is genuinely
   *  distinct from the other two. A FIGURE is checkable against the prose.
   *  A READING is an interpretation of the prose, so a model proposes it
   *  and a human ratifies it. An INTENT is neither — it is not about the
   *  prose at all, it is the director's own instruction, so it is authored
   *  outright and there is nothing to ratify. Written by the operator, read
   *  deterministically by `intent.ts`, and absent on most scenes.
   *
   *  It exists because the constructor could previously infer everything
   *  from the sentence's surface and had no channel at all for "this scene
   *  should feel inevitable" — which is precisely the input that makes
   *  candidates differ as INTERPRETATIONS rather than as effects. */
  directorIntent: DirectorIntentSchema.optional(),
});
export type Scene = z.infer<typeof SceneSchema>;

export const ActSchema = z.object({
  actId: z.string(),
  title: z.string().default(""),
});
export type Act = z.infer<typeof ActSchema>;

export const EditorialIRSchema = z.object({
  $schema: z.string().default("https://canopticon.dev/schemas/v0/editorial-ir.json"),
  projectId: z.string(),
  title: z.string(),
  irVersion: z.string().default("0.1.0"),
  createdAt: z.string().optional(),
  logline: z.string().optional(),
  /** The essay. Single source of truth; scenes bind into it by offset. */
  essay: z.string(),
  /** WHICH TAKE THIS IS.
   *
   *  The compiler is deterministic, which is the point — but every seed in
   *  it was a hardcoded constant, so one essay had exactly one film in it
   *  forever. There was no way to say "make it differently": the only
   *  control was Render, which renders what is already there. A director
   *  who cannot ask for another take is not directing.
   *
   *  A variant is not randomness and not a style. It is a different
   *  READING of the same essay, chosen deterministically: it moves which
   *  representation wins, which of the constructed candidates is taken,
   *  and every procedural seed underneath. Same writing, same cuts, same
   *  voice, same runtime — a different film.
   *
   *  0 is what every film composed before this field existed, so nothing
   *  already made is restyled by it arriving. */
  variant: z.number().int().min(0).default(0),
  acts: z.array(ActSchema).min(1),
  scenes: z.array(SceneSchema).min(1),
  entities: z.array(EntitySchema).default([]),
  assets: z.array(AssetSchema).default([]),
  creativeState: CreativeStateSchema,
  motifs: z.array(MotifSchema).default([]),
  rules: z.array(RuleSchema).default([]),
  overrides: z.array(OverrideSchema).default([]),
  /** Kept as a field from Phase 0 even though accessibility render
   *  profiles are out of scope — so adding them later is not a schema
   *  migration. */
  /** The film's default depiction. A director can travel this across the
   *  runtime the same way they travel abstraction. */
  visualLanguage: VisualLanguageSchema.default("documentary"),
  /** HOW THE FILM MOVES BETWEEN ITS IDEAS.
   *
   *  The Create screen has asked this question since the new front end
   *  shipped ("cut between ideas" / "never cut" / "collide ideas") and the
   *  answer reached a field on the browser's own film object and stopped
   *  there — the compiler had nowhere to put it and no world to apply it
   *  to. Both now exist. `cut` is the default and is what every film
   *  composed before this was, so nothing already made is restyled by the
   *  field arriving.
   *
   *  These are constraints over ONE grammar, not four renderers — see
   *  `film-mode.ts`. `oneshot` forbids the cut and bridges every change;
   *  `montage` cuts freely and never bridges. */
  continuity: z.enum(["cut", "oneshot", "montage", "hybrid"]).default("cut"),
  /** WHAT KIND OF PICTURE THIS FILM MAKES — and the axis that was missing.
   *
   *  `continuity` is EDITING: does the film cut, or travel? This is the
   *  VISUAL LANGUAGE: what the picture is made of. They were briefly
   *  conflated — one-shot forced the scene-graph construction to win every
   *  sentence — which made "never cut" secretly mean "build a world", and
   *  put a text-driven continuous film and a hard-cutting world film both
   *  out of reach. Two axes, independent:
   *
   *    TEXT      the writing itself is the primary visual material
   *    ABSTRACT  no attempt to depict the nouns — geometry, fields, light
   *    WORLD     persistent objects and spaces that evolve
   *    IMAGE     supplied or generated imagery as a material in the world
   *    HYBRID    the engine chooses, per sentence
   *
   *  A WEIGHTING, never a switch. Whatever the approach, a sentence that
   *  prints a figure still reaches the chart family and a sentence that
   *  draws a route is still a route — a figure is checkable and outranks a
   *  preference. `hybrid` is the default and leaves every weight alone, so
   *  every film composed before this field existed composes identically. */
  visualApproach: z.enum(["text", "abstract", "world", "image", "hybrid"]).default("hybrid"),
  /** HOW THE TYPE IS SET — one layer below the approach, and only
   *  meaningful when the words are on screen at all.
   *
   *    editorial  set, large, composed. Legibility is the point.
   *    fiore      violent scale, cropped by the frame, halftone ground —
   *               the Medium is the Massage register the palette's own
   *               A-family docs already describe.
   *    kinetic    letterforms sampled into points and taken apart. The
   *               only register the sampled stack is genuinely for.
   *    auto       set for a marker or a phrase, kinetic for the thesis.
   *
   *  `auto` is the default, so a film that never touches this reads. */
  typeRegister: z.enum(["editorial", "fiore", "kinetic", "auto"]).default("auto"),
  /** The film's captured look, when it has one. Optional: a film without
   *  a grammar is composed from the curves alone, exactly as before. */
  grammar: VisualGrammarSchema.optional(),
  /** THE FILM'S CINEMATOGRAPHY. Colour first, because colour was the
   *  measurable hole: 105 of 129 primitives rendered below luminance
   *  40/255 and 86 below contrast 20, all of it decided by five constants
   *  no director could reach.
   *
   *  Four continuous numbers, and the compiler NEVER resolves them into
   *  colours — it stores them and hands them to the renderer, which owns
   *  the single translation point (`resolvePalette` in `lab/palette.js`).
   *  Standing rule 9: the semantic layer says "warm, light, restrained";
   *  exactly one function decides what that is in hex.
   *
   *  Camera and light will join this object rather than becoming their
   *  own layer. */
  cinematography: CinematographySchema.default({}),
  renderProfile: z.string().default("default"),
});
export type EditorialIR = z.infer<typeof EditorialIRSchema>;

export interface ParseFailure {
  ok: false;
  errors: Array<{ path: string; message: string }>;
}
export interface ParseSuccess {
  ok: true;
  ir: EditorialIR;
}

/** Parse + validate, then check the referential integrity zod can't
 *  express: scenes pointing at acts that exist, entities and assets that
 *  resolve, overrides naming real scenes, source ranges inside the essay.
 *  A structurally-valid IR that references a missing asset would fail
 *  deep inside the solver with a far worse error message. */
export function parseIR(input: unknown): ParseSuccess | ParseFailure {
  const parsed = EditorialIRSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  }
  const ir = parsed.data;
  const errors: Array<{ path: string; message: string }> = [];

  const actIds = new Set(ir.acts.map((a) => a.actId));
  const sceneIds = new Set(ir.scenes.map((s) => s.sceneId));
  const entityIds = new Set(ir.entities.map((e) => e.id));
  const assetIds = new Set(ir.assets.map((a) => a.assetId));

  if (sceneIds.size !== ir.scenes.length) {
    errors.push({ path: "scenes", message: "duplicate sceneId" });
  }
  if (actIds.size !== ir.acts.length) {
    errors.push({ path: "acts", message: "duplicate actId" });
  }

  ir.scenes.forEach((s, i) => {
    const at = `scenes.${i}`;
    if (!actIds.has(s.actId)) {
      errors.push({ path: `${at}.actId`, message: `unknown act "${s.actId}"` });
    }
    if (s.sourceRange.startChar < 0 || s.sourceRange.endChar > ir.essay.length) {
      errors.push({ path: `${at}.sourceRange`, message: "source range outside the essay" });
    }
    if (s.sourceRange.startChar >= s.sourceRange.endChar) {
      errors.push({ path: `${at}.sourceRange`, message: "empty or inverted source range" });
    }
    if (s.timing.minDurationMs > s.timing.maxDurationMs) {
      errors.push({ path: `${at}.timing`, message: "minDurationMs exceeds maxDurationMs" });
    }
    for (const e of s.entities) {
      if (entityIds.size > 0 && !entityIds.has(e)) {
        errors.push({ path: `${at}.entities`, message: `unknown entity "${e}"` });
      }
    }
    if (s.narration.voAssetId && !assetIds.has(s.narration.voAssetId)) {
      errors.push({ path: `${at}.narration.voAssetId`, message: "unknown asset" });
    }
    if (s.narration.alignmentAssetId && !assetIds.has(s.narration.alignmentAssetId)) {
      errors.push({ path: `${at}.narration.alignmentAssetId`, message: "unknown asset" });
    }
  });

  ir.overrides.forEach((o, i) => {
    if (!sceneIds.has(o.sceneId)) {
      errors.push({ path: `overrides.${i}.sceneId`, message: `unknown scene "${o.sceneId}"` });
    }
  });

  ir.creativeState.controlPoints.forEach((cp, i) => {
    const at = `creativeState.controlPoints.${i}.at`;
    if ("actId" in cp.at && !actIds.has(cp.at.actId)) {
      errors.push({ path: at, message: `unknown act "${cp.at.actId}"` });
    }
    if ("sceneId" in cp.at && !sceneIds.has(cp.at.sceneId)) {
      errors.push({ path: at, message: `unknown scene "${cp.at.sceneId}"` });
    }
  });

  ir.motifs.forEach((m, i) => {
    if (m.establishedAt && !sceneIds.has(m.establishedAt)) {
      errors.push({ path: `motifs.${i}.establishedAt`, message: "unknown scene" });
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, ir };
}

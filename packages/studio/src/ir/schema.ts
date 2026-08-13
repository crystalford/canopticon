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
 *  `hard` cannot be violated by the composition engine. `soft` is a strong
 *  preference whose violation is reported with a reason. */
export const RuleSchema = z.object({
  ruleId: z.string(),
  statement: z.string(),
  severity: z.enum(["hard", "soft"]),
  kind: z.enum([
    "forbid_vocabulary",
    "require_motif",
    "minimum_hold",
    "breathing_room",
    "narrative_guard",
  ]),
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
  type: z.enum(["pin", "constrain", "exempt", "break"]),
  note: z.string().optional(),
  /** For `pin`: the exact chain to hold. For `constrain`: the chain to
   *  bias toward. Ignored for exempt/break. */
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
  /** The film's captured look, when it has one. Optional: a film without
   *  a grammar is composed from the curves alone, exactly as before. */
  grammar: VisualGrammarSchema.optional(),
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

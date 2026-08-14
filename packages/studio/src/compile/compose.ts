// The composition engine — Constitution Part 5.
//
// Translates directorial intent downward into a primitive chain per scene.
// The director never names a renderer; they set a trajectory, declare a few
// rules, and establish motifs. This decides what that means in primitives.
//
// Part 5.2's precedence order is the load-bearing part, and it is applied
// in this exact sequence, highest first:
//
//   1. Explicit human override      — always wins, never silently dropped
//   2. Directorial rules            — hard constraints the director set
//   3. Creative state invariants    — floors and ceilings (in resolveStateAt)
//   4. Narrative appropriateness    — don't abstract an evidence scene
//   5. Motif continuity             — develop the established treatment
//   6. Rhythm / anti-repetition     — vary the surface
//   7. Creative state preferences   — the curves
//   8. Vocabulary mix               — the derived weights
//
// Note 5 outranks 6 deliberately: motifs WANT repetition, that is what
// makes them motifs. Anti-repetition only breaks ties between primitives
// that carry no motif.
//
// No Math.random anywhere. Every seed is derived from scene index and
// chain position, so the same IR always composes to the same chains.

import type { EditorialIR, Motif, Override, Rule, Scene, SemanticReading } from "../ir/schema.ts";
import type { FilmTimeline } from "../narrate/timeline.ts";
import { bridgeMsFor } from "../narrate/timeline.ts";
import {
  type Determinism,
  PRIMITIVES,
  chainCost,
  chainDeterminism,
  chainOverwrites,
} from "../primitives/registry.ts";
import type { Act } from "./act.ts";
import {
  type Beat,
  OPERATOR_CHAINS,
  type PlannedNode,
  type Program,
  type Style,
  constructPrograms,
  isSetType,
  mayFollowPresentedType,
} from "./construct.ts";
import {
  type ResolvedState,
  controlPointPositions,
  resolveStateAt,
  scenePosition,
} from "./creative-state.ts";
import { looksContested } from "./extract-reading.ts";
import type { FilmMode } from "./film-mode.ts";
import { type FilmState, rest } from "./film-state.ts";
import { buildGraph, describeGraph, flattenGraph, flattenGround, graphDepth } from "./graph.ts";
import { planGround } from "./ground.ts";
import { bendStyle, describeIntent, hasIntent, readIntent } from "./intent.ts";
import { choosePhrase } from "./phrase.ts";
import { type Intervention, allocate, textOf } from "./promote.ts";
import { type Relation, describeRelation, readRelation } from "./relation.ts";
import { representationsFor } from "./represent.ts";
import type { SceneGraph } from "./scene-graph.ts";
import { chainForKind, readSceneKind } from "./scene-kind.ts";
import {
  type Plane,
  type ScenePlan,
  applyPlane,
  isComposite,
  isUnnoticed,
  planScene,
} from "./scene-plan.ts";
import {
  type DetectedSubject,
  detectSubjects,
  namesOnlyAbstractions,
  refersBack,
  subjectReading,
} from "./subject.ts";
import { textParamsFor } from "./text-params.ts";
import { type Treatment, planTreatment, validateChain } from "./treatment.ts";
import { EMPTY_FILM, type SceneWorld, modeOf, stepWorld } from "./world.ts";

/** The abstraction ladder — how far the image sits from literal depiction.
 *  Each rung names the base chain the film reaches for at that distance.
 *  This is the single most legible expression of "abstraction" as a
 *  directorial parameter: the same essay rendered at 0.2 and at 0.9 is
 *  documents versus drift. */
export interface Rung {
  maxAbstraction: number;
  tier: "GROUNDED" | "ANNOTATED" | "DECOMPOSED" | "DISSOLVED";
  base: string[];
}

export const LADDER: Rung[] = [
  {
    maxAbstraction: 0.3,
    tier: "GROUNDED",
    base: ["document_surface", "document_layout", "camera_move"],
  },
  {
    maxAbstraction: 0.52,
    tier: "ANNOTATED",
    base: ["document_surface", "annotation", "text_stagger"],
  },
  {
    maxAbstraction: 0.7,
    tier: "DECOMPOSED",
    base: ["text_layout", "glyph_to_points", "particle_seek"],
  },
  {
    maxAbstraction: 1.01,
    tier: "DISSOLVED",
    base: ["noise_field", "flow_field", "particle_flow", "particle_trail"],
  },
];

export interface ComposedNode {
  primitiveId: string;
  params: Record<string, number | string>;
  seed: number;
  costMsPerFrame: number;
  /** Why this primitive is in the chain — surfaced in the Compile view so
   *  a chain is auditable rather than magic. */
  reason: string;
  /** THE SECOND INPUT. Present only on a two-input compositor: its own
   *  small chain, rendered on the same clock and handed to the
   *  compositor's B side. This is how a field sits BEHIND a sentence
   *  rather than being painted over by it — the one relation a linear
   *  chain could not express. */
  ground?: ComposedNode[];
  /** THE BRIDGE, per parameter: `{x: [from, to]}`. Applied to this node's
   *  live params by the chain executor over `tweenMs`, without rebuilding
   *  the chain — which is what separates a one shot from a film with the
   *  cuts removed. Absent on every node in a CUT film. */
  tween?: Record<string, [number, number]>;
  tweenMs?: number;
  /** WHEN the tween starts, scene-local — what lets a word land on the
   *  moment it is spoken rather than at the top of the scene. */
  tweenAtMs?: number;
}

/* ── A HOLD IS NOT A FREEZE ────────────────────────────────────────────
 *
 * MEASURED, on a real 65-scene film: 22 scenes compose their own picture,
 * 30 are HELD, 13 draw nothing. And a held scene was `composed.nodes =
 * standing.nodes` — the previous chain copied node for node, so for
 * thirty scenes the frame was byte-identical while the narration kept
 * going. Nearly half the film was a still.
 *
 * That is not what a hold means. Holding is the most ordinary move in
 * documentary and it means the picture CONTINUES while the argument moves
 * under it — the frame drifts, the shot settles, the eye is allowed to
 * stay somewhere while a new sentence changes what it is looking at. A
 * held picture that stops dead is a projector fault, not an edit.
 *
 * So a held scene inherits the standing chain and is given a MOVE across
 * its own window, and the move is read off the act of the HELD sentence
 * rather than the standing one — because the picture is the same and the
 * sentence is not, and that difference is the entire reason to hold.
 *
 * ONLY `place` IS TOUCHED, and that restriction is load-bearing. It is
 * the one primitive verified to read x/y/scale inside `frame()` rather
 * than capturing them when the chain is built; a primitive that captures
 * would ignore a tween silently, which is the failure this comment exists
 * to stop someone re-introducing. The same rule already governs the
 * bridge — see `serialiseScene`.
 *
 * RECURSIVE, because a `place` can sit on a compositor's ground and a
 * held scene whose drift stopped at the trunk would move its foreground
 * and leave its layers behind. Standing rule 11.
 *
 * AN INHERITED TWEEN IS REPLACED, NOT RESPECTED — and this is a second
 * bug found by measuring the first. 16 of the 30 held scenes arrived
 * carrying a `place` tween, because the chain they inherited was the
 * STANDING scene's and the standing scene's tween was its own: a
 * word-entry cue fired at the measured millisecond a word was spoken, or
 * a bridge into a move that already happened. Copied forward, that cue
 * re-fires every held scene — the same word landing again and again over
 * a picture that never changed. A move belongs to the scene that earned
 * it. On a held scene it is stale by definition, so the drift replaces
 * it, `tweenAtMs` included. */
const DRIFT: Partial<Record<Act, { scale: number; x: number; why: string }>> = {
  // Still being said. The frame eases in — the classic slow push.
  SUSTAIN: { scale: 0.035, x: 0, why: "still on it, easing in" },
  // More of the same, and the push compounds across the run.
  ACCUMULATE: { scale: 0.06, x: 0, why: "closing, as it gathers" },
  INTENSIFY: { scale: 0.085, x: 0, why: "pressing in" },
  // Narrowing onto one thing.
  CONVERGE: { scale: 0.055, x: -0.012, why: "narrowing onto it" },
  // Leaving. The frame gives it up rather than chasing it.
  WITHDRAW: { scale: -0.05, x: 0, why: "letting it go" },
  // A qualification steps aside rather than pressing.
  QUALIFY: { scale: -0.015, x: 0.022, why: "stepping aside from it" },
  // Turning against what was just said.
  CONTRAST: { scale: -0.02, x: -0.03, why: "turning off it" },
  // Coming back to something. The frame drifts the way it came.
  RECALL: { scale: 0.02, x: 0.026, why: "drifting back over it" },
  // Something is being shown. Barely moves — the reveal is the subject's.
  REVEAL: { scale: 0.03, x: 0, why: "holding, while it shows" },
  TRANSFORM: { scale: 0.04, x: -0.018, why: "moving as it becomes" },
  // A held DECLARE is a restatement over the same picture: the least
  // motion of any of them, because the words are doing the work.
  DECLARE: { scale: 0.022, x: 0, why: "steady, while it states" },
};

/** The film's restraint where this scene sits. Read from the creative
 *  state through the same resolver every other curve uses, so a
 *  restrained film drifts less without a second opinion about what
 *  restraint means. */
function restraintAt(ir: EditorialIR, sceneIndex: number, positions: number[]): number {
  const v = resolveStateAt(ir, scenePosition(ir, sceneIndex), positions).values.restraint;
  return typeof v === "number" ? v : 0.5;
}

/** A BREATH IS THE PICTURE LEAVING, NOT THE PICTURE MISSING.
 *
 *  `NONE` is real punctuation and the allocator is right to call it: a
 *  new paragraph opens, the last idea has finished developing, and the
 *  frame goes quiet in the gap. The author's own paragraph decides where,
 *  which is better than any threshold.
 *
 *  What was wrong is what quiet looked like. The scene composed to an
 *  empty chain, so the frame was flat ground FROM ITS FIRST FRAME — the
 *  previous idea did not end, it was cut off, and on a real film that is
 *  13 scenes of 65 spent on blank colour. A breath the audience can hear
 *  is a shot going out; a breath they cannot is a projector fault.
 *
 *  So the standing picture comes into the scene and withdraws across it,
 *  leaving the frame clear by the end — which is what the next idea was
 *  supposed to arrive into. It is the film's existing arrival move,
 *  reversed: `world.ts` brings an element on with
 *  `scale: [scale * 0.12, scale]`, and this is the same vocabulary read
 *  backwards, so nothing new had to be invented to say "going". */
const DEPART = { scale: -0.88, x: 0, why: "the last idea goes out, and the frame is left clear" };

function driftHeld(
  nodes: ComposedNode[],
  act: Act | undefined,
  /** How many scenes this hold has already run. The push compounds so a
   *  long hold keeps moving instead of restarting its own small move
   *  every scene, which would read as a stutter rather than a drift. */
  depth: number,
  ms: number,
  restraint: number,
  /** An explicit move, when the caller knows one the act table does not
   *  cover — a breath is not an act, it is the absence of one. */
  profile?: { scale: number; x: number; why: string },
): { nodes: ComposedNode[]; why: string } | null {
  const d = profile ?? DRIFT[act ?? "NONE"];
  // A window the solver never measured cannot carry a timed move, and a
  // move too short to see is noise in the hash.
  if (!d || ms < 400) return null;
  // A restrained film drifts less; it never drifts nothing, because a
  // frozen frame is what this exists to stop.
  // A DEPARTURE IS NOT DAMPED. Restraint decides how much a held shot
  // drifts; it does not get to leave a picture half-gone on screen when
  // the film asked for a clear frame.
  const gain = profile ? 1 : (1 - restraint * 0.55) * Math.min(1.9, 1 + depth * 0.35);
  const ds = d.scale * gain;
  const dx = d.x * gain;
  let touched = 0;
  const walk = (list: ComposedNode[]): ComposedNode[] =>
    list.map((n) => {
      const inner = n.ground && n.ground.length > 0 ? { ground: walk(n.ground) } : {};
      if (n.primitiveId !== "place") return { ...n, ...inner };
      const scale = Number(n.params.scale ?? 1);
      const x = Number(n.params.x ?? 0.5);
      touched++;
      // `tweenAtMs` goes with it: a cue timed to a word spoken in the
      // scene BEFORE this one has no moment to fire on in this one.
      const { tweenAtMs: _stale, ...rest } = n;
      return {
        ...rest,
        ...inner,
        tween: {
          scale: [scale, Math.max(0.04, scale * (1 + ds))] as [number, number],
          ...(dx ? { x: [x, x + dx] as [number, number] } : {}),
        },
        // Across the whole window: a hold is the shot continuing, not a
        // gesture inside it.
        tweenMs: Math.round(ms),
      };
    });
  const out = walk(nodes);
  return touched > 0 ? { nodes: out, why: d.why } : null;
}

/** A program the engine considered and did not use. Carried so the
 *  Compile view can show what else this sentence could have been —
 *  "what could express this" has more than one answer, and a director who
 *  cannot see the others is being handed a decision dressed as a fact. */
export interface ProgramSummary {
  id: string;
  construction: string;
  operators: string[];
  why: string;
  chain: string[];
  /** WHICH KIND OF IMAGE this alternative is. An alternative that differs
   *  only in its operators is a treatment; one that differs in its mode is
   *  a different picture of the same sentence, and a director choosing
   *  between them needs to be told which they are looking at. */
  mode?: string;
  idea?: string;
  /** Built against the grain of what the sentence names. Carried to the
   *  surface because "the city is the organism" and "the people are
   *  insects" are different claims about the same sentence, and a director
   *  reading a list of alternatives should not have to infer which one
   *  they are being offered. */
  dislocated?: boolean;
}

export interface MotifOccurrence {
  motifId: string;
  concept: string;
  state: string;
  stateIndex: number;
}

export interface RuleHit {
  ruleId: string;
  severity: "hard" | "soft";
  message: string;
}

export interface ComposedScene {
  sceneId: string;
  /** THE FILM CHOSE THIS. True when the scene draws nothing new — either
   *  nothing at all, or the previous composition still standing.
   *
   *  It is a DECLARATION, and that is its whole job. An empty chain that
   *  arrived by accident renders as clean ground and is indistinguishable
   *  from an intended silence; the renderer reports one and refuses the
   *  other, and this is what tells them apart. */
  held?: boolean;
  actId: string;
  tier: Rung["tier"];
  /** Abstraction AFTER rules and invariants, which is what actually drove
   *  the chain — not the raw curve value. */
  abstraction: number;
  state: ResolvedState;
  nodes: ComposedNode[];
  motifs: MotifOccurrence[];
  ruleHits: RuleHit[];
  notes: string[];
  override: Override | undefined;
  /** Present when the scene carried a reading and a treatment was planned
   *  from it. Null when the engine fell back to the abstraction ladder. */
  treatment: Treatment | null;
  costMsPerFrame: number;
  determinism: Determinism;
  /** The words this scene actually puts on screen, and which rule chose
   *  them. Carried on the report because a phrase nobody can account for
   *  is indistinguishable from a truncation — which is what it used to
   *  be. */
  phrase: { text: string; source: string };
  /** What was CONSTRUCTED here — the thing built and the operations
   *  applied to it — when the engine built rather than fell back to a
   *  recipe. Null on a scene planned from a ratified reading or from the
   *  ladder. */
  program: {
    id: string;
    construction: string;
    operators: string[];
    why: string;
    /* WHAT KIND OF IMAGE THIS IS, and the visual idea in the director's
     * language. Both are computed by `represent.ts`, both are carried on
     * the Program — and both were dropped HERE, at the projection onto
     * the composed scene, along with `dislocated`, which the interface
     * declared and the emit never wrote.
     *
     * So the compiler chose a representation for every scene, said so
     * internally, and reported `mode: —` on all of them. The Studio's
     * VISUAL IDEA card reads this object: a projection that silently
     * narrows is how a working decision becomes an invisible one. */
    mode?: string;
    idea?: string;
    dislocated?: boolean;
  } | null;
  /** The other programs this sentence could have been, best first. */
  alternatives: ProgramSummary[];
  /** WHAT THE FILM DID WITH ITS WORLD HERE. Which identities continued,
   *  entered, were recalled or accumulated, and how long the change took.
   *  Null when the film has no world — which is every film compiled before
   *  `world.ts` had a caller. */
  world: {
    mode: FilmMode;
    decisions: Array<{ identity: string; what: string; why: string }>;
    describes: string;
    /** Identities the film is holding after this scene. */
    alive: string[];
    bridgeMs: number;
    /** True when this scene refused continuity and started again. */
    cut: boolean;
  } | null;
}

/* THE DENSITY THRESHOLDS ARE GONE WITH WHAT THEY DROVE. They appended a
 * two-input compositor with nothing on its second input, which is not
 * depth — it is a stock plate painted over the scene. Depth comes from
 * the scene graph, which composes real elements onto real grounds. */
/** Real-time playback: 60fps leaves 16ms a frame. The Preview plays at this
 *  rate, so a chain above it will drop frames while a director is watching. */
const REALTIME_FRAME_MS = 16;
/** The hard ceiling a chain may not exceed. Deliberately four times the
 *  real-time budget, because an EXPORT is not real time — frames can take
 *  as long as they take — and refusing a rich chain outright would make the
 *  top of the abstraction ladder unreachable for a film nobody intends to
 *  scrub live.
 *
 *  Named separately because it was not: the constant said 16 and the guard
 *  allowed four times that, so the number the code appeared to enforce and
 *  the number it enforced were different, and the Compile view reported
 *  against the one it wasn't using. */
const MAX_CHAIN_MS = REALTIME_FRAME_MS * 4;

/** What the film carries into a scene, and what the scene hands back. Held
 *  as one object rather than three more positional arguments because it is
 *  ONE thing — the film's state — and splitting it would let a caller
 *  advance the identities without advancing the picture they are in. */
export interface WorldContext {
  state: FilmState;
  mode: FilmMode;
  /** The graph the last scene left on screen, for bridging. */
  previous: SceneGraph | null;
  /** How long this scene's world may take to arrive, from the measured
   *  silence at its head. Zero means it cuts. */
  bridgeMs: number;
  /** Where this scene starts on the film's clock, so a measured word time
   *  can be turned into a scene-local cue. */
  sceneStartMs?: number;
  /** And how long it lasts, so a cue cannot be scheduled past its end. */
  sceneDurationMs?: number;
  /** Written by `composeScene` — the advanced state, for the next scene. */
  out?: SceneWorld;
}

/** How many primitives may be drawn at once. Restraint caps it;
 *  experimentalism buys headroom back. Stated once because two callers
 *  now need it — the constructor, which assembles under it, and the
 *  ladder, which is sliced to it. */
function restraintCeiling(state: { values: Record<string, number> }): number {
  const restraint = state.values.restraint ?? 0.5;
  const experimentalism = state.values.experimentalism ?? 0.3;
  return Math.round(4 + (1 - restraint) * 2 + experimentalism * 4);
}

export function composeScene(
  ir: EditorialIR,
  scene: Scene,
  sceneIndex: number,
  positions: number[],
  recentChains: string[][],
  /** What the last few scenes put on screen. Institutional prose opens
   *  sentence after sentence the same way, so without this a film cutting
   *  correctly between twenty chains still reads "THE FEDERAL GOVERNMENT"
   *  twenty times. */
  recentPhrases: string[] = [],
  /** The last thing this film named. A sentence made of pronouns is about
   *  whatever the film was already looking at — see `refersBack`. */
  carried: DetectedSubject | null = null,
  /** The last PLACE this film named. A setting outlives the sentence that
   *  established it — see `planScene`. */
  carriedPlace: DetectedSubject | null = null,
  /** THE FILM'S WORLD, arriving from the scene before. Absent means the
   *  film has no world and every scene composes from nothing, which is
   *  what every film did before `world.ts` had a caller. */
  world: WorldContext | null = null,
  /** WHAT THIS SENTENCE IS ALLOWED TO PUT ON SCREEN. Decided film-wide,
   *  before any visual decision, by `promote.ts`. Absent means the old
   *  behaviour — every scene sets its phrase — which is what produced 36
   *  title cards from a 36-scene essay. */
  promotion: Intervention | null = null,
): ComposedScene {
  const state = resolveStateAt(ir, scenePosition(ir, sceneIndex), positions);
  const notes: string[] = [];
  const ruleHits: RuleHit[] = [];
  /* WHICH TAKE THIS IS. Every seed below is derived from it, so asking
   * for another take moves the procedural detail as well as the choices —
   * and it stays derived rather than random, which is what keeps L1
   * determinism true within a take. `0` reproduces every film composed
   * before the field existed, exactly. */
  const take = ir.variant ?? 0;
  if (take > 0) notes.push(`take ${take + 1} — the same writing, composed again`);

  // ── precedence 7: creative state preference ────────────────────────
  let abstraction = state.values.abstraction ?? 0;

  // ── precedence 2 + 4: directorial rules and narrative appropriateness
  // Applied as ceilings, tightest wins. A hard rule cannot be violated;
  // a soft rule still clamps but is reported as a preference that bit.
  for (const rule of ir.rules) {
    const ceiling = applicableCeiling(rule, scene);
    if (ceiling === null) continue;
    if (abstraction > ceiling) {
      ruleHits.push({
        ruleId: rule.ruleId,
        severity: rule.severity,
        message: `abstraction held to ${ceiling.toFixed(2)} — ${rule.statement}`,
      });
      abstraction = ceiling;
    }
  }

  const rung =
    LADDER.find((r) => abstraction < r.maxAbstraction) ?? (LADDER[LADDER.length - 1] as Rung);

  // A scene that carries a reading gets a TREATMENT: a chain planned from
  // what the prose is actually about. Without one the engine falls back to
  // the abstraction ladder's default, which knows the film's mood but
  // nothing about its subject. Either way the nodes are hashed identically
  // downstream, so a treatment caches exactly like any other chain.
  // What this scene puts on screen, and how dense and typographic the film
  // is here. Computed BEFORE the chain is chosen rather than after: a
  // construction reads the phrase (a two-word phrase is set as one form, a
  // longer one as a line) and reads the curves, so deciding them
  // afterwards would mean building against numbers that did not exist yet.
  /* WHAT GOES ON SCREEN — GATED BY WHETHER IT SHOULD.
   *
   * `choosePhrase` picks the best span of a sentence to set as type and is
   * good at it. It ran on every scene, so every sentence put words on
   * screen and a 36-scene essay became 36 title cards — subtitles
   * sprinkled over a video rather than an argument with visual anchors in
   * it. The promotion layer decides film-wide which moments earn text; the
   * chooser now serves that decision instead of making it.
   *
   * A promoted scene uses the PROMOTED span, not a freshly chosen one: the
   * whole point of promoting "IT'S A DIAGNOSIS" is that those words appear,
   * and re-deriving a phrase here would silently overrule the layer above. */
  const allocatedText = promotion ? textOf(promotion) : null;
  const phrase = allocatedText?.text
    ? { text: allocatedText.text, source: `promoted — ${promotion?.why[0] ?? "an anchor"}` }
    : promotion
      ? { text: "", source: promotion.why[0] ?? "spoken only" }
      : choosePhrase(scene.narration.text, scene.label, {
          recent: recentPhrases,
          figures: scene.figures ?? [],
        });
  const density = state.values.visualDensity ?? 0;
  // TYPOGRAPHY FOLLOWS THE PROMOTION, not only the curve. A scene with
  // nothing to say on screen has no typographic weight whatever the film's
  // dial reads, and a scene the argument turns on gets the whole of it.
  const typography = promotion
    ? promotion.intensity === 0
      ? 0
      : Math.max(state.values.typographicWeight ?? 0, 0.25 + promotion.intensity * 0.18)
    : (state.values.typographicWeight ?? 0);

  /* NOTHING ON SCREEN, AND EVERY FLOOR BELOW THIS SKIPPED.
   *
   * The four guarantees that a scene produces geometry — `scene.fit`
   * never returning zero, the ladder backstop, the unconditional SUBJECT
   * push, and the `chain.length > 0` fallback — are all downstream of
   * here. Any ONE of them alone would manufacture a picture, which is why
   * a higher layer asking for silence was previously overruled by a lower
   * layer that had been told it must always draw something.
   *
   * Returning here is what makes the decision stick. It is deliberately
   * an early return rather than four conditionals: emptiness has to be
   * CHOSEN in one place, and a genuine failure further down must still
   * reach its loud fallback rather than become an invisible blank. */
  if (promotion?.kind === "NONE") {
    return {
      sceneId: scene.sceneId,
      actId: scene.actId,
      held: true,
      tier: rung.tier,
      abstraction,
      state,
      nodes: [],
      motifs: [],
      ruleHits,
      notes: [...notes, promotion.why[promotion.why.length - 1] ?? "nothing on screen"],
      override: ir.overrides.find((o) => o.sceneId === scene.sceneId),
      treatment: null,
      costMsPerFrame: 0,
      determinism: "L1",
      phrase: { text: "", source: "nothing on screen" },
      program: null,
      alternatives: [],
      shots: [],
      world: null,
      scenePlan: null,
      graph: null,
    } as ComposedScene;
  }

  let treatment: Treatment | null = null;
  let chain: string[];
  const reasons = new Map<string, string>();
  /* THE PLAN, POSITION BY POSITION — and the reason this is an array and
   * not a Map.
   *
   * It WAS a Map keyed by primitiveId, and that lost two different things
   * at once. A scene graph emits `place` and `geometry_draw` once per
   * element, so a five-element scene's five different parameter sets
   * collapsed to whichever was written last. And a Map of parameters has
   * nowhere to put a compositor's SECOND INPUT, so every nested element —
   * the ground, the field, the words — was dropped on the floor.
   *
   * The measured effect on a real 36-scene essay: 27 scenes planned
   * `typographic` and 3 that contained any text primitive. The other 24
   * rendered their ground plus the operator tail, which is to say the old
   * texture pipeline, which is exactly what it looked like.
   *
   * The flat `chain` stays, because everything after this point — motif
   * append, density append, anti-repetition, the restraint and cost
   * ceilings, the validity sweep, the pin — is written against a list of
   * names. This array shadows it, index for index, through every one of
   * those mutations. A `null` means "no construction planned this
   * position", which is true of every appended motif and of every chain
   * that came from a rung or a treatment rather than from a construction. */
  let planned: (PlannedNode | null)[] = [];
  let program: Program | null = null;
  let alternatives: ProgramSummary[] = [];
  /** The scene's roles, when it has more than one. Function-scoped because
   *  the compositing pass below needs it long after the constructor ran. */
  let scenePlan: ScenePlan | null = null;
  /** The beat and the bent state the SUBJECT was built from, kept for the
   *  same reason: the background planes have to be built from exactly the
   *  same two, or the shot is composed against two different films. */
  let composedBeat: Beat | null = null;
  let composedStyle: Style | null = null;
  let sceneWorld: SceneWorld | null = null;

  const reading = readingFor(scene);
  const ratified = Boolean(scene.reading);
  if (reading && ratified) {
    const language = scene.visualLanguage ?? ir.visualLanguage;
    treatment = planTreatment(reading, language);
    chain = treatment.nodes.map((n) => n.primitiveId);
    planned = chain.map(() => null);
    for (const node of treatment.nodes) reasons.set(node.primitiveId, node.reason);
    if (!treatment.valid) {
      // A treatment that does not typecheck is reported and discarded, not
      // rendered. Falling back is better than emitting a chain the executor
      // will refuse — the scene degrades, the film still compiles.
      notes.push(
        `treatment rejected (${treatment.errors.map((e) => e.message).join("; ")}) — fell back to the ${rung.tier} rung`,
      );
      chain = [...rung.base];
      planned = chain.map(() => null);
      reasons.clear();
      for (const p of chain)
        reasons.set(p, `${rung.tier} rung at abstraction ${abstraction.toFixed(2)}`);
    }
  } else {
    // NO RATIFIED READING — SO BUILD ONE.
    //
    // Not "pick an effect for this sentence". Construct a thing from what
    // the sentence contains, then apply operations to it that the
    // director's state asked for. `construct.ts` carries the argument for
    // why those are two separate questions; what matters here is that this
    // branch produces a PROGRAM with its own parameters rather than a list
    // of primitive ids pulled from a table.
    //
    // Several programs, sorted. The first is used; the rest are carried on
    // the report so the director can see what else this sentence could
    // have been and switch — which is the system proposing and the human
    // ratifying, applied to depiction rather than only to meaning.
    const kind = readSceneKind(scene);
    // THE DIRECTOR'S OWN INSTRUCTION, read before the beat is assembled.
    //
    // Deterministic and unratified, for the same reason a figure is:
    // whether the word "absurd" appears in the direction is not a matter
    // of interpretation. Reported either way, because a direction the
    // compiler could not read is the one thing a director most needs to
    // be told — silence there would look identical to a direction that
    // was heard and ignored.
    const intentReading = hasIntent(scene.directorIntent)
      ? readIntent(scene.directorIntent)
      : undefined;
    if (intentReading) {
      notes.push(`directed — ${describeIntent(intentReading)}`);
    }
    // WHO ACTS ON WHOM. Read before the subjects are ordered, because it
    // is what orders them.
    const relation = readRelation(scene.narration.text);
    if (relation) notes.push(`relation — ${describeRelation(relation)}`);
    const beat: Beat = {
      sentence: scene.narration.text,
      phrase: phrase.text,
      // THE UNNOTICED CASE CARRIES ITS SUBJECT. "At first nobody noticed"
      // is about whatever went unnoticed, and contains no anaphor — so the
      // pronoun rule never fires and the anomaly was planned but never
      // built. Without this the scene composes as typography and the
      // proposition is decoration.
      subjects: leadWithTopic(
        isUnnoticed(scene.narration.text) && carried
          ? [{ ...carried, weight: carried.weight * 0.8 }]
          : sceneSubjects(scene.narration.text, carried),
        relation,
      ),
      ...(relation ? { relation } : {}),
      figures: scene.figures ?? [],
      route: scene.route ?? [],
      kind: kind.kind,
      contested: looksContested(scene.narration.text),
      index: sceneIndex,
      // WHAT KIND OF PICTURE THIS FILM MAKES. Read by the constructions'
      // `fit` and by `representationsFor`, and by nothing else — it is a
      // preference about the picture, not a fact about the sentence.
      approach: ir.visualApproach,
      // Whether this scene is allowed to have its frame resampled. A
      // promoted phrase drawn as type and then sliced by `parallax_layers`
      // loses its first word off the edge — measured, at 1280×720.
      setsType: Boolean(allocatedText?.text),
      ...(intentReading ? { intent: intentReading } : {}),
    };
    // ── the director's verbs ───────────────────────────────────────
    //
    // A `constrain` override carries a DELTA on this scene's state. It is
    // applied before the constructor runs and nowhere else: the engine
    // still composes, so the nudge survives a restyle, a re-read and a
    // recompile — which a pin does not, because a pin stops composition
    // altogether.
    const nudge = ir.overrides.find(
      (o) => o.sceneId === scene.sceneId && o.type === "constrain",
    )?.styleNudge;
    // A verb's nudge. A direction's register bends the same curves and
    // compounds with it, but is applied inside `constructPrograms` rather
    // than here — one place, so it can never be applied twice or forgotten
    // by a caller.
    const bend = (base: number, key: string) =>
      Math.max(0, Math.min(1, base + (nudge?.[key] ?? 0)));
    if (nudge) {
      notes.push(
        `directed — ${Object.entries(nudge)
          .map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v.toFixed(2)}`)
          .join(", ")}`,
      );
    }

    const style: Style = {
      abstraction: bend(abstraction, "abstraction"),
      density: bend(density, "density"),
      energy: bend(state.values.motionEnergy ?? 0.5, "energy"),
      human: bend(state.values.humanPresence ?? 0.5, "human"),
      typography: bend(typography, "typography"),
      archival: bend(state.values.archivalWeight ?? 0.5, "archival"),
      data: bend(state.values.dataWeight ?? 0.5, "data"),
      experimentalism: bend(state.values.experimentalism ?? 0.3, "experimentalism"),
      restraint: bend(state.values.restraint ?? 0.5, "restraint"),
      // THE TWO DIRECTOR DIMENSIONS THE COMPOSITOR MADE REACHABLE.
      //
      // Both default to 0.5 and both are the identity at 0.5, so every
      // film that predates them composes byte-identically. That is not a
      // convenience — a new dial that silently restyled an existing film
      // would be the engine editing work a director already approved.
      //
      // `worldPopulation` deliberately does NOT default to `visualDensity`.
      // They are different questions: density is how much is going on in
      // the picture, population is how much is going on in the world. A
      // dense picture of an empty street is a real shot and folding the
      // two would make it unreachable.
      population: bend(state.values.worldPopulation ?? 0.5, "population"),
      attention: bend(state.values.attention ?? 0.5, "attention"),
      tier: rung.tier,
      language: scene.visualLanguage ?? ir.visualLanguage,
      ...(ir.grammar ? { grammar: ir.grammar } : {}),
    };
    // A nudge that raises abstraction should be able to reach the rung
    // above it, or "stranger" would open no doors the curve had shut.
    // Computed from the DIRECTED abstraction, not the raw one. The
    // constructor bends the state itself, so reading the rung off the
    // unbent value would report a tier the film never composed against —
    // and the ground planner and the ladder fallback both read it.
    const directedAbstraction = intentReading
      ? bendStyle({ abstraction: style.abstraction }, intentReading).abstraction
      : style.abstraction;
    style.tier =
      (LADDER.find((r) => directedAbstraction < r.maxAbstraction) ?? LADDER[LADDER.length - 1])
        ?.tier ?? rung.tier;
    // NOTHING DEPICTABLE WAS NAMED — say so.
    //
    // `namesOnlyAbstractions` has existed since the subject lexicon did,
    // documented as the affordance that stops a silent fallback looking
    // like a decision, and nothing ever called it. So "nobody noticed what
    // was happening until it was too late" got a confident answer chosen
    // by the film's curve and the director's mood alone, presented exactly
    // like a sentence the compiler had actually read.
    //
    // This is the same discipline `extract-reading.ts` already keeps when
    // it declines rather than guesses. The scene still compiles — standing
    // rule 8 — it just stops claiming the prose chose the picture.
    if (beat.subjects.length === 0) {
      notes.push(
        namesOnlyAbstractions(scene.narration.text)
          ? "names nothing depictable — the picture comes from the film's curve and the direction, not from the sentence"
          : "no named subject — the picture comes from the film's curve and the direction, not from the sentence",
      );
    }
    // THE SCENE PLAN. What roles this shot contains, before anything
    // decides which single one wins. A setting that loses is a setting
    // that was read and thrown away — see scene-plan.ts.
    scenePlan = planScene(beat, style, carried, carriedPlace);
    composedBeat = beat;
    composedStyle = style;
    if (isComposite(scenePlan)) notes.push(`composed — ${scenePlan.why}`);

    /* ── THE WORLD ADVANCES ─────────────────────────────────────────────
     *
     * Once, here, above the constructor — which builds many candidate
     * programs and keeps one. Stepping the film inside a candidate would
     * step it once for every candidate that LOST.
     *
     * The representation is asked for the same way `constructPrograms`
     * asks for it, so the world is built as the same KIND of image the
     * construction will be. `representationsFor` is pure and deterministic,
     * so asking twice costs arithmetic and changes nothing.
     *
     * The elements come back with their INHERITED places: a thing the film
     * already established does not jump to wherever a fresh composition
     * would have put it. That single fact is most of what a persistent
     * world means on screen. */
    if (world) {
      const rep =
        representationsFor(beat, style, take).sort((a, b) => b.weight - a.weight)[0] ?? null;
      const counted = (scene.figures ?? []).find((f) => f.kind === "count");
      sceneWorld = stepWorld({
        state: world.state,
        mode: world.mode,
        sentence: scene.narration.text,
        subjects: beat.subjects,
        relation: beat.relation ?? null,
        count:
          counted && Number.isFinite(counted.value) ? Math.max(1, Math.round(counted.value)) : null,
        phrase: phrase.text,
        noun: beat.subjects[0]?.text ?? "",
        density: style.density,
        energy: style.energy,
        abstraction: style.abstraction,
        typography: style.typography,
        experimentalism: style.experimentalism,
        restraint: style.restraint,
        seed: 101 + sceneIndex * 7 + take * 9973,
        // WHAT THIS MOMENT EARNED, and when it is spoken. The typographic
        // recipe branches on the level and the arrival is cued to the
        // measured word — see `grammar-visual.ts`'s WORD and
        // `serialiseScene`'s tween.
        level: promotion?.intensity ?? 2,
        register: ir.typeRegister,
        /* CLAMPED INTO THE SCENE IT PLAYS IN.
         *
         * A measured word can sit outside its own scene's solved window —
         * the solver clamps a window to a minimum and a maximum, and the
         * recording does not. Uncaught, the cue fires after the scene is
         * over: measured on the frames as type that stayed at its
         * entrance size for the whole shot and never arrived. Held to the
         * first two thirds, so an arrival always has somewhere to land. */
        enterAtMs: promotion?.window?.measured
          ? Math.min(
              Math.max(0, promotion.window.startMs - (world.sceneStartMs ?? 0)),
              Math.max(0, (world.sceneDurationMs ?? 0) * 0.66),
            )
          : null,
        holdMs: promotion?.window
          ? Math.max(0, promotion.window.endMs - promotion.window.startMs)
          : null,
        rep,
        previous: world.previous,
        bridgeMs: world.bridgeMs,
        /* THE ACT, AND SOMETHING TO CARRY IT ON.
         *
         * `advance` decided ACCUMULATE and TRANSFORM from `sem.relations`,
         * which needs two lexicon-known nouns, and it carried identities
         * from `sem.entities`, which needs one. On an essay of ideas both
         * are empty — so nothing persisted, every decision was CONTINUE by
         * default, and the entire continuity model was inert on the
         * material this system exists for.
         *
         * The act says what the sentence DOES with no lexicon at all, and
         * the passage is the author's own paragraph. Between them the film
         * has an identity to carry and a reason to change it. */
        read: {
          ...(promotion ? { act: promotion.act.act } : {}),
          ...(scene.passageId ? { subject: `passage ${scene.passageId}` } : {}),
        },
        /* HOW LONG THE MOVE HAS. The scene's own solved duration — a move
         * is what the scene DOES, so it runs across the whole of it, where
         * a bridge runs only in the measured silence at the head. Falls
         * back to a nominal three seconds when the film has not been
         * solved — which is  rather than absent, so this is  and not
         * . That distinction cost an hour: the move never ran and left
         * no trace, because a zero duration is indistinguishable from a
         * scene that chose not to move. */
        sceneMs: world.sceneDurationMs || 3_000,
      });
      world.out = sceneWorld;
      beat.world = {
        graph: sceneWorld.graph,
        material: sceneWorld.material,
        mode: world.mode,
        ...(sceneWorld.tweens.size > 0 && sceneWorld.bridgeMs + sceneWorld.moveMs > 0
          ? { bridge: { tweens: sceneWorld.tweens, ms: sceneWorld.bridgeMs || sceneWorld.moveMs } }
          : {}),
      };
      notes.push(`world — ${sceneWorld.describes}`);
    }

    const programs = constructPrograms(
      beat,
      style,
      MAX_CHAIN_MS,
      promotion?.kind === "TEXT" ? "TEXT" : "COMPOSE",
      promotion?.act.act,
      take,
    );
    const best = programs[0];
    if (best) {
      program = best;
      alternatives = programs
        .slice(1)
        // Only alternatives that differ in what they BUILD or in what they
        // do to it. Two programs differing by one operator's parameter are
        // not a choice, they are noise in a picker.
        .filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i)
        .slice(0, 3)
        .map((p) => ({
          id: p.id,
          construction: p.construction,
          operators: p.operators,
          why: p.why,
          chain: p.nodes.map((n) => n.primitiveId),
          ...(p.mode ? { mode: p.mode } : {}),
          ...(p.idea ? { idea: p.idea } : {}),
          ...(p.dislocated ? { dislocated: true } : {}),
        }));
      chain = best.nodes.map((n) => n.primitiveId);
      // THE TREE, KEPT. Index for index with `chain`, so a compositor's
      // second input survives every flat pass below.
      planned = [...best.nodes];
      // THE PLAN REACHES THE PARAMETERS. Weight and depth were computed
      // and read by nothing — see the capability map. The subject plane's
      // entitlement now sets how much of the frame its construction takes.
      const subjectPlane = scenePlan?.planes.find((pl) => pl.role === "SUBJECT");
      if (subjectPlane) {
        /* WEIGHT REACHES THE WHOLE TREE, not just its trunk.
         *
         * Applied recursively because a scene's elements are nested: the
         * words hang off a compositor, the field hangs off another.
         * weighting only the top level would leave the subject plane's
         * entitlement applied to the ground and to nothing the eye is
         * meant to land on. Standing rule 11 — every system that operates
         * on a compositional structure treats it recursively, or none do. */
        const weigh = (ns: PlannedNode[]): PlannedNode[] =>
          ns.map((n) => ({
            ...n,
            params: applyPlane(n.primitiveId, n.params, subjectPlane),
            ...(n.ground ? { ground: weigh(n.ground) } : {}),
          }));
        planned = weigh(planned.filter((n): n is PlannedNode => n !== null));
        notes.push(
          `weighted — ${subjectPlane.role.toLowerCase()} at ${subjectPlane.weight.toFixed(2)}, depth ${subjectPlane.depth.toFixed(2)}`,
        );
      }
      for (const node of best.nodes) reasons.set(node.primitiveId, node.reason);
      notes.push(
        `constructed "${best.id}" — ${best.why}${
          alternatives.length
            ? ` · ${alternatives.length} other reading${alternatives.length === 1 ? "" : "s"} available`
            : ""
        }`,
      );
    } else {
      // Nothing could be constructed at all. The kind recipes and the
      // ladder remain as EXAMPLES the engine can reach past — kept
      // because they are known-good shapes, demoted because a finite list
      // of shapes is the thing this replaced.
      const byKind = chainForKind(kind.kind, rung.tier, sceneIndex);
      chain = byKind ? [...byKind] : [...rung.base];
      planned = chain.map(() => null);
      for (const p of chain) {
        reasons.set(
          p,
          byKind
            ? `${kind.kind} recipe — ${kind.because} — at the ${rung.tier} rung`
            : `${rung.tier} rung at abstraction ${abstraction.toFixed(2)}`,
        );
      }
    }
  }

  // ── precedence 5: motif continuity ─────────────────────────────────
  // Developing an established motif is the DEFAULT. Its chain is appended
  // before anti-repetition gets a say, so a motif is never dropped for
  // being repetitive — that is the whole point of a motif.
  const motifs: MotifOccurrence[] = [];
  for (const entityId of scene.entities) {
    const motif = ir.motifs.find(
      (m) => m.motifId === entityId || m.concept.toLowerCase() === entityId.toLowerCase(),
    );
    if (!motif) continue;
    const occurrence = developMotif(motif, state, abstraction);
    motifs.push(occurrence);
    for (const p of motif.chain) {
      if (!chain.includes(p)) {
        chain.push(p);
        planned.push(null);
        reasons.set(p, `${motif.concept} motif — ${occurrence.state}`);
      }
    }
  }

  // ── precedence 6: rhythm / anti-repetition ─────────────────────────
  // Only ever varies the surface, and only for primitives carrying no
  // motif. Motif primitives are exempt by construction.
  const motifPrimitives = new Set(
    motifs.flatMap((m) => ir.motifs.find((x) => x.motifId === m.motifId)?.chain ?? []),
  );
  const repeated = countConsecutive(recentChains, chain, motifPrimitives);
  if (repeated >= 3) {
    const variant = pickVariant(chain, motifPrimitives, sceneIndex);
    if (variant) {
      chain.push(variant);
      planned.push(null);
      reasons.set(variant, `anti-repetition — same surface ${repeated} scenes running`);
      notes.push(`varied the surface after ${repeated} consecutive similar chains`);
    }
  }

  // ── precedence 7 continued: density and typography from the curves ──
  /* A COMPOSITOR WITH NOTHING ON ITS SECOND INPUT IS NOT DEPTH.
   *
   * `blend` and `nest` were appended whenever density crossed a threshold,
   * with `planned.push(null)` — meaning no ground, ever. A two-input
   * primitive given nothing on its B side falls back to a STOCK PLATE, and
   * the stock plate reads "90 DAYS": a phrase from a different essay,
   * painted over the sentence the scene was about.
   *
   * Measured at 1280×720 on the test film: one of eight scenes rendered
   * "90 DAYS" in place of "position, not a person". It is the same
   * empty-compositor signature this codebase already names — an operator
   * that consumes a second input it was never given.
   *
   * Depth comes from the scene graph, which composes real elements onto
   * real grounds. A density dial cannot manufacture a second layer out of
   * nothing, and appending the compositor that pretends it can is how a
   * film ends up quoting an essay nobody wrote. */
  /* `variable_axis` WAS APPENDED HERE AND IS NOT A TAIL. It is a SOURCE — it draws its own
   * frame from nothing — so appending it to a composed scene deleted the
   * scene and drew the phrase instead. That is why the title was the one
   * frame that looked right, and why it was right for the wrong reason:
   * the composition underneath it was never visible.
   *
   * It is reachable where it belongs, as the level-4 statement in the WORD
   * op, chosen because a thesis should take the frame rather than because
   * a curve crossed 0.55. */

  /* THE LADDER PATH ONLY, NOW.
   *
   * A construction is assembled under this ceiling rather than sliced to
   * it — `chain.slice(0, ceiling)` counted top-level nodes on a nested
   * structure and cut the operator tail off the end, so the report named
   * a halftone that was not there. The ladder produces a genuinely flat
   * chain, which is what the slice was written for, so it stays here and
   * is skipped for anything the constructor built. */
  const ceilingHere = restraintCeiling(state);
  if (!program && chain.length > ceilingHere) {
    const ceiling = ceilingHere;
    const dropped = chain.length - ceiling;
    // Drop from the tail — motif and rung primitives are added first and
    // are the ones that carry meaning.
    chain = chain.slice(0, ceiling);
    planned = planned.slice(0, ceiling);
    notes.push(
      `restraint ceiling ${ceiling} — ${dropped} primitive${dropped === 1 ? "" : "s"} dropped`,
    );
  }

  /* COST WHAT ACTUALLY RENDERS, not the trunk of it.
   *
   * `chainCost(chain)` counts the flat list of names, and a scene graph
   * hangs a whole element off every compositor — so a five-element scene
   * was billed for its trunk and rendered five chains. The ceilings were
   * being applied to something other than the film. */
  const plannedCost = (): number =>
    chainCost(chain) +
    planned.reduce((sum, n) => sum + (n?.ground ? chainCost(flatIds(n.ground)) : 0), 0);

  // Refuse a chain that would blow the ceiling (Atlas 7.1.4).
  const cut: string[] = [];
  while (chain.length > 1 && plannedCost() > MAX_CHAIN_MS) {
    const removed = chain.pop() as string;
    planned.pop();
    cut.push(removed);
    notes.push(`dropped ${removed} — chain exceeded ${MAX_CHAIN_MS}ms, the export ceiling`);
  }
  /* AND THE REPORT FOLLOWS THE CHAIN DOWN.
   *
   * This loop trims from the tail, which is where the operators and the
   * act's motion character live — and it did not tell the PROGRAM. So a
   * scene whose `color_transform` had just been cut for cost went on
   * being labelled "scene · grade", and the Compile view, the VISUAL IDEA
   * and the alternatives list all named a treatment that is not in the
   * frame. Measured after the restraint fix: 7 claims of 30 were this,
   * six `grade` and one `scanline`.
   *
   * `assemble` can only claim what it attached; this is the other half —
   * what survives the cost ceiling. Both ends now, so an operator on the
   * report is an operator on screen. The loss is said out loud rather
   * than quietly corrected, because a scene too expensive to carry its
   * own grade is a fact a director needs. */
  if (program && cut.length > 0) {
    const gone = program.operators.filter((op) =>
      (OPERATOR_CHAINS.get(op) ?? [op]).some((prim) => cut.includes(prim)),
    );
    if (gone.length > 0) {
      program = {
        ...program,
        operators: program.operators.filter((op) => !gone.includes(op)),
        id: `${program.construction}${program.operators.filter((op) => !gone.includes(op)).length ? ` · ${program.operators.filter((op) => !gone.includes(op)).join(" + ")}` : ""}`,
      };
      notes.push(
        `${gone.join(" and ")} ${gone.length === 1 ? "was" : "were"} planned for this shot and cost more than the frame had — the picture is the composition without ${gone.length === 1 ? "it" : "them"}`,
      );
    }
  }
  // Over real time but under the ceiling is a legitimate, deliberate state —
  // and one a director should be told about, because it is the difference
  // between a film they can scrub and a film they must export to watch.
  const cost = plannedCost();
  if (cost > REALTIME_FRAME_MS) {
    notes.push(
      `${cost}ms/frame — above the ${REALTIME_FRAME_MS}ms real-time budget, so this scene will drop frames in Preview but renders correctly on export`,
    );
  }

  // Validate the FINAL chain, not just the planned treatment. Motif,
  // density and anti-repetition primitives are appended after planning, and
  // an append that doesn't typecheck would otherwise ride through unchecked
  // — which is precisely how a typed palette decays back into a menu of
  // things stapled together because they look good side by side.
  //
  // Offending appends are dropped rather than the whole chain rejected: the
  // rung and the treatment are what the scene is about, and a motif that
  // cannot legally attach should lose, loudly.
  {
    let guard = chain.length;
    while (guard-- > 0) {
      const { errors } = validateChain(chain);
      const first = errors[0];
      if (!first) break;
      const dropped = chain[first.at] as string;
      chain.splice(first.at, 1);
      planned.splice(first.at, 1);
      reasons.delete(dropped);
      notes.push(`dropped ${dropped} — ${first.message}`);
    }
  }

  // ── precedence 1: explicit human override ──────────────────────────
  // Applied LAST so it overwrites everything the engine just decided, and
  // the engine's own notes above are discarded rather than left dangling
  // as an explanation for a chain that no longer exists.
  const override = ir.overrides.find((o) => o.sceneId === scene.sceneId);
  if (override?.type === "pin") {
    const pinned = override.chain && override.chain.length > 0 ? [...override.chain] : chain;
    notes.length = 0;
    chain = pinned;
    // A pin bypasses composition entirely, so nothing here was planned by
    // a construction — the director named the primitives.
    planned = chain.map(() => null);
    reasons.clear();
    for (const p of chain) reasons.set(p, "pinned by the director");
    notes.push(`pinned — composition bypassed${override.note ? ` (${override.note})` : ""}`);
  }

  /* A PLANNED SUBTREE, AS COMPOSED NODES.
   *
   * Recursive, because an element's own chain may itself composite — the
   * scene graph nests one `layer_over` per element and a ground can carry
   * a ground.
   *
   * SEEDED IN ITS OWN BAND, and the existing ground suite caught me
   * getting this wrong. Two layers on the same seed move in lockstep and
   * read as one image rather than two, so `graph.ts` puts its grounds at
   * 7000+ to keep them clear of the trunk's 1000s. These sit higher again,
   * clear of both — deterministic from the scene, the parent's position
   * and the depth, so the same IR is still the same film.
   *
   * Text parameters are applied here too. A word set on an element two
   * levels down is still this scene's word, and leaving it to the
   * primitive's default is how thirty-one scenes came to read
   * "NOBODY VOTED AGAINST". */
  const asComposed = (
    ns: PlannedNode[],
    sceneIdx: number,
    parentIdx: number,
    text: string,
    depth = 1,
  ): ComposedNode[] =>
    ns.map((n, k) => {
      const spec = PRIMITIVES[n.primitiveId];
      return {
        primitiveId: n.primitiveId,
        params: {
          ...textParamsFor(n.primitiveId, text, spec?.parameters ?? {}),
          ...n.params,
        },
        seed: 20000 + sceneIdx * 17 + parentIdx * 211 + depth * 1009 + k + take * 7919,
        costMsPerFrame: spec?.estimatedCostMsPerFrame ?? 4,
        reason: n.reason,
        ...(n.ground && n.ground.length > 0
          ? { ground: asComposed(n.ground, sceneIdx, parentIdx, text, depth + 1) }
          : {}),
        // The bridge travels with the node it was attached to. A nested
        // element's `place` sits on a compositor's B side, which is where
        // most of a scene's elements live — dropping it here would leave
        // the bridge reaching only the element drawn first.
        ...(n.tween && n.tweenMs
          ? {
              tween: n.tween,
              tweenMs: n.tweenMs,
              ...(n.tweenAtMs ? { tweenAtMs: n.tweenAtMs } : {}),
            }
          : {}),
      };
    });

  // THE SCENE'S OWN WORDS.
  //
  // Eleven primitives set type from a string parameter and the engine set
  // none of them, so an 89-scene investigation rendered `text_stagger`'s
  // default — "NOBODY VOTED AGAINST" — thirty-one times, and
  // `particle_seek`'s "NINETY DAYS" twenty-one times, over narration about
  // asylum hotels. Four hardcoded phrases from a different essay, looping
  // for six minutes. It typechecked, it cached, and every number in the
  // Compile view was correct about it.

  const subjectNodes: ComposedNode[] = chain.map((primitiveId, i) => {
    const spec = PRIMITIVES[primitiveId];
    const params: Record<string, number | string> = {
      density: round3(density),
      energy: round3(state.values.motionEnergy ?? 0),
      abstraction: round3(abstraction),
      human: round3(state.values.humanPresence ?? 0),
      ...textParamsFor(primitiveId, phrase.text, spec?.parameters ?? {}),
    };
    // A treatment's parameters are the whole point of planning one — they
    // carry the representation rung and the camera, and a claim's colder
    // grade. Without this merge the plan would be decorative.
    const fromTreatment = treatment?.nodes.find((n) => n.primitiveId === primitiveId);
    if (fromTreatment) Object.assign(params, fromTreatment.params);
    // A CONSTRUCTION'S NUMBERS ARE THE CONSTRUCTION. `creature_chain` with
    // its defaults is a twenty-two-segment centipede whatever the sentence
    // said; with `segments` and `count` read off the prose it is the thing
    // the sentence named. Dropping these would leave the new layer
    // choosing the same primitives as the old one and setting none of
    // them, which is the failure it was built to end.
    const constructed = planned[i];
    if (constructed) Object.assign(params, constructed.params);
    if (override?.type === "pin" && override.params) {
      Object.assign(params, override.params);
    }
    return {
      primitiveId,
      params,
      // Derived, never random — same scene and position always seed the
      // same way, which is what makes L1 determinism real.
      seed: 1000 + sceneIndex * 17 + i + take * 6113,
      costMsPerFrame: spec?.estimatedCostMsPerFrame ?? 4,
      reason: reasons.get(primitiveId) ?? "composed",
      /* THE SECOND INPUT, CARRIED. This is the whole fix.
       *
       * A compositor planned by the scene graph holds an entire element —
       * the words, a field, the ground — on its B side. It used to be
       * dropped here, so a scene of two or more elements arrived at the
       * renderer as its FIRST element plus a compositor pointing at
       * nothing, and the renderer drew the ground and the operator tail.
       * Which is a texture. Which is what every multi-element scene of
       * every film has looked like. */
      ...(constructed?.ground && constructed.ground.length > 0
        ? { ground: asComposed(constructed.ground, sceneIndex, i, phrase.text) }
        : {}),
      ...(constructed?.tween && constructed.tweenMs
        ? {
            tween: constructed.tween,
            tweenMs: constructed.tweenMs,
            ...(constructed.tweenAtMs ? { tweenAtMs: constructed.tweenAtMs } : {}),
          }
        : {}),
    };
  });

  // ── THE SCENE GRAPH ────────────────────────────────────────────────
  //
  // Assembled LAST, against the final subject program — after the
  // restraint ceiling, the cost ceiling and the validity sweep have all
  // had their say, so no layer is ever the reason a scene blows a budget
  // and none sits under a chain the engine was about to prune.
  //
  // `ground` is no longer a slot. There is a tree of semantic nodes whose
  // children are ordinary visual programs, and the type system decides
  // which of them can interact with which. `planGround` survives, demoted
  // from gatekeeper to ATMOSPHERE proposer — the film's own texture, one
  // child among others. That demotion is a real fix: it used to be the
  // gate on ALL layering, so a restrained film lost the city the sentence
  // named, and a decision about decorative texture silently decided a
  // question about depiction.
  const baseParams = {
    density: round3(density),
    energy: round3(state.values.motionEnergy ?? 0),
    abstraction: round3(abstraction),
  };
  const atmosphere = planGround({
    chain,
    tier: rung.tier,
    density,
    motionEnergy: state.values.motionEnergy ?? 0.5,
    experimentalism: state.values.experimentalism ?? 0.3,
    restraint: state.values.restraint ?? 0.5,
    contested: Boolean(reading?.contested),
    pinned: override?.type === "pin",
    sceneIndex,
    approach: ir.visualApproach,
    budgetMs: MAX_CHAIN_MS - chainCost(flattenGround(subjectNodes).map((n) => n.primitiveId)),
  });
  const planes = scenePlan && isComposite(scenePlan) ? scenePlan.planes : ([] as Plane[]);
  // A PIN BYPASSES COMPOSITION ENTIRELY — precedence 1. Layering under a
  // pinned chain would be the engine editing a director's decision, so the
  // graph is not built at all rather than built and discarded.
  const graph =
    override?.type === "pin" || !composedBeat || !composedStyle
      ? null
      : buildGraph({
          planes,
          beat: composedBeat,
          style: composedStyle,
          sceneIndex,
          base: baseParams,
          subject: subjectNodes,
          atmosphere: atmosphere
            ? { program: atmosphere.ground, params: atmosphere.params, why: atmosphere.reason }
            : null,
          budgetMs: MAX_CHAIN_MS - chainCost(flattenGround(subjectNodes).map((n) => n.primitiveId)),
        });
  const flat = graph ? flattenGraph(graph.root, baseParams) : null;
  let nodes: ComposedNode[] = flat && flat.chain.length > 0 ? flat.chain : subjectNodes;

  /* NOTHING RUNS OVER PRESENTED TYPE THAT WOULD DAMAGE IT.
   *
   * `assemble` already refuses to APPEND such an operator, and that guard
   * was not enough, because it only sees the operator tail. The ground
   * compositor is appended by a different path entirely — `planGround`
   * chooses `field_displace` for a DECOMPOSED scene and the graph nests it
   * — so a scene could pass the operator guard and then have its finished
   * frame displaced by a gravity field. Measured on the real essay: "one
   * is exposure, not corruption" rendered with holes through the letters
   * and four scratches across the line.
   *
   * This is the one place that sees the WHOLE chain, whoever built it. A
   * node that would move, sample or erode the frame is dropped once the
   * words are in it, and the drop is reported rather than silent — a
   * treatment the director asked for and did not get is exactly the kind
   * of thing that must not disappear quietly.
   *
   * The words themselves are usually nested on a compositor's second
   * input, so the search is over the flattened tree while the DROP is at
   * the top level: only a top-level stage runs over the composed frame. */
  const presentsType = flattenGround(nodes).some((n) => isSetType(n.primitiveId));
  if (presentsType) {
    const typeAt = nodes.findIndex((n) => flattenGround([n]).some((g) => isSetType(g.primitiveId)));
    if (typeAt >= 0) {
      const kept: ComposedNode[] = [];
      for (const [i, n] of nodes.entries()) {
        if (i <= typeAt || mayFollowPresentedType(n.primitiveId)) {
          kept.push(n);
          continue;
        }
        notes.push(
          `${n.primitiveId} dropped — it would have moved the words this scene is presenting`,
        );
      }
      nodes = kept;
    }
  }

  if (graph && flat && graph.root.children.length > 1) {
    notes.push(`graph — ${describeGraph(graph.root)}, ${graphDepth(graph.root)} levels`);
    for (const d of graph.dropped) {
      notes.push(`${d.role.toLowerCase()} dropped — ${d.why}`);
    }
    for (const r of flat.refused) {
      notes.push(`${r.role.toLowerCase()} refused — ${r.why}`);
    }
  }

  // A CHAIN OF SOURCES IS A STACK, NOT A CHAIN.
  //
  // Eleven of the palette's 123 primitives read their upstream buffer; the
  // rest clear the frame and draw their own thing. So a three-primitive
  // chain of sources renders as its LAST element and the first two cost
  // time for nothing — which is true of the abstraction ladder's own
  // ANNOTATED and DECOMPOSED rungs, and was invisible until the plan was
  // played rather than measured.
  //
  // Reported, not forbidden. Reaching for a look with a recipe is a
  // legitimate thing for a director to do; presenting three primitives as
  // though all three were on screen is not.
  for (const o of chainOverwrites(chain)) {
    notes.push(`${o.id} is painted over by ${o.by} — it costs time and is never seen`);
  }

  return {
    sceneId: scene.sceneId,
    actId: scene.actId,
    tier: rung.tier,
    abstraction,
    state,
    nodes,
    motifs,
    ruleHits,
    notes,
    override,
    treatment,
    // The ground is a whole second chain rendered every frame, so its cost
    // is the scene's cost. Leaving it out would make a two-layer scene look
    // cheaper than a one-layer one, which is the sort of quiet arithmetic
    // that turns a budget into a decoration.
    //
    // FLATTENED, because a stack nests. `ground.ground` is only the
    // outermost layer's primitives; the layers beneath it hang off their
    // own compositors' second inputs, and counting one level would have
    // reintroduced exactly the arithmetic this comment warns about — a
    // three-plane scene reporting the cost of a one-plane one.
    // FLATTENED, because the graph nests. Counting one level would have
    // made a three-layer scene report the cost of a one-layer one —
    // standing rule 11, and the reason `flattenGround` exists at all.
    costMsPerFrame: chainCost(flattenGround(nodes).map((n) => n.primitiveId)),
    determinism: chainDeterminism(flattenGround(nodes).map((n) => n.primitiveId)),
    phrase: { text: phrase.text, source: phrase.source },
    program: program
      ? {
          id: program.id,
          construction: program.construction,
          operators: program.operators,
          why: program.why,
          ...(program.mode ? { mode: program.mode } : {}),
          ...(program.idea ? { idea: program.idea } : {}),
          ...(program.dislocated ? { dislocated: true } : {}),
        }
      : null,
    alternatives,
    world:
      world && sceneWorld
        ? {
            mode: world.mode,
            decisions: sceneWorld.advance.decisions.map((d) => ({
              identity: d.identity,
              what: d.what,
              why: d.why,
            })),
            describes: sceneWorld.describes,
            alive: sceneWorld.advance.state.alive.map((p) => p.identity),
            bridgeMs: sceneWorld.bridgeMs,
            cut: sceneWorld.advance.cut,
          }
        : null,
  };
}

/** The reading a scene will actually be planned from.
 *
 *  Three cases, and the middle one is the point of this function:
 *
 *  1. A RATIFIED READING. The operator approved an interpretation of the
 *     sentence. Mechanically extracted figures and routes are merged onto
 *     it — the reading says what the sentence is about, the prose says what
 *     numbers are in it, and neither overrules the other.
 *
 *  2. NO READING, BUT FIGURES OR A ROUTE. The scene is planned anyway,
 *     from a reading synthesised out of the prose alone. This is legitimate
 *     precisely because nothing here is an interpretation: "$282,345.84" is
 *     in the sentence or it is not, and "Ottawa → IRCC → hotels" is drawn
 *     in the sentence or it is not. No model proposed either, so there is
 *     nothing for an operator to ratify. The subject is marked `concept`
 *     with modest weight, which routes it to the data family without
 *     pretending to know what the sentence is otherwise about.
 *
 *     Without this case, an institutional essay could not compile to
 *     anything but the abstraction ladder until every one of its sentences
 *     had been through a model and a human — which for the essay that
 *     motivated all of this is a hundred and four sentences of gate before
 *     a single frame.
 *
 *  3. NEITHER. Declines, and the abstraction ladder carries the scene. A
 *     guessed reading would override the film's curve, which is worse than
 *     no reading at all.
 */
function readingFor(scene: Scene): SemanticReading | null {
  const figures = scene.figures ?? [];
  const route = scene.route ?? [];
  if (scene.reading) {
    return {
      ...scene.reading,
      figures: scene.reading.figures ?? (figures.length > 0 ? figures : undefined),
      route: scene.reading.route ?? (route.length > 0 ? route : undefined),
    };
  }
  // A LONE YEAR IS A DATE, NOT A QUANTITY.
  //
  // "On September 30, 2025, the federal government ended its direct
  // funding" is a sentence about an ending. Its only figure is the year,
  // and the planner dutifully gave it a counter rolling up to 2025 —
  // arithmetic performed on a date, which is the slideshow-of-charts
  // failure arriving through the one door left open for it. Two or more
  // years is a chronology and stays; a year alongside money stays; a year
  // by itself hands the scene back to the abstraction ladder.
  const quantities = figures.filter((f) => f.kind !== "year");
  const years = figures.filter((f) => f.kind === "year");
  const dataLed = route.length >= 2 || quantities.length > 0 || years.length >= 2;

  if (!dataLed) {
    // 3. WHAT THE SENTENCE NAMES.
    //
    // The palette has exactly two object generators, `creature_chain` and
    // `mounted_fixture`, and until this branch existed the ONLY route to
    // either ran through a ratified reading's subject kind. A reading is a
    // model proposal a human approves, the model declines rather than
    // guesses, and most scenes therefore had none — so every door to the
    // object families was shut and the film fell back to type. "I've never
    // seen it render an object yet" was a correct report of the
    // architecture, not of the taste.
    //
    // Whether a sentence NAMES a depictable thing is checkable against the
    // prose, exactly like a figure, so it needs no model and no
    // ratification. It stays BELOW both of the things that outrank it: a
    // human-approved reading is better information than a word match, and
    // on an institutional essay the number is the finding — a picture of a
    // building is not an improvement on $282,345.84.
    const named = subjectReading(scene.narration.text, scene.label);
    if (!named) return null;
    return { ...named, contested: looksContested(scene.narration.text) };
  }

  return {
    sentence: scene.narration.text,
    subjects: [{ label: scene.label || "figures", kind: "concept", weight: 0.6 }],
    // A route is something being followed; a bare quantity accumulates.
    visualOpportunity: route.length >= 2 ? "contrast" : "accumulate",
    // The hedge still applies. A number inside a reported claim is still
    // inside a reported claim.
    contested: looksContested(scene.narration.text),
    figures,
    route,
  };
}

/** What this scene is about — its own nouns, or the film's if it is
 *  pointing back at them. */
/** Put what the sentence is ABOUT at the front of the subject list.
 *
 *  The single change that makes "the city watched its residents" and "the
 *  residents watched the city" build different things. They name the same
 *  two nouns, so a weight-ordered list puts the same one first in both and
 *  the compiler answers them identically. Word order is the signal, and a
 *  passive exists precisely to change it — which is why the topic is used
 *  here rather than the agent.
 *
 *  Only reorders. Nothing is added or dropped, so a relation can change
 *  which construction wins but can never introduce a subject the sentence
 *  did not name. */
function leadWithTopic(subjects: DetectedSubject[], relation: Relation | null): DetectedSubject[] {
  const topic = relation?.topic;
  if (!topic) return subjects;
  const at = subjects.findIndex(
    (s) => s.offset === topic.offset && s.text.toLowerCase() === topic.text.toLowerCase(),
  );
  // An abstraction can lead a RELATION and must never lead a BUILD — the
  // policy is genuinely the agent of "the policy made the residents
  // afraid" and there is still nothing to draw. Leaving the order alone
  // hands the shot to the residents, which is the right picture of it.
  if (at < 0 || topic.weight <= 0) return subjects;
  return [subjects[at] as DetectedSubject, ...subjects.filter((_, i) => i !== at)];
}

function sceneSubjects(sentence: string, carried: DetectedSubject | null): DetectedSubject[] {
  const own = detectSubjects(sentence);
  // A CARRIED SUBJECT COMPETES; IT IS NOT A FALLBACK.
  //
  // This used to return `own` whenever the sentence named anything at all,
  // so the memory only ever applied to a sentence that named NOTHING. That
  // held until "then there were dozens of them, moving through the streets
  // in strange synchronized waves" — which refers back AND names its
  // setting, and the setting immediately evicted the insects the sentence
  // is entirely about. A film whose memory is switched off by the word
  // "streets" does not have a memory.
  //
  // So the inherited subject joins the list and argues on weight like
  // everything else. It loses to a named creature, and it beats a place —
  // which is the correct reading of a sentence about them, in a street.
  if (!carried || !refersBack(sentence)) return own;
  // Discounted, because an inherited subject is a weaker signal than a
  // named one and should lose to a figure the sentence prints. Skipped
  // entirely when the sentence names the same thing again, or the memory
  // would double a subject that is simply still there.
  const again = own.some((s) => s.text.toLowerCase() === carried.text.toLowerCase());
  if (again) return own;
  return [...own, { ...carried, weight: carried.weight * 0.8 }].sort((a, b) => b.weight - a.weight);
}

/** TAKE THE WORDS OFF A CHAIN, LEAVING THE PICTURE.
 *
 *  A node is carrying the caption when the promoted phrase is in its own
 *  parameters, verbatim — the same test a figure keeps, and the reason
 *  this needs no list of primitive names. A primitive added tomorrow that
 *  sets type is found by this; a list would not have heard of it.
 *
 *  AND THE WORDS ARE USUALLY NOT IN THE TRUNK. Measured: the chain is
 *  `parametric_curve → place → geometry_draw → layer_over`, and the words
 *  are the layer_over's GROUND — its second input, composited over the
 *  picture. So taking the caption off means dropping the compositor whose
 *  ground was nothing but words, which leaves exactly the picture that was
 *  underneath. A compositor pointing at an empty second input is not a
 *  quiet composition, it is a deleted element, so the ground is emptied
 *  and the compositor goes with it rather than being left dangling.
 *
 *  A COMPOSITOR MAY GO FROM ANYWHERE; A PAINTER ONLY FROM THE END. The
 *  distinction is structural rather than a list of names — a node with a
 *  `ground` is a two-input compositor, and what it contributes is a LAYER.
 *  Remove a layer and the layers under and over it still compose: the next
 *  stage takes the canvas that precedes it, and one canvas is as good as
 *  another to something that paints onto it.
 *
 *  A node carrying the words in its own params is a painter, and removing
 *  one from the middle changes what everything after it was built on. Those
 *  come off the end only. Measured on the real essay, the caption is in a
 *  compositor's ground every time — `parametric_curve → place →
 *  geometry_draw → layer_over(words) → layer_over(plate)` — so the first
 *  version of this, which only took trailing nodes, removed nothing at all
 *  wherever a second layer sat on top of the line. */
function withoutTrailingWords(nodes: ComposedNode[], phrase: string): ComposedNode[] {
  const carries = (n: ComposedNode): boolean =>
    Object.values(n.params).some(
      (v) => typeof v === "string" && v.length > 2 && phrase.includes(v),
    );
  /** A compositor whose second input is nothing but the words. Emptying its
   *  ground would leave it pointing at nothing, which is a deleted element
   *  rather than a quiet composition — so it goes with them. */
  const isCaptionLayer = (n: ComposedNode): boolean =>
    Boolean(n.ground && n.ground.length > 0 && withoutTrailingWords(n.ground, phrase).length === 0);

  const kept: ComposedNode[] = [];
  for (let k = 0; k < nodes.length; k++) {
    const n = nodes[k] as ComposedNode;
    if (isCaptionLayer(n)) continue;
    // A painter carrying the words survives unless everything after it is
    // also going — i.e. unless it is at the end of what is left.
    if (carries(n) && nodes.slice(k + 1).every((m) => carries(m) || isCaptionLayer(m))) break;
    kept.push(n);
  }
  return kept.length === nodes.length ? nodes : kept;
}

/** Primitives that put WORDS on screen. Used to stop one scene setting the
 *  same line twice, which draws it on top of itself. */
const TYPE_NODES = new Set([
  "text_layout",
  "glyph_geometry",
  "text_stagger",
  "type_specimen",
  "text_scramble",
  "variable_axis",
]);

export function composeAll(
  ir: EditorialIR,
  timeline?: FilmTimeline | null,
  promotions?: Intervention[] | null,
): ComposedScene[] {
  /* THE ALLOCATION IS NOT OPTIONAL, AND USED TO BE.
   *
   * `promotions` was a parameter with no default, so `composeAll(ir)`
   * composed a film in which NOTHING had been allocated: no silence, no
   * hold, no promoted words, every scene drawing whatever the construction
   * competition picked. One caller in `src/` passes it. Fifty in `tests/`
   * do not — so the suite has been asserting properties of a film the
   * product does not render, and a measurement I took of the real essay
   * through this door reported zero silent scenes in a film that has
   * thirteen.
   *
   * It is computed here when it is not supplied. The parameter stays, as
   * an OVERRIDE: the Lab fetches the Worker's allocation and hands it back
   * so the browser and the compiler cannot disagree about what was
   * promoted — which is the same reason the Lab stopped reimplementing the
   * ladder. */
  const allocations = promotions ?? allocate(ir, timeline ?? null);
  const positions = controlPointPositions(ir);
  const out: ComposedScene[] = [];
  const recent: string[][] = [];
  const phrases: string[] = [];
  /** THE WORDS CURRENTLY ON SCREEN, and the scene that put them there.
   *  Read only by the hold, to decide whether a caption is still standing
   *  or has become a subtitle. */
  let caption: { text: string; at: number } | null = null;
  // THE FILM'S SHORT-TERM MEMORY. What was last named, so a sentence made
  // of pronouns continues the image rather than starting a new one.
  let carried: DetectedSubject | null = null;
  // AND WHERE IT WAS. Held separately from the subject, because a film
  // changes what it is looking at far more often than it changes where it
  // is — folding the two into one slot would mean the city stopped
  // existing the moment a sentence named a person.
  let carriedPlace: DetectedSubject | null = null;
  /* THE FILM'S LONG-TERM MEMORY — the world itself.
   *
   * `carried` remembers a WORD. This remembers a WORLD: which identities
   * are on screen, where they are, how many of them there are, and what
   * left but might come back. It is the state `film-state.ts` was written
   * for and never given, which is why every scene composed from nothing
   * and a film was 36 independent animations.
   *
   * The mode comes off the IR's own continuity setting — the Create
   * screen's "How it moves" writes it — and CUT is the default, which is
   * what every film already was. So a film that predates this composes
   * identically except that its identities are now remembered, and a film
   * asked never to cut can finally be one. */
  const mode = modeOf(ir.continuity);
  let film: FilmState = EMPTY_FILM;
  let previous: SceneGraph | null = null;
  let heldRun = 0;
  ir.scenes.forEach((scene, i) => {
    const onTimeline = timeline?.scenes.find((s) => s.sceneId === scene.sceneId);
    const world: WorldContext = {
      state: film,
      mode,
      previous,
      // THE BRIDGE RUNS IN THE SILENCE. Measured, from the recording. A
      // film with no narration has no measured silence, so it has no
      // bridge — which is honest: there is nothing to arrive between.
      bridgeMs: onTimeline ? bridgeMsFor(onTimeline) : 0,
      sceneStartMs: onTimeline?.startMs ?? 0,
      sceneDurationMs: onTimeline?.durationMs ?? 0,
    };
    const allocated = allocations.find((p) => p.sceneId === scene.sceneId) ?? null;
    const composed = composeScene(
      ir,
      scene,
      i,
      positions,
      recent,
      phrases,
      carried,
      carriedPlace,
      world,
      allocated,
    );
    /* ONE PRESENTED LINE PER SCENE.
     *
     * Measured on the real essay: 18 of 65 scenes carried the same words
     * TWICE — `glyph_geometry:"The fallacy isn't a lapse"` beside another
     * `glyph_geometry:"The fallacy isn't a lapse"`, or `text_layout` in the
     * trunk and again on a compositor's ground. Two type nodes with the
     * same string at the same place draw the sentence on top of itself,
     * which reads as a rendering fault rather than as a composition.
     *
     * It happens because two layers can both legitimately decide to set
     * type — the scene graph gives the TEXT element its own chain, and the
     * construction's own recipe may set type as well — and neither knew
     * about the other. The later one is dropped: the first is the one the
     * composition placed. */
    if (composed.nodes.length > 0) {
      const words = (n: ComposedNode): string =>
        String(n.params.text ?? n.params.heading ?? n.params.caption ?? "").trim();
      const seen = new Set<string>();
      const dedupe = (ns: ComposedNode[]): ComposedNode[] =>
        ns.flatMap((n) => {
          const w = words(n);
          if (w.length > 2 && TYPE_NODES.has(n.primitiveId)) {
            if (seen.has(w)) return [];
            seen.add(w);
          }
          if (!n.ground) return [n];
          const ground = dedupe(n.ground);
          // A compositor whose second input just lost its only node is not
          // a quiet composition, it is a deleted element — so it goes with
          // it, and its first input stands.
          if (n.ground.length > 0 && ground.length === 0) return [];
          return [{ ...n, ground }];
        });
      const kept = dedupe(composed.nodes);
      if (kept.length !== composed.nodes.length) {
        composed.notes.push("the same line was set twice in this scene — the second was dropped");
      }
      composed.nodes = kept;
    }

    /* HOLD — THE SAME PICTURE, STILL THERE.
     *
     * Compositional, and the implementation is the honest one: a held
     * scene's chain IS the previous scene's chain, node for node,
     * parameter for parameter, seed for seed. So it hashes identically,
     * hits the cache, and draws the same thing. The film persists instead
     * of generating an unrelated picture every time the narrator opens
     * their mouth.
     *
     * WHAT THIS DOES NOT DO, stated rather than discovered later. A chain
     * is still rebuilt per scene, so a primitive that INTEGRATES state —
     * a particle system carrying positions forward — restarts. The
     * stateless procedural ones are functions of (seed, t) and continue
     * perfectly if the renderer keeps advancing t, which is where the
     * continuity actually comes from.
     *
     * That boundary is exactly where simulation hold would be needed, and
     * simulation hold conflicts head-on with the buffer disposal that
     * stopped the tab dying at scene 21 of 39. It is a real decision about
     * long-film export, not something to slip in here. */
    /* HOW LONG THIS HOLD HAS RUN. The drift compounds along a run so a
     * shot held for five scenes keeps travelling, instead of making the
     * same small move five times over — which reads as a stutter. Reset
     * by anything that composes its own picture. */
    if (allocated?.kind !== "HOLD") heldRun = 0;
    /* ── THE BREATH ────────────────────────────────────────────────────
     *
     * See `DEPART`. A NONE scene composed to an empty chain, so the frame
     * was flat ground from its first frame and the idea before it was cut
     * off rather than ended — 13 scenes of 65 on blank colour. The
     * standing picture comes in and goes out across the scene, leaving
     * the frame clear for the new paragraph, which is what the clearing
     * was for.
     *
     * The words never come with it. A breath that carried the last
     * caption would put a line on screen at exactly the moment the film
     * decided to stop showing things, and it would be the previous
     * scene's line at that. */
    if (allocated?.kind === "NONE" && composed.nodes.length === 0) {
      const standing = [...out].reverse().find((c) => c.nodes.length > 0);
      /* AND THE WORDS DO NOT COME WITH IT.
       *
       * `withoutTrailingWords` takes a caption off the end of a chain,
       * which is enough for a hold. It cannot take one out of the MIDDLE,
       * because something downstream is consuming it and removing it
       * would hand that consumer nothing. Measured: one breath of
       * thirteen inherited `glyph_geometry` mid-chain and would have put
       * the previous paragraph's line back on screen at the exact moment
       * the film decided to stop showing things.
       *
       * A hold may keep such a caption and say so. A breath may not: the
       * whole point of the beat is that the last idea is finished. So
       * when the words cannot be taken out, the frame is simply clear —
       * which is what it did before this existed, and is right here —
       * and the report says which of the two happened. */
      const bare = standing
        ? caption
          ? withoutTrailingWords(standing.nodes, caption.text)
          : standing.nodes
        : [];
      const stillLettered =
        caption !== null &&
        flattenGround(bare).some((n) =>
          Object.values(n.params).some(
            (v) => typeof v === "string" && v.length > 2 && caption?.text.includes(v),
          ),
        );
      const leaving =
        standing && !stillLettered
          ? driftHeld(bare, undefined, 0, onTimeline?.durationMs || 3_000, 0, DEPART)
          : null;
      if (stillLettered) {
        composed.notes.push(
          `a breath — the frame is clear rather than emptying, because "${caption?.text}" is painted into the standing chain rather than layered over it`,
        );
      } else if (leaving) {
        composed.nodes = leaving.nodes;
        composed.costMsPerFrame = chainCost(
          flattenGround(composed.nodes).map((n) => n.primitiveId),
        );
        composed.determinism = standing?.determinism ?? composed.determinism;
        composed.notes.push(`a breath — ${leaving.why}`);
      } else if (!standing) {
        // Nothing is standing, so there is nothing to see leave. The
        // frame is clear because the film has not drawn anything yet,
        // which is a different fact and is reported as one.
        composed.notes.push("a breath — nothing was standing, so the frame is simply clear");
      }
    }
    if (allocated?.kind === "HOLD") {
      /* HOLD REACHES BACK PAST SILENCE.
       *
       * This looked only at the immediately previous scene, so a HOLD
       * following a NONE found an empty chain and fell through — building
       * a fresh, unrelated picture at exactly the moment the film was
       * meant to resume what it had been showing.
       *
       * Measured on the real essay: 29 scenes allocated HOLD and only 20
       * of them held. Nine composed something new, silently, and the only
       * way to see it was that the held count did not match the
       * allocation.
       *
       * What is STANDING is the last thing actually drawn, which is not
       * the same as the last scene. Silence does not clear the world — it
       * is the film looking away from it, and looking back should find it
       * where it was. */
      const standing = [...out].reverse().find((c) => c.nodes.length > 0);
      if (standing) {
        /* AND THE CAPTION DOES NOT COME WITH IT.
         *
         * A held chain is the previous chain node for node — and it never
         * occurred to the first version that the chain might contain the
         * promoted WORDS. So a line was allocated once and then held for
         * its whole run. Measured on the real essay: 42 of 65 scenes
         * showed words, 27 of them by inheritance, and "he's tracking
         * effect, not accuracy" stood on screen across six consecutive
         * scenes.
         *
         * `HOLD` was one verb doing several jobs. Holding a GROUND while
         * the argument develops is right; holding a caption for half a
         * minute is a subtitle that forgot to leave. So the ground
         * persists and the words decay, on two rules that are editorial
         * rather than numeric:
         *
         *   1. A LINE STANDS FOR ITS OWN SCENE AND ONE MORE. It lands, it
         *      gets a beat, it goes. Counted in cuts because that is what
         *      an edit is counted in.
         *   2. WORDS DO NOT COME BACK AFTER SILENCE. When the hold reached
         *      back PAST an empty scene to find something standing, the
         *      words already left the screen, and returning them is a
         *      flicker rather than a hold.
         *
         * Only TRAILING word-nodes are dropped. If a caption is mid-chain
         * something downstream is consuming it, and removing it would hand
         * that consumer nothing — so the hold keeps it and says so. */
        const reachedBack = out.length > 0 && out[out.length - 1] !== standing;
        const stale = caption !== null && i - caption.at > 1;
        let nodes = standing.nodes;
        if (caption && (reachedBack || stale)) {
          const kept = withoutTrailingWords(nodes, caption.text);
          if (kept.length === nodes.length) {
            // Only worth reporting if the words are actually in there. A
            // chain that has already had them taken out is not a chain
            // that refused to give them up.
            const still = flattenGround(nodes).some((n) =>
              Object.values(n.params).some(
                (v) => typeof v === "string" && v.length > 2 && caption?.text.includes(v),
              ),
            );
            if (still) {
              composed.notes.push(
                `the words are still in the held chain — "${caption.text}" is painted into it rather than layered over it, so taking it out would change what everything after it was built on`,
              );
            }
          } else {
            composed.notes.push(
              reachedBack
                ? "the words are gone — the film was silent, and a line does not come back from that"
                : `the words are gone — "${caption.text}" stood for ${i - caption.at} scenes`,
            );
          }
          nodes = kept;
        }
        composed.nodes = nodes;
        composed.held = true;
        /* AND THE IDEA COMES WITH THE CHAIN.
         *
         * `program` is what the Preview prints as the VISUAL IDEA and what
         * the Compile view audits the chain against — so a held scene that
         * kept its OWN program was reporting a picture it did not draw. On
         * a real fixture that showed up as two of nine scenes labelled
         * typographic with no type anywhere in them, and the label was the
         * thing that was wrong, not the chain.
         *
         * `alternatives` deliberately stay this scene's own: they are what
         * the director may pin to BREAK the hold, and replacing them would
         * offer the standing scene's options for a sentence that is not
         * the standing scene's. */
        composed.program = standing.program;
        composed.costMsPerFrame = chainCost(
          flattenGround(composed.nodes).map((n) => n.primitiveId),
        );
        composed.determinism = standing.determinism;
        composed.notes.push(`held — the same composition as ${standing.sceneId}, still standing`);
        /* AND IT KEEPS MOVING. See `driftHeld` — a held frame that stops
         * dead is the single largest thing making these films feel like
         * slides, and it was thirty scenes of sixty-five. */
        const drifted = driftHeld(
          composed.nodes,
          allocated.act?.act,
          heldRun,
          /* THE WINDOW, MEASURED WHERE THERE IS ONE. A film compiled
           * before it has been narrated has no measured windows at all,
           * and requiring one meant every held scene in an unnarrated
           * film stayed frozen — the exact failure this is here to fix,
           * surviving in the case a person sees FIRST. The nominal
           * three seconds is the same default `world` already uses for
           * the same reason, and the drift is re-timed to the real
           * window the moment the voice is recorded. */
          onTimeline?.durationMs || 3_000,
          restraintAt(ir, i, positions),
        );
        if (drifted) {
          composed.nodes = drifted.nodes;
          composed.notes.push(
            `and it moves — ${drifted.why}${onTimeline ? "" : ", timed to a nominal window until this is narrated"}`,
          );
        }
        heldRun++;
      } else {
        // Nothing has ever been drawn, so there is nothing to hold. The
        // scene composes, and says why rather than pretending it held.
        composed.notes.push("asked to hold, but the film has not drawn anything yet");
      }
    }

    /* WHAT IS ON SCREEN AS WORDS, AFTER EVERY DECISION ABOVE.
     *
     * Set from the allocation rather than from the composed phrase,
     * because the allocation is the film's decision and the phrase is the
     * sentence's. Cleared by a scene that draws something new without
     * words, and by silence — both of which take the caption off screen. */
    const allocatedHere = textOf(allocated ?? ({} as Intervention));
    if (allocatedHere?.text && !composed.held) {
      caption = { text: allocatedHere.text, at: i };
    } else if (!composed.held) {
      // A scene that composed something FRESH without words has replaced
      // them. Silence deliberately does NOT clear this: the words are off
      // screen, but the hold that reaches back past the silence has to
      // know what to take out of the chain it finds, and the first version
      // of this cleared the reference and then could not.
      caption = null;
    }
    if (world.out) {
      film = world.out.advance.state;
      previous = world.out.graph;
    } else if (composed.nodes.length === 0) {
      /* A SILENT SCENE STILL COSTS THE FILM A SCENE.
       *
       * `composeScene` returns early on NONE, before the world block, so
       * `world.out` is null and this branch never ran — which meant
       * `sceneIndex` did not advance and every identity's `lastSeen`
       * stayed the same distance away. A film that fell quiet for four
       * scenes then read a twelve-scene-old identity as eight scenes old,
       * and called its return a RECALL rather than an entrance.
       *
       * Silence does not clear the world. It is not a pause in the clock
       * either. `previous` is deliberately untouched: the graph the film
       * would bridge from is the last one it actually drew. */
      film = rest(film);
    }
    const named = detectSubjects(scene.narration.text);
    const own = named[0];
    if (own) carried = own;
    const place = named.find((s) => s.kind === "place");
    if (place) carriedPlace = place;
    out.push(composed);
    recent.push(composed.nodes.map((n) => n.primitiveId));
    if (recent.length > 4) recent.shift();
    phrases.push(composed.phrase.text);
    // Six is about how far back a viewer notices a repeat at documentary
    // pace. Longer and the film starts reaching for weaker phrases to
    // avoid a repetition nobody would have seen.
    if (phrases.length > 6) phrases.shift();
  });
  return out;
}

/** The ceiling a rule imposes on this scene, or null if it doesn't apply.
 *  Scope matches either an actId or a narrativeFunction, so "no abstract
 *  visuals before Act II" and "never abstract an evidence scene" are the
 *  same mechanism. */
function applicableCeiling(rule: Rule, scene: Scene): number | null {
  if (rule.kind !== "forbid_vocabulary" && rule.kind !== "narrative_guard") return null;
  if (rule.maxAbstraction === undefined) return null;
  if (rule.scope && rule.scope !== scene.actId && rule.scope !== scene.narrativeFunction)
    return null;
  return rule.maxAbstraction;
}

/** Advance a motif along its development ladder. The same metaphor at an
 *  escalating emotional pitch: a timeline that is flat, then layered, then
 *  fragmented, then dissolved. Identity is constant; state is not. */
function developMotif(motif: Motif, state: ResolvedState, abstraction: number): MotifOccurrence {
  const n = motif.states.length;
  let driver: number;
  switch (motif.developmentRule) {
    case "escalate_with_density":
      driver = state.values.visualDensity ?? 0;
      break;
    case "static":
      driver = 0;
      break;
    default:
      driver = abstraction;
  }
  const idx = Math.min(n - 1, Math.max(0, Math.floor(driver * n)));
  return {
    motifId: motif.motifId,
    concept: motif.concept,
    state: motif.states[idx] as string,
    stateIndex: idx,
  };
}

/** How many of the recent chains were essentially this chain, ignoring
 *  motif-carrying primitives (which are exempt from anti-repetition). */
function countConsecutive(recent: string[][], chain: string[], exempt: Set<string>): number {
  const key = (c: string[]) =>
    c
      .filter((p) => !exempt.has(p))
      .slice()
      .sort()
      .join("+");
  const target = key(chain);
  let n = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    if (key(recent[i] as string[]) === target) n++;
    else break;
  }
  return n;
}

/** A type-compatible primitive to vary the surface with. Chosen
 *  deterministically by scene index — varied, but never random. */
function pickVariant(chain: string[], exempt: Set<string>, sceneIndex: number): string | null {
  const last = chain[chain.length - 1];
  if (!last) return null;
  const candidates = Object.values(PRIMITIVES)
    .filter((p) => !chain.includes(p.primitiveId) && !exempt.has(p.primitiveId))
    .filter((p) => p.family === "M · COMPOSITING" || p.family === "O · MOTION CRAFT")
    .map((p) => p.primitiveId)
    .sort();
  if (candidates.length === 0) return null;
  return candidates[sceneIndex % candidates.length] as string;
}

/** Every primitive id in a planned subtree, for costing. */
const flatIds = (ns: PlannedNode[]): string[] =>
  ns.flatMap((n) => [n.primitiveId, ...(n.ground ? flatIds(n.ground) : [])]);

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

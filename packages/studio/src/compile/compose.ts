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
import {
  type Determinism,
  PRIMITIVES,
  chainCost,
  chainDeterminism,
  chainOverwrites,
} from "../primitives/registry.ts";
import { type Beat, type Program, type Style, constructPrograms } from "./construct.ts";
import {
  type ResolvedState,
  controlPointPositions,
  resolveStateAt,
  scenePosition,
} from "./creative-state.ts";
import { looksContested } from "./extract-reading.ts";
import { groundSatisfies, planGround } from "./ground.ts";
import { bendStyle, describeIntent, hasIntent, readIntent } from "./intent.ts";
import { choosePhrase } from "./phrase.ts";
import { chainForKind, readSceneKind } from "./scene-kind.ts";
import {
  type DetectedSubject,
  detectSubjects,
  namesOnlyAbstractions,
  refersBack,
  subjectReading,
} from "./subject.ts";
import { textParamsFor } from "./text-params.ts";
import { type Treatment, planTreatment, validateChain } from "./treatment.ts";

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
    dislocated?: boolean;
  } | null;
  /** The other programs this sentence could have been, best first. */
  alternatives: ProgramSummary[];
}

/** Density and typography earn extra compositing depth; restraint takes it
 *  away. Kept as named constants so the Lab can tune them against measured
 *  cost rather than taste alone. */
const DENSITY_BLEND_AT = 0.55;
const DENSITY_NEST_AT = 0.75;
const TYPO_VARIABLE_AXIS_AT = 0.55;
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
): ComposedScene {
  const state = resolveStateAt(ir, scenePosition(ir, sceneIndex), positions);
  const notes: string[] = [];
  const ruleHits: RuleHit[] = [];

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
  const phrase = choosePhrase(scene.narration.text, scene.label, {
    recent: recentPhrases,
    figures: scene.figures ?? [],
  });
  const density = state.values.visualDensity ?? 0;
  const typography = state.values.typographicWeight ?? 0;

  let treatment: Treatment | null = null;
  let chain: string[];
  const reasons = new Map<string, string>();
  /** Parameters decided by whatever PLANNED this chain — a treatment or a
   *  construction. Merged onto the nodes below, because a plan whose
   *  numbers are thrown away is a plan in name only. */
  let plannedParams = new Map<string, Record<string, number | string>>();
  let program: Program | null = null;
  let alternatives: ProgramSummary[] = [];

  const reading = readingFor(scene);
  const ratified = Boolean(scene.reading);
  if (reading && ratified) {
    const language = scene.visualLanguage ?? ir.visualLanguage;
    treatment = planTreatment(reading, language);
    chain = treatment.nodes.map((n) => n.primitiveId);
    for (const node of treatment.nodes) reasons.set(node.primitiveId, node.reason);
    if (!treatment.valid) {
      // A treatment that does not typecheck is reported and discarded, not
      // rendered. Falling back is better than emitting a chain the executor
      // will refuse — the scene degrades, the film still compiles.
      notes.push(
        `treatment rejected (${treatment.errors.map((e) => e.message).join("; ")}) — fell back to the ${rung.tier} rung`,
      );
      chain = [...rung.base];
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
    const beat: Beat = {
      sentence: scene.narration.text,
      phrase: phrase.text,
      subjects: sceneSubjects(scene.narration.text, carried),
      figures: scene.figures ?? [],
      route: scene.route ?? [],
      kind: kind.kind,
      contested: looksContested(scene.narration.text),
      index: sceneIndex,
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
    const programs = constructPrograms(beat, style, MAX_CHAIN_MS);
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
          ...(p.dislocated ? { dislocated: true } : {}),
        }));
      chain = best.nodes.map((n) => n.primitiveId);
      plannedParams = new Map(best.nodes.map((n) => [n.primitiveId, n.params]));
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
      reasons.set(variant, `anti-repetition — same surface ${repeated} scenes running`);
      notes.push(`varied the surface after ${repeated} consecutive similar chains`);
    }
  }

  // ── precedence 7 continued: density and typography from the curves ──
  if (density > DENSITY_BLEND_AT && !chain.includes("blend")) {
    chain.push("blend");
    reasons.set("blend", `density ${density.toFixed(2)} — compositing depth`);
  }
  if (density > DENSITY_NEST_AT && !chain.includes("nest")) {
    chain.push("nest");
    reasons.set("nest", `density ${density.toFixed(2)} — nested composition`);
  }
  if (typography > TYPO_VARIABLE_AXIS_AT && !chain.includes("variable_axis")) {
    chain.push("variable_axis");
    reasons.set("variable_axis", `typographic weight ${typography.toFixed(2)}`);
  }

  // Restraint caps how much can be on screen at once. Experimentalism buys
  // headroom back.
  const restraint = state.values.restraint ?? 0.5;
  const experimentalism = state.values.experimentalism ?? 0.3;
  const ceiling = Math.round(4 + (1 - restraint) * 2 + experimentalism * 4);
  if (chain.length > ceiling) {
    const dropped = chain.length - ceiling;
    // Drop from the tail — motif and rung primitives are added first and
    // are the ones that carry meaning.
    chain = chain.slice(0, ceiling);
    notes.push(
      `restraint ceiling ${ceiling} — ${dropped} primitive${dropped === 1 ? "" : "s"} dropped`,
    );
  }

  // Refuse a chain that would blow the ceiling (Atlas 7.1.4).
  while (chain.length > 1 && chainCost(chain) > MAX_CHAIN_MS) {
    const removed = chain.pop() as string;
    notes.push(`dropped ${removed} — chain exceeded ${MAX_CHAIN_MS}ms, the export ceiling`);
  }
  // Over real time but under the ceiling is a legitimate, deliberate state —
  // and one a director should be told about, because it is the difference
  // between a film they can scrub and a film they must export to watch.
  const cost = chainCost(chain);
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
    reasons.clear();
    for (const p of chain) reasons.set(p, "pinned by the director");
    notes.push(`pinned — composition bypassed${override.note ? ` (${override.note})` : ""}`);
  }

  // ── the second input ───────────────────────────────────────────────
  //
  // Decided against the FINAL chain, after the restraint ceiling, the cost
  // ceiling and the validity sweep have all had their say — so a ground is
  // never the reason a scene blows a budget, and never sits under a chain
  // the engine was about to drop a primitive from.
  //
  // Appended as a node like any other, so it hashes, caches, and appears
  // in the Compile view exactly like the rest of the chain. The one thing
  // that is different is that it carries a chain of its own.
  const ground = planGround({
    chain,
    tier: rung.tier,
    density,
    motionEnergy: state.values.motionEnergy ?? 0.5,
    experimentalism,
    restraint,
    contested: Boolean(reading?.contested),
    pinned: override?.type === "pin",
    sceneIndex,
    budgetMs: MAX_CHAIN_MS - chainCost(chain),
  });
  let groundNodes: ComposedNode[] | null = null;
  if (ground) {
    const satisfied = groundSatisfies(ground.compositor, ground.ground);
    if (satisfied !== true) {
      // A ground that does not structurally satisfy its compositor would
      // composite nothing and look like it worked. Refused loudly.
      notes.push(`no ground — ${satisfied}`);
    } else {
      groundNodes = ground.ground.map((primitiveId, i) => ({
        primitiveId,
        params: {
          density: round3(density),
          energy: round3(state.values.motionEnergy ?? 0),
          abstraction: round3(abstraction),
        },
        // Seeded off the SCENE and its position in the ground, in a range
        // that cannot collide with the subject chain's seeds — two layers
        // seeded identically would move in lockstep and read as one.
        seed: 7000 + sceneIndex * 17 + i,
        costMsPerFrame: PRIMITIVES[primitiveId]?.estimatedCostMsPerFrame ?? 4,
        reason: `ground — ${ground.reason}`,
      }));
      chain.push(ground.compositor);
      reasons.set(ground.compositor, ground.reason);
      notes.push(
        `${ground.compositor} over ${ground.ground.join(" → ")} — two inputs, not two stacked frames`,
      );
    }
  }

  // THE SCENE'S OWN WORDS.
  //
  // Eleven primitives set type from a string parameter and the engine set
  // none of them, so an 89-scene investigation rendered `text_stagger`'s
  // default — "NOBODY VOTED AGAINST" — thirty-one times, and
  // `particle_seek`'s "NINETY DAYS" twenty-one times, over narration about
  // asylum hotels. Four hardcoded phrases from a different essay, looping
  // for six minutes. It typechecked, it cached, and every number in the
  // Compile view was correct about it.

  const nodes: ComposedNode[] = chain.map((primitiveId, i) => {
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
    const planned = treatment?.nodes.find((n) => n.primitiveId === primitiveId);
    if (planned) Object.assign(params, planned.params);
    // A CONSTRUCTION'S NUMBERS ARE THE CONSTRUCTION. `creature_chain` with
    // its defaults is a twenty-two-segment centipede whatever the sentence
    // said; with `segments` and `count` read off the prose it is the thing
    // the sentence named. Dropping these would leave the new layer
    // choosing the same primitives as the old one and setting none of
    // them, which is the failure it was built to end.
    const constructed = plannedParams.get(primitiveId);
    if (constructed) Object.assign(params, constructed);
    if (override?.type === "pin" && override.params) {
      Object.assign(params, override.params);
    }
    if (ground && groundNodes && primitiveId === ground.compositor) {
      Object.assign(params, ground.params);
    }
    return {
      primitiveId,
      params,
      // Derived, never random — same scene and position always seed the
      // same way, which is what makes L1 determinism real.
      seed: 1000 + sceneIndex * 17 + i,
      costMsPerFrame: spec?.estimatedCostMsPerFrame ?? 4,
      reason: reasons.get(primitiveId) ?? "composed",
      // The compositor carries its ground. Everything else carries none —
      // `ground` being absent rather than empty is what lets the executor
      // tell a one-input node from a two-input node with nothing on its
      // second side.
      ...(ground && groundNodes && primitiveId === ground.compositor
        ? { ground: groundNodes }
        : {}),
    };
  });

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
    costMsPerFrame: chainCost(chain) + (groundNodes ? chainCost(ground?.ground ?? []) : 0),
    determinism: chainDeterminism([...chain, ...(ground?.ground ?? [])]),
    phrase: { text: phrase.text, source: phrase.source },
    program: program
      ? {
          id: program.id,
          construction: program.construction,
          operators: program.operators,
          why: program.why,
        }
      : null,
    alternatives,
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

export function composeAll(ir: EditorialIR): ComposedScene[] {
  const positions = controlPointPositions(ir);
  const out: ComposedScene[] = [];
  const recent: string[][] = [];
  const phrases: string[] = [];
  // THE FILM'S SHORT-TERM MEMORY. What was last named, so a sentence made
  // of pronouns continues the image rather than starting a new one.
  let carried: DetectedSubject | null = null;
  ir.scenes.forEach((scene, i) => {
    const composed = composeScene(ir, scene, i, positions, recent, phrases, carried);
    const own = detectSubjects(scene.narration.text)[0];
    if (own) carried = own;
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

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

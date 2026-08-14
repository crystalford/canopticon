// The film plan — a compile report, shaped so it can actually be played.
//
// Everything upstream of this produces a PLAN: which primitives, with which
// parameters, in which window, cut how. Everything downstream of it — the
// Lab's executor — has always been able to run a chain. The two had never
// been connected, so the system could describe a film in complete detail
// and never show you one.
//
// This is deliberately a thin, boring transform. It invents nothing. Every
// value here was decided by the solver, the composition engine or the shot
// planner, and the point of putting it in its own module is that the
// mapping is AUDITABLE: when a shot looks wrong you can read which
// component chose the number rather than guessing at the player.
//
// One real decision does live here, and it is stated rather than hidden:
// how a shot's variation reaches the primitives. See `shotParams`.

import type { Colour, EditorialIR } from "../ir/schema.ts";
import { PRIMITIVES } from "../primitives/registry.ts";
import type { ComposedNode } from "./compose.ts";
import type { CompileReport } from "./index.ts";
import { textOf } from "./promote.ts";
import type { ShotVariation } from "./shot-plan.ts";

export interface FilmNode {
  id: string;
  params: Record<string, number | string>;
  seed: number;
  /** THE SECOND INPUT — this node's ground, as its own chain.
   *
   *  Named `b` rather than `ground` because that is what the executor
   *  calls the B side of a composite, and the plan is a message to the
   *  executor. Absent on every one-input node, which is how the browser
   *  tells a compositor with a ground from one without. */
  b?: FilmNode[];
  /** THE BRIDGE. `{param: [from, to]}` applied to this node's LIVE params
   *  by the executor over `tweenMs`, with no chain rebuild — so a one shot
   *  travels instead of cutting. Absent on every node of a film that
   *  cuts. */
  tween?: Record<string, [number, number]>;
  tweenMs?: number;
  /** When it starts, scene-local — a word landing on its own spoken
   *  moment rather than at the top of the scene. */
  tweenAtMs?: number;
}

export interface FilmShot {
  startMs: number;
  endMs: number;
  /** Why this cut exists, carried through so the player can show it. */
  reason: "rhythm" | "overflow" | "whole";
  /** Parameter overrides for THIS shot, already resolved against what each
   *  primitive in the chain actually declares. Empty for an uncut scene. */
  params: Record<string, number | string>;
}

export interface FilmScene {
  sceneId: string;
  actId: string;
  /** THE FILM CHOSE TO SHOW NOTHING NEW HERE.
   *
   *  Read by the renderer, and it is the whole difference between
   *  silence and a bug: an empty chain that arrived by accident renders
   *  as clean ground and looks exactly like an intended hold. With this,
   *  one is drawn and the other is reported. */
  held?: boolean;
  label: string;
  /** The prose this scene carries. Shown under the frame, because a
   *  documentary compiler that hides its own sentence from you is hard to
   *  judge. */
  text: string;
  startMs: number;
  endMs: number;
  tier: string;
  determinism: string;
  costMsPerFrame: number;
  /** Why this chain — one line per primitive, from the composition engine. */
  reasons: string[];
  /** THE VISUAL IDEA, in the director's language rather than the
   *  compiler's. What was built, what was done to it, and why — so the
   *  first thing a person reads about a shot is what it IS, not which
   *  five nodes were selected. */
  idea: {
    id: string;
    construction: string;
    operators: string[];
    why: string;
  } | null;
  /** What else this sentence could have been. The engine proposes; the
   *  director ratifies — the same rail readings go through, applied to
   *  depiction. */
  alternatives: Array<{
    id: string;
    construction: string;
    operators: string[];
    why: string;
    chain: string[];
  }>;
  chain: FilmNode[];
  shots: FilmShot[];
  /** Where this scene's frozen narration lives, when it has been recorded.
   *  A URL rather than bytes: the plan is a document, and the audio is an
   *  immutable object the browser fetches once and caches on its hash. */
  vo?: {
    url: string;
    assetId: string;
    sha256: string;
    /** Measured off the audio, not estimated from the prose. */
    durationMs: number;
    /** How the window was arrived at, so the Preview can say whether it is
     *  showing a measurement or a guess. */
    method: string;
  };
  /** WHAT THE FILM DID WITH ITS WORLD HERE — which identities continued,
   *  entered, were recalled; and how long the change took. Null in a film
   *  that cuts, which has no world to speak of. */
  /** WHETHER THIS MOMENT EARNED THE SCREEN, and why.
   *
   *  Level 0 is most of an essay and means the line is spoken and not
   *  shown. Carried on the plan so a person can see the compiler's
   *  decision rather than only its consequence — a promotion nobody can
   *  account for is indistinguishable from a guess. */
  promotion?: {
    level: number;
    role: string;
    text: string;
    why: string[];
    /** When it is spoken, and whether that was measured or interpolated. */
    window: { startMs: number; endMs: number; measured: boolean } | null;
  } | null;
  world?: {
    mode: string;
    describes: string;
    decisions: Array<{ identity: string; what: string; why: string }>;
    alive: string[];
    bridgeMs: number;
    cut: boolean;
  } | null;
}

export interface FilmPlan {
  projectId: string;
  title: string;
  durationMs: number;
  /** Structurally always 0. Restated here so a viewer watching the film can
   *  see that watching it cost nothing. */
  ttsCalls: 0;
  determinism: string;
  peakCostMsPerFrame: number;
  /** THE FILM'S COLOUR, as the four directorial numbers — never as hex.
   *  The compiler carries the intent; the renderer owns the one function
   *  that turns it into a palette. */
  colour: Colour;
  scenes: FilmScene[];
  /** THE NARRATION SPINE — measured or estimated, where the voice rests,
   *  how fast it speaks. Carried so a view can say which it is looking at
   *  rather than presenting an estimate as a measurement. */
  timeline: {
    spine: string;
    describes: string;
    measuredMs: number;
    medianWordsPerMin: number | null;
    pauses: number;
    /** How many scenes reached WORD precision. A film narrated by a model
     *  that returned only a duration is measured at the sentence and
     *  should not be described as timed to the word. */
    wordTimedScenes: number;
  };
  warnings: string[];
}

/** How a shot's variation reaches the chain.
 *
 *  The shot planner speaks in editorial terms — this fragment of the line,
 *  this much deformation, plate reversed. The primitives speak in their own
 *  parameter names. This is the join, and it is a lookup rather than
 *  anything clever on purpose.
 *
 *  A key is only applied to a primitive that DECLARES it. That check is not
 *  defensive tidiness: without it, `amount` would land on every primitive
 *  in the palette that happens to have a parameter of that name and a
 *  scene's deformation would silently drive an unrelated knob three stages
 *  downstream.
 */
const READ: Record<string, (v: ShotVariation) => number | string> = {
  text: (v) => v.text,
  caption: (v) => v.text,
  mode: (v) => v.mode,
  amount: (v) => v.amount,
  invert: (v) => v.invert,
  rotate: (v) => v.rotate,
};

/** Which primitives accept which shot variation, NAMED EXPLICITLY.
 *
 *  The first version of this matched on parameter name alone — if anything
 *  in the chain declared `amount`, the shot's deformation was sent to it.
 *  That is wrong in a way worth recording: `document_surface` happens to
 *  have a parameter called `amount`, so on the IHAP film every documentary
 *  scene's cuts were quietly driving a document knob with a number that
 *  meant "how far to deform the type". The chain typechecked. The name
 *  matched. It was still meaningless.
 *
 *  Sharing a parameter name is not sharing a meaning, so the join is a
 *  list. A primitive not on it takes no per-shot variation, which is the
 *  honest default — better a cut that holds than a cut that moves the
 *  wrong thing. */
const SHOT_TARGETS: Record<string, string[]> = {
  glyph_geometry: ["text", "rotate"],
  text_layout: ["text"],
  text_stagger: ["text"],
  text_scramble: ["text"],
  geometry_morph: ["mode", "amount"],
  geometry_draw: ["invert"],
  data_series: ["caption"],
};

function shotParams(chain: FilmNode[], variation: ShotVariation): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  for (const node of chain) {
    const spec = PRIMITIVES[node.id];
    for (const key of SHOT_TARGETS[node.id] ?? []) {
      // Belt and braces: the primitive must be on the list AND actually
      // declare the parameter, so a renamed parameter shows up as a shot
      // that stops varying rather than as a silently ignored write.
      if (spec?.parameters[key] === undefined) continue;
      const read = READ[key];
      if (read) out[key] = read(variation);
    }
  }
  return out;
}

/** The scene's frozen narration, named on the plan so the browser can play
 *  it. Absent — not null, not a placeholder — when the scene has not been
 *  narrated, because a Preview that plays silence and a Preview that plays
 *  nothing should not look the same in the plan. */
function narrationFor(
  ir: EditorialIR,
  scene: EditorialIR["scenes"][number] | undefined,
): Pick<FilmScene, "vo"> | Record<string, never> {
  const assetId = scene?.narration.voAssetId;
  if (!scene || !assetId) return {};
  const asset = ir.assets.find((a) => a.assetId === assetId);
  if (!asset) return {};
  const alignment = scene.narration.alignmentAssetId
    ? ir.assets.find((a) => a.assetId === scene.narration.alignmentAssetId)
    : undefined;
  const params = (alignment?.provenance.params ?? {}) as Record<string, unknown>;
  return {
    vo: {
      url: `/v1/project/${ir.projectId}/vo/${scene.sceneId}`,
      assetId,
      sha256: asset.sha256,
      durationMs: typeof params.durationMs === "number" ? params.durationMs : 0,
      method: typeof params.method === "string" ? params.method : "unmeasured",
    },
  };
}

/** This scene's promotion, projected. Absent rather than faked when the
 *  compile did not run the layer. */
function promotionFor(report: CompileReport, sceneId: string) {
  const p = report.interventions.find((x) => x.sceneId === sceneId);
  if (!p) return null;
  const words = textOf(p);
  return {
    level: p.intensity,
    role: p.role,
    text: words?.text ?? "",
    why: p.why,
    window: p.window,
  };
}

/** A compile report becomes something you can watch. */
export function buildFilmPlan(ir: EditorialIR, report: CompileReport): FilmPlan {
  const scenes: FilmScene[] = [];

  for (const composed of report.composed) {
    const window = report.timing.scenes.find((s) => s.sceneId === composed.sceneId);
    const irScene = ir.scenes.find((s) => s.sceneId === composed.sceneId);
    const plan = report.shotPlans.find((s) => s.sceneId === composed.sceneId);

    // RECURSIVE, because a ground can carry a ground. The executor's
    // `buildChain` has always recursed into `b`; this conversion did not,
    // so an N-plane stack would have arrived at the browser with every
    // layer below the first silently amputated — the plan correct, the
    // film short two layers, and nothing anywhere saying so.
    const toFilmNode = (n: ComposedNode): FilmNode => ({
      id: n.primitiveId,
      params: n.params,
      seed: n.seed,
      ...(n.ground && n.ground.length > 0 ? { b: n.ground.map(toFilmNode) } : {}),
      // Carried, and carried RECURSIVELY — most of a scene's elements hang
      // off a compositor's B side, so a conversion that only copied the
      // top level would have delivered a bridge that reached one element.
      ...(n.tween && n.tweenMs
        ? { tween: n.tween, tweenMs: n.tweenMs, ...(n.tweenAtMs ? { tweenAtMs: n.tweenAtMs } : {}) }
        : {}),
    });
    const chain: FilmNode[] = composed.nodes.map(toFilmNode);

    // Zip the solver's cut windows against the shot planner's variations.
    // The two are computed independently and are the same length by
    // construction; if they ever are not, the WINDOW wins — a shot with no
    // variation is a shot that plays unstyled, which is recoverable, and a
    // variation with no window is a shot that never plays at all.
    const windows = window?.shots ?? [];
    const variations = plan?.shots ?? [];
    const shots: FilmShot[] = windows.map((w, i) => {
      const variation = variations[i];
      return {
        startMs: w.startMs,
        endMs: w.endMs,
        reason: w.reason,
        params: variation ? shotParams(chain, variation) : {},
      };
    });

    scenes.push({
      sceneId: composed.sceneId,
      actId: composed.actId,
      ...(composed.held ? { held: true } : {}),
      label: irScene?.label ?? "",
      text: irScene?.narration.text ?? "",
      startMs: window?.startMs ?? 0,
      endMs: window?.endMs ?? 0,
      tier: composed.tier,
      determinism: composed.determinism,
      costMsPerFrame: composed.costMsPerFrame,
      reasons: composed.nodes.map((n) => `${n.primitiveId} — ${n.reason}`),
      idea: composed.program,
      alternatives: composed.alternatives,
      chain,
      shots,
      promotion: promotionFor(report, composed.sceneId),
      world: composed.world,
      ...narrationFor(ir, irScene),
    });
  }

  const durationMs = scenes.reduce((max, s) => Math.max(max, s.endMs), 0);

  return {
    projectId: ir.projectId,
    title: ir.title,
    durationMs,
    ttsCalls: 0,
    determinism: report.determinism,
    peakCostMsPerFrame: report.peakCostMsPerFrame,
    colour: ir.cinematography.colour,
    scenes,
    timeline: {
      spine: report.timeline.spine,
      describes: report.timeline.describes,
      measuredMs: report.timeline.measuredMs,
      medianWordsPerMin: report.timeline.medianWordsPerMin,
      pauses: report.timeline.pauses.length,
      wordTimedScenes: report.timeline.wordTimedScenes,
    },
    warnings: report.warnings,
  };
}

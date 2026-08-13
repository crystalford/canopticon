// THE N-PLANE STACK — the scene plan, finally arranged in depth.
//
// WHAT THIS REPLACES. `ground.ts` gave the compiler a second input, which
// is the difference between "then" and "and". But there was exactly one
// slot, filled with exactly one primitive, so a scene plan that had found
// a SETTING *and* a COUNTERPOINT had to pick one of them and throw the
// other away — the same one-winner failure the plan was built to end,
// moved down a layer and made harder to see.
//
// So the plan reached pixels through two channels and no more: which
// construction was built, and which single primitive went in the ground
// slot. Everything richer it computed was inert.
//
// HOW A STACK IS EXPRESSED. Not as a new node kind — the executor already
// recurses. A compositor takes its upstream on one input and a GROUND, a
// chain of its own, on the other, and that ground may itself end in a
// compositor with a ground of its own. So an ordered stack is just that
// nesting, built from the far end in:
//
//   main chain     [ subject program … , layer_over ]
//                                          ground ↓
//   background     [ counterpoint program … , layer_over ]
//                                                ground ↓
//   deepest        [ setting program … ]
//
// Read outward, each compositor puts the DEEPER thing behind the nearer
// one. Read inward, it is a paint order. The rule that makes it correct is
// one line: a compositor's ground is the layer behind it, its upstream is
// the layer in front.
//
// WHY EACH LAYER IS A REAL CONSTRUCTION. `buildConstruction` is the same
// builder the subject uses. A `{ space: "plate_scene" }` table here would
// have been shorter and would have been a second implementation of the
// eight constructions — and two implementations of one rule is how the
// Lab and the Worker came to disagree about 57 of 88 scenes.
//
// WHAT THIS DOES NOT DO. It adds no semantic role, no primitive, and no
// director dial. It is the compositor catching up with what the planner
// already knew.

import { PRIMITIVES } from "../primitives/registry.ts";
import type { ComposedNode } from "./compose.ts";
import { type Beat, type Style, buildConstruction } from "./construct.ts";
import { type Plane, applyPlane } from "./scene-plan.ts";

/** The one two-input primitive an ordered depth stack wants.
 *
 *  `layer_over` and nothing else, on purpose. The other four compositors
 *  say something specific — a blend mode is a claim, a mask is redaction,
 *  the field pair reads numbers rather than pictures — and none of those
 *  is what "this is behind that" means. Choosing among them per layer
 *  would be the stack inventing rhetoric the plan never asked for. */
const STACK_COMPOSITOR = "layer_over";

export interface BuiltStack {
  /** What the main chain's compositor takes on its second input: the whole
   *  background, already nested and already ordered. */
  ground: ComposedNode[];
  /** Far to near, for the report. A director should be able to read the
   *  depth order of a shot without opening the chain. */
  layers: { role: string; from: string | null; depth: number; weight: number }[];
  /** Planes the frame budget could not pay for. Reported, never silent —
   *  a stack that renders two of three planes and says nothing is the
   *  same failure as a plan that reaches no pixels at all, only harder to
   *  spot because the picture looks plausible. */
  dropped: number;
}

/** Compose the background planes into one nested ground.
 *
 *  `planes` must be ordered FAR TO NEAR — `backgroundPlanes()` does that,
 *  and passing them any other way silently inverts the shot, so this does
 *  not re-sort and does not accept an unordered list as a convenience.
 *
 *  Returns null when nothing could be built, which is a real answer: a
 *  scene with no background plane is a single-plane shot and should
 *  compile exactly as it did before this file existed. */
export function buildStack(
  planes: Plane[],
  beat: Beat,
  style: Style,
  sceneIndex: number,
  base: Record<string, number>,
  /** What is left of the per-frame budget after the subject's own chain.
   *  A stack is N second chains and its cost is N times as real as a
   *  single ground's — `ground.ts` already refuses a ground it cannot
   *  afford, and a stack that skipped that check would be that rule
   *  quietly repealed by the thing built on top of it. */
  budgetMs: number,
): BuiltStack | null {
  // Built first, nested second. The two have to be separate passes
  // because affordability is decided across the whole stack and the
  // layer that gets dropped is the DEEPEST one — the least entitled to
  // the frame — and a single fold could only ever drop the last thing it
  // reached, which is the nearest.
  const built = planes
    .map((plane, depthIndex) => {
      const nodes = buildConstruction(plane.construction, beat, style);
      // A plane whose construction cannot be built is DROPPED, not
      // substituted. Standing rule 8: the scene still compiles, it just
      // compiles with one fewer layer.
      if (!nodes || nodes.length === 0) return null;
      return {
        plane,
        nodes: nodes.map<ComposedNode>((n, i) => ({
          primitiveId: n.primitiveId,
          // EVERY LAYER GETS ITS OWN WEIGHT AND DEPTH. This is the whole
          // reason the stack is worth having: previously the ground was a
          // bare primitive on the film's own averages, so a setting
          // weighted 0.28 and one weighted 0.70 painted the same plate.
          params: applyPlane(n.primitiveId, { ...base, ...n.params }, plane),
          // Seeded off the scene, the layer's depth position and the
          // node's position within it. Two layers seeded alike would move
          // in lockstep and read as one image with a double exposure —
          // the same reason the old single ground was offset into its own
          // range.
          seed: 7000 + sceneIndex * 17 + depthIndex * 211 + i,
          costMsPerFrame: PRIMITIVES[n.primitiveId]?.estimatedCostMsPerFrame ?? 4,
          reason: `${plane.role.toLowerCase()} plane at depth ${plane.depth.toFixed(2)} — ${n.reason}`,
        })),
      };
    })
    .filter((x): x is { plane: Plane; nodes: ComposedNode[] } => x !== null);

  // AFFORDABILITY, FROM THE NEAR END IN. Keep the nearest layer first and
  // admit deeper ones while they fit, so a film that cannot pay for three
  // planes loses its furthest one rather than its subject's own backdrop.
  // Reported as `dropped` rather than silently trimmed — a stack that
  // quietly renders two of three planes is the "looks finished from every
  // angle except the screen" failure again.
  const compositorCost = PRIMITIVES[STACK_COMPOSITOR]?.estimatedCostMsPerFrame ?? 4;
  const admitted: typeof built = [];
  let spend = compositorCost; // the main chain's own compositor
  for (let i = built.length - 1; i >= 0; i--) {
    const layer = built[i];
    if (!layer) continue;
    const cost =
      layer.nodes.reduce((n, x) => n + x.costMsPerFrame, 0) +
      (admitted.length > 0 ? compositorCost : 0);
    if (admitted.length > 0 && spend + cost > budgetMs) break;
    spend += cost;
    admitted.unshift(layer);
  }
  const dropped = built.length - admitted.length;

  let acc: ComposedNode[] | null = null;
  let below: Plane | null = null;
  const layers: BuiltStack["layers"] = [];

  admitted.forEach(({ plane, nodes }, depthIndex) => {
    const stage = [...nodes];
    if (acc && below) {
      // This layer is nearer than everything accumulated so far, so it
      // takes the accumulated stack on its second input and puts it
      // behind itself. The compositor's parameters come from the plane
      // BEING PUT BEHIND — see `applyPlane`'s `layer_over` case.
      stage.push({
        primitiveId: STACK_COMPOSITOR,
        params: applyPlane(STACK_COMPOSITOR, { ...base }, below),
        seed: 7500 + sceneIndex * 17 + depthIndex,
        costMsPerFrame: compositorCost,
        reason: `${below.role.toLowerCase()} sits behind ${plane.role.toLowerCase()}`,
        ground: acc,
      });
    }
    acc = stage;
    below = plane;
    layers.push({ role: plane.role, from: plane.from, depth: plane.depth, weight: plane.weight });
  });

  if (!acc) return null;
  return { ground: acc, layers, dropped };
}

/** The compositor the MAIN chain appends to put the whole background
 *  behind its subject, and the parameters it needs.
 *
 *  Separate from `buildStack` because the main chain owns its own node
 *  construction — cost, seed range and reason all come from `compose.ts`'s
 *  own accounting there, and returning a half-built node for it to patch
 *  would put the same arithmetic in two places. */
export function stackCompositor(nearest: Plane, base: Record<string, number>) {
  return {
    primitiveId: STACK_COMPOSITOR,
    params: applyPlane(STACK_COMPOSITOR, { ...base }, nearest),
  };
}

/** Every node in a stack, flattened, at any nesting depth.
 *
 *  Cost, determinism, palette usage and the cache all have to see a nested
 *  ground as real work. Before the stack existed a ground was one level
 *  deep and every one of those consumers walked exactly one level — which
 *  would have made a three-layer scene report the cost of a two-layer one
 *  and hash identically when its deepest layer changed. That is the
 *  quiet-arithmetic failure the ground's own comments already name; this
 *  is the function that stops the stack repeating it. */
export function flattenGround(nodes: ComposedNode[] | undefined): ComposedNode[] {
  if (!nodes || nodes.length === 0) return [];
  const out: ComposedNode[] = [];
  for (const n of nodes) {
    out.push(n);
    out.push(...flattenGround(n.ground));
  }
  return out;
}

// FILM MODE — what kind of continuity this film has.
//
// The correction this file exists for: `allowCut: false` is NECESSARY
// AND NOT SUFFICIENT. Forbidding the cut only says what the film may not
// do. A one shot is not a film with the cuts removed — it is a film
// whose visual state is CONTINUOUSLY EVOLVING, where the change from one
// semantic idea to the next happens THROUGH the world rather than
// between two versions of it.
//
//     NOT ENOUGH        state A → state B, with cutting forbidden
//     THE CAPABILITY    state A → A' → A'' → B, identity intact throughout
//
// So the mode does two things. It decides which continuity decisions are
// LEGAL, and it decides whether a change of state is BRIDGED — resolved
// into intermediate states the film actually passes through.
//
//     Film
//       ├── mode
//       ├── timeline
//       ├── persistent identities      film-state.ts
//       ├── scene state                scene-graph.ts
//       ├── temporal grammar           scene-graph.ts (choreography)
//       ├── camera                     scene-graph.ts (observe)
//       └── presentation               the renderer
//
// ONE UNDERLYING GRAMMAR. There is no one-shot renderer, no one-shot
// scene graph and no one-shot vocabulary. The modes are constraints and
// bridging policies over the same machinery, which is the whole reason
// a hybrid film is expressible at all.

import {
  type Advance,
  type Continuity,
  type ContinuityRules,
  type FilmState,
  advance,
} from "./film-state.ts";
import type { Element, SceneGraph } from "./scene-graph.ts";
import type { SemanticScene } from "./semantic-scene.ts";

export type FilmMode = "CUT" | "ONE_SHOT" | "MONTAGE" | "HYBRID";

export interface ModeSpec {
  /** Which continuity decisions this mode permits. A decision absent
   *  here is not merely discouraged — the film cannot make it. */
  legal: Continuity[];
  /** How many intermediate states a change of state is resolved into.
   *  1 means the film goes straight there, which is what a cut does even
   *  when it is not called one. */
  bridge: number;
  rules: ContinuityRules;
  describes: string;
}

const ALL: Continuity[] = [
  "CONTINUE",
  "TRANSFORM",
  "ACCUMULATE",
  "SPLIT",
  "MERGE",
  "ENTER",
  "EXIT",
  "RECALL",
  "CUT",
];

/** WITHOUT `CUT`. Everything a film can do to a state that is not
 *  discarding it — which is the entire vocabulary a one shot has to
 *  solve an essay with. */
const CONTINUOUS: Continuity[] = ALL.filter((c) => c !== "CUT");

export const MODES: Record<FilmMode, ModeSpec> = {
  /** Conventional. A scene may end and another may begin. */
  CUT: {
    legal: ALL,
    bridge: 1,
    rules: { allowCut: true, memory: 8 },
    describes: "scenes may terminate and new scenes may begin",
  },

  /* ONE CONTINUOUS VISUAL STATE.
   *
   * The cut is illegal and — the part that matters — every change is
   * BRIDGED into intermediate states. A completely different semantic
   * situation is still reachable; it is reached by passing through the
   * world rather than by replacing it. Memory is long because a film
   * that never cuts should be able to recall something from much
   * earlier: that recall IS the continuity. */
  ONE_SHOT: {
    legal: CONTINUOUS,
    bridge: 4,
    rules: { allowCut: false, memory: 64 },
    describes: "one continuous state; the world changes rather than being replaced",
  },

  /** Deliberate fracture. Cutting is the point, and bridging would blunt
   *  it — a montage that eases between its images is not a montage. */
  MONTAGE: {
    legal: ALL,
    bridge: 1,
    rules: { allowCut: true, memory: 3 },
    describes: "cuts are expected, and may be rapid",
  },

  /** Continuous passages punctuated by deliberate cuts. Both are
   *  available; the film chooses per transition, which is only
   *  expressible because the modes are constraints over one grammar. */
  HYBRID: {
    legal: ALL,
    bridge: 3,
    rules: { allowCut: true, memory: 24 },
    describes: "continuous passages, punctuated where a cut is earned",
  },
};

/** Advance the film under a mode. Illegal decisions are not silently
 *  dropped — a mode that forbids the cut must make `advance` unable to
 *  take one, which is why the rules travel with the spec. */
export function step(
  mode: FilmMode,
  state: FilmState,
  sem: SemanticScene,
  elements: Element[],
): Advance {
  const spec = MODES[mode];
  const out = advance(state, sem, elements, spec.rules);
  const illegal = out.decisions.filter((d) => !spec.legal.includes(d.what));
  if (illegal.length > 0) {
    // Never observed in practice — `advance` already honours `allowCut`.
    // Kept because a mode whose constraint can be violated silently is
    // not a constraint, and a future decision kind added to the
    // vocabulary should fail loudly here rather than leak into a one
    // shot.
    throw new Error(
      `${mode} does not permit ${[...new Set(illegal.map((d) => d.what))].join(", ")}`,
    );
  }
  return out;
}

/* ── BRIDGING: THE PART THAT IS NOT A FLAG ────────────────────────────
 *
 * A change of state resolved into the states the film actually passes
 * through. Identity is what makes this possible and what makes it mean
 * something: an element present in both ends MORPHS — its place, scale
 * and depth carry continuously from one to the other — while an element
 * present in only one FADES IN OR OUT by scale, so it arrives or leaves
 * through the world instead of appearing between two frames.
 *
 * This is the difference between a one shot and a film with the cuts
 * removed. Without it, forbidding the cut produces a slideshow that is
 * merely not allowed to say so.
 */
export interface Bridged {
  states: SceneGraph[];
  describes: string;
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

/** Identity for bridging. Elements carry no id of their own, so the role
 *  plus the operation list is what says "this is the same thing" — two
 *  elements that do the same job with the same operations are the same
 *  element wearing different numbers. */
const key = (e: Element) => `${e.role}:${e.ops.join(">")}`;

export function bridge(from: SceneGraph, to: SceneGraph, mode: FilmMode): Bridged {
  const steps = MODES[mode].bridge;
  if (steps <= 1) {
    return { states: [to], describes: "straight there" };
  }
  const fromBy = new Map(from.elements.map((e) => [key(e), e]));
  const toBy = new Map(to.elements.map((e) => [key(e), e]));
  const states: SceneGraph[] = [];
  let morphed = 0;
  let arriving = 0;
  let leaving = 0;

  for (let s = 1; s <= steps; s++) {
    const t = ease(s / steps);
    const elements: Element[] = [];

    for (const [k, b] of toBy) {
      const a = fromBy.get(k);
      if (a) {
        // PRESENT IN BOTH — it carries. Nothing is destroyed and nothing
        // is recreated; the same element is somewhere else now.
        if (s === 1) morphed++;
        elements.push({
          ...b,
          place: {
            scale: mix(a.place.scale, b.place.scale, t),
            x: mix(a.place.x, b.place.x, t),
            y: mix(a.place.y, b.place.y, t),
            crop: t > 0.5 ? b.place.crop : a.place.crop,
          },
          depth: mix(a.depth, b.depth, t),
        });
        continue;
      }
      // ARRIVING — grows into presence rather than appearing.
      if (s === 1) arriving++;
      elements.push({ ...b, place: { ...b.place, scale: b.place.scale * Math.max(0.04, t) } });
    }

    for (const [k, a] of fromBy) {
      if (toBy.has(k)) continue;
      // LEAVING — thins out of presence. Gone by the last state, so the
      // film arrives at `to` exactly rather than approximately.
      if (s === 1) leaving++;
      const g = 1 - t;
      if (g < 0.04) continue;
      elements.push({ ...a, place: { ...a.place, scale: a.place.scale * g } });
    }

    elements.sort((x, y) => x.depth - y.depth);
    states.push({ elements, describes: `${to.describes} · bridging ${s}/${steps}` });
  }

  return {
    states,
    describes: `${morphed} carried · ${arriving} arriving · ${leaving} leaving, over ${steps} states`,
  };
}

/** THE CAMERA, CONTINUOUS. A one shot may move the camera as far as it
 *  likes — a viewer can end up somewhere that looks like a different
 *  place entirely — provided it travels rather than jumps. */
export function bridgeCamera(
  from: { zoom: number; x: number; y: number; parallax: number },
  to: { zoom: number; x: number; y: number; parallax: number },
  mode: FilmMode,
) {
  const steps = MODES[mode].bridge;
  const out = [];
  for (let s = 1; s <= steps; s++) {
    const t = ease(s / steps);
    out.push({
      zoom: mix(from.zoom, to.zoom, t),
      x: mix(from.x, to.x, t),
      y: mix(from.y, to.y, t),
      parallax: mix(from.parallax, to.parallax, t),
    });
  }
  return out;
}

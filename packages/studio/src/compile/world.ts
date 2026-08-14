// THE WORLD — the film's persistent state, connected.
//
// `film-state.ts` and `film-mode.ts` were written in full and imported by
// nothing. `advance()`, `step()`, `bridge()`, `present()` — the whole
// continuity vocabulary, and the production path reached none of it. Every
// scene therefore composed its picture from nothing, which is why a film is
// currently 36 independent animations rather than one thing that changes.
// This file is the caller they never had.
//
// It does exactly three things, in this order, once per scene:
//
//     1. BUILD    the scene graph the sentence implies
//     2. ADVANCE  the film's state through it — who continues, who enters,
//                 who is recalled, what accumulates
//     3. BRIDGE   the change into a continuous move, in the measured
//                 silence at the head of the scene
//
// Two decisions in here are worth stating rather than reading out of the
// code, because both were tempting to get wrong:
//
// THE STATE ADVANCES ONCE PER SCENE, NOT ONCE PER CANDIDATE. The
// constructor builds many candidate programs and keeps one. Advancing the
// film inside a candidate would advance it once for every candidate that
// LOST, so the state is stepped here — above the constructor — and the
// result is handed down.
//
// CONTINUITY IS A FACT ABOUT ENTITIES, NOT ABOUT PIXELS. `film-state.ts`
// says so in its own header and it is what makes this survive a change of
// representation: a scene the film draws as a body rather than as a scene
// graph still names the same city, and the city is still the same city.
// So the state advances for every scene, and the INHERITED PLACES are used
// by the scene construction when it wins. A film that only remembered the
// scenes it happened to draw one particular way would have no memory at
// all — it would have a habit.

import { type FilmMode, MODES, bridge, elementKey, step } from "./film-mode.ts";
import { type Advance, EMPTY_FILM, type FilmState } from "./film-state.ts";
import type { Material } from "./grammar-visual.ts";
import type { Representation } from "./represent.ts";
import { type SceneGraph, composeFromMeaning } from "./scene-graph.ts";
import { type SemanticScene, readScene } from "./semantic-scene.ts";

export { EMPTY_FILM };

/** A tween on one primitive's live params: `{param: [from, to]}`, read by
 *  the chain executor and applied without rebuilding the chain. This is
 *  what makes a one shot a journey rather than a slideshow that is
 *  forbidden to cut. */
export type Tween = Record<string, [number, number]>;

export interface SceneWorld {
  /** What to draw: the persistent elements in their inherited places, plus
   *  this scene's own scenery. */
  graph: SceneGraph;
  material: Material;
  sem: SemanticScene;
  advance: Advance;
  /** How the world gets from the last scene to this one, per element key.
   *  Empty in CUT and MONTAGE, where arriving instantly is the point. */
  tweens: Map<string, Tween>;
  /** How long the bridge runs. Comes off the measured pause in the
   *  narration — see `bridgeMsFor` in narrate/timeline.ts. */
  bridgeMs: number;
  describes: string;
}

export interface WorldInputs {
  state: FilmState;
  mode: FilmMode;
  sentence: string;
  subjects: Parameters<typeof readScene>[1];
  relation: Parameters<typeof readScene>[2];
  count: number | null;
  phrase: string;
  noun: string;
  density: number;
  energy: number;
  abstraction: number;
  typography: number;
  seed: number;
  rep: Representation | null;
  /** The graph the previous scene actually left on screen, for bridging.
   *  Null on the first scene, which arrives rather than travels. */
  previous: SceneGraph | null;
  bridgeMs: number;
}

/** The same identity `film-mode.ts`'s `bridge` uses — imported rather than
 *  restated, because if the two ever disagreed the bridge would silently
 *  stop carrying anything and the film would look like it had no memory.
 *  Elements carry no id of their own, so the role plus the operation list
 *  is what says "this is the same thing". */
const key = elementKey;

/** ADVANCE THE WORLD ONE SCENE. Pure — call it as often as you like; only
 *  the caller that adopts `advance.state` moves the film. */
export function stepWorld(input: WorldInputs): SceneWorld {
  const sem = readScene(input.sentence, input.subjects, input.relation, input.count);
  const material: Material = {
    noun: input.noun,
    phrase: input.phrase,
    count: input.count,
    relation: null,
    density: input.density,
    energy: input.energy,
    abstraction: input.abstraction,
    typography: input.typography,
    seed: input.seed,
  };
  const fresh = composeFromMeaning(input.rep?.mode ?? "literal", material, sem);

  /* THE STEP. `step` throws when a mode is asked for a decision it forbids
   * — that is the constraint being real rather than advisory. It has never
   * fired in practice, because `advance` already honours `allowCut`, and a
   * film is not the place to find out. Degrade, flag, continue (standing
   * rule 8): a world that cannot advance falls back to composing fresh,
   * which is exactly what every scene did before this file existed. */
  let adv: Advance;
  try {
    adv = step(input.mode, input.state, sem, fresh.elements);
  } catch (e) {
    return {
      graph: fresh,
      material,
      sem,
      advance: {
        state: { ...input.state, sceneIndex: input.state.sceneIndex + 1 },
        decisions: [],
        cut: true,
        describes: `continuity refused — ${(e as Error).message}`,
        elements: fresh.elements,
      },
      tweens: new Map(),
      bridgeMs: 0,
      describes: `composed fresh — ${(e as Error).message}`,
    };
  }

  const graph: SceneGraph = { elements: adv.elements, describes: fresh.describes };

  /* THE BRIDGE. `bridge()` resolves the change into the states the film
   * actually passes through; what a browser chain can execute is the
   * ENDPOINTS of that move applied to live params, so the intermediate
   * states are collapsed into a from→to per element. Same computation,
   * expressed as something the renderer can run without rebuilding a chain
   * and resetting every particle in it.
   *
   * Only in a mode that bridges. `MODES[mode].bridge <= 1` means "go
   * straight there", which is what a cut does even when it is not called
   * one, and easing into a montage would blunt the only thing a montage
   * is for. */
  const tweens = new Map<string, Tween>();
  let bridgeMs = 0;
  if (input.previous && MODES[input.mode].bridge > 1 && input.bridgeMs > 0) {
    const was = new Map(input.previous.elements.map((e) => [key(e), e]));
    const bridged = bridge(input.previous, graph, input.mode);
    for (const e of graph.elements) {
      const k = key(e);
      const from = was.get(k);
      if (from) {
        // PRESENT IN BOTH — it carries. Nothing is destroyed and nothing
        // is recreated; the same element is somewhere else now.
        //
        // Only the channels that actually MOVED. A tween of 0.5 → 0.5 is
        // not a move, and emitting it would put an inert entry in the plan
        // and in the hash — so a scene where nothing travelled would look,
        // to every consumer downstream, exactly like one where it did.
        const moved: Tween = {};
        if (!near(from.place.x, e.place.x)) moved.x = [from.place.x, e.place.x];
        if (!near(from.place.y, e.place.y)) moved.y = [from.place.y, e.place.y];
        if (!near(from.place.scale, e.place.scale)) moved.scale = [from.place.scale, e.place.scale];
        if (Object.keys(moved).length > 0) tweens.set(k, moved);
        continue;
      }
      // ARRIVING — grows into presence rather than appearing.
      tweens.set(k, { scale: [Math.max(0.04, e.place.scale * 0.12), e.place.scale] });
    }
    bridgeMs = tweens.size > 0 ? input.bridgeMs : 0;
    if (tweens.size > 0) {
      return {
        graph,
        material,
        sem,
        advance: adv,
        tweens,
        bridgeMs,
        describes: `${adv.describes} · ${bridged.describes}`,
      };
    }
  }

  return { graph, material, sem, advance: adv, tweens, bridgeMs, describes: adv.describes };
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.004;

/** Which mode this film is in. The Create screen's "How it moves" writes
 *  `continuity` onto the IR; the four values it can hold map to the four
 *  modes, and anything else is a CUT film — the conventional default, and
 *  what every film composed before this existed already was. */
export function modeOf(continuity: string | undefined | null): FilmMode {
  switch (continuity) {
    case "oneshot":
      return "ONE_SHOT";
    case "montage":
      return "MONTAGE";
    case "hybrid":
      return "HYBRID";
    default:
      return "CUT";
  }
}

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

import type { Act } from "./act.ts";
import type { Camera } from "./camera.ts";
import { type FilmMode, MODES, bridge, elementKey, step } from "./film-mode.ts";
import { type Advance, type ContinuityRead, EMPTY_FILM, type FilmState } from "./film-state.ts";
import type { Material } from "./grammar-visual.ts";
import type { Representation } from "./represent.ts";
import {
  type Element,
  type SceneGraph,
  at,
  choreograph,
  choreographAct,
  composeFromMeaning,
  observe,
} from "./scene-graph.ts";
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
   *  narration — see `bridgeMsFor` in narrate/timeline.ts. Zero when the
   *  scene is MOVING instead: there is one tween channel per node and a
   *  move outranks a bridge, and reporting a move as a bridge would make
   *  both illegible. A montage still never bridges. */
  bridgeMs: number;
  /** How long the MOVE runs — the whole scene, because a move is what the
   *  scene does. Zero when the scene is bridging or standing still. */
  moveMs: number;
  /** Where the camera stands after this scene. Already baked into
   *  `graph`'s element places via `observe()` — carried here so the next
   *  scene's `advanceCamera()` has somewhere to move on from, and so a
   *  future consumer can ask what the camera is doing without
   *  re-deriving it from place deltas. */
  camera: Camera;
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
  /** Carried through to the grammar's Material — the SHIVER is read off
   *  them. See `grammar-visual.ts`. */
  experimentalism?: number;
  restraint?: number;
  seed: number;
  /** What this moment earned, and when it is spoken — see `promote.ts`. */
  level?: number;
  register?: string;
  enterAtMs?: number | null;
  holdMs?: number | null;
  rep: Representation | null;
  /** The graph the previous scene actually left on screen, for bridging.
   *  Null on the first scene, which arrives rather than travels. */
  previous: SceneGraph | null;
  bridgeMs: number;
  /** WHAT THE SCENE SAID, read without the noun lexicon — the act, and
   *  the passage to carry when the prose named nothing. Both exist because
   *  the continuity model's own two inputs are lexicon-derived and an
   *  essay of ideas satisfies neither. See `film-state.ts`. */
  read?: ContinuityRead | undefined;
  /** How long this scene lasts. The MOVE runs across it, where the bridge
   *  runs only in the measured silence at its head. */
  sceneMs?: number | undefined;
}

/** The same identity `film-mode.ts`'s `bridge` uses — imported rather than
 *  restated, because if the two ever disagreed the bridge would silently
 *  stop carrying anything and the film would look like it had no memory.
 *  Elements carry no id of their own, so the role plus the operation list
 *  is what says "this is the same thing". */
const key = elementKey;

/* ── THE CAMERA'S OWN GRAMMAR ──────────────────────────────────────────
 *
 * `Camera`, `CAMERA_STILL` and `observe()` (`scene-graph.ts`) were fully
 * written and had zero production callers — confirmed by grep, and
 * `act.ts`'s own comment says why: "nothing carries a Camera on the world
 * state." It does now (`FilmState.camera`), and this is the one place
 * that decides what an ACT does to it, per standing rule 9 — a director
 * asking for INTENSIFY gets the same camera answer whether the winning
 * construction is a body, a chart or type.
 *
 * SMALL AND BOUNDED, on purpose. `MOTION_CHARACTER` in `construct.ts` is
 * the direct precedent — one entry per act, deliberately not exhaustive,
 * SUSTAIN and NONE get nothing at all because the absence of camera
 * movement is a reading too, same as the absence of authored motion is
 * there. A camera that moves on every act reads as nervous, not directed.
 *
 * `parallax` decays toward the new act's own rather than holding the old
 * one, because parallax is how strongly THIS move separates the planes —
 * carrying forward the previous act's separation would let one CONTRAST
 * cut's parallax bleed into an unrelated QUALIFY three scenes later. */
const CAMERA_DELTA: Partial<Record<Act, { zoom: number; parallax: number }>> = {
  DECLARE: { zoom: 0.04, parallax: 0.06 },
  INTENSIFY: { zoom: 0.09, parallax: 0.1 },
  CONTRAST: { zoom: 0.07, parallax: 0.14 },
  ACCUMULATE: { zoom: 0.03, parallax: 0.04 },
  WITHDRAW: { zoom: -0.12, parallax: 0.08 },
  CONVERGE: { zoom: -0.04, parallax: 0.02 },
  QUALIFY: { zoom: -0.05, parallax: 0.01 },
  REVEAL: { zoom: 0.05, parallax: 0.08 },
  TRANSFORM: { zoom: 0.02, parallax: 0.12 },
  RECALL: { zoom: 0.03, parallax: 0.05 },
};

const CAMERA_ZOOM_MIN = 0.82;
const CAMERA_ZOOM_MAX = 1.55;

/** Where the camera stands after this scene's act.
 *
 *  Holds still — returns `camera` unchanged — on SUSTAIN, NONE, or no
 *  act reading at all, matching `MOTION_CHARACTER`'s own omissions.
 *
 *  WHAT IT LOOKS AT: the highest-emphasis element still on screen, so a
 *  push-in or a pull-wide is observing something rather than drifting
 *  toward an arbitrary point. Eased a third of the way there per scene,
 *  not jumped — a run of scenes about the same thing settles rather than
 *  snapping, the same discipline `advance()`'s own place-inheritance
 *  uses for CONTINUE. */
function advanceCamera(camera: Camera, act: Act | undefined, elements: Element[]): Camera {
  const delta = act ? CAMERA_DELTA[act] : undefined;
  if (!delta) return camera;

  const zoom = Math.min(CAMERA_ZOOM_MAX, Math.max(CAMERA_ZOOM_MIN, camera.zoom + delta.zoom));
  const parallax = Math.min(1, Math.max(0, delta.parallax));

  const focus = [...elements].sort((a, b) => (b.emphasis ?? 0) - (a.emphasis ?? 0))[0];
  const targetX = focus ? focus.place.x : 0.5;
  const targetY = focus ? focus.place.y : 0.5;
  const x = camera.x + (targetX - camera.x) * 0.34;
  const y = camera.y + (targetY - camera.y) * 0.34;

  return { zoom, x, y, parallax };
}

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
    // The shiver is read off these — a world scene should not sit still
    // while a cut scene in the same film boils. See `grammar-visual.ts`.
    ...(input.experimentalism !== undefined ? { experimentalism: input.experimentalism } : {}),
    ...(input.restraint !== undefined ? { restraint: input.restraint } : {}),
    seed: input.seed,
    ...(input.level !== undefined ? { level: input.level } : {}),
    ...(input.register !== undefined ? { register: input.register } : {}),
    ...(input.enterAtMs !== undefined ? { enterAtMs: input.enterAtMs } : {}),
    ...(input.holdMs !== undefined ? { holdMs: input.holdMs } : {}),
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
    adv = step(input.mode, input.state, sem, fresh.elements, input.read ?? {});
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
      moveMs: 0,
      // Continuity refused, so the camera holds where it was too — this
      // scene composed fresh, and a camera move over a picture the world
      // itself was refused would be observing a lie.
      camera: input.state.camera,
      describes: `composed fresh — ${(e as Error).message}`,
    };
  }

  /* THE CAMERA REACHES THE FRAME THROUGH `observe()`, THE SAME PATH THE
   * PLACE PRIMITIVE ALREADY READS.
   *
   * `chain.js` only lets ONE param be live-tweened between two values —
   * `place`'s x/y/scale, because only `place` reads its params inside
   * `frame()` rather than capturing them at construction time. So the
   * camera cannot invent a new primitive or a second tween channel; it
   * has to arrive as a transform ALREADY BAKED into the elements'
   * `place`, before `serialiseScene` ever turns them into node params.
   * `observe()` is exactly that transform, and applying it here — before
   * anything downstream sees `graph` — is the one call site that makes
   * it real instead of dead code.
   *
   * This also gets camera MOTION for free across a bridge, with no
   * second mechanism: the bridge below tweens `elementKey`-matched
   * elements between `input.previous` (last scene's graph, camera
   * already baked in from ITS call to `observe()`) and this scene's
   * `graph` (this scene's camera baked in). Two static camera views,
   * compared like any other place change, read as one camera move. */
  const nextCamera = advanceCamera(input.state.camera, input.read?.act, adv.elements);
  const graph: SceneGraph = observe(
    { elements: adv.elements, describes: fresh.describes },
    nextCamera,
  );

  /* THE MOVE — the temporal grammar, connected.
   *
   * `choreograph`, `at` and the eight moves in `scene-graph.ts` are the
   * most directly cinematic code in this package and they have ZERO
   * callers, including tests. Their gate is `sem.relations[0]`, and a
   * relation needs two lexicon-known nouns, so an essay could not reach
   * them. `REVERSE` — the element crossing to the place its counterpart
   * held, which is what an argument turning around looks like — was
   * emitted for no relation at all, so it was unreachable twice over.
   *
   * WHAT MAKES THIS A WIRE RATHER THAN A RENDERER PROJECT. `at()` returns
   * the scene graph AT A MOMENT, and the renderer cannot execute a graph
   * per frame — rebuilding a chain resets every particle in it. But the
   * chain executor already lerps a node's live params between two values,
   * with the same smoothstep `at()` eases with. So the move ships as its
   * own ENDPOINTS: `at(g, 0)` and `at(g, 1)`, resolved into the from→to
   * per element that the bridge channel already carries. One
   * implementation of the moves, sampled rather than reimplemented.
   *
   * IDENTITY IS `elementKey`, the same role+ops the bridge uses. An
   * element that `at()` removed at t=1 — a DISSOLVE completing — has no
   * endpoint, so it thins to nothing instead, which is the same event
   * expressed in the one channel available.
   *
   * ACROSS THE WHOLE SCENE, unlike the bridge: a move is what the scene
   * DOES, where a bridge is how it arrived. And in any mode — a cut film
   * still has scenes, and forbidding a scene to move because the film
   * does not glide between them would confuse two different things. */
  const moves = new Map<string, Tween>();
  let moveMs = 0;
  let moveDescribes = "";
  const act = input.read?.act;
  if (act && (input.sceneMs ?? 0) > 0) {
    const ch = sem.relations[0] ? choreograph(graph, sem) : choreographAct(graph, act, sem.negated);
    moveDescribes = ch.describes;
    if (Object.keys(ch.moves).length > 0) {
      const from = new Map(at(graph, ch, 0).elements.map((e) => [key(e), e]));
      const to = new Map(at(graph, ch, 1).elements.map((e) => [key(e), e]));
      for (const [k, a] of from) {
        const b = to.get(k);
        const moved: Tween = {};
        if (!b) {
          // It did not survive its own move. The one thing the executor
          // can express is that it is no longer there.
          moved.scale = [a.place.scale, 0.02];
        } else {
          if (!near(a.place.x, b.place.x)) moved.x = [a.place.x, b.place.x];
          if (!near(a.place.y, b.place.y)) moved.y = [a.place.y, b.place.y];
          if (!near(a.place.scale, b.place.scale)) moved.scale = [a.place.scale, b.place.scale];
        }
        if (Object.keys(moved).length > 0) moves.set(k, moved);
      }
      if (moves.size > 0) moveMs = input.sceneMs ?? 0;
    }
  }

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
   * is for.
   *
   * AND THE MOVE OUTRANKS IT. There is one tween channel per node, so a
   * scene that both arrives and acts has to choose. A bridge says "get
   * from where you were to where you are"; a move says "and then do this".
   * The second is the more meaningful motion, and the first only exists in
   * ONE_SHOT and HYBRID with narration, so in an ordinary film the move
   * has the channel to itself and nothing is being given up. */
  const tweens = new Map<string, Tween>();
  let bridgeMs = 0;
  if (moves.size > 0) {
    return {
      graph,
      material,
      sem,
      advance: adv,
      tweens: moves,
      bridgeMs: 0,
      moveMs,
      camera: nextCamera,
      describes: `${adv.describes} · ${moveDescribes}`,
    };
  }
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
        moveMs: 0,
        camera: nextCamera,
        describes: `${adv.describes} · ${bridged.describes}`,
      };
    }
  }

  return {
    graph,
    material,
    sem,
    advance: adv,
    tweens,
    bridgeMs,
    moveMs: 0,
    camera: nextCamera,
    describes: adv.describes,
  };
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

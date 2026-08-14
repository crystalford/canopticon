// THE GROUND — the second input a scene is composited over.
//
// A chain is a line: node[0] hands its buffer to node[1]. That expresses
// one relation, "then", and it is why the compiler's own honesty measure
// reported that roughly half of a real film's chain links were a source
// painting over the stage before it. `noise_field → text_layout` is not
// text on a noise field. It is a noise field that got covered up, at full
// cost, invisibly.
//
// The other relation is AND, and it needs a second input. A compositor
// takes the chain's own image on one side and a GROUND — its own small
// chain, run on the same clock — on the other. `field_displace` over a
// `gravity_field` is the thing the palette could describe and could not
// say: a field and a sentence at once, where the field moves the letters.
//
// WHEN THE ENGINE REACHES FOR ONE. Not always, and never as decoration.
// The rules below are the Constitution's own parameters doing the
// choosing — abstraction rung, motion energy, visual density, restraint —
// so a ground is something the film's curve asks for, not a look someone
// stapled on. Three specific refusals, each for a stated reason:
//
//   A CONTESTED LINE GETS NO FIELD. Standing discipline in this compiler:
//   a claim is never dramatised into looking like a finding. Erosion and
//   displacement are the two most rhetorical operations in the palette,
//   so a scene reporting an attributed claim is held flat.
//
//   A PINNED SCENE GETS NOTHING. A pin bypasses composition entirely
//   (precedence 1). Adding a ground under it would be the engine editing
//   a director's decision.
//
//   RESTRAINT IS A REAL CEILING. High restraint means the ground is not
//   proposed at all, rather than proposed and dimmed.

import { PRIMITIVES, chainCost } from "../primitives/registry.ts";
import type { Rung } from "./compose.ts";

export interface GroundPlan {
  /** The two-input primitive that does the combining. */
  compositor: string;
  /** Its own chain, rendered on the same clock and handed to the
   *  compositor's second input. */
  ground: string[];
  params: Record<string, number>;
  reason: string;
}

export interface GroundInputs {
  chain: string[];
  tier: Rung["tier"];
  density: number;
  motionEnergy: number;
  experimentalism: number;
  restraint: number;
  contested: boolean;
  pinned: boolean;
  sceneIndex: number;
  /** What is left of the per-frame budget after the subject's own chain.
   *  A ground is a whole second chain and its cost is real. */
  budgetMs: number;
  /** WHAT THIS FILM IS MADE OF. A picture ground is an atmosphere, and a
   *  text-driven film's atmosphere is not a reaction-diffusion plate. */
  approach?: string;
}

/** Above this, the director has asked for restraint and a second layer is
 *  not restraint. */
const RESTRAINT_CEILING = 0.72;
/** Below this there is not enough density on screen for a ground to read
 *  as depth rather than as noise behind a caption. */
const DENSITY_FLOOR = 0.42;

/** Grounds that emit a real FIELD — the two field compositors read their
 *  numbers, so nothing else will do. */
const FIELD_GROUNDS = ["gravity_field", "noise_field"];
/** Grounds that are simply another picture. Rotated by scene index so
 *  neighbouring scenes do not sit on the same bed — derived, never
 *  random. */
const PICTURE_GROUNDS = ["cellular", "reaction_diffusion", "plate_scene", "noise_field"];

/** Decide whether this scene wants a ground, and which.
 *
 *  Returns null far more often than not, which is the intended ratio: a
 *  film where every scene is two layers deep is a film with no dynamics. */
export function planGround(input: GroundInputs): GroundPlan | null {
  if (input.pinned) return null;
  if (input.restraint > RESTRAINT_CEILING) return null;
  /* A TEXT FILM'S GROUND IS NOT A PICTURE.
   *
   * Measured, on the frames: two of eight scenes of a text-driven film
   * were full-bleed reaction-diffusion, and the sentence the argument
   * turns on rendered as a cityscape with no words in it. Not a
   * compositing bug — `opacity` and `sink` are doing exactly what they
   * are set to. It is a COMPOSITION decision, and it was being made by a
   * planner that had never been told what the film is made of.
   *
   * Refused rather than quietened, because quietening it is the thing
   * that has already been tried twice. A film whose material is the
   * writing composes its depth out of its own marks; an atmosphere plate
   * behind type is a different film. `world` and `hybrid` keep it — for
   * them it is exactly right. */
  if (input.approach === "text") return null;

  // There has to be something to composite. A compositor's first input is
  // the previous stage's CANVAS — every primitive paints one, which is why
  // canChain lets a compositor follow anything — so the only real
  // requirement is that a stage came before it.
  const last = input.chain[input.chain.length - 1];
  if (!last || !PRIMITIVES[last]) return null;

  const pick = <T>(list: T[]): T => list[input.sceneIndex % list.length] as T;

  // DISSOLVED, and the sentence is not a claim: the image comes apart in
  // the shape of the field acting on it. This is the rung's own name made
  // literal — until now DISSOLVED meant "a chain of particle primitives",
  // which is a description of the parts rather than of what happens.
  if (input.tier === "DISSOLVED" && !input.contested) {
    return affordable(
      {
        compositor: "field_erode",
        ground: ["noise_field"],
        params: { depth: 0.55 + input.experimentalism * 0.3, grain: 0.35, sweep: 1 },
        reason: "DISSOLVED — the image is eaten in the shape of the field acting on it",
      },
      input,
    );
  }

  // Decomposed and moving: the field pulls the picture. A gravity field
  // and a sentence, where the pull genuinely moves the letters.
  if (input.tier === "DECOMPOSED" && input.motionEnergy > 0.5 && !input.contested) {
    return affordable(
      {
        compositor: "field_displace",
        ground: [pick(FIELD_GROUNDS)],
        params: {
          amount: 0.25 + input.motionEnergy * 0.45,
          tile: 0.35,
          progress: 0.6,
        },
        reason: `DECOMPOSED at motion ${input.motionEnergy.toFixed(2)} — the field moves the image rather than being painted over by it`,
      },
      input,
    );
  }

  // Dense enough to want depth: the ground sits behind and stays visible.
  // The plainest of the compositors and the one that repays the debt —
  // this is exactly the link the honesty measure was counting as
  // decorative when the same two primitives were stacked in a line.
  if (input.density > DENSITY_FLOOR) {
    return affordable(
      {
        compositor: "layer_over",
        ground: [pick(PICTURE_GROUNDS)],
        params: {
          /* A GROUND IS BEHIND. It is not a second subject.
           *
           * This ran to 0.65 at high density, and once the scanline stopped
           * banding the frame that loudness became the thing you saw: a
           * reaction-diffusion backdrop competing with the sentence set
           * over it, so "EASY READ" was harder to read than before the
           * treatment was softened. A ground's job is depth — present,
           * placing the subject in a world, never arguing with it.
           *
           * Halved, and sunk further. The reader should be able to say
           * what a scene is about without discounting its backdrop. */
          opacity: 0.16 + input.density * 0.2,
          front: 0,
          sink: input.contested ? 0.62 : 0.45,
        },
        reason: input.contested
          ? `density ${input.density.toFixed(2)} — a ground behind the subject, sunk further because the line reports a claim`
          : `density ${input.density.toFixed(2)} — a ground behind the subject rather than under it`,
      },
      input,
    );
  }

  return null;
}

/** A ground that does not fit the frame budget is not a ground, it is a
 *  dropped frame. Reported by returning null rather than by silently
 *  costing what it costs. */
function affordable(plan: GroundPlan, input: GroundInputs): GroundPlan | null {
  const cost = chainCost([...plan.ground, plan.compositor]);
  return cost <= input.budgetMs ? plan : null;
}

/** Does the ground satisfy what the compositor structurally needs?
 *
 *  IMAGE means pixels and every primitive produces pixels, so an IMAGE
 *  second input is unconstrained and saying otherwise would be theatre.
 *  FIELD is real: `field_displace` reads a field's numbers, and a branch
 *  that only paints a picture of a field would silently do nothing. */
export function groundSatisfies(compositor: string, ground: string[]): true | string {
  const needs = PRIMITIVES[compositor]?.secondInput;
  if (!needs || needs === "IMAGE") return true;
  const tail = ground[ground.length - 1];
  const gives = tail ? (PRIMITIVES[tail]?.outputs ?? []) : [];
  if (gives.includes(needs)) return true;
  return (
    `${compositor} needs a ${needs} on its second input but the ground ends in ` +
    `${tail ?? "nothing"}, which emits ${gives.join("|") || "nothing"}`
  );
}

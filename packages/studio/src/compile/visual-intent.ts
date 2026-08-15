// VISUAL INTENT — what the Director already decided, restated for the
// Visual Strategist to reason from.
//
// Not a new interpretation and not a new model call. Every signal here is
// already computed by `promote.ts` (the Intervention), `act.ts` (the Act),
// and `intent.ts` (dislocation, the creative-state dials) for this beat —
// this module only gathers them into one shape a medium-choosing function
// can read, so that choice has real material to work from instead of
// re-deriving it. Standing rule 1 stays intact: nothing here calls AI.
//
// Deliberately narrow for now. A richer read — the beat's own ratified
// interpretation from `extract-reading.ts`, the one place a model is
// already allowed to interpret meaning under standing rule 1 — is a real
// candidate for a second pass, but `Beat` does not carry that reading
// today and plumbing it through is a separate, larger change. Starting
// with what is already free and already computed; widen only if the
// demonstration film's medium choices read as shallow against it.

import type { Act } from "./act.ts";
import type { Beat, Style } from "./construct.ts";
import type { IntentReading } from "./intent.ts";

export interface VisualIntent {
  act: Act | undefined;
  intervention: "TEXT" | "COMPOSE" | undefined;
  /** How far the director will go against the grain — see `intent.ts`. */
  dislocation: number;
  style: Style;
  /** True when this beat has a promoted phrase that must reach the screen. */
  setsType: boolean;
  /** A printed figure or a drawn route — checkable facts about the prose
   *  that outrank a medium preference, the same standing this codebase
   *  gives them everywhere else (`constructPrograms`'s own eligibility
   *  gate, `dislocate()`'s appetite discount). */
  printed: boolean;
  /** One line, for the compile report — what this moment is, in words a
   *  director reads, not a dial dump. */
  summary: string;
}

export function synthesizeVisualIntent(
  beat: Beat,
  style: Style,
  intent: IntentReading,
  intervention: "TEXT" | "COMPOSE" | undefined,
  act: Act | undefined,
): VisualIntent {
  const printed = beat.figures.length > 0 || beat.route.length >= 2;
  const parts: string[] = [];
  if (act) parts.push(act.toLowerCase());
  if (intervention === "TEXT") parts.push("the words are the point");
  if (intent.dislocation > 0.5) parts.push("read against the grain");
  if (printed) parts.push("carries a checkable figure");
  return {
    act,
    intervention,
    dislocation: intent.dislocation,
    style,
    setsType: Boolean(beat.setsType),
    printed,
    summary: parts.join(", ") || "a plain moment, no particular pressure",
  };
}

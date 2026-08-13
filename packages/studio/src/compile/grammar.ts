// A VISUAL GRAMMAR — the look, named, so it stops being an accident.
//
// The report that produced this file: "the weird abstract visuals almost
// with a film look... sort of glitch effects, that's sorta the style I was
// envisioning... so it's a perfect first step... but it sorta happened
// randomly."
//
// Both halves are true and the second one is the problem. That look was
// not random — it was the operator appetites the film's own creative state
// implied, and it would come out the same way again from the same curve.
// But nothing captured it, nothing named it, and nothing could apply it to
// a different essay. A style you cannot ask for twice is not a style, it
// is a result.
//
// WHAT A GRAMMAR IS HERE, and what it deliberately is not.
//
//   IT IS NOT A CHAIN. A saved chain is a preset, and a preset applied to
//   a different sentence produces the wrong picture of a different thing.
//   The whole architecture exists to avoid that.
//
//   IT IS NOT A STYLE PRESET EITHER, in the sense of "apply this filter".
//   A grammar names no primitive.
//
//   IT IS A SET OF APPETITES. How much this film wants to grade, to
//   scanline, to quantise, to come apart. Which representation rung it
//   prefers. Those are the numbers that sit on top of the director's
//   curves and bias what the constructor reaches for — so the same grammar
//   over a different essay builds different things in a recognisable way,
//   which is what a house style actually is.
//
// CAPTURED FROM A FILM, NOT AUTHORED. `captureGrammar` reads a compiled
// film and writes down what it actually did. That is the answer to "it
// happened randomly": you keep the accident by naming it, and then you can
// apply it on purpose.

import type { ComposedScene } from "./compose.ts";
import { OPERATOR_IDS } from "./construct.ts";

export interface VisualGrammar {
  /** What the director calls it. "The Form Is the Claim", "1960s
   *  editorial", "the glitch one" — the name is the point. */
  name: string;
  /** Per-operator bias, -1..1, added to the appetite the director's state
   *  already implies. Positive reaches for it; negative avoids it. */
  ops: Record<string, number>;
  /** Preferred representation rung, 0..4, for constructions that have one.
   *  Blended with abstraction rather than overriding it — a grammar says
   *  what KIND of picture, the curve still says how far from literal. */
  representation?: number | undefined;
  /** Where it came from, so a grammar is auditable like everything else. */
  capturedFrom?:
    | {
        projectId: string;
        scenes: number;
        at: string;
      }
    | undefined;
}

/** Read a compiled film and write down the look it actually produced.
 *
 *  The bias for an operator is how much MORE this film used it than an
 *  even spread would predict. A film where three of twelve operators do
 *  all the work captures those three strongly and the rest at zero, which
 *  is what makes the captured grammar recognisable rather than a flat copy
 *  of the whole vocabulary.
 *
 *  Operators the film never reached for are recorded as slightly negative
 *  rather than absent: a house style is as much what it refuses as what it
 *  reaches for, and a grammar that merely omits `pixel_sort` would let a
 *  high-experimentalism curve reintroduce it and break the look. */
export function captureGrammar(
  name: string,
  scenes: ComposedScene[],
  projectId = "unknown",
): VisualGrammar {
  const used = new Map<string, number>();
  let total = 0;
  let representationSum = 0;
  let representationCount = 0;

  for (const scene of scenes) {
    for (const op of scene.program?.operators ?? []) {
      used.set(op, (used.get(op) ?? 0) + 1);
      total++;
    }
    // The representation rung a construction actually landed on, read off
    // the parameter rather than re-derived, so a captured grammar reflects
    // what was rendered and not what the formula would say now.
    for (const node of scene.nodes) {
      const rep = node.params.representation;
      if (typeof rep === "number") {
        representationSum += rep;
        representationCount++;
      }
    }
  }

  const ops: Record<string, number> = {};
  if (total > 0) {
    const even = total / Math.max(1, OPERATOR_IDS.length);
    for (const id of OPERATOR_IDS) {
      const count = used.get(id) ?? 0;
      // Normalised against an even spread, clamped, and rounded so a
      // grammar reads as a small table of intentions rather than a dump of
      // floating point.
      const bias = count === 0 ? -0.25 : Math.min(0.6, ((count - even) / Math.max(1, even)) * 0.35);
      ops[id] = Math.round(bias * 100) / 100;
    }
  }

  const grammar: VisualGrammar = {
    name,
    ops,
    capturedFrom: { projectId, scenes: scenes.length, at: new Date().toISOString() },
  };
  if (representationCount > 0) {
    grammar.representation = Math.round(representationSum / representationCount);
  }
  return grammar;
}

/** What this grammar will do, in a sentence a director can disagree with.
 *
 *  A table of twelve numbers is not something anyone can hold. "Reaches
 *  for grade, scanline and quantise; avoids sorting and splitting" is. */
export function describeGrammar(grammar: VisualGrammar): string {
  const entries = Object.entries(grammar.ops).sort((a, b) => b[1] - a[1]);
  const reaches = entries.filter(([, v]) => v > 0.08).map(([k]) => k);
  const avoids = entries.filter(([, v]) => v < -0.15).map(([k]) => k);
  const parts: string[] = [];
  if (reaches.length) parts.push(`reaches for ${reaches.slice(0, 4).join(", ")}`);
  if (avoids.length) parts.push(`avoids ${avoids.slice(0, 4).join(", ")}`);
  if (grammar.representation !== undefined) {
    parts.push(
      `draws things ${
        ["solid", "shaded", "technical", "pixel", "wireframe"][grammar.representation] ??
        "as it finds them"
      }`,
    );
  }
  return parts.length ? parts.join("; ") : "no strong preferences captured";
}

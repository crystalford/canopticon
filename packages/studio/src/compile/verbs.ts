// DIRECTOR VERBS — what a director says instead of moving a slider.
//
// "Make it stranger." "Ground it." "Less motion." Those are the sentences
// a person actually uses, and none of them is a number. What they are is a
// DELTA on the state this one scene is composed against — so the engine
// keeps composing, and the instruction survives a restyle, a re-read and a
// recompile.
//
// Deliberately not a pin. A pin freezes a chain and bypasses composition
// (precedence 1); a verb bends the state and lets the compiler do its job
// under the new constraint. Freezing a shot and directing one are
// different acts, and only the second one still works after the director
// drags the film's curve.
//
// Deltas are small on purpose. A verb is a nudge, and a director who wants
// a large move has the curve for it. Pressed twice, a verb compounds —
// which is the honest way to say "no, MORE".

export interface Verb {
  id: string;
  /** What a person would say. */
  label: string;
  /** One line on what it will do, shown next to the button. */
  effect: string;
  nudge: Record<string, number>;
}

export const VERBS: Verb[] = [
  {
    id: "stranger",
    label: "STRANGER",
    effect: "further from literal, and permits decomposition",
    nudge: { abstraction: 0.18, experimentalism: 0.2, restraint: -0.1 },
  },
  {
    id: "ground",
    label: "GROUND IT",
    effect: "closer to the thing itself, and holds it recognisable",
    nudge: { abstraction: -0.2, experimentalism: -0.15, human: 0.1 },
  },
  {
    id: "quieter",
    label: "QUIETER",
    effect: "fewer operations, less on screen",
    nudge: { restraint: 0.2, density: -0.15, energy: -0.12 },
  },
  {
    id: "louder",
    label: "LOUDER",
    effect: "more happening, and more of it moving",
    nudge: { density: 0.18, energy: 0.18, restraint: -0.12 },
  },
  {
    id: "colder",
    label: "COLDER",
    effect: "reads as a record rather than as a person",
    nudge: { human: -0.22, archival: 0.15 },
  },
  {
    id: "warmer",
    label: "WARMER",
    effect: "reads as somebody was there",
    nudge: { human: 0.22, archival: -0.1 },
  },
];

/** Apply a verb on top of whatever this scene has already been directed
 *  to do. Pressing STRANGER twice means stranger still; pressing GROUND IT
 *  after it walks it back rather than starting over — which is what a
 *  person means by both. Clamped so a run of presses cannot leave the
 *  state somewhere the resolver cannot use. */
export function applyVerb(
  existing: Record<string, number> | undefined,
  verb: Verb,
): Record<string, number> {
  const out: Record<string, number> = { ...(existing ?? {}) };
  for (const [key, delta] of Object.entries(verb.nudge)) {
    out[key] = Math.max(-0.6, Math.min(0.6, (out[key] ?? 0) + delta));
  }
  // A key that has walked back to nothing is not a direction any more.
  for (const key of Object.keys(out)) {
    if (Math.abs(out[key] as number) < 0.02) delete out[key];
  }
  return out;
}

export function verbById(id: string): Verb | undefined {
  return VERBS.find((v) => v.id === id);
}

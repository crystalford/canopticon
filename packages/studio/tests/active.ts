// EVERY SCENE ACTIVE — for tests that are about the CONSTRUCTOR.
//
// `composeAll` allocates the film's visual attention when it is not handed
// an allocation, because an unallocated film is not a film the product
// ever renders: no silence, no hold, no promoted words, every scene
// drawing whatever the construction competition picked. That default is
// correct and it was missing, and its absence had already misled one
// measurement of the real essay into reporting zero silent scenes in a
// film that has thirteen.
//
// But a test asking "does a sentence about accumulation build a chain that
// accumulates" is a test of the CONSTRUCTOR, and a scene the allocator
// decided should hold never reaches it. Those tests need every scene
// active, and they should say so rather than get it by accident from an
// argument nobody passed.
//
// So: this is the escape hatch, and it is deliberately loud. A test that
// uses it is declaring "I am isolating what gets built, not what the film
// decides to show." A test that does NOT use it is looking at the film.

import type { Act, ActReading } from "../src/compile/act.ts";
import type { Intervention } from "../src/compile/promote.ts";
import type { EditorialIR } from "../src/ir/schema.ts";

const reading = (act: Act): ActReading => ({
  act,
  because: "",
  confidence: "inferred",
  hedged: false,
  negated: false,
  why: "every scene active, for a test about construction",
  proposition: { kind: "CONNECTS", because: "", confidence: "inferred", negated: false },
});

/** One COMPOSE intervention per scene: nothing silent, nothing held,
 *  nothing promoted to type. The constructor sees every sentence. */
export function allActive(ir: EditorialIR): Intervention[] {
  return ir.scenes.map((s) => ({
    sceneId: s.sceneId,
    kind: "COMPOSE" as const,
    act: reading("DECLARE"),
    intensity: 0 as const,
    role: "DEVELOPMENT" as const,
    payload: null,
    window: null,
    why: ["every scene active, for a test about construction"],
    score: 0,
  }));
}

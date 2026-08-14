// DOES THE SCENE SURVIVE THE COMPILER?
//
// The bug these exist for was invisible to every test in the suite, and
// visible on screen immediately.
//
// `constructPrograms` returns a TREE — the scene graph, where a ground, a
// primary, a field and the words each hang off a compositor's second
// input. `compose.ts` flattened it:
//
//     chain = best.nodes.map((n) => n.primitiveId)
//     plannedParams = new Map(best.nodes.map((n) => [n.primitiveId, n.params]))
//
// A list of names has nowhere to put a second input, so every element
// except the first was deleted; and a Map keyed by primitive NAME
// collapsed the five different `place` / `geometry_draw` parameter sets a
// five-element scene emits down to whichever was written last.
//
// Measured on a real 36-scene essay before the fix: 27 scenes planned
// `typographic`, 3 containing any text primitive. The other 24 rendered
// their ground plus the operator tail — a texture — while every count in
// the compile report said the scene graph had won.
//
// So these assert on WHAT REACHES THE RENDERER, never on what was planned.
// A test that reads the plan would have passed throughout.

import { describe, expect, it } from "vitest";
import { type ComposedNode, composeAll } from "../src/compile/compose.ts";
import { segmentEssay } from "../src/compile/segment.ts";
import { parseIR } from "../src/ir/schema.ts";

/* Abstract argumentative prose, which is what a video essay is made of and
 * what the compiler is worst at: almost nothing here names a depictable
 * thing, so the representation layer reaches for the typographic reading
 * and the words are the whole picture. If they are dropped there is
 * nothing left but ground. */
const ESSAY = `# The Logic Costume

A method and a brand fail differently under pressure.

A method, when it runs into a case reality will not cooperate with, produces an update. You were wrong, here is why, moving on.

A brand cannot do that. Its authority is the outcome record, so when reality stops cooperating it must concede or manufacture the win.

The fallacy is not a lapse. It is a diagnosis.

Nobody reasons perfectly under live pressure indefinitely. The base rate gets rolled enough times that a visible failure becomes a near certainty.

The position does not produce more distortion. It produces the only distortion anyone can catch.`;

function compile() {
  const seg = segmentEssay(ESSAY, { projectId: "t", title: "The Logic Costume" });
  const parsed = parseIR(seg.ir);
  if (!parsed.ok) throw new Error(`fixture IR invalid: ${JSON.stringify(parsed.errors)}`);
  return composeAll(parsed.ir);
}

/** Every node that will actually be built, trunk and grounds alike. */
function everyNode(ns: ComposedNode[]): ComposedNode[] {
  return ns.flatMap((n) => [n, ...(n.ground ? everyNode(n.ground) : [])]);
}

const TEXT = new Set(["text_layout", "glyph_geometry", "text_stagger", "type_specimen"]);

describe("the composed scene survives the compiler", () => {
  /* THE ONE THAT MATTERS. A compositor is a two-input primitive; one with
   * an empty second input is not a quiet composition, it is a deleted
   * element. This is the exact signature the bug left on every
   * multi-element scene, and it is checkable without knowing anything
   * about what the scene was supposed to be. */
  it("no compositor is emitted pointing at nothing", () => {
    for (const scene of compile()) {
      for (const n of everyNode(scene.nodes)) {
        if (n.primitiveId !== "layer_over") continue;
        expect(
          n.ground && n.ground.length > 0,
          `${scene.sceneId}: ${n.primitiveId} has no second input — an element was dropped`,
        ).toBe(true);
      }
    }
  });

  it("a scene planned as typographic actually sets type", () => {
    const scenes = compile();
    const typographic = scenes.filter((s) => s.program?.mode === "typographic");
    expect(typographic.length, "fixture should reach the typographic reading").toBeGreaterThan(0);
    const withText = typographic.filter((s) =>
      everyNode(s.nodes).some((n) => TEXT.has(n.primitiveId)),
    );
    // Before the fix this was 3 of 27 across a real essay. The claim is not
    // "most of them" — it is that the label and the chain agree.
    expect(
      withText.length,
      `${withText.length} of ${typographic.length} typographic scenes contain a text primitive`,
    ).toBe(typographic.length);
  });

  /* THE PARAMETER COLLAPSE. A scene graph emits `place` once per element,
   * each placing a different thing somewhere different. Keyed by name they
   * became one. Two nodes sharing an id must be allowed to differ. */
  it("two elements using the same primitive keep their own parameters", () => {
    const scenes = compile();
    let checked = 0;
    for (const scene of scenes) {
      const places = everyNode(scene.nodes).filter((n) => n.primitiveId === "place");
      if (places.length < 2) continue;
      checked++;
      const distinct = new Set(places.map((n) => JSON.stringify(n.params)));
      expect(
        distinct.size,
        `${scene.sceneId}: ${places.length} placements collapsed to ${distinct.size}`,
      ).toBeGreaterThan(1);
    }
    expect(
      checked,
      "fixture should produce a scene that places more than one element",
    ).toBeGreaterThan(0);
  });

  it("a multi-element scene reaches the renderer with all of its elements", () => {
    const scenes = compile();
    const nested = scenes.filter((s) => s.nodes.some((n) => n.ground && n.ground.length > 0));
    expect(nested.length, "fixture should produce at least one composed scene").toBeGreaterThan(0);
    for (const s of nested) {
      // A composed scene is strictly larger than its trunk. Equality means
      // the tree was flattened away again.
      expect(everyNode(s.nodes).length).toBeGreaterThan(s.nodes.length);
    }
  });
});

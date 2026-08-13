// HIERARCHY — does the frame know what it is about?
//
// The gap this closes. The scene graph could decide WHAT is in the frame
// and WHERE, and had no way to decide WHICH ELEMENT THE FRAME IS ABOUT.
// Five elements drawn at the same volume is an inventory, not a
// composition, and it is most of why a correctly arranged scene still
// read as busy rather than as directed.
//
// Two properties are what make this a hierarchy rather than a set of
// numbers, and both are asserted here rather than hoped for:
//
//   EXACTLY ONE FOCUS, in every scene, structurally.
//   A GUARANTEED GAP between levels — the distance is what is legible.

import { describe, expect, it } from "vitest";
import { type Material, applyEmphasis } from "../src/compile/grammar-visual.ts";
import { readRelation } from "../src/compile/relation.ts";
import {
  type Element,
  composeFromMeaning,
  composeScene,
  emphasise,
  focusOf,
  observe,
  serialiseScene,
} from "../src/compile/scene-graph.ts";
import { readScene } from "../src/compile/semantic-scene.ts";
import { detectSubjects } from "../src/compile/subject.ts";

const MAT: Material = {
  noun: "camera",
  phrase: "THE CAMERA",
  count: null,
  relation: null,
  density: 0.55,
  energy: 0.4,
  abstraction: 0.4,
  typography: 0.6,
  seed: 11,
};

const MODES = ["literal", "structural", "geometric", "typographic", "diagrammatic"] as const;

const SENTENCES = [
  "The city watched its residents.",
  "Roughly 3.5 billion people now carry a networked camera.",
  "Memory was never storage. Memory was selection.",
  "The smoke detector in room 214 had been disconnected.",
  "Thousands of ordinary decisions accumulated into a system.",
];

function sceneFor(mode: (typeof MODES)[number], sentence: string) {
  const subs = detectSubjects(sentence);
  const sem = readScene(sentence, subs, readRelation(sentence), null);
  return composeFromMeaning(mode, { ...MAT, noun: subs[0]?.text ?? "" }, sem);
}

describe("hierarchy — the frame knows what it is about", () => {
  it("every composed scene has exactly one element at full emphasis", () => {
    for (const mode of MODES) {
      for (const sentence of SENTENCES) {
        const scene = sceneFor(mode, sentence);
        const focused = scene.elements.filter((e) => (e.emphasis ?? 0) >= 1);
        expect(focused.length, `${mode} · "${sentence}" had ${focused.length} focal points`).toBe(
          1,
        );
      }
    }
  });

  it("the single-subject composition is ranked too — no unranked path", () => {
    for (const mode of MODES) {
      const scene = composeScene(mode, { ...MAT, count: 40, relation: ["a", "b"] });
      expect(scene.elements.every((e) => typeof e.emphasis === "number")).toBe(true);
      expect(focusOf(scene.elements)).toBeDefined();
    }
  });

  /* THE ONE THAT MATTERS. Two elements at 0.81 and 0.79 have no
   * hierarchy no matter what the numbers claim — the distance between
   * levels is the thing the eye reads. So the property is a GUARANTEED
   * GAP at every adjacent pair, not a shape of curve: the ground's floor
   * deliberately opens a step wider than the one above it, which is
   * correct and would fail a "steepest first" assertion. */
  it("no two elements tie, the ladder is evenly stepped, and the focus sits above it", () => {
    for (const mode of MODES) {
      for (const sentence of SENTENCES) {
        const scene = sceneFor(mode, sentence);
        const levels = scene.elements.map((e) => e.emphasis ?? 0).sort((a, b) => b - a);
        const where = `${mode} · "${sentence}"`;
        expect(new Set(levels).size, `${where} had ties`).toBe(levels.length);
        if (levels.length < 3) continue;
        const steps = levels.slice(1).map((v, i) => (levels[i + 1 - 1] as number) - v);
        const sub = steps.slice(1);
        // Evenly stepped among the subordinates, whatever the count — the
        // failure this replaces was a fixed step hitting a clamp floor and
        // fusing the bottom two rungs of a six-element scene.
        for (const s of sub) expect(s, `${where} uneven`).toBeCloseTo(sub[0] as number, 6);
        // And the subject is separated by a FIXED amount rather than by a
        // rung of the subordinates' ladder, so a two-element scene and a
        // seven-element one give the focus the same authority. (In a
        // three-element scene the drop to the ground is the larger step;
        // that is correct and is why this is not a curve-shape claim.)
        expect(steps[0], `${where} focus not separated`).toBeCloseTo(0.2, 6);
        // The ladder always reaches the bottom of its range, so a scene
        // of two elements and a scene of seven are equally legible.
        expect(levels[levels.length - 1]).toBeCloseTo(0.26, 6);
      }
    }
  });

  it("the ground is never the subject of the frame", () => {
    for (const mode of MODES) {
      for (const sentence of SENTENCES) {
        const scene = sceneFor(mode, sentence);
        expect(focusOf(scene.elements)?.role).not.toBe("GROUND");
      }
    }
  });

  /* SCALE EARNS ATTENTION. A field the arrangement made large is what the
   * frame is about, even though the role table alone would rank a primary
   * above it. This is what lets a sentence about the many rather than the
   * one actually be about the many. */
  it("an element the arrangement made dominant can take the frame from its role", () => {
    const els: Element[] = [
      {
        role: "PRIMARY",
        ops: ["SOLID", "PLACE", "FRAME"],
        place: { scale: 0.14, x: 0.8, y: 0.2, crop: 0 },
        depth: 0.6,
        reason: "small",
      },
      {
        role: "FIELD",
        ops: ["REPEAT", "PLACE", "FRAME"],
        place: { scale: 1.8, x: 0.5, y: 0.5, crop: 1 },
        depth: 0.3,
        reason: "large",
      },
    ];
    expect(focusOf(emphasise(els))?.role).toBe("FIELD");
    // And the reverse, so this is a genuine reading of the arrangement
    // rather than a field-always-wins rule wearing a different name.
    const flipped = emphasise([
      { ...(els[0] as Element), place: { scale: 1.8, x: 0.5, y: 0.5, crop: 1 } },
      { ...(els[1] as Element), place: { scale: 0.14, x: 0.8, y: 0.2, crop: 0 } },
    ]);
    expect(focusOf(flipped)?.role).toBe("PRIMARY");
  });

  /* ONE TRANSLATION POINT — standing rule 9. Everything downstream must
   * come from `applyEmphasis`, so a change to the hierarchy's meaning is
   * a change to one function rather than a hunt through three files. */
  it("every downstream parameter is the one function's output", () => {
    const scene = sceneFor("literal", "The city watched its residents.");
    const nodes = serialiseScene(scene, MAT);
    const composites = nodes.filter((n) => n.primitiveId === "layer_over");
    expect(composites.length).toBeGreaterThan(0);
    for (const c of composites) {
      const a = applyEmphasis(
        (scene.elements.find((e) => e.reason === c.reason)?.emphasis ?? 1) as number,
        MAT.density,
      );
      expect(c.params.opacity).toBe(a.opacity);
      expect(c.params.sink).toBe(a.sink);
    }
  });

  it("a subordinate element recedes and the focus does not", () => {
    const scene = sceneFor("literal", "The city watched its residents.");
    const nodes = serialiseScene(scene, MAT);
    const draws = nodes
      .flatMap((n) => (n.ground ? [...n.ground, n] : [n]))
      .filter((n) => n.primitiveId === "geometry_draw");
    const recedes = draws.map((n) => n.params.recede as number);
    // Something is fully forward, and something is genuinely held back.
    expect(Math.min(...recedes)).toBe(0);
    expect(Math.max(...recedes)).toBeGreaterThan(0.2);
  });

  it("nothing is suppressed out of the scene", () => {
    // The bug this replaces: FIELD at 0.55 opacity with 0.5 sink, which
    // is not a quiet element, it is a missing one.
    for (let e = 0; e <= 1.001; e += 0.05) {
      const a = applyEmphasis(e);
      expect(a.opacity).toBeGreaterThanOrEqual(0.46);
      expect(a.recede).toBeLessThanOrEqual(0.62);
      expect(a.weight).toBeGreaterThan(0.05);
    }
  });

  it("the camera does not disturb the hierarchy", () => {
    // A push-in changes what is in frame, not what the frame is about.
    const scene = sceneFor("literal", "The city watched its residents.");
    const pushed = observe(scene, { zoom: 1.6, x: 0.4, y: 0.55, parallax: 0.5 });
    expect(focusOf(pushed.elements)?.role).toBe(focusOf(scene.elements)?.role);
    expect(pushed.elements.map((e) => e.emphasis)).toEqual(scene.elements.map((e) => e.emphasis));
  });

  it("the report says what the frame is about", () => {
    const scene = sceneFor("literal", "The city watched its residents.");
    expect(scene.describes).toContain("the frame is about the");
  });
});

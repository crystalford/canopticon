// FILM CONTINUITY — does the visual state remember?
//
// The definition of done for this milestone, as tests:
//
//   sentence sequence → persistent film state → temporal transformations
//   → deliberate continuity/cut decisions → a rendered sequence
//
// with the decisive one last: REORDERING THE SENTENCES MUST CHANGE THE
// VISUAL EVOLUTION. If a film produces the same state whatever order its
// argument arrives in, it has no memory — it is regenerating pictures,
// not building one.

import { describe, expect, it } from "vitest";
import { EMPTY_FILM, advance, present } from "../src/compile/film-state.ts";
import type { Material } from "../src/compile/grammar-visual.ts";
import { readRelation } from "../src/compile/relation.ts";
import { composeFromMeaning } from "../src/compile/scene-graph.ts";
import { readScene } from "../src/compile/semantic-scene.ts";
import { detectSubjects } from "../src/compile/subject.ts";

const MAT: Material = {
  noun: "",
  phrase: "THE",
  count: null,
  relation: null,
  density: 0.5,
  energy: 0.4,
  abstraction: 0.4,
  typography: 0.4,
  seed: 7,
};

/** Run a sequence of sentences through the film and return every
 *  decision, plus the state at the end. */
function runFilm(sentences: string[], rules?: { allowCut: boolean; memory: number }) {
  let state = EMPTY_FILM;
  const log: string[] = [];
  for (const sentence of sentences) {
    const subs = detectSubjects(sentence);
    const sem = readScene(sentence, subs, readRelation(sentence), null);
    const scene = composeFromMeaning("literal", { ...MAT, noun: subs[0]?.text ?? "" }, sem);
    const step = advance(state, sem, scene.elements, rules);
    state = step.state;
    for (const d of step.decisions) log.push(`${d.identity}:${d.what}`);
  }
  return { state, log };
}

const SEQUENCE = [
  "The city watched its residents.",
  "The residents carried a camera.",
  "The camera became a record.",
  "The record was never a memory.",
  "The city forgot its residents.",
];

describe("film continuity — the visual state remembers", () => {
  it("an element introduced by one sentence persists into the next", () => {
    const { log } = runFilm(SEQUENCE.slice(0, 2));
    expect(log).toContain("residents:ENTER");
    // "residents" is named by both sentences, so the second must CONTINUE
    // it rather than introducing it again.
    expect(log.filter((l) => l === "residents:ENTER")).toHaveLength(1);
    expect(log.some((l) => l.startsWith("residents:") && l !== "residents:ENTER")).toBe(true);
  });

  it("a persisting element inherits its place rather than jumping", () => {
    let state = EMPTY_FILM;
    const places: number[] = [];
    for (const sentence of SEQUENCE.slice(0, 2)) {
      const subs = detectSubjects(sentence);
      const sem = readScene(sentence, subs, readRelation(sentence), null);
      const scene = composeFromMeaning("literal", { ...MAT, noun: subs[0]?.text ?? "" }, sem);
      state = advance(state, sem, scene.elements).state;
      const r = state.alive.find((p) => p.identity === "residents");
      if (r) places.push(r.element.place.x);
    }
    expect(places).toHaveLength(2);
    // Continuity means the second placement is anchored to the first, not
    // recomputed from scratch. Identical or close — never an unrelated
    // position the fresh arrangement would have produced.
    expect(Math.abs((places[1] as number) - (places[0] as number))).toBeLessThan(0.3);
  });

  it("an element that left and returns is RECALLED, not re-introduced", () => {
    const { log } = runFilm(SEQUENCE);
    // "city" opens the film, is absent for the middle, and returns at the
    // end. A film with memory knows the difference.
    expect(log).toContain("city:ENTER");
    expect(log).toContain("city:EXIT");
    expect(log).toContain("city:RECALL");
  });

  it("a complete change of subject CUTS, and a cut is a decision", () => {
    const { log } = runFilm(["The city watched its residents.", "The contract named a warehouse."]);
    expect(log.some((l) => l.endsWith(":CUT"))).toBe(true);
  });

  it("ONE-SHOT: forbidding the cut forces the film to solve it otherwise", () => {
    const { log } = runFilm(
      ["The city watched its residents.", "The contract named a warehouse."],
      { allowCut: false, memory: 8 },
    );
    // No cut is available, so the film must EXIT what left and ENTER what
    // arrived, keeping one continuous state. That is the whole of
    // one-shot mode — a constraint on this vocabulary, not a second
    // engine.
    expect(log.some((l) => l.endsWith(":CUT"))).toBe(false);
    expect(log.some((l) => l.endsWith(":EXIT"))).toBe(true);
  });

  it("a counted multitude ACCUMULATES rather than merely reappearing", () => {
    const { log } = runFilm([
      "The residents carried a camera.",
      "The residents accumulated into a system.",
    ]);
    expect(log).toContain("residents:ACCUMULATE");
  });

  /* THE DECISIVE ONE. If the film produces the same state whatever order
   * its argument arrives in, it has no memory — it is regenerating
   * pictures rather than building one. */
  it("REORDERING THE SENTENCES CHANGES THE VISUAL EVOLUTION", () => {
    const forward = runFilm(SEQUENCE);
    const reversed = runFilm([...SEQUENCE].reverse());
    expect(forward.log.join(">")).not.toBe(reversed.log.join(">"));
    // And not merely a different log — the film ENDS somewhere else,
    // holding different things in different places.
    const endA = present(forward.state)
      .map((e) => e.place.x.toFixed(2))
      .join(",");
    const endB = present(reversed.state)
      .map((e) => e.place.x.toFixed(2))
      .join(",");
    expect(endA).not.toBe(endB);
  });

  it("the film's memory is bounded — a long absence is a new arrival", () => {
    const long = [
      "The city watched its residents.",
      "The contract named a warehouse.",
      "The invoice listed a truck.",
      "The permit covered a fence.",
      "The city watched its residents.",
    ];
    const short = runFilm(long, { allowCut: false, memory: 1 });
    // With a memory of one scene, the city has been gone too long to be
    // recalled — it arrives.
    const cityEvents = short.log.filter((l) => l.startsWith("city:"));
    expect(cityEvents.filter((l) => l === "city:ENTER").length).toBeGreaterThan(1);
  });
});

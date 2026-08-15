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
import { type ComposedNode, composeAll } from "../src/compile/compose.ts";
import { EMPTY_FILM, advance, present } from "../src/compile/film-state.ts";
import type { Material } from "../src/compile/grammar-visual.ts";
import { readRelation } from "../src/compile/relation.ts";
import { composeFromMeaning } from "../src/compile/scene-graph.ts";
import { segmentEssay } from "../src/compile/segment.ts";
import { readScene } from "../src/compile/semantic-scene.ts";
import { detectSubjects } from "../src/compile/subject.ts";
import { parseIR } from "../src/ir/schema.ts";

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

  /* THE GAP THAT LET A REAL BUG THROUGH.
   *
   * Every test above asserts on DECISIONS and PLACES. None of them ever
   * asked what was left to DRAW — so `advance` pairing entities to
   * elements BY INDEX, against a list sorted by depth, passed the whole
   * suite while matching the first entity of every sentence to the GROUND
   * and dropping every element past the entity count. It took rendering
   * seventeen one-shot states and looking at them to find it. */
  it("what the film hands the renderer is the whole composition", () => {
    const sentence = "The city watched its residents.";
    const subs = detectSubjects(sentence);
    const sem = readScene(sentence, subs, readRelation(sentence), null);
    const scene = composeFromMeaning("literal", { ...MAT, noun: subs[0]?.text ?? "" }, sem);
    const step = advance(EMPTY_FILM, sem, scene.elements);
    // Nothing the composition put in the frame is lost on the way to the
    // renderer. A five-element scene renders as five elements.
    expect(step.elements).toHaveLength(scene.elements.length);
    // And it is ordered far to near, so the compositor stacks it right.
    const depths = step.elements.map((e) => e.depth);
    expect([...depths].sort((a, b) => a - b)).toEqual(depths);
  });

  it("an entity is matched to the element that depicts it, not to a position", () => {
    const sentence = "The city watched its residents.";
    const subs = detectSubjects(sentence);
    const sem = readScene(sentence, subs, readRelation(sentence), null);
    const scene = composeFromMeaning("literal", { ...MAT, noun: subs[0]?.text ?? "" }, sem);
    const step = advance(EMPTY_FILM, sem, scene.elements);
    for (const p of step.state.alive) {
      expect(
        p.element.depicts,
        `${p.identity} was given an element that depicts something else`,
      ).toBe(p.identity);
    }
    // The ground is scenery: in the frame, never held as a character.
    expect(step.state.alive.some((p) => p.element.role === "GROUND")).toBe(false);
    expect(step.elements.some((e) => e.role === "GROUND")).toBe(true);
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

/* ── THE FILM OF AN ARGUMENT ──────────────────────────────────────────
 *
 * Everything above tests continuity through the noun lexicon, which is
 * what `advance` was written against. On an essay of IDEAS both of its
 * inputs are empty — `sem.entities` needs a lexicon-known noun and
 * `sem.relations` needs two — so nothing ever persisted, every decision
 * was CONTINUE by default, and the whole model was inert on the material
 * the system exists for. Measured before this: zero decisions of any kind
 * across a 65-scene essay.
 */
describe("the film of an argument, which names nothing", () => {
  const ABSTRACT = `# The Logic Costume

A method and a brand fail differently under pressure. A method produces an update. That costs almost nothing.

A brand cannot do that. Its whole authority is how it looks so far. It is not a credential you get once.

The fallacy is not a lapse. It is a diagnosis. Nobody reasons perfectly under live pressure indefinitely.

The position does not produce more distortion. It produces the only distortion anyone can catch. Logic was just never the load-bearing thing.`;

  function film() {
    const seed = segmentEssay(ABSTRACT, { projectId: "t", title: "The Logic Costume" });
    const parsed = parseIR(JSON.parse(JSON.stringify(seed.ir)));
    if (!parsed.ok) throw new Error(`fixture IR invalid: ${JSON.stringify(parsed.errors)}`);
    return { ir: parsed.ir, scenes: composeAll(parsed.ir) };
  }

  it("carries something across scenes even though the prose names nothing", () => {
    const { ir, scenes } = film();
    for (const s of ir.scenes) {
      expect(detectSubjects(s.narration.text).length, `"${s.narration.text}" names something`).toBe(
        0,
      );
    }
    const decided = scenes.flatMap((s) => s.world?.decisions ?? []);
    expect(decided.length, "the continuity model produced no decisions at all").toBeGreaterThan(0);
    expect(decided.some((d) => d.what === "CONTINUE")).toBe(true);
  });

  it("cuts where the author started a new paragraph, and not inside one", () => {
    const { ir, scenes } = film();
    const cutAt = scenes.map((s, i) => (s.world?.cut ? i : -1)).filter((i) => i >= 0);
    expect(cutAt.length, "an essay that changes subject should cut somewhere").toBeGreaterThan(0);

    /* The film goes SILENT at the boundary — the allocator's breathing rule
     * fires on exactly the same event — so the cut lands on the next scene
     * that draws. Either is the boundary being honoured; a cut two or more
     * scenes into a paragraph is not. */
    const boundary = new Set<number>();
    ir.scenes.forEach((s, i) => {
      if (i > 0 && s.passageId !== ir.scenes[i - 1]?.passageId) boundary.add(i);
    });
    for (const i of cutAt) {
      const onIt = boundary.has(i) || boundary.has(i - 1);
      expect(onIt, `scene ${i} cut in the middle of a paragraph`).toBe(true);
    }
  });

  it("what the film carries is not offered as a thing the prose named", () => {
    /* The passage is an IDENTITY, not a noun. The film carries it — that is
     * the point — but it must never be drawn, or the compiler would have
     * invented an entity, which is the failure the whole act layer exists
     * to prevent. */
    const { scenes } = film();
    const carried = scenes.flatMap((s) => s.world?.alive ?? []);
    expect(
      carried.some((a) => a.startsWith("passage ")),
      "nothing was carried",
    ).toBe(true);
    const flat = (ns: ComposedNode[]): ComposedNode[] =>
      ns.flatMap((n) => [n, ...(n.ground ? flat(n.ground) : [])]);
    for (const s of scenes) {
      for (const n of flat(s.nodes)) {
        for (const v of Object.values(n.params)) {
          expect(String(v)).not.toMatch(/passage p?\d/);
        }
      }
    }
  });

  it("the act moves an identity that no relation could have moved", () => {
    /* `accumulating` and `transforming` read `sem.relations`, which needs
     * two lexicon-known nouns. This asks the same question of a sentence
     * that has none, through the act. */
    const sem = readScene("It became something else entirely.", [], null, null);
    expect(
      sem.relations,
      "the fixture must have no relation for this to test anything",
    ).toHaveLength(0);
    const graph = composeFromMeaning("literal", MAT, sem);
    const held = advance(EMPTY_FILM, sem, graph.elements, undefined, { subject: "passage p001" });
    const next = advance(held.state, sem, graph.elements, undefined, {
      subject: "passage p001",
      act: "TRANSFORM",
    });
    expect(next.decisions.map((d) => d.what)).toContain("TRANSFORM");

    const flat = advance(held.state, sem, graph.elements, undefined, { subject: "passage p001" });
    expect(flat.decisions.map((d) => d.what)).not.toContain("TRANSFORM");
  });

  it("material is inherited, not recomputed, while an identity continues", () => {
    /* `Element.material` comes from `MATERIAL[mode][role]` and is a
     * property of THIS SCENE'S composition — a continuing identity that
     * happened to be composed under a different mode would silently take
     * on a different material with nothing on the film state noticing.
     * `literal` PRIMARY is 5; `geometric` PRIMARY is 0 — chosen because
     * they are the two poles a real essay actually alternates between. */
    const subs = detectSubjects("The city held its shape.");
    const sem = readScene(
      "The city held its shape.",
      subs,
      readRelation("The city held its shape."),
      null,
    );
    const literalScene = composeFromMeaning("literal", { ...MAT, noun: "city" }, sem);
    const geometricScene = composeFromMeaning("geometric", { ...MAT, noun: "city" }, sem);
    const cityEl = (g: typeof literalScene) => g.elements.find((e) => e.depicts === "city");
    expect(cityEl(literalScene)?.material).toBe(5);
    expect(cityEl(geometricScene)?.material).toBe(0);

    const entered = advance(EMPTY_FILM, sem, literalScene.elements, undefined, {});
    const city = entered.state.alive.find((p) => p.identity === "city");
    expect(city?.material).toBe(5);

    // The SAME identity, continuing, now composed under a mode whose
    // material for this role is 0 — the persisted material must not move.
    const continued = advance(entered.state, sem, geometricScene.elements, undefined, {});
    expect(continued.state.alive.find((p) => p.identity === "city")?.material).toBe(5);

    // TRANSFORM is the one decision allowed to change it — "the sentence
    // changed what it is" is a claim about the thing, not the palette.
    const transformed = advance(entered.state, sem, geometricScene.elements, undefined, {
      act: "TRANSFORM",
    });
    expect(transformed.state.alive.find((p) => p.identity === "city")?.material).toBe(0);
  });
});

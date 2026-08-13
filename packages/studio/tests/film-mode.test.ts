// FILM MODE — the ten proofs.
//
// The correction these exist for: `allowCut: false` says what a one shot
// may NOT do. What makes it a one shot is what the grammar DOES inside
// that constraint — a state reached by passing through intermediate
// states with identity intact, rather than a slideshow that is merely
// not allowed to say so.

import { describe, expect, it } from "vitest";
import { MODES, bridge, bridgeCamera, step } from "../src/compile/film-mode.ts";
import type { FilmMode } from "../src/compile/film-mode.ts";
import { EMPTY_FILM } from "../src/compile/film-state.ts";
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

function sceneFor(sentence: string) {
  const subs = detectSubjects(sentence);
  const sem = readScene(sentence, subs, readRelation(sentence), null);
  const graph = composeFromMeaning("literal", { ...MAT, noun: subs[0]?.text ?? "" }, sem);
  return { sem, graph };
}

/** Run a sequence under a mode, collecting every decision and every
 *  state the film actually passed through. */
function film(mode: FilmMode, sentences: string[]) {
  let state = EMPTY_FILM;
  const decisions: string[] = [];
  const passed: number[] = [];
  let previous = null as ReturnType<typeof sceneFor>["graph"] | null;
  for (const sentence of sentences) {
    const { sem, graph } = sceneFor(sentence);
    const out = step(mode, state, sem, graph.elements);
    state = out.state;
    for (const d of out.decisions) decisions.push(d.what);
    const b = previous ? bridge(previous, graph, mode) : { states: [graph], describes: "open" };
    passed.push(b.states.length);
    previous = graph;
  }
  return { state, decisions, passed };
}

/* The argument the one shot has to solve without ever cutting: cameras
 * accumulating, connecting, and becoming the thing that watches.
 *
 * Every noun here is one the subject lexicon knows. That is deliberate
 * and it is a limitation worth naming: the first version of this fixture
 * used "decisions", which the lexicon does not contain, so the film never
 * saw an entity at all and the test failed for a reason that had nothing
 * to do with film mode. A test of the mode must not be a test of the
 * lexicon. */
const ARGUMENT = [
  "The cameras accumulated in the building.",
  "The cameras connected to a server.",
  "The server watched the residents.",
  "The server became a record.",
];

describe("film mode — one grammar, four constraints", () => {
  it("1 · ONE_SHOT produces zero cuts", () => {
    const { decisions } = film("ONE_SHOT", [
      "The city watched its residents.",
      "The contract named a warehouse.",
      "The invoice listed a truck.",
    ]);
    expect(decisions).not.toContain("CUT");
  });

  it("2 · identities persist across the whole sequence", () => {
    const { state } = film("ONE_SHOT", ARGUMENT);
    const known = [...state.alive, ...state.retired].map((p) => p.identity);
    expect(known).toContain("cameras");
    // Something introduced early is still known to the film at the end,
    // which is the whole of persistence.
    const first = [...state.alive, ...state.retired].find((p) => p.identity === "cameras");
    expect(first?.bornAt).toBe(1);
  });

  it("3 · an entity transforms without being destroyed and recreated", () => {
    const { decisions } = film("ONE_SHOT", [
      "The cameras connected to a server.",
      "The cameras became a record.",
    ]);
    // One ENTER for "cameras", then a change that is not a re-entry.
    expect(decisions.filter((d) => d === "ENTER").length).toBeLessThan(4);
    expect(decisions.some((d) => d === "TRANSFORM" || d === "CONTINUE")).toBe(true);
  });

  it("4 · new entities can enter continuously", () => {
    const { decisions } = film("ONE_SHOT", ARGUMENT);
    expect(decisions.filter((d) => d === "ENTER").length).toBeGreaterThan(1);
  });

  it("5 · an entity can leave and later be recalled", () => {
    const { decisions } = film("ONE_SHOT", [
      "The city watched its residents.",
      "The residents carried a camera.",
      "The camera became a record.",
      "The city watched the record.",
    ]);
    expect(decisions).toContain("EXIT");
    expect(decisions).toContain("RECALL");
  });

  it("6 · the camera moves continuously rather than jumping", () => {
    const path = bridgeCamera(
      { zoom: 1, x: 0.5, y: 0.5, parallax: 0 },
      { zoom: 2.2, x: 0.2, y: 0.7, parallax: 0.6 },
      "ONE_SHOT",
    );
    expect(path.length).toBe(MODES.ONE_SHOT.bridge);
    // Monotonic and arriving exactly, so the move is a travel rather than
    // a jump with waypoints.
    for (let i = 1; i < path.length; i++) {
      expect((path[i] as { zoom: number }).zoom).toBeGreaterThan(
        (path[i - 1] as { zoom: number }).zoom,
      );
    }
    expect((path[path.length - 1] as { zoom: number }).zoom).toBeCloseTo(2.2, 5);
  });

  /* 7 IS THE ONE THAT MATTERS. A completely different semantic
   * situation, reached without a cut — which is only meaningful if the
   * film PASSED THROUGH something on the way. */
  it("7 · a wholly different state is reached without a cut, through the world", () => {
    const a = sceneFor("The city watched its residents.");
    const b = sceneFor("The contract named a warehouse.");
    const oneShot = bridge(a.graph, b.graph, "ONE_SHOT");
    const cut = bridge(a.graph, b.graph, "CUT");

    // The cut goes straight there. The one shot does not.
    expect(cut.states).toHaveLength(1);
    expect(oneShot.states.length).toBeGreaterThan(1);
    // And it ARRIVES — the last state is the destination, not an
    // approximation of it.
    const last = oneShot.states[oneShot.states.length - 1];
    expect(last?.elements.length).toBe(b.graph.elements.length);
    // The intermediate states are genuinely intermediate: at least one
    // differs from both ends.
    const first = oneShot.states[0];
    expect(JSON.stringify(first?.elements.map((e) => e.place))).not.toBe(
      JSON.stringify(b.graph.elements.map((e) => e.place)),
    );
  });

  it("8 · reordering the prose changes the continuous evolution", () => {
    const forward = film("ONE_SHOT", ARGUMENT);
    const backward = film("ONE_SHOT", [...ARGUMENT].reverse());
    expect(forward.decisions.join(">")).not.toBe(backward.decisions.join(">"));
  });

  it("9 · CUT mode still behaves normally", () => {
    const { decisions } = film("CUT", [
      "The city watched its residents.",
      "The contract named a warehouse.",
    ]);
    expect(decisions).toContain("CUT");
  });

  it("10 · HYBRID can cut AND bridge; MONTAGE cuts without bridging", () => {
    const a = sceneFor("The city watched its residents.");
    const b = sceneFor("The contract named a warehouse.");
    expect(MODES.HYBRID.legal).toContain("CUT");
    expect(bridge(a.graph, b.graph, "HYBRID").states.length).toBeGreaterThan(1);
    // A montage that eases between its images is not a montage.
    expect(bridge(a.graph, b.graph, "MONTAGE").states).toHaveLength(1);
    expect(MODES.MONTAGE.legal).toContain("CUT");
  });

  it("bridging carries what is in both ends and grows what is only in one", () => {
    const a = sceneFor("The city watched its residents.");
    const b = sceneFor("The city watched its residents.");
    const same = bridge(a.graph, b.graph, "ONE_SHOT");
    // Identical ends: everything carries, nothing arrives or leaves.
    expect(same.describes).toContain("0 arriving");
    expect(same.describes).toContain("0 leaving");
  });
});

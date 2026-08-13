// THE PAIRED SEMANTIC SUITE — does meaning survive a change in language?
//
// The gallery is a design studio: it answers "does this look better".
// This answers the question the gallery cannot, and it is the one that
// decides whether the relational layer is real:
//
//   WHEN ONLY THE RELATIONSHIP CHANGES, DOES THE SCENE CHANGE?
//
// Every case below is a MINIMAL PAIR — the same two entities, the same
// nouns, one relational difference. If a pair produces the same scene the
// system is discarding semantic information, and no amount of rendering
// work will put it back. Asserted on the SCENE GRAPH rather than on
// pixels, deliberately: a regression here is a regression in meaning, and
// it should fail long before anyone looks at a frame.

import { describe, expect, it } from "vitest";
import { readRelation } from "../src/compile/relation.ts";
import { arrange, readScene } from "../src/compile/semantic-scene.ts";
import { detectSubjects } from "../src/compile/subject.ts";

function scene(sentence: string) {
  return readScene(sentence, detectSubjects(sentence), readRelation(sentence), null);
}

/** The scene's identity as a comparable string: which entities, in which
 *  order, under which relation, denied or not. Two sentences that differ
 *  in meaning must differ here. */
function signature(sentence: string) {
  const s = scene(sentence);
  const r = s.relations[0];
  return [
    s.entities.map((e) => e.text).join(">"),
    r ? `${r.kind}:${r.from}->${r.to}` : "none",
    s.negated ? "denied" : "asserted",
  ].join(" | ");
}

describe("paired semantics — only the relationship changes", () => {
  const PAIRS: Array<[string, string, string]> = [
    [
      "direction of observation",
      "The city watched its residents.",
      "The residents watched the city.",
    ],
    [
      "direction of containment",
      "The building contained the rooms.",
      "The rooms contained the building.",
    ],
    [
      "approach versus departure",
      "The camera approached the door.",
      "The camera moved away from the door.",
    ],
    [
      "connection versus its denial",
      "The cable connected the server.",
      "The cable never connected the server.",
    ],
    [
      "transformation versus its denial",
      "The record became the file.",
      "The record never became the file.",
    ],
    [
      "revealing versus concealing",
      "The screen revealed the room.",
      "The screen concealed the room.",
    ],
  ];

  for (const [what, a, b] of PAIRS) {
    it(`${what} — the two sentences do not produce the same scene`, () => {
      const sa = signature(a);
      const sb = signature(b);
      expect(sa, `"${a}" and "${b}" produced the same scene: ${sa}`).not.toBe(sb);
    });
  }

  /* THE ONE THAT MATTERS MOST. A reversal must not merely relabel the
   * entities — the ARRANGEMENT the two entities are placed into has to
   * follow the direction, or the film shows the same picture and calls
   * it something else. */
  it("reversing an observation reverses which entity dominates the frame", () => {
    const a = scene("The city watched its residents.");
    const b = scene("The residents watched the city.");
    const ra = a.relations[0];
    const rb = b.relations[0];
    expect(ra?.kind).toBe("OBSERVES");
    expect(rb?.kind).toBe("OBSERVES");
    // The FROM entity is the observer, and the arrangement gives it the
    // dominant place. So the two films observe from opposite ends.
    expect(a.entities[ra?.from ?? 0]?.text).not.toBe(b.entities[rb?.from ?? 0]?.text);
  });

  it("negation breaks the join rather than removing the relation", () => {
    const asserted = arrange("BECOMES", false);
    const denied = arrange("BECOMES", true);
    // Still a BECOMES — the sentence is ABOUT a transformation, and
    // saying it did not happen is not the same as saying nothing.
    expect(asserted.sight).toBe(true);
    expect(denied.sight).toBe(false);
    // And the terms are pushed apart, so the refusal is legible.
    expect(denied.from.x).toBeLessThan(asserted.from.x);
    expect(denied.to.x).toBeGreaterThan(asserted.to.x);
  });

  it("an aperture puts the revealed thing behind the surface, not beside it", () => {
    const a = arrange("REVEALS", false);
    // The surface fills more than the frame; the revealed thing is
    // smaller and nested inside it. That IS the relation.
    expect(a.nested).toBe(true);
    expect(a.from.scale).toBeGreaterThan(1);
    expect(a.to.scale).toBeLessThan(a.from.scale);
  });

  it("every relation kind produces a distinct arrangement", () => {
    const kinds = [
      "OBSERVES",
      "CONTAINS",
      "BECOMES",
      "OPPOSES",
      "ACCUMULATES",
      "CONNECTS",
      "EMERGES",
      "REVEALS",
      "CONCEALS",
      "APPROACHES",
      "DEPARTS",
    ] as const;
    const seen = new Map<string, string>();
    for (const k of kinds) {
      const a = arrange(k, false);
      const sig = JSON.stringify([a.from, a.to, a.sight, a.field, a.nested]);
      const clash = seen.get(sig);
      expect(clash, `${k} and ${clash} arrange identically`).toBeUndefined();
      seen.set(sig, k);
    }
  });
});

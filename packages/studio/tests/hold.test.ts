// WHAT A HOLD KEEPS, AND WHAT IT LETS GO.
//
// `HOLD` was one verb doing several jobs. A held scene's chain was the
// previous scene's chain node for node, and it never occurred to the first
// version that the chain might contain the promoted WORDS — so a line was
// allocated once and then held for its whole run. Measured on a real
// 65-scene essay: 42 scenes showed words, 27 of them by inheritance, and
// one line stood on screen across six consecutive scenes.
//
// Holding a GROUND while the argument develops is right. Holding a caption
// for half a minute is a subtitle that forgot to leave.

import { describe, expect, it } from "vitest";
import { type ComposedNode, composeAll } from "../src/compile/compose.ts";
import { EMPTY_FILM, type FilmState, rest } from "../src/compile/film-state.ts";
import { allocate } from "../src/compile/promote.ts";
import { CAMERA_STILL } from "../src/compile/scene-graph.ts";
import { segmentEssay } from "../src/compile/segment.ts";
import { parseIR } from "../src/ir/schema.ts";

/* Long enough for the allocator to run out of quota and start holding, and
 * argumentative enough that most of it names nothing depictable. */
const ESSAY = `# The Logic Costume

A method and a brand fail differently under pressure. A method, when it runs into a case reality will not cooperate with, produces an update. You were wrong, here is why, moving on. That costs almost nothing.

A brand cannot do that. Its authority is the outcome record, so when reality stops cooperating it must concede or manufacture the win. It is not a credential you get once.

The fallacy is not a lapse. It is a diagnosis. Nobody reasons perfectly under live pressure indefinitely. The base rate gets rolled enough times that a visible failure becomes a near certainty.

The position does not produce more distortion. It produces the only distortion anyone can catch. That position has to be re-earned constantly. Logic was just never the load-bearing thing.`;

function film() {
  const seed = segmentEssay(ESSAY, { projectId: "t", title: "The Logic Costume" });
  const parsed = parseIR(JSON.parse(JSON.stringify(seed.ir)));
  if (!parsed.ok) throw new Error(`fixture IR invalid: ${JSON.stringify(parsed.errors)}`);
  return { ir: parsed.ir, scenes: composeAll(parsed.ir), alloc: allocate(parsed.ir, null) };
}

const flat = (ns: ComposedNode[]): ComposedNode[] =>
  ns.flatMap((n) => [n, ...(n.ground ? flat(n.ground) : [])]);

/** What is actually on screen as words — read off the node params, with no
 *  reference to the scene's own phrase, because a held scene shows the
 *  STANDING scene's words and comparing against its own is how the first
 *  version of this measurement reported zero. */
const wordsOn = (nodes: ComposedNode[]): string[] =>
  flat(nodes).flatMap((n) =>
    Object.values(n.params).filter(
      (v): v is string => typeof v === "string" && v.trim().length > 8,
    ),
  );

describe("a hold keeps the picture and lets the words go", () => {
  it("no line stays on screen for more than its own scene and one more", () => {
    const { scenes } = film();
    const runs = new Map<string, number>();
    for (const s of scenes)
      for (const w of new Set(wordsOn(s.nodes))) {
        runs.set(w, (runs.get(w) ?? 0) + 1);
      }
    /* NOT VACUOUS. A film in which no line ever outlives its own scene
     * would pass the bound below without exercising the hold at all — so
     * assert first that words ARE being inherited, then that they stop. */
    expect(
      [...runs.values()].filter((n) => n > 1).length,
      "fixture should hold at least one line past its own scene",
    ).toBeGreaterThan(0);

    for (const [line, n] of runs) {
      /* The one stated exception, and it prints its own reason: where the
       * words are the BASE of the chain and everything is composited over
       * them, taking them out would hand the compositor nothing. */
      const painted = scenes.some((s) =>
        s.notes.some((x) => x.includes("painted into it rather than layered over it")),
      );
      expect(n, `"${line.slice(0, 40)}" stood for ${n} scenes`).toBeLessThanOrEqual(
        painted ? 3 : 2,
      );
    }
  });

  it("the film shows words on fewer scenes than it holds", () => {
    const { scenes, alloc } = film();
    const showing = scenes.filter((s) => wordsOn(s.nodes).length > 0).length;
    const allocatedText = alloc.filter((a) => a.kind === "TEXT").length;
    const held = scenes.filter((s) => s.held && s.nodes.length > 0).length;
    expect(allocatedText, "fixture should promote something").toBeGreaterThan(0);
    expect(held, "fixture should hold something").toBeGreaterThan(0);
    // The words may outlive their own scene by one, and no further — so the
    // count sits between what was allocated and twice it, never at
    // allocated + every hold in the film.
    expect(showing).toBeGreaterThanOrEqual(allocatedText);
    expect(showing).toBeLessThan(allocatedText + held);
  });

  it("keeps holding the picture — this is not a way of drawing less", () => {
    const { scenes } = film();
    const heldScenes = scenes.filter((s) => s.held && s.nodes.length > 0);
    expect(heldScenes.length).toBeGreaterThan(0);
    // Every held scene still draws something. Taking the caption out must
    // never empty a chain, or the hold has become a second kind of silence.
    for (const s of heldScenes) {
      expect(s.nodes.length, `${s.sceneId} held nothing`).toBeGreaterThan(0);
    }
  });

  it("a held scene reports the picture it is actually showing", () => {
    /* `program` is the VISUAL IDEA the Preview prints and what the Compile
     * view audits the chain against. A held scene that kept its OWN program
     * was reporting a picture it did not draw. */
    const { scenes } = film();
    for (const s of scenes) {
      if (!s.held || s.nodes.length === 0) continue;
      const standing = scenes
        .slice(0, scenes.indexOf(s))
        .reverse()
        .find((c) => c.nodes.length > 0);
      if (standing) expect(s.program?.construction).toBe(standing.program?.construction);
    }
  });

  it("costs what it is drawing, not what it inherited", () => {
    const { scenes } = film();
    for (const s of scenes) {
      if (s.nodes.length === 0) expect(s.costMsPerFrame).toBe(0);
      else expect(s.costMsPerFrame).toBeGreaterThan(0);
    }
  });
});

describe("silence is not a pause in the film's clock", () => {
  it("time passes while nothing is on screen", () => {
    /* A silent scene returns before the world block, so the film did not
     * age: `sceneIndex` stayed put, `lastSeen` did not move further away,
     * and every RECALL window silently extended by the length of the
     * silence. A film quiet for four scenes then read a twelve-scene-old
     * identity as eight scenes old. */
    const before = { ...EMPTY_FILM, sceneIndex: 3 };
    const after = rest(before);
    expect(after.sceneIndex).toBe(4);
  });

  it("but the world is not cleared by it", () => {
    const state: FilmState = {
      alive: [
        {
          identity: "city",
          element: {
            role: "PRIMARY",
            ops: ["PLACE"],
            place: { scale: 1, x: 0.5, y: 0.5, crop: 0 },
            depth: 0.5,
            depicts: "city",
            reason: "hand-built for this test",
          },
          bornAt: 0,
          lastSeen: 2,
          multiplicity: 1,
          material: 0,
        },
      ],
      retired: [],
      sceneIndex: 3,
      camera: CAMERA_STILL,
    };
    const after = rest(state);
    expect(after.alive).toHaveLength(1);
    expect(after.alive[0]?.identity).toBe("city");
    expect(after.retired).toHaveLength(0);
  });
});

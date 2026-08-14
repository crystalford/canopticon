// THE WORLD, ON THE PLAN — not in the vocabulary.
//
// `film-state.ts` and `film-mode.ts` had 21 passing tests before a single
// line of either reached the compiler. That is the shape of standing rule
// 10: a capability with a green suite and no caller. So every assertion in
// this file goes through `composeAll` and reads what a RENDERER would get,
// the same discipline `scene-survives.test.ts` established.

import { describe, expect, it } from "vitest";
import { type ComposedNode, composeAll } from "../src/compile/compose.ts";
import { bridgeSignature, hashPayload } from "../src/compile/hash.ts";
import { compile } from "../src/compile/index.ts";
import { segmentEssay } from "../src/compile/segment.ts";
import { type EditorialIR, parseIR } from "../src/ir/schema.ts";
import type { FilmTimeline } from "../src/narrate/timeline.ts";

/* A paragraph that names things the lexicon knows, refers back to them,
 * loses them and asks for them again — which is the whole continuity
 * vocabulary in six sentences. */
const ESSAY = `# The City

The residents watched the city from the tower.
They walked around the city like insects, moving through the streets.
Then there were dozens of them, moving in strange synchronized waves.
The camera in the corridor recorded every door.
Years later the city forgot its residents.
The tower still stands.`;

function irFor(
  continuity: EditorialIR["continuity"],
  visualApproach: EditorialIR["visualApproach"] = "world",
): EditorialIR {
  const seed = segmentEssay(ESSAY, { projectId: "proj_world" });
  const parsed = parseIR(JSON.parse(JSON.stringify({ ...seed.ir, continuity, visualApproach })));
  if (!parsed.ok) throw new Error(`fixture IR invalid: ${JSON.stringify(parsed.errors)}`);
  return parsed.ir;
}

/** A film whose every window is measured and whose every scene is preceded
 *  by 600ms of silence. Hand-built rather than narrated, because a test
 *  that spent TTS would not be a test. */
function measuredTimeline(ir: EditorialIR, leadPauseMs = 600): FilmTimeline {
  return {
    totalMs: ir.scenes.length * 4000,
    measuredMs: ir.scenes.length * 4000,
    scenes: ir.scenes.map((s, i) => ({
      sceneId: s.sceneId,
      startMs: i * 4000,
      endMs: i * 4000 + 4000,
      durationMs: 4000,
      source: "measured" as const,
      leadPauseMs: i === 0 ? 0 : leadPauseMs,
      wordsPerMin: 150,
      relativeRate: 1,
      words: [],
    })),
    pauses: [],
    medianWordsPerMin: 150,
    spine: "measured",
    wordTimedScenes: 0,
    describes: "hand-built for this test",
  };
}

/** Every node the renderer will touch, grounds included. A bridge attached
 *  only to the element drawn first would pass a top-level check and reach
 *  one layer of a five-layer scene. */
const flat = (ns: ComposedNode[]): ComposedNode[] =>
  ns.flatMap((n) => [n, ...(n.ground ? flat(n.ground) : [])]);

/** Every node's hash payload, film-wide — the exact strings the cache
 *  compares. Read rather than the digests so a failure shows WHAT differed. */
const signatures = (scenes: ReturnType<typeof composeAll>): string[] =>
  scenes.flatMap((s) =>
    flat(s.nodes).map((n) =>
      hashPayload({
        primitiveId: n.primitiveId,
        params: n.params,
        seed: n.seed,
        startMs: 0,
        endMs: 4000,
        assetHashes: [],
        ...(n.tween && n.tweenMs ? { bridge: bridgeSignature(n.tween, n.tweenMs) } : {}),
      }),
    ),
  );

describe("the world reaches the compiler", () => {
  it("carries identities across scenes rather than composing from nothing", () => {
    const scenes = composeAll(irFor("oneshot"));
    const decided = scenes.flatMap((s) => s.world?.decisions ?? []);
    expect(decided.length).toBeGreaterThan(0);
    // The city is named in s001, absent by s004, and asked for again in
    // s005. A film with no memory would meet it as a stranger.
    const recalls = decided.filter((d) => d.what === "RECALL");
    expect(recalls.map((d) => d.identity)).toContain("city");
  });

  it("a persistent identity keeps the place the film left it", () => {
    const scenes = composeAll(irFor("oneshot"));
    const continued = scenes.find((s) => s.world?.decisions.some((d) => d.what === "CONTINUE"));
    expect(continued).toBeDefined();
    // CONTINUE inherits x and y exactly — see `advance()`. So the bridge
    // for that element carries no positional move, which is the assertion:
    // it did not jump to where a fresh composition would have put it.
    const moved = flat(continued?.nodes ?? []).filter((n) => n.tween?.x || n.tween?.y);
    expect(moved).toHaveLength(0);
  });

  it("ONE_SHOT never cuts", () => {
    const scenes = composeAll(irFor("oneshot"));
    expect(scenes.every((s) => s.world?.cut === false)).toBe(true);
    expect(scenes.flatMap((s) => s.world?.decisions ?? []).some((d) => d.what === "CUT")).toBe(
      false,
    );
  });

  it("the WORLD approach draws one world — every scene, not most of them", () => {
    // The measured failure this exists for: with the state threaded but
    // the construction left to compete on its ordinary weight, a six-scene
    // world film drew `scene · body · body · fixture · space · scene` and
    // the picture restarted four times while the identities persisted
    // perfectly. Persistence nothing can see is not continuity.
    const scenes = composeAll(irFor("cut", "world"));
    expect(scenes.map((s) => s.program?.construction)).toEqual(scenes.map(() => "scene"));
  });

  it("editing does not decide what the picture is made of", () => {
    /* THE CONFLATION THIS TEST EXISTS TO PREVENT.
     *
     * The first version of the world made ONE_SHOT force the scene-graph
     * construction, which quietly meant "never cut" chose the picture. A
     * text-driven continuous film and a hard-cutting world film were both
     * unreachable. Two axes: `visualApproach` decides what the picture is
     * made of, `continuity` decides whether the film cuts. */
    for (const approach of ["hybrid", "text", "abstract", "world"] as const) {
      const cutFilm = composeAll(irFor("cut", approach));
      const oneShot = composeAll(irFor("oneshot", approach));
      expect(oneShot.map((s) => s.program?.construction)).toEqual(
        cutFilm.map((s) => s.program?.construction),
      );
    }
    // And the approaches genuinely differ from each other, or the axis
    // would be a label rather than a control.
    const modes = (a: "text" | "abstract" | "world") =>
      composeAll(irFor("cut", a))
        .map((s) => s.program?.mode)
        .join(" ");
    expect(modes("text")).not.toEqual(modes("abstract"));
    expect(modes("abstract")).not.toEqual(modes("world"));
    expect(modes("text")).toContain("typographic");
  });

  it("a figure still outranks the approach, because a figure is checkable", () => {
    // The whole reason the approach is a WEIGHTING. An essay that prints a
    // quantity reaches the family that can show it whatever the director
    // asked the film to be made of — an approximation of $282,345.84 is a
    // different finding.
    const seed = segmentEssay(
      "# Cost\n\nThe programme cost $282,345.84 across nine numbered rooms.",
      { projectId: "proj_fig" },
    );
    for (const approach of ["text", "abstract", "world"] as const) {
      const p = parseIR(JSON.parse(JSON.stringify({ ...seed.ir, visualApproach: approach })));
      if (!p.ok) throw new Error(JSON.stringify(p.errors));
      const scene = composeAll(p.ir)[0];
      expect(scene?.phrase.text).toContain("282,345.84");
    }
  });

  it("a CUT film composes exactly as it did before the world existed", () => {
    // The world still ADVANCES in a cut film — identity is remembered — but
    // it must not move which construction wins or where anything sits, or
    // this change would have restyled every film already made.
    const cut = composeAll(irFor("cut"));
    expect(cut.every((s) => s.world !== null)).toBe(true);
    expect(flat(cut.flatMap((s) => s.nodes)).every((n) => !n.tween)).toBe(true);
  });
});

describe("the bridge", () => {
  it("runs in the measured silence, and nowhere else", () => {
    const ir = irFor("oneshot");
    const withVoice = composeAll(ir, measuredTimeline(ir));
    const silent = composeAll(ir, null);

    const bridged = withVoice.filter((s) => (s.world?.bridgeMs ?? 0) > 0);
    expect(bridged.length).toBeGreaterThan(0);
    // No narration means no measured pause, so there is nothing to arrive
    // between. Reported as zero rather than filled in with a default.
    expect(silent.every((s) => (s.world?.bridgeMs ?? 0) === 0)).toBe(true);
    expect(flat(silent.flatMap((s) => s.nodes)).every((n) => !n.tween)).toBe(true);
  });

  it("reaches the nodes a renderer will actually run", () => {
    const ir = irFor("oneshot");
    const scenes = composeAll(ir, measuredTimeline(ir));
    const tweened = scenes.flatMap((s) => flat(s.nodes)).filter((n) => n.tween);
    expect(tweened.length).toBeGreaterThan(0);
    for (const n of tweened) {
      // Only `place` has been verified to read its params inside frame(),
      // which is what makes a live tween act at all.
      expect(n.primitiveId).toBe("place");
      expect(n.tweenMs).toBeGreaterThan(0);
      for (const pair of Object.values(n.tween ?? {})) {
        expect(pair).toHaveLength(2);
        // An inert tween in the plan is worse than none: it would put a
        // move in the hash and in the report that nothing performs.
        expect(pair[0]).not.toBe(pair[1]);
      }
    }
  });

  it("is bounded by the scene it plays in", () => {
    const ir = irFor("oneshot");
    // A four-second scene may not spend eight seconds arriving.
    const scenes = composeAll(ir, measuredTimeline(ir, 8000));
    for (const s of scenes) {
      expect(s.world?.bridgeMs ?? 0).toBeLessThanOrEqual(4000 * 0.4 + 1);
    }
  });

  it("changes the hash, so a re-narrated film stops rendering the old motion", async () => {
    const ir = irFor("oneshot");
    const short = await compile(ir, { alignments: new Map() });
    // Same IR, same parameters, same seeds — only the measured silence
    // differs. Without the bridge in the payload every hash would match and
    // the film would keep rendering a move nobody asked for any more.
    const a = signatures(composeAll(ir, measuredTimeline(ir, 400)));
    const b = signatures(composeAll(ir, measuredTimeline(ir, 1600)));
    expect(a).not.toEqual(b);
    // And it is stable: the same measurement always signs the same way.
    expect(a).toEqual(signatures(composeAll(ir, measuredTimeline(ir, 400))));
    expect(short.timeline.spine).toBe("nominal");
  });

  it("a montage never bridges — that is what a montage is for", () => {
    const ir = irFor("montage");
    const scenes = composeAll(ir, measuredTimeline(ir));
    expect(scenes.every((s) => (s.world?.bridgeMs ?? 0) === 0)).toBe(true);
    expect(flat(scenes.flatMap((s) => s.nodes)).every((n) => !n.tween)).toBe(true);
  });
});

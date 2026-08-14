// THE NARRATION SPINE — and the distinction the compiler used to erase.
//
// `compile()` fills a nominal Alignment for every scene that has not been
// recorded, and after that pass nothing downstream could tell an estimate
// from a measurement. A film with no voice presented invented windows with
// exactly the confidence of recorded ones. These tests are about that
// distinction being visible, and about the silence being usable.

import { describe, expect, it } from "vitest";
import { compile } from "../src/compile/index.ts";
import type { Alignment } from "../src/compile/solver.ts";
import { bridgeMsFor, buildTimeline } from "../src/narrate/timeline.ts";
import { buildFixtureIR } from "./fixture.ts";

/** A frozen alignment as `loadAlignments` + `sequenceAlignments` hand it to
 *  the compiler: scene-local times, one chunk per sentence. */
function aligned(sceneId: string, chunks: Array<[number, number]>): Alignment {
  return {
    sceneId,
    chunks: chunks.map(([startMs, endMs], i) => ({
      chunkId: `${sceneId}_c${i}`,
      startMs,
      endMs,
    })),
  };
}

describe("the spine says which windows are real", () => {
  it("an un-narrated film reports nominal, and says so in the warnings", async () => {
    const report = await compile(buildFixtureIR());
    expect(report.timeline.spine).toBe("nominal");
    expect(report.timeline.measuredMs).toBe(0);
    expect(report.timeline.scenes.every((s) => s.source === "nominal")).toBe(true);
    expect(report.timeline.describes).toContain("estimate");
    // Once, at film level. Thirty-six instances of `missing_alignment` is
    // a per-scene flag, not a statement about the film.
    expect(report.warnings.some((w) => w.startsWith("NARRATION —"))).toBe(true);
  });

  it("a partly narrated film reports mixed rather than rounding either way", async () => {
    const ir = buildFixtureIR();
    const first = ir.scenes[0];
    if (!first) throw new Error("fixture has no scenes");
    const report = await compile(ir, {
      alignments: new Map([[first.sceneId, aligned(first.sceneId, [[0, 3200]])]]),
    });
    expect(report.timeline.spine).toBe("mixed");
    expect(report.timeline.scenes.filter((s) => s.source === "measured")).toHaveLength(1);
    expect(report.timeline.measuredMs).toBeGreaterThan(0);
  });

  it("a fully narrated film reports measured", async () => {
    const ir = buildFixtureIR();
    const alignments = new Map(ir.scenes.map((s) => [s.sceneId, aligned(s.sceneId, [[0, 3000]])]));
    const report = await compile(ir, { alignments });
    expect(report.timeline.spine).toBe("measured");
  });
});

describe("the silence is measured, not assumed", () => {
  it("a gap between two recorded scenes becomes a pause and a lead-in", () => {
    const ir = buildFixtureIR();
    const [a, b] = ir.scenes;
    if (!a || !b) throw new Error("fixture needs two scenes");
    const alignments = new Map([
      [a.sceneId, aligned(a.sceneId, [[0, 2400]])],
      [b.sceneId, aligned(b.sceneId, [[0, 2400]])],
    ]);
    // The solver's own windows, stubbed: scene A speaks until 2400 and
    // scene B starts at 3000, so 600ms of the film is silence.
    const timing = {
      scenes: [
        {
          sceneId: a.sceneId,
          startMs: 0,
          endMs: 3000,
          durationMs: 3000,
          shots: [],
          splits: [],
          flags: [],
          explanation: "",
        },
        {
          sceneId: b.sceneId,
          startMs: 3000,
          endMs: 6000,
          durationMs: 3000,
          shots: [],
          splits: [],
          flags: [],
          explanation: "",
        },
      ],
      runtimeMs: 6000,
      warnings: [],
    };
    const tl = buildTimeline(ir, alignments, timing, new Set([a.sceneId, b.sceneId]));
    const second = tl.scenes.find((s) => s.sceneId === b.sceneId);
    expect(second?.leadPauseMs).toBe(600);
    expect(tl.pauses.some((p) => p.beforeSceneId === b.sceneId && p.ms === 600)).toBe(true);
  });

  it("a gap next to an invented window is not counted", () => {
    const ir = buildFixtureIR();
    const [a, b] = ir.scenes;
    if (!a || !b) throw new Error("fixture needs two scenes");
    const alignments = new Map([[a.sceneId, aligned(a.sceneId, [[0, 2400]])]]);
    const timing = {
      scenes: [
        {
          sceneId: a.sceneId,
          startMs: 0,
          endMs: 3000,
          durationMs: 3000,
          shots: [],
          splits: [],
          flags: [],
          explanation: "",
        },
        {
          sceneId: b.sceneId,
          startMs: 3000,
          endMs: 6000,
          durationMs: 3000,
          shots: [],
          splits: [],
          flags: [],
          explanation: "",
        },
      ],
      runtimeMs: 6000,
      warnings: [],
    };
    // A silence measured against a guess is a fact about the guess.
    const tl = buildTimeline(ir, alignments, timing, new Set([a.sceneId]));
    expect(tl.scenes.find((s) => s.sceneId === b.sceneId)?.leadPauseMs).toBe(0);
  });

  it("the bridge takes the pause, capped by the scene it plays in", () => {
    const scene = {
      sceneId: "s1",
      startMs: 0,
      endMs: 2000,
      durationMs: 2000,
      source: "measured" as const,
      leadPauseMs: 1600,
      wordsPerMin: 150,
      relativeRate: 1,
    };
    // 1600ms of rest, but a two-second scene may not spend four fifths of
    // itself arriving.
    expect(bridgeMsFor(scene)).toBe(800);
    expect(bridgeMsFor({ ...scene, leadPauseMs: 0 })).toBe(0);
  });
});

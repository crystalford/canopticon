// Per-shot variation. The properties that matter are that a sequence
// CHANGES across its cuts, BUILDS rather than wanders, and stays
// deterministic so a cut can be cached.

import { describe, expect, it } from "vitest";
import { compile } from "../src/compile/index.ts";
import { fragmentLine, planShots } from "../src/compile/shot-plan.ts";
import { buildFixtureIR } from "./fixture.ts";
import { must } from "./must.ts";

const LINE = "The interface is a friction surface";
const base = { line: LINE, shotCount: 6, sceneIndex: 0, intensity: 0.7, contested: false };

describe("fragmenting a line", () => {
  it("never leaves a weak word alone on a plate", () => {
    for (const f of fragmentLine(LINE)) {
      expect(f.length).toBeGreaterThan(3);
      expect(["THE", "IS", "A"]).not.toContain(f);
    }
  });

  it("keeps the words, in order", () => {
    const joined = fragmentLine(LINE).join(" ");
    expect(joined).toBe(LINE.toUpperCase());
  });

  it("survives a line with nothing in it", () => {
    expect(fragmentLine("").length).toBeGreaterThan(0);
    expect(fragmentLine("   ,,,  ").length).toBeGreaterThan(0);
  });
});

describe("planning a sequence", () => {
  it("changes something across every cut", () => {
    // The failure this exists to prevent: six shots that are one continuous
    // image with a stutter in it.
    const shots = planShots(base);
    for (let i = 1; i < shots.length; i++) {
      const a = must(shots[i - 1], "prev");
      const b = must(shots[i], "shot");
      const changed =
        a.text !== b.text || a.mode !== b.mode || a.invert !== b.invert || a.amount !== b.amount;
      expect(changed, `shot ${i} is identical to ${i - 1}`).toBe(true);
    }
  });

  it("builds rather than wanders", () => {
    const shots = planShots(base);
    expect(must(shots[shots.length - 1], "last").amount).toBeGreaterThan(
      must(shots[0], "first").amount,
    );
  });

  it("flips plates in runs, not alternately", () => {
    // An every-other-frame flip becomes a texture the eye stops reading.
    const inverts = planShots({ ...base, shotCount: 8 }).map((s) => s.invert);
    let alternating = true;
    for (let i = 1; i < inverts.length; i++) {
      if (inverts[i] === inverts[i - 1]) alternating = false;
    }
    expect(alternating).toBe(false);
    // But it does flip at all.
    expect(new Set(inverts).size).toBe(2);
  });

  it("holds a contested line flatter than a stated one", () => {
    // Dramatising a claim into looking like a finding is the one distortion
    // that actually lies.
    const stated = planShots(base);
    const claimed = planShots({ ...base, contested: true });
    const peak = (s: typeof stated) => Math.max(...s.map((x) => x.amount));
    expect(peak(claimed)).toBeLessThan(peak(stated));
  });

  it("opens two scenes on different treatments", () => {
    const a = must(planShots(base)[0], "a");
    const b = must(planShots({ ...base, sceneIndex: 1 })[0], "b");
    expect(a.mode).not.toBe(b.mode);
  });

  it("is deterministic", () => {
    expect(JSON.stringify(planShots(base))).toBe(JSON.stringify(planShots(base)));
  });

  it("handles a single-shot scene without dividing by zero", () => {
    const one = planShots({ ...base, shotCount: 1 });
    expect(one).toHaveLength(1);
    expect(Number.isFinite(must(one[0], "shot").amount)).toBe(true);
  });

  it("uses rotation as an accent, never as a texture", () => {
    const rotated = planShots({ ...base, shotCount: 12 }).filter((s) => s.rotate > 0);
    expect(rotated.length).toBeLessThan(4);
  });
});

describe("cut plans inside the compile pipeline", () => {
  it("plans cuts only for scenes the solver actually cut", async () => {
    const ir = buildFixtureIR();
    ir.creativeState.identity.cutRhythm = 0.8;
    const report = await compile(ir);
    for (const plan of report.shotPlans) {
      const solved = must(
        report.timing.scenes.find((s) => s.sceneId === plan.sceneId),
        "solved",
      );
      if (solved.shots.length > 1) expect(plan.shots.length).toBe(solved.shots.length);
      else expect(plan.shots).toEqual([]);
    }
  });

  it("re-cutting the film recomputes — the cut is part of what a scene is", async () => {
    // Without the cut plan in the hash, changing the edit would leave every
    // node unchanged and the film would keep rendering the old cut. Same
    // class of bug as narration text not reaching the hash.
    const slow = buildFixtureIR();
    slow.creativeState.identity.cutRhythm = 0.3;
    const first = await compile(slow);

    const fast = buildFixtureIR();
    fast.creativeState.identity.cutRhythm = 0.9;
    const second = await compile(fast, { snapshot: first.snapshot });

    expect(second.cache.misses).toBeGreaterThan(0);
  });

  it("an unchanged cut still hits the cache completely", async () => {
    const ir = buildFixtureIR();
    ir.creativeState.identity.cutRhythm = 0.6;
    const first = await compile(ir);
    const second = await compile(buildFixtureIR(), { snapshot: first.snapshot });
    // Same IR, same rhythm — nothing should recompute.
    const again = await compile(ir, { snapshot: first.snapshot });
    expect(again.cache.misses).toBe(0);
    expect(second).toBeDefined();
  });

  it("holds a contested scene's cut flatter than a stated one", async () => {
    const ir = buildFixtureIR();
    ir.creativeState.identity.cutRhythm = 0.8;
    const report = await compile(ir);

    const contestedIds = ir.scenes.filter((s) => s.reading?.contested).map((s) => s.sceneId);
    const statedIds = ir.scenes
      .filter((s) => s.reading && !s.reading.contested)
      .map((s) => s.sceneId);

    const peak = (ids: string[]) =>
      Math.max(
        0,
        ...report.shotPlans
          .filter((p) => ids.includes(p.sceneId))
          .flatMap((p) => p.shots.map((v) => v.amount)),
      );

    if (contestedIds.length > 0 && statedIds.length > 0) {
      expect(peak(contestedIds)).toBeLessThanOrEqual(peak(statedIds));
    }
  });
});

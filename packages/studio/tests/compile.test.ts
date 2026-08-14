// Stage 1 milestone, as executable checks.
//
// The milestone is: a hand-authored IR resolves to correct time windows,
// and re-running with one changed value produces the correct cache
// hit/miss set. These tests also encode acceptance criteria 6, 8, 9 —
// incremental rebuild, motifs developing under a re-direct, and a pin
// surviving a restyle with the tension reported rather than resolved.

import { describe, expect, it } from "vitest";
import { composeAll } from "../src/compile/compose.ts";
import { controlPointPositions, resolveStateAt } from "../src/compile/creative-state.ts";
import { buildFilmPlan } from "../src/compile/film.ts";
import { canonicalJSON, nodeHash } from "../src/compile/hash.ts";
import { compile } from "../src/compile/index.ts";
import { nominalAlignment, solveTiming, splitSentences } from "../src/compile/solver.ts";
import { parseIR } from "../src/ir/schema.ts";
import {
  PRIMITIVES,
  PRIMITIVE_IDS,
  canChain,
  chainDeterminism,
} from "../src/primitives/registry.ts";
import { buildFixtureIR } from "./fixture.ts";
import { must } from "./must.ts";

describe("IR validation", () => {
  it("accepts the fixture", () => {
    const parsed = parseIR(buildFixtureIR());
    expect(parsed.ok).toBe(true);
  });

  it("rejects a scene pointing at an act that does not exist", () => {
    const ir = buildFixtureIR();
    must(ir.scenes[0]).actId = "act_nope";
    const parsed = parseIR(ir);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.some((e) => e.message.includes("unknown act"))).toBe(true);
    }
  });

  it("rejects a source range outside the essay", () => {
    const ir = buildFixtureIR();
    must(ir.scenes[0]).sourceRange = { startChar: 0, endChar: 999_999 };
    const parsed = parseIR(ir);
    expect(parsed.ok).toBe(false);
  });

  it("rejects an override naming a scene that does not exist", () => {
    const ir = buildFixtureIR();
    must(ir.overrides[0]).sceneId = "s99";
    const parsed = parseIR(ir);
    expect(parsed.ok).toBe(false);
  });
});

describe("creative state", () => {
  it("interpolates between control points and honours invariants", () => {
    const ir = buildFixtureIR();
    const positions = controlPointPositions(ir);
    const start = resolveStateAt(ir, 0, positions);
    const end = resolveStateAt(ir, 1, positions);
    expect(must(start.values.abstraction)).toBeLessThan(0.2);
    expect(must(end.values.abstraction)).toBeGreaterThan(0.8);
  });

  it("reports an invariant when it actually bites", () => {
    const ir = buildFixtureIR();
    // Ask for a human presence the floor forbids.
    for (const cp of ir.creativeState.controlPoints) cp.values.humanPresence = 0.05;
    const state = resolveStateAt(ir, 0.5);
    expect(state.values.humanPresence).toBe(0.3);
    expect(state.held.join(" ")).toContain("humanPresence floored");
  });

  it("falls back to identity for parameters no curve mentions", () => {
    const ir = buildFixtureIR();
    const state = resolveStateAt(ir, 0.5);
    expect(state.values.typographicWeight).toBeCloseTo(0.63, 5);
  });
});

describe("constraint solver", () => {
  it("resolves anchors to real windows in document order", () => {
    const ir = buildFixtureIR();
    const alignments = new Map(
      ir.scenes.map((s, i) => [s.sceneId, nominalAlignment(s, i * 5000, 4000)] as const),
    );
    const result = solveTiming(ir, alignments);
    expect(result.scenes).toHaveLength(ir.scenes.length);
    for (let i = 1; i < result.scenes.length; i++) {
      // No gaps and no overlaps once the cascade has run.
      expect(must(result.scenes[i]).startMs).toBe(must(result.scenes[i - 1]).endMs);
    }
    expect(result.runtimeMs).toBeGreaterThan(0);
  });

  it("auto-splits a scene whose narration outruns a single visual", () => {
    const ir = buildFixtureIR();
    // Lay every scene out end to end, the way a real alignment would, so
    // the cascade has no slack to absorb and s09 keeps its long window.
    const alignments = new Map<string, ReturnType<typeof nominalAlignment>>();
    let at = 0;
    for (const scene of ir.scenes) {
      const durationMs = scene.sceneId === "s09" ? 26_000 : 4000;
      alignments.set(scene.sceneId, nominalAlignment(scene, at, durationMs));
      at += durationMs;
    }

    const result = solveTiming(ir, alignments);
    const solved = must(
      result.scenes.find((s) => s.sceneId === "s09"),
      "solved s09",
    );

    expect(solved.durationMs).toBeGreaterThan(12_000);
    expect(solved.flags).toContain("auto_split");
    expect(solved.splits.length).toBeGreaterThan(1);
    expect(solved.explanation).toContain("auto-split");

    // Sub-windows tile the scene's FINAL window — no gap at either end,
    // and none of them stranded outside the scene by the cascade.
    expect(must(solved.splits[0]).startMs).toBe(solved.startMs);
    expect(must(solved.splits[solved.splits.length - 1]).endMs).toBe(solved.endMs);
    for (let i = 1; i < solved.splits.length; i++) {
      expect(must(solved.splits[i]).startMs).toBe(must(solved.splits[i - 1]).endMs);
    }
  });

  it("flags an underrun when no elastic neighbour can absorb it", () => {
    const ir = buildFixtureIR();
    // A very short window on the last scene — nothing downstream to borrow.
    const last = must(ir.scenes[ir.scenes.length - 1], "last scene");
    last.timing.minDurationMs = 0;
    const alignments = new Map([[last.sceneId, nominalAlignment(last, 0, 400)]]);
    const result = solveTiming(ir, alignments);
    const solved = must(
      result.scenes.find((s) => s.sceneId === last.sceneId),
      "solved last",
    );
    expect(solved.flags.some((f) => f === "underrun" || f === "j_cut")).toBe(true);
  });

  it("never emits a negative duration even from inverted anchors", () => {
    const ir = buildFixtureIR();
    const scene = must(ir.scenes[0], "first scene");
    scene.timing.startAnchor = { chunkId: "s01_c1", offsetMs: 9000 };
    scene.timing.endAnchor = { chunkId: "s01_c1", offsetMs: 0 };
    const alignments = new Map([[scene.sceneId, nominalAlignment(scene, 0, 3000)]]);
    const result = solveTiming(ir, alignments);
    for (const s of result.scenes) expect(s.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("splits sentences losslessly", () => {
    const parts = splitSentences("One. Two! Three? Four");
    expect(parts).toEqual(["One.", "Two!", "Three?", "Four"]);
  });
});

describe("composition engine", () => {
  it("climbs the abstraction ladder across the film", () => {
    const ir = buildFixtureIR();
    const composed = composeAll(ir);
    const first = must(composed[0], "first scene");
    const last = must(composed[composed.length - 1], "last scene");
    expect(first.tier).toBe("GROUNDED");
    expect(last.abstraction).toBeGreaterThan(first.abstraction);
  });

  it("clamps Act I with the hard rule even when the curve demands more", () => {
    const ir = buildFixtureIR();
    for (const cp of ir.creativeState.controlPoints) cp.values.abstraction = 0.99;
    const composed = composeAll(ir);
    const act1 = composed.filter((c) => c.actId === "act_1");
    for (const scene of act1) {
      expect(scene.abstraction).toBeLessThanOrEqual(0.3);
      expect(scene.ruleHits.some((h) => h.ruleId === "r1")).toBe(true);
    }
  });

  it("holds EVIDENCE scenes under the narrative guard", () => {
    const ir = buildFixtureIR();
    for (const cp of ir.creativeState.controlPoints) cp.values.abstraction = 0.99;
    const composed = composeAll(ir);
    const evidenceInAct3 = must(
      composed.find((c) => c.sceneId === "s08"),
      "s08",
    );
    expect(evidenceInAct3.abstraction).toBeLessThanOrEqual(0.6);
    expect(evidenceInAct3.ruleHits.some((h) => h.ruleId === "r4")).toBe(true);
  });

  it("develops motifs rather than resetting them", () => {
    const ir = buildFixtureIR();
    const low = composeAll(ir);
    const lowTime = must(
      must(
        low.find((c) => c.sceneId === "s10"),
        "s10",
      ).motifs.find((m) => m.motifId === "time"),
      "time motif",
    );

    for (const cp of ir.creativeState.controlPoints) {
      cp.values.abstraction = Math.min(1, (cp.values.abstraction ?? 0) + 0.4);
    }
    const high = composeAll(ir);
    const highTime = must(
      must(
        high.find((c) => c.sceneId === "s10"),
        "s10",
      ).motifs.find((m) => m.motifId === "time"),
      "time motif",
    );

    // Same motif identity, escalated state — never a different motif.
    expect(highTime.motifId).toBe(lowTime.motifId);
    expect(highTime.stateIndex).toBeGreaterThanOrEqual(lowTime.stateIndex);
  });

  it("honours a pin exactly, at any abstraction", () => {
    const ir = buildFixtureIR();
    for (const cp of ir.creativeState.controlPoints) cp.values.abstraction = 0.99;
    const composed = composeAll(ir);
    const pinned = must(
      composed.find((c) => c.sceneId === "s07"),
      "pinned s07",
    );
    expect(pinned.nodes.map((n) => n.primitiveId)).toEqual([
      "document_surface",
      "document_layout",
      "annotation",
    ]);
    expect(pinned.notes.join(" ")).toContain("pinned");
  });

  it("does not leave stale composition notes on a pinned scene", () => {
    const ir = buildFixtureIR();
    for (const cp of ir.creativeState.controlPoints) {
      cp.values.abstraction = 0.99;
      cp.values.visualDensity = 0.9;
    }
    const pinned = must(
      composeAll(ir).find((c) => c.sceneId === "s07"),
      "pinned s07",
    );
    // The engine's own pre-pin reasoning must not survive as an
    // explanation for a chain the pin replaced.
    expect(pinned.notes.some((n) => n.includes("restraint ceiling"))).toBe(false);
    expect(pinned.nodes.every((n) => n.reason === "pinned by the director")).toBe(true);
  });

  it("only uses primitives that exist in the palette", () => {
    const ir = buildFixtureIR();
    const known = new Set(PRIMITIVE_IDS);
    for (const scene of composeAll(ir)) {
      for (const node of scene.nodes) expect(known.has(node.primitiveId)).toBe(true);
    }
  });

  it("claims determinism as the weakest primitive in the chain", () => {
    expect(chainDeterminism(["document_surface", "camera_move"])).toBe("L2");
    expect(chainDeterminism(["document_surface", "shader_surface"])).toBe("L2-GPU");
    expect(chainDeterminism([])).toBe("L1");
  });
});

describe("hashing", () => {
  it("sorts object keys so equivalent params hash identically", () => {
    expect(canonicalJSON({ b: 2, a: 1 })).toBe(canonicalJSON({ a: 1, b: 2 }));
  });

  it("changes the hash when a parameter changes", async () => {
    const base = {
      primitiveId: "particle_seek",
      params: { abstraction: 0.4 },
      seed: 1,
      startMs: 0,
      endMs: 1000,
      assetHashes: [],
    };
    const a = await nodeHash(base);
    const b = await nodeHash({ ...base, params: { abstraction: 0.5 } });
    expect(a).not.toBe(b);
  });

  it("hashes identically across scenes when the node is identical", async () => {
    const node = {
      primitiveId: "noise_field",
      params: { abstraction: 0.4 },
      seed: 7,
      startMs: 0,
      endMs: 1000,
      assetHashes: [],
    };
    expect(await nodeHash(node)).toBe(await nodeHash({ ...node }));
  });
});

describe("the Stage 1 milestone", () => {
  it("compiles a hand-authored IR to real windows and a cold cache", async () => {
    const ir = buildFixtureIR();
    const report = await compile(ir);
    expect(report.cache.coldStart).toBe(true);
    expect(report.cache.hits).toBe(0);
    expect(report.cache.misses).toBe(report.cache.total);
    expect(report.timing.runtimeMs).toBeGreaterThan(0);
    expect(report.ttsCalls).toBe(0);
    for (const node of report.cache.scenes.flatMap((s) => s.nodes)) {
      expect(node.reason).toBe("first compile");
    }
  });

  it("recompiling an unchanged IR is a 100% cache hit", async () => {
    const ir = buildFixtureIR();
    const first = await compile(ir);
    const second = await compile(ir, { snapshot: first.snapshot });
    expect(second.cache.misses).toBe(0);
    expect(second.cache.hits).toBe(second.cache.total);
    expect(second.cache.scenesTouched).toBe(0);
  });

  /* THE ONE DISCRETE DIMENSION OF DEPICTION, and the first release in
   * which a director can reach it.
   *
   * `visualLanguage` has been load-bearing in `construct.ts` since it was
   * written — it moves every operator's appetite and sets the
   * representation rung a construction prefers — and no surface anywhere
   * could change it. The product pass wired it to the creative-state
   * route, which means the claim on the control ("a different language is
   * a different film, and it never costs narration") is now something the
   * system asserts about itself rather than copy. */
  it("changing the visual language recomposes the film and spends no narration", async () => {
    const ir = buildFixtureIR();
    const first = await compile(ir);

    const restyled = buildFixtureIR();
    restyled.visualLanguage = "surreal";
    const second = await compile(restyled, { snapshot: first.snapshot });

    // A different film, not a filter: the recomposition has to reach the
    // per-primitive hashes or the renderer keeps drawing the old one.
    expect(second.cache.misses).toBeGreaterThan(0);
    expect(second.cache.scenesTouched).toBeGreaterThan(0);
    // And it has to be free. This is the whole argument for restyling
    // being a cheap act, and it is structural rather than lucky:
    // narration is an input artifact, so nothing about depiction can
    // reach the TTS binding.
    expect(second.ttsCalls).toBe(0);

    // The timing is untouched — the language changes how a sentence is
    // drawn, never how long it is on screen.
    expect(second.timing.runtimeMs).toBe(first.timing.runtimeMs);
  });

  /* COLOUR IS A REAL PROPERTY OF THE FILM, not a renderer preference.
   *
   * Measured before this existed: 105 of 129 primitives rendered a frame
   * below luminance 40/255, all of it decided by five constants no
   * director could reach. The four numbers now travel on the IR and onto
   * the film plan, and the renderer owns the single function that turns
   * them into hex — so the compiler can be asked whether it CARRIES the
   * intent without knowing anything about colour. */
  it("carries the film's colour onto the plan without resolving it", async () => {
    const ir = buildFixtureIR();
    ir.cinematography.colour = {
      key: 0.9,
      temperature: 0.66,
      saturation: 0.36,
      contrast: 0.72,
      spread: 0.4,
    };
    const report = await compile(ir);
    const plan = buildFilmPlan(ir, report);
    expect(plan.colour).toEqual(ir.cinematography.colour);
    // The compiler never decides what a colour IS. If a hex string ever
    // appears in the plan's colour, the translation point has moved and
    // there are two of them again.
    expect(JSON.stringify(plan.colour)).not.toMatch(/#[0-9a-f]{3}/i);
  });

  it("changing one sentence recomputes only that scene", async () => {
    const ir = buildFixtureIR();
    const first = await compile(ir);

    const edited = buildFixtureIR();
    const target = must(
      edited.scenes.find((s) => s.sceneId === "s02"),
      "s02",
    );
    target.narration.text = "The statute ran to eleven pages, and no one read them.";

    const second = await compile(edited, { snapshot: first.snapshot });
    const touched = second.cache.scenes.filter((s) => s.misses > 0).map((s) => s.sceneId);

    // The edit changes s02's window, which cascades the scenes after it —
    // but s01, which precedes the edit, must be untouched.
    expect(touched).toContain("s02");
    expect(touched).not.toContain("s01");
    expect(second.cache.hits).toBeGreaterThan(0);
  });

  it("dragging the abstraction curve spends nothing and leaves early scenes alone", async () => {
    const ir = buildFixtureIR();
    const first = await compile(ir);

    const restyled = buildFixtureIR();
    // Act III only — the last control point.
    const points = restyled.creativeState.controlPoints;
    const last = must(points[points.length - 1], "last control point");
    last.values.abstraction = 0.97;

    const second = await compile(restyled, { snapshot: first.snapshot });

    expect(second.ttsCalls).toBe(0);
    expect(second.cache.hits).toBeGreaterThan(0);
    // Act I is at the far end of the curve from the change.
    const act1Scenes = restyled.scenes.filter((s) => s.actId === "act_1").map((s) => s.sceneId);
    const act1Diffs = second.cache.scenes.filter((s) => act1Scenes.includes(s.sceneId));
    expect(act1Diffs.every((s) => s.misses === 0)).toBe(true);
  });

  it("reports every recomputation with a stated reason", async () => {
    const ir = buildFixtureIR();
    const first = await compile(ir);
    const restyled = buildFixtureIR();
    const cps = restyled.creativeState.controlPoints;
    must(cps[cps.length - 1], "last control point").values.abstraction = 0.97;
    const second = await compile(restyled, { snapshot: first.snapshot });

    const changed = second.cache.scenes
      .flatMap((s) => s.nodes)
      .filter((n) => n.status === "changed");
    expect(changed.length).toBeGreaterThan(0);
    for (const node of changed) {
      expect(node.reason).not.toBe("");
      expect(node.reason).not.toBe("unchanged");
    }
  });

  it("holds a pin across a restyle and reports the tension", async () => {
    const restyled = buildFixtureIR();
    for (const cp of restyled.creativeState.controlPoints) cp.values.abstraction = 0.95;
    const report = await compile(restyled);

    const pinned = must(
      report.composed.find((c) => c.sceneId === "s07"),
      "pinned s07",
    );
    expect(pinned.nodes.map((n) => n.primitiveId)).toEqual([
      "document_surface",
      "document_layout",
      "annotation",
    ]);
    // Reported, not resolved.
    expect(report.warnings.some((w) => w.includes("PIN s07") && w.includes("Not resolved"))).toBe(
      true,
    );
  });

  it("is deterministic — the same IR always produces the same hashes", async () => {
    const a = await compile(buildFixtureIR());
    const b = await compile(buildFixtureIR());
    expect(canonicalJSON(a.snapshot)).toBe(canonicalJSON(b.snapshot));
  });

  it("reverting is free — an old snapshot hits completely", async () => {
    const original = buildFixtureIR();
    const v1 = await compile(original);

    const edited = buildFixtureIR();
    must(edited.creativeState.controlPoints[0], "first control point").values.abstraction = 0.6;
    await compile(edited, { snapshot: v1.snapshot });

    // Land back on the original IR: content-addressed hashes mean every
    // node is already in the cache.
    const reverted = await compile(original, { snapshot: v1.snapshot });
    expect(reverted.cache.misses).toBe(0);
  });
});

describe("generative entities", () => {
  it("carries a procedural entity through a motif, with no engine changes", () => {
    // The architectural claim: an ENTITY is not a special case. A motif's
    // chain is a list of primitive ids, so a creature is carried by exactly
    // the machinery that carries a timeline — and it develops along the same
    // state ladder.
    const ir = buildFixtureIR();
    const institution = must(
      ir.motifs.find((m) => m.motifId === "institution"),
      "institution motif",
    );
    institution.chain = ["creature_chain"];
    institution.states = ["solitary", "paired", "colony", "swarm"];

    const low = composeAll(ir);
    const early = must(
      low.find((c) => c.sceneId === "s02"),
      "s02",
    );
    expect(early.nodes.map((n) => n.primitiveId)).toContain("creature_chain");

    // And it escalates with abstraction like any other motif.
    for (const cp of ir.creativeState.controlPoints) cp.values.abstraction = 0.95;
    const high = composeAll(ir);
    const lateMotif = must(
      must(
        high.find((c) => c.sceneId === "s10"),
        "s10",
      ).motifs.find((m) => m.motifId === "institution"),
      "institution occurrence",
    );
    expect(lateMotif.state).toBe("swarm");
  });

  it("prices an entity above a texture and below the frame budget", () => {
    const entity = must(PRIMITIVES.creature_chain, "creature_chain");
    const texture = must(PRIMITIVES.noise_field, "noise_field");
    expect(entity.estimatedCostMsPerFrame).toBeGreaterThan(texture.estimatedCostMsPerFrame);
    // It used to declare ENTITY. It emitted pixels, and every consumer of
    // "ENTITY" read the canvas — so the type was a name for "a picture
    // from the entity family" and the payload-contract pass collapsed it
    // to what it truthfully is. A real ENTITY — segments, joints, gait,
    // consumable by a renderer that draws FROM it — is a contract this
    // palette does not have yet, and is recorded as such rather than
    // faked.
    expect(entity.outputs).toContain("IMAGE");
  });

  it("treats a generated image as material, not as output", () => {
    // image_to_points consumes an IMAGE and emits GEOMETRY, so generated
    // imagery enters the chain as raw material that other primitives can
    // transform — it is never the final frame.
    const bridge = must(PRIMITIVES.image_to_points, "image_to_points");
    expect(bridge.inputs).toContain("IMAGE");
    expect(bridge.outputs).toContain("GEOMETRY");
    // And it composes onward exactly the way glyph_to_points does — into a
    // primitive that accepts GEOMETRY.
    expect(canChain("image_to_points", "particle_seek")).toBe(true);
    // The type system is load-bearing, not decorative: particle_flow
    // advects a FIELD, so a point cloud cannot feed it directly. A chain
    // that looks plausible in prose still has to typecheck.
    expect(canChain("image_to_points", "particle_flow")).toBe(false);
  });
});

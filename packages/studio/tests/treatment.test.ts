// The vertical slice: narrative meaning → a type-checked primitive chain.
//
// These tests pin the two properties that make this more than a lookup
// table: every planned chain genuinely typechecks against the palette, and
// the same reading yields the same subject through different depictions.

import { describe, expect, it } from "vitest";
import { compile } from "../src/compile/index.ts";
import {
  VISUAL_LANGUAGES,
  chainSignature,
  planAllTreatments,
  planTreatment,
  validateChain,
} from "../src/compile/treatment.ts";
import type { SemanticReading } from "../src/ir/schema.ts";
import { PRIMITIVES } from "../src/primitives/registry.ts";
import { buildFixtureIR } from "./fixture.ts";
import { must } from "./must.ts";

/* A CONTESTED READING WITH A PHYSICAL SUBJECT.
 *
 * This lived in `src/compile/treatment.ts` and was exported from
 * production source — a hand-authored demo standing in for a frozen model
 * artifact, with only tests consuming it. It is a fixture, so it lives
 * with the tests now.
 *
 * What it is FOR, so the assertions below can be read as capability
 * claims rather than as claims about this particular sentence: a reading
 * that (a) is marked contested, (b) names one physical subject clearly
 * above two weaker ones, and (c) asks to be inspected. */
const CONTESTED_PHYSICAL: SemanticReading = {
  sentence: "He claimed the smoke detector was mounted on the ceiling.",
  subjects: [
    { label: "smoke detector", kind: "object", weight: 0.9 },
    { label: "ceiling", kind: "place", weight: 0.3 },
    { label: "he", kind: "person", weight: 0.2 },
  ],
  visualOpportunity: "inspect",
  contested: true,
};

describe("chain validation", () => {
  it("rejects a chain whose seam does not typecheck, naming the seam", () => {
    // Plausible in prose, invalid in fact: particle_flow advects a FIELD.
    const { valid, errors } = validateChain(["image_to_points", "particle_flow"]);
    expect(valid).toBe(false);
    const first = must(errors[0], "error");
    expect(first.from).toBe("image_to_points");
    expect(first.to).toBe("particle_flow");
    expect(first.message).toContain("FIELD");
    expect(first.message).toContain("GEOMETRY");
  });

  it("accepts a chain that does", () => {
    expect(validateChain(["image_to_points", "particle_seek"]).valid).toBe(true);
  });

  it("rejects an unknown primitive rather than silently skipping it", () => {
    const { valid, errors } = validateChain(["mounted_fixture", "not_a_primitive"]);
    expect(valid).toBe(false);
    expect(must(errors[0], "error").message).toContain("unknown primitive");
  });

  it("renders a readable type signature", () => {
    expect(chainSignature(["mounted_fixture", "entity_render", "pixelate"])).toBe(
      "— → IMAGE → IMAGE → IMAGE",
    );
  });
});

describe("treatment planning", () => {
  it("plans a valid chain for every visual language from one reading", () => {
    const treatments = planAllTreatments(CONTESTED_PHYSICAL);
    expect(treatments).toHaveLength(VISUAL_LANGUAGES.length);
    for (const t of treatments) {
      // This is the load-bearing assertion of the whole slice.
      expect(t.errors).toEqual([]);
      expect(t.valid).toBe(true);
    }
  });

  it("keeps the subject invariant while depiction changes", () => {
    const treatments = planAllTreatments(CONTESTED_PHYSICAL);
    const subjects = new Set(treatments.map((t) => t.subject));
    expect(subjects).toEqual(new Set(["smoke detector"]));

    // Same body plan every time — it is the same object.
    const heads = new Set(treatments.map((t) => must(t.nodes[0], "head").primitiveId));
    expect(heads).toEqual(new Set(["mounted_fixture"]));

    // But no two languages produce the same chain.
    const chains = treatments.map((t) => t.nodes.map((n) => n.primitiveId).join("→"));
    expect(new Set(chains).size).toBe(chains.length);
  });

  it("picks the heaviest subject, not the first one mentioned", () => {
    const t = planTreatment(CONTESTED_PHYSICAL, "documentary");
    // "he" is mentioned first in the sentence; the detector carries the shot.
    expect(t.subject).toBe("smoke detector");
  });

  it("inserts no bridge where there is no longer a type gap", () => {
    // This test used to assert that `entity_render` was inserted, because
    // a fixture emitted ENTITY and a raster primitive could not consume
    // it. ENTITY was a fiction — the fixture emitted pixels and
    // `entity_render` read `upstream.canvas` — so the bridge was crossing
    // a boundary that did not exist at runtime.
    //
    // With the declaration corrected there is no gap, and the planner
    // correctly stops bridging. The chain is shorter and does exactly what
    // it always did.
    const t = planTreatment(CONTESTED_PHYSICAL, "pixel");
    const ids = t.nodes.map((n) => n.primitiveId);
    expect(must(PRIMITIVES.mounted_fixture, "fixture").outputs).toContain("IMAGE");
    expect(ids).not.toContain("entity_render");
    expect(t.valid).toBe(true);
    expect(ids[0]).toBe("mounted_fixture");
    expect(ids).toContain("pixelate");
  });

  it("carries a contested claim into the treatment instead of dropping it", () => {
    const contested = planTreatment(CONTESTED_PHYSICAL, "documentary");
    const asFact = planTreatment({ ...CONTESTED_PHYSICAL, contested: false }, "documentary");
    // The grade used to ride on the ENTITY bridge — `entity_render` was
    // inserted to cross a type boundary and carried the under-exposure
    // while it was there. When the fictional type went, the editorial rule
    // would have gone with it, so it is now stated as a treatment decision
    // and applies whatever the subject was built from.
    const graded = contested.nodes.find((n) => n.primitiveId === "artifact_render");
    expect(graded, "a contested claim is graded").toBeDefined();
    expect(Number(must(graded, "graded").params.exposure)).toBeLessThan(0.5);
    expect(asFact.nodes.some((n) => n.primitiveId === "artifact_render")).toBe(false);
    expect(must(graded, "graded").reason).toContain("claim");
    expect(contested.rationale).toContain("claim, not fact");
  });

  it("gives every node a stated reason", () => {
    for (const t of planAllTreatments(CONTESTED_PHYSICAL)) {
      for (const n of t.nodes) expect(n.reason.length).toBeGreaterThan(8);
    }
  });

  it("is deterministic — no model call, same plan every time", () => {
    const a = JSON.stringify(planAllTreatments(CONTESTED_PHYSICAL));
    const b = JSON.stringify(planAllTreatments(CONTESTED_PHYSICAL));
    expect(a).toBe(b);
  });
});

describe("treatments inside the compile pipeline", () => {
  it("plans a treatment for a scene that carries a reading", async () => {
    const report = await compile(buildFixtureIR());
    const withReading = report.composed.filter((c) => c.treatment !== null);
    expect(withReading.length).toBeGreaterThan(0);
    for (const scene of withReading) {
      expect(must(scene.treatment, "treatment").valid).toBe(true);
    }
  });

  it("falls back to the ladder for a scene with no reading", async () => {
    const report = await compile(buildFixtureIR());
    const noReading = must(
      report.composed.find((c) => c.sceneId === "s01"),
      "s01",
    );
    expect(noReading.treatment).toBeNull();
    expect(noReading.nodes.length).toBeGreaterThan(0);
  });

  it("emits only chains that typecheck end to end", async () => {
    // The engine appends motif, density and anti-repetition primitives
    // AFTER planning. Before the final validation existed those appends
    // rode through unchecked and the composed chains were quietly invalid.
    const report = await compile(buildFixtureIR());
    for (const scene of report.composed) {
      const chain = scene.nodes.map((n) => n.primitiveId);
      const { valid, errors } = validateChain(chain);
      expect(valid, `${scene.sceneId}: ${errors.map((e) => e.message).join("; ")}`).toBe(true);
    }
  });

  it("states a reason for every primitive it drops", async () => {
    const report = await compile(buildFixtureIR());
    const drops = report.composed.flatMap((s) => s.notes.filter((n) => n.startsWith("dropped ")));
    expect(drops.length).toBeGreaterThan(0);
    // A silent drop is worse than a bad chain — the director can't see it.
    for (const note of drops) expect(note.length).toBeGreaterThan(20);
  });

  it("changing the visual language restyles the whole film, and still spends nothing", async () => {
    // THIS ASSERTION USED TO SAY "only the scenes that carry readings",
    // and that was a description of a limitation rather than of a design.
    // A visual language that reaches only the minority of scenes a human
    // has ratified a reading for is a language that mostly does nothing —
    // which is exactly what "it uses the same filter palettes" looked like
    // from the outside.
    //
    // The language is now a CONSTRAINT on every constructed program: it
    // moves each operator's appetite and states a preferred representation
    // rung. So it reaches scenes with no reading at all, which is the
    // point, and the cache diff correctly reports them as recomputed.
    const base = buildFixtureIR();
    const first = await compile(base);

    const restyled = buildFixtureIR();
    restyled.visualLanguage = "pixel";
    const second = await compile(restyled, { snapshot: first.snapshot });

    const touched = second.cache.scenes.filter((s) => s.misses > 0).map((s) => s.sceneId);
    const readingScenes = base.scenes.filter((s) => s.reading).map((s) => s.sceneId);
    // Every ratified scene moves, and so do others.
    for (const id of readingScenes) expect(touched).toContain(id);
    expect(touched.length).toBeGreaterThan(readingScenes.length);
    // And it still costs nothing: depiction is not narration.
    expect(second.ttsCalls).toBe(0);
  });

  it("reports which sources were load-bearing and which were terminal", async () => {
    const report = await compile(buildFixtureIR());
    // noise_field feeds the particle system — substrate, not decoration.
    expect(report.usage.loadBearingSources).toContain("noise_field");
    expect(report.usage.primitives.length).toBeGreaterThan(0);
    for (const p of report.usage.primitives) expect(p.uses).toBeGreaterThan(0);
  });
});

describe("kinetic language and the cut", () => {
  const MIRROR = {
    sentence: "We built a mirror large enough to hold civilization.",
    subjects: [
      { label: "mirror", kind: "object" as const, weight: 0.9 },
      { label: "civilization", kind: "concept" as const, weight: 0.5 },
    ],
    visualOpportunity: "inspect" as const,
    contested: false,
  };

  it("bridges a concrete subject back to geometry so it can be morphed", () => {
    // You cannot morph a raster. A concrete subject paints pixels and
    // `geometry_morph` consumes GEOMETRY, so a kinetic treatment has to
    // travel IMAGE → GEOMETRY. That round trip is still required and still
    // fires; what is gone is the extra ENTITY → IMAGE hop, which was
    // crossing a type that did not exist at runtime.
    const t = planTreatment(MIRROR, "kinetic");
    expect(t.valid).toBe(true);
    const ids = t.nodes.map((n) => n.primitiveId);
    expect(ids).toContain("image_to_points");
    expect(ids.indexOf("image_to_points")).toBeLessThan(ids.indexOf("geometry_morph"));
  });

  it("needs no bridge when the subject is already geometry", () => {
    const t = planTreatment(
      { ...MIRROR, subjects: [{ label: "meaning", kind: "concept", weight: 0.9 }] },
      "kinetic",
    );
    expect(t.valid).toBe(true);
    expect(t.nodes.map((n) => n.primitiveId)).toEqual([
      "glyph_geometry",
      "geometry_morph",
      "geometry_draw",
      "ease_profile",
    ]);
  });

  it("plans a valid kinetic chain for every subject kind", () => {
    for (const kind of ["object", "creature", "document", "person", "place", "concept"] as const) {
      const t = planTreatment(
        { ...MIRROR, subjects: [{ label: "x", kind, weight: 0.9 }] },
        "kinetic",
      );
      expect(t.valid, `${kind}: ${t.errors.map((e) => e.message).join("; ")}`).toBe(true);
    }
  });

  it("cuts a scene into shots at the film's rhythm", async () => {
    const slow = buildFixtureIR();
    slow.creativeState.identity.cutRhythm = 0;
    const slowReport = await compile(slow);

    const fast = buildFixtureIR();
    fast.creativeState.identity.cutRhythm = 0.9;
    const fastReport = await compile(fast);

    const count = (r: typeof slowReport) => r.timing.scenes.reduce((n, s) => n + s.shots.length, 0);
    expect(count(fastReport)).toBeGreaterThan(count(slowReport));
    // Rhythm 0 means one continuous shot per scene, not zero shots.
    for (const s of slowReport.timing.scenes) expect(s.shots.length).toBe(1);
  });

  it("never cuts faster than a shot can read", async () => {
    const ir = buildFixtureIR();
    ir.creativeState.identity.cutRhythm = 1;
    const report = await compile(ir);
    for (const scene of report.timing.scenes) {
      for (const shot of scene.shots) {
        // A cut below this stops being an edit and becomes a flicker. No
        // rhythm setting may produce something unwatchable.
        expect(shot.endMs - shot.startMs).toBeGreaterThanOrEqual(400);
      }
    }
  });

  it("tiles the scene exactly — no gap, no overlap, nothing stranded", async () => {
    const ir = buildFixtureIR();
    ir.creativeState.identity.cutRhythm = 0.7;
    const report = await compile(ir);
    for (const scene of report.timing.scenes) {
      expect(must(scene.shots[0], "first shot").startMs).toBe(scene.startMs);
      expect(must(scene.shots[scene.shots.length - 1], "last shot").endMs).toBe(scene.endMs);
      for (let i = 1; i < scene.shots.length; i++) {
        expect(must(scene.shots[i], "shot").startMs).toBe(must(scene.shots[i - 1], "prev").endMs);
      }
    }
  });
});

describe("the palette's honesty is measured, not assumed", () => {
  it("reports links whose consumer ignores what it is handed", async () => {
    // 74 primitives declare an input; 16 read it. So a chain of five can
    // render as its last element while looking five times richer than one,
    // and the only way to tell those two films apart from the outside is to
    // measure it. This is the debt, named per film rather than felt.
    const report = await compile(buildFixtureIR());
    expect(report.usage.linkHonesty).toBeGreaterThanOrEqual(0);
    expect(report.usage.linkHonesty).toBeLessThanOrEqual(1);
    for (const d of report.usage.decorativeLinks) {
      expect(d.link).toContain("→");
      expect(d.uses).toBeGreaterThan(0);
    }
  });

  it("the flagship chain is real end to end", async () => {
    // noise_field → flow_field → particle_flow → particle_trail is the
    // abstraction ladder's top rung and the Atlas's own Stage 2 milestone.
    // Every stage after the first used to generate its own noise and draw
    // over the one before it, so the rung was four unrelated images in a
    // stack rendering as the last of them.
    const { PRIMITIVES, chainOverwrites } = await import("../src/primitives/registry.ts");
    for (const id of ["flow_field", "particle_flow", "particle_trail"]) {
      expect(must(PRIMITIVES[id]).consumesUpstream, `${id} must read its upstream`).toBe(true);
    }
    expect(
      chainOverwrites(["noise_field", "flow_field", "particle_flow", "particle_trail"]),
    ).toEqual([]);
  });
});

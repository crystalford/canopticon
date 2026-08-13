// The vertical slice: narrative meaning → a type-checked primitive chain.
//
// These tests pin the two properties that make this more than a lookup
// table: every planned chain genuinely typechecks against the palette, and
// the same reading yields the same subject through different depictions.

import { describe, expect, it } from "vitest";
import { compile } from "../src/compile/index.ts";
import {
  SMOKE_DETECTOR_READING,
  VISUAL_LANGUAGES,
  chainSignature,
  planAllTreatments,
  planTreatment,
  validateChain,
} from "../src/compile/treatment.ts";
import { PRIMITIVES } from "../src/primitives/registry.ts";
import { buildFixtureIR } from "./fixture.ts";
import { must } from "./must.ts";

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
      "— → ENTITY → IMAGE → IMAGE",
    );
  });
});

describe("treatment planning", () => {
  it("plans a valid chain for every visual language from one reading", () => {
    const treatments = planAllTreatments(SMOKE_DETECTOR_READING);
    expect(treatments).toHaveLength(VISUAL_LANGUAGES.length);
    for (const t of treatments) {
      // This is the load-bearing assertion of the whole slice.
      expect(t.errors).toEqual([]);
      expect(t.valid).toBe(true);
    }
  });

  it("keeps the subject invariant while depiction changes", () => {
    const treatments = planAllTreatments(SMOKE_DETECTOR_READING);
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
    const t = planTreatment(SMOKE_DETECTOR_READING, "documentary");
    // "he" is mentioned first in the sentence; the detector carries the shot.
    expect(t.subject).toBe("smoke detector");
  });

  it("inserts the rasterisation step automatically", () => {
    // An ENTITY cannot legally reach a raster primitive. The planner has to
    // supply entity_render itself — forgetting it is exactly the class of
    // error the type check catches.
    const t = planTreatment(SMOKE_DETECTOR_READING, "pixel");
    const ids = t.nodes.map((n) => n.primitiveId);
    expect(ids).toContain("entity_render");
    expect(ids.indexOf("entity_render")).toBe(1);
    expect(must(PRIMITIVES.mounted_fixture, "fixture").outputs).toContain("ENTITY");
  });

  it("carries a contested claim into the treatment instead of dropping it", () => {
    const contested = planTreatment(SMOKE_DETECTOR_READING, "documentary");
    const asFact = planTreatment({ ...SMOKE_DETECTOR_READING, contested: false }, "documentary");
    const render = (t: typeof contested) =>
      must(
        t.nodes.find((n) => n.primitiveId === "entity_render"),
        "entity_render",
      );
    expect(render(contested).params.exposure).not.toBe(render(asFact).params.exposure);
    expect(render(contested).reason).toContain("claim");
    expect(contested.rationale).toContain("claim, not fact");
  });

  it("gives every node a stated reason", () => {
    for (const t of planAllTreatments(SMOKE_DETECTOR_READING)) {
      for (const n of t.nodes) expect(n.reason.length).toBeGreaterThan(8);
    }
  });

  it("is deterministic — no model call, same plan every time", () => {
    const a = JSON.stringify(planAllTreatments(SMOKE_DETECTOR_READING));
    const b = JSON.stringify(planAllTreatments(SMOKE_DETECTOR_READING));
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

  it("changing the visual language recomputes only the scenes that carry readings", async () => {
    const base = buildFixtureIR();
    const first = await compile(base);

    const restyled = buildFixtureIR();
    restyled.visualLanguage = "pixel";
    const second = await compile(restyled, { snapshot: first.snapshot });

    const touched = second.cache.scenes.filter((s) => s.misses > 0).map((s) => s.sceneId);
    const readingScenes = base.scenes.filter((s) => s.reading).map((s) => s.sceneId);
    expect(touched.length).toBeGreaterThan(0);
    for (const id of touched) expect(readingScenes).toContain(id);
    // And it costs nothing: depiction is not narration.
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
    // You cannot morph a raster. An entity rasterises to IMAGE, and
    // shape_morph consumes GEOMETRY, so a kinetic treatment of a concrete
    // subject has to travel ENTITY → IMAGE → GEOMETRY. Before the round
    // trip existed, the mirror failed in the one language it most wanted.
    const t = planTreatment(MIRROR, "kinetic");
    expect(t.valid).toBe(true);
    const ids = t.nodes.map((n) => n.primitiveId);
    expect(ids).toContain("entity_render");
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

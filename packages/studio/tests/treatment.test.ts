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

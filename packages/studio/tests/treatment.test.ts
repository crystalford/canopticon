// The vertical slice: narrative meaning → a type-checked primitive chain.
//
// These tests pin the two properties that make this more than a lookup
// table: every planned chain genuinely typechecks against the palette, and
// the same reading yields the same subject through different depictions.

import { describe, expect, it } from "vitest";
import {
  SMOKE_DETECTOR_READING,
  VISUAL_LANGUAGES,
  chainSignature,
  planAllTreatments,
  planTreatment,
  validateChain,
} from "../src/compile/treatment.ts";
import { PRIMITIVES } from "../src/primitives/registry.ts";
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

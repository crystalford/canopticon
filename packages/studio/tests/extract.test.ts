// Semantic extraction: prose in, a ratifiable reading out.
//
// The model call happens once at authoring time and is frozen. These tests
// cover the parts that must hold regardless of what a model returns: the
// hedge floor, malformed output, and the deterministic fallback.

import { describe, expect, it } from "vitest";
import {
  fallbackReading,
  looksContested,
  parseReading,
  proposeReading,
} from "../src/compile/extract-reading.ts";
import { planTreatment } from "../src/compile/treatment.ts";
import { must } from "./must.ts";

const SENTENCE = "He claimed the smoke detector was mounted on the ceiling.";

describe("hedge detection", () => {
  it("catches reported speech", () => {
    expect(looksContested(SENTENCE)).toBe(true);
    expect(looksContested("According to the filing, the account was closed.")).toBe(true);
    expect(looksContested("The statute ran to eleven pages.")).toBe(false);
  });
});

describe("parsing a model proposal", () => {
  it("accepts a well-formed reading", () => {
    const raw = `{"subjects":[{"label":"smoke detector","kind":"object","weight":0.9}],"visualOpportunity":"inspect","contested":true}`;
    const r = must(parseReading(raw, SENTENCE), "reading");
    expect(must(r.subjects[0], "subject").label).toBe("smoke detector");
    expect(r.visualOpportunity).toBe("inspect");
  });

  it("overrules a model that misses the hedge", () => {
    // The prose says "claimed". A model reporting settled fact must not be
    // allowed to depict a claim as established.
    const raw = `{"subjects":[{"label":"smoke detector","kind":"object","weight":0.9}],"visualOpportunity":"inspect","contested":false}`;
    expect(must(parseReading(raw, SENTENCE), "reading").contested).toBe(true);
  });

  it("rejects a reading with no usable subject rather than half-filling it", () => {
    expect(parseReading(`{"subjects":[],"visualOpportunity":"inspect"}`, SENTENCE)).toBeNull();
    expect(parseReading(`{"subjects":[{"label":"x","kind":"nonsense"}]}`, SENTENCE)).toBeNull();
    expect(parseReading("not json at all", SENTENCE)).toBeNull();
  });

  it("clamps a weight outside 0..1 instead of trusting it", () => {
    const raw = `{"subjects":[{"label":"a","kind":"object","weight":7}],"visualOpportunity":"inspect","contested":false}`;
    expect(must(must(parseReading(raw, "a sentence"), "r").subjects[0], "s").weight).toBe(1);
  });

  it("falls back to establish for an unknown opportunity", () => {
    const raw = `{"subjects":[{"label":"a","kind":"object","weight":0.5}],"visualOpportunity":"interpretive-dance"}`;
    expect(must(parseReading(raw, "a sentence"), "r").visualOpportunity).toBe("establish");
  });
});

describe("degrade, flag, continue", () => {
  it("returns a usable reading with no AI binding, flagged as fallback", async () => {
    const p = await proposeReading(undefined, SENTENCE);
    expect(p.provenance.fallback).toBe(true);
    expect(p.reading.subjects.length).toBeGreaterThan(0);
    // Even degraded, the hedge survives.
    expect(p.reading.contested).toBe(true);
  });

  it("falls back rather than throwing when the model errors", async () => {
    const ai = {
      run: async () => {
        throw new Error("model unavailable");
      },
    };
    const p = await proposeReading(ai, SENTENCE);
    expect(p.provenance.fallback).toBe(true);
    expect(p.provenance.generatedBy).toBe("deterministic-fallback");
  });

  it("uses the model when it answers, and records provenance", async () => {
    const ai = {
      run: async () => ({
        response: `{"subjects":[{"label":"smoke detector","kind":"object","weight":0.9}],"visualOpportunity":"inspect","contested":true}`,
      }),
    };
    const p = await proposeReading(ai, SENTENCE);
    expect(p.provenance.fallback).toBe(false);
    expect(p.provenance.sourceText).toBe(SENTENCE);
    expect(p.reading.visualOpportunity).toBe("inspect");
  });

  it("weights the fallback's subjects so planning stays stable", () => {
    const r = fallbackReading(SENTENCE);
    const weights = r.subjects.map((s) => s.weight);
    expect(new Set(weights).size).toBe(weights.length);
  });
});

describe("end to end: a sentence reaches a validated chain", () => {
  it("plans a valid treatment from an extracted reading", async () => {
    const { reading } = await proposeReading(
      {
        run: async () => ({
          response: `{"subjects":[{"label":"smoke detector","kind":"object","weight":0.9},{"label":"ceiling","kind":"place","weight":0.3}],"visualOpportunity":"inspect","contested":true}`,
        }),
      },
      SENTENCE,
    );
    const treatment = planTreatment(reading, "pixel");
    expect(treatment.valid).toBe(true);
    expect(treatment.errors).toEqual([]);
    expect(treatment.subject).toBe("smoke detector");
    expect(treatment.rationale).toContain("claim, not fact");
  });
});

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
  it("DECLINES rather than guessing when there is no AI binding", async () => {
    // A guessed reading overrides the creative-state curve, so offering one
    // is worse than offering none. Declining lets the abstraction ladder
    // carry the scene, which is what the curve is for.
    const p = await proposeReading(undefined, SENTENCE);
    expect(p.provenance.fallback).toBe(true);
    expect(p.reading).toBeNull();
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
    expect(p.reading).toBeNull();
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
    expect(must(p.reading, "reading").visualOpportunity).toBe("inspect");
  });

  it("the deterministic reader marks subjects as concepts, not objects", () => {
    // It has no lexicon. Claiming "object" routed every abstract noun to a
    // ceiling-fixture body plan; "concept" is the honest answer for a noun
    // whose referent it could not identify.
    const r = fallbackReading("Meaning is what survives the rubbing.");
    for (const s of r.subjects) expect(s.kind).toBe("concept");
    const weights = r.subjects.map((s) => s.weight);
    expect(new Set(weights).size).toBe(weights.length);
  });

  it("catches attribution by group, which the first hedge list missed", () => {
    expect(looksContested("Critics call this bad UX.")).toBe(true);
    expect(looksContested("We call it fighting the model.")).toBe(true);
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
    const treatment = planTreatment(must(reading, "reading"), "pixel");
    expect(treatment.valid).toBe(true);
    expect(treatment.errors).toEqual([]);
    expect(treatment.subject).toBe("smoke detector");
    expect(treatment.rationale).toContain("claim, not fact");
  });
});

describe("the binding's response shape", () => {
  // This route never succeeded once: it assumed `{ response: string }`,
  // called .slice on it, threw, and the throw was swallowed into
  // "declined" — so a hard bug looked exactly like the extractor doing its
  // job. These are the shapes Workers AI actually returns.
  const ok =
    '{"subjects":[{"label":"hotel","kind":"object","weight":0.9}],"visualOpportunity":"inspect","contested":false}';

  it("reads a plain string response", async () => {
    const ai = { run: async () => ({ response: ok }) };
    const r = await proposeReading(ai, "The hotel remains operational.");
    expect(r.reading?.subjects[0]?.label).toBe("hotel");
  });

  it("reads a response the model already parsed into an object", async () => {
    const ai = { run: async () => ({ response: JSON.parse(ok) }) };
    const r = await proposeReading(ai, "The hotel remains operational.");
    expect(r.reading?.subjects[0]?.label).toBe("hotel");
  });

  it("reads a bare string", async () => {
    const ai = { run: async () => ok };
    const r = await proposeReading(ai, "The hotel remains operational.");
    expect(r.reading?.subjects[0]?.label).toBe("hotel");
  });

  it("says WHY when the call throws, rather than only that it declined", async () => {
    const ai = {
      run: async () => {
        throw new Error("binding exploded");
      },
    };
    const r = await proposeReading(ai, "x");
    expect(r.reading).toBeNull();
    expect(r.provenance.declineReason).toBe("call-failed");
    expect(r.provenance.rawSample).toContain("binding exploded");
  });

  it("distinguishes a model with nothing usable from one talking nonsense", async () => {
    const empty = { run: async () => ({ response: '{"subjects":[]}' }) };
    expect((await proposeReading(empty, "x")).provenance.declineReason).toBe("no-subjects");
    const prose = { run: async () => ({ response: "I am sorry, I cannot help." }) };
    expect((await proposeReading(prose, "x")).provenance.declineReason).toBe("unparseable");
  });
});

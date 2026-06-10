import { describe, expect, it } from "vitest";
import { parseTypedExtraction } from "../src/graph/lib/digestion-typed.ts";
import { chunkText } from "../src/graph/lib/digestion.ts";

describe("parseTypedExtraction — shape tolerance", () => {
  it("reads the canonical typed-graph object shape", () => {
    const out = parseTypedExtraction({
      entities: [{ lid: "e1", label: "OSFI", type: "institution" }],
      events: [{ lid: "ev1", label: "DSB raise", date: "2026-01" }],
      neutral_facts: [{ lid: "f1", text: "DSB is 4.0%" }],
      assertions: [{ lid: "a1", text: "rates will rise", stance: "pro" }],
      relationships: [{ src_lid: "e1", dst_lid: "f1", type: "controls" }],
      evidential: [{ src_lid: "f1", dst_lid: "a1", type: "supports" }],
      temporal: [{ src_lid: "ev1", dst_lid: "ev1", type: "before" }],
      open_threads: [{ question: "What about 2027?", related_lids: ["e1"] }],
    });
    expect(out.entities).toHaveLength(1);
    expect(out.entities[0]?.label).toBe("OSFI");
    expect(out.assertions[0]?.stance).toBe("pro");
    expect(out.relationships).toHaveLength(1);
    expect(out.open_threads[0]?.question).toBe("What about 2027?");
  });

  it("accepts a raw JSON string (Workers AI text fallback)", () => {
    const out = parseTypedExtraction(
      JSON.stringify({
        entities: [{ lid: "e1", label: "Y" }],
      }),
    );
    expect(out.entities).toHaveLength(1);
    expect(out.entities[0]?.label).toBe("Y");
  });

  it("recovers JSON wrapped in markdown code fences", () => {
    const fenced = '```json\n{"entities":[{"lid":"e1","label":"Fenced"}]}\n```';
    const out = parseTypedExtraction(fenced);
    expect(out.entities).toHaveLength(1);
    expect(out.entities[0]?.label).toBe("Fenced");
  });

  it("recovers JSON preceded by model prose", () => {
    const prose =
      'Here is the graph:\n\n{"neutral_facts":[{"lid":"f1","text":"Prefixed fact"}]}\n\nDone.';
    const out = parseTypedExtraction(prose);
    expect(out.neutral_facts).toHaveLength(1);
    expect(out.neutral_facts[0]?.text).toBe("Prefixed fact");
  });

  it("returns empty arrays for null / undefined / junk string", () => {
    expect(parseTypedExtraction(null).entities).toEqual([]);
    expect(parseTypedExtraction(undefined).entities).toEqual([]);
    expect(parseTypedExtraction("not json").entities).toEqual([]);
    expect(parseTypedExtraction(42).entities).toEqual([]);
  });

  it("skips entries missing required fields", () => {
    const out = parseTypedExtraction({
      entities: [
        { lid: "e1", label: "good" },
        { lid: "e2" }, // dropped — no label
        { label: "no lid" }, // dropped — no lid
        null,
        "string",
      ],
      assertions: [
        { lid: "a1", text: "ok" },
        { lid: "a2", text: "" }, // dropped
      ],
    });
    expect(out.entities).toHaveLength(1);
    expect(out.entities[0]?.label).toBe("good");
    expect(out.assertions).toHaveLength(1);
  });

  it("preserves unknown stance/type strings for downstream normalization", () => {
    // The persister normalizes; the parser just shapes. An unknown stance
    // arrives as-is so the persister can decide (defaulting to neutral).
    const out = parseTypedExtraction({
      assertions: [{ lid: "a1", text: "Z", stance: "bogus" }],
    });
    expect(out.assertions[0]?.stance).toBe("bogus");
  });

  it("omits missing arrays as empty (tolerant of partial output)", () => {
    const out = parseTypedExtraction({ entities: [{ lid: "e1", label: "X" }] });
    expect(out.events).toEqual([]);
    expect(out.relationships).toEqual([]);
    expect(out.open_threads).toEqual([]);
  });
});

describe("chunkText", () => {
  it("returns a single chunk for small docs (no behavior change)", () => {
    expect(chunkText("short doc")).toEqual(["short doc"]);
  });

  it("returns [] for empty input", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("splits a long document into multiple chunks on paragraph boundaries", () => {
    const para = `${"word ".repeat(2000)}`;
    const doc = [para, para, para].join("\n\n");
    const chunks = chunkText(doc);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(24000 + 800);
  });

  it("hard-slices a single oversized paragraph", () => {
    const huge = "x".repeat(60000);
    const chunks = chunkText(huge, { maxChars: 24000, overlapChars: 0 });
    expect(chunks.length).toBe(3);
  });
});

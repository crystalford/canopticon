import { describe, expect, it } from "vitest";
import { type ExtractedClaim, chunkText, parseClaims } from "../src/graph/lib/digestion.ts";

describe("parseClaims — shape tolerance", () => {
  it("reads the canonical { claims: [...] } shape", () => {
    const out = parseClaims({
      claims: [
        {
          data: "GDP fell 2%",
          claim_text: "The economy contracted",
          qualifier: "likely",
          layer: "factual",
          entities_mentioned: ["Bank of Canada"],
          source_excerpt: "GDP fell 2% in Q3",
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.claim_text).toBe("The economy contracted");
    expect(out[0]?.entities_mentioned).toEqual(["Bank of Canada"]);
  });

  it("accepts a bare array", () => {
    const out = parseClaims([{ claim_text: "X is true", data: "evidence", layer: "framing" }]);
    expect(out).toHaveLength(1);
    expect(out[0]?.layer).toBe("framing");
  });

  it("accepts a raw JSON string (Workers AI text fallback)", () => {
    const out = parseClaims(JSON.stringify({ drafted_claims: [{ claim_text: "Y" }] }));
    expect(out).toHaveLength(1);
    expect(out[0]?.claim_text).toBe("Y");
  });

  it("recovers JSON wrapped in markdown code fences", () => {
    const fenced = '```json\n{"claims":[{"claim_text":"Fenced claim","layer":"factual"}]}\n```';
    const out = parseClaims(fenced);
    expect(out).toHaveLength(1);
    expect(out[0]?.claim_text).toBe("Fenced claim");
  });

  it("recovers JSON preceded by model prose", () => {
    const prose =
      'Here are the claims I extracted:\n\n{"claims":[{"claim_text":"Prefixed claim"}]}\n\nLet me know!';
    const out = parseClaims(prose);
    expect(out).toHaveLength(1);
    expect(out[0]?.claim_text).toBe("Prefixed claim");
  });

  it("returns [] for null / undefined / junk string", () => {
    expect(parseClaims(null)).toEqual([]);
    expect(parseClaims(undefined)).toEqual([]);
    expect(parseClaims("not json")).toEqual([]);
    expect(parseClaims(42)).toEqual([]);
  });

  it("skips malformed entries instead of throwing", () => {
    const out = parseClaims({
      claims: [
        { claim_text: "good" },
        { data: "no claim_text here" }, // dropped — missing claim_text
        null, // dropped
        "string", // dropped
        { claim_text: "  ", data: "blank" }, // dropped — empty after trim
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.claim_text).toBe("good");
  });

  it("defaults an invalid layer to 'factual' and coerces entities to strings", () => {
    const out = parseClaims({
      claims: [{ claim_text: "Z", layer: "bogus", entities_mentioned: ["A", 5, null, "B"] }],
    });
    expect(out[0]?.layer).toBe("factual");
    expect(out[0]?.entities_mentioned).toEqual(["A", "B"]);
  });

  it("falls back data to claim_text when data is missing", () => {
    const out: ExtractedClaim[] = parseClaims({ claims: [{ claim_text: "only text" }] });
    expect(out[0]?.data).toBe("only text");
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
    const para = `${"word ".repeat(2000)}`; // ~10k chars
    const doc = [para, para, para].join("\n\n"); // ~30k chars > 24k default
    const chunks = chunkText(doc);
    expect(chunks.length).toBeGreaterThan(1);
    // every chunk stays within a sane bound of the max
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(24000 + 800);
  });

  it("hard-slices a single oversized paragraph", () => {
    const huge = "x".repeat(60000);
    const chunks = chunkText(huge, { maxChars: 24000, overlapChars: 0 });
    expect(chunks.length).toBe(3);
  });
});

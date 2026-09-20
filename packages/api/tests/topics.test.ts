// Topics, and the closed vocabulary that makes them worth having.
//
// The operator: "some of the things are political research, some are tech
// stacks, some are others, but they are all just dumped in one place."
//
// The failure this file exists to prevent is subtle and total: if a model is
// allowed to NAME topics rather than CHOOSE them, fifty documents produce
// forty near-duplicate labels and the grouping groups nothing. Every near-miss
// that slips through is a new bucket of one.
//
// So matchTopic is the load-bearing function, and almost everything here is
// about what it refuses.

import { describe, expect, it } from "vitest";
import { TOPICS, matchTopic } from "../src/graph/lib/topics";

describe("matching an answer to the closed list", () => {
  it.each([...TOPICS])("accepts the exact label %s", (t) => {
    expect(matchTopic(t)).toBe(t);
  });

  it("accepts a different case", () => {
    expect(matchTopic("politics & government")).toBe("Politics & government");
    expect(matchTopic("PUBLIC HEALTH")).toBe("Public health");
  });

  it("accepts 'and' for '&', which models write interchangeably", () => {
    expect(matchTopic("Politics and government")).toBe("Politics & government");
    expect(matchTopic("Money and markets")).toBe("Money & markets");
  });

  it("tolerates trailing punctuation and quotes", () => {
    expect(matchTopic('"Housing & cities"')).toBe("Housing & cities");
    expect(matchTopic("Public health.")).toBe("Public health");
    expect(matchTopic("  Climate & energy  ")).toBe("Climate & energy");
  });
});

describe("what must NOT become a topic", () => {
  // Each of these is a plausible thing a model says, and each one, if let
  // through, becomes a permanent bucket holding one document.
  it.each([
    "Canadian politics",
    "Political research",
    "Government",
    "Tech stacks",
    "Polling methodology",
    "Carbon finance",
    "Media theory",
  ])("refuses the invented label %s", (t) => {
    expect(matchTopic(t)).toBeNull();
  });

  it("treats NONE as a real answer, not a failure", () => {
    // A document that fits nothing must be allowed to say so. Forcing a bad
    // topic actively misleads; leaving it ungrouped merely waits.
    expect(matchTopic("NONE")).toBeNull();
    expect(matchTopic("none")).toBeNull();
  });

  it("refuses an empty or noise answer", () => {
    expect(matchTopic("")).toBeNull();
    expect(matchTopic("   ")).toBeNull();
    expect(matchTopic("I think this document is about")).toBeNull();
  });

  it("refuses a combination, because a document gets exactly one", () => {
    expect(matchTopic("Politics & government, Money & markets")).toBeNull();
  });
});

describe("the vocabulary itself", () => {
  it("is small enough that clusters are worth having", () => {
    // A topic holding one document is a label pretending to be a section. Too
    // many buckets is the same failure as free-form naming, arrived at slower.
    expect(TOPICS.length).toBeLessThanOrEqual(10);
    expect(TOPICS.length).toBeGreaterThanOrEqual(4);
  });

  it("has no duplicates and no empties", () => {
    expect(new Set(TOPICS.map((t) => t.toLowerCase())).size).toBe(TOPICS.length);
    for (const t of TOPICS) expect(t.trim()).toBe(t);
  });

  it("stays distinct under the same normalisation matchTopic uses", () => {
    // Two topics that normalise to the same string would make matching
    // non-deterministic — whichever came first in the list would win.
    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/\s*&\s*|\s+and\s+/g, " ")
        .replace(/[^a-z ]/g, "")
        .trim();
    expect(new Set(TOPICS.map(norm)).size).toBe(TOPICS.length);
  });
});

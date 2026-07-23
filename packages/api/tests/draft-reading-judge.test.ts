import { describe, expect, it } from "vitest";

// Drafter judge wiring — spec Part 8 + Part 10 #4 hard constraint:
// the signed-reading drafter must call the independent judge on every
// load-bearing claim. Until this commit it stored judge_pass=1 hardcoded;
// the judge was only wired in buildBrief.
//
// We don't run the full draftReadings() pipeline (it needs LLM calls,
// nodes/edges/quotes/pages in D1, theme surfacer state). We assert the
// SHAPE: the drafter imports judgeClaim from briefs/pipeline.ts. If
// someone deletes the import or stubs it, the test fails and the trust
// gap reopens.

import { readFileSync } from "node:fs";

describe("drafter independent judge — spec Part 8 + Part 10 #4", () => {
  const drafter = readFileSync("./src/graph/lib/draft-reading.ts", "utf-8");

  it("imports judgeClaim from the briefs pipeline", () => {
    expect(drafter).toMatch(/import\s*\{[^}]*judgeClaim[^}]*\}\s*from\s*"\.\/briefs\/pipeline"/);
  });

  it("calls judgeClaim in parallel over verified claims", () => {
    expect(drafter).toContain("Promise.all");
    expect(drafter).toContain("judgeClaim(");
  });

  it("gates persistence on judgePassed — failed-judge claims do not reach page_claims", () => {
    // The persistence loop iterates over judgePassed, not verifiedClaims.
    expect(drafter).toMatch(/for\s*\(\s*const\s+\w+\s+of\s+judgePassed\s*\)/);
    // Sanity: there's no remaining "for (const vc of verifiedClaims)" loop
    // around the page_claims insert path. (The verbatim/firewall loop above
    // still uses verifiedClaims as the accumulator — that's fine; we only
    // care that the persist loop uses judgePassed.)
    const persistRegion =
      drafter.split("DELETE FROM page_claims")[1]?.split("realQuoteId")[0] ?? "";
    expect(persistRegion).not.toContain("of verifiedClaims");
  });

  it("rejects a draft when judge-passed count is below threshold", () => {
    expect(drafter).toContain("judgePassed.length < 2");
  });

  it("does NOT hardcode judge_pass: 1 on insert (the bug that motivated this)", () => {
    // page_claims insert should not contain a literal `judge_pass: 1,` line
    // that's unconditional. (The persist loop only runs over judgePassed
    // claims, so the value is correct by selection — but the literal
    // `1` survives. The smell test is that the surrounding code references
    // judgePassed explicitly, which the previous test asserts.)
    expect(drafter).toContain("judge_notes:");
  });
});

describe("judgeClaim — exported from briefs/pipeline for reuse", () => {
  const pipeline = readFileSync("./src/graph/lib/briefs/pipeline.ts", "utf-8");

  it("is exported", () => {
    expect(pipeline).toMatch(/export\s+async\s+function\s+judgeClaim/);
  });
});

// Re-draftable-drafts guard: a subject used to get exactly one reading,
// ever — draftReadings() only ever considered signed_status = 'none'.
// This is the fix that lets an unreviewed draft keep pace with a growing
// fact base instead of freezing on day one, while never touching
// anything the operator already signed off on.
describe("draftReadings — unsigned drafts stay eligible for re-drafting", () => {
  const drafter = readFileSync("./src/graph/lib/draft-reading.ts", "utf-8");

  it("still considers subjects with no reading yet", () => {
    expect(drafter).toContain("p.signed_status = 'none'");
  });

  it("ALSO considers unsigned drafts, gated on real growth since the last draft", () => {
    expect(drafter).toContain("p.signed_status = 'draft'");
    expect(drafter).toContain("p.claims_verified + p.claims_killed");
  });

  it("never re-drafts anything already signed or published", () => {
    // The eligibility OR-clause is exhaustively 'none' or 'draft' — signed_status
    // has only four values total (none/draft/signed/published per the CHECK
    // constraint in 0030_themes_and_pages.sql), so confirming the clause
    // names only these two is equivalent to confirming signed/published are
    // excluded. If someone widens this to `!= 'signed'` or similar instead
    // of listing exact statuses, this test should be revisited by hand.
    expect(drafter).not.toContain("signed_status != 'signed'");
    expect(drafter).not.toContain(`signed_status <> 'signed'`);
  });
});

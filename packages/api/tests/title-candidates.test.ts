// Candidate titles, and the detector that decides whether to offer any.
//
// The live corpus published documents called "PASS 7-MINI — HARDENING
// DOSSIER" and "Phase 6". Those are session names: accurate to the process,
// meaningless to a reader, and they are the H1, the <title> tag and the
// citation line.
//
// The property that matters most here is RESTRAINT. Nothing in this path
// renames anything; it proposes, and a person accepts. So the failures worth
// pinning are the ones where it would offer something worse than the title
// already there, or flag a title that was fine.

import { describe, expect, it } from "vitest";
import { looksLikeWorkingTitle } from "../src/lib/title";
import { titleCandidates } from "../src/lib/title-candidates";

describe("spotting a working title", () => {
  it.each([
    "PASS 7-MINI — HARDENING DOSSIER",
    "Phase 6",
    "ANCASTER V1",
    "PASS 3 — DRAFT",
    "FINAL PASS",
  ])("flags %s", (t) => {
    expect(looksLikeWorkingTitle(t)).toBe(true);
  });

  it.each([
    "Budget 2026: Main Estimates",
    "Who runs research and advertising in the Carney PMO",
    "The Logic Costume",
    "Housing Starts, Q3",
    "Wealth Estimates: A Review",
    "Measurement as Argument",
  ])("leaves %s alone", (t) => {
    expect(looksLikeWorkingTitle(t)).toBe(false);
  });

  it("does not flag an empty or machine title — those have their own paths", () => {
    expect(looksLikeWorkingTitle("")).toBe(false);
    expect(looksLikeWorkingTitle("compass_artifact_wf-c96cfa7c-3f5d-44e9.md")).toBe(false);
  });
});

describe("candidates come out of the document", () => {
  // The real shape: a research document states its subject in its own summary
  // table before it states it anywhere else.
  const dossier = `# PASS 7-MINI — HARDENING DOSSIER

Every claim below is tied to an open-record source.

## SUMMARY TABLE — HARDENED FACTS

| # | Fact | Source (canonical) | Confidence |
|---|-----|------------------|-----------|
| 1 | Rosalie Nadeau is Director of Research and Advertising in the Carney PMO. | Hill Times, Nov. 3 2025 | HIGH |
| 2 | Nadeau came directly from Data Sciences Inc., where she was VP, Insights. | TheOrg profile | HIGH |
`;

  it("lifts the document's own first hardened fact", () => {
    const [first] = titleCandidates(dossier);
    expect(first).toBe("Rosalie Nadeau is Director of Research and Advertising in the Carney PMO");
  });

  it("returns the document's words, never a paraphrase", () => {
    // The firewall property. Every candidate must appear in the source text
    // (modulo the trailing full stop this strips).
    for (const c of titleCandidates(dossier)) {
      expect(dossier).toContain(c);
    }
  });

  it("offers at most three", () => {
    expect(titleCandidates(dossier).length).toBeLessThanOrEqual(3);
  });

  it("skips the numbering, the source and the confidence cells", () => {
    const cands = titleCandidates(dossier);
    expect(cands).not.toContain("HIGH");
    expect(cands.some((c) => c.startsWith("Hill Times"))).toBe(false);
  });
});

describe("what it refuses to suggest", () => {
  it("returns nothing rather than a bad suggestion", () => {
    // A document with nothing title-shaped in it must yield an empty list.
    // Offering something worse than the working title is the failure mode.
    expect(titleCandidates("# X\n\nShort. Too short. Nope.")).toEqual([]);
  });

  it("survives an empty document", () => {
    expect(titleCandidates("")).toEqual([]);
    expect(titleCandidates("   ")).toEqual([]);
  });

  it("never proposes a bare URL", () => {
    const md = "https://example.com/some/very/long/path/that/goes/on/and/on/forever";
    expect(titleCandidates(md)).toEqual([]);
  });

  it("never proposes a shouted line — that is the problem, not the fix", () => {
    const md = "PASS SEVEN HARDENING OF THE RECORD AGAINST OPEN SOURCES";
    expect(titleCandidates(md)).toEqual([]);
  });

  it("does not propose the working title back from the document's own H1", () => {
    const md =
      "# PASS 7-MINI — HARDENING DOSSIER\n\nThe Carney PMO hired a new research director in 2025.";
    expect(titleCandidates(md)).not.toContain("PASS 7-MINI — HARDENING DOSSIER");
  });

  it("strips markdown so a candidate is plain text", () => {
    const md = "The **Carney PMO** hired a [new research director](https://x.test) during 2025.";
    const [first] = titleCandidates(md);
    expect(first).toBe("The Carney PMO hired a new research director during 2025");
  });
});

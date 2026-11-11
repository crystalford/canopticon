// Checks found by reading real reports (engine test 2026-11-11): archive
// copies counted as one publisher, headings numbered twice, key findings
// with no citation, summary figures the Details never give, and sources
// that are a database's record rather than the document.
import { describe, expect, it } from "vitest";
import { echoGroups, independentCount, siteOf } from "../src/write/independence";
import { skeleton } from "../src/write/notes";
import { describeWriting, writingProblems } from "../src/write/research";

describe("an archive copy is the site it copies", () => {
  it("unwraps Internet Archive addresses", () => {
    expect(
      siteOf("https://web.archive.org/web/20220610002413/https://onlinelibrary.wiley.com/doi/x"),
    ).toBe("onlinelibrary.wiley.com");
    expect(siteOf("https://web.archive.org/web/2022/https://utpjournals.press/doi/y")).toBe(
      "utpjournals.press",
    );
    expect(siteOf("https://www.nber.org/papers/w1")).toBe("nber.org");
  });

  it("does not count copies of different publishers as one", () => {
    const numbers = new Map([
      ["https://web.archive.org/web/1/https://onlinelibrary.wiley.com/a", 1],
      ["https://web.archive.org/web/2/https://papers.ssrn.com/b", 2],
      ["https://web.archive.org/web/3/https://utpjournals.press/c", 3],
    ]);
    const groups = echoGroups([], numbers);
    expect(groups).toEqual([]);
    expect(independentCount(groups, 3)).toBe(3);
  });

  it("still counts two copies of one site as that site's pages", () => {
    const numbers = new Map([
      ["https://web.archive.org/web/1/https://gamestudies.org/a", 1],
      ["https://gamestudies.org/b", 2],
    ]);
    expect(echoGroups([], numbers)).toMatchObject([{ why: "publisher", sources: [1, 2] }]);
  });
});

describe("outline headings", () => {
  it("are numbered once, whatever number the model put on them", () => {
    const body = skeleton([
      { heading: "1. The thesis, stated precisely", words: 400 },
      { heading: "Section 2: The case for", words: 400 },
      { heading: "3) The case against", words: 400 },
    ]);
    expect(body).toContain("### 1. The thesis, stated precisely\n");
    expect(body).toContain("### 2. The case for\n");
    expect(body).toContain("### 3. The case against\n");
    expect(body).not.toMatch(/### \d+\. \d/);
  });

  it("keep a section written under the old, doubled heading", () => {
    const before = "## Details\n\n### 1. 1. The thesis\n\nWritten text [1].\n\n## Sources\n";
    const body = skeleton([{ heading: "1. The thesis", words: 400 }], before);
    expect(body).toContain("### 1. The thesis\n\nWritten text [1].");
  });
});

const REPORT = `# Rent bans

## TL;DR

Rents rose 4.2% after the bans, and listings fell by 31,000 [1].

## Key Findings

- Listings fell by half within a year [1].
- Rents kept rising regardless of the bans.

## Details

### 1. What happened

Listings fell by half within a year, about 31,000 units [1]. Rents rose 3.9% [2].

## Sources

1. [Registry](https://toronto.ca/registry)
2. [Study record](https://api.openalex.org/works/doi:10.1/x)
`;

describe("what a reader checks first", () => {
  it("finds key findings with no citation, summary figures the Details never give, and database records", () => {
    const w = writingProblems(REPORT);
    expect(w.uncitedFindings).toEqual(["Rents kept rising regardless of the bans."]);
    expect(w.summaryFigures.map((f) => f.figure)).toEqual(["4.2"]);
    expect(w.databaseSources).toEqual(["https://api.openalex.org/works/doi:10.1/x"]);
    const said = describeWriting(w);
    expect(said).toContain("KEY FINDINGS WITH NO CITATION (1)");
    expect(said).toContain("FIGURES IN THE SUMMARY THAT THE DETAILS NEVER GIVE (1)");
    expect(said).toContain("NOT THE DOCUMENT (1)");
  });

  it("says nothing about a report that is in order", () => {
    const ok = REPORT.replace("regardless of the bans.", "regardless of the bans [2].")
      .replace("4.2%", "3.9%")
      .replace("https://api.openalex.org/works/doi:10.1/x", "https://doi.org/10.1/x");
    expect(describeWriting(writingProblems(ok))).toBe("");
  });
});

// Checks found by reading real reports (engine test 2026-11-11): archive
// copies counted as one publisher, headings numbered twice, key findings
// with no citation, summary figures the Details never give, and sources
// that are a database's record rather than the document.
import { describe, expect, it, vi } from "vitest";
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

describe("density, in code", () => {
  const REPEATS = `## TL;DR

Short.

## Details

### 1. Exposure

Half of teens, 50% of employees aged 15 to 19, were paid the minimum [1]. Ontario's step was 20.7% [2].

### 2. The case for

Because 50% of teens earn the minimum [1], the effect concentrates there. Alberta reached $15.00 in October 2018.

### 3. The case against

Again, 50% of teens [1]. I could not find more, and as Chris stated it the claim is broad. In Part I of the book the author says "we must look" [3].

## Sources

1. [A](https://a.example)
`;

  it("finds a fact said in three parts, a figure with no citation, and the first person", async () => {
    const { writingProblems: wp } = await import("../src/write/research");
    const w = wp(REPEATS);
    expect(w.repeatedFacts).toEqual([{ fact: "50%", parts: 3 }]);
    expect(w.uncitedFacts).toEqual(["Alberta reached $15.00 in October 2018."]);
    expect(w.voice).toEqual(["I could not find more, and as Chris stated it the claim is broad."]);
  });

  it("keeps a quotation of two sentences whole, with the citation after it", async () => {
    const { splitSentences } = await import("../src/write/research");
    expect(
      splitSentences(
        'It reported: "Employment fell. Year over year it grew by 34,000" [11]. Then more.',
      ),
    ).toEqual([
      'It reported: "Employment fell. Year over year it grew by 34,000" [11].',
      "Then more.",
    ]);
  });
});

describe("free full texts of papers", () => {
  it("reads the DOI a scholarly address carries", async () => {
    const { doiOf } = await import("../src/write/finder");
    expect(doiOf("https://onlinelibrary.wiley.com/doi/10.1111/coep.12241")).toBe(
      "10.1111/coep.12241",
    );
    expect(
      doiOf("https://web.archive.org/web/2022/https://utpjournals.press/doi/10.3138/cpp.2018-016"),
    ).toBe("10.3138/cpp.2018-016");
    expect(doiOf("https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4996049")).toBe(
      "10.2139/ssrn.4996049",
    );
    expect(doiOf("https://doi.org/10.5334/glo.9")).toBe("10.5334/glo.9");
    expect(doiOf("https://www.statcan.gc.ca/n1/daily")).toBeNull();
  });

  it("asks OpenAlex for the open-access copy", async () => {
    const { openAccessCopy } = await import("../src/write/finder");
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        seen.push(url);
        return new Response(
          JSON.stringify({ best_oa_location: { pdf_url: "https://repo.example/paper.pdf" } }),
          { headers: { "content-type": "application/json" } },
        );
      }),
    );
    expect(await openAccessCopy("10.1111/coep.12241")).toBe("https://repo.example/paper.pdf");
    expect(seen[0]).toBe("https://api.openalex.org/works/doi:10.1111%2Fcoep.12241");
    vi.unstubAllGlobals();
  });
});

describe("the rubric: how it reads against respected research writing", () => {
  const body = `## TL;DR

${"Word ".repeat(160)}.

## Details

### 1. The thesis

Short sentence one [1]. Short sentence two clearly shows it [2].

### 2. The strongest case for

${"The case for has many words in it here and there and everywhere. ".repeat(10)}[1].

### 3. The strongest case against

Only a little against [2].

## Sources

1. [A](https://www150.statcan.gc.ca/a)
2. [B](https://www150.statcan.gc.ca/b)
3. [C](https://www150.statcan.gc.ca/c)
4. [D](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1)
`;

  it("measures words per source, one publisher's share, certainty words, the summary and the case against", async () => {
    const { rubric } = await import("../src/write/research");
    const r = rubric(body, [
      {
        url: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1",
        text: "abstract only",
      } as never,
    ]);
    expect(r.sources).toBe(4);
    expect(r.topPublisher).toMatchObject({ site: "www150.statcan.gc.ca", sources: 3 });
    expect(r.certaintyWords).toEqual(["clearly"]);
    expect(r.tldrWords).toBeGreaterThan(150);
    expect(r.caseAgainstRatio).toBeLessThan(0.6);
    expect(r.thinSources.map((t) => t.n)).toEqual([4]);
    const said = r.flags.join("\n");
    expect(said).toContain("3 of 4 sources are from www150.statcan.gc.ca");
    expect(said).toContain("Certainty without a scale: clearly");
    expect(said).toContain("The TL;DR runs");
    expect(said).toContain("The case against is");
    expect(said).toContain("[4] was read as only 13 characters");
  });

  it("says nothing about a dense, balanced, plain report", async () => {
    const { rubric } = await import("../src/write/research");
    const ok = `## TL;DR

The answer is likely yes [1].

## Details

### 1. What was found

A short sentence [1]. Another short one [2].

## Sources

1. [A](https://a.example/1)
2. [B](https://b.example/2)
`;
    expect(rubric(ok).flags).toEqual([]);
  });
});

describe("citation chasing", () => {
  it("lists what a paper cites and what cites it, most-cited first", async () => {
    const { describeRelated, relatedWorks } = await import("../src/write/finder");
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        seen.push(url);
        const body = url.includes("/works/doi:")
          ? {
              id: "https://openalex.org/W1",
              referenced_works: ["https://openalex.org/W2", "https://openalex.org/W3"],
            }
          : url.includes("filter=openalex:")
            ? {
                results: [
                  {
                    title: "An older study",
                    doi: "https://doi.org/10.1/old",
                    publication_year: 2005,
                    cited_by_count: 400,
                  },
                ],
              }
            : {
                results: [
                  {
                    title: "A later review",
                    publication_year: 2023,
                    cited_by_count: 12,
                    open_access: { oa_url: "https://repo.example/review.pdf" },
                  },
                ],
              };
        return new Response(JSON.stringify(body), {
          headers: { "content-type": "application/json" },
        });
      }),
    );
    const r = await relatedWorks("10.3138/cpp.2019-070");
    vi.unstubAllGlobals();
    expect(seen[1]).toContain("filter=openalex:W2|W3&sort=cited_by_count:desc");
    expect(seen[2]).toContain("filter=cites:W1&sort=cited_by_count:desc");
    expect(r?.cites).toEqual([
      { title: "An older study", year: 2005, cited: 400, url: "https://doi.org/10.1/old" },
    ]);
    expect(r?.citedBy[0]?.url).toBe("https://repo.example/review.pdf");
    const said = describeRelated(r as never);
    expect(said).toContain("RELATED WORK");
    expect(said).toContain("- An older study (2005), cited 400 times — https://doi.org/10.1/old");
    expect(said).toContain("Later work citing it:");
  });

  it("is quiet when OpenAlex does not know the paper", async () => {
    const { relatedWorks } = await import("../src/write/finder");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 404 })),
    );
    expect(await relatedWorks("10.9999/nothing")).toBeNull();
    vi.unstubAllGlobals();
  });
});

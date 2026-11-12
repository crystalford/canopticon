// How this was researched: a saved report's method trail, in counts code
// made — never composed, never claiming a check that did not run.
import { describe, expect, it } from "vitest";
import { methodNote } from "../src/write/method";
import type { Note } from "../src/write/notes";
import { type ResearchSource, reportFile } from "../src/write/research";

const page = (url: string, title: string | null = null): ResearchSource => ({
  url,
  title,
  retrievedAt: null,
  kind: "text",
  text: "Some page text.",
});
const note = (n: number, url: string): Note => ({ n, url, quote: "q", claim: "c", section: 1 });

describe("the method note", () => {
  const pages = [
    page("https://www150.statcan.gc.ca/a"),
    page("https://www150.statcan.gc.ca/b"),
    page("https://doi.org/10.1/x"),
    page("https://www.cbc.ca/news/x"),
    page("https://unused.example/page"),
  ];
  const notes = [
    note(1, "https://www150.statcan.gc.ca/a"),
    note(2, "https://www150.statcan.gc.ca/a"),
    note(3, "https://www150.statcan.gc.ca/b"),
    note(4, "https://doi.org/10.1/x"),
    note(5, "https://www.cbc.ca/news/x"),
  ];
  const body =
    "## Details\n\n### 1. A\n\nRents rose [1]. Flagged sentence stays [2].\n\n## Sources\n";

  it("says what was read, noted, cited and checked, in counts", () => {
    const m = methodNote(
      {
        body,
        meta: {
          mode: "thesis",
          review: [
            { sentence: "Flagged sentence stays [2]." },
            { sentence: "A sentence since rewritten." },
          ],
          sources: { cited: 4, independent: 3 },
        },
      },
      notes,
      pages,
      { total: 12, failed: 0 },
    );
    expect(m).toContain("## How this was researched");
    expect(m).toContain("**Read:** 5 pages in full");
    expect(m).toContain("**Noted:** 5 passages");
    expect(m).toContain("**Sources:** 4 sources from 3 publishers, about 3 of them independent");
    expect(m).toContain(
      "By kind, read from each address: 2 official, 1 peer-reviewed study, 1 news.",
    );
    expect(m).toContain("**Quotations:** 12 quotations, every one found word for word");
    expect(m).toContain("2 points flagged, 1 changed since.");
    expect(m).toContain("**Method:** a thesis test");
    expect(m).toContain("Every count above is made in code");
    // No address in it: the page's "shares sources with" reads every link.
    expect(m).not.toMatch(/https?:\/\//);
  });

  it("names no check that did not run", () => {
    const m = methodNote({ body, meta: {} }, [], [page("https://a.example/x")], {
      total: 0,
      failed: 0,
    });
    expect(m).toContain("**Read:** 1 page in full");
    expect(m).not.toContain("Noted");
    expect(m).not.toContain("Sources:");
    expect(m).not.toContain("Quotations");
    expect(m).not.toContain("Reviewed");
    expect(m).not.toContain("thesis");
  });

  it("goes at the end of the saved file", () => {
    const file = reportFile(
      { meta: { title: "T" }, body: "## TL;DR\n\nX.\n\n## Sources\n\n1. A" },
      "## How this was researched\n\n- x\n",
    );
    expect(file).toBe(
      "# T\n\n## TL;DR\n\nX.\n\n## Sources\n\n1. A\n\n## How this was researched\n\n- x\n",
    );
    expect(reportFile({ meta: { title: "T" }, body: "B" })).toBe("# T\n\nB\n");
  });
});

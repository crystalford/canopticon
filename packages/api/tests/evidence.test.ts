// The evidence checks (Phase 2): the figure on the page it cites, certainty
// the kinds of source earn, Key Findings on one publisher — in code.
import { describe, expect, it } from "vitest";
import { describeEvidence, evidenceProblems, sourceKind } from "../src/write/evidence";
import type { Note } from "../src/write/notes";
import type { ResearchSource } from "../src/write/research";

const page = (url: string, text: string, title: string | null = null): ResearchSource => ({
  url,
  title,
  retrievedAt: null,
  kind: "text",
  text,
});
const note = (n: number, url: string): Note => ({ n, url, quote: "q", claim: "c", section: 1 });

describe("what kind of source a page is", () => {
  it("reads it from the address and title, by rules a person can check", () => {
    expect(sourceKind("https://www150.statcan.gc.ca/n1/daily-quotidien/x")).toBe("official");
    expect(sourceKind("https://www.cmhc-schl.gc.ca/report")).toBe("official");
    expect(sourceKind("https://www.ontario.ca/page/rent")).toBe("official");
    expect(sourceKind("https://www.oecd.org/housing")).toBe("official");
    expect(sourceKind("https://doi.org/10.1/x")).toBe("study");
    expect(sourceKind("https://www.tandfonline.com/doi/full/10.1/x")).toBe("study");
    expect(sourceKind("https://x.org/a", "A systematic review of rent control")).toBe("review");
    expect(sourceKind("https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1")).toBe("preprint");
    expect(sourceKind("https://plato.stanford.edu/entries/mcluhan/")).toBe("academic");
    expect(sourceKind("https://economics.utoronto.ca/x")).toBe("academic");
    expect(sourceKind("https://openlibrary.org/works/OL1W")).toBe("book");
    expect(sourceKind("https://www.cbc.ca/news/x")).toBe("news");
    expect(sourceKind("https://en.wikipedia.org/wiki/Tetrad")).toBe("reference");
    // An archived copy counts as the site it copied.
    expect(sourceKind("https://web.archive.org/web/2020/https://www.cbc.ca/news/x")).toBe("news");
    expect(sourceKind("https://someblog.example/post")).toBe("other");
    // Small journals: Open Journal Systems paths and known journal hosts.
    expect(
      sourceKind(
        "https://web.archive.org/web/2019/https://www.cjc-online.ca/index.php/journal/article/view/1046/952",
      ),
    ).toBe("study");
    expect(sourceKind("https://dl.digra.org/index.php/dl/article/download/264/264")).toBe("study");
    expect(sourceKind("http://dhs.ff.untz.ba/index.php/home/article/download/12139/857")).toBe(
      "study",
    );
    expect(sourceKind("https://gamestudies.org/0802/articles/tyler")).toBe("study");
    expect(sourceKind("https://docs.iza.org/dp14178.pdf")).toBe("preprint");
  });
});

describe("the evidence checks", () => {
  const pages = [
    page(
      "https://www.cmhc-schl.gc.ca/report",
      "Rents rose 4.2 per cent. Starts were 12,400 units.",
    ),
    page("https://www.thestar.com/news/rates", "Rates rose and builders paused."),
    page("https://www150.statcan.gc.ca/rents", "Average rent was $1,950 a month."),
    page("https://economics.ubc.ca/paper", "The vacancy rate fell to 1.9 per cent."),
  ];
  const notes = [
    note(1, pages[0]?.url as string),
    note(2, pages[1]?.url as string),
    note(3, pages[2]?.url as string),
  ];
  const body = [
    "## TL;DR",
    "",
    "Rents rose.",
    "",
    "## Key Findings",
    "",
    "- Rents rose 4.2 per cent in 2025 [1].",
    "- Starts very likely fell because rates rose [2].",
    "- Average rent reached $1,950 a month, and rents rose 4.2 per cent [1, 3].",
    "",
    "## Details",
    "",
    "### 1. What happened?",
    "",
    "Rents rose 4.2 per cent in Toronto in 2025, and vacancy fell to 1.9 per cent [1]. Starts were 12,400 units that year [2]. It is very likely that rates caused the pause [2]. The data demonstrate that rents rose 4.2 per cent [1, 3].",
    "",
    "## Open questions",
    "",
    "None.",
    "",
    "## Sources",
    "",
  ].join("\n");
  const e = evidenceProblems(body, notes, pages);

  it("finds a figure that is not on the page it cites, and says where it is", () => {
    expect(e.misplacedFigures.map((f) => [f.figure, f.cites, f.on])).toEqual([
      ["1.9", [1], "https://economics.ubc.ca/paper"],
      ["12,400", [2], "[1]"],
    ]);
  });
  it("finds certainty above its evidence", () => {
    expect(e.overcertain.map((o) => o.why)).toEqual(["it cites only news", "it cites only news"]);
    // Official data behind "demonstrate": earned.
    expect(e.overcertain.some((o) => o.sentence.includes("demonstrate"))).toBe(false);
  });
  it("finds Key Findings that stand on one publisher", () => {
    expect(e.onePublisherFindings).toEqual([
      "Rents rose 4.2 per cent in 2025 [1].",
      "Starts very likely fell because rates rose [2].",
    ]);
  });
  it("counts the cited sources by kind and tells the writer", () => {
    expect(e.profile).toEqual({ official: 2, news: 1 });
    const said = describeEvidence(e);
    expect(said).toContain("FIGURES NOT ON THE PAGE THEY CITE (2)");
    expect(said).toContain("12,400 cites [2]; it is on source [1]");
    expect(said).toContain("read but never noted (note it, then cite it)");
    expect(said).toContain("CERTAINTY ABOVE ITS EVIDENCE (2)");
    expect(said).toContain("KEY FINDINGS ON ONE PUBLISHER (2)");
    expect(said).toContain("Your cited sources by kind: 2 official, 1 news.");
  });
  it("leaves alone a Key Finding that says whose finding it is", () => {
    const attributed = evidenceProblems(
      [
        "## Key Findings",
        "",
        "- Logan and Iseri state the laws apply to every artefact [1].",
        "- Rents rose 4.2 per cent, per Statistics Canada [1].",
        "- Katz and Katz report that McLuhan tried to test them [1].",
        "- McLuhan also claimed predictive force for the tetrad [1].",
        "- Tyler's critique is a double bind, not a vagueness complaint [1].",
        "- In the McLuhans' own words, all four laws operate at once [1].",
        "- Rents rose 4.2 per cent [1].",
        "",
        "## Details",
        "",
        "### 1. A",
        "",
        "Text [2]. More [3].",
        "",
        "## Sources",
        "",
      ].join("\n"),
      notes,
      pages,
    );
    expect(attributed.onePublisherFindings).toEqual(["Rents rose 4.2 per cent [1]."]);
  });
  it("says nothing of a sound report but its sources", () => {
    const sound = evidenceProblems(
      "## Key Findings\n\n- Rents rose 4.2 per cent [1, 3].\n\n## Details\n\n### 1. A\n\nRents rose 4.2 per cent [1].\n\n## Sources\n",
      notes,
      pages,
    );
    expect(sound.misplacedFigures).toEqual([]);
    expect(sound.overcertain).toEqual([]);
    expect(sound.onePublisherFindings).toEqual([]);
    expect(describeEvidence(sound)).toBe("\nYour cited sources by kind: 2 official, 1 news.");
  });
});

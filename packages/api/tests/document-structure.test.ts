// Finding the structure a research document already wrote for itself.
//
// The operator's complaint was that a 3.3k-word dossier is "a wall of text,
// absolutely insane to comb through if you aren't a machine". The answer is
// not to write a summary — it is that the document ALREADY had one, sixteen
// rows of hardened facts, buried a thousand words down.
//
// So the property under test is the same firewall as everywhere else: this
// module INVENTS NOTHING. Everything it returns is a contiguous slice of the
// document, and the remainder plus the promoted block is still the document.

import { describe, expect, it } from "vitest";
import { documentStructure } from "../src/lib/document-structure";

// Shaped after the live PASS 7 dossier: a summary table of hardened facts, a
// run of task sections, and the document's own statement of what it could not
// establish.
const dossier = `# PASS 7-MINI — HARDENING DOSSIER

Every claim below is tied to an open-record source.

## SUMMARY TABLE — HARDENED FACTS

| # | Fact | Source | Confidence |
|---|------|--------|-----------|
| 1 | Nadeau is Director of Research and Advertising. | Hill Times | HIGH |
| 2 | Nadeau came from Data Sciences Inc. | TheOrg | HIGH |

## TASK 1 — POLLARA PCO CONTRACT

The contract was awarded in January 2022 and ran for three years.

## TASK 2 — DATA SCIENCES FEDERAL FOOTPRINT

Data Sciences Inc. holds standing offers across three departments.

## DOCUMENTARY GAPS REMAINING

- The value of the 2023 amendment is not on the open record.
- No lobbying filing names the intermediary.
`;

describe("the contents rail", () => {
  it("lists the headings still in the body, in document order", () => {
    // The summary table and the gaps section are promoted to the top, so they
    // are no longer in the body and must not be in the rail — an entry for a
    // moved section jumps to an anchor that is not there any more.
    const s = documentStructure(dossier);
    expect(s.contents.map((c) => c.text)).toEqual([
      "PASS 7-MINI — HARDENING DOSSIER",
      "TASK 1 — POLLARA PCO CONTRACT",
      "TASK 2 — DATA SCIENCES FEDERAL FOOTPRINT",
    ]);
  });

  it("anchors match what the markdown renderer emits, or the rail is dead links", () => {
    const s = documentStructure(dossier);
    const rail = s.contents.find((c) => c.text.startsWith("TASK 1"));
    expect(rail?.anchor).toBe("task-1-pollara-pco-contract");
  });

  it("disambiguates repeated headings the same way the renderer does", () => {
    const s = documentStructure("## Method\n\na\n\n## Method\n\nb");
    expect(s.contents.map((c) => c.anchor)).toEqual(["method", "method-2"]);
  });

  it("ignores headings inside fenced code", () => {
    const s = documentStructure("## Real\n\n```\n## Not a heading\n```\n");
    expect(s.contents.map((c) => c.text)).toEqual(["Real"]);
  });
});

describe("the document's own summary table", () => {
  it("finds the table under the summary heading", () => {
    const s = documentStructure(dossier);
    expect(s.leadTable).toContain("Nadeau is Director of Research and Advertising");
    expect(s.leadTableHeading).toBe("SUMMARY TABLE — HARDENED FACTS");
  });

  it("is MOVED, not copied — rule 3, nothing written twice", () => {
    // The same sixteen rows at the top and again in the body is the failure.
    const s = documentStructure(dossier);
    expect(s.remainder).not.toContain("Nadeau is Director of Research and Advertising");
    expect(s.remainder).not.toContain("SUMMARY TABLE — HARDENED FACTS");
  });

  it("leaves the rest of the document completely intact", () => {
    const s = documentStructure(dossier);
    expect(s.remainder).toContain("TASK 1 — POLLARA PCO CONTRACT");
    expect(s.remainder).toContain("awarded in January 2022");
  });

  it("falls back to the first table when no heading announces one", () => {
    const md = "Some prose.\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n";
    const s = documentStructure(md);
    expect(s.leadTable).toContain("| 1 | 2 |");
    expect(s.leadTableHeading).toBeNull();
  });

  it("refuses a table with no data rows — a header alone is not a summary", () => {
    const md = "## Summary\n\n| A | B |\n| --- | --- |\n";
    expect(documentStructure(md).leadTable).toBeNull();
  });

  it("returns null when the document has no table at all", () => {
    const s = documentStructure("## Intro\n\nJust prose, no tables anywhere.");
    expect(s.leadTable).toBeNull();
    expect(s.remainder).toContain("Just prose");
  });
});

describe("what the document says it could not establish", () => {
  // The most valuable block on a page whose argument is provenance, and it
  // was at the bottom.
  it("finds the gaps section by what it calls itself", () => {
    const s = documentStructure(dossier);
    expect(s.gapsHeading).toBe("DOCUMENTARY GAPS REMAINING");
    expect(s.gaps).toContain("not on the open record");
  });

  it.each(["Unresolved questions", "What is missing", "Caveats", "Known limitations"])(
    "recognises a section called %s",
    (heading) => {
      const s = documentStructure(`## ${heading}\n\n- something is absent\n`);
      expect(s.gaps).toContain("something is absent");
    },
  );

  it("is null when the document claims no gaps", () => {
    expect(documentStructure("## Findings\n\nAll established.").gaps).toBeNull();
  });

  it("is MOVED out of the body, like the table", () => {
    // The first build left this in place, reasoning that a short block costs
    // nothing to repeat. Rendered, it was visibly the same two bullets twice
    // on one page — which is what rule 3 exists to stop.
    const s = documentStructure(dossier);
    expect(s.remainder).not.toContain("DOCUMENTARY GAPS REMAINING");
    expect(s.remainder).not.toContain("not on the open record");
  });

  it("drops a promoted section from the contents rail", () => {
    // A rail entry pointing at a section that has moved to the top would jump
    // to an anchor the body no longer contains.
    const s = documentStructure(dossier);
    expect(s.contents.map((c) => c.text)).not.toContain("DOCUMENTARY GAPS REMAINING");
    expect(s.contents.map((c) => c.text)).not.toContain("SUMMARY TABLE — HARDENED FACTS");
    expect(s.contents.map((c) => c.text)).toContain("TASK 1 — POLLARA PCO CONTRACT");
  });
});

describe("nothing is invented", () => {
  it("every returned block is a literal slice of the document", () => {
    const s = documentStructure(dossier);
    if (s.leadTable) expect(dossier).toContain(s.leadTable);
    if (s.gaps) expect(dossier).toContain(s.gaps);
    for (const c of s.contents) expect(dossier).toContain(c.text);
  });

  it("survives an empty document without claiming structure", () => {
    const s = documentStructure("");
    expect(s.contents).toEqual([]);
    expect(s.leadTable).toBeNull();
    expect(s.gaps).toBeNull();
    expect(s.remainder).toBe("");
  });
});

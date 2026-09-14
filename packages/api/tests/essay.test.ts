// The essay convention: parsing, classification, and the lint.
//
// The point of this module is that an essay's published structure is DERIVED,
// never authored twice — so these tests pin the derivation. If parseEssay
// drifts, the table of contents, the section anchors, the Q&A structured data
// and the source links all drift together and silently.

import { describe, expect, it } from "vitest";
import { lintEssay, looksLikeEssay, parseEssay } from "../src/lib/essay";

const ESSAY = `# The Logic Costume

Authority performed as logic is still a performance.

A person who claims to run on logic has made a testable claim, and it is
tested every time they speak.

## What is the logic costume?

Authority borrowed from a method by someone who does not submit to its
checks [1].

It is worn, not earned.

## Why does it work on an audience?

Audiences reward the signals of rigour faster than they can check it [2].

## Sources

1. Copi, I. Introduction to Logic. Pearson, 2016.
2. Postman, N. Amusing Ourselves to Death. Viking, 1985.
`;

describe("parseEssay", () => {
  const parsed = parseEssay(ESSAY);

  it("takes the title from the H1", () => {
    expect(parsed.title).toBe("The Logic Costume");
  });

  it("splits the preamble into a dek and a summary", () => {
    expect(parsed.dek).toBe("Authority performed as logic is still a performance.");
    expect(parsed.summary).toContain("A person who claims to run on logic");
    // Wrapped source lines are joined back into one paragraph.
    expect(parsed.summary).toContain("tested every time they speak");
  });

  it("treats a lone preamble paragraph as the summary, not a dek", () => {
    const one = parseEssay("# T\n\nOnly one paragraph here.\n\n## A question?\n\nYes.\n");
    expect(one.dek).toBe("");
    expect(one.summary).toBe("Only one paragraph here.");
  });

  it("gives every section a positional anchor and marks the questions", () => {
    expect(parsed.sections.map((s) => s.anchor)).toEqual(["s1", "s2"]);
    expect(parsed.sections.every((s) => s.isQuestion)).toBe(true);
    expect(parsed.sections[0]?.heading).toBe("What is the logic costume?");
    expect(parsed.sections[0]?.paragraphs).toHaveLength(2);
  });

  it("pulls the Sources block out of the body and strips list numbering", () => {
    expect(parsed.sources).toEqual([
      "Copi, I. Introduction to Logic. Pearson, 2016.",
      "Postman, N. Amusing Ourselves to Death. Viking, 1985.",
    ]);
    // Sources are not also a section — they render as their own list.
    expect(parsed.sections.map((s) => s.heading)).not.toContain("Sources");
  });

  it("marks a non-question heading as not FAQ-eligible", () => {
    const p = parseEssay("# T\n\nS.\n\n## Background\n\nText.\n");
    expect(p.sections[0]?.isQuestion).toBe(false);
  });
});

describe("looksLikeEssay", () => {
  it("accepts a document whose headings are mostly questions", () => {
    expect(looksLikeEssay(ESSAY)).toBe(true);
  });

  it("rejects a research document with descriptive headings", () => {
    const report = `# Budget 2026

## Short version

Spending rose.

## Key findings

Three things.

## Caveats

Provisional.
`;
    expect(looksLikeEssay(report)).toBe(false);
  });

  it("rejects a document with too few headings to show a pattern", () => {
    expect(looksLikeEssay("# T\n\n## Only one?\n\nYes.\n")).toBe(false);
  });

  it("does not count the Sources heading toward the ratio", () => {
    // One real heading + Sources. One heading is below the threshold either
    // way; what matters is Sources never tips a document into being an essay.
    expect(looksLikeEssay("# T\n\n## A?\n\nx\n\n## Sources\n\n1. y\n")).toBe(false);
  });
});

describe("lintEssay", () => {
  it("passes a well-formed essay with everything cited", () => {
    const notes = lintEssay(parseEssay(ESSAY));
    expect(notes.filter((n) => n.level === "error")).toHaveLength(0);
    expect(notes.filter((n) => n.level === "warn")).toHaveLength(0);
    expect(notes).toHaveLength(0);
  });

  it("flags an opening paragraph that buries the answer", () => {
    const long = `# T

Summary.

## What is it?

${"word ".repeat(80)}

## Sources

1. x [1]
`;
    const notes = lintEssay(parseEssay(long));
    expect(
      notes.some((n) => n.level === "warn" && /opening paragraph is 80 words/.test(n.message)),
    ).toBe(true);
  });

  it("flags a source that is listed but never referenced inline", () => {
    const uncited = `# T

Summary.

## What is it?

An answer with no reference.

## Sources

1. Somebody. A Book. 2026.
`;
    const notes = lintEssay(parseEssay(uncited));
    expect(notes.some((n) => /Source 1 is listed but never cited/.test(n.message))).toBe(true);
  });

  it("errors on a missing title and missing sections", () => {
    const notes = lintEssay(parseEssay("Just some prose with no structure at all."));
    const errors = notes.filter((n) => n.level === "error").map((n) => n.message);
    expect(errors.some((m) => /No title/.test(m))).toBe(true);
    expect(errors.some((m) => /No sections/.test(m))).toBe(true);
  });

  it("warns when there is no summary block", () => {
    const notes = lintEssay(parseEssay("# T\n\n## A question?\n\nAn answer.\n"));
    expect(notes.some((n) => n.level === "warn" && /No summary paragraph/.test(n.message))).toBe(
      true,
    );
  });
});

// How this was researched: the method trail a saved report carries.
//
// A reader of a research report cannot see how it was made, and so has to
// take it on trust. Systematic reviews answer that with a flow diagram and a
// protocol; this is the record's version, in counts that code made, not a
// model: pages read, passages noted (each checked word for word when it was
// made), sources and how many stand on their own, their kinds, quotations
// checked, what the reviewers flagged and how much of it changed. Nothing is
// composed and nothing claims more than was done; a check that did not run
// is not mentioned (standing rule 6).
//
// Added when a report is saved to Admin (`reportFile`), so it is in the
// document Chris reviews before Publish, and published with it.

import { KIND_LABEL, type SourceKind, evidenceProblems } from "./evidence";
import { siteOf } from "./independence";
import { type Note, sourceNumbers } from "./notes";
import type { ResearchSource } from "./research";

export interface MethodInput {
  body: string;
  meta: {
    mode?: "thesis" | "deepen" | undefined;
    review?: Array<{ sentence: string }> | undefined;
    sources?: { cited: number; independent: number } | undefined;
  };
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString("en")} ${n === 1 ? one : many}`;
const flat = (s: string) => s.replace(/\s+/g, " ").trim();

export function methodNote(
  d: MethodInput,
  notes: Note[],
  pages: ResearchSource[],
  quotations: { total: number; failed: number },
): string {
  const numbers = sourceNumbers(notes);
  const publishers = new Set([...numbers.keys()].map(siteOf));
  const lines: string[] = [];
  lines.push(
    `- **Read:** ${plural(pages.length, "page")} in full, every one kept, so each quotation and note can be checked against the page itself.`,
  );
  if (notes.length)
    lines.push(
      `- **Noted:** ${plural(notes.length, "passage")}, each refused unless its words were on the page, word for word, when it was noted.`,
    );
  if (numbers.size) {
    const s = d.meta.sources;
    const independent =
      s && s.cited === numbers.size && s.independent < s.cited
        ? `, about ${s.independent} of them independent (the others repeat another source's wording or publisher)`
        : "";
    const kinds = Object.entries(evidenceProblems(d.body, notes, pages).profile)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .map(([k, n]) => `${n} ${KIND_LABEL[k as SourceKind]}`);
    lines.push(
      `- **Sources:** ${plural(numbers.size, "source")} from ${plural(publishers.size, "publisher")}${independent}. By kind, read from each address: ${kinds.join(", ")}.`,
    );
  }
  if (quotations.total)
    lines.push(
      quotations.failed
        ? `- **Quotations:** ${plural(quotations.total, "quotation")}, ${quotations.failed} not found word for word in the page ${quotations.failed === 1 ? "it quotes" : "they quote"}.`
        : `- **Quotations:** ${plural(quotations.total, "quotation")}, every one found word for word in the page it quotes.`,
    );
  if (d.meta.review) {
    const body = flat(d.body);
    const changed = d.meta.review.filter((f) => !body.includes(flat(f.sentence))).length;
    lines.push(
      d.meta.review.length
        ? `- **Reviewed:** one reviewer per section read it against its notes and searched for evidence against it; ${plural(d.meta.review.length, "point")} flagged, ${changed} changed since.`
        : "- **Reviewed:** one reviewer per section read it against its notes and searched for evidence against it; nothing was flagged.",
    );
  }
  if (d.meta.mode === "thesis")
    lines.push(
      "- **Method:** a thesis test — the claim stated precisely, the strongest case for and against researched separately, the verdict on a printed scale.",
    );
  lines.push(
    "- **Made by:** language models on Canopticon's research workspace, from free and open sources. Every count above is made in code, not reported by a model.",
  );
  return `## How this was researched\n\n${lines.join("\n")}\n`;
}

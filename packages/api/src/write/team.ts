// The research team: once a report is laid out, one researcher per section
// searches, reads and notes evidence at the same time, on a cheap model; the
// conversation's own model then writes every section from the notes.
//
// Why: sections are independent sub-questions, which is when parallel
// researchers pay (Anthropic's research system; production write-ups warn
// they do not when sub-tasks depend on each other). Reading is most of a
// report's tokens and V4.1 Flash reads well; writing is where V4 Pro was more
// careful (engine test, 2026-11-07). Every note is still checked word for
// word against the page in code, so a researcher cannot hand the writer
// words a page does not contain.
//
// The loop itself is agent.ts (runTeam / runResearcher): the same tools, the
// same page store and notes bank, the same allowance.

export const MAX_RESEARCHERS = 6;
export const RESEARCHER_STEPS = 16;
/** A section with this many notes already is not researched again. */
export const ENOUGH_NOTES = 4;

/** The tools a researcher may use: reading and noting, never writing. */
export const RESEARCHER_TOOLS = new Set([
  "web_search",
  "web_fetch",
  "note_evidence",
  "list_notes",
  "search_documents",
  "read_document",
]);

export function researcherSystem(): string {
  return [
    "You are one of several researchers working at the same time on one research report for Canopticon, a public research record. Each researcher has one section of the report. You find and note the evidence for yours; you do not write it — the writer does that from your notes.",
    "",
    "HOW TO WORK",
    "- Primary sources first: the agency's, government's or institution's own pages, statistics tables, laws, budget documents, the studies themselves. Then serious secondary sources (major newspapers, think tanks, academic reviews) for what primary sources do not say.",
    "- Search, then read whole pages with web_fetch. Several searches or reads in one message run together.",
    "- Note every passage the writer will need with note_evidence: the page's address, its exact words (one or two sentences, copied character for character from the page you read) and the claim they support. A note whose words are not on the page is refused.",
    "- Figures: note them with who published them and for what date or period.",
    "- Where sources disagree, note both sides.",
    "- Aim for 6 to 12 notes from at least three different sources. Stay on your section; the others are covered.",
    "- If your section is the case for or against a claim, build that case as its best advocate would, from the best sources — and note the weaknesses you find in it too.",
    "- Before you call something unpublished or unknown, search for it specifically once or twice.",
    "",
    "WHEN YOU ARE DONE",
    "Stop calling tools and reply in two short lines: what you found, and what you looked for and could not find.",
  ].join("\n");
}

export function researcherBrief(
  question: string,
  sections: Array<{ n: number; heading: string }>,
  mine: { n: number; heading: string },
): string {
  return [
    `The question the report answers: ${question}`,
    "",
    "The report's sections:",
    ...sections.map((s) => `${s.n}. ${s.heading}${s.n === mine.n ? "   ← yours" : ""}`),
    "",
    `Research section ${mine.n}: "${mine.heading}". Your notes are filed under section ${mine.n} automatically.`,
  ].join("\n");
}

/** What the writer is told when the researchers are done. */
export function teamReport(
  done: Array<{ n: number; heading: string; notes: number; pages: number; said: string }>,
): string {
  return [
    "The researchers have finished. What each found (list_notes with a section number gives that section's notes):",
    ...done.map(
      (d) =>
        `§${d.n} ${d.heading}: ${d.notes} ${d.notes === 1 ? "note" : "notes"} from ${d.pages} ${d.pages === 1 ? "page" : "pages"}.${d.said ? ` ${d.said.replace(/\s+/g, " ").slice(0, 400)}` : ""}`,
    ),
    "",
    "Now write each section from its notes with write_section, citing as each note says. Search further yourself only for a gap you can name, and note what you find.",
  ].join("\n");
}

// ---- the reviewers ------------------------------------------------------------
//
// Code proves every quotation is on a page read and every citation names a
// listed source. It cannot tell whether a sentence says what its source says,
// or whether the strongest evidence against it was looked for. Once every
// section is written, one reviewer per section reads it against its notes,
// searches for counter-evidence, and flags what it finds; the writer fixes
// each before the summary, and Chris sees each flag and whether it was fixed.
// A flag must quote a sentence that is in the section, word for word, or it
// is dropped (the record's rule for every span a model hands back).

// Eight: live, twelve-step reviewers took up to eight minutes of a report.
export const REVIEWER_STEPS = 8;
/** Web allowance the reviewers get on top of the message's. */
export const REVIEW_SEARCHES = 25;
export const REVIEW_READS = 40;

export const REVIEW_KINDS = ["unsupported", "overstated", "counter", "missing"] as const;
export type ReviewKind = (typeof REVIEW_KINDS)[number];

export const KIND_WORDS: Record<ReviewKind, string> = {
  unsupported: "Not supported by its source",
  overstated: "Says more than its source",
  counter: "Evidence against it",
  missing: "Missing",
};

export interface ReviewFlag {
  section: number;
  kind: ReviewKind;
  /** The sentence flagged, as it stood in the section (word for word). */
  sentence: string;
  why: string;
  /** Counter-evidence: the page it is on (also noted). */
  url?: string;
}

/** The reviewer's one writing tool: a flag. */
export const FLAG_TOOL = {
  name: "flag",
  description:
    "Flag one problem in your section. sentence: copied word for word from the section. kind: unsupported (the cited source does not say it), overstated (it says more than the source: certainty, scope, cause, a figure rounded up), counter (you found evidence against it — note that evidence with note_evidence first and give its address), or missing (an important finding or side the section leaves out; quote the sentence it belongs after). why: one or two sentences.",
  input_schema: {
    type: "object" as const,
    properties: {
      sentence: { type: "string" },
      kind: { type: "string", enum: [...REVIEW_KINDS] },
      why: { type: "string" },
      url: { type: "string", description: "counter: the page the evidence is on" },
    },
    required: ["sentence", "kind", "why"],
  },
};

export const REVIEWER_TOOLS = new Set(["web_search", "web_fetch", "note_evidence", "flag"]);

export function reviewerSystem(): string {
  return [
    "You are a reviewer for Canopticon, a public research record. One section of a research report has been written from notes; each note is a passage copied word for word from a page that was read. Your job is to find what is wrong with the section before it is published. You do not rewrite it — the writer does that from your flags.",
    "",
    "CHECK, IN THIS ORDER",
    "1. Every sentence that cites a source [n]: does a note from that source say it? Flag `unsupported` if no note does, `overstated` if the sentence claims more than the note (more certainty, a wider scope, a cause where the source shows a correlation, a figure rounded in its favour).",
    "2. The section's main conclusions: search for the strongest evidence against them — official data that disagrees, a study with the opposite result, a serious critic. Read it, note it with note_evidence, and flag `counter` with its address.",
    "3. Flag `missing` for an important finding or side the section leaves out (one or two at most).",
    "",
    "RULES",
    "- Quote the sentence you flag word for word from the section; a flag whose sentence is not in the section is dropped.",
    "- Flag only real problems. A section with nothing wrong gets no flags — say so.",
    "- At most eight flags.",
    "",
    "When you are done, stop calling tools and reply in one line: how many flags, and the most important.",
  ].join("\n");
}

export function reviewerBrief(
  question: string,
  section: { n: number; heading: string; text: string },
  notes: string,
): string {
  return [
    `The question the report answers: ${question}`,
    "",
    `Section ${section.n}: ${section.heading}`,
    "",
    section.text,
    "",
    "THE NOTES IT WAS WRITTEN FROM (cite as [n] gives the source number used in the section):",
    notes,
  ].join("\n");
}

/** What the writer is told when the reviewers are done. */
export function reviewReport(flags: ReviewFlag[], dropped: number): string {
  if (!flags.length)
    return `The reviewers read every section against its notes and looked for counter-evidence: nothing to fix${dropped ? ` (${dropped} refused: the sentence quoted was not in the section)` : ""}. Write the summary and the closing.`;
  return [
    `The reviewers flagged ${flags.length} ${flags.length === 1 ? "point" : "points"}${dropped ? ` (${dropped} refused: the sentence quoted was not in the section)` : ""}. Fix each before the summary — with edit_draft (several at once with also): correct or cut an unsupported or overstated sentence, weigh counter-evidence in the text and cite its note, add what is missing. If a flag is wrong, leave the sentence and say why under Open questions.`,
    ...flags.map(
      (f, i) =>
        `${i + 1}. §${f.section} ${KIND_WORDS[f.kind]}: "${f.sentence.slice(0, 300)}" — ${f.why}${f.url ? ` (${f.url})` : ""}`,
    ),
    "",
    "Then write the summary and the closing.",
  ].join("\n");
}

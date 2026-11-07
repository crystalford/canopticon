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

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
/** Each researcher's own searches, two at a time at most. Live (engine test
 *  2026-11-08 13:15), five researchers fired four to six long searches a
 *  step, spent the message's whole allowance in four minutes, and two came
 *  back with no notes at all; the writer then spent twelve minutes
 *  researching again with no searches left, and two reports ran out of time. */
export const RESEARCHER_SEARCHES = 8;
export const RESEARCHER_SEARCHES_AT_ONCE = 2;
/** From this step a researcher reads and notes only: no more searching. */
export const RESEARCHER_READ_ONLY_FROM = RESEARCHER_STEPS - 4;
/** Independent sources (different sites) behind a researcher's notes. */
export const RESEARCHER_MIN_SOURCES = 3;
export const SEARCH_TOOLS = new Set(["web_search", "news_search"]);
/** A section with this many notes already is not researched again. */
export const ENOUGH_NOTES = 4;
/** The second, narrower round (Saturate): a section whose notes stand on
 *  fewer than RESEARCHER_MIN_SOURCES sites gets one more researcher, told
 *  which publishers it already has and to find others. Shorter than the
 *  first: it knows what it is looking for. */
export const DIVERSIFY_STEPS = 10;
/** No second round, and no re-dispatch for a revised outline, this many
 *  minutes into the message: the writer needs the rest (WRITE_BY_MS is 14). */
export const SATURATE_BY_MS = 9 * 60 * 1000;
/** Researchers go out at most this many times in one message: the outline,
 *  and one revision the evidence calls for. */
export const MAX_DISPATCHES = 2;

/** The tools a researcher may use: reading and noting, never writing. */
export const RESEARCHER_TOOLS = new Set([
  "web_search",
  "news_search",
  "web_fetch",
  "note_evidence",
  "list_notes",
  "search_documents",
  "read_document",
]);

export function researcherSystem(steps = RESEARCHER_STEPS): string {
  return [
    "You are one of several researchers working at the same time on one research report for Canopticon, a public research record. Each researcher has one section of the report. You find and note the evidence for yours; you do not write it — the writer does that from your notes.",
    "",
    "HOW TO WORK",
    "- Primary sources first: the agency's, government's or institution's own pages, statistics tables, laws, budget documents, the studies themselves. Then serious secondary sources (major newspapers, think tanks, academic reviews) for what primary sources do not say.",
    "- Search, then read whole pages with web_fetch. Several searches or reads in one message run together.",
    "- Search in short keywords (three to six words, no quotation marks), and read early: after a search or two, fetch the best results and note what you will use.",
    `- You have ${RESEARCHER_SEARCHES} searches for your section, at most ${RESEARCHER_SEARCHES_AT_ONCE} at a time, and ${steps} steps. Reading and noting are what count: a researcher who searches and notes nothing has given the writer nothing. In your last four steps there is no searching — only reading and noting.`,
    "- Search covers news, research papers, health research, books, Wikipedia and Government of Canada data — not the whole web. When you know the authoritative source (the agency, statistics office, the law, the study), fetch it directly; follow the links a page lists to its reports, data and PDFs. Cite the primary sources Wikipedia points to, never Wikipedia.",
    "- Note every passage the writer will need with note_evidence: the page's address, its exact words (one or two sentences, copied character for character from the page you read) and the claim they support. A note whose words are not on the page is refused.",
    "- Figures: note them with who published them and for what date or period.",
    "- Where sources disagree, note both sides.",
    "- Aim for 6 to 12 notes from at least three independent sources — different institutions, and different kinds: official data, a study, an independent evaluation, the strongest dissent. Stay on your section; the others are covered.",
    "- A paper's page lists its RELATED WORK — what it cites and what later work cites it, most-cited first. Following it is how a review finds the sources a search misses.",
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
  views?: Perspectives,
): string {
  const lens = views ? lensFor(views, mine.n) : [];
  return [
    `The question the report answers: ${question}`,
    "",
    "The report's sections:",
    ...sections.map((s) => `${s.n}. ${s.heading}${s.n === mine.n ? "   ← yours" : ""}`),
    "",
    `Research section ${mine.n}: "${mine.heading}". Your notes are filed under section ${mine.n} automatically.`,
    ...(lens.length
      ? [
          "",
          "Who sees this differently — find sources that speak for each of these on your section, not only the first that comes up:",
          ...lens.map((v) => `- ${v.name}${v.stress ? `: ${v.stress}` : ""}`),
        ]
      : []),
  ].join("\n");
}

// ---- perspectives (STORM: perspective-guided question asking) ---------------
//
// A researcher left alone searches the obvious phrasing and reads what comes
// up first, which is how a report ends up on one agency's pages. Before the
// researchers go, one cheap call names the stakeholders who would see the
// question differently and which sections each bears on; each researcher is
// told to find sources that speak for its section's. If the call fails, the
// kinds of source every report needs stand in.

export interface Perspective {
  name: string;
  stress: string;
}
export interface Perspectives {
  all: Perspective[];
  /** Section number → indexes into `all`. */
  bySection: Map<number, number[]>;
}

export const DEFAULT_PERSPECTIVES: Perspective[] = [
  { name: "The government or agency responsible", stress: "its own data, laws and stated aims" },
  { name: "Independent researchers", stress: "studies and evaluations, including critical ones" },
  { name: "Industry or practitioners", stress: "how it works in practice, and the cost" },
  { name: "Those affected", stress: "who gains, who loses, and their own accounts" },
  { name: "Another jurisdiction", stress: "how a comparable place did it, and what happened" },
];

export function perspectivesPrompt(
  question: string,
  sections: Array<{ n: number; heading: string }>,
): string {
  return [
    `A research report answers: ${question}`,
    "",
    "Its sections:",
    ...sections.map((s) => `${s.n}. ${s.heading}`),
    "",
    "Name 4 to 6 perspectives that would see this question differently — specific stakeholders (an agency, an industry, a school of researchers, the people affected, a critic, another country), not topics. Then say which perspectives bear on each section. Reply in exactly this form and nothing else:",
    "",
    "PERSPECTIVES",
    "1. Name — what they would stress",
    "2. Name — what they would stress",
    "SECTIONS",
    "1: 1, 3",
    "2: 2, 4, 5",
  ].join("\n");
}

/** Reads the reply to perspectivesPrompt; null when it gives fewer than
 *  three perspectives. A section given none, or numbers out of range, gets
 *  every perspective. */
export function parsePerspectives(
  text: string,
  sections: Array<{ n: number }>,
): Perspectives | null {
  const all: Perspective[] = [];
  const bySection = new Map<number, number[]>();
  let part: "views" | "sections" | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/[*_`#]/g, "").trim();
    if (/^perspectives\b/i.test(line)) part = "views";
    else if (/^sections\b/i.test(line)) part = "sections";
    else if (part === "views") {
      const m = /^(?:\d+[.)]|[-•])\s*(.+)$/.exec(line);
      if (!m?.[1]) continue;
      const [name, ...rest] = m[1].split(/\s+[—–-]\s+|:\s+/);
      if (name?.trim() && all.length < 6)
        all.push({ name: name.trim().slice(0, 80), stress: rest.join(" — ").trim().slice(0, 160) });
    } else if (part === "sections") {
      const m = /^(?:§|section\s*)?(\d+)\s*[:.)-]\s*(.+)$/i.exec(line);
      if (!m?.[1] || !m[2]) continue;
      const picks = [...m[2].matchAll(/\d+/g)].map((x) => Number(x[0]) - 1);
      bySection.set(Number(m[1]), picks);
    }
  }
  if (all.length < 3) return null;
  for (const s of sections) {
    const picks = (bySection.get(s.n) ?? []).filter((i) => i >= 0 && i < all.length);
    bySection.set(s.n, picks.length ? [...new Set(picks)] : all.map((_, i) => i));
  }
  return { all, bySection };
}

export function defaultPerspectives(sections: Array<{ n: number }>): Perspectives {
  return {
    all: DEFAULT_PERSPECTIVES,
    bySection: new Map(sections.map((s) => [s.n, DEFAULT_PERSPECTIVES.map((_, i) => i)])),
  };
}

function lensFor(views: Perspectives, n: number): Perspective[] {
  const picks = views.bySection.get(n) ?? views.all.map((_, i) => i);
  return picks.map((i) => views.all[i]).filter((v): v is Perspective => !!v);
}

/** The second round's brief: what the section already stands on, and the
 *  instruction to stand it on something else. */
export function diversifyBrief(
  question: string,
  sections: Array<{ n: number; heading: string }>,
  mine: { n: number; heading: string },
  had: { notes: number; sites: string[] },
  views?: Perspectives,
): string {
  const lens = views ? lensFor(views, mine.n) : [];
  return [
    researcherBrief(question, sections, mine),
    "",
    `A first researcher has noted ${had.notes} ${had.notes === 1 ? "passage" : "passages"} for this section, from ${had.sites.length ? had.sites.join(", ") : "no source at all"}. That is too narrow: the section needs at least ${RESEARCHER_MIN_SOURCES} independent sources — different institutions.`,
    `Find what those pages do not give: a different kind of source (official data, a study, an independent evaluation, the strongest dissent) from a different publisher.${had.sites.length ? " More notes from those sites add nothing." : ""} If you find no independent source after a real search, say so in your two lines — that is a finding too.`,
    ...(lens.length
      ? [
          "",
          "Perspectives not yet heard on this section may be among:",
          ...lens.map((v) => `- ${v.name}`),
        ]
      : []),
  ].join("\n");
}

export interface Researched {
  n: number;
  heading: string;
  notes: number;
  pages: number;
  said: string;
  /** Distinct sites behind the section's notes, after every round. */
  sites?: number;
  /** The second round, when it ran: notes and new sites it added. */
  widened?: { notes: number; sites: number; said: string };
}

/** What the writer is told when the researchers are done. `revise`: the
 *  outline may still be revised once, and new sections get researchers. */
export function teamReport(done: Researched[], o: { revise?: boolean } = {}): string {
  const one = (x: string) => x.replace(/\s+/g, " ").slice(0, 400);
  return [
    "The researchers have finished. What each found (list_notes with a section number gives that section's notes):",
    ...done.map((d) => {
      const head = `§${d.n} ${d.heading}: ${d.notes} ${d.notes === 1 ? "note" : "notes"} from ${d.pages} ${d.pages === 1 ? "page" : "pages"}${d.sites !== undefined ? `, ${d.sites} independent ${d.sites === 1 ? "source" : "sources"}` : ""}.`;
      const said = d.said ? ` ${one(d.said)}` : "";
      const w = d.widened;
      const wide = !w
        ? ""
        : w.sites
          ? ` A second researcher looked for other sources: +${w.notes} ${w.notes === 1 ? "note" : "notes"}, +${w.sites} new ${w.sites === 1 ? "source" : "sources"}.${w.said ? ` ${one(w.said)}` : ""}`
          : ` A second researcher looked for other sources and found no new one${w.said ? ` (${one(w.said)})` : ""} — the section stands on what it has; say so where it matters.`;
      return head + said + wide;
    }),
    "",
    ...(o.revise
      ? [
          "If the notes show the outline is wrong — a sub-question the evidence raises that no section covers, two sections that overlap, one with nothing to say — revise it once with write_outline before writing. Keep every section that has notes at its number (rename it in place if it should say something else) and add new sections after the last; new sections get researchers. Otherwise keep the outline.",
          "",
        ]
      : []),
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
/** How long the review may take in all (engine test 2026-11-08 13:15: in
 *  the two reports that ran out of time, the slowest of five reviewers took
 *  about five minutes while the rest waited, and no reviewer flagged
 *  anything; the support check flagged two sentences). */
export const REVIEW_MS = 4 * 60 * 1000;
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

export const REVIEWER_TOOLS = new Set([
  "web_search",
  "news_search",
  "web_fetch",
  "note_evidence",
  "flag",
]);

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

// Research in the workspace: Claude takes a question, searches the web and
// reads whole pages with Anthropic's own tools (the ones Claude's Research
// uses), and writes a report in the record's shape. What makes it a record
// rather than a chat answer:
//
//   - every page Claude reads is kept (research_sources, migration 0069), as
//     text, a PDF through Cloudflare's converter — so
//   - every quotation in the report is checked against what was actually
//     read, in code, on every write; a failed one shows and goes back to
//     Claude to fix, and the report cannot leave the workspace with one;
//   - the finished report goes to Admin as a waiting upload, through the same
//     createAndExtract every upload uses, and publishes only on Publish.
//
// The pages themselves are sources to quote from, never content: nothing in
// research_sources is published (CLAUDE.md, the record-expand purge).

import type Anthropic from "@anthropic-ai/sdk";
import type { Env } from "../env";
import { all, one, run } from "../lib/d1";
import type { CheckResult, QuoteFailure } from "./check";
import { verbatimNormal } from "./check";
import { batches } from "./drafts";

// ---- what Claude is told --------------------------------------------------------

export const RESEARCH_HOW = `You research questions for Canopticon, a public research record, with its author, Chris Telford. He talks to you in a workspace: the chat is on the left, and the report you write is on the right, shown as it will appear in the record. Your report becomes a research document: kept whole, quoted by later articles, read by people and by answer engines. Write it to be checked.

THE RECORD
Canopticon holds: research documents (the sources you may quote, with uploads that may still be waiting in Admin); Chris's own published articles and papers (his writing — read them to know what is already written and to build on it, never quote them as a source); and concepts, open problems and key figures. You can read the record; you cannot change anything in it — not a title, topic, date or text. When something there looks wrong (a title that is really a heading, a document under the wrong topic), say what and why in one line, and Chris will have it fixed; do not tell him where to fix it.

HOW YOU RESEARCH
1. Before searching, restate the question as one sentence about the world, and name what Chris has already decided (treat that as given; mark anything that depends on it "Given your decision…"). If the question is unclear, ask him one short question first.
2. Check the record: search_documents and list_documents show what Canopticon already holds. Build on it; do not redo it.
3. Break the question into 3 to 6 concrete sub-questions that, answered together, cover it, and lay the report out with write_outline: one Details section per sub-question, each with a target length, the targets adding up to the depth below. Revise the outline as you learn (call it again; written sections are kept).
4. For each, search the web and read the most authoritative sources IN FULL with web_fetch — primary sources, official documents, datasets and peer-reviewed work over blogs, aggregators and encyclopedias. Do not rely on search snippets. When a secondary source cites a primary one, fetch the primary one.
   As you read, note every passage you will use with note_evidence: the exact words, what they show, and the section they are for. A note is checked against the page when you make it and gives the source its number to cite. Pages may leave your view later to keep the conversation short; your notes stay (list_notes shows them).
5. Be skeptical. Where sources disagree, say so, say which is more credible and why. Separate findings (what is true in the world, with a source) from your own inference, and label the inference.
6. Before you finish, check every citation: replace a blog, aggregator or encyclopedia with the primary source behind it, or say no stronger source exists.

HOW TO SEARCH AND READ WELL
- Start wide, then narrow: short queries (a few words) first, more specific ones once you see what exists. Never run the same query twice.
- Work in parallel: when several searches or several page reads do not depend on each other, ask for them together in one message, not one at a time.
- Never read the same page twice; everything you read is kept.
- Stop when new sources stop adding anything new. More reading past that point makes a report worse, not better: it buries the strong sources under weak ones.

DEPTH
The report is a document of record, not a summary. Be comprehensive: answer every sub-question in full, with the evidence itself — the figures, who measured them and how, the dates, the conditions, the competing accounts and why one is stronger — not a sentence pointing at it. The record's research documents run a median of about 4,500 words, and the thorough ones 7,000 or more; write at that depth whenever the evidence supports it, and longer when the question needs it. There is no length cap. Never pad: no repetition, no restating the TL;DR in the Details, no filler. If the evidence is genuinely thin, say so plainly in Open questions rather than stretching. Read widely before you write — usually ten or more sources read in full for a substantial question.

YOUR WEB ALLOWANCE
In one message you may run up to 80 web searches and read up to 80 pages. A substantial question usually takes 20 to 40 searches and 15 to 30 pages read in full; use what the question needs, not the whole allowance. Spend reads on primary sources, not on pages that only repeat them. If a search or read comes back "max_uses_exceeded", the allowance for this message is spent: write or revise the report with what you have, say under Open questions exactly what is still uncovered, and tell Chris to reply "keep going" — his next message brings a fresh allowance, and you continue where you stopped and revise the report.

THE REPORT (outline with write_outline, write each part with write_section, revise with edit_draft)
- Write each Details section with write_section once its research is noted, from its notes (list_notes with the section number gives them); then the closing; then the summary (TL;DR and Key Findings) last, when you know what the whole report found. Reach each section's target length with evidence, not filler. After a part is written, change it with edit_draft, never by writing the whole report again. When the check finds several quotations not word for word, fix them all in one edit_draft (the rest go in "also"), using the page's own words it gives you.
- Markdown, in this shape: no "# Title" line (the title is its own field).
  ## TL;DR — three to five sentences that answer the question.
  ## Key Findings — the findings as bullets, each with its source as [n].
  ## Details — "### 1. …" sections, one per sub-question, the evidence in full: several paragraphs each, with the numbers, methods, dates and disagreements the sources give.
  ## Beyond this question — what the findings mean for anyone working on this (only if there is something to say).
  ## Open questions — what nobody has measured, built or settled, stated plainly, and where coverage was thin.
  ## Sources — built for you from your notes, numbered in the order you first noted each source. Do not write it.
- Cite inline as [n], with the number note_evidence gave the source. Every non-obvious claim has one; a source you cite must have at least one note.
- Numbers appear exactly as the source gives them.
- A quotation is in double quotation marks and copied character for character from a page you fetched (whitespace aside). Every quotation is checked against the pages you read; one that is not found word for word fails. Quote sparingly and only what you read; otherwise paraphrase without quotation marks.
- Plain, direct prose. No throat-clearing, no "in conclusion".

IN THE CHAT
Be brief: say what you are doing and what you found. Do not paste the report into the chat; it is on the page. When Chris flags a passage it arrives as a quoted block (lines starting with "> "); revise that passage with edit_draft.
You cannot save or publish the report. Chris does it in two steps: "Save to Admin", the button in the bar above the report on the right (it works once nothing is listed under "Not ready for Admin" there), and then Publish on the report's card in Admin. When he asks you to publish, tell him exactly that, and fix whatever that list names that you can.
This conversation holds one report, and you can only write reports here. If Chris asks for an article or essay, do not write it and never paste it into the chat: tell him to Save to Admin, then press "Write an article from this" in the same bar, which opens an article conversation that starts from the saved report. If he asks a new question after the report is saved, you may write a new report with a new title; it replaces this one on the page, and the saved one stays in Admin.`;

export const WRITE_REPORT: Anthropic.Beta.BetaToolUnion = {
  name: "write_report",
  description:
    "Write the whole research report: its title, topic and Markdown body. Replaces the current report. Returns the check of every quotation against the pages you fetched.",
  eager_input_streaming: true,
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "A plain title that names the subject" },
      topic: { type: "string" },
      body: { type: "string", description: "The report in the shape above" },
    },
    required: ["title", "topic", "body"],
  },
};

/** Anthropic's server tools. Fetch is direct only, so every page Claude reads
 *  comes back where it can be kept and checked. */
export const SEARCH_LIMIT = 80;
export const READ_LIMIT = 80;
export const WEB_TOOLS: Anthropic.Beta.BetaToolUnion[] = [
  // The search results its own filtering code has used are left out of the
  // response (response_inclusion: "excluded"), so they are not carried in
  // the conversation and re-sent on every later step: on the live record,
  // 0.3–1.6 million characters of search results per research conversation.
  {
    type: "web_search_20260318",
    name: "web_search",
    max_uses: SEARCH_LIMIT,
    response_inclusion: "excluded",
  } as unknown as Anthropic.Beta.BetaToolUnion,
  {
    type: "web_fetch_20260209",
    name: "web_fetch",
    max_uses: READ_LIMIT,
    allowed_callers: ["direct"],
    // Half of what it was: on the live record (2026-11-04) cache writes of
    // fetched pages were most of what Claude research cost.
    max_content_tokens: 30000,
  },
];

// ---- keeping what was read --------------------------------------------------------

/** Characters kept per page: D1 holds 2MB a row, and a character can take
 *  three bytes. Longer pages are kept to this length and marked so. */
const KEEP_CHARS = 600_000;

interface FetchedBlock {
  type: string;
  content?: {
    type?: string;
    url?: string;
    retrieved_at?: string | null;
    content?: {
      title?: string | null;
      source?: { type?: string; data?: string; media_type?: string };
    };
  };
}

interface ToMarkdownAi {
  toMarkdown(
    files: Array<{ name: string; blob: Blob }>,
  ): Promise<Array<{ format: "markdown"; data: string } | { format: "error"; error: string }>>;
}

async function pdfText(env: Env, base64: string): Promise<string | null> {
  const ai = env.AI as unknown as Partial<ToMarkdownAi> | undefined;
  if (!ai || typeof ai.toMarkdown !== "function") return null;
  try {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const out = await ai.toMarkdown([
      { name: "page.pdf", blob: new Blob([bytes], { type: "application/pdf" }) },
    ]);
    const first = out[0];
    return first && first.format === "markdown" ? first.data : null;
  } catch {
    return null;
  }
}

export interface ResearchSource {
  url: string;
  title: string | null;
  retrievedAt: string | null;
  kind: "text" | "pdf";
  text: string;
  /** The page's most useful links, when it was just read (not kept: the
   *  kept text is what quotations are checked against). */
  links?: Array<{ text: string; url: string }>;
}

/** The pages in one reply's content, as text. */
export async function fetchedPages(env: Env, content: unknown[]): Promise<ResearchSource[]> {
  const out: ResearchSource[] = [];
  for (const raw of content as FetchedBlock[]) {
    if (raw.type !== "web_fetch_tool_result" || raw.content?.type !== "web_fetch_result") continue;
    const page = raw.content;
    const src = page.content?.source;
    if (!page.url || !src?.data) continue;
    const pdf = src.type === "base64" || src.media_type === "application/pdf";
    const text = pdf ? await pdfText(env, src.data) : src.data;
    if (!text) continue;
    out.push({
      url: page.url,
      title: page.content?.title ?? null,
      retrievedAt: page.retrieved_at ?? null,
      kind: pdf ? "pdf" : "text",
      text,
    });
  }
  return out;
}

export interface SourceStore {
  /** Keeps the pages; resolves to how many could not be kept. */
  add(draftId: string, pages: ResearchSource[]): Promise<number>;
  texts(draftId: string): Promise<ResearchSource[]>;
  /** One kept page by its address, without loading the others. */
  byUrl(draftId: string, url: string): Promise<ResearchSource | null>;
}

export function d1Sources(env: Env, userId: string): SourceStore {
  return {
    async add(draftId, pages) {
      let lost = 0;
      for (const p of pages) {
        const text =
          p.text.length > KEEP_CHARS
            ? `${p.text.slice(0, KEEP_CHARS)}\n\n[kept to ${KEEP_CHARS} characters]`
            : p.text;
        await run(
          env.DB,
          `INSERT INTO research_sources (id, draft_id, user_id, url, title, retrieved_at, kind, text, chars, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID().replace(/-/g, "").slice(0, 16),
            draftId,
            userId,
            p.url,
            p.title,
            p.retrievedAt,
            p.kind,
            text,
            p.text.length,
            new Date().toISOString(),
          ],
        ).catch(() => {
          lost++;
        });
      }
      return lost;
    },
    async byUrl(draftId, url) {
      const r = await one<{
        url: string;
        title: string | null;
        retrieved_at: string | null;
        kind: string;
        text: string;
      }>(
        env.DB,
        "SELECT url, title, retrieved_at, kind, text FROM research_sources WHERE draft_id = ? AND user_id = ? AND url = ? ORDER BY created_at DESC LIMIT 1",
        [draftId, userId, url],
      ).catch(() => null);
      return r
        ? {
            url: r.url,
            title: r.title,
            retrievedAt: r.retrieved_at,
            kind: r.kind === "pdf" ? "pdf" : "text",
            text: r.text,
          }
        : null;
    },
    async texts(draftId) {
      // A batch at a time, by the sizes in the index: eighty pages of up to
      // 600,000 characters in one query exceed D1's CPU limit.
      const sizes = await all<{ id: string; chars: number }>(
        env.DB,
        "SELECT id, chars FROM research_sources INDEXED BY research_sources_size WHERE draft_id = ? ORDER BY created_at, rowid",
        [draftId],
      ).catch(() => []);
      const rows: Array<{
        url: string;
        title: string | null;
        retrieved_at: string | null;
        kind: string;
        text: string;
      }> = [];
      const ids = sizes.map((r) => r.id);
      const index = new Map(ids.map((id, i) => [id, i]));
      for (const [from, to] of batches(
        sizes.map((r) => [r.id, Math.min(r.chars, KEEP_CHARS)] as [string, number]),
      )) {
        const group = ids.slice(index.get(from) ?? 0, (index.get(to) ?? 0) + 1);
        const got = await all<{
          id: string;
          url: string;
          title: string | null;
          retrieved_at: string | null;
          kind: string;
          text: string;
        }>(
          env.DB,
          `SELECT id, url, title, retrieved_at, kind, text FROM research_sources
            WHERE draft_id = ? AND user_id = ? AND id IN (${group.map(() => "?").join(", ")})`,
          [draftId, userId, ...group],
        ).catch(() => []);
        const byId = new Map(got.map((r) => [r.id, r]));
        for (const id of group) {
          const r = byId.get(id);
          if (r) rows.push(r);
        }
      }
      return rows.map((r) => ({
        url: r.url,
        title: r.title,
        retrievedAt: r.retrieved_at,
        kind: r.kind === "pdf" ? "pdf" : "text",
        text: r.text,
      }));
    },
  };
}

export function memorySources(): SourceStore & { rows: Map<string, ResearchSource[]> } {
  const rows = new Map<string, ResearchSource[]>();
  return {
    rows,
    async add(draftId, pages) {
      rows.set(draftId, [...(rows.get(draftId) ?? []), ...pages]);
      return 0;
    },
    async texts(draftId) {
      return rows.get(draftId) ?? [];
    },
    async byUrl(draftId, url) {
      return [...(rows.get(draftId) ?? [])].reverse().find((p) => p.url === url) ?? null;
    },
  };
}

// ---- checking the report's quotations ---------------------------------------------

/** Web pages wrap and space text arbitrarily, so a quotation from one is
 *  compared with whitespace collapsed (and emphasis stripped, as everywhere);
 *  nothing else is forgiven — not quote marks, not spelling. */
const flat = (s: string) => verbatimNormal(s).replace(/\s+/g, " ").trim();

/** Quotations in a report: text in double quotation marks of 40 characters
 *  or more (shorter quoted words are names and terms, not passages). */
export function reportQuotations(body: string): string[] {
  const out: string[] = [];
  // A quotation may wrap onto a second line, never across a blank line. A
  // straight quote opens only where a word does not end and closes only where
  // a word does not begin: between two short quoted terms ("net zero" … "scope
  // 1") the text is prose, and had been taken for a quotation that then failed.
  for (const m of body.matchAll(
    /“((?:[^”\n]|\n(?!\n)){40,})”|(?<![\w"])"(?=\S)((?:[^"\n]|\n(?!\n)){40,}?)(?<=\S)"(?![\w])/g,
  ))
    out.push((m[1] ?? m[2] ?? "").trim());
  return out;
}

export function checkReport(body: string, sources: ResearchSource[]): CheckResult {
  const quotes = reportQuotations(body);
  const pages = sources.map((s) => flat(s.text));
  const failed: QuoteFailure[] = [];
  for (const q of quotes) {
    const f = flat(q);
    if (!pages.some((p) => p.includes(f)))
      failed.push({ doc: "", section: "", text: q, kind: "q", reason: "not-verbatim" });
  }
  return { total: quotes.length, failed };
}

export function describeReportCheck(r: CheckResult, kept: number | ResearchSource[]): string {
  const pages = typeof kept === "number" ? kept : kept.length;
  const read = `${pages} ${pages === 1 ? "page" : "pages"} read so far.`;
  if (!r.total) return `No quotations. ${read}`;
  if (!r.failed.length)
    return `${r.total} quotations, all found word for word in the pages you read. ${read}`;
  // Where a page says nearly the same thing, its exact words are given, so the
  // quotation can be corrected without reading the page again.
  const near = (q: string) => (typeof kept === "number" ? null : nearestPassage(q, kept));
  return `${r.total} quotations, ${r.failed.length} NOT FOUND in any page you fetched. Copy each exactly from a page you fetched with web_fetch, or remove the quotation marks and paraphrase:\n${r.failed
    .map((f) => {
      const n = near(f.text);
      return `- "${f.text.slice(0, 160)}"${n ? `\n  The page ${n.url} says, word for word: "${n.text}"` : ""}`;
    })
    .join("\n")}\n${read}`;
}

/** The passage of a kept page that a failed quotation was probably taken
 *  from: found by the quotation's first (else last) six words, and given at
 *  the quotation's length, exactly as the page has it (whitespace collapsed). */
export function nearestPassage(
  quote: string,
  pages: ResearchSource[],
): { url: string; text: string } | null {
  const words = flat(quote).split(" ");
  if (words.length < 6) return null;
  for (const probe of [words.slice(0, 6).join(" "), words.slice(-6).join(" ")]) {
    for (const p of pages) {
      const text = flat(p.text);
      const at = text.indexOf(probe);
      if (at < 0) continue;
      const start =
        probe === words.slice(0, 6).join(" ")
          ? at
          : Math.max(0, at - flat(quote).length + probe.length);
      return { url: p.url, text: text.slice(start, start + flat(quote).length + 40).trim() };
    }
  }
  return null;
}

/** Citations in the report that point at nothing: a number past the Sources
 *  list (live, models cited their note numbers: 73 of 115 in one report),
 *  or a bracket that names a source in words ("[12 as background]",
 *  "[Canada.ca, BC gov]"). Empty when every citation is a listed number. */
export function citationProblems(body: string): string[] {
  const at = body.indexOf("\n## Sources");
  if (at < 0) return [];
  const text = body.slice(0, at);
  const listed = (body.slice(at).match(/^\d+\. /gm) ?? []).length;
  const beyond = new Set<number>();
  for (const m of text.matchAll(/\[(\d+(?:\s*[,–-]\s*\d+)*)\](?!\()/g))
    for (const x of (m[1] ?? "").match(/\d+/g) ?? []) {
      const k = Number(x);
      if (k < 1 || k > listed) beyond.add(k);
    }
  const worded = new Set<string>();
  for (const m of text.matchAll(/\[([^\]\n]{2,60})\](?!\()/g)) {
    const inner = m[1] ?? "";
    if (/^\d+\s+[a-z]/i.test(inner) || /\b[\w-]+\.(ca|com|org|gov|net)\b|\bgov\b/i.test(inner))
      worded.add(`[${inner}]`);
  }
  const out: string[] = [];
  if (beyond.size)
    out.push(
      `${[...beyond]
        .sort((a, b) => a - b)
        .map((k) => `[${k}]`)
        .join(
          ", ",
        )} ${beyond.size === 1 ? "is" : "are"} not on the Sources list (it has ${listed}). Cite the number shown as "cite as [n]" in list_notes — not the note number.`,
    );
  if (worded.size)
    out.push(
      `Citations must be the source's number alone, like [3]: ${[...worded].slice(0, 6).join(", ")}.`,
    );
  return out;
}

/** Digits as a page prints them, with the thousands separators (comma,
 *  space, no-break and thin space) taken out: "288,150" and "288 150" are
 *  both "288150". */
function digitsOf(text: string): string {
  return text.replace(/(?<=\d)[,\u00a0\u202f ](?=\d{3}(?!\d))/g, "");
}

/** The figures in a report that appear in no page read: a number of three or
 *  more digits, or with a decimal point, looked for in every kept page with
 *  separators ignored. Years, citation numbers and section numbers are not
 *  figures. A figure not found may be the model's own arithmetic (which the
 *  sentence should then say) or a number it did not read anywhere; either
 *  way the writer is told, with the sentence it is in. Advisory: a page can
 *  say "$1,900 million" where the report says "$1.9 billion". */
export function figureProblems(
  body: string,
  pages: ResearchSource[],
): Array<{ figure: string; sentence: string }> {
  const end = body.indexOf("\n## Sources");
  const text = (end < 0 ? body : body.slice(0, end))
    .replace(/\[[\d,\s–-]+\]/g, " ")
    .replace(/^#{2,3} \d+\. /gm, "");
  if (!pages.length) return [];
  const haystack = pages.map((p) => digitsOf(p.text)).join("\n");
  const seen = new Set<string>();
  const out: Array<{ figure: string; sentence: string }> = [];
  const sentences = text.split(/(?<=[.!?;])\s+|\n+/);
  for (const sentence of sentences) {
    for (const m of sentence.matchAll(
      /(?<![\w.])\d{1,3}(?:[,\u00a0\u202f ]\d{3})+(?:\.\d+)?(?![\d])|(?<![\w.,])\d+\.\d+(?![\d])|(?<![\w.,])\d{3,}(?![\d,])/g,
    )) {
      const raw = m[0];
      const figure = digitsOf(raw);
      if (/^(19|20)\d{2}$/.test(figure)) continue;
      if (seen.has(figure)) continue;
      seen.add(figure);
      const escaped = figure.replace(/\./g, "\\.");
      if (new RegExp(`(?<![\\d.])${escaped}(?![\\d])`).test(haystack)) continue;
      out.push({ figure: raw, sentence: sentence.trim().slice(0, 160) });
    }
  }
  return out;
}

/** The figure check as the writer reads it. */
export function describeFigures(f: Array<{ figure: string; sentence: string }>): string {
  if (!f.length) return "";
  return `\nFIGURES NOT FOUND in any page you read (${f.length}). Check each: cite the page it comes from, say in the sentence that it is your own calculation and from what, or remove it:\n${f
    .slice(0, 12)
    .map((x) => `- ${x.figure} — "${x.sentence}"`)
    .join("\n")}${f.length > 12 ? `\n…and ${f.length - 12} more.` : ""}`;
}

/** Why a report cannot go to Admin yet; empty when it can. */
export function reportProblems(
  d: { meta: { title?: string; topic?: string }; body: string },
  check: CheckResult,
  topics: string[],
): string[] {
  const p: string[] = [];
  if (!d.meta.title?.trim()) p.push("It has no title.");
  if (d.body.trim().length < 400) p.push("It is not written yet.");
  const todo = [...d.body.matchAll(/^#{2,3} ([^\n]+)\n+_\(to write\)_/gm)].map((m) => m[1]);
  if (todo.length) p.push(`Parts still to write: ${todo.join("; ")}.`);
  if (!d.meta.topic || !topics.includes(d.meta.topic))
    p.push("Its topic is not one of the record's topics.");
  if (!/^##\s+Sources\b[\s\S]*https?:\/\//m.test(d.body))
    p.push("It has no Sources list with web addresses.");
  if (check.failed.length)
    p.push(
      `${check.failed.length} ${check.failed.length === 1 ? "quotation is" : "quotations are"} not found in the pages read.`,
    );
  p.push(...citationProblems(d.body));
  return p;
}

/** The first message of an article started from a saved report. */
export function reportBrief(title: string, slug: string): string {
  return [
    `Write an article from my research report "${title}" (id: ${slug}), saved in Admin.`,
    "",
    "Read the whole report first with read_document; it is the main source. Then find what else in the record bears on it, and write the article. The report has to be published before the article can be.",
  ].join("\n");
}

/** The report as the file Admin receives: a title line, then the body. */
export function reportFile(d: { meta: { title?: string }; body: string }): string {
  return `# ${d.meta.title ?? "Untitled research"}\n\n${d.body.trim()}\n`;
}

/** Test a thesis: the same research, aimed at a claim rather than a topic.
 *  Appended to the research instructions for a draft with meta.mode
 *  "thesis"; frozen with the frame like the rest. */
export const THESIS_HOW = `

THIS CONVERSATION TESTS A THESIS
Chris gives you a claim. Your job is not to survey a topic but to find out whether the claim is true, how sure anyone can be, and what would settle it. This overrides steps 1 and 3 and the report's shape above; everything else stands.
1. Sharpen the thesis into one testable sentence: its terms, the place and period it is about, and what would count as evidence for and against. If it can be read two ways that change the answer, say which reading you test and why. Do not ask Chris to restate it unless it is unintelligible.
2. Lay the report out with write_outline in exactly these Details sections, worded for the thesis:
   1. The thesis, stated precisely — what it claims, what it does not, and how it could be shown wrong
   2. The strongest case for — the best evidence that it is true
   3. The strongest case against — the best evidence that it is false, and the strongest alternative explanations
   4. The crux — the fact, measure or study the disagreement turns on, and what it shows so far
   5. What would change the conclusion — the evidence that would overturn it, and whether anyone has looked
3. Build each case in good faith, as its best advocate would: the strongest version of each side from the best sources, never a straw man. The case against is built as carefully as the case for.
4. Weigh, do not count. Several sources repeating one origin count once; a primary measurement outweighs commentary on it; a study's design matters more than its headline.
5. Write the TL;DR last, and open it with a verdict on its own line: **Verdict: Supported**, **Partly supported**, **Not supported** or **Unsettled** — then how confident you are and why in one or two sentences, then the crux in one sentence. Key Findings: the decisive findings on each side, each cited.
6. Title: "Testing: " and the thesis in a few words.`;

/** For the Workers AI engines, whose web_search is the free source finder
 *  (finder.ts): what it covers, and how to reach the rest. Appended to the
 *  research instructions in their frames. */
export const FREE_SEARCH_HOW = `

YOUR SEARCH, AND THE REST OF THE WEB
web_search asks free collections, not the whole web: the world's news from the last three months, research papers and reports (Crossref, Semantic Scholar, open-access journals), and — when the question calls for them — health research, Government of Canada data, World Bank reports, arXiv preprints, the US Federal Register, and books and older texts. Each result says which. A page that has gone or moved is read from the Internet Archive's copy, and cited there. Reach everything else as a librarian would:
- When you know the authoritative source — the agency, statistics office, regulator, the law itself, the study, the organisation's own report — fetch its page directly with web_fetch. You do not need a search result to read a page.
- A page you read lists its links: follow them to the reports, data tables and PDFs behind it. A site's /sitemap.xml lists its pages.
- Wikipedia is a map, not a source: fetch the references it cites and cite those, never Wikipedia itself.
- Search in short keywords — three to six words, no quotation marks or operators. Long, quoted queries find little here.
- Read early: after a search or two, fetch the best results and note what you will use. A list of results is not evidence.
- If a search finds little, change the words, search for the publisher or the document's name, or go to the source directly.
- Search engines' own result pages (Google, Bing, DuckDuckGo and the like) cannot be read: their terms forbid automated searching.
- Searching and reading cost nothing here, so your allowance is 100 searches and 100 page reads a message, not 80.`;

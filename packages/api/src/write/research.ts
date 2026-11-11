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
3. Break the question into 3 to 6 concrete sub-questions that, answered together, cover it, and lay the report out with write_outline: one Details section per sub-question, each with a target length the evidence you expect can fill — about 100 words for each passage you expect to note, not more. Revise the outline as you learn (call it again; written sections are kept).
4. For each, search the web and read the most authoritative sources IN FULL with web_fetch — primary sources, official documents, datasets and peer-reviewed work over blogs, aggregators and encyclopedias. Do not rely on search snippets. When a secondary source cites a primary one, fetch the primary one.
   As you read, note every passage you will use with note_evidence: the exact words, what they show, and the section they are for. A note is checked against the page when you make it and gives the source its number to cite. Pages may leave your view later to keep the conversation short; your notes stay (list_notes shows them).
5. Be skeptical. Where sources disagree, say so, say which is more credible and why. Separate findings (what is true in the world, with a source) from your own inference, and label the inference.
6. Before you finish, check every citation: replace a blog, aggregator or encyclopedia with the primary source behind it, or say no stronger source exists.

HOW TO SEARCH AND READ WELL
- Start wide, then narrow: short queries (a few words) first, more specific ones once you see what exists. Never run the same query twice.
- Work in parallel: when several searches or several page reads do not depend on each other, ask for them together in one message, not one at a time.
- Never read the same page twice; everything you read is kept.
- Stop when new sources stop adding anything new. More reading past that point makes a report worse, not better: it buries the strong sources under weak ones.

DEPTH, AND DENSITY
The report is a document of record, not a summary. Be comprehensive: answer every sub-question in full, with the evidence itself — the figures, who measured them and how, the dates, the conditions, the competing accounts and why one is stronger — not a sentence pointing at it. Depth is evidence, not words: a report is as long as what it found, and every paragraph adds a fact, a source or an argument the reader has not yet had. The record's research documents run a median of about 4,500 words; a thorough one on a well-studied question runs longer because it has more sources, not because it says things again.
- State each fact once, in the section where it belongs. When a later section needs it, refer back in a few words ("the 50% exposure figure in section 1") instead of restating it with its citation. Live, one report gave the same five facts five to seven times each and was half again as long as its evidence.
- Breadth before length: a substantial question usually needs fifteen or more distinct sources, from several institutions and kinds (official statistics, peer-reviewed studies, government and independent evaluations, the strongest dissent), read in full. Three sources from one agency count as one voice.
- Concrete before abstract: a named case, a measured result, a dated event beats a general statement about the literature.
- Never pad: no repetition, no restating the TL;DR in the Details, no filler. If the evidence is genuinely thin, say so plainly in Open questions rather than stretching.

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
- The record's voice: third person, about the evidence. Never "I" or "we", never "as Chris asked" or any mention of who asked — the report is read by people who were not in this conversation. Your own calculation is "a calculation from [5] and [7]", not "my arithmetic".
- Every sentence in the Details that states a fact — a figure, a date, a rule, an event, what a study found — cites its source, even when the previous sentence cited the same one. Your own inference is labelled as inference.

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

/** What a reader checks first, checked in code: every Key Finding cites a
 *  source, and every figure the TL;DR or Key Findings give is one the
 *  Details give too (a summary should summarise, not add). Advisory, like
 *  the figure check: a summary may round, or add two numbers. */
export function writingProblems(body: string): {
  uncitedFindings: string[];
  summaryFigures: Array<{ figure: string; sentence: string }>;
  /** Sources that are a database's record or a search, not the document. */
  databaseSources: string[];
  repeatedFacts: Array<{ fact: string; parts: number }>;
  uncitedFacts: string[];
  voice: string[];
} {
  const at = (h: string) => body.indexOf(`\n## ${h}`);
  const details = at("Details");
  // A search result or an index's raw record (api.openalex.org,
  // api.crossref.org, a ?q= page) stands in for the document it describes:
  // live, both reports of 2026-11-11 cited one. Cite the paper itself.
  const listed = at("Sources") < 0 ? "" : body.slice(at("Sources"));
  const databaseSources = [...listed.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)]
    .map((m) => m[1] ?? "")
    .filter((u) =>
      /^https?:\/\/(api\.|[^/]+\/api\/)|[?&](q|query|query\.[a-z]+|search|s)=/i.test(u),
    );
  if (details < 0)
    return {
      uncitedFindings: [],
      summaryFigures: [],
      databaseSources,
      repeatedFacts: [],
      uncitedFacts: [],
      voice: [],
    };
  const findingsAt = at("Key Findings");
  const findings =
    findingsAt < 0
      ? ""
      : body.slice(findingsAt + "\n## Key Findings".length, details).replace(/_\(to write\)_/g, "");
  const uncitedFindings = findings
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^([-*]|\d+[.)])\s+\S/.test(l) && !/\[\d+(?:[,\s–-]*\d+)*\]/.test(l))
    .map((l) => l.replace(/^([-*]|\d+[.)])\s+/, "").slice(0, 160));
  const sources = at("Sources");
  const rest = body.slice(details, sources < 0 ? body.length : sources);
  const haystack = digitsOf(rest.replace(/\[[\d,\s–-]+\]/g, " "));
  const summary = body.slice(0, details).replace(/\[[\d,\s–-]+\]/g, " ");
  const seen = new Set<string>();
  const summaryFigures: Array<{ figure: string; sentence: string }> = [];
  for (const sentence of summary.split(/(?<=[.!?;])\s+|\n+/)) {
    for (const m of sentence.matchAll(
      /(?<![\w.])\d{1,3}(?:[,   ]\d{3})+(?:\.\d+)?(?![\d])|(?<![\w.,])\d+\.\d+(?![\d])|(?<![\w.,])\d{2,}(?![\d,])/g,
    )) {
      const figure = digitsOf(m[0]);
      if (/^(19|20)\d{2}$/.test(figure) || seen.has(figure)) continue;
      seen.add(figure);
      const escaped = figure.replace(/\./g, "\\.");
      if (new RegExp(`(?<![\\d.])${escaped}(?![\\d])`).test(haystack)) continue;
      summaryFigures.push({ figure: m[0], sentence: sentence.trim().slice(0, 160) });
    }
  }
  return {
    uncitedFindings,
    summaryFigures,
    databaseSources,
    ...density(body.slice(details, sources < 0 ? body.length : sources)),
  };
}

/** A figure a reader would notice: a percentage, a decimal, a dollar amount,
 *  a number with separators or of three or more digits (years aside). */
const SALIENT =
  /[−-]?\$?\d{1,3}(?:,\d{3})+(?:\.\d+)?%?|[−-]?\$?\d+\.\d+%?|\$\d+|\d+(?:\.\d+)?\s?(?:%|per cent|percentage points?)|(?<![\w.,])\d{3,}(?![\d,])/g;

/** How dense the Details are, in code (from reading the 2026-11-11 thesis
 *  report: five facts stated five to seven times each, factual sentences
 *  with no citation, "I" and "as Chris stated it" in a public document).
 *  - repeatedFacts: a figure or a quotation of five words or more that
 *    appears in three or more Details sections or closing parts;
 *  - uncitedFacts: a Details sentence with a salient figure and no [n];
 *  - voice: sentences in the first person or naming Chris. */
function density(rest: string): {
  repeatedFacts: Array<{ fact: string; parts: number }>;
  uncitedFacts: string[];
  voice: string[];
} {
  const parts = rest
    .split(/\n(?=### \d+\. |## )/)
    .map((p) => p.replace(/^#{2,4} [^\n]*\n/, ""))
    .filter((p) => p.trim() && !p.includes("_(to write)_"));
  const seenIn = new Map<string, Set<number>>();
  parts.forEach((p, i) => {
    const facts = [
      ...[...p.matchAll(SALIENT)]
        .map((m) => m[0].replace(/\s+/g, " ").trim())
        .filter((f) => !/^(19|20)\d{2}$/.test(f)),
      ...[...p.matchAll(/["“]([^"”]{20,400})["”]/g)]
        .map((m) => (m[1] ?? "").trim())
        .filter((q) => q.split(/\s+/).length >= 5)
        .map((q) => `“${q.slice(0, 80)}${q.length > 80 ? "…" : ""}”`),
    ];
    for (const f of facts) seenIn.set(f, (seenIn.get(f) ?? new Set()).add(i));
  });
  const repeatedFacts = [...seenIn.entries()]
    .filter(([, s]) => s.size >= 3)
    .map(([fact, s]) => ({ fact, parts: s.size }))
    .sort((a, b) => b.parts - a.parts)
    .slice(0, 10);
  const sentences = splitSentences(parts.join("\n")).filter(
    (s) => s.length > 30 && !/^#{2,4} /.test(s),
  );
  const hasFigure = (s: string) =>
    [...s.matchAll(SALIENT)].some((m) => !/^(19|20)\d{2}$/.test(m[0].trim()));
  const uncitedFacts = sentences
    .filter(
      (s) =>
        hasFigure(s) &&
        !/\[\d+(?:[,\s–-]*\d+)*\]/.test(s) &&
        !/\b(calculation|implies|section \d)/i.test(s),
    )
    .map((s) => s.slice(0, 160))
    .slice(0, 12);
  // "We" and "our" are left alone: in reported speech ("asking whether we
  // really want to say…") they are the source's, not the writer's.
  const unquoted = (s: string) => s.replace(/["“][^"”]*["”]/g, "");
  // "Part I", "World War I": a numeral, not the writer.
  const firstPerson =
    /(?<!\b(?:Part|Volume|Vol\.|Book|Chapter|War|Phase|Type|Article|Section|Title|Schedule|Stage)\s)\b(I|I'm|I've|I'd)\b|\bmy\b|\bChris\b/;
  const voice = sentences
    .filter((s) => firstPerson.test(unquoted(s)))
    .map((s) => s.slice(0, 160))
    .slice(0, 8);
  return { repeatedFacts, uncitedFacts, voice };
}

/** Sentences, split only outside quotation marks: a quoted passage of two
 *  sentences is one, with the citation that follows it. */
export function splitSentences(text: string): string[] {
  // The same text with every quoted span blanked, so its full stops do not
  // split it; the cuts found there are made in the original.
  const masked = text.replace(
    /["“][^"”\n]*["”]/g,
    (q) => q[0] + "x".repeat(q.length - 2) + q.slice(-1),
  );
  const out: string[] = [];
  let from = 0;
  for (const m of masked.matchAll(/(?<=[.!?][”"]?)\s+(?=[A-Z“"(*])|\n+/g)) {
    out.push(text.slice(from, m.index));
    from = (m.index ?? 0) + m[0].length;
  }
  out.push(text.slice(from));
  return out.map((s) => s.trim()).filter(Boolean);
}

/** The writing check as the writer reads it; empty when there is nothing. */
export function describeWriting(w: ReturnType<typeof writingProblems>): string {
  const out: string[] = [];
  if (w.uncitedFindings.length)
    out.push(
      `\nKEY FINDINGS WITH NO CITATION (${w.uncitedFindings.length}). Each finding stands on a source; add its [n], or cut it:\n${w.uncitedFindings
        .slice(0, 8)
        .map((f) => `- "${f}"`)
        .join("\n")}`,
    );
  if (w.summaryFigures.length)
    out.push(
      `\nFIGURES IN THE SUMMARY THAT THE DETAILS NEVER GIVE (${w.summaryFigures.length}). A summary repeats what the report shows; give the figure in its section with its source, or take it out of the summary:\n${w.summaryFigures
        .slice(0, 8)
        .map((f) => `- ${f.figure} — "${f.sentence}"`)
        .join("\n")}`,
    );
  if (w.databaseSources.length)
    out.push(
      `\nSOURCES THAT ARE A DATABASE'S RECORD OR A SEARCH, NOT THE DOCUMENT (${w.databaseSources.length}). Read the paper or report itself (its DOI or publisher page) and note from it, so the source is the work, not an index of it:\n${w.databaseSources
        .slice(0, 8)
        .map((u) => `- ${u}`)
        .join("\n")}`,
    );
  if (w.repeatedFacts.length)
    out.push(
      `\nSAID AGAIN AND AGAIN (${w.repeatedFacts.length}). Each of these appears in three or more parts of the report. State it once, where it belongs, and refer back to it in a few words elsewhere:\n${w.repeatedFacts
        .map((f) => `- ${f.fact} — in ${f.parts} parts`)
        .join("\n")}`,
    );
  if (w.uncitedFacts.length)
    out.push(
      `\nFACTS WITH NO CITATION IN THE DETAILS (${w.uncitedFacts.length}). Each sentence that gives a figure cites its source; or say it is your own calculation and from what:\n${w.uncitedFacts
        .slice(0, 8)
        .map((s) => `- "${s}"`)
        .join("\n")}`,
    );
  if (w.voice.length)
    out.push(
      `\nNOT THE RECORD'S VOICE (${w.voice.length}). The report is about the evidence, in the third person: no "I" or "we", and no mention of who asked:\n${w.voice
        .slice(0, 6)
        .map((s) => `- "${s}"`)
        .join("\n")}`,
    );
  return out.join("");
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
web_search asks free collections, not the whole web: research papers and reports (Crossref, Semantic Scholar, open-access journals), Wikipedia, and — when the question calls for them — health research, Government of Canada data, World Bank reports, arXiv preprints, the US Federal Register, and books and older texts. Each result says which. news_search asks the world's news of the last three months; it is slow (about twenty seconds), so use it for recent events, announcements and reactions. A page that has gone or moved is read from the Internet Archive's copy, and cited there. Reach everything else as a librarian would:
- When you know the authoritative source — the agency, statistics office, regulator, the law itself, the study, the organisation's own report — fetch its page directly with web_fetch. You do not need a search result to read a page.
- A page you read lists its links: follow them to the reports, data tables and PDFs behind it. A site's /sitemap.xml lists its pages.
- Wikipedia is a map, not a source: fetch the references it cites and cite those, never Wikipedia itself.
- Search in short keywords — three to six words, no quotation marks or operators. Long, quoted queries find little here.
- Read early: after a search or two, fetch the best results and note what you will use. A list of results is not evidence.
- If a search finds little, change the words, search for the publisher or the document's name, or go to the source directly.
- Search engines' own result pages (Google, Bing, DuckDuckGo and the like) cannot be read: their terms forbid automated searching.
- Searching and reading cost nothing here, so your allowance is 100 searches and 100 page reads a message, not 80.`;

/** Deepen: a second pass over a finished report (meta.mode "deepen"). The
 *  report, its notes and its pages are copied into the new conversation; its
 *  first message lists the loose ends found in code (deepenBrief). */
export const DEEPEN_HOW = `

THIS CONVERSATION DEEPENS A FINISHED REPORT
The report on the page was researched and written in an earlier pass; its notes (list_notes) and every page it read are here too. Do not redo it. Pull at its loose ends:
1. Read the report and the loose ends Chris's first message lists — the report's own open questions, sentences the reviewers flagged or the support check doubted, findings that rest on one source or on sources that echo one origin.
2. Choose the three to six that matter most to the question, and add any important angle the first pass missed.
3. Research each: search, read the primary sources in full, note what you use. Settle what can be settled; where the evidence still runs out, say so plainly.
4. Revise in place: edit_draft for passages (several at once with also), write_section for a section that needs rewriting. Keep what is sound — this is a revision, not a new report. Update the TL;DR and Key Findings if what you found changes them; if the report tests a thesis, keep its verdict line and change the verdict only if the evidence does.
5. End in the chat with what this pass changed: what was added, what was corrected, what was overturned, what is still open.`;

/** The first message of a deepening pass: the loose ends, found in code. */
export function deepenBrief(d: {
  meta: {
    title?: string;
    review?: Array<{ section: number; kind: string; sentence: string; why: string }>;
    sources?: {
      cited: number;
      independent: number;
      echoes: Array<{ sources: number[]; why: string }>;
    };
  };
  body: string;
}): string {
  const lines: string[] = [
    `Deepen this report: "${d.meta.title ?? "the report"}". It is on the page with its notes and the pages it read. Pull at its loose ends — the most important first — and revise it in place.`,
  ];
  const open = /\n## Open questions\n([\s\S]*?)(?=\n## |$)/.exec(d.body)?.[1]?.trim();
  if (open) lines.push("", "Its own open questions:", open.slice(0, 2500));
  const flags = d.meta.review ?? [];
  if (flags.length)
    lines.push(
      "",
      "What the reviewers and the support check flagged:",
      ...flags
        .slice(0, 15)
        .map((f) => `- §${f.section} ${f.kind}: "${f.sentence.slice(0, 200)}" — ${f.why}`),
    );
  const s = d.meta.sources;
  if (s?.echoes.length)
    lines.push(
      "",
      `Its sources: ${s.cited} cited, about ${s.independent} independent. These count as one each: ${s.echoes
        .map((g) => g.sources.map((k) => `[${k}]`).join(" "))
        .join("; ")}. Findings that rest only on one of these groups need an independent source.`,
    );
  return lines.join("\n");
}

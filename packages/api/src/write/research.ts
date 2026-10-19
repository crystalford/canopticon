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
import { all, run } from "../lib/d1";
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
3. Break the question into 3 to 6 concrete sub-questions that, answered together, cover it.
4. For each, search the web and read the most authoritative sources IN FULL with web_fetch — primary sources, official documents, datasets and peer-reviewed work over blogs, aggregators and encyclopedias. Do not rely on search snippets. When a secondary source cites a primary one, fetch the primary one.
5. Be skeptical. Where sources disagree, say so, say which is more credible and why. Separate findings (what is true in the world, with a source) from your own inference, and label the inference.
6. Before you finish, check every citation: replace a blog, aggregator or encyclopedia with the primary source behind it, or say no stronger source exists.

DEPTH
The report is a document of record, not a summary. Be comprehensive: answer every sub-question in full, with the evidence itself — the figures, who measured them and how, the dates, the conditions, the competing accounts and why one is stronger — not a sentence pointing at it. The record's research documents run a median of about 4,500 words, and the thorough ones 7,000 or more; write at that depth whenever the evidence supports it, and longer when the question needs it. There is no length cap. Never pad: no repetition, no restating the TL;DR in the Details, no filler. If the evidence is genuinely thin, say so plainly in Open questions rather than stretching. Read widely before you write — usually ten or more sources read in full for a substantial question.

YOUR WEB ALLOWANCE
In one message you may run up to 80 web searches and read up to 80 pages. A substantial question usually takes 20 to 40 searches and 15 to 30 pages read in full; use what the question needs, not the whole allowance. Spend reads on primary sources, not on pages that only repeat them. If a search or read comes back "max_uses_exceeded", the allowance for this message is spent: write or revise the report with what you have, say under Open questions exactly what is still uncovered, and tell Chris to reply "keep going" — his next message brings a fresh allowance, and you continue where you stopped and revise the report.

THE REPORT (write it with write_report, revise one passage with edit_draft)
- Markdown, in this shape: no "# Title" line (the title is its own field).
  ## TL;DR — three to five sentences that answer the question.
  ## Key Findings — the findings as bullets, each with its source as [n].
  ## Details — "### 1. …" sections, one per sub-question, the evidence in full: several paragraphs each, with the numbers, methods, dates and disagreements the sources give.
  ## Beyond this question — what the findings mean for anyone working on this (only if there is something to say).
  ## Open questions — what nobody has measured, built or settled, stated plainly, and where coverage was thin.
  ## Sources — a numbered list: "1. [Title of the page](https://…) — publisher, date if known".
- Cite inline as [n], matching the Sources list. Every non-obvious claim has one.
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
  { type: "web_search_20260209", name: "web_search", max_uses: SEARCH_LIMIT },
  {
    type: "web_fetch_20260209",
    name: "web_fetch",
    max_uses: READ_LIMIT,
    allowed_callers: ["direct"],
    max_content_tokens: 60000,
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
  add(draftId: string, pages: ResearchSource[]): Promise<void>;
  texts(draftId: string): Promise<ResearchSource[]>;
}

export function d1Sources(env: Env, userId: string): SourceStore {
  return {
    async add(draftId, pages) {
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
        ).catch(() => null);
      }
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
    },
    async texts(draftId) {
      return rows.get(draftId) ?? [];
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
  // A quotation may wrap onto a second line, never across a blank line.
  for (const m of body.matchAll(/“((?:[^”\n]|\n(?!\n)){40,})”|"((?:[^"\n]|\n(?!\n)){40,})"/g))
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

export function describeReportCheck(r: CheckResult, pages: number): string {
  const read = `${pages} ${pages === 1 ? "page" : "pages"} read so far.`;
  if (!r.total) return `No quotations. ${read}`;
  if (!r.failed.length)
    return `${r.total} quotations, all found word for word in the pages you read. ${read}`;
  return `${r.total} quotations, ${r.failed.length} NOT FOUND in any page you fetched. Copy each exactly from a page you fetched with web_fetch, or remove the quotation marks and paraphrase:\n${r.failed
    .map((f) => `- "${f.text.slice(0, 160)}"`)
    .join("\n")}\n${read}`;
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
  if (!d.meta.topic || !topics.includes(d.meta.topic))
    p.push("Its topic is not one of the record's topics.");
  if (!/^##\s+Sources\b[\s\S]*https?:\/\//m.test(d.body))
    p.push("It has no Sources list with web addresses.");
  if (check.failed.length)
    p.push(
      `${check.failed.length} ${check.failed.length === 1 ? "quotation is" : "quotations are"} not found in the pages read.`,
    );
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

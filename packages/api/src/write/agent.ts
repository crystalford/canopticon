// One turn of the workspace conversation: Chris says something, Claude reads
// the record and writes or revises the article, and the page beside the chat
// shows the result. A hand-written tool loop (not the SDK's runner) because
// every step is saved as it happens — an interrupted turn keeps what it did —
// and streamed to the page as it is written.
//
// Rules this keeps (CLAUDE.md): nothing runs unattended — a turn runs only
// while someone is pressing Send; AI output is an input artifact — the draft
// is a row, and nothing renders a model call at read time; verification is
// mechanical — every write is checked word for word in code (check.ts) and
// the result is handed back to Claude to fix.

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Env } from "../env";
import { essayContract, problems, researchDoc, terms } from "../site/content/store";
import { type CheckResult, checkQuotes, describeCheck, draftQuotes } from "./check";
import type { Draft, DraftKind, DraftMeta, DraftStore, Message, Usage } from "./drafts";
import { NO_USAGE } from "./drafts";
import {
  CLAUDE,
  type EngineId,
  FETCH_TOOL,
  OPUS_PRICE,
  PAGE_CHARS,
  SEARCH_TOOL,
  advisorTool,
  engine as engineOf,
  isWorkersAi,
  readPage,
  webSearch,
  workersStep,
} from "./engines";
import { type Entry, type EntryKind, type EntryStore, proposalProblems } from "./entries";
import {
  NOTES_TOOLS,
  type NoteStore,
  type OutlineSection,
  describeNotes,
  placeNote,
  replacePart,
  skeleton,
  sourceNumbers,
  unwritten,
  withSources,
} from "./notes";
import { articleTopics } from "./publish";
import {
  type Derivation,
  KIND_LABEL,
  NOTE_TOOL,
  PITCH_TOOL,
  READ_HOW,
  type ReadStore,
  runReadTool,
} from "./read";
import {
  READ_LIMIT,
  RESEARCH_HOW,
  type ResearchSource,
  SEARCH_LIMIT,
  type SourceStore,
  WEB_TOOLS,
  checkReport,
  citationProblems,
  describeReportCheck,
  fetchedPages,
} from "./research";
import {
  listSources,
  ownWriting,
  ownWritingText,
  searchOwnWriting,
  searchSources,
  sourceText,
  sourceTexts,
} from "./sources";
import { storedKey } from "./stored-key";

export const WRITE_MODEL = "claude-opus-5-5";

/** List price per million tokens (Claude Opus 5.5); a cache write costs
 *  1.25× input. The page shows the tally as an estimate. */
// Cache writes at the one-hour rate (2× input): see the cache_control below.
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 8 };

/** Model calls in one turn, at most. A turn that needs more stops and says so. */
const MAX_STEPS = 24;
/** Research searches and reads many pages before it writes; a thorough one
 *  must not stop halfway through its sources. */
const RESEARCH_STEPS = 60;
const WORKERS_RESEARCH_STEPS = 100;
/** A read notes a card per call; even batched, a long document needs more. */
const READ_STEPS = 80;

export type WriteEvent =
  | { type: "text"; text: string }
  | { type: "activity"; text: string }
  /** A progress note Claude wrote between tool calls. */
  | { type: "update"; text: string }
  | { type: "draft"; check: CheckResult }
  | { type: "proposal"; entry: Entry; html?: string }
  | { type: "card"; card: Derivation; label: string }
  | { type: "error"; message: string }
  | { type: "done"; usage: Usage };

export type Emit = (e: WriteEvent) => void;

type StreamParams = Parameters<Anthropic["beta"]["messages"]["stream"]>[0];

/** What the loop needs from the SDK's stream; a fake implements it in tests. */
export interface StreamLike {
  on(event: "text", cb: (delta: string) => void): unknown;
  on(event: "streamEvent", cb: (event: Anthropic.Beta.BetaRawMessageStreamEvent) => void): unknown;
  finalMessage(): Promise<Anthropic.Beta.BetaMessage>;
}
export type StreamFn = (params: StreamParams) => StreamLike;

/** How the workspace reaches Claude: through Cloudflare's AI Gateway when it
 *  is configured (Unified Billing, no Anthropic key), else directly with an
 *  Anthropic key — the one pasted on /admin/claude (write/stored-key.ts),
 *  else the ANTHROPIC_API_KEY secret — else not at all. */
export function claudeRoute(env: Env): "gateway" | "anthropic" | null {
  if (env.AI_GATEWAY_ID && env.CLOUDFLARE_ACCOUNT_ID && env.CF_AIG_TOKEN) return "gateway";
  if (anthropicKey(env)) return "anthropic";
  return null;
}

/** The Anthropic key in use: the pasted one wins over the deploy's secret. */
export const anthropicKey = (env: Env): string | null =>
  storedKey() || env.ANTHROPIC_API_KEY || null;

/** The real thing: the Anthropic SDK, pointed at the route above. The
 *  gateway's Anthropic pass-through takes the Messages API unchanged —
 *  tools, streaming, caching — and authenticates with the gateway token;
 *  with Unified Billing the Anthropic key is ignored, so a placeholder
 *  stands in when there is none. */
export async function anthropicStream(env: Env): Promise<StreamFn | null> {
  const route = claudeRoute(env);
  if (!route) return null;
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client =
    route === "gateway"
      ? new Anthropic({
          // No Anthropic key goes to the gateway: with Unified Billing it
          // bills Cloudflare credits, and a key it was sent might be used.
          apiKey: null,
          baseURL: `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.AI_GATEWAY_ID}/anthropic`,
          defaultHeaders: {
            "cf-aig-authorization": `Bearer ${env.CF_AIG_TOKEN}`,
            "x-api-key": null,
          },
        })
      : new Anthropic({ apiKey: anthropicKey(env) });
  return (params) => client.beta.messages.stream(params) as unknown as StreamLike;
}

// ---- instructions -----------------------------------------------------------

/** The topics an article can publish under (publish.ts's own list). */
const topics = (): string[] => articleTopics();

const HOW = `You are writing for Canopticon, a public research record, with its author, Chris Telford. He talks to you in a workspace: the chat is on the left, and the page you write is on the right, rendered exactly as it will be published. Each time you write, he sees the page change.

THE RECORD
Canopticon holds: research documents (the sources you may quote, with uploads that may still be waiting in Admin); Chris's own published articles and papers (his writing — read them to know what is already written and to build on it, never quote them as a source); and concepts, open problems and key figures. You can read the record; you cannot change anything in it — not a title, topic, date or text. When something there looks wrong (a title that is really a heading, a document under the wrong topic), say what and why in one line, and Chris will have it fixed; do not tell him where to fix it.

HOW YOU WORK
- Read before you write. Find the research with search_documents and list_documents, then read every document you will rely on in full with read_document — several at once when you already know which ones you need. Quotations chosen by keyword search are the ones that matched the search, not the ones that carry the document.
- Write the whole article with write_draft. Revise with edit_draft, which replaces one exact passage, when only part of it changes — above all when Chris flags a passage.
- Every write returns the verbatim check. If any quotation failed, fix it (copy the passage exactly from read_document's text, or drop it) before you finish your turn.
- In the chat, be brief: say what you did and what you need from him. Do not paste the article into the chat; it is on the page.
- When Chris flags a passage it arrives in his message as a quoted block (lines starting with "> "). Revise that passage with edit_draft.
- You cannot publish. Chris does, with the Publish button in the bar above the page on the right; it works once nothing is listed under "Not ready to publish" there. When he asks you to publish, say exactly that, and fix whatever that list names that you can.
- This conversation holds one article; writing replaces it. For a different article, ask Chris to start one with "New article" in Drafts. Never paste an article into the chat — if write_draft fails, fix what it says and write again.
- If the record cannot support the article he asks for, say so plainly instead of writing a weak one (contract §3, rule 10).

THE FORMAT (Markdown; the page is built from it)
- A quotation is <q doc="DOCUMENT_ID" section="SECTION">exact text</q>. The text is copied character for character from the document as read_document returned it — same quote marks, same spacing, same punctuation; only Markdown emphasis may differ. SECTION is the short heading of the part of the document it comes from. Quote only documents you have read with read_document. A quotation must read as part of your sentence.
- Everything outside <q> is Chris's own voice, written by you with him; the page underlines it as such. It carries no number the sources do not give (contract §3, rule 3).
- Link to a document with [link text](doc:DOCUMENT_ID).
- Sections are "## Heading" lines that say something. No "# Title" line: the title is front matter.
- An objection, answered where it bites:
  > **Objection: the objection in one line**
  >
  > The answer.
- A pull quote (verified like any quotation):
  <figure data-kind="pull" doc="DOCUMENT_ID" section="SECTION">
  “exact text”
  </figure>
- A bar chart of figures the source gives (label | value as written | bar width 0–100 | colour):
  <figure data-kind="chart" doc="DOCUMENT_ID" section="SECTION">
  caption: What the bars show
  - Label | 53% | 53 | #2f7d52
  - Label | 47% | 47 | #cfc9bb
  note: who or what was measured
  </figure>
- Two named things side by side:
  <figure data-kind="names">
  - Label | Name | definition (may be a <q>) | one plain line
  </figure>
- Tables: Markdown tables, every cell copied as the source writes it.

FRONT MATTER (write_draft's fields)
- title: names the subject plainly (contract §6b). dek: one or two sentences that carry the idea.
- topic: exactly one of: {{TOPICS}}.
- thesis: the idea in one sentence.
- based_on: the ids of the documents the article draws on.
- why ("Why I asked"): Chris's own reason, in his words. Never write it yourself. Ask him for it, and leave it out until he gives it; then use his words exactly.

PROPOSING TO THE RECORD
Besides articles, the record keeps concepts, open problems and key figures, each on its own page or list. When your reading turns one up, you may propose it with propose_entry; Chris adds it as written, rewrites it, or dismisses it. Propose sparingly: only what a reader would want to find on its own.
- concept: a name for a pattern, mechanism or failure that happens and has no established name (contract §1b). Never a name for something to build — that is a document's proposal, not a concept. title is the name; body is a one-paragraph definition in plain words; quote is the passage where the document describes the pattern or says no name exists.
- open_problem: something wanted that does not exist yet — a product, a dataset, a study — and why (contract §1c). title is the problem in one line (a question is fine); body states it; quote is the document's own words on why it is unsolved.
- figure: a number with a named source. quote is the sentence that carries it, word for word; body is the figure exactly as written in that sentence; title repeats the sentence.
Already in the record, so not to be proposed again — concepts: {{CONCEPTS}}. Open problems: {{PROBLEMS}}.

THE ESSAY CONTRACT
Below is the standard every article meets. Where it describes the old desk, the draft room, quarantine, grounding packs or JSON shapes, that is history: you work in this workspace and in Markdown. Its rules about the idea, evidence, honesty, numbers, titles, plain writing and the slop list all hold.

`;

/** What a conversation is held to from its first turn. */
interface Frame {
  system: string;
  tools: Anthropic.Beta.BetaToolUnion[];
  /** Which engine the conversation runs on; absent means Claude (every
   *  conversation before engines existed). Frozen with the rest. */
  engine?: EngineId;
}
const newFrame = (kind: DraftKind = "article", eng: EngineId = CLAUDE): Frame => {
  const workers = isWorkersAi(eng);
  const f: Frame =
    kind === "research"
      ? { system: researchSystemPrompt(), tools: researchTools(workers) }
      : kind === "read"
        ? { system: READ_HOW, tools: readTools() }
        : { system: systemPrompt(), tools: TOOLS };
  const advisor = advisorTool(eng);
  const g = advisor ? { ...f, tools: [...f.tools, advisor] } : f;
  return eng !== CLAUDE ? { ...g, engine: eng } : g;
};

/** A read reads one document (and may look across the record) and notes cards. */
export const readTools = (): Anthropic.Beta.BetaToolUnion[] => [
  byName("read_document"),
  byName("search_documents"),
  byName("list_documents"),
  NOTE_TOOL,
  PITCH_TOOL,
];

const byName = (n: string) =>
  TOOLS.find((t) => "name" in t && t.name === n) as Anthropic.Beta.BetaToolUnion;

/** A research draft reads the record and the web, and writes a report. On
 *  Claude the web is Anthropic's server tools; on Workers AI, our own. */
export const researchTools = (workers = false): Anthropic.Beta.BetaToolUnion[] => [
  byName("list_documents"),
  byName("search_documents"),
  byName("read_document"),
  ...(workers ? [SEARCH_TOOL, FETCH_TOOL] : WEB_TOOLS),
  // Outline first, note while reading, write section by section (notes.ts).
  ...NOTES_TOOLS,
  byName("edit_draft"),
];

/** Whether a conversation's frozen tools are the notes-and-sections kind. */
const notesMode = (tools: Anthropic.Beta.BetaToolUnion[]) =>
  tools.some((t) => "name" in t && t.name === "note_evidence");

export function researchSystemPrompt(): string {
  return `${RESEARCH_HOW}

TOPICS: the report's topic is exactly one of: ${topics().join("; ")}.`;
}

export function systemPrompt(): string {
  return (
    HOW.replace("{{TOPICS}}", topics().join("; "))
      .replace(
        "{{CONCEPTS}}",
        terms()
          .map((t) => t.title)
          .join("; ") || "none",
      )
      .replace(
        "{{PROBLEMS}}",
        problems()
          .map((t) => t.title)
          .join("; ") || "none",
      ) + essayContract()
  );
}

// ---- tools ------------------------------------------------------------------

const ListInput = z.object({ topic: z.string().optional() });
const SearchInput = z.object({ query: z.string().min(1) });
const ReadInput = z.object({ id: z.string().min(1) });
const WriteInput = z.object({
  title: z.string().min(1),
  dek: z.string(),
  topic: z.string(),
  thesis: z.string(),
  based_on: z.array(z.string()),
  why: z.string().optional(),
  body: z.string().min(1),
});
const Replacement = z.object({ find: z.string().min(1), replace: z.string() });
const EditInput = Replacement.extend({ also: z.array(Replacement).max(40).optional() });
const ReportInput = z.object({
  title: z.string().min(1),
  topic: z.string(),
  body: z.string().min(1),
});
const ProposeInput = z.object({
  kind: z.enum(["concept", "open_problem", "figure"]),
  title: z.string().min(1),
  body: z.string().min(1),
  doc: z.string().min(1),
  section: z.string(),
  quote: z.string().min(1),
  topic: z.string(),
});

export const TOOLS: Anthropic.Beta.BetaToolUnion[] = [
  {
    name: "list_documents",
    description:
      "List the record: first the research documents you may read and quote (id, title, topic, kind, date, length, whether it is an upload waiting in Admin), then Chris's own published articles and papers, which you may read but never quote as a source. Optionally narrow to a topic.",
    input_schema: {
      type: "object",
      properties: { topic: { type: "string", description: "Part of a topic name, e.g. Housing" } },
    },
  },
  {
    name: "search_documents",
    description:
      "Search the full text of every research document you may quote, and of Chris's own articles and papers (listed separately; read-only, never a source). Every word must match; put a phrase in double quotes to match it exactly. Returns the best documents with short passages around the match.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "read_document",
    description:
      "Read one research document, or one of Chris's articles or papers, in full. Quote only from research documents, copied exactly from the text this returns.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string", description: "The document id" } },
      required: ["id"],
    },
  },
  {
    name: "write_draft",
    description:
      "Write the whole article: its front matter and its Markdown body. Replaces the current draft. Returns the verbatim check of every quotation.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        dek: { type: "string" },
        topic: { type: "string" },
        thesis: { type: "string" },
        based_on: { type: "array", items: { type: "string" } },
        why: {
          type: "string",
          description: "Only Chris's own words, when he has given them. Omit otherwise.",
        },
        body: { type: "string", description: "The article body in the format above" },
      },
      required: ["title", "dek", "topic", "thesis", "based_on", "body"],
    },
  },
  {
    name: "edit_draft",
    description:
      "Replace one exact passage of the draft body with new text. `find` must occur exactly once. To change several passages — several quotations to fix, say — give the rest in `also`, all in this one call: they are applied in order, all or none. Returns the verbatim check.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        find: { type: "string", description: "The exact current text, long enough to be unique" },
        replace: { type: "string" },
        also: {
          type: "array",
          description: "Further replacements, applied in order after the first",
          items: {
            type: "object",
            properties: { find: { type: "string" }, replace: { type: "string" } },
            required: ["find", "replace"],
          },
        },
      },
      required: ["find", "replace"],
    },
  },
  {
    name: "propose_entry",
    description:
      "Propose a concept, an open problem or a key figure for the record, grounded in a passage copied word for word from a document you have read. Chris adds it, rewrites it or dismisses it; nothing is public until he adds it.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["concept", "open_problem", "figure"] },
        title: { type: "string" },
        body: { type: "string" },
        doc: { type: "string", description: "The document id" },
        section: { type: "string", description: "Its section heading" },
        quote: { type: "string", description: "Word for word from the document" },
        topic: { type: "string" },
      },
      required: ["kind", "title", "body", "doc", "section", "quote", "topic"],
    },
  },
];

/** A card noted in a read, as the chat shows it. */
export function cardLabel(name: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  if (name === "pitch") return `Proposed an article: ${String(i.thesis ?? "").slice(0, 120)}`;
  const kind = String(i.kind ?? "");
  const label = KIND_LABEL[kind as keyof typeof KIND_LABEL] ?? kind;
  return `Noted · ${label}${i.figure ? `: ${String(i.figure)}` : ""}`;
}

/** What the page says Claude is doing, from a tool call. */
export function activityLabel(name: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  switch (name) {
    case "list_documents":
      return i.topic ? `Listed documents in ${String(i.topic)}` : "Looked through the record";
    case "search_documents":
      return `Searched: ${String(i.query ?? "")}`;
    case "read_document": {
      const id = String(i.id ?? "");
      return `Read: ${researchDoc(id)?.title.replace(/^#\s*/, "") ?? ownWritingText(id)?.title ?? id}`;
    }
    case "write_draft":
      return "Wrote the draft";
    case "edit_draft":
      return "Revised a passage";
    case "web_search":
      return `Searched the web: ${String(i.query ?? "")}`;
    case "web_fetch":
      return `Read: ${String(i.url ?? "")}`;
    case "write_report":
      return "Wrote the report";
    case "write_outline":
      return "Laid out the report";
    case "write_section": {
      const p = String(i.part ?? "");
      return p === "summary"
        ? "Wrote the summary"
        : p === "closing"
          ? "Wrote the closing"
          : `Wrote section ${p}`;
    }
    case "note_evidence":
      return `Noted: ${String(i.claim ?? "").slice(0, 90)}`;
    case "list_notes":
      return "Looked over the notes";
    case "propose_entry":
      return `Proposed ${i.kind === "open_problem" ? "an open problem" : i.kind === "figure" ? "a key figure" : "a concept"}: ${String(i.kind === "figure" ? i.body : i.title)}`;
    default:
      return name;
  }
}

interface ToolContext {
  env: Env;
  store: DraftStore;
  entries?: EntryStore | undefined;
  sources?: SourceStore | undefined;
  /** Read it: the read's store, which read, and the document's text. */
  reads?: ReadStore | undefined;
  readId?: string | undefined;
  readDoc?: { id: string; text: string } | undefined;
  kind: DraftKind;
  draftId: string;
  emit: Emit;
  toolUseId?: string;
  /** The web allowance spent this message (Workers AI's own web tools). */
  web?: { searches: number; reads: number; capped: Set<string> };
  /** The research notes bank (notes.ts). */
  notes?: NoteStore | undefined;
  /** The draft's kept pages, loaded once a turn and added to as pages are
   *  read: every write's quotation check used to reload them all from D1. */
  kept?: { list: ResearchSource[] | null };
}

async function keptPages(t: ToolContext): Promise<ResearchSource[]> {
  if (!t.sources) return [];
  if (t.kept?.list) return t.kept.list;
  const list = await t.sources.texts(t.draftId);
  if (t.kept) t.kept.list = list;
  return list;
}

/** A research report is checked against the pages read; an article against
 *  the record's documents. */
async function checkFor(t: ToolContext, body: string): Promise<{ r: CheckResult; line: string }> {
  if (t.kind === "research") {
    const pages = await keptPages(t);
    const r = checkReport(body, pages);
    return { r, line: describeReportCheck(r, pages) };
  }
  const r = await check(t.env, body);
  return { r, line: describeCheck(r) };
}

async function check(env: Env, body: string): Promise<CheckResult> {
  return checkQuotes(
    body,
    await sourceTexts(
      env,
      draftQuotes(body).map((q) => q.doc),
    ),
  );
}

async function runTool(
  name: string,
  input: unknown,
  t: ToolContext,
): Promise<{ text: string; error?: boolean }> {
  const bad = (msg: string) => ({ text: msg, error: true });
  // Arguments a model could not finish (cut off, or not valid JSON) are said
  // to be so, not reported as missing fields — which had the model write the
  // whole thing again and be cut off again.
  if (input && typeof input === "object" && "_unreadable" in input)
    return bad(
      "Your arguments were cut off or were not valid JSON, so nothing was done. Send less at once: write a shorter version first, then add to it with edit_draft.",
    );
  switch (name) {
    case "list_documents": {
      const p = ListInput.safeParse(input ?? {});
      if (!p.success) return bad("Invalid input.");
      const want = p.data.topic?.toLowerCase();
      const rows = (await listSources(t.env)).filter(
        (s) => !want || s.topic.toLowerCase().includes(want),
      );
      const own = ownWriting().filter((w) => !want || w.topic.toLowerCase().includes(want));
      if (!rows.length && !own.length) return { text: "No documents match." };
      const research = rows
        .slice(0, 300)
        .map(
          (s) =>
            `${s.id} · ${s.title} · ${s.topic || "no topic"} · ${s.kind} · ${s.date} · ${s.chars} chars${s.status === "waiting" ? " · waiting in Admin" : ""}`,
        )
        .join("\n");
      const mine = own
        .map(
          (w) =>
            `${w.id} · ${w.title} · ${w.topic || "no topic"} · ${w.kind} · ${w.date} · ${w.route}`,
        )
        .join("\n");
      return {
        text: `RESEARCH DOCUMENTS (${rows.length}) — sources you may quote\n${research || "none"}\n\nCHRIS'S OWN ARTICLES AND PAPERS (${own.length}) — read to know what is already written; never quote them as a source\n${mine || "none"}`,
      };
    }
    case "search_documents": {
      const p = SearchInput.safeParse(input);
      if (!p.success) return bad("Give a query.");
      const hits = await searchSources(t.env, p.data.query);
      const mine = searchOwnWriting(p.data.query);
      if (!hits.length && !mine.length) return { text: "Nothing matches." };
      const research = hits
        .map(
          (h) =>
            `${h.source.id} · ${h.source.title} · ${h.source.topic}\n${h.snippets.map((s) => `  … ${s} …`).join("\n")}`,
        )
        .join("\n\n");
      const own = mine
        .map(
          (m) =>
            `${m.item.id} · ${m.item.title} · ${m.item.kind}${m.snippet ? `\n  … ${m.snippet} …` : ""}`,
        )
        .join("\n\n");
      return {
        text: `${research || "No research document matches."}${own ? `\n\nIN CHRIS'S OWN ARTICLES AND PAPERS (read-only, never a source):\n${own}` : ""}`,
      };
    }
    case "read_document": {
      const p = ReadInput.safeParse(input);
      if (!p.success) return bad("Give a document id.");
      const text = await sourceText(t.env, p.data.id);
      if (text == null) {
        // Chris's own article or paper: readable, never a source.
        const own = ownWritingText(p.data.id);
        if (own)
          return {
            text: `${own.title}\n(Chris's own ${own.kind.toLowerCase()}, published at ${own.route}. Read it to know what is already written and to build on it; it is not a source — never quote it.)\n\n${own.text}`,
          };
        return bad(`"${p.data.id}" is not a document you can read. Use list_documents for ids.`);
      }
      const title = researchDoc(p.data.id)?.title ?? p.data.id;
      // A read records that the whole document was read.
      if (t.kind === "read" && t.reads && t.readId && t.readDoc?.id === p.data.id)
        await t.reads.update(t.readId, { charsRead: text.length });
      return { text: `${title}\n(id: ${p.data.id})\n\n${text}` };
    }
    case "write_draft": {
      const p = WriteInput.safeParse(input);
      if (!p.success)
        return bad(
          `The draft was not saved: ${p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
        );
      const d = await t.store.get(t.draftId);
      const meta: DraftMeta = {
        title: p.data.title,
        dek: p.data.dek,
        topic: p.data.topic,
        thesis: p.data.thesis,
        based_on: p.data.based_on,
        ...(p.data.why !== undefined
          ? { why: p.data.why }
          : d?.meta.why
            ? { why: d.meta.why }
            : {}),
      };
      await t.store.save(t.draftId, { meta, body: p.data.body });
      const r = await check(t.env, p.data.body);
      t.emit({ type: "draft", check: r });
      return { text: `Saved. ${describeCheck(r)}` };
    }
    case "edit_draft": {
      const p = EditInput.safeParse(input);
      if (!p.success) return bad("Give find and replace.");
      const d = await t.store.get(t.draftId);
      if (!d) return bad("The draft is gone.");
      // Several passages in one call (each quotation fix had been its own
      // model call, re-reading the whole conversation): all or none.
      let body = d.body;
      const all = [{ find: p.data.find, replace: p.data.replace }, ...(p.data.also ?? [])];
      for (const [i, e] of all.entries()) {
        const n = body.split(e.find).length - 1;
        const which =
          all.length > 1 ? ` (change ${i + 1} of ${all.length}; nothing was changed)` : "";
        if (n !== 1)
          return bad(
            n === 0
              ? `That passage is not in the draft${which}. Copy it exactly from your last write: "${e.find.slice(0, 120)}"`
              : `That passage occurs ${n} times${which}; include more text so it is unique: "${e.find.slice(0, 120)}"`,
          );
        body = body.replace(e.find, () => e.replace);
      }
      await t.store.save(t.draftId, { body });
      const { r, line } = await checkFor(t, body);
      t.emit({ type: "draft", check: r });
      const cites = t.kind === "research" ? citationProblems(body) : [];
      return {
        text: `Saved. ${line}${cites.length ? `\nCITATIONS TO FIX: ${cites.join(" ")}` : ""}`,
      };
    }
    case "write_report": {
      const p = ReportInput.safeParse(input);
      if (!p.success) return bad("Give title, topic and body.");
      const d = await t.store.get(t.draftId);
      await t.store.save(t.draftId, {
        meta: { ...(d?.meta ?? {}), title: p.data.title, topic: p.data.topic },
        body: p.data.body,
      });
      const { r, line } = await checkFor(t, p.data.body);
      t.emit({ type: "draft", check: r });
      return { text: `Saved. ${line}` };
    }
    case "note":
    case "pitch": {
      if (!t.reads || !t.readId || !t.readDoc) return bad("Cards are only for a read.");
      const r = await runReadTool(name, input, {
        reads: t.reads,
        readId: t.readId,
        docId: t.readDoc.id,
        doc: t.readDoc.text,
        toolUseId: t.toolUseId,
      });
      if (r.card) t.emit({ type: "card", card: r.card, label: cardLabel(name, input) });
      return { text: r.text, ...(r.error ? { error: true } : {}) };
    }
    case "propose_entry": {
      const p = ProposeInput.safeParse(input);
      if (!p.success) return bad("Give kind, title, body, doc, section, quote and topic.");
      if (!t.entries) return bad("Proposals are not available here.");
      const kind = p.data.kind as EntryKind;
      const data = { ...p.data, title: kind === "figure" ? p.data.quote : p.data.title };
      const issues = await proposalProblems(t.env, kind, data);
      if (issues.length) return bad(`Not proposed: ${issues.join(" ")}`);
      const entry = await t.entries.create({
        kind,
        data: {
          title: data.title,
          body: data.body,
          doc: data.doc,
          section: data.section,
          quote: data.quote,
          topic: data.topic,
        },
        draftId: t.draftId,
        ...(t.toolUseId ? { toolUseId: t.toolUseId } : {}),
      });
      t.emit({ type: "proposal", entry });
      return { text: "Proposed. Chris will add it as written, rewrite it, or dismiss it." };
    }
    // ---- notes and sections (notes.ts) ----
    case "write_outline": {
      const i = (input ?? {}) as { title?: unknown; topic?: unknown; sections?: unknown };
      const sections = (Array.isArray(i.sections) ? i.sections : [])
        .map((s: { heading?: unknown; words?: unknown }) => ({
          heading: String(s?.heading ?? "").trim(),
          words: Math.max(100, Math.round(Number(s?.words) || 600)),
        }))
        .filter((s: OutlineSection) => s.heading) as OutlineSection[];
      if (!String(i.title ?? "").trim() || !sections.length || sections.length > 12)
        return bad(
          "Give a title, a topic and 1 to 12 sections, each a heading and a target length.",
        );
      const d = await t.store.get(t.draftId);
      const notes = t.notes ? await t.notes.list(t.draftId) : [];
      const body = withSources(skeleton(sections, d?.body ?? ""), notes, await keptPages(t));
      await t.store.save(t.draftId, {
        meta: {
          ...(d?.meta ?? {}),
          title: String(i.title).trim(),
          topic: String(i.topic ?? "").trim(),
        },
        body,
      });
      const { r, line } = await checkFor(t, body);
      t.emit({ type: "draft", check: r });
      const total = sections.reduce((n, s) => n + s.words, 0);
      return {
        text: `Outline saved: ${sections.length} sections, about ${total.toLocaleString("en")} words of Details. Note evidence as you read (note_evidence, with the section number); write each section with write_section once its notes are in, the summary and closing last. ${line}`,
      };
    }
    case "note_evidence": {
      const i = (input ?? {}) as {
        url?: unknown;
        quote?: unknown;
        claim?: unknown;
        section?: unknown;
      };
      const url = String(i.url ?? "").trim();
      const quote = String(i.quote ?? "").trim();
      const claim = String(i.claim ?? "").trim();
      if (!url || quote.length < 15 || !claim)
        return bad("Give the page's address, its exact words (a sentence or two) and the claim.");
      if (!t.notes) return bad("Notes are not available in this conversation.");
      const placed = placeNote(quote, url, await keptPages(t));
      if ("near" in placed)
        return bad(
          `Not noted: those words are not on ${url} or any page you have read, word for word.${
            placed.near
              ? ` The page ${placed.near.url} says: "${placed.near.text}"`
              : " Read the page first with web_fetch."
          }`,
        );
      const section =
        Number.isInteger(Number(i.section)) && Number(i.section) > 0 ? Number(i.section) : null;
      const note = await t.notes.add(t.draftId, { url: placed.url, quote, claim, section });
      const k = sourceNumbers(await t.notes.list(t.draftId)).get(note.url);
      return { text: `Noted #${note.n}. Cite it as [${k}].` };
    }
    case "list_notes": {
      if (!t.notes) return bad("Notes are not available in this conversation.");
      const s = Number((input as { section?: unknown } | null)?.section);
      return {
        text: describeNotes(
          await t.notes.list(t.draftId),
          Number.isInteger(s) && s > 0 ? s : undefined,
        ),
      };
    }
    case "write_section": {
      const i = (input ?? {}) as { part?: unknown; text?: unknown };
      const part = String(i.part ?? "")
        .trim()
        .toLowerCase();
      const text = String(i.text ?? "").trim();
      if (!part || text.length < 20)
        return bad('Give the part (a section number, "summary" or "closing") and its text.');
      const d = await t.store.get(t.draftId);
      if (!d?.body.includes("\n## Details"))
        return bad("Lay the report out first with write_outline.");
      const replaced = replacePart(d.body, part, text);
      if (replaced === null)
        return bad(
          `There is no part "${part}" in the outline. Use a Details section's number, "summary" or "closing".`,
        );
      const notes = t.notes ? await t.notes.list(t.draftId) : [];
      const body = withSources(replaced, notes, await keptPages(t));
      await t.store.save(t.draftId, { body });
      const { r, line } = await checkFor(t, body);
      t.emit({ type: "draft", check: r });
      const left = unwritten(body);
      const cites = citationProblems(body);
      return {
        text: `Saved. ${left.length ? `Still to write: ${left.join("; ")}.` : "Every part is written."} ${line}${cites.length ? `\nCITATIONS TO FIX (with edit_draft): ${cites.join(" ")}` : ""}`,
      };
    }
    // The web on Workers AI: our own tools (Claude's are Anthropic's server
    // tools and never arrive here).
    case "web_search": {
      const q = String((input as { query?: unknown } | null)?.query ?? "").trim();
      if (!q) return bad("Give a query.");
      if (t.web && t.web.searches >= SEARCH_LIMIT)
        return bad("max_uses_exceeded: the web search allowance for this message is spent.");
      if (t.web) t.web.searches++;
      try {
        const hits = await webSearch(t.env, q);
        if (!hits.length) return { text: "No results." };
        return {
          text: hits.map((h, i) => `${i + 1}. ${h.title}\n${h.url}\n${h.description}`).join("\n\n"),
        };
      } catch (e) {
        return bad(`The search failed: ${(e as Error).message}`);
      }
    }
    case "web_fetch": {
      const i = (input ?? {}) as { url?: unknown; offset?: unknown };
      const url = String(i.url ?? "").trim();
      const offset = Math.max(0, Math.floor(Number(i.offset) || 0));
      if (!/^https?:\/\//i.test(url)) return bad("Give a full address, https://…");
      // A page already read is served from what was kept: no second fetch,
      // no allowance spent, no duplicate row.
      let page: ResearchSource | null =
        [...(t.kept?.list ?? [])].reverse().find((p) => p.url === url) ??
        (t.sources ? await t.sources.byUrl(t.draftId, url) : null);
      const again = !!page && offset === 0;
      if (!page) {
        if (t.web && t.web.reads >= READ_LIMIT)
          return bad("max_uses_exceeded: the page-reading allowance for this message is spent.");
        if (t.web) t.web.reads++;
        try {
          page = await readPage(t.env, url);
        } catch (e) {
          return bad(`Could not read it: ${(e as Error).message}`);
        }
        if (!page)
          return bad("Nothing readable came back (an empty page, a login wall, or a bot check).");
        page = { ...page, url };
        if (t.sources && (await t.sources.add(t.draftId, [page])))
          return bad(
            "The page was read but could not be kept, so quotations from it would fail the check. Read another source for this.",
          );
        if (t.kept?.list) t.kept.list.push(page);
      }
      const slice = page.text.slice(offset, offset + PAGE_CHARS);
      const more = offset + PAGE_CHARS < page.text.length;
      return {
        text: `${again ? "(You have read this page already; here it is again from what was kept.)\n" : ""}${page.title ?? url}\n${url}\n\n${slice}${
          more
            ? `\n\n[${page.text.length.toLocaleString("en")} characters in all; read on with offset ${offset + PAGE_CHARS}]`
            : ""
        }`,
      };
    }
    default:
      return bad(`No tool called ${name}.`);
  }
}

// ---- the turn ---------------------------------------------------------------

function addUsage(
  u: Usage,
  m: Anthropic.Beta.BetaMessage,
  price: { input: number; output: number; cacheRead: number; cacheWrite: number } = PRICE,
): Usage {
  const input = m.usage.input_tokens ?? 0;
  const output = m.usage.output_tokens ?? 0;
  const cacheRead = m.usage.cache_read_input_tokens ?? 0;
  const cacheWrite = m.usage.cache_creation_input_tokens ?? 0;
  const cents =
    ((input * price.input +
      output * price.output +
      cacheRead * price.cacheRead +
      cacheWrite * price.cacheWrite) /
      1_000_000) *
    100;
  return {
    input: u.input + input,
    output: u.output + output,
    cacheRead: u.cacheRead + cacheRead,
    cacheWrite: u.cacheWrite + cacheWrite,
    cents: u.cents + cents,
  };
}

/** The conversation with the previous request's end marked as a cache
 *  breakpoint. Automatic caching marks only the last block and looks back
 *  about 20 blocks for the previous request's entry; a research step adds
 *  more than that (each search and each page read is two blocks, with notes
 *  between), so the previous entry was missed and the whole conversation was
 *  written to the cache again — 8.2M tokens of writes across eleven research
 *  conversations, at a write price. Marking the block the previous request
 *  ended on makes that prefix a read, so only what is new is written. The
 *  previous request ended on the message just before the latest assistant
 *  message (always a user message: text or tool results). The stored
 *  conversation is not touched; only what is sent carries the mark. */
export function markPreviousEnd(history: Message[]): Message[] {
  let a = -1;
  for (let i = history.length - 1; i >= 0; i--)
    if (history[i]?.role === "assistant") {
      a = i;
      break;
    }
  const k = a - 1;
  const m = k >= 0 ? history[k] : undefined;
  if (!m || m.role !== "user") return history;
  const blocks = (
    typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content
  ) as Array<Record<string, unknown>>;
  const last = blocks[blocks.length - 1];
  if (!last || !["text", "tool_result", "document", "image"].includes(String(last.type)))
    return history;
  if (last.type === "text" && !String(last.text ?? "").trim()) return history;
  const marked = {
    ...m,
    content: [...blocks.slice(0, -1), { ...last, cache_control: { type: "ephemeral", ttl: "1h" } }],
  } as unknown as Message;
  return [...history.slice(0, k), marked, ...history.slice(k + 1)];
}

/** What a Claude call cost: its own tokens at the engine's rates, an
 *  advisor's calls at Opus's (they are reported apart, in usage.iterations),
 *  and each web search at $10 per thousand. */
function claudeUsage(
  u: Usage,
  m: Anthropic.Beta.BetaMessage,
  price: { input: number; output: number; cacheRead: number; cacheWrite: number },
): Usage {
  let next = addUsage(u, m, price);
  const iterations = ((m.usage as unknown as { iterations?: unknown[] }).iterations ??
    []) as Array<{
    type?: string;
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  }>;
  for (const it of iterations)
    if (it.type === "advisor_message")
      next = addUsage(next, { usage: it } as unknown as Anthropic.Beta.BetaMessage, OPUS_PRICE);
  const searches =
    (m.usage as unknown as { server_tool_use?: { web_search_requests?: number } }).server_tool_use
      ?.web_search_requests ?? 0;
  return searches ? { ...next, cents: next.cents + searches } : next;
}

const toolUses = (content: Message["content"]): Anthropic.Beta.BetaToolUseBlockParam[] =>
  typeof content === "string"
    ? []
    : (content.filter((b) => b.type === "tool_use") as Anthropic.Beta.BetaToolUseBlockParam[]);

/** After a fallback mid-answer, the declined model's reasoning and tool
 *  calls before the last `fallback` block must not be replayed or run; its
 *  text stays (Anthropic: "Echoing fallback turns back"). */
export function afterFallback(
  content: Anthropic.Beta.BetaContentBlock[],
): Anthropic.Beta.BetaContentBlock[] {
  let cut = -1;
  content.forEach((b, i) => {
    if ((b as { type: string }).type === "fallback") cut = i;
  });
  if (cut < 0) return content;
  return content.filter((b, i) => i >= cut || b.type === "text");
}

/** A turn cut off mid-tool (a closed tab) leaves calls with no results; the
 *  next request must answer them, so they are answered as interrupted. */
function unanswered(history: Message[]): Message | null {
  const last = history[history.length - 1];
  if (!last || last.role !== "assistant") return null;
  const uses = toolUses(last.content);
  if (!uses.length) return null;
  return {
    role: "user",
    content: uses.map((u) => ({
      type: "tool_result" as const,
      tool_use_id: u.id,
      content:
        "The turn was interrupted here; this may or may not have completed. Check the draft before relying on it.",
      is_error: true,
    })),
  };
}

export async function runTurn(o: {
  /** Claude's stream; null when Claude is not connected (a Workers AI
   *  conversation does not need it). */
  stream: StreamFn | null;
  /** The engine a conversation starts on when it was not given one. */
  defaultEngine?: EngineId;
  env: Env;
  store: DraftStore;
  entries?: EntryStore | undefined;
  sources?: SourceStore | undefined;
  notes?: NoteStore | undefined;
  reads?: ReadStore | undefined;
  draftId: string;
  text: string;
  emit: Emit;
  maxSteps?: number;
}): Promise<void> {
  const { store, draftId, emit } = o;
  const draft = await store.get(draftId);
  if (!draft) {
    emit({ type: "error", message: "That draft does not exist." });
    return;
  }
  // One turn at a time: two at once would interleave their messages and
  // break the tool-call pairing every later request depends on.
  if (!(await store.lock(draftId))) {
    emit({
      type: "error",
      message:
        "Claude is still working on this draft (in another tab, or a turn that was cut off). Try again in a minute.",
    });
    return;
  }
  try {
    await turn(o, draft);
  } finally {
    await store.unlock(draftId);
  }
}

async function turn(o: Parameters<typeof runTurn>[0], draft: Draft): Promise<void> {
  const { env, store, draftId, emit } = o;
  let usage = draft.usage ?? NO_USAGE;
  // The instructions and tools are frozen at the conversation's first turn
  // and sent byte for byte ever after: the model's reasoning is bound to the
  // exact conversation, and a topic or tool added later must not change it.
  // It is saved only once a first reply has come back, so a first turn that
  // fails (a bad key, a rejected parameter) does not freeze a broken frame.
  // The engine is part of it: a conversation stays on the engine it began on.
  // A conversation that already has messages but no frame began on Claude.
  const history = await store.messages(draftId);
  const startOn = draft.meta.engine ?? (history.length ? CLAUDE : (o.defaultEngine ?? CLAUDE));
  let frame: Frame;
  try {
    frame = draft.frame ? (JSON.parse(draft.frame) as Frame) : newFrame(draft.kind, startOn);
  } catch {
    frame = newFrame(draft.kind, startOn);
  }
  const engineId = frame.engine ?? CLAUDE;
  const workers = isWorkersAi(engineId);
  if (!workers && !o.stream) {
    emit({
      type: "error",
      message:
        "Claude is not connected, and this conversation runs on Claude. Connect it on /admin/claude, or start a new conversation on a Workers AI model.",
    });
    return;
  }
  const repair = unanswered(history);
  const opening: Message[] = [
    ...(repair ? [repair] : []),
    { role: "user", content: [{ type: "text", text: o.text }] },
  ];
  await store.append(draftId, opening);
  history.push(...opening);

  let frameSaved = !!draft.frame;
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: frame.system, cache_control: { type: "ephemeral", ttl: "1h" } },
  ];
  // A read knows its document: the cards are located in its text.
  const readDocId = draft.kind === "read" ? draft.meta.based_on?.[0] : undefined;
  const readText = readDocId ? await sourceText(env, readDocId) : null;
  // What this message spent on the web, said at the end of a research turn.
  const web = { searches: 0, reads: 0, capped: new Set<string>() };
  const ctx: ToolContext = {
    web,
    kept: { list: null },
    env,
    store,
    entries: o.entries,
    sources: o.sources,
    notes: o.notes,
    reads: o.reads,
    readId: draft.meta.readId,
    readDoc: readDocId && readText != null ? { id: readDocId, text: readText } : undefined,
    kind: draft.kind,
    draftId,
    emit,
  };
  const usageBefore = usage.cents;
  // A step on Workers AI costs about a cent: research there gets more of them
  // (live, V4.1 Flash used all 60 before writing its summary).
  const steps =
    o.maxSteps ??
    (draft.kind === "read"
      ? READ_STEPS
      : draft.kind === "research"
        ? workers
          ? WORKERS_RESEARCH_STEPS
          : RESEARCH_STEPS
        : MAX_STEPS);
  // Whether the model finished on its own, rather than hitting the step limit.
  let ended = false;
  // The research workflow's checkpoints, each said once a message.
  const nudges = async (step: number): Promise<string[]> => {
    const out: string[] = [];
    const now = await store.get(draftId);
    const outlined = !!now?.body.includes("\n## Details");
    const noted = o.notes ? (await o.notes.list(draftId)).length : 0;
    // Some Details section already has text (not just its "to write" mark).
    const body = now?.body ?? "";
    const sections = (body.match(/^### /gm) ?? []).length;
    const blank = unwritten(body).filter((h) => /^\d+\. /.test(h)).length;
    const written = outlined && sections > blank;
    const say = (key: string, text: string) => {
      if (web.capped.has(key)) return;
      web.capped.add(key);
      out.push(text);
    };
    if (!outlined && step >= 2)
      say(
        "outline",
        "Lay the report out now with write_outline (one Details section per sub-question, each with a target length) before reading further. The rest of the research follows the outline.",
      );
    if (noted === 0 && web.reads >= 6)
      say(
        "notes",
        `You have read ${web.reads} pages and noted nothing. Before reading more, note the passages you will use with note_evidence — several in one message, each with its section number.`,
      );
    // Live: with the outline and notes checkpoints, DeepSeek took 45 notes
    // from 9 pages for a 600-word report and never wrote; so notes and steps
    // count here as well as pages.
    if (outlined && !written && (web.reads >= 16 || noted >= 15 || step >= 12))
      say(
        "write",
        `You have ${noted} notes from ${web.reads} pages: enough to start writing. Write the sections you have notes for with write_section now (list_notes with a section number gives that section's notes); read further only for a gap you can name.`,
      );
    return out;
  };

  for (let step = 0; step < steps; step++) {
    let message: Anthropic.Beta.BetaMessage;
    if (workers) {
      // An open model on Workers AI: the whole reply at once, then the same
      // loop as Claude's (its tool calls arrive as tool_use blocks).
      try {
        // With notes kept, pages can leave the model's view much sooner.
        message = await workersStep(
          env,
          engineId,
          frame.system,
          frame.tools,
          history,
          notesMode(frame.tools) ? 300_000 : undefined,
          o.draftId,
        );
      } catch (err) {
        emit({
          type: "error",
          message: `${engineOf(engineId).label} on Workers AI could not answer: ${String((err as Error).message ?? err).slice(0, 400)}`,
        });
        break;
      }
      const said = message.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("")
        .trim();
      const calls = message.content.filter((b) => b.type === "tool_use") as Array<{ name: string }>;
      // Words between tool calls are progress notes; the last words are the reply.
      if (said) emit(calls.length ? { type: "update", text: said } : { type: "text", text: said });
      for (const c of calls)
        if (c.name === "write_draft" || c.name === "write_report" || c.name === "edit_draft")
          emit({ type: "activity", text: c.name === "edit_draft" ? "Revising…" : "Writing…" });
    } else if (!o.stream) {
      break;
    } else
      try {
        const s = o.stream({
          model: engineOf(engineId).model ?? WRITE_MODEL,
          // The model's whole output allowance: a long report or article is one
          // write, and its thinking counts against the same budget.
          max_tokens: 128000,
          betas: [
            "server-side-fallback-2026-07-01",
            "thinking-binding-controls-2026-08-01",
            "context-management-2025-06-27",
            "thinking-display-updates-2026-08-18",
            ...(advisorTool(engineId) ? ["advisor-tool-2026-03-01"] : []),
          ],
          // Long sessions read a lot: past 500k tokens, older tool results
          // (documents, fetched pages) are cleared from what Claude sees. The
          // pages themselves are kept (research_sources) and can be re-read.
          context_management: {
            edits: [
              {
                type: "clear_tool_uses_20250919",
                // Rarely and in large batches: every clear rewrites the cached
                // conversation after it, and on the live record (2026-11-04)
                // cache writes were over half of what Claude research cost.
                // With notes kept (notes.ts), pages carry nothing the report
                // still needs once noted, and can be cleared much sooner.
                trigger: {
                  type: "input_tokens",
                  value: notesMode(frame.tools) ? 250_000 : 500_000,
                },
                clear_at_least: {
                  type: "input_tokens",
                  value: notesMode(frame.tools) ? 120_000 : 200_000,
                },
                keep: { type: "tool_uses", value: notesMode(frame.tools) ? 6 : 8 },
                exclude_tools: [
                  "write_draft",
                  "write_report",
                  "edit_draft",
                  "write_outline",
                  "write_section",
                  "note_evidence",
                  "list_notes",
                  ...(advisorTool(engineId) ? ["advisor"] : []),
                ],
              },
            ],
          },
          fallbacks: "default",
          // A safety net under the frozen frame: if the prefix ever differs,
          // drop the stale reasoning instead of failing the turn.
          // "updates": the short notes Claude writes between tool calls (what it
          // just found, what it will do next) come back as text and show in the
          // chat; its reasoning stays hidden. Without it a long run is silent.
          thinking: {
            type: "adaptive",
            display: "updates",
            block_binding: { prefix_mismatch_behavior: "drop_block" },
          },
          output_config: { effort: "high" },
          // One hour, not five minutes: Chris reads a report for longer than
          // five minutes before replying, and each reply after that re-bought
          // the whole conversation at the write rate. One-hour writes cost 2×
          // input instead of 1.25×, and every reply within the hour reads it
          // back at a twentieth of input.
          cache_control: { type: "ephemeral", ttl: "1h" },
          system,
          tools: frame.tools,
          messages: markPreviousEnd(history),
        });
        s.on("text", (delta) => emit({ type: "text", text: delta }));
        // Progress notes arrive as thinking blocks with text (display: "updates");
        // an empty one is reasoning, and shows nothing.
        const notes = new Map<number, string>();
        s.on("streamEvent", (ev) => {
          if (ev.type === "content_block_start" && ev.content_block.type === "thinking")
            notes.set(ev.index, "");
          if (
            ev.type === "content_block_delta" &&
            ev.delta.type === "thinking_delta" &&
            notes.has(ev.index)
          )
            notes.set(ev.index, (notes.get(ev.index) ?? "") + ev.delta.thinking);
          if (ev.type === "content_block_stop" && notes.has(ev.index)) {
            const note = (notes.get(ev.index) ?? "").trim();
            notes.delete(ev.index);
            if (note) emit({ type: "update", text: note });
          }
          if (ev.type === "content_block_start" && ev.content_block.type === "server_tool_use") {
            emit({
              type: "activity",
              text:
                ev.content_block.name === "web_fetch" ? "Reading a page…" : "Searching the web…",
            });
          }
          if (ev.type === "content_block_start" && ev.content_block.type === "tool_use") {
            const n = ev.content_block.name;
            if (n === "write_draft" || n === "edit_draft")
              emit({
                type: "activity",
                text: n === "write_draft" ? "Writing the draft…" : "Revising…",
              });
          }
        });
        message = await s.finalMessage();
      } catch (err) {
        const e = err as {
          status?: number;
          message?: string;
          error?: { error?: { message?: string } };
        };
        const detail = e.error?.error?.message ?? e.message ?? "unknown error";
        const via =
          claudeRoute(env) === "gateway"
            ? "through Cloudflare's AI Gateway"
            : "with the Anthropic API key";
        emit({
          type: "error",
          message:
            e.status === 401 || e.status === 403
              ? `Claude refused the credentials ${via} (${e.status}: ${detail}).`
              : `Claude could not be reached ${via}${e.status ? ` (${e.status})` : ""}: ${detail}`,
        });
        break;
      }
    usage = workers
      ? addUsage(usage, message, engineOf(engineId).price)
      : claudeUsage(usage, message, engineOf(engineId).price);
    // Saved at every step, not at the end: a turn cut off by an error had
    // cost money that was never counted.
    await store.save(draftId, { usage });
    if (!frameSaved) {
      // The engine also goes in the meta, which the drafts list reads.
      const now = await store.get(draftId);
      await store.save(draftId, {
        frame: JSON.stringify(frame),
        ...(now && now.meta.engine !== engineId ? { meta: { ...now.meta, engine: engineId } } : {}),
      });
      frameSaved = true;
    }

    // A refusal keeps only its text, if any: an empty or half-written
    // assistant message would make every later request fail.
    if (message.stop_reason === "refusal") {
      const text = afterFallback(message.content).filter((b) => b.type === "text" && b.text.trim());
      if (text.length) {
        const kept: Message = { role: "assistant", content: text as Message["content"] };
        await store.append(draftId, [kept]);
        history.push(kept);
      }
      emit({ type: "error", message: "Claude declined to continue this request." });
      break;
    }
    const assistant: Message = {
      role: "assistant",
      content: afterFallback(message.content) as Message["content"],
    };
    await store.append(draftId, [assistant]);
    history.push(assistant);

    // Every page read is kept, so the report's quotations can be checked
    // against what was actually read.
    if (draft.kind === "research" && o.sources) {
      const pages = await fetchedPages(env, message.content as unknown[]);
      if (pages.length) {
        await o.sources.add(draftId, pages);
        if (ctx.kept?.list) ctx.kept.list.push(...pages);
      }
    }
    for (const b of message.content as Array<{
      type: string;
      name?: string;
      input?: unknown;
      content?: { error_code?: string };
    }>) {
      if (b.type === "server_tool_use" && b.name) {
        emit({ type: "activity", text: activityLabel(b.name, b.input) });
        if (b.name === "web_search") web.searches++;
        if (b.name === "web_fetch") web.reads++;
      }
      // A limit reached is said in the chat, not left for Claude to mention.
      if (
        (b.type === "web_search_tool_result" || b.type === "web_fetch_tool_result") &&
        b.content?.error_code === "max_uses_exceeded"
      ) {
        const kind = b.type === "web_search_tool_result" ? "search" : "read";
        if (!web.capped.has(kind)) {
          web.capped.add(kind);
          emit({
            type: "error",
            message:
              kind === "search"
                ? "The web search limit for this message was reached. Reply “keep going” to continue with a fresh allowance."
                : "The page-reading limit for this message was reached. Reply “keep going” to continue with a fresh allowance.",
          });
        }
      }
    }
    // A long run of server-side searches can pause the turn; it resumes by
    // sending the conversation back as it stands.
    if (message.stop_reason === "pause_turn") continue;
    const uses = toolUses(assistant.content);
    if (!uses.length) {
      ended = true;
      break;
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    // Reading tools asked for together run together (search, fetch, read the
    // record); anything that writes runs one at a time, in order.
    const readOnly = new Set([
      "list_documents",
      "search_documents",
      "read_document",
      "web_search",
      "web_fetch",
    ]);
    const early =
      message.stop_reason !== "max_tokens" &&
      uses.length > 1 &&
      uses.every((u) => readOnly.has(u.name))
        ? await Promise.all(
            uses.map((u) =>
              runTool(u.name, u.input, { ...ctx, toolUseId: u.id }).catch((e: Error) => ({
                text: `Failed: ${e.message}`,
                error: true,
              })),
            ),
          )
        : null;
    for (const [n, u] of uses.entries()) {
      // A tool input cut off at max_tokens can still parse; never run it.
      if (message.stop_reason === "max_tokens") {
        results.push({
          type: "tool_result",
          tool_use_id: u.id,
          content:
            "Cut off before the input was complete. Write it in smaller pieces (edit_draft).",
          is_error: true,
        });
        continue;
      }
      const r =
        early?.[n] ??
        (await runTool(u.name, u.input, { ...ctx, toolUseId: u.id }).catch((e: Error) => ({
          text: `Failed: ${e.message}`,
          error: true,
        })));
      // A proposal shows as its card; a refused one says why.
      if (u.name === "propose_entry") {
        if (r.error) emit({ type: "activity", text: r.text });
      } else if (u.name === "note" || u.name === "pitch") {
        // A kept card arrives as its own event; a dropped one says why.
        if (r.error) emit({ type: "activity", text: `${cardLabel(u.name, u.input)} — ${r.text}` });
      } else if (u.name !== "write_draft" && u.name !== "edit_draft")
        emit({ type: "activity", text: activityLabel(u.name, u.input) });
      results.push({
        type: "tool_result",
        tool_use_id: u.id,
        content: r.text,
        ...(r.error ? { is_error: true } : {}),
      });
    }
    // Claude's web tools count per request, so a message of many requests
    // could read far past its allowance: once it is spent, say so.
    const spent =
      !workers &&
      draft.kind === "research" &&
      !web.capped.has("budget") &&
      (web.searches >= SEARCH_LIMIT || web.reads >= READ_LIMIT);
    if (spent) web.capped.add("budget");
    const said: string[] = [];
    if (spent)
      said.push(
        `The web allowance for this message is spent (${web.searches} searches, ${web.reads} pages read). Do not search or read more now: write or revise the report with what you have, say under Open questions what is still uncovered, and ask Chris to reply "keep going".`,
      );
    // Keeping to the workflow (notes.ts). A cheaper model, live on
    // 2026-11-05, read twenty pages in four minutes chasing one figure and
    // never outlined or noted anything; each nudge is said once a message.
    if (draft.kind === "research" && notesMode(frame.tools)) said.push(...(await nudges(step)));
    const reply: Message = {
      role: "user",
      content: said.length
        ? [...results, ...said.map((text) => ({ type: "text" as const, text }))]
        : results,
    };
    await store.append(draftId, [reply]);
    history.push(reply);
    if (step === steps - 1)
      emit({
        type: "error",
        message: "This turn took too many steps and stopped. Say how to continue.",
      });
  }

  if (draft.kind === "research" && (web.searches || web.reads))
    emit({
      type: "activity",
      text: `This message: ${web.searches} web ${web.searches === 1 ? "search" : "searches"} · ${web.reads} ${web.reads === 1 ? "page" : "pages"} read`,
    });
  await store.save(draftId, { usage });
  // A read's receipt: finished, by which model, at what cost.
  // Its cost always counts; it is "read" only when the document was read and
  // Claude finished (a failed turn throws before here and stays "reading").
  if (draft.kind === "read" && o.reads && draft.meta.readId) {
    const id = draft.meta.readId;
    await o.reads.bump(id, { cents: usage.cents - usageBefore });
    const r = await o.reads.get(id);
    if (r && ended && r.charsRead > 0) await o.reads.finish(id, WRITE_MODEL);
  }
  emit({ type: "done", usage });
}

// ---- the conversation as the page shows it ------------------------------------

export interface ChatItem {
  who: "you" | "claude" | "activity" | "update" | "proposal";
  text: string;
  /** A proposal's tool call, to find its card. */
  toolUseId?: string;
}

export function transcript(history: Message[]): ChatItem[] {
  const out: ChatItem[] = [];
  // Calls the tools refused: a dropped card reads as dropped after a reload too.
  const refused = new Set<string>();
  for (const m of history)
    if (typeof m.content !== "string")
      for (const b of m.content as Array<{
        type: string;
        tool_use_id?: string;
        is_error?: boolean;
      }>)
        if (b.type === "tool_result" && b.is_error && b.tool_use_id) refused.add(b.tool_use_id);
  for (const m of history) {
    if (typeof m.content === "string") {
      out.push({ who: m.role === "user" ? "you" : "claude", text: m.content });
      continue;
    }
    for (const b of m.content) {
      if (b.type === "text" && b.text.trim())
        out.push({ who: m.role === "user" ? "you" : "claude", text: b.text });
      // A progress note (display: "updates"); reasoning comes back empty.
      else if (b.type === "thinking" && b.thinking.trim())
        out.push({ who: "update", text: b.thinking.trim() });
      else if (b.type === "tool_use" && b.name === "propose_entry")
        out.push({ who: "proposal", text: activityLabel(b.name, b.input), toolUseId: b.id });
      else if (b.type === "tool_use" && (b.name === "note" || b.name === "pitch"))
        out.push({
          who: "activity",
          text: refused.has(b.id)
            ? `${cardLabel(b.name, b.input)} — dropped: not in the document word for word, or refused`
            : cardLabel(b.name, b.input),
        });
      else if (b.type === "tool_use" || b.type === "server_tool_use")
        out.push({ who: "activity", text: activityLabel(b.name, b.input) });
    }
  }
  return out;
}

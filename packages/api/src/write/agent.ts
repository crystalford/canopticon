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
import { essayContract, libraryItems, researchDoc } from "../site/content/store";
import { type CheckResult, checkQuotes, describeCheck, draftQuotes } from "./check";
import type { DraftMeta, DraftStore, Message, Usage } from "./drafts";
import { NO_USAGE } from "./drafts";
import { listSources, searchSources, sourceText, sourceTexts } from "./sources";

export const WRITE_MODEL = "claude-opus-5-5";

/** List price per million tokens (Claude Opus 5.5); a cache write costs
 *  1.25× input. The page shows the tally as an estimate. */
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };

/** Model calls in one turn, at most. A turn that needs more stops and says so. */
const MAX_STEPS = 24;

export type WriteEvent =
  | { type: "text"; text: string }
  | { type: "activity"; text: string }
  | { type: "draft"; check: CheckResult }
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

/** The real thing: the Anthropic SDK, with the operator's key. */
export async function anthropicStream(env: Env): Promise<StreamFn | null> {
  if (!env.ANTHROPIC_API_KEY) return null;
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return (params) => client.beta.messages.stream(params) as unknown as StreamLike;
}

// ---- instructions -----------------------------------------------------------

function topics(): string[] {
  return [
    ...new Set(
      libraryItems()
        .map((r) => r.topic)
        .filter(Boolean),
    ),
  ].sort();
}

const HOW = `You are writing for Canopticon, a public research record, with its author, Chris Telford. He talks to you in a workspace: the chat is on the left, and the page you write is on the right, rendered exactly as it will be published. Each time you write, he sees the page change.

HOW YOU WORK
- Read before you write. Find the research with search_documents and list_documents, then read every document you will rely on in full with read_document. Quotations chosen by keyword search are the ones that matched the search, not the ones that carry the document.
- Write the whole article with write_draft. Revise with edit_draft, which replaces one exact passage, when only part of it changes — above all when Chris flags a passage.
- Every write returns the verbatim check. If any quotation failed, fix it (copy the passage exactly from read_document's text, or drop it) before you finish your turn.
- In the chat, be brief: say what you did and what you need from him. Do not paste the article into the chat; it is on the page.
- When Chris flags a passage it arrives in his message as a quoted block (lines starting with "> "). Revise that passage with edit_draft.
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

THE ESSAY CONTRACT
Below is the standard every article meets. Where it describes the old desk, the draft room, quarantine, grounding packs or JSON shapes, that is history: you work in this workspace and in Markdown. Its rules about the idea, evidence, honesty, numbers, titles, plain writing and the slop list all hold.

`;

export function systemPrompt(): string {
  return HOW.replace("{{TOPICS}}", topics().join("; ")) + essayContract();
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
const EditInput = z.object({ find: z.string().min(1), replace: z.string() });

export const TOOLS: Anthropic.Beta.BetaToolUnion[] = [
  {
    name: "list_documents",
    description:
      "List the documents in the record you may read and quote: id, title, topic, kind, date, length and whether it is an upload waiting in Admin. Optionally narrow to a topic.",
    input_schema: {
      type: "object",
      properties: { topic: { type: "string", description: "Part of a topic name, e.g. Housing" } },
    },
  },
  {
    name: "search_documents",
    description:
      "Search the full text of every document you may quote. Every word must match; put a phrase in double quotes to match it exactly. Returns the best documents with short passages around the match.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "read_document",
    description: "Read one document in full. Quote only from text this returns, copied exactly.",
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
      "Replace one exact passage of the draft body with new text. `find` must occur exactly once. Returns the verbatim check.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        find: { type: "string", description: "The exact current text, long enough to be unique" },
        replace: { type: "string" },
      },
      required: ["find", "replace"],
    },
  },
];

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
      return `Read: ${researchDoc(id)?.title.replace(/^#\s*/, "") ?? id}`;
    }
    case "write_draft":
      return "Wrote the draft";
    case "edit_draft":
      return "Revised a passage";
    default:
      return name;
  }
}

interface ToolContext {
  env: Env;
  store: DraftStore;
  draftId: string;
  emit: Emit;
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
  switch (name) {
    case "list_documents": {
      const p = ListInput.safeParse(input ?? {});
      if (!p.success) return bad("Invalid input.");
      const want = p.data.topic?.toLowerCase();
      const rows = (await listSources(t.env)).filter(
        (s) => !want || s.topic.toLowerCase().includes(want),
      );
      if (!rows.length) return { text: "No documents match." };
      return {
        text: rows
          .slice(0, 300)
          .map(
            (s) =>
              `${s.id} · ${s.title} · ${s.topic || "no topic"} · ${s.kind} · ${s.date} · ${s.chars} chars${s.status === "waiting" ? " · waiting in Admin" : ""}`,
          )
          .join("\n"),
      };
    }
    case "search_documents": {
      const p = SearchInput.safeParse(input);
      if (!p.success) return bad("Give a query.");
      const hits = await searchSources(t.env, p.data.query);
      if (!hits.length) return { text: "Nothing matches." };
      return {
        text: hits
          .map(
            (h) =>
              `${h.source.id} · ${h.source.title} · ${h.source.topic}\n${h.snippets.map((s) => `  … ${s} …`).join("\n")}`,
          )
          .join("\n\n"),
      };
    }
    case "read_document": {
      const p = ReadInput.safeParse(input);
      if (!p.success) return bad("Give a document id.");
      const text = await sourceText(t.env, p.data.id);
      if (text == null)
        return bad(`"${p.data.id}" is not a document you can read. Use list_documents for ids.`);
      const title = researchDoc(p.data.id)?.title ?? p.data.id;
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
      const n = d.body.split(p.data.find).length - 1;
      if (n !== 1)
        return bad(
          n === 0
            ? "That passage is not in the draft. Copy it exactly from your last write."
            : `That passage occurs ${n} times; include more text so it is unique.`,
        );
      const body = d.body.replace(p.data.find, () => p.data.replace);
      await t.store.save(t.draftId, { body });
      const r = await check(t.env, body);
      t.emit({ type: "draft", check: r });
      return { text: `Saved. ${describeCheck(r)}` };
    }
    default:
      return bad(`No tool called ${name}.`);
  }
}

// ---- the turn ---------------------------------------------------------------

function addUsage(u: Usage, m: Anthropic.Beta.BetaMessage): Usage {
  const input = m.usage.input_tokens ?? 0;
  const output = m.usage.output_tokens ?? 0;
  const cacheRead = m.usage.cache_read_input_tokens ?? 0;
  const cacheWrite = m.usage.cache_creation_input_tokens ?? 0;
  const cents =
    ((input * PRICE.input +
      output * PRICE.output +
      cacheRead * PRICE.cacheRead +
      cacheWrite * PRICE.cacheWrite) /
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

const toolUses = (content: Message["content"]): Anthropic.Beta.BetaToolUseBlockParam[] =>
  typeof content === "string"
    ? []
    : (content.filter((b) => b.type === "tool_use") as Anthropic.Beta.BetaToolUseBlockParam[]);

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
      content: "Interrupted before this ran.",
      is_error: true,
    })),
  };
}

export async function runTurn(o: {
  stream: StreamFn;
  env: Env;
  store: DraftStore;
  draftId: string;
  text: string;
  emit: Emit;
  maxSteps?: number;
}): Promise<void> {
  const { env, store, draftId, emit } = o;
  const draft = await store.get(draftId);
  if (!draft) {
    emit({ type: "error", message: "That draft does not exist." });
    return;
  }
  let usage = draft.usage ?? NO_USAGE;
  const history = await store.messages(draftId);
  const repair = unanswered(history);
  const opening: Message[] = [
    ...(repair ? [repair] : []),
    { role: "user", content: [{ type: "text", text: o.text }] },
  ];
  await store.append(draftId, opening);
  history.push(...opening);

  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } },
  ];
  const ctx: ToolContext = { env, store, draftId, emit };
  const steps = o.maxSteps ?? MAX_STEPS;

  for (let step = 0; step < steps; step++) {
    let message: Anthropic.Beta.BetaMessage;
    try {
      const s = o.stream({
        model: WRITE_MODEL,
        max_tokens: 64000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "high" },
        cache_control: { type: "ephemeral" },
        system,
        tools: TOOLS,
        messages: history,
      });
      s.on("text", (delta) => emit({ type: "text", text: delta }));
      s.on("streamEvent", (ev) => {
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
      emit({
        type: "error",
        message:
          e.status === 401
            ? "The Anthropic API key was refused. Check the ANTHROPIC_API_KEY secret."
            : `Claude could not be reached${e.status ? ` (${e.status})` : ""}: ${detail}`,
      });
      break;
    }
    usage = addUsage(usage, message);
    const assistant: Message = {
      role: "assistant",
      content: message.content as Message["content"],
    };
    await store.append(draftId, [assistant]);
    history.push(assistant);

    if (message.stop_reason === "refusal") {
      emit({ type: "error", message: "Claude declined to continue this request." });
      break;
    }
    const uses = toolUses(assistant.content);
    if (!uses.length) break;

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const u of uses) {
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
      const r = await runTool(u.name, u.input, ctx).catch((e: Error) => ({
        text: `Failed: ${e.message}`,
        error: true,
      }));
      if (u.name !== "write_draft" && u.name !== "edit_draft")
        emit({ type: "activity", text: activityLabel(u.name, u.input) });
      results.push({
        type: "tool_result",
        tool_use_id: u.id,
        content: r.text,
        ...(r.error ? { is_error: true } : {}),
      });
    }
    const reply: Message = { role: "user", content: results };
    await store.append(draftId, [reply]);
    history.push(reply);
    if (step === steps - 1)
      emit({
        type: "error",
        message: "This turn took too many steps and stopped. Say how to continue.",
      });
  }

  await store.save(draftId, { usage });
  emit({ type: "done", usage });
}

// ---- the conversation as the page shows it ------------------------------------

export interface ChatItem {
  who: "you" | "claude" | "activity";
  text: string;
}

export function transcript(history: Message[]): ChatItem[] {
  const out: ChatItem[] = [];
  for (const m of history) {
    if (typeof m.content === "string") {
      out.push({ who: m.role === "user" ? "you" : "claude", text: m.content });
      continue;
    }
    for (const b of m.content) {
      if (b.type === "text" && b.text.trim())
        out.push({ who: m.role === "user" ? "you" : "claude", text: b.text });
      else if (b.type === "tool_use")
        out.push({ who: "activity", text: activityLabel(b.name, b.input) });
    }
  }
  return out;
}

// The workspace's engines: Claude, or an open model on Cloudflare's Workers AI.
//
// Claude (Opus 5.5) is the strongest and the most expensive: measured on the
// live record 2026-11-04, eleven research conversations cost $68.62, more
// than half of it in prompt-cache writes as fetched pages were re-sent. The
// Workers AI models below run the same conversation — the same instructions,
// the same tools, the same word-for-word checks — at a fraction of the price,
// billed to the Cloudflare account through the Worker's AI binding (no key).
//
// The conversation is stored exactly as it is for Claude (Anthropic message
// blocks), so the transcript, the checks, saving and the preview never know
// which engine ran. This module converts it to the OpenAI chat format the
// Workers AI models take, and converts each reply back. The web is reached
// with our own tools here (Anthropic's server tools are Claude-only):
// web_search through Cloudflare's Web Search (an AI Gateway named in
// SEARCH_GATEWAY_ID; Cloudflare only, no Brave); web_fetch through a plain fetch, converted
// to Markdown by env.AI.toMarkdown. Every page read is kept in
// research_sources, so a report's quotations are checked against it.
//
// Prices are the live catalog's (env.AI.models(), /v1/admin/models,
// 2026-11-04), per million tokens. Tool calling was tried on the first two
// through that probe before they were offered here.

import type Anthropic from "@anthropic-ai/sdk";
import type { Env } from "../env";
import type { Message } from "./drafts";
import type { ResearchSource } from "./research";

export type EngineId = string;

export interface Engine {
  id: EngineId;
  label: string;
  /** One line for the choice: what it is and what it costs. */
  note: string;
  /** US dollars per million tokens. */
  price: { input: number; output: number; cacheRead: number; cacheWrite: number };
  /** Who runs it: Cloudflare's Workers AI, or Anthropic (Claude). */
  provider: "workers" | "anthropic";
  /** Anthropic: the model that runs the conversation. */
  model?: string;
  /** Anthropic: a stronger model the conversation consults for planning
   *  (the advisor tool), billed at its own rates for those calls only. */
  advisor?: string;
  /** Workers AI research team (agent.ts runTeam): once the report is laid
   *  out, one `reader` per section searches, reads and notes at the same
   *  time; `writer` runs the conversation and writes from the notes. */
  team?: { reader: EngineId; writer: EngineId };
}

/** Claude Opus 5.5's rates, also what an Opus advisor's calls cost. */
export const OPUS_PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 8 };

export const CLAUDE: EngineId = "claude";
export const DEFAULT_ENGINE: EngineId = "team:flash";

export const ENGINES: Engine[] = [
  {
    // The default, chosen by the engine test (ops/eval/2026-11-07-1920.md):
    // the only engine to pass all four tasks, and the cheapest and fastest —
    // $0.25–0.29 a full report in 14–23 minutes, 0 quotations not found.
    // Each researcher keeps a short conversation, so it costs less than one
    // model reading everything itself.
    id: "team:flash",
    label: "DeepSeek research team",
    note: "Workers AI · V4.1 Flash researchers read every section at once, and Flash writes · about $0.30 a full report",
    price: { input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0.3 },
    provider: "workers",
    team: {
      reader: "@cf/deepseek-ai/deepseek-v4.1-flash-1017",
      writer: "@cf/deepseek-ai/deepseek-v4.1-flash-1017",
    },
  },
  {
    // Sonnet does the reading and writing at half Opus's rates and consults
    // Opus for planning (Anthropic's advisor tool): most of Opus's judgement
    // where it matters, at about half the price.
    id: "claude-sonnet-advised",
    label: "Claude Sonnet 5.5 + Opus advice",
    note: "Anthropic · $2 in / $10 out, with Opus 5.5 planning · about half of Claude Opus",
    price: { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 4 },
    provider: "anthropic",
    model: "claude-sonnet-5-5",
    advisor: "claude-opus-5-5",
  },
  {
    id: CLAUDE,
    label: "Claude Opus 5.5",
    note: "Anthropic · $4 in / $20 out · the strongest, and the most expensive",
    price: OPUS_PRICE,
    provider: "anthropic",
    model: "claude-opus-5-5",
  },
];

/** Models not offered in the workspace: on trial, or retired (a conversation
 *  frozen on one keeps running on it). Reachable through the test probe
 *  (/v1/admin/engine-try) to compare with the offered ones on the same
 *  question. Measured 2026-11-07 on one full-depth question: Kimi K2.7 $1.08
 *  for a thinner report that missed published figures and cited sources in
 *  words; GLM-5.3 Flash $0.28 and unfinished; Qwen 3.8 timed out three
 *  times. Prices from the Workers AI catalog (2026-11). */
export const TRIAL_ENGINES: Engine[] = [
  {
    // Off the menu 2026-11-07: the research team does the same reading
    // faster and cheaper; alone it ran out of time on two of three reports.
    id: "@cf/deepseek-ai/deepseek-v4.1-flash-1017",
    label: "DeepSeek V4.1 Flash",
    note: "Workers AI · $0.30 in / $1.20 out per million tokens · retired from the menu",
    price: { input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0.3 },
    provider: "workers",
  },
  {
    // Off the menu 2026-11-07: careful with figures but slow, and Workers AI
    // timed out on it three times running on a long article (engine test).
    id: "@cf/deepseek-ai/deepseek-v4-pro-0813",
    label: "DeepSeek V4 Pro",
    note: "Workers AI · $1.32 in / $3.96 out · retired from the menu",
    price: { input: 1.32, output: 3.96, cacheRead: 0.044, cacheWrite: 1.32 },
    provider: "workers",
  },
  {
    id: "team:deepseek",
    label: "DeepSeek research team, V4 Pro writing",
    note: "Workers AI · V4.1 Flash researchers read every section at once; V4 Pro writes · on trial",
    // The conversation's own calls are V4 Pro's; each researcher's are
    // counted at Flash's rates (runTeam).
    price: { input: 1.32, output: 3.96, cacheRead: 0.044, cacheWrite: 1.32 },
    provider: "workers",
    team: {
      reader: "@cf/deepseek-ai/deepseek-v4.1-flash-1017",
      writer: "@cf/deepseek-ai/deepseek-v4-pro-0813",
    },
  },
  {
    // Retired from the menu 2026-11-07: $3.17 for the report V4.1 Flash wrote
    // for $0.18. Conversations already on it keep running on it.
    id: "@cf/zai-org/glm-5.3",
    label: "GLM-5.3",
    note: "Workers AI · $1.40 in / $4.40 out · retired",
    price: { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 1.4 },
    provider: "workers",
  },
  {
    id: "@cf/moonshotai/kimi-k2.7-code",
    label: "Kimi K2.7",
    note: "Workers AI · $0.95 in / $4 out · on trial",
    price: { input: 0.95, output: 4, cacheRead: 0.19, cacheWrite: 0.95 },
    provider: "workers",
  },
  {
    id: "@cf/zai-org/glm-5.3-flash",
    label: "GLM-5.3 Flash",
    note: "Workers AI · $0.15 in / $0.50 out · on trial",
    price: { input: 0.15, output: 0.5, cacheRead: 0.03, cacheWrite: 0.15 },
    provider: "workers",
  },
  {
    id: "@cf/qwen/qwen3.8-27b",
    label: "Qwen 3.8 27B",
    note: "Workers AI · $0.45 in / $3.20 out · on trial",
    price: { input: 0.45, output: 3.2, cacheRead: 0.05, cacheWrite: 0.45 },
    provider: "workers",
  },
];

const ALL_ENGINES = [...ENGINES, ...TRIAL_ENGINES];

export const engine = (id: EngineId | undefined | null): Engine =>
  ALL_ENGINES.find((e) => e.id === id) ?? (ENGINES.find((e) => e.id === DEFAULT_ENGINE) as Engine);

export const isWorkersAi = (id: EngineId | undefined | null): boolean =>
  !!id && ALL_ENGINES.some((e) => e.id === id && e.provider === "workers");

/** The advisor tool for an engine that has one (Anthropic's beta
 *  advisor-tool-2026-03-01). Each call's output is capped at 2,048 tokens
 *  (Anthropic measured about a seventh of the uncapped length with no loss),
 *  and the advisor's own transcript is cached across calls. */
export function advisorTool(id: EngineId): Anthropic.Beta.BetaToolUnion | null {
  const e = ENGINES.find((x) => x.id === id);
  if (!e?.advisor) return null;
  return {
    type: "advisor_20260301",
    name: "advisor",
    model: e.advisor,
    max_tokens: 2048,
    caching: { type: "ephemeral", ttl: "1h" },
  } as unknown as Anthropic.Beta.BetaToolUnion;
}

// ---- the default for new conversations: kept in users.preferences ------------

export async function defaultEngine(db: D1Database, userId: string): Promise<EngineId> {
  const row = await db
    .prepare("SELECT preferences FROM users WHERE id = ?")
    .bind(userId)
    .first<{ preferences: string | null }>()
    .catch(() => null);
  try {
    const id = (JSON.parse(row?.preferences || "{}") as { engine?: string }).engine;
    // Only a Cloudflare engine is ever the default: Claude is billed to
    // Anthropic credits, so it runs only when chosen for that conversation.
    return id && ENGINES.some((e) => e.id === id && e.provider === "workers") ? id : DEFAULT_ENGINE;
  } catch {
    return DEFAULT_ENGINE;
  }
}

export async function setDefaultEngine(db: D1Database, userId: string, id: EngineId) {
  if (!ENGINES.some((e) => e.id === id && e.provider === "workers")) return;
  await db
    .prepare(
      "UPDATE users SET preferences = json_set(COALESCE(preferences, '{}'), '$.engine', ?) WHERE id = ?",
    )
    .bind(id, userId)
    .run();
}

// ---- the web, for an engine without Anthropic's server tools -----------------

export const SEARCH_TOOL: Anthropic.Beta.BetaToolUnion = {
  name: "web_search",
  description:
    "Search the web. Returns up to 8 results: title, address and a short description. Read the ones worth reading in full with web_fetch.",
  input_schema: {
    type: "object",
    properties: { query: { type: "string", description: "What to search for" } },
    required: ["query"],
  },
};

/** Characters of a page handed to the model per read; the rest by offset. */
export const PAGE_CHARS = 40_000;

export const FETCH_TOOL: Anthropic.Beta.BetaToolUnion = {
  name: "web_fetch",
  description: `Read a web page or PDF in full, as text. Gives ${PAGE_CHARS.toLocaleString("en")} characters at a time; when a page is longer, the result says so and gives the offset to read on from. Every page read is kept, and quotations in the report are checked against it.`,
  input_schema: {
    type: "object",
    properties: {
      url: { type: "string", description: "The full address, https://…" },
      offset: { type: "number", description: "Character to start from (default 0)" },
    },
    required: ["url"],
  },
};

export interface SearchHit {
  title: string;
  url: string;
  description: string;
}

/** Cloudflare's Web Search first (billed on the Cloudflare account, no key),
 *  Brave when that is not set up or fails. */
export async function webSearch(env: Env, query: string): Promise<SearchHit[]> {
  // Cloudflare only, billed to the Cloudflare account. Brave is gone
  // (2026-11-07): the gateway had never been created, so every search had
  // fallen through to Brave and run up its bill.
  const ai = env.AI as unknown as { websearch?: (i: Record<string, unknown>) => Promise<unknown> };
  if (!env.SEARCH_GATEWAY_ID || !ai.websearch)
    throw new Error(
      "Web search is not set up: the AI Gateway named in SEARCH_GATEWAY_ID has to exist (run the “Create the search gateway” workflow, or Cloudflare dashboard → AI → AI Gateway).",
    );
  try {
    return await cloudflareSearch(ai.websearch, env, query);
  } catch (err) {
    throw new Error(`Cloudflare's Web Search: ${(err as Error).message}`);
  }
}

/** Cloudflare's Web Search (beta since 2026-10-02, through an AI Gateway).
 *  The answer's shape is read defensively: a list under items or results
 *  (or result.items), each with a url, a title and a snippet. */
export async function cloudflareSearch(
  websearch: (i: Record<string, unknown>) => Promise<unknown>,
  env: Env,
  query: string,
): Promise<SearchHit[]> {
  const r = await websearch({
    query,
    limit: 8,
    gatewayId: env.SEARCH_GATEWAY_ID,
    ...(env.SEARCH_PROVIDER ? { provider: env.SEARCH_PROVIDER } : {}),
  });
  if (r instanceof Response && !r.ok)
    throw new Error(`answered ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const body = (r instanceof Response ? await r.json() : r) as Record<string, unknown>;
  const inner = (body.result ?? {}) as Record<string, unknown>;
  const list = (body.items ?? body.results ?? inner.items ?? inner.results ?? []) as Array<
    Record<string, unknown>
  >;
  return list
    .map((i) => ({
      title: entities(String(i.title ?? "")),
      url: String(i.url ?? i.link ?? ""),
      description: entities(
        String(i.snippet ?? i.description ?? i.summary ?? i.text ?? i.content ?? ""),
      ).slice(0, 400),
    }))
    .filter((i) => i.url);
}

interface ToMarkdownAi {
  toMarkdown(
    files: Array<{ name: string; blob: Blob }>,
  ): Promise<Array<{ format: "markdown"; data: string } | { format: "error"; error: string }>>;
}

/** A page as text: PDFs and HTML through Cloudflare's converter, plain text
 *  as it is. Null when nothing readable came back. */
export async function readPage(env: Env, url: string): Promise<ResearchSource | null> {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; CanopticonResearch/1.0; +https://canopticon.com/about)",
      accept: "text/html,application/pdf,text/plain;q=0.9,*/*;q=0.5",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`the page answered ${res.status}`);
  const type = (res.headers.get("content-type") ?? "").toLowerCase();
  // A page too large to read whole is refused rather than read into memory.
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_PAGE_BYTES)
    throw new Error(`the page is ${Math.round(declared / 1e6)} MB, too large to read`);
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > MAX_PAGE_BYTES)
    throw new Error(`the page is ${Math.round(bytes.byteLength / 1e6)} MB, too large to read`);
  const pdf = type.includes("pdf") || /\.pdf($|\?)/i.test(url);
  let text: string | null = null;
  const ai = env.AI as unknown as Partial<ToMarkdownAi>;
  if (pdf || type.includes("html")) {
    if (typeof ai.toMarkdown === "function") {
      // HTML goes to the converter without its scripts, styles and drawings
      // (a large page took 16 s whole), and the converter gets 15 s before
      // the plain-text reading below is used instead.
      const body = pdf
        ? new Blob([bytes], { type: "application/pdf" })
        : new Blob([stripHeavy(new TextDecoder().decode(bytes))], { type: "text/html" });
      const out = await Promise.race([
        ai.toMarkdown([{ name: pdf ? "page.pdf" : "page.html", blob: body }]).catch(() => []),
        new Promise<[]>((r) => setTimeout(() => r([]), 15_000)),
      ]);
      const first = out[0];
      text = first && first.format === "markdown" ? first.data : null;
    }
    if (!text && !pdf) text = htmlText(new TextDecoder().decode(bytes));
  } else {
    text = new TextDecoder().decode(bytes);
  }
  // The front matter's title, then the text as a reader sees it.
  const front = /^---\n([\s\S]*?)\n---\n/.exec(text ?? "");
  const fmTitle = front ? /^title:\s*(.+)$/m.exec(front[1] ?? "")?.[1]?.trim() : undefined;
  text = readable(text ?? "");
  if (text.length < 200) return null;
  const title = fmTitle ?? /^#\s+(.+)$/m.exec(text)?.[1]?.trim() ?? null;
  return {
    url: res.url || url,
    title,
    retrievedAt: new Date().toISOString(),
    kind: pdf ? "pdf" : "text",
    text,
  };
}

/** Markdown from a converted page as a reader sees it: links as their words,
 *  no images, no front matter, entities decoded. A page converted whole was
 *  mostly link addresses (Wikipedia's Hamilton, Ontario: 634,656 characters),
 *  which spent the model's reading on URLs. What is kept is what the model
 *  reads and what quotations are checked against. */
export function readable(md: string): string {
  return entities(
    md
      .replace(/^---\n[\s\S]*?\n---\n/, "")
      .replace(/!\[[^\]]*\]\((?:[^()\s]|\([^)]*\))*(?:\s+"[^"]*")?\)/g, "")
      .replace(/\[([^\]]*)\]\((?:[^()\s]|\([^)]*\))*(?:\s+"[^"]*")?\)/g, "$1")
      .replace(/^\s*\[[^\]]*\]:\s*\S+.*$/gm, "")
      .replace(/[ \t]+$/gm, "")
      .replace(/\n{3,}/g, "\n\n"),
  ).trim();
}

/** The common HTML entities, decoded. */
export function entities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Pages larger than this are not read (a PDF of a whole book, a data dump). */
export const MAX_PAGE_BYTES = 15_000_000;

/** HTML without what a reader never sees: scripts, styles, drawings,
 *  templates, comments. */
export function stripHeavy(html: string): string {
  return html
    .replace(/<(script|style|svg|noscript|template|iframe)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

/** HTML to plain text, for when the converter is not there. */
export function htmlText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

// ---- the conversation, in the OpenAI chat format Workers AI takes ------------

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

const text = (c: unknown): string =>
  typeof c === "string"
    ? c
    : Array.isArray(c)
      ? c
          .map((b: { type?: string; text?: string }) => (b.type === "text" ? (b.text ?? "") : ""))
          .join("")
      : "";

/** The stored conversation as chat messages: text stays text, tool calls and
 *  results pair by id, reasoning is left out (each model reasons afresh). */
/** Past this many characters a conversation sheds its older page reads, in
 *  batches of eight (keeping the latest eight), so the cut moves rarely and
 *  the model's own prompt cache keeps hitting. The pages stay kept: reading
 *  one again comes from what was kept, free. */
export const CHAT_CLEAR_CHARS = 800_000;
const CLEARED =
  "[Cleared to keep the conversation short. The page is kept: web_fetch the same address to read it again — it costs nothing.]";

export function toChat(
  system: string,
  history: Message[],
  clearAt = CHAT_CLEAR_CHARS,
): ChatMessage[] {
  const out = toChatWhole(system, history);
  const size = out.reduce((n, m) => n + (m.content?.length ?? 0), 0);
  if (size <= clearAt) return out;
  const fetchCalls = new Set<string>();
  for (const m of out)
    for (const c of m.tool_calls ?? []) if (c.function.name === "web_fetch") fetchCalls.add(c.id);
  const reads = out.filter((m) => m.role === "tool" && fetchCalls.has(m.tool_call_id ?? ""));
  const clear = Math.floor(Math.max(0, reads.length - 8) / 8) * 8;
  for (const m of reads.slice(0, clear)) m.content = CLEARED;
  return out;
}

function toChatWhole(system: string, history: Message[]): ChatMessage[] {
  const out: ChatMessage[] = [{ role: "system", content: system }];
  for (const m of history) {
    const blocks = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content;
    if (m.role === "assistant") {
      const said = blocks
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("");
      const calls = blocks
        .filter((b) => b.type === "tool_use")
        .map((b) => {
          const u = b as { id: string; name: string; input: unknown };
          return {
            id: u.id,
            type: "function" as const,
            function: { name: u.name, arguments: JSON.stringify(u.input ?? {}) },
          };
        });
      if (!said && !calls.length) continue;
      out.push({
        role: "assistant",
        content: said || null,
        ...(calls.length ? { tool_calls: calls } : {}),
      });
      continue;
    }
    // A user message: tool results first (they answer the calls just made),
    // then anything said.
    for (const b of blocks) {
      if (b.type !== "tool_result") continue;
      const r = b as { tool_use_id: string; content?: unknown; is_error?: boolean };
      out.push({
        role: "tool",
        tool_call_id: r.tool_use_id,
        content: `${r.is_error ? "Error: " : ""}${text(r.content)}`,
      });
    }
    const said = blocks
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n\n");
    if (said) out.push({ role: "user", content: said });
  }
  return out;
}

/** Anthropic tool definitions as chat functions; server tools are left out. */
export function toFunctions(tools: Anthropic.Beta.BetaToolUnion[]) {
  return tools
    .filter((t) => "input_schema" in t)
    .map((t) => {
      const c = t as { name: string; description?: string; input_schema: unknown };
      return {
        type: "function" as const,
        function: { name: c.name, description: c.description ?? "", parameters: c.input_schema },
      };
    });
}

interface ChatReply {
  choices?: Array<{
    message?: {
      content?: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{
        id?: string;
        function?: { name?: string; arguments?: string | object };
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
  // Older Workers AI shape.
  response?: string;
  tool_calls?: Array<{ name?: string; arguments?: string | object }>;
}

/** A reply as an Anthropic-shaped message, so the loop runs unchanged. */
export function fromChat(reply: ChatReply, model: string): Anthropic.Beta.BetaMessage {
  const choice = reply.choices?.[0];
  const said = choice?.message?.content ?? reply.response ?? "";
  const calls =
    choice?.message?.tool_calls ??
    (reply.tool_calls ?? []).map((c, i) => ({ id: `call_${Date.now()}_${i}`, function: c }));
  const content: Array<Record<string, unknown>> = [];
  if (said?.trim()) content.push({ type: "text", text: said, citations: null });
  calls.forEach((c, i) => {
    const raw = c.function?.arguments ?? {};
    let input: unknown;
    try {
      input = typeof raw === "string" ? JSON.parse(raw || "{}") : raw;
    } catch {
      input = { _unreadable: String(raw).slice(0, 500) };
    }
    content.push({
      type: "tool_use",
      id: c.id || `call_${Date.now()}_${i}`,
      name: c.function?.name ?? "",
      input,
    });
  });
  const finish = choice?.finish_reason ?? "";
  const cached = reply.usage?.prompt_tokens_details?.cached_tokens ?? 0;
  return {
    id: `wai_${Date.now()}`,
    type: "message",
    role: "assistant",
    model,
    content,
    // Cut off is cut off, tool calls or not: a call whose arguments ran out
    // must not be run as if it were whole.
    stop_reason: finish === "length" ? "max_tokens" : calls.length ? "tool_use" : "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: Math.max(0, (reply.usage?.prompt_tokens ?? 0) - cached),
      output_tokens: reply.usage?.completion_tokens ?? 0,
      cache_read_input_tokens: cached,
      cache_creation_input_tokens: 0,
    },
  } as unknown as Anthropic.Beta.BetaMessage;
}

/** Output allowance per call. A long report is one write; a model that will
 *  not take this much is asked again with less. */
const MAX_OUT = 32_768;

/** One step on a Workers AI model: the conversation in, one reply out. */
/** Waits before asking again after Workers AI's per-minute limit (3021). */
export const RETRY_WAITS = [10_000, 20_000, 30_000, 45_000, 60_000, 60_000];
let sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** How many requests to one model run at once, per isolate (one turn's
 *  researchers, reviewers and writer share it). Halved when Workers AI says
 *  the per-minute limit is reached, widened by one after every four answers,
 *  between 1 and GATE_MAX. Live, six Flash researchers at once hit the limit,
 *  ran out of retries after ~105 s, and about half of every team's
 *  researchers stopped with no notes. */
export const GATE_MAX = 6;
const START = 3;
class Gate {
  limit = START;
  active = 0;
  private ok = 0;
  private waiting: Array<() => void> = [];
  async enter() {
    while (this.active >= this.limit) await new Promise<void>((r) => this.waiting.push(r));
    this.active++;
  }
  leave() {
    this.active--;
    this.wake();
  }
  busy() {
    this.limit = Math.max(1, Math.floor(this.limit / 2));
    this.ok = 0;
  }
  fine() {
    if (++this.ok >= 4 && this.limit < GATE_MAX) {
      this.limit++;
      this.ok = 0;
      this.wake();
    }
  }
  private wake() {
    for (const w of this.waiting.splice(0)) w();
  }
}
const gates = new Map<string, Gate>();
export function gate(model: string): Gate {
  let g = gates.get(model);
  if (!g) gates.set(model, (g = new Gate()));
  return g;
}
/** Tests: no real waiting. */
export function setSleep(f: (ms: number) => Promise<void>) {
  sleep = f;
}

export async function workersStep(
  env: Env,
  model: string,
  system: string,
  tools: Anthropic.Beta.BetaToolUnion[],
  history: Message[],
  clearAt?: number,
  session?: string,
): Promise<Anthropic.Beta.BetaMessage> {
  const ai = env.AI as unknown as {
    run: (m: string, i: unknown, o?: unknown) => Promise<unknown>;
  };
  const input = { messages: toChat(system, history, clearAt), tools: toFunctions(tools) };
  // Workers AI reuses a cached prefix only on the instance that holds it:
  // one conversation, one instance (x-session-affinity). Without it nearly
  // every step was billed as fresh input.
  const opts = session ? { headers: { "x-session-affinity": `ses_${session}` } } : undefined;
  let reply: unknown;
  // Cloudflare's per-minute request limit (3021) and its request timeout
  // (3046) pass: wait and ask again. Live, four runs at once on V4.1 Flash
  // hit the limit and ended their turns with the report half written.
  const g = gate(model);
  const once = async (max: number) => {
    for (let attempt = 0; ; attempt++) {
      let wait = 0;
      await g.enter();
      try {
        const r = await ai.run(model, { ...input, max_tokens: max }, opts);
        g.fine();
        return r;
      } catch (err) {
        const busy = /\b3021\b|rate limit/i.test(String(err));
        const slow = /\b3046\b|request timeout/i.test(String(err));
        if (busy) g.busy();
        if (!(busy && attempt < RETRY_WAITS.length) && !(slow && attempt < 1)) throw err;
        wait = busy ? (RETRY_WAITS[attempt] ?? 60_000) + Math.random() * 5_000 : 2_000;
      } finally {
        g.leave();
      }
      await sleep(wait);
    }
  };
  try {
    reply = await once(MAX_OUT);
  } catch (err) {
    // Only an output allowance the model will not take is retried with less;
    // a conversation too long for the model is not (it would fail again).
    if (
      !/max_tokens|max tokens/i.test(String(err)) ||
      /context|prompt is too long/i.test(String(err))
    )
      throw err;
    reply = await once(8192);
  }
  return fromChat(reply as ChatReply, model);
}

/** The engine a conversation runs on: frozen in its frame after the first
 *  turn (absent there means Claude), else the one it was started with, else
 *  the default. */
export function draftEngine(
  d: { frame?: string | undefined; meta: { engine?: string | undefined } },
  fallback: EngineId,
): EngineId {
  if (d.frame) {
    try {
      return (JSON.parse(d.frame) as { engine?: string }).engine ?? CLAUDE;
    } catch {
      return CLAUDE;
    }
  }
  return d.meta.engine ?? fallback;
}

/** The Workers AI model a conversation's own calls go to: a team's writer,
 *  else the engine itself. */
export function workersModel(id: EngineId): string {
  return engine(id).team?.writer ?? id;
}

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
// SEARCH_GATEWAY_ID), else Brave (BRAVE_SEARCH_API_KEY); web_fetch through a plain fetch, converted
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
}

/** Claude Opus 5.5's rates, also what an Opus advisor's calls cost. */
export const OPUS_PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };

export const CLAUDE: EngineId = "claude";
export const DEFAULT_ENGINE: EngineId = "@cf/deepseek-ai/deepseek-v4.1-flash-1017";

export const ENGINES: Engine[] = [
  {
    id: "@cf/deepseek-ai/deepseek-v4.1-flash-1017",
    label: "DeepSeek V4.1 Flash",
    note: "Workers AI · $0.30 in / $1.20 out per million tokens · about a fifteenth of Claude",
    price: { input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0.3 },
    provider: "workers",
  },
  {
    id: "@cf/zai-org/glm-5.3",
    label: "GLM-5.3",
    note: "Workers AI · $1.40 in / $4.40 out · stronger writing, about a quarter of Claude",
    price: { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 1.4 },
    provider: "workers",
  },
  {
    // Sonnet does the reading and writing at half Opus's rates and consults
    // Opus for planning (Anthropic's advisor tool): most of Opus's judgement
    // where it matters, at about half the price.
    id: "claude-sonnet-advised",
    label: "Claude Sonnet 5.5 + Opus advice",
    note: "Anthropic · $2 in / $10 out, with Opus 5.5 planning · about half of Claude Opus",
    price: { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
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

export const engine = (id: EngineId | undefined | null): Engine =>
  ENGINES.find((e) => e.id === id) ?? (ENGINES.find((e) => e.id === DEFAULT_ENGINE) as Engine);

export const isWorkersAi = (id: EngineId | undefined | null): boolean =>
  !!id && ENGINES.some((e) => e.id === id && e.provider === "workers");

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
    caching: { type: "ephemeral", ttl: "5m" },
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
    return id && ENGINES.some((e) => e.id === id) ? id : DEFAULT_ENGINE;
  } catch {
    return DEFAULT_ENGINE;
  }
}

export async function setDefaultEngine(db: D1Database, userId: string, id: EngineId) {
  if (!ENGINES.some((e) => e.id === id)) return;
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
  const ai = env.AI as unknown as { websearch?: (i: Record<string, unknown>) => Promise<unknown> };
  let cloudflareError: string | null = null;
  if (env.SEARCH_GATEWAY_ID && ai.websearch) {
    try {
      return await cloudflareSearch(ai.websearch, env, query);
    } catch (err) {
      cloudflareError = (err as Error).message;
      if (!env.BRAVE_SEARCH_API_KEY) throw new Error(`Cloudflare's Web Search: ${cloudflareError}`);
    }
  }
  if (env.BRAVE_SEARCH_API_KEY) return braveSearch(env.BRAVE_SEARCH_API_KEY, query);
  throw new Error(
    "No web search is set up: create the AI Gateway named in SEARCH_GATEWAY_ID (Cloudflare dashboard → AI → AI Gateway), or add BRAVE_SEARCH_API_KEY.",
  );
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

async function braveSearch(key: string, query: string): Promise<SearchHit[]> {
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8`,
    {
      headers: { Accept: "application/json", "X-Subscription-Token": key },
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!res.ok) throw new Error(`the search service answered ${res.status}`);
  const json = (await res.json()) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };
  return (json.web?.results ?? [])
    .map((r) => ({
      title: entities((r.title ?? "").replace(/<[^>]+>/g, "")),
      url: r.url ?? "",
      description: entities((r.description ?? "").replace(/<[^>]+>/g, "")),
    }))
    .filter((r) => r.url);
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
  const bytes = await res.arrayBuffer();
  const pdf = type.includes("pdf") || /\.pdf($|\?)/i.test(url);
  let text: string | null = null;
  const ai = env.AI as unknown as Partial<ToMarkdownAi>;
  if (pdf || type.includes("html")) {
    if (typeof ai.toMarkdown === "function") {
      const out = await ai
        .toMarkdown([
          {
            name: pdf ? "page.pdf" : "page.html",
            blob: new Blob([bytes], { type: pdf ? "application/pdf" : "text/html" }),
          },
        ])
        .catch(() => []);
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
export function toChat(system: string, history: Message[]): ChatMessage[] {
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
    stop_reason: calls.length ? "tool_use" : finish === "length" ? "max_tokens" : "end_turn",
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
export async function workersStep(
  env: Env,
  model: string,
  system: string,
  tools: Anthropic.Beta.BetaToolUnion[],
  history: Message[],
): Promise<Anthropic.Beta.BetaMessage> {
  const ai = env.AI as unknown as { run: (m: string, i: unknown) => Promise<unknown> };
  const input = { messages: toChat(system, history), tools: toFunctions(tools) };
  let reply: unknown;
  try {
    reply = await ai.run(model, { ...input, max_tokens: MAX_OUT });
  } catch (err) {
    if (!/max_tokens|max tokens|too large|exceed/i.test(String(err))) throw err;
    reply = await ai.run(model, { ...input, max_tokens: 8192 });
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

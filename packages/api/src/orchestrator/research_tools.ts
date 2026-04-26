// Custom tools the research agent can call.
//
// Server-managed tools (web_search_20250305, web_fetch_20250819) are handled
// by Anthropic — they execute on Anthropic's side and the results stream back
// in subsequent assistant messages. We don't implement those here.
//
// What we do implement: the substrate-write and substrate-read tools. Each
// tool runs against the user's substrate using the service-role client
// (bypasses RLS so the agent can write rows the user owns) and validates
// inputs with Zod before touching the DB.

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const REGISTER_SOURCE_INPUT = z.object({
  url: z.string().url().optional(),
  title: z.string().min(1).max(500),
  raw_text: z.string().min(1),
  source_type: z
    .enum(["news", "social", "video", "book", "filing", "report", "other"])
    .default("other"),
  publication: z.string().optional(),
  author: z.string().optional(),
  published_at: z.string().datetime().optional(),
  suggested_grade: z.enum(["A", "B", "C", "D", "E", "F"]).default("B"),
  reason: z.string().min(1).max(500).describe("why this source is relevant to the topic"),
});

const QUERY_SUBSTRATE_INPUT = z.object({
  filter: z.enum(["my_recent_sources", "my_recent_claims", "entities_by_name"]),
  query: z.string().optional().describe("substring to match (entities_by_name only)"),
  limit: z.number().int().min(1).max(50).default(20),
});

const MARK_DONE_INPUT = z.object({
  summary: z
    .string()
    .min(1)
    .max(2000)
    .describe("one-paragraph summary of what the research run accomplished"),
});

export const RESEARCH_TOOL_DEFINITIONS = [
  {
    type: "web_search_20250305" as const,
    name: "web_search" as const,
    max_uses: 8,
  },
  {
    type: "web_fetch_20250819" as const,
    name: "web_fetch" as const,
    max_uses: 12,
  },
  {
    name: "register_source",
    description:
      "Register a new source into the operator's substrate. The source enters in pending_critic state — the Critic will grade it on the next cascade. Use after web_fetch returns content worth keeping. Do NOT register opinion pieces, navigation pages, or content already represented by an existing source (use query_substrate first to check). Returns the new source id.",
    input_schema: {
      type: "object",
      required: ["title", "raw_text", "reason"],
      properties: {
        url: { type: "string", description: "canonical URL the content was fetched from" },
        title: { type: "string", description: "concise human-readable title" },
        raw_text: {
          type: "string",
          description: "the source body; copy verbatim from web_fetch output, do not paraphrase",
        },
        source_type: {
          type: "string",
          enum: ["news", "social", "video", "book", "filing", "report", "other"],
        },
        publication: { type: "string" },
        author: { type: "string" },
        published_at: { type: "string", description: "ISO 8601 timestamp" },
        suggested_grade: {
          type: "string",
          enum: ["A", "B", "C", "D", "E", "F"],
          description: "your initial Admiralty grade; the Critic may adjust",
        },
        reason: {
          type: "string",
          description: "one sentence: why this source is relevant to the topic",
        },
      },
    },
  },
  {
    name: "query_substrate",
    description:
      "Read the operator's substrate to avoid duplicate work. Use before registering a source to check whether the URL or topic is already covered. Returns up to `limit` rows.",
    input_schema: {
      type: "object",
      required: ["filter"],
      properties: {
        filter: {
          type: "string",
          enum: ["my_recent_sources", "my_recent_claims", "entities_by_name"],
          description:
            "my_recent_sources returns the operator's most recently retrieved sources; my_recent_claims returns recent claims; entities_by_name returns entities whose canonical_name or aliases match `query`",
        },
        query: {
          type: "string",
          description: "substring (only used when filter=entities_by_name)",
        },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
      },
    },
  },
  {
    name: "mark_done",
    description:
      "Signal that the research mission is complete. Provide a one-paragraph summary of what was accomplished (sources registered, claims to expect, gaps that remain). After calling this, do not call other tools — just stop.",
    input_schema: {
      type: "object",
      required: ["summary"],
      properties: {
        summary: { type: "string", minLength: 1, maxLength: 2000 },
      },
    },
  },
];

export interface ResearchToolContext {
  service: SupabaseClient;
  user_id: string;
  thesis_id: string | null;
  research_run_id: string;
}

export interface ToolExecutionResult {
  /** The string content posted back to Anthropic as tool_result. */
  content: string;
  /** Metadata for the orchestrator's own bookkeeping (source counts, etc.). */
  meta: {
    is_error: boolean;
    source_id?: string;
    done?: { summary: string };
  };
}

/** Dispatch a custom tool call. Returns a content string for the
    tool_result block; the agent loop handles the messaging. */
export async function executeResearchTool(
  ctx: ResearchToolContext,
  name: string,
  input: Record<string, unknown>,
): Promise<ToolExecutionResult> {
  try {
    if (name === "register_source") {
      return await registerSource(ctx, input);
    }
    if (name === "query_substrate") {
      return await querySubstrate(ctx, input);
    }
    if (name === "mark_done") {
      return await markDone(ctx, input);
    }
    return {
      content: `error: unknown tool '${name}'`,
      meta: { is_error: true },
    };
  } catch (err) {
    return {
      content: `error: ${(err as Error).message}`,
      meta: { is_error: true },
    };
  }
}

async function registerSource(
  ctx: ResearchToolContext,
  rawInput: Record<string, unknown>,
): Promise<ToolExecutionResult> {
  const parsed = REGISTER_SOURCE_INPUT.safeParse(rawInput);
  if (!parsed.success) {
    return {
      content: `error: invalid input — ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      meta: { is_error: true },
    };
  }
  const input = parsed.data;

  // URL dedup against this user's existing sources.
  if (input.url) {
    const { data: existing } = await ctx.service
      .from("sources")
      .select("id, title, ingestion_state")
      .eq("user_id", ctx.user_id)
      .eq("url", input.url)
      .maybeSingle();
    if (existing) {
      return {
        content: JSON.stringify({
          status: "duplicate",
          existing_source_id: existing.id,
          existing_title: existing.title,
          existing_state: existing.ingestion_state,
          message:
            "this URL is already in the substrate; do not re-register. Pick a different source or call mark_done.",
        }),
        meta: { is_error: false },
      };
    }
  }

  const { data, error } = await ctx.service
    .from("sources")
    .insert({
      user_id: ctx.user_id,
      source_type: input.source_type,
      title: input.title,
      url: input.url ?? null,
      publication: input.publication ?? null,
      author: input.author ?? null,
      published_at: input.published_at ?? null,
      raw_text: input.raw_text,
      admiralty_grade: input.suggested_grade,
      ingestion_mode: "operator",
      ingestion_state: "pending_critic",
      metadata: {
        registered_by: "research_agent",
        research_run_id: ctx.research_run_id,
        agent_reason: input.reason,
      },
    })
    .select("id, title, ingestion_state")
    .single();

  if (error) throw new Error(`register_source failed: ${error.message}`);

  return {
    content: JSON.stringify({
      status: "registered",
      source_id: data.id,
      title: data.title,
      ingestion_state: data.ingestion_state,
      message:
        "registered. The Ingestion Critic will grade this source on the next cascade run; you don't need to do anything else with it.",
    }),
    meta: { is_error: false, source_id: data.id as string },
  };
}

async function querySubstrate(
  ctx: ResearchToolContext,
  rawInput: Record<string, unknown>,
): Promise<ToolExecutionResult> {
  const parsed = QUERY_SUBSTRATE_INPUT.safeParse(rawInput);
  if (!parsed.success) {
    return {
      content: `error: invalid input — ${parsed.error.issues.map((i) => i.message).join("; ")}`,
      meta: { is_error: true },
    };
  }
  const { filter, query, limit } = parsed.data;

  if (filter === "my_recent_sources") {
    const { data, error } = await ctx.service
      .from("sources")
      .select("id, title, url, source_type, admiralty_grade, ingestion_state, retrieved_at")
      .eq("user_id", ctx.user_id)
      .order("retrieved_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`query_substrate failed: ${error.message}`);
    return { content: JSON.stringify({ rows: data ?? [] }), meta: { is_error: false } };
  }

  if (filter === "my_recent_claims") {
    const { data, error } = await ctx.service
      .from("claims")
      .select("id, layer, admiralty_grade, verification_status, created_at")
      .eq("user_id", ctx.user_id)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`query_substrate failed: ${error.message}`);
    return { content: JSON.stringify({ rows: data ?? [] }), meta: { is_error: false } };
  }

  // entities_by_name
  if (!query) {
    return {
      content: "error: query is required when filter=entities_by_name",
      meta: { is_error: true },
    };
  }
  const { data, error } = await ctx.service
    .from("entities")
    .select("id, entity_type, canonical_name, display_name, aliases")
    .eq("user_id", ctx.user_id)
    .ilike("canonical_name", `%${query}%`)
    .limit(limit);
  if (error) throw new Error(`query_substrate failed: ${error.message}`);
  return { content: JSON.stringify({ rows: data ?? [] }), meta: { is_error: false } };
}

async function markDone(
  _ctx: ResearchToolContext,
  rawInput: Record<string, unknown>,
): Promise<ToolExecutionResult> {
  const parsed = MARK_DONE_INPUT.safeParse(rawInput);
  if (!parsed.success) {
    return {
      content: `error: invalid input — ${parsed.error.issues.map((i) => i.message).join("; ")}`,
      meta: { is_error: true },
    };
  }
  return {
    content: JSON.stringify({ status: "acknowledged", summary: parsed.data.summary }),
    meta: { is_error: false, done: { summary: parsed.data.summary } },
  };
}

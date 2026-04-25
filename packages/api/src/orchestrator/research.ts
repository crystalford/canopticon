// runResearch — the AI research loop.
//
// Operator submits a topic. The agent runs Claude with tool use:
//   - web_search (server-managed) to find candidate sources
//   - web_fetch  (server-managed) to pull promising results
//   - query_substrate (custom) to avoid re-registering known sources
//   - register_source (custom) to write a sources row in pending_critic state
//   - mark_done (custom) to signal completion
//
// The Critic, Verifier, and Interrogator are NOT in this loop — they run
// in the cascade triggered after sources are registered. Keeping them
// separate means the agent's job is bounded ("find and register relevant
// sources") rather than open-ended ("populate the entire graph"), which is
// easier to reason about, easier to budget, and easier to interrupt.
//
// Cost discipline: every iteration's API call passes through the cost gate
// and charges cost_ledger. The research_run.total_cost_cents tracks the
// running tally; once it crosses budget_cents, the loop terminates with
// status='completed' and a "budget exhausted" output_summary.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type AnthropicCallOutput,
  type AnthropicClient,
  type AnthropicMessage,
  actualCostCents,
  estimateCostCents,
} from "../lib/anthropic.ts";
import { type CostGateContext, approvePaidOperation, chargeLedger } from "./cost_gate.ts";
import {
  RESEARCH_TOOL_DEFINITIONS,
  type ResearchToolContext,
  executeResearchTool,
} from "./research_tools.ts";

const DEFAULT_MODEL = "claude-opus-4-7";
const DEFAULT_MAX_ITERATIONS = 10;
const DEFAULT_BUDGET_CENTS = 500; // $5 per research run unless overridden
const MAX_TOKENS_PER_TURN = 4096;

export interface RunResearchInput {
  user_id: string;
  topic: string;
  thesis_id?: string | null;
  budget_cents?: number;
  max_iterations?: number;
  /** Override the default model. */
  model?: string;
}

export interface RunResearchResult {
  research_run_id: string;
  status: "completed" | "failed" | "cancelled";
  iterations: number;
  sources_registered: number;
  total_cost_cents: number;
  done_summary: string | null;
  errors: string[];
}

export interface ResearchContext {
  service: SupabaseClient;
  anthropic: AnthropicClient;
}

export async function runResearch(
  ctx: ResearchContext,
  input: RunResearchInput,
): Promise<RunResearchResult> {
  const model = input.model ?? DEFAULT_MODEL;
  const max_iterations = Math.max(1, input.max_iterations ?? DEFAULT_MAX_ITERATIONS);
  const budget_cents = Math.max(1, input.budget_cents ?? DEFAULT_BUDGET_CENTS);

  const research_run_id = await openRun(ctx.service, {
    user_id: input.user_id,
    topic: input.topic,
    thesis_id: input.thesis_id ?? null,
    budget_cents,
    max_iterations,
  });

  const result: RunResearchResult = {
    research_run_id,
    status: "completed",
    iterations: 0,
    sources_registered: 0,
    total_cost_cents: 0,
    done_summary: null,
    errors: [],
  };

  const toolCtx: ResearchToolContext = {
    service: ctx.service,
    user_id: input.user_id,
    thesis_id: input.thesis_id ?? null,
    research_run_id,
  };

  const messages: AnthropicMessage[] = [
    { role: "user", content: openingPrompt(input.topic, input.thesis_id ?? null) },
  ];

  try {
    while (result.iterations < max_iterations) {
      result.iterations++;

      // Cost gate before each turn.
      const estimated = estimateCostCents(model, 6000, 1500);
      if (result.total_cost_cents + estimated.cents > budget_cents) {
        result.done_summary = `budget exhausted before iteration ${result.iterations} (estimated ${estimated.cents}¢ would push run past ${budget_cents}¢ budget)`;
        break;
      }

      const decision = await approvePaidOperation(
        { service: ctx.service } satisfies CostGateContext,
        {
          user_id: input.user_id,
          operation_type: "anthropic_call",
          estimate_cents: estimated.cents,
          provider: "anthropic",
          model_or_sku: model,
          metadata: {
            research_run_id,
            iteration: result.iterations,
          },
        },
      );

      if (!decision.approved) {
        result.errors.push(
          `iteration ${result.iterations}: cost gate denied — ${decision.message}`,
        );
        result.status = "failed";
        break;
      }

      let output: AnthropicCallOutput;
      try {
        output = await ctx.anthropic.call({
          model,
          system: SYSTEM_PROMPT,
          messages,
          max_tokens: MAX_TOKENS_PER_TURN,
          tools: RESEARCH_TOOL_DEFINITIONS,
          temperature: 0.3,
        });
      } catch (err) {
        result.errors.push(
          `iteration ${result.iterations}: Anthropic call failed — ${(err as Error).message}`,
        );
        result.status = "failed";
        break;
      }

      const turnCost = actualCostCents(
        model,
        output.usage.input_tokens,
        output.usage.output_tokens,
      );
      result.total_cost_cents += turnCost;

      await chargeLedger(
        { service: ctx.service },
        {
          user_id: input.user_id,
          operation_type: "anthropic_call",
          provider: "anthropic",
          model_or_sku: model,
          cost_cents: turnCost,
          metadata: {
            research_run_id,
            iteration: result.iterations,
            stop_reason: output.stop_reason,
            tokens_input: output.usage.input_tokens,
            tokens_output: output.usage.output_tokens,
          },
          approved_by_operator: decision.reason !== "whitelisted",
        },
      );

      // Append the assistant turn.
      messages.push({ role: "assistant", content: output.content });

      // If the model didn't request tools, the conversation is over.
      if (output.tool_uses.length === 0) {
        if (output.stop_reason === "end_turn" && !result.done_summary) {
          result.done_summary = output.text || "agent ended turn without calling mark_done";
        }
        break;
      }

      // Execute each custom tool call. Server-managed tools (web_search,
      // web_fetch) are NOT in tool_uses — Anthropic handles those.
      const toolResults: Exclude<AnthropicMessage["content"], string> = [];
      let doneSummary: string | null = null;

      for (const toolUse of output.tool_uses) {
        const exec = await executeResearchTool(toolCtx, toolUse.name, toolUse.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: exec.content,
          is_error: exec.meta.is_error,
        });
        if (exec.meta.source_id) result.sources_registered++;
        if (exec.meta.done) doneSummary = exec.meta.done.summary;
      }

      messages.push({ role: "user", content: toolResults });

      if (doneSummary) {
        result.done_summary = doneSummary;
        break;
      }
    }

    if (result.iterations >= max_iterations && !result.done_summary) {
      result.done_summary = `reached max_iterations (${max_iterations}) without mark_done`;
    }
  } catch (err) {
    result.status = "failed";
    result.errors.push((err as Error).message);
  }

  await closeRun(ctx.service, research_run_id, {
    status: result.status,
    iterations: result.iterations,
    sources_registered: result.sources_registered,
    total_cost_cents: result.total_cost_cents,
    conversation: messages,
    output_summary: result.done_summary,
    error_detail: result.errors.length > 0 ? result.errors.join(" | ") : null,
  });

  return result;
}

// Persistence helpers --------------------------------------------------------

async function openRun(
  client: SupabaseClient,
  input: {
    user_id: string;
    topic: string;
    thesis_id: string | null;
    budget_cents: number;
    max_iterations: number;
  },
): Promise<string> {
  const { data, error } = await client
    .from("research_runs")
    .insert({
      user_id: input.user_id,
      topic: input.topic,
      thesis_id: input.thesis_id,
      budget_cents: input.budget_cents,
      max_iterations: input.max_iterations,
      status: "running",
    })
    .select("id")
    .single();
  if (error) throw new Error(`research: failed to open run: ${error.message}`);
  return data.id as string;
}

interface CloseRunInput {
  status: "completed" | "failed" | "cancelled";
  iterations: number;
  sources_registered: number;
  total_cost_cents: number;
  conversation: AnthropicMessage[];
  output_summary: string | null;
  error_detail: string | null;
}

async function closeRun(
  client: SupabaseClient,
  research_run_id: string,
  fields: CloseRunInput,
): Promise<void> {
  const { error } = await client
    .from("research_runs")
    .update({
      status: fields.status,
      ended_at: new Date().toISOString(),
      iterations: fields.iterations,
      sources_registered: fields.sources_registered,
      total_cost_cents: fields.total_cost_cents,
      conversation: fields.conversation,
      output_summary: fields.output_summary,
      error_detail: fields.error_detail,
    })
    .eq("id", research_run_id);
  if (error) throw new Error(`research: failed to close run: ${error.message}`);
}

// Prompts --------------------------------------------------------------------

const SYSTEM_PROMPT = `You are CANOPTICON's research agent — a forensic-intelligence librarian, not a journalist or essayist. Your job is to find and register source documents that bear on the operator's topic so the analytical roles (Ingestion Critic, claim_extraction, Verifier, Interrogator) can grade and process them downstream.

You have these tools:

- web_search (server-managed): query the web for relevant pages
- web_fetch (server-managed): pull the full content of a URL you found
- query_substrate (custom): check what the operator already has, to avoid duplicate work
- register_source (custom): write a fetched page into the substrate as a pending source
- mark_done (custom): signal completion with a one-paragraph summary

Operating rules:

1. Start by calling query_substrate to see whether the topic is already partially covered. Don't re-register existing URLs.
2. Search broadly first, then narrow. Aim for primary sources (filings, court documents, regulatory notices, transcripts) over secondary commentary when both are available.
3. ONLY register a source after web_fetch returns content. Do not register based on search snippets — the snippet is not the source.
4. Copy raw_text VERBATIM from web_fetch output. Do not paraphrase, summarize, or "clean up" the text. The Critic and claim_extraction skills need the original.
5. Suggest an Admiralty grade based on the source type: A for primary documents (Hansard, gazettes, court filings, sworn statements), B for established secondary sources with editorial accountability, C for less-established or visibly biased secondary sources, D-F for unreliable.
6. Provide a one-sentence "reason" for each registration explaining why this source is relevant to the topic.
7. When you've registered enough sources to give the analytical roles meaningful coverage of the topic, call mark_done with a one-paragraph summary. Don't keep registering sources past usefulness.

Constraints:

- You are NOT extracting claims yourself — claim_extraction does that downstream. Don't try to "summarize the findings."
- You are NOT grading sources authoritatively — the Ingestion Critic does that. Your suggested_grade is a hint.
- You are NOT writing prose, articles, or analyses. Your output is a registered set of sources, nothing else.
- If web_search or web_fetch returns nothing useful, try different search terms before giving up. If the topic genuinely has no reachable sources, call mark_done with an honest summary.

Stay focused on the topic the operator gave you. Don't drift into adjacent subjects unless the operator's topic clearly invites them.`;

function openingPrompt(topic: string, thesis_id: string | null): string {
  const thesisLine = thesis_id
    ? `This research is scoped to thesis_id ${thesis_id}. Sources you register will be available for routing into that thesis's inbox after the Critic grades them.`
    : "This research is not scoped to a specific thesis. Sources you register go into the operator's general substrate.";
  return `Research topic: ${topic}\n\n${thesisLine}\n\nBegin by calling query_substrate(filter='my_recent_sources') to see what the operator has recently retrieved. Then plan your search strategy and proceed.`;
}

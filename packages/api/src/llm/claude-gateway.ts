// Claude through the Worker's AI binding — Cloudflare AI Gateway with
// Unified Billing (docs/the-record.md §3).
//
// With Unified Billing enabled on a gateway, `env.AI.run()` accepts
// third-party models named `anthropic/<model>` and bills them to prepaid
// Cloudflare credits: no Anthropic account, no key in the Worker, and the
// request never leaves the binding. The call shape is
//
//   env.AI.run(model, { messages, max_tokens, temperature }, { gateway: { id } })
//
// in the binding's chat-style input. The gateway REJECTS `output_config`
// and `cache_control`, so structured output is asked for in the prompt and
// parsed out of the text, and nothing is cached. Tool use is not carried
// through this transport at all: the chat surface that needs tools runs on
// Workers AI or the direct Anthropic key, and a caller that passes `tools`
// here is told so instead of getting a silent text-only answer.
//
// The response shape could not be verified against Cloudflare's docs from
// the sandbox this was written in, so `normalizeGatewayResponse` accepts
// both an Anthropic Messages response and the OpenAI / Workers-AI chat
// shapes and folds them to one LlmCallOutput. It is a pure function and is
// unit-tested in tests/llm-claude-gateway.test.ts.

import type { Env } from "../env";
import { actualCostCents } from "../lib/anthropic";
import { withTimeout } from "../lib/timeout";
import type { LlmCallInput, LlmCallOutput, LlmContent, LlmMessage, LlmStopReason } from "./types";

/** Ceiling on one gateway call. Longer than TIMEOUTS.LLM_CALL_MS (25s):
 *  that ceiling was measured against Workers AI models that either answer
 *  in ~6-14s or wedge, and it guards Worker CPU under waitUntil. An awaited
 *  binding call burns no CPU while it waits, and an Opus-class model
 *  writing 4,000 tokens legitimately takes longer than 25s. 90s is still
 *  short enough that a wedged call fails inside one attended request. */
export const CLAUDE_GATEWAY_CALL_MS = 90_000;

/** What the adapter sends to `env.AI.run()`. OpenAI-style chat messages —
 *  the system prompt travels as the first `system` message, which is the
 *  binding's own chat input and what workers_ai.ts already sends. */
export interface GatewayRequestBody {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  max_tokens: number;
  temperature: number;
  top_p?: number;
}

/** The union of response shapes the adapter tolerates. */
export interface GatewayResponse {
  // Anthropic Messages shape.
  content?: Array<{ type?: string; text?: string }> | string;
  stop_reason?: string | null;
  model?: string;
  // Workers AI shape.
  response?: string | Record<string, unknown>;
  // OpenAI chat-completions shape.
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string | null;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export async function callClaudeViaGateway(env: Env, input: LlmCallInput): Promise<LlmCallOutput> {
  if (!env.AI_GATEWAY_ID) {
    throw new Error(
      "claude_gateway: AI_GATEWAY_ID is not set — Claude through the AI Gateway is not configured",
    );
  }
  if (input.tools && input.tools.length > 0) {
    throw new Error(
      `claude_gateway: tool use is not supported through the AI Gateway transport (${input.tools.length} tool(s) passed for ${input.model}); use provider "workers_ai" or "anthropic" for tool calls`,
    );
  }
  const body = buildGatewayBody(input);
  const raw = await withTimeout(
    // The typed AiModelList does not know `anthropic/…` names; the gateway does.
    env.AI.run(input.model as never, body as never, {
      gateway: { id: env.AI_GATEWAY_ID },
    }) as Promise<unknown>,
    CLAUDE_GATEWAY_CALL_MS,
    `claude_gateway.run[${input.model}]`,
  );
  return normalizeGatewayResponse(raw, input);
}

export function buildGatewayBody(input: LlmCallInput): GatewayRequestBody {
  const messages: GatewayRequestBody["messages"] = [];
  let system = input.system ?? "";
  if (input.response_schema) {
    // No output_config through the gateway: ask in the prompt, parse the text.
    const ask = `Respond with a single JSON object and nothing else — no prose, no code fence. It must match this JSON schema:\n${JSON.stringify(input.response_schema)}`;
    system = system ? `${system}\n\n${ask}` : ask;
  }
  if (system) messages.push({ role: "system", content: system });
  for (const m of input.messages) {
    if (m.role === "system") {
      messages.push({ role: "system", content: serializeContent(m.content) });
    } else if (m.role === "tool") {
      // Tool results never originate here (tools are refused above), but a
      // transcript built elsewhere may carry them; keep them as user text
      // so the model still sees the conversation whole.
      messages.push({ role: "user", content: serializeContent(m.content) });
    } else {
      messages.push({ role: m.role, content: serializeContent(m.content) });
    }
  }
  const body: GatewayRequestBody = {
    messages,
    max_tokens: input.max_tokens,
    temperature: input.temperature ?? 0,
  };
  if (input.top_p !== undefined) body.top_p = input.top_p;
  return body;
}

/** Fold whichever shape came back into LlmCallOutput. Pure. */
export function normalizeGatewayResponse(raw: unknown, input: LlmCallInput): LlmCallOutput {
  const res = (raw && typeof raw === "object" ? raw : {}) as GatewayResponse;

  let text = "";
  let finish: string | null | undefined;
  if (Array.isArray(res.content)) {
    text = res.content
      .filter((b) => b && (b.type === "text" || b.type === undefined) && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("");
    finish = res.stop_reason;
  } else if (typeof res.content === "string") {
    text = res.content;
    finish = res.stop_reason;
  } else if (typeof res.response === "string") {
    text = res.response;
  } else if (res.response && typeof res.response === "object") {
    text = JSON.stringify(res.response);
  } else if (res.choices?.[0]?.message) {
    text = res.choices[0].message.content ?? "";
    finish = res.choices[0].finish_reason;
  } else if (typeof raw === "string") {
    text = raw;
  }

  const usage = {
    input_tokens: res.usage?.input_tokens ?? res.usage?.prompt_tokens ?? 0,
    output_tokens: res.usage?.output_tokens ?? res.usage?.completion_tokens ?? 0,
  };

  let structured: unknown = null;
  if (res.response && typeof res.response === "object") {
    structured = res.response;
  } else if (input.response_schema && text) {
    structured = parseJsonInText(text);
  }

  return {
    text,
    structured,
    tool_uses: [],
    stop_reason: mapStop(finish),
    usage,
    // What this would cost at Anthropic's list price for the tokens
    // reported. Unified Billing debits Cloudflare credits, whose rate the
    // Worker cannot see, so this is the honest estimate, labelled as one
    // in the ledger metadata by llm/index.ts.
    cost_cents: estimateGatewayCostCents(input.model, usage.input_tokens, usage.output_tokens),
    cost_ledger_id: null,
    model: res.model && typeof res.model === "string" ? res.model : input.model,
    provider: "claude_gateway",
  };
}

/** List-price estimate keyed on the bare Claude name ("anthropic/claude-opus-4.1"
 *  → "claude-opus-4-1"), falling back to Opus rates for a name the price
 *  table does not know. */
export function estimateGatewayCostCents(
  model: string,
  input_tokens: number,
  output_tokens: number,
): number {
  if (input_tokens === 0 && output_tokens === 0) return 0;
  const bare = model.replace(/^anthropic\//, "").replace(/\./g, "-");
  return actualCostCents(bare, input_tokens, output_tokens);
}

function mapStop(s: string | null | undefined): LlmStopReason {
  if (!s) return "end_turn";
  if (s === "end_turn" || s === "stop_sequence" || s === "stop") return "end_turn";
  if (s === "max_tokens" || s === "length") return "max_tokens";
  if (s === "refusal" || s === "content_filter") return "refusal";
  if (s === "tool_use" || s === "tool_calls") return "tool_use";
  return "other";
}

/** JSON asked for in the prompt comes back as text; models still fence it
 *  or wrap it in a sentence often enough to tolerate both. */
export function parseJsonInText(text: string): unknown {
  const candidates = [text.trim()];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function serializeContent(content: LlmContent[]): string {
  const parts: string[] = [];
  for (const c of content) {
    if (c.type === "text") parts.push(c.text);
    else if (c.type === "tool_use")
      parts.push(`<tool_use name="${c.name}">${JSON.stringify(c.input)}</tool_use>`);
    else if (c.type === "tool_result")
      parts.push(
        `<tool_result tool_use_id="${c.tool_use_id}"${c.is_error ? ' is_error="true"' : ""}>${c.output}</tool_result>`,
      );
    else if (c.type === "document" && c.mime === "text/plain") parts.push(atob(c.base64));
    else if (c.type === "document" && c.mime === "application/pdf")
      parts.push(
        `[PDF document attached, ${c.base64.length} bytes base64 — not readable through the gateway transport]`,
      );
    else if (c.type === "image") parts.push(`[Image attached, mime=${c.mime}]`);
  }
  return parts.join("\n");
}

export type { LlmMessage };

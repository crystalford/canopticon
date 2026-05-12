// Anthropic adapter — translates the provider-neutral LlmCallInput into
// an Anthropic call and back. Delegates to the existing AnthropicClient
// in lib/anthropic.ts so we keep that as the single fetch chokepoint.

import {
  AnthropicClient,
  type AnthropicContentBlock,
  type AnthropicMessage,
  type AnthropicToolDefinition,
  actualCostCents,
} from "../lib/anthropic";
import type { LlmCallInput, LlmCallOutput, LlmContent, LlmMessage, LlmStopReason } from "./types";

export async function callAnthropic(apiKey: string, input: LlmCallInput): Promise<LlmCallOutput> {
  const client = new AnthropicClient({ apiKey });
  const out = await client.call({
    model: input.model,
    system: input.system,
    messages: toAnthropicMessages(input.messages),
    max_tokens: input.max_tokens,
    temperature: input.temperature,
    tools: input.tools as AnthropicToolDefinition[] | undefined,
    response_schema: input.response_schema,
  });

  const cost = actualCostCents(input.model, out.usage.input_tokens, out.usage.output_tokens);
  return {
    text: out.text,
    structured: out.structured,
    tool_uses: out.tool_uses,
    stop_reason: mapStop(out.stop_reason),
    usage: out.usage,
    cost_cents: cost,
    cost_ledger_id: null,
    model: out.model,
    provider: "anthropic",
  };
}

function toAnthropicMessages(messages: LlmMessage[]): AnthropicMessage[] {
  // Anthropic only takes user/assistant; tool results live inside user
  // messages as tool_result content blocks. The chat agent loop emits
  // tool rows as separate LlmMessage entries with role="tool"; collapse
  // those into the preceding user/assistant turn.
  const out: AnthropicMessage[] = [];
  for (const m of messages) {
    if (m.role === "system") continue; // Anthropic uses a top-level `system`.
    if (m.role === "tool") {
      // Attach tool_result blocks to the most recent user message, or open one.
      const blocks = m.content.map(toAnthropicBlock).filter(Boolean) as AnthropicContentBlock[];
      const last = out[out.length - 1];
      if (last && last.role === "user" && Array.isArray(last.content)) {
        last.content.push(...blocks);
      } else {
        out.push({ role: "user", content: blocks });
      }
      continue;
    }
    out.push({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content.map(toAnthropicBlock).filter(Boolean) as AnthropicContentBlock[],
    });
  }
  return out;
}

function toAnthropicBlock(c: LlmContent): AnthropicContentBlock | null {
  if (c.type === "text") return { type: "text", text: c.text };
  if (c.type === "tool_use") return { type: "tool_use", id: c.id, name: c.name, input: c.input };
  if (c.type === "tool_result") {
    return {
      type: "tool_result",
      tool_use_id: c.tool_use_id,
      content: c.output,
      is_error: c.is_error ?? false,
    };
  }
  if (c.type === "document" && c.mime === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: c.base64 },
    };
  }
  if (c.type === "document" && c.mime === "text/plain") {
    return {
      type: "document",
      source: {
        type: "text",
        media_type: "text/plain",
        data: atob(c.base64),
      },
    };
  }
  // Anthropic image blocks not yet wired through; the chat surface uses
  // text/document for v1.
  return null;
}

function mapStop(s: string): LlmStopReason {
  if (s === "end_turn" || s === "stop_sequence") return "end_turn";
  if (s === "tool_use") return "tool_use";
  if (s === "max_tokens") return "max_tokens";
  if (s === "refusal") return "refusal";
  return "other";
}

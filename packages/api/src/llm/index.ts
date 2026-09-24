// Top-level LLM entry point. Routes by provider and writes a cost_ledger
// row when the caller passes `ledger: { user_id, operation_type }`.
//
// Three transports, one chokepoint:
//   - workers_ai      free; the gate short-circuits to a $0 row.
//   - claude_gateway  Claude via the AI binding + AI Gateway Unified Billing.
//                     Billed to Cloudflare credits, not to a card the gate
//                     can cap, so it takes the same $0-estimate short-circuit
//                     as Workers AI; the row records the anthropic/… model
//                     and, after the call, a list-price estimate labelled as
//                     such in metadata.
//   - anthropic       api.anthropic.com with ANTHROPIC_API_KEY; the full
//                     whitelist gate applies.

import { approvePaidOperation, recordActualCost } from "../cost/approve";
import type { Env } from "../env";
import { callAnthropic } from "./anthropic";
import { callClaudeViaGateway } from "./claude-gateway";
import type { LlmCallInput, LlmCallOutput, LlmStreamChunk } from "./types";
import { callWorkersAi, streamWorkersAi } from "./workers_ai";

export async function callLLM(env: Env, input: LlmCallInput): Promise<LlmCallOutput> {
  // Pre-call cost gate. Workers AI and the Claude gateway short-circuit to a
  // $0 row inside the gate (see the header); only the direct key is capped.
  let ledger_id: string | null = null;
  if (input.ledger) {
    const decision = await approvePaidOperation(env.DB, {
      user_id: input.ledger.user_id,
      operation_type: input.ledger.operation_type,
      provider: input.provider,
      model: input.model,
      // Conservative pre-call estimate for Anthropic; Workers AI = 0.
      estimated_cost_cents: input.provider === "anthropic" ? estimatedCents(input) : 0,
      idempotency_key: input.ledger.idempotency_key,
      context: { messages_in: input.messages.length },
    });
    if (decision.decision !== "approved") {
      throw new Error(
        `Cost gate blocked ${input.ledger.operation_type}: ${decision.decision}${"reason" in decision ? ` (${decision.reason})` : ""}`,
      );
    }
    ledger_id = decision.cost_ledger_id;
  }

  let result: LlmCallOutput;
  if (input.provider === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
    result = await callAnthropic(env.ANTHROPIC_API_KEY, input);
  } else if (input.provider === "claude_gateway") {
    result = await callClaudeViaGateway(env, input);
  } else {
    result = await callWorkersAi(env.AI, input);
  }

  if (ledger_id) {
    await recordActualCost(env.DB, ledger_id, result.cost_cents, ledgerMetadata(result));
    result.cost_ledger_id = ledger_id;
  }
  return result;
}

/** The post-call ledger blob. For the gateway the cents are Anthropic's
 *  list price for the reported tokens, not what Cloudflare debited — say so. */
function ledgerMetadata(result: LlmCallOutput): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    tokens_in: result.usage.input_tokens,
    tokens_out: result.usage.output_tokens,
    model: result.model,
  };
  if (result.provider === "claude_gateway") {
    meta.billing = "cloudflare_ai_gateway_unified";
    meta.cost_basis = "anthropic_list_price_estimate";
  }
  return meta;
}

/** Rough token estimate based on message size. ~4 chars/token. */
function estimatedCents(input: LlmCallInput): number {
  const text = JSON.stringify(input.messages) + (input.system ?? "");
  const tokens = Math.ceil(text.length / 4);
  // Worst-case rate (Opus): 1.5c/1k in + 7.5c/1k out
  return Math.max(1, Math.ceil(((tokens + input.max_tokens) / 1000) * 9));
}

/** Streaming variant. `onChunk` fires for each text delta and completed tool_use
 *  as they arrive from the model. Returns the final assembled output for
 *  persistence. Anthropic streaming not yet implemented — falls back to non-stream
 *  call and emits the whole response as one delta. */
export async function streamLLM(
  env: Env,
  input: LlmCallInput,
  onChunk: (chunk: LlmStreamChunk) => void,
): Promise<LlmCallOutput> {
  let ledger_id: string | null = null;
  if (input.ledger) {
    const decision = await approvePaidOperation(env.DB, {
      user_id: input.ledger.user_id,
      operation_type: input.ledger.operation_type,
      provider: input.provider,
      model: input.model,
      estimated_cost_cents: input.provider === "anthropic" ? estimatedCents(input) : 0,
      idempotency_key: input.ledger.idempotency_key,
      context: { messages_in: input.messages.length },
    });
    if (decision.decision !== "approved") {
      throw new Error(
        `Cost gate blocked ${input.ledger.operation_type}: ${decision.decision}${"reason" in decision ? ` (${decision.reason})` : ""}`,
      );
    }
    ledger_id = decision.cost_ledger_id;
  }

  let result: LlmCallOutput;
  if (input.provider === "anthropic" || input.provider === "claude_gateway") {
    // Neither Claude transport streams yet; fall back to a single delta.
    if (input.provider === "anthropic") {
      if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
      result = await callAnthropic(env.ANTHROPIC_API_KEY, input);
    } else {
      result = await callClaudeViaGateway(env, input);
    }
    if (result.text) onChunk({ delta: result.text });
    for (const tu of result.tool_uses) onChunk({ tool_use: tu });
    onChunk({
      done: {
        stop_reason: result.stop_reason,
        usage: result.usage,
        cost_cents: result.cost_cents,
        cost_ledger_id: result.cost_ledger_id,
        model: result.model,
        provider: result.provider,
      },
    });
  } else {
    result = await streamWorkersAi(env.AI, input, onChunk);
  }

  if (ledger_id) {
    await recordActualCost(env.DB, ledger_id, result.cost_cents, ledgerMetadata(result));
    result.cost_ledger_id = ledger_id;
  }
  return result;
}

export type { LlmCallInput, LlmCallOutput, LlmStreamChunk } from "./types";

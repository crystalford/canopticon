// Top-level LLM entry point. Routes by provider and writes a cost_ledger
// row when the caller passes `ledger: { user_id, operation_type }`.

import { approvePaidOperation, recordActualCost } from "../cost/approve";
import type { Env } from "../env";
import { callAnthropic } from "./anthropic";
import type { LlmCallInput, LlmCallOutput, LlmStreamChunk } from "./types";
import { callWorkersAi, streamWorkersAi } from "./workers_ai";

export async function callLLM(env: Env, input: LlmCallInput): Promise<LlmCallOutput> {
  // Pre-call cost gate. Workers AI short-circuits to a $0 row inside the gate.
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
  } else {
    result = await callWorkersAi(env.AI, input);
  }

  if (ledger_id) {
    await recordActualCost(env.DB, ledger_id, result.cost_cents, {
      tokens_in: result.usage.input_tokens,
      tokens_out: result.usage.output_tokens,
      model: result.model,
    });
    result.cost_ledger_id = ledger_id;
  }
  return result;
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
  if (input.provider === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
    // Anthropic streaming not yet wired; fall back to a single delta.
    result = await callAnthropic(env.ANTHROPIC_API_KEY, input);
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
    await recordActualCost(env.DB, ledger_id, result.cost_cents, {
      tokens_in: result.usage.input_tokens,
      tokens_out: result.usage.output_tokens,
      model: result.model,
    });
    result.cost_ledger_id = ledger_id;
  }
  return result;
}

export type { LlmCallInput, LlmCallOutput, LlmStreamChunk } from "./types";

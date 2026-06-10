// Provider-neutral types for the LLM adapter.
//
// The shape is Anthropic-style internally (text/tool_use/tool_result
// content blocks) because Anthropic is the more expressive of the two
// providers and Workers AI maps cleanly onto it.

export type LlmProvider = "workers_ai" | "anthropic";

export type LlmRole = "system" | "user" | "assistant" | "tool";

export type LlmContent =
  | { type: "text"; text: string }
  | { type: "image"; mime: string; base64: string }
  | { type: "document"; mime: "application/pdf" | "text/plain"; base64: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; output: string; is_error?: boolean | undefined };

export interface LlmMessage {
  role: LlmRole;
  content: LlmContent[];
}

export interface LlmToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type LlmStopReason = "end_turn" | "tool_use" | "max_tokens" | "refusal" | "other";

export interface LlmCallInput {
  provider: LlmProvider;
  model: string;
  system?: string | undefined;
  messages: LlmMessage[];
  tools?: LlmToolDef[] | undefined;
  max_tokens: number;
  temperature?: number | undefined;
  top_p?: number | undefined;
  repetition_penalty?: number | undefined;
  /** Request JSON output that matches this schema. Only honoured by Anthropic. */
  response_schema?: Record<string, unknown> | undefined;
  /** Workers AI Responses-API reasoning dial. Only the gpt-oss family
   *  honours this; other models silently ignore it. Spec v2.4 Part 16:
   *  reasoning effort is a dial, NOT a default — bulk extraction runs
   *  on low/non-reasoning models; high effort is reserved for the
   *  Surfacing Engine Level 2 tier. */
  reasoning_effort?: "low" | "medium" | "high" | undefined;
  /** When set, the call ledgers itself under this operation_type and user. */
  ledger?: {
    user_id: string;
    operation_type: string;
    idempotency_key?: string | undefined;
  };
}

export interface LlmCallOutput {
  text: string;
  structured: unknown | null;
  tool_uses: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  stop_reason: LlmStopReason;
  usage: { input_tokens: number; output_tokens: number };
  cost_cents: number;
  cost_ledger_id: string | null;
  model: string;
  provider: LlmProvider;
}

export interface LlmStreamChunk {
  /** Incremental text appended to the assistant message. */
  delta?: string;
  /** A complete tool_use block emitted by the model. */
  tool_use?: { id: string; name: string; input: Record<string, unknown> };
  /** Final usage + stop reason; emitted exactly once at end of stream. */
  done?: {
    stop_reason: LlmStopReason;
    usage: { input_tokens: number; output_tokens: number };
    cost_cents: number;
    cost_ledger_id: string | null;
    model: string;
    provider: LlmProvider;
  };
}

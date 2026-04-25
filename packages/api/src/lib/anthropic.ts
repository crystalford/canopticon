// Anthropic API wrapper.
//
// Every call to Anthropic flows through this module. Two reasons:
//
//   1. Cost discipline: callers cannot bypass the cost gate. The
//      `callAnthropic()` function does NOT itself enforce the gate (it
//      doesn't know the user_id) — but it's the only Anthropic client in
//      the codebase, so the call sites that wrap it (the role runner) are
//      the only places that need gate-checking.
//
//   2. Feature toggles: structured-output and citations-API support are
//      mutually exclusive in a single call (master-synthesis v1.5.1
//      changelog item 4: returns 400). The wrapper enforces the constraint.
//
// We use raw fetch rather than the @anthropic-ai/sdk because the SDK
// drags in node-only dependencies that don't run cleanly in Workers. The
// API surface we need is small.

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

export type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "document"; source: AnthropicDocumentSource; citations?: { enabled: boolean } };

export type AnthropicDocumentSource =
  | { type: "text"; media_type: "text/plain"; data: string }
  | { type: "base64"; media_type: "application/pdf"; data: string };

export interface AnthropicCallInput {
  model: string;
  system?: string | undefined;
  messages: AnthropicMessage[];
  max_tokens: number;
  /** When set, requests structured output. Mutually exclusive with citations. */
  response_schema?: Record<string, unknown> | undefined;
  /** When true, the response may include citation blocks. Mutually exclusive with response_schema. */
  citations?: boolean | undefined;
  /** Stop sequences. */
  stop_sequences?: string[] | undefined;
  /** Temperature; defaults to 0 for analytical roles. */
  temperature?: number | undefined;
}

export interface AnthropicCallOutput {
  /** Concatenated text content from the response. */
  text: string;
  /** Parsed structured output if response_schema was set; otherwise null. */
  structured: unknown | null;
  /** Citations array (Citations API) if citations:true was set; otherwise []. */
  citations: AnthropicCitation[];
  /** Token usage as reported by the API. */
  usage: { input_tokens: number; output_tokens: number };
  /** Model the response actually came from (echoed by Anthropic). */
  model: string;
  /** Raw response — for debugging, audit, structured persistence. */
  raw: unknown;
}

export interface AnthropicCitation {
  type: string;
  cited_text: string;
  document_index?: number;
  document_title?: string;
  start_char_index?: number;
  end_char_index?: number;
  start_page_number?: number;
  end_page_number?: number;
}

export class AnthropicError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly raw?: unknown,
  ) {
    super(message);
    this.name = "AnthropicError";
  }
}

export interface AnthropicClientOptions {
  apiKey: string;
  /** Override the global fetch. Used in tests. */
  fetch?: typeof fetch;
}

export class AnthropicClient {
  private readonly apiKey: string;
  private readonly fetch: typeof fetch;

  constructor(options: AnthropicClientOptions) {
    if (!options.apiKey) throw new Error("AnthropicClient: apiKey is required");
    this.apiKey = options.apiKey;
    this.fetch = options.fetch ?? fetch;
  }

  async call(input: AnthropicCallInput): Promise<AnthropicCallOutput> {
    if (input.response_schema && input.citations) {
      throw new Error(
        "Anthropic: response_schema and citations cannot be combined in a single call (returns 400). " +
          "Run them sequentially — see master-synthesis-v1.5.1 changelog item 4.",
      );
    }

    const body: Record<string, unknown> = {
      model: input.model,
      max_tokens: input.max_tokens,
      messages: input.messages,
      temperature: input.temperature ?? 0,
    };
    if (input.system) body.system = input.system;
    if (input.stop_sequences) body.stop_sequences = input.stop_sequences;
    if (input.response_schema) {
      // Anthropic's structured-output mode (beta as of November 2025).
      body.response_format = {
        type: "json_schema",
        json_schema: { schema: input.response_schema, strict: true },
      };
    }

    const res = await this.fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const err = (json.error ?? {}) as { type?: string; message?: string };
      throw new AnthropicError(
        res.status,
        err.type ?? "api_error",
        err.message ?? `Anthropic returned ${res.status}`,
        json,
      );
    }

    return parseResponse(json, !!input.response_schema, !!input.citations);
  }
}

function parseResponse(
  raw: Record<string, unknown>,
  expectStructured: boolean,
  expectCitations: boolean,
): AnthropicCallOutput {
  const content = (raw.content ?? []) as Array<Record<string, unknown>>;

  const textPieces: string[] = [];
  const citations: AnthropicCitation[] = [];

  for (const block of content) {
    if (block.type === "text" && typeof block.text === "string") {
      textPieces.push(block.text);
      if (Array.isArray(block.citations)) {
        for (const c of block.citations) {
          citations.push(c as AnthropicCitation);
        }
      }
    }
  }

  const text = textPieces.join("");

  let structured: unknown = null;
  if (expectStructured) {
    if (text.length === 0) {
      throw new AnthropicError(
        500,
        "empty_structured_output",
        "Anthropic returned no text content for a structured-output request",
        raw,
      );
    }
    try {
      structured = JSON.parse(text);
    } catch (cause) {
      throw new AnthropicError(
        500,
        "malformed_structured_output",
        `Anthropic structured output is not valid JSON: ${(cause as Error).message}`,
        raw,
      );
    }
  }

  if (expectCitations && citations.length === 0) {
    // Not an error — the model may legitimately have no citations. The
    // caller decides whether absence is a failure.
  }

  const usageRaw = (raw.usage ?? {}) as { input_tokens?: number; output_tokens?: number };

  return {
    text,
    structured,
    citations,
    usage: {
      input_tokens: usageRaw.input_tokens ?? 0,
      output_tokens: usageRaw.output_tokens ?? 0,
    },
    model: (raw.model as string) ?? "unknown",
    raw,
  };
}

// Cost estimation helpers. These mirror Anthropic's published prices for
// claude-opus-4-7 (May 2026). Updated when prices change. Kept minimal —
// the cost gate uses these to decide pre-call; the actual cost charged
// uses the API's reported usage.

export interface CostEstimate {
  /** Estimated cost in cents. Round up. */
  cents: number;
  /** Per-1k-token rates used for the estimate. */
  rates: { input_per_1k: number; output_per_1k: number };
}

// Cents per 1k tokens. Opus 4.7 list prices.
const FALLBACK_RATES = { input_per_1k: 1.5, output_per_1k: 7.5 } as const;
const PRICE_TABLE: Record<string, { input_per_1k: number; output_per_1k: number }> = {
  "claude-opus-4-7": FALLBACK_RATES,
  "claude-haiku-4-5-20251001": { input_per_1k: 0.1, output_per_1k: 0.5 },
  "claude-sonnet-4-6": { input_per_1k: 0.3, output_per_1k: 1.5 },
};

export function estimateCostCents(
  model: string,
  estimated_input_tokens: number,
  estimated_output_tokens: number,
): CostEstimate {
  const rates = PRICE_TABLE[model] ?? FALLBACK_RATES;
  const cents =
    Math.ceil((estimated_input_tokens / 1000) * rates.input_per_1k) +
    Math.ceil((estimated_output_tokens / 1000) * rates.output_per_1k);
  return { cents: Math.max(1, cents), rates };
}

export function actualCostCents(
  model: string,
  input_tokens: number,
  output_tokens: number,
): number {
  const rates = PRICE_TABLE[model] ?? FALLBACK_RATES;
  return Math.max(
    1,
    Math.ceil((input_tokens / 1000) * rates.input_per_1k) +
      Math.ceil((output_tokens / 1000) * rates.output_per_1k),
  );
}

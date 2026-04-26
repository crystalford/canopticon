import { describe, expect, it, vi } from "vitest";
import {
  AnthropicClient,
  AnthropicError,
  actualCostCents,
  estimateCostCents,
} from "../src/lib/anthropic.ts";

function fetchOk(response: Record<string, unknown>): typeof fetch {
  return vi.fn(
    async () => new Response(JSON.stringify(response), { status: 200 }),
  ) as unknown as typeof fetch;
}

function fetchErr(status: number, body: Record<string, unknown>): typeof fetch {
  return vi.fn(
    async () => new Response(JSON.stringify(body), { status }),
  ) as unknown as typeof fetch;
}

describe("AnthropicClient.call", () => {
  it("parses a plain text response", async () => {
    const client = new AnthropicClient({
      apiKey: "test",
      fetch: fetchOk({
        content: [{ type: "text", text: "Hello world" }],
        usage: { input_tokens: 10, output_tokens: 3 },
        model: "claude-opus-4-7",
      }),
    });
    const out = await client.call({
      model: "claude-opus-4-7",
      messages: [{ role: "user", content: "say hi" }],
      max_tokens: 100,
    });
    expect(out.text).toBe("Hello world");
    expect(out.structured).toBeNull();
    expect(out.usage).toEqual({ input_tokens: 10, output_tokens: 3 });
  });

  it("parses a structured-output response", async () => {
    const client = new AnthropicClient({
      apiKey: "test",
      fetch: fetchOk({
        content: [{ type: "text", text: '{"questions":[{"text":"q?","eig":0.5}]}' }],
        usage: { input_tokens: 100, output_tokens: 30 },
        model: "claude-opus-4-7",
      }),
    });
    const out = await client.call({
      model: "claude-opus-4-7",
      messages: [{ role: "user", content: "..." }],
      max_tokens: 1000,
      response_schema: { type: "object" },
    });
    expect(out.structured).toEqual({ questions: [{ text: "q?", eig: 0.5 }] });
  });

  it("collects citation blocks", async () => {
    const client = new AnthropicClient({
      apiKey: "test",
      fetch: fetchOk({
        content: [
          {
            type: "text",
            text: "The policy was implemented in 2014.",
            citations: [
              {
                type: "char_location",
                cited_text: "policy was implemented in 2014",
                document_index: 0,
                start_char_index: 22,
                end_char_index: 53,
              },
            ],
          },
        ],
        usage: { input_tokens: 1000, output_tokens: 50 },
        model: "claude-opus-4-7",
      }),
    });
    const out = await client.call({
      model: "claude-opus-4-7",
      messages: [{ role: "user", content: "ground this" }],
      max_tokens: 500,
      citations: true,
    });
    expect(out.citations).toHaveLength(1);
    expect(out.citations[0]?.cited_text).toContain("2014");
  });

  it("rejects combining structured output and citations", async () => {
    const client = new AnthropicClient({ apiKey: "test", fetch: fetchOk({}) });
    await expect(
      client.call({
        model: "claude-opus-4-7",
        messages: [{ role: "user", content: "..." }],
        max_tokens: 1000,
        response_schema: { type: "object" },
        citations: true,
      }),
    ).rejects.toThrow(/cannot be combined/);
  });

  it("surfaces API errors as AnthropicError", async () => {
    const client = new AnthropicClient({
      apiKey: "test",
      fetch: fetchErr(429, { error: { type: "rate_limit_error", message: "too many" } }),
    });
    await expect(
      client.call({
        model: "claude-opus-4-7",
        messages: [{ role: "user", content: "..." }],
        max_tokens: 100,
      }),
    ).rejects.toBeInstanceOf(AnthropicError);
  });

  it("throws when structured-output text is not valid JSON", async () => {
    const client = new AnthropicClient({
      apiKey: "test",
      fetch: fetchOk({
        content: [{ type: "text", text: "not json" }],
        usage: { input_tokens: 1, output_tokens: 1 },
        model: "claude-opus-4-7",
      }),
    });
    await expect(
      client.call({
        model: "claude-opus-4-7",
        messages: [{ role: "user", content: "..." }],
        max_tokens: 100,
        response_schema: { type: "object" },
      }),
    ).rejects.toMatchObject({ code: "malformed_structured_output" });
  });
});

describe("cost estimation", () => {
  it("estimates cost from token counts", () => {
    const e = estimateCostCents("claude-opus-4-7", 4000, 1500);
    // 4 * 1.5 + 1.5 * 7.5 = 6 + 11.25 → ceil → 6 + 12 = 18
    expect(e.cents).toBeGreaterThanOrEqual(15);
  });

  it("rounds tiny calls up to 1 cent minimum", () => {
    const e = estimateCostCents("claude-opus-4-7", 1, 1);
    expect(e.cents).toBeGreaterThanOrEqual(1);
  });

  it("uses the same rates for actualCostCents", () => {
    const a = actualCostCents("claude-opus-4-7", 4000, 1500);
    const e = estimateCostCents("claude-opus-4-7", 4000, 1500);
    expect(a).toBe(e.cents);
  });

  it("falls back to opus rates for unknown model strings", () => {
    const fallback = estimateCostCents("claude-future-model-9", 1000, 1000);
    const opus = estimateCostCents("claude-opus-4-7", 1000, 1000);
    expect(fallback.cents).toBe(opus.cents);
  });
});

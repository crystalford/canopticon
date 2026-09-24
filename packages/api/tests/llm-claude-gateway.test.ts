// Claude through the AI binding + AI Gateway Unified Billing.
//
// The response shape could not be verified from the sandbox this was
// written in, so the adapter accepts every shape it might plausibly get and
// these tests pin that tolerance. Nothing here touches the network: the AI
// binding is a stub that records what it was asked and returns a canned body.

import { describe, expect, it, vi } from "vitest";
import {
  buildGatewayBody,
  callClaudeViaGateway,
  estimateGatewayCostCents,
  normalizeGatewayResponse,
  parseJsonInText,
} from "../src/llm/claude-gateway";
import type { LlmCallInput } from "../src/llm/types";

const input = (over: Partial<LlmCallInput> = {}): LlmCallInput => ({
  provider: "claude_gateway",
  model: "anthropic/claude-opus-4.1",
  system: "Be brief.",
  messages: [{ role: "user", content: [{ type: "text", text: "Say hi." }] }],
  max_tokens: 100,
  ...over,
});

describe("normalizing the gateway response", () => {
  it("reads an Anthropic Messages response", () => {
    const out = normalizeGatewayResponse(
      {
        content: [
          { type: "text", text: "Hello " },
          { type: "text", text: "there." },
        ],
        stop_reason: "end_turn",
        usage: { input_tokens: 12, output_tokens: 4 },
        model: "claude-opus-4-1-20250805",
      },
      input(),
    );
    expect(out.text).toBe("Hello there.");
    expect(out.stop_reason).toBe("end_turn");
    expect(out.usage).toEqual({ input_tokens: 12, output_tokens: 4 });
    expect(out.model).toBe("claude-opus-4-1-20250805");
    expect(out.provider).toBe("claude_gateway");
    expect(out.tool_uses).toEqual([]);
  });

  it("reads a Workers-AI {response} body", () => {
    const out = normalizeGatewayResponse(
      { response: "Hi.", usage: { prompt_tokens: 7, completion_tokens: 2 } },
      input(),
    );
    expect(out.text).toBe("Hi.");
    expect(out.usage).toEqual({ input_tokens: 7, output_tokens: 2 });
    expect(out.model).toBe("anthropic/claude-opus-4.1");
  });

  it("reads an OpenAI chat-completions body", () => {
    const out = normalizeGatewayResponse(
      {
        choices: [{ message: { content: "Hi." }, finish_reason: "length" }],
        usage: { prompt_tokens: 7, completion_tokens: 100 },
      },
      input(),
    );
    expect(out.text).toBe("Hi.");
    expect(out.stop_reason).toBe("max_tokens");
  });

  it("maps refusal and max_tokens stop reasons from the Anthropic shape", () => {
    expect(
      normalizeGatewayResponse(
        { content: [{ type: "text", text: "" }], stop_reason: "refusal" },
        input(),
      ).stop_reason,
    ).toBe("refusal");
    expect(
      normalizeGatewayResponse(
        { content: [{ type: "text", text: "x" }], stop_reason: "max_tokens" },
        input(),
      ).stop_reason,
    ).toBe("max_tokens");
  });

  it("parses JSON out of the text when a schema was asked for", () => {
    const schema = { type: "object", properties: { a: { type: "number" } } };
    const fenced = normalizeGatewayResponse(
      { content: [{ type: "text", text: 'Here you go:\n```json\n{"a": 1}\n```' }] },
      input({ response_schema: schema }),
    );
    expect(fenced.structured).toEqual({ a: 1 });
    const bare = normalizeGatewayResponse(
      { response: '{"a": 2}' },
      input({ response_schema: schema }),
    );
    expect(bare.structured).toEqual({ a: 2 });
    const notJson = normalizeGatewayResponse(
      { response: "no" },
      input({ response_schema: schema }),
    );
    expect(notJson.structured).toBeNull();
  });

  it("keeps an already-parsed object response as the structured result", () => {
    const out = normalizeGatewayResponse({ response: { a: 3 } }, input());
    expect(out.structured).toEqual({ a: 3 });
    expect(out.text).toBe('{"a":3}');
  });

  it("does not throw on an empty or unexpected body", () => {
    const out = normalizeGatewayResponse(null, input());
    expect(out.text).toBe("");
    expect(out.usage).toEqual({ input_tokens: 0, output_tokens: 0 });
    expect(out.cost_cents).toBe(0);
  });

  it("records a list-price estimate keyed on the bare Claude name", () => {
    // Opus rates: 1.5c/1k in, 7.5c/1k out.
    expect(estimateGatewayCostCents("anthropic/claude-opus-4.1", 10_000, 1_000)).toBe(15 + 8);
    // Haiku is priced separately, not at the Opus fallback.
    expect(estimateGatewayCostCents("anthropic/claude-haiku-4.5", 10_000, 1_000)).toBe(1 + 1);
    expect(estimateGatewayCostCents("anthropic/claude-opus-4.1", 0, 0)).toBe(0);
  });
});

describe("parseJsonInText", () => {
  it("tolerates prose around the object", () => {
    expect(parseJsonInText('Sure. {"k": [1, 2]} Done.')).toEqual({ k: [1, 2] });
    expect(parseJsonInText("nothing here")).toBeNull();
  });
});

describe("building the request", () => {
  it("sends OpenAI-style chat messages with the system prompt first", () => {
    const body = buildGatewayBody(input({ temperature: 0.2, top_p: 0.9 }));
    expect(body.messages[0]).toEqual({ role: "system", content: "Be brief." });
    expect(body.messages[1]).toEqual({ role: "user", content: "Say hi." });
    expect(body.max_tokens).toBe(100);
    expect(body.temperature).toBe(0.2);
    expect(body.top_p).toBe(0.9);
    // The gateway rejects these; they must never appear.
    expect(JSON.stringify(body)).not.toMatch(/output_config|cache_control/);
  });

  it("asks for JSON in the prompt instead of output_config", () => {
    const body = buildGatewayBody(input({ response_schema: { type: "object" } }));
    expect(body.messages[0]?.role).toBe("system");
    expect(body.messages[0]?.content).toContain("Be brief.");
    expect(body.messages[0]?.content).toContain('{"type":"object"}');
    expect(body).not.toHaveProperty("output_config");
    expect(body).not.toHaveProperty("response_format");
  });
});

describe("callClaudeViaGateway", () => {
  const envWith = (run: (...a: unknown[]) => unknown, gateway = "canopticon") =>
    ({ AI: { run }, AI_GATEWAY_ID: gateway }) as never;

  it("calls env.AI.run(model, body, { gateway: { id } })", async () => {
    const run = vi.fn(async () => ({
      content: [{ type: "text", text: "ok" }],
      usage: { input_tokens: 1, output_tokens: 1 },
    }));
    const out = await callClaudeViaGateway(envWith(run), input());
    expect(out.text).toBe("ok");
    expect(run).toHaveBeenCalledTimes(1);
    const [model, body, opts] = run.mock.calls[0] as unknown as [string, unknown, unknown];
    expect(model).toBe("anthropic/claude-opus-4.1");
    expect(body).toMatchObject({ max_tokens: 100 });
    expect(opts).toEqual({ gateway: { id: "canopticon" } });
  });

  it("refuses tools with a clear error, before calling the binding", async () => {
    const run = vi.fn();
    await expect(
      callClaudeViaGateway(
        envWith(run),
        input({ tools: [{ name: "t", description: "d", input_schema: {} }] }),
      ),
    ).rejects.toThrow(/tool use is not supported through the AI Gateway/);
    expect(run).not.toHaveBeenCalled();
  });

  it("refuses to run when the gateway is not configured", async () => {
    const run = vi.fn();
    await expect(callClaudeViaGateway(envWith(run, ""), input())).rejects.toThrow(
      /AI_GATEWAY_ID is not set/,
    );
    expect(run).not.toHaveBeenCalled();
  });
});

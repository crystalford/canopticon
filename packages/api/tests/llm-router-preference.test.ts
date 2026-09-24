// Order of preference: Claude via the AI Gateway when it is configured,
// Workers AI otherwise — and the header says which, so nothing downgrades
// silently (docs/the-record.md §3).

import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CLAUDE_MODEL } from "../src/env";
import {
  type Role,
  modelForRole,
  modelInUse,
  preferredProvider,
  resolveWriter,
} from "../src/llm/router";

const env = (over: Record<string, unknown> = {}) => ({ ...over }) as never;

const JUDGEMENT_ROLES: Role[] = [
  "bulk_extraction",
  "hard_extraction",
  "writer",
  "research_writer",
  "judge",
  "surfacing_ambitious",
  "large_context",
];

describe("preferredProvider", () => {
  it("prefers Claude through the gateway for every judgement role when configured", () => {
    for (const role of JUDGEMENT_ROLES) {
      const p = preferredProvider(env({ AI_GATEWAY_ID: "gw" }), role);
      expect(p.provider).toBe("claude_gateway");
      expect(p.model).toBe(DEFAULT_CLAUDE_MODEL);
      expect(p.reason).toMatch(/AI_GATEWAY_ID is set/);
    }
  });

  it("uses the exact model name the operator set", () => {
    const p = preferredProvider(
      env({ AI_GATEWAY_ID: "gw", CLAUDE_MODEL: "anthropic/claude-sonnet-4.5" }),
    );
    expect(p.model).toBe("anthropic/claude-sonnet-4.5");
  });

  it("falls to the role's Workers AI model when there is no gateway", () => {
    const p = preferredProvider(env(), "research_writer");
    expect(p.provider).toBe("workers_ai");
    expect(p.model).toBe("@cf/openai/gpt-oss-120b");
    expect(p.reason).toMatch(/AI_GATEWAY_ID is not set/);
    // Whitespace is not a gateway.
    expect(preferredProvider(env({ AI_GATEWAY_ID: "  " }), "writer").provider).toBe("workers_ai");
  });

  it("modelForRole reports the gateway model only when handed the env", () => {
    expect(modelForRole("writer").provider).toBe("workers_ai");
    const withEnv = modelForRole("writer", env({ AI_GATEWAY_ID: "gw" }));
    expect(withEnv.provider).toBe("claude_gateway");
    expect(withEnv.model).toBe(DEFAULT_CLAUDE_MODEL);
    expect(withEnv.operation_type).toBe("workers_ai.writer");
    expect(modelForRole("writer", env())).toEqual(modelForRole("writer"));
  });
});

describe("modelInUse — the library header", () => {
  it("names Claude and the gateway when configured", () => {
    const m = modelInUse(env({ AI_GATEWAY_ID: "gw" }));
    expect(m).toEqual({
      label: "Claude (opus-4.1) via Cloudflare AI Gateway",
      provider: "claude_gateway",
      configured: true,
    });
    expect(
      modelInUse(env({ AI_GATEWAY_ID: "gw", CLAUDE_MODEL: "anthropic/claude-haiku-4.5" })).label,
    ).toBe("Claude (haiku-4.5) via Cloudflare AI Gateway");
  });

  it("says the gateway is not configured, and what runs instead", () => {
    const m = modelInUse(env());
    expect(m).toEqual({
      label: "Workers AI gpt-oss-120b — gateway not configured",
      provider: "workers_ai",
      configured: false,
    });
  });
});

describe("resolveWriter with the gateway", () => {
  it("'anthropic' means the gateway when it is configured, even with no key", () => {
    const r = resolveWriter(env({ AI_GATEWAY_ID: "gw" }), "anthropic");
    expect(r).toEqual({ provider: "claude_gateway", model: DEFAULT_CLAUDE_MODEL });
  });

  it("'anthropic' means the direct key when there is no gateway", () => {
    const r = resolveWriter(env({ ANTHROPIC_API_KEY: "k" }), "anthropic");
    expect(r.provider).toBe("anthropic");
    expect(r.model).toMatch(/^claude-/);
  });

  it("still fails loudly when Claude was chosen and neither transport exists", () => {
    expect(() => resolveWriter(env(), "anthropic")).toThrow(
      /AI_GATEWAY_ID is not set and ANTHROPIC_API_KEY is not set/,
    );
  });

  it("an explicit Workers AI choice wins over a configured gateway", () => {
    expect(resolveWriter(env({ AI_GATEWAY_ID: "gw" }), "workers_ai").provider).toBe("workers_ai");
  });

  it("with no choice, the gateway is the deployment default", () => {
    expect(resolveWriter(env({ AI_GATEWAY_ID: "gw" }), null).provider).toBe("claude_gateway");
    expect(resolveWriter(env(), null).provider).toBe("workers_ai");
  });
});

// callRole and callResearchWriter hand the gateway provider to callLLM,
// under a ledger heading that names the provider that actually ran.
const calls: Array<Record<string, unknown>> = [];
vi.mock("../src/llm/index", () => ({
  callLLM: async (_env: unknown, input: Record<string, unknown>) => {
    calls.push(input);
    return {
      text: "",
      structured: null,
      tool_uses: [],
      model: input.model,
      provider: input.provider,
    };
  },
}));

describe("dispatch through callLLM", () => {
  const args = { userId: "u", system: "s", messages: [], max_tokens: 10 };

  it("callRole routes a judgement role to the gateway and relabels the ledger", async () => {
    const { callRole } = await import("../src/llm/router");
    calls.length = 0;
    await callRole(env({ AI_GATEWAY_ID: "gw" }), "bulk_extraction", args);
    expect(calls[0]).toMatchObject({
      provider: "claude_gateway",
      model: DEFAULT_CLAUDE_MODEL,
      reasoning_effort: undefined,
      ledger: { operation_type: "claude_gateway.extract.bulk" },
    });
  });

  it("callRole keeps a Workers AI model override on Workers AI", async () => {
    const { callRole } = await import("../src/llm/router");
    calls.length = 0;
    await callRole(env({ AI_GATEWAY_ID: "gw" }), "hard_extraction", {
      ...args,
      model: "@cf/meta/llama-4-scout-17b-16e-instruct",
    });
    expect(calls[0]).toMatchObject({
      provider: "workers_ai",
      model: "@cf/meta/llama-4-scout-17b-16e-instruct",
      reasoning_effort: "medium",
      ledger: { operation_type: "workers_ai.extract.hard" },
    });
  });

  it("callResearchWriter files the gateway under its own heading", async () => {
    const { callResearchWriter } = await import("../src/llm/router");
    calls.length = 0;
    await callResearchWriter(env({ AI_GATEWAY_ID: "gw" }), args, { writer: "anthropic" });
    expect(calls[0]).toMatchObject({
      provider: "claude_gateway",
      ledger: { operation_type: "claude_gateway.research_writer" },
    });
    calls.length = 0;
    await callResearchWriter(env({ AI_GATEWAY_ID: "gw" }), args, { writer: "workers_ai" });
    expect(calls[0]).toMatchObject({
      provider: "workers_ai",
      model: "@cf/openai/gpt-oss-120b",
      ledger: { operation_type: "workers_ai.research_writer" },
    });
  });
});

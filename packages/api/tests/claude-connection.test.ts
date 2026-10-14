// /admin/claude — whether Claude is connected, what is missing, and a test
// call made the way the workspace makes them. It shows whether each setting
// is present and never its value.

import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { renderClaude } from "../src/site/pages/claude";
import type { StreamFn } from "../src/write/agent";
import { testClaude } from "../src/write/connection";

const gateway = {
  AI_GATEWAY_ID: "canopticon",
  CF_AIG_TOKEN: "secret-token-value-123",
  CLOUDFLARE_ACCOUNT_ID: "acct-456",
  ANTHROPIC_API_KEY: "",
} as unknown as Env;
const none = { ANTHROPIC_API_KEY: "" } as unknown as Env;

const answering = (text: string): { stream: StreamFn; calls: unknown[] } => {
  const calls: unknown[] = [];
  const stream: StreamFn = (p) => {
    calls.push(p);
    return {
      on() {
        return this;
      },
      async finalMessage() {
        return {
          model: "claude-opus-5-5",
          content: [{ type: "text", text }],
        } as unknown as Anthropic.Beta.BetaMessage;
      },
    } as unknown as ReturnType<StreamFn>;
  };
  return { stream, calls };
};

describe("Claude's connection", () => {
  it("shows which settings are present, never their values", () => {
    const html = renderClaude(gateway);
    expect(html).toContain("Connected through Cloudflare");
    expect(html).not.toContain("secret-token-value-123");
    expect(html).not.toContain("acct-456");
    expect(renderClaude(none)).toContain("Not connected");
  });

  it("tests the way the workspace calls: same model, same features, web tools declared and not used", async () => {
    const { stream, calls } = answering("connected");
    const r = await testClaude(gateway, stream);
    expect(r).toMatchObject({ ok: true, route: "gateway", reply: "connected" });
    const p = calls[0] as { betas: string[]; tools: Array<{ name: string }>; tool_choice: unknown };
    expect(p.betas).toContain("thinking-binding-controls-2026-08-01");
    expect(p.tools.map((t) => t.name)).toEqual(expect.arrayContaining(["web_search", "web_fetch"]));
    expect(p.tool_choice).toEqual({ type: "none" });
  });

  it("says what the provider answered when it fails, and that nothing is set when nothing is", async () => {
    const failing: StreamFn = () =>
      ({
        on() {
          return this;
        },
        async finalMessage() {
          throw Object.assign(new Error("Unauthorized: invalid gateway token"), { status: 401 });
        },
      }) as unknown as ReturnType<StreamFn>;
    const r = await testClaude(gateway, failing);
    expect(r).toEqual({
      ok: false,
      route: "gateway",
      error: "401: Unauthorized: invalid gateway token",
    });
    expect(renderClaude(gateway, r)).toContain("401: Unauthorized");
    expect(await testClaude(none)).toMatchObject({ ok: false, route: null });
  });
});

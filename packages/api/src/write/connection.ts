// Is Claude connected? What the site can see of its configuration (whether
// each setting is present — never its value), and one small test call made
// exactly the way the workspace makes its calls: the same model, the same
// beta features, the web tools declared (and not used). If something the
// workspace relies on is not available, the test says so before a real read
// or research run does.

import type { Env } from "../env";
import { type StreamFn, WRITE_MODEL, anthropicStream, claudeRoute } from "./agent";
import { WEB_TOOLS } from "./research";

export interface Setting {
  name: string;
  set: boolean;
  what: string;
}

export function connectionSettings(env: Env): Setting[] {
  return [
    {
      name: "AI_GATEWAY_ID",
      set: !!env.AI_GATEWAY_ID,
      what: "The name of your AI Gateway (Cloudflare dashboard → AI → AI Gateway).",
    },
    {
      name: "CF_AIG_TOKEN",
      set: !!env.CF_AIG_TOKEN,
      what: "A gateway token, so the gateway knows the call is yours (the gateway's Settings → Authentication).",
    },
    {
      name: "CLOUDFLARE_ACCOUNT_ID",
      set: !!env.CLOUDFLARE_ACCOUNT_ID,
      what: "Your Cloudflare account id; the deploy already has it.",
    },
    {
      name: "ANTHROPIC_API_KEY",
      set: !!env.ANTHROPIC_API_KEY,
      what: "Only if you are not using the gateway: an Anthropic API key, billed by Anthropic.",
    },
  ];
}

export type TestResult =
  | { ok: true; route: "gateway" | "anthropic"; model: string; ms: number; reply: string }
  | { ok: false; route: "gateway" | "anthropic" | null; error: string };

/** One small call, made the way the workspace makes them. Costs a fraction
 *  of a cent: a few hundred input tokens, a few output tokens, no searches. */
export async function testClaude(env: Env, fake?: StreamFn): Promise<TestResult> {
  const route = claudeRoute(env);
  const stream = fake ?? (await anthropicStream(env));
  if (!route || !stream)
    return { ok: false, route: null, error: "Nothing is set yet, so there is nothing to test." };
  const t0 = Date.now();
  try {
    const m = await stream({
      model: WRITE_MODEL,
      max_tokens: 400,
      betas: [
        "server-side-fallback-2026-07-01",
        "thinking-binding-controls-2026-08-01",
        "context-management-2025-06-27",
      ],
      fallbacks: "default",
      thinking: { type: "adaptive", block_binding: { prefix_mismatch_behavior: "drop_block" } },
      output_config: { effort: "low" },
      // Declared so the request proves they are available; never called.
      tools: WEB_TOOLS,
      tool_choice: { type: "none" },
      messages: [{ role: "user", content: "Reply with one word: connected." }],
    }).finalMessage();
    const reply = m.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return { ok: true, route, model: m.model, ms: Date.now() - t0, reply: reply.slice(0, 200) };
  } catch (err) {
    const e = err as { status?: number; message?: string };
    return {
      ok: false,
      route,
      error: `${e.status ? `${e.status}: ` : ""}${(e.message ?? String(err)).slice(0, 600)}`,
    };
  }
}

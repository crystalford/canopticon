// Is Claude connected? What the site can see of its configuration (whether
// each setting is present — never its value), and one small test call made
// exactly the way the workspace makes its calls: the same model, the same
// beta features, the web tools declared (and not used). If something the
// workspace relies on is not available, the test says so before a real read
// or research run does.

import type { Env } from "../env";
import { type StreamFn, WRITE_MODEL, anthropicStream, claudeRoute } from "./agent";
import { ENGINES, advisorTool } from "./engines";
import { WEB_TOOLS } from "./research";
import { storedKey, storedKeyHint } from "./stored-key";

export interface Setting {
  name: string;
  set: boolean;
  what: string;
}

export function connectionSettings(env: Env): Setting[] {
  const hint = storedKeyHint();
  return [
    {
      name: hint ? `Key pasted here (…${hint})` : "Key pasted here",
      set: !!storedKey(),
      what:
        hint && !storedKey()
          ? "Saved, but it can no longer be read (the site's SESSION_SECRET changed). Paste it again."
          : "An Anthropic API key you paste below, stored encrypted. Billed by Anthropic, to your API credits.",
    },
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
      what: "The same, set as a GitHub secret instead. A key pasted here is used before it.",
    },
  ];
}

export type TestResult =
  | {
      ok: true;
      route: "gateway" | "anthropic";
      model: string;
      ms: number;
      reply: string;
      /** The cheaper Claude engine (Sonnet with Opus advice), tried the same way. */
      advised?: { ok: boolean; detail: string };
    }
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
        "thinking-display-updates-2026-08-18",
      ],
      fallbacks: "default",
      thinking: {
        type: "adaptive",
        display: "updates",
        block_binding: { prefix_mismatch_behavior: "drop_block" },
      },
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
    // The cheaper Claude engine: one tiny Sonnet call with the advisor tool
    // and its beta declared, so a rejected pairing or parameter shows here.
    let advised: { ok: boolean; detail: string } | undefined;
    const sonnet = ENGINES.find((e) => e.advisor);
    const tool = sonnet ? advisorTool(sonnet.id) : null;
    if (sonnet?.model && tool) {
      try {
        const a = await stream({
          model: sonnet.model,
          max_tokens: 200,
          betas: ["advisor-tool-2026-03-01", "thinking-display-updates-2026-08-18"],
          thinking: { type: "adaptive", display: "updates" },
          output_config: { effort: "low" },
          tools: [tool],
          messages: [{ role: "user", content: "Reply with one word: connected." }],
        }).finalMessage();
        advised = { ok: true, detail: `${a.model} answered` };
      } catch (err) {
        const e = err as { status?: number; message?: string };
        advised = {
          ok: false,
          detail: `${e.status ? `${e.status}: ` : ""}${(e.message ?? String(err)).slice(0, 300)}`,
        };
      }
    }
    return {
      ok: true,
      route,
      model: m.model,
      ms: Date.now() - t0,
      reply: reply.slice(0, 200),
      ...(advised ? { advised } : {}),
    };
  } catch (err) {
    const e = err as { status?: number; message?: string };
    return {
      ok: false,
      route,
      error: `${e.status ? `${e.status}: ` : ""}${(e.message ?? String(err)).slice(0, 600)}`,
    };
  }
}

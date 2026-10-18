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

// ---- the key pasted on /admin/claude ---------------------------------------------

import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { anthropicKey, claudeRoute } from "../src/write/agent";
import {
  forgetStoredKey,
  loadStoredKey,
  saveStoredKey,
  storedKey,
  storedKeyHint,
} from "../src/write/stored-key";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (
    p: string,
  ) => {
    exec(sql: string): void;
    prepare(sql: string): {
      all(...a: unknown[]): Array<Record<string, unknown>>;
      run(...a: unknown[]): unknown;
    };
  };
};
function sqliteD1() {
  const db = new DatabaseSync(":memory:");
  const dir = "../../supabase/migrations";
  for (const f of readdirSync(dir)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort())
    db.exec(readFileSync(`${dir}/${f}`, "utf8"));
  const d1 = {
    prepare(sql: string) {
      let args: unknown[] = [];
      const stmt = {
        bind(...a: unknown[]) {
          args = a;
          return stmt;
        },
        async all() {
          return { results: db.prepare(sql).all(...args) };
        },
        async first() {
          return db.prepare(sql).all(...args)[0] ?? null;
        },
        async run() {
          db.prepare(sql).run(...args);
          return { results: [], meta: {} };
        },
      };
      return stmt;
    },
  } as unknown as D1Database;
  return { db, d1 };
}

const KEY = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789-WXYZ";

describe("a key pasted on /admin/claude", () => {
  it("is stored encrypted, read back, and shown only by its last four characters", async () => {
    const { db, d1 } = sqliteD1();
    const env = { DB: d1, SESSION_SECRET: "s3cret", ANTHROPIC_API_KEY: "" } as unknown as Env;
    expect(await saveStoredKey(env, "not a key")).toMatchObject({ ok: false });
    expect(await saveStoredKey(env, ` ${KEY} `)).toEqual({ ok: true });
    const row = db.prepare("SELECT * FROM operator_secrets").all()[0] as Record<string, string>;
    expect(JSON.stringify(row)).not.toContain("abcdefghij");
    expect(row.hint).toBe("WXYZ");
    await loadStoredKey(env, true);
    expect(storedKey()).toBe(KEY);
    expect(storedKeyHint()).toBe("WXYZ");
    expect(claudeRoute(env)).toBe("anthropic");
    expect(renderClaude(env)).not.toContain("abcdefghij");
    expect(renderClaude(env)).toContain("…WXYZ");
    await forgetStoredKey(env);
    expect(storedKey()).toBeNull();
    expect(claudeRoute(env)).toBeNull();
  });

  it("is used before the deploy's secret, and unreadable once the session secret changes", async () => {
    const { d1 } = sqliteD1();
    const env = {
      DB: d1,
      SESSION_SECRET: "s3cret",
      ANTHROPIC_API_KEY: "sk-ant-from-github",
    } as unknown as Env;
    await saveStoredKey(env, KEY);
    expect(anthropicKey(env)).toBe(KEY);
    await loadStoredKey({ ...env, SESSION_SECRET: "rotated" } as Env, true);
    expect(storedKey()).toBeNull();
    expect(storedKeyHint()).toBe("WXYZ"); // the page can say a key was saved but is unreadable
    expect(anthropicKey(env)).toBe("sk-ant-from-github");
    await forgetStoredKey(env);
  });
});

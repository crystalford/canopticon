import { describe, expect, it } from "vitest";
import { buildSessionCookie, signSession } from "../src/auth/session.ts";
import app from "../src/index.ts";

const SECRET = "test-secret-for-affordances";

function makeEmptyDb(opts: { withOperator?: boolean } = {}): D1Database {
  const makeStmt = (sql: string) => ({
    bind() {
      return makeStmt(sql);
    },
    async first() {
      if (opts.withOperator && /FROM users/i.test(sql)) return { id: "op1" };
      return null;
    },
    async all() {
      return { results: [] };
    },
    async run() {
      return { results: [], meta: { changes: 0 } };
    },
  });
  return {
    prepare(sql: string) {
      return makeStmt(sql) as unknown as D1PreparedStatement;
    },
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}

const env = {
  ANTHROPIC_API_KEY: "test",
  LOG_LEVEL: "info",
  SESSION_SECRET: SECRET,
  DB: makeEmptyDb(),
};

async function loggedInRequest(path: string): Promise<Request> {
  const cookie = await signSession(
    { uid: "op1", exp: Math.floor(Date.now() / 1000) + 3600 },
    SECRET,
  );
  // Strip Path/HttpOnly/etc. from the Set-Cookie header — Cookie request
  // headers only carry name=value pairs.
  const cookieValue = buildSessionCookie(cookie).split(";")[0] as string;
  return new Request(`http://test${path}`, {
    headers: { cookie: cookieValue },
  });
}

describe("attachAuthState — the one-site permission middleware", () => {
  // /library became the operator's working surface (it lists working-material
  // and carries the upload dropzone), so an anonymous visitor is sent to the
  // published research index instead of being shown a stripped-down copy of it.
  it("anonymous /library redirects to the public research index", async () => {
    const res = await app.fetch(new Request("http://test/library"), env);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/research");
  });

  it("anonymous /research has no operator strip", async () => {
    const res = await app.fetch(new Request("http://test/research"), env);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).not.toContain('class="op-strip"');
  });

  it("anonymous / renders the public activity feed, not the stream", async () => {
    const res = await app.fetch(new Request("http://test/"), env);
    const html = await res.text();
    expect(res.status).toBe(200);
    // The stream is dark-themed (data-mode="operator"); the anonymous public
    // home is paper-themed (data-mode="public").
    expect(html).toContain('data-mode="public"');
    expect(html).not.toContain('data-mode="operator"');
  });

  it("a forged cookie value (wrong secret) is silently anonymous", async () => {
    // Sign with the WRONG secret — the middleware must verify, find it bad,
    // and fall through as anonymous (no throw).
    const cookie = await signSession(
      { uid: "op1", exp: Math.floor(Date.now() / 1000) + 3600 },
      "WRONG",
    );
    const cookieValue = buildSessionCookie(cookie).split(";")[0] as string;
    const res = await app.fetch(
      new Request("http://test/research", { headers: { cookie: cookieValue } }),
      env,
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain('class="op-strip"');
    // And the operator-only surface stays shut to it.
    const lib = await app.fetch(
      new Request("http://test/library", { headers: { cookie: cookieValue } }),
      env,
    );
    expect(lib.status).toBe(301);
  });

  it("a valid cookie reveals operator affordances on the SAME public page", async () => {
    const dbWithOperator = makeEmptyDb({ withOperator: true });
    const envWithOp = { ...env, DB: dbWithOperator };

    // Home: still data-mode="public" — the operator browses the same site
    // everyone reads, with affordances woven in. NO separate dark dashboard.
    // (Operator-overlay sections only populate when there's content; the
    // empty-DB stub means no drafts/findings/threads — we just assert the
    // chrome stays public.)
    const home = await app.fetch(await loggedInRequest("/"), envWithOp);
    expect(home.status).toBe(200);
    const homeHtml = await home.text();
    expect(homeHtml).toContain('data-mode="public"');
    expect(homeHtml).not.toContain('data-mode="operator"');

    // Library: operator sees the same paper page, plus the op-strip with the
    // bulk-extract actions. The operator strip only renders when the
    // operator is resolved (an operator row exists in the DB).
    const lib = await app.fetch(await loggedInRequest("/library"), envWithOp);
    expect(lib.status).toBe(200);
    const libHtml = await lib.text();
    expect(libHtml).toContain('class="op-strip"');

    // The upload dropzone itself — the actual backend/upload affordance the
    // op-strip exists to surface. Regression guard: an earlier "dissolve
    // /op/* as a destination" pass carried the extract buttons over to this
    // page but left the upload form behind on the dead /op/library screen,
    // so there was no reachable way to add a document at all.
    expect(libHtml).toContain('action="/op/feed/upload"');
    expect(libHtml).toContain('type="file"');

    // Every page also gets a small nav link back into /op/library once
    // logged in — otherwise the only way to find the console is knowing
    // the URL by heart.
    expect(homeHtml).toContain('href="/op/library"');
  });

  it("anonymous pages never show the upload form or the operator nav link", async () => {
    const res = await app.fetch(new Request("http://test/library"), env);
    const html = await res.text();
    expect(html).not.toContain('action="/op/feed/upload"');
    expect(html).not.toContain('href="/op/library"');
  });
});

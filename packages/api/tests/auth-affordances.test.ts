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
  // /library is the operator's working surface — it lists working-material and
  // carries the upload dropzone — so an anonymous visitor does not get in.
  //
  // WHAT THEY GET INSTEAD IS THE POINT. This used to 301 to /research, which
  // meant a lapsed session was indistinguishable from the page not existing:
  // the operator clicked through to upload, landed on a different page, and
  // had nothing to tell them why. They reported being unable to find where to
  // upload more than once, and this was the reason.
  it("anonymous /library says how to sign in rather than silently redirecting", async () => {
    const res = await app.fetch(new Request("http://test/library"), env);
    const html = await res.text();
    expect(res.status).toBe(401);
    expect(html).toContain("/auth/login");
    // Still no leak: the signed-out page must not show the working surface.
    expect(html).not.toContain('class="op-strip"');
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

  // The security property, unchanged by the above: a forged cookie is treated
  // as anonymous, so it gets the sign-in page and never the working surface.
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
    // And the operator-only surface stays shut to it — sign-in page, never
    // the working surface.
    const lib = await app.fetch(
      new Request("http://test/library", { headers: { cookie: cookieValue } }),
      env,
    );
    expect(lib.status).toBe(401);
    expect(await lib.text()).not.toContain('class="op-strip"');
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

    // Every page also gets a way back to the working surface once logged in
    // — otherwise the only way to find it is knowing the URL by heart.
    //
    // It points at /library directly now rather than /op/library, which was
    // a 302 to the same place. One less hop, and the href matches the nav
    // entry beside it so both say the same thing.
    expect(homeHtml).toContain('href="/library"');
  });

  it("anonymous pages never show the upload form or the operator nav link", async () => {
    const res = await app.fetch(new Request("http://test/library"), env);
    const html = await res.text();
    expect(html).not.toContain('action="/op/feed/upload"');
    expect(html).not.toContain('href="/op/library"');
  });
});

describe("the operator can find where to upload", () => {
  // THE OPERATOR REPORTED BEING UNABLE TO FIND THE UPLOAD BOX THREE TIMES.
  //
  // Twice it was treated as link placement and something got moved. It was
  // not that. PRIMARY_NAV is a fixed constant — Essays, Research, About —
  // with no branch for a signed-in operator, so the page they actually work
  // on had never appeared in the main navigation at any auth state. The only
  // route in was a topbar link labelled "operator →": an arrow, not a noun.
  //
  // These pin the fix at the level the failure actually occurred: not "a link
  // exists somewhere in the HTML", but "the word Library is in the nav, and
  // the operator bar says what it is for".
  it("puts Library in the primary nav once signed in", async () => {
    const dbWithOperator = makeEmptyDb({ withOperator: true });
    const res = await app.fetch(await loggedInRequest("/"), { ...env, DB: dbWithOperator });
    const html = await res.text();
    const nav = html.slice(html.indexOf('<nav class="nav">'));
    expect(nav.slice(0, 400)).toContain('href="/library"');
    expect(nav.slice(0, 400)).toContain("Library");
  });

  it("names the operator bar link instead of pointing an arrow at it", async () => {
    const dbWithOperator = makeEmptyDb({ withOperator: true });
    const res = await app.fetch(await loggedInRequest("/"), { ...env, DB: dbWithOperator });
    const html = await res.text();
    expect(html).toContain("Library — upload a document");
    // The old label said nothing about what was behind it.
    expect(html).not.toContain("operator →");
  });

  it("leaves a reader's nav completely unchanged", async () => {
    // The operator's entry must not become a fourth public section: a reader
    // has no account and nothing to do there.
    const res = await app.fetch(new Request("http://test/"), env);
    const html = await res.text();
    const nav = html.slice(html.indexOf('<nav class="nav">'));
    expect(nav.slice(0, 400)).not.toContain('href="/library"');
    expect(html).not.toContain("op-topbar");
  });
});

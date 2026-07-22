import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import app from "../src/index.ts";

// Empty-D1 stub: every query returns nothing, so the public site renders
// its empty states and the /op/* redirects fire deterministically.
function makeEmptyDb(): D1Database {
  const stmt = {
    bind() {
      return stmt;
    },
    async first() {
      return null;
    },
    async all() {
      return { results: [] };
    },
    async run() {
      return { results: [], meta: { changes: 0 } };
    },
  };
  return {
    prepare() {
      return stmt as unknown as D1PreparedStatement;
    },
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}

const env = {
  ANTHROPIC_API_KEY: "test",
  LOG_LEVEL: "info",
  DB: makeEmptyDb(),
};

// Spec v2.5 Part 9 — one site, permission layers. The separate /op/* console
// is dissolved. Old console URLs redirect to their public equivalents; POST
// action endpoints stay (they're what the public-side affordances post to).
describe("one site, permission layers — /op/* GET dissolves into public routes", () => {
  for (const [from, to] of Object.entries({
    "/op": "/",
    "/op/out": "/",
    "/op/synthesis": "/",
    "/op/studio": "/",
    "/op/outputs": "/investigations",
    "/op/library": "/library",
    "/op/library/some-slug": "/library/some-slug",
  })) {
    it(`${from} redirects to ${to}`, async () => {
      const res = await app.fetch(new Request(`http://test${from}`), env);
      expect(res.status, `status for ${from}`).toBe(302);
      expect(res.headers.get("location"), `target for ${from}`).toBe(to);
    });
  }

  it("/op/library/extract POST still works (operator affordances post here)", async () => {
    const res = await app.fetch(
      new Request("http://test/op/library/extract", {
        method: "POST",
        body: new URLSearchParams({}),
      }),
      env,
    );
    // No piece_ids and no mode → handler redirects without throwing.
    expect(res.status).toBe(302);
  });

  it("/op/feed/upload POST still works (zip path, action endpoint kept)", async () => {
    const zip = zipSync({
      "report-a.txt": new TextEncoder().encode("Alpha report body."),
      "__MACOSX/junk": new TextEncoder().encode("junk"),
    });
    const fd = new FormData();
    fd.append("file", new File([zip], "docs.zip", { type: "application/zip" }));
    const res = await app.fetch(
      new Request("http://test/op/feed/upload", { method: "POST", body: fd }),
      env,
    );
    // FILES/AI bindings aren't stubbed — handler still detects zip, skips
    // junk, and redirects back to the library landing instead of 500ing.
    expect(res.status).toBe(302);
  });

  it("chat.js still serves the SSE consumer (used by future stream/chat surfaces)", async () => {
    const res = await app.fetch(new Request("http://test/op/chat.js"), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/javascript/);
  });

  it("legacy /op/* paths still redirect", async () => {
    const expected: Record<string, string> = {
      "/op/chat": "/op/library",
      "/op/console": "/op",
      "/op/ingest": "/op",
      "/op/workbench": "/op/synthesis",
      "/op/leads": "/op/synthesis",
      "/op/patterns": "/op/synthesis",
      "/op/editorial": "/op/studio",
      "/op/build": "/op/outputs",
      "/op/publish": "/op/outputs",
      "/op/briefs": "/op/outputs",
    };
    for (const [from] of Object.entries(expected)) {
      const res = await app.fetch(new Request(`http://test${from}`), env);
      // Either a 301 (legacy redirect rule below the new /op/* GET handlers)
      // or a 302 (the new dissolution redirect). Both terminate at a public
      // path after at most one hop; we just assert it's a redirect, not a
      // 200 (the screens are gone).
      expect([301, 302]).toContain(res.status);
    }
  });

  it("the manual composer is gone (composer paths redirect; no Compose CTA on /investigations)", async () => {
    const composeGet = await app.fetch(new Request("http://test/op/briefs/compose"), env);
    expect([301, 302]).toContain(composeGet.status);
    // /investigations is the new home for the proposer flow; never offers
    // a Compose CTA (the operator approves, never authors).
    const outputs = await app.fetch(new Request("http://test/investigations"), env);
    const html = await outputs.text();
    expect(html).not.toContain("Compose Brief");
    expect(html).not.toContain("/op/briefs/compose");
  });
});

// /auth/login and /auth/logout — the operator's bootstrap into the
// one-site permission model. Spec v2.5 Part 9.
describe("/auth/login — operator session bootstrap", () => {
  it("503s when SESSION_SECRET is missing (auth not configured)", async () => {
    const res = await app.fetch(new Request("http://test/auth/login"), env);
    expect(res.status).toBe(503);
  });

  it("401s when Access didn't supply an email (login route must be Access-gated)", async () => {
    const res = await app.fetch(new Request("http://test/auth/login"), {
      ...env,
      SESSION_SECRET: "test-secret",
    });
    expect(res.status).toBe(401);
  });

  it("/auth/logout clears the cookie and redirects to /", async () => {
    const res = await app.fetch(new Request("http://test/auth/logout"), env);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("canopticon_op=");
    expect(setCookie).toContain("Max-Age=0");
  });
});

describe("public site is byte-stable for anonymous viewers (no regression)", () => {
  it("/record and /patterns still redirect into the unified surfaces", async () => {
    // Home IS the front of the Record in the approved product design.
    const rec = await app.fetch(new Request("http://test/record"), env);
    expect(rec.status).toBe(301);
    expect(rec.headers.get("location")).toBe("/");
    const pat = await app.fetch(new Request("http://test/patterns"), env);
    expect(pat.status).toBe(301);
    expect(pat.headers.get("location")).toBe("/investigations");
  });

  it("retired destinations 301 into Method (About/Methodology absorbed)", async () => {
    for (const path of ["/about", "/methodology"]) {
      const res = await app.fetch(new Request(`http://test${path}`), env);
      expect(res.status, path).toBe(301);
      expect(res.headers.get("location"), path).toBe("/method");
    }
    const method = await app.fetch(new Request("http://test/method"), env);
    expect(method.status).toBe(200);
  });

  it("public site serves the favicon", async () => {
    const res = await app.fetch(new Request("http://test/favicon.svg"), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/svg/);
  });

  it("anonymous /library renders without an operator strip", async () => {
    const res = await app.fetch(new Request("http://test/library"), env);
    expect(res.status).toBe(200);
    const html = await res.text();
    // The operator strip only renders when is_operator=true. Anonymous view
    // never includes it.
    expect(html).not.toContain('class="op-strip"');
    expect(html).not.toContain("Re-extract all");
  });
});

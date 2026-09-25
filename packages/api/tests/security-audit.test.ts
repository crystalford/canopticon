// Security audit, 2026-09-24 (docs/SECURITY-AUDIT-2026-09-24.md).
//
// Each block pins one fix from the audit of the operator and admin surface:
//
//   · a redirect target the operator's own form fields feed back to the
//     server is confined to this site — "/\evil.com" is "//evil.com" to a
//     browser, and both are refused;
//   · the research-draft review screen renders a MODEL-WRITTEN brief, built
//     from fetched third-party pages, through the publication's escaping
//     renderer and never through the cms one that passes raw HTML through;
//   · the share-card route only ever reaches one flat key under og/;
//   · the video-import status poll resolves a piece under the operator's own
//     user_id, like every other operator query.
//
// The mock D1 follows tests/workbench-replace.test.ts: one statement factory
// keyed on the SQL text, every call recorded with its bound params.

import { describe, expect, it } from "vitest";
import { buildSessionCookie, signSession } from "../src/auth/session.ts";
import app from "../src/index.ts";

const SECRET = "test-secret-for-security-audit";

interface Call {
  sql: string;
  params: unknown[];
}

const HOSTILE_BODY = `# A brief

Some prose, then a payload carried through a fetched page.

<script>alert("owned")</script>

<img src=x onerror="alert(1)">

Fine.`;

function makeEnv(opts: { videoStatus?: string } = {}) {
  const calls: Call[] = [];
  const mk = (sql: string) => {
    let bound: unknown[] = [];
    const stmt = {
      bind(...args: unknown[]) {
        bound = args;
        return stmt;
      },
      async first() {
        calls.push({ sql, params: bound });
        if (/FROM users/i.test(sql)) return { id: "op1" };
        if (
          /FROM pieces WHERE id = \? AND user_id = \? AND publication_status = 'working-material'/.test(
            sql,
          )
        ) {
          return {
            id: "draft1",
            slug: "a-brief",
            title: "A brief",
            body_md: HOSTILE_BODY,
            metadata: JSON.stringify({ label: "a question", source_piece_ids: [] }),
          };
        }
        if (/FROM video_imports WHERE id = \? AND user_id = \?/.test(sql)) {
          return {
            id: bound[0],
            user_id: "op1",
            status: opts.videoStatus ?? "succeeded",
            piece_id: "p1",
          };
        }
        if (/SELECT slug FROM pieces WHERE id = \?/.test(sql)) return { slug: "transcript" };
        return null;
      },
      async all() {
        calls.push({ sql, params: bound });
        return { results: [] };
      },
      async run() {
        calls.push({ sql, params: bound });
        return { results: [], meta: { changes: 0 } };
      },
    };
    return stmt as unknown as D1PreparedStatement;
  };
  const r2Gets: string[] = [];
  const env = {
    LOG_LEVEL: "error",
    SESSION_SECRET: SECRET,
    OPERATOR_EMAIL: "operator@example.com",
    DB: {
      prepare: (sql: string) => mk(sql),
      dump: async () => new ArrayBuffer(0),
      batch: async () => [],
      exec: async () => ({ count: 0, duration: 0 }),
    },
    FILES: {
      put: async () => {},
      get: async (key: string) => {
        r2Gets.push(key);
        return null;
      },
      head: async () => null,
    },
  };
  return { env, calls, r2Gets };
}

async function operatorCookie(): Promise<string> {
  const cookie = await signSession(
    { uid: "op1", exp: Math.floor(Date.now() / 1000) + 3600 },
    SECRET,
  );
  return buildSessionCookie(cookie).split(";")[0] as string;
}

async function postForm(env: object, path: string, body: Record<string, string>) {
  return app.fetch(
    new Request(`http://test${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: await operatorCookie(),
      },
      body: new URLSearchParams(body).toString(),
    }),
    env,
  );
}

describe("redirect targets are confined to this site", () => {
  it.each(["//evil.example", "/\\evil.example", "https://evil.example/x", "javascript:alert(1)"])(
    "POST /op/research/advance ignores return_to=%s",
    async (bad) => {
      const { env } = makeEnv();
      const res = await postForm(env, "/op/research/advance", { return_to: bad });
      expect(res.status).toBe(302);
      const loc = res.headers.get("location") ?? "";
      expect(loc.startsWith("/library?research=")).toBe(true);
    },
  );

  it("POST /op/research/advance honours a plain same-site path", async () => {
    const { env } = makeEnv();
    const res = await postForm(env, "/op/research/advance", {
      return_to: "/op/research?q=housing",
    });
    expect(res.headers.get("location")).toBe("/op/research?q=housing");
  });

  it.each(["//evil.example", "/\\evil.example", "https://evil.example"])(
    "/op/login?next=%s lands on /",
    async (bad) => {
      const { env } = makeEnv();
      const res = await app.fetch(
        new Request(`http://test/op/login?next=${encodeURIComponent(bad)}`, {
          headers: { "cf-access-authenticated-user-email": "operator@example.com" },
        }),
        env,
      );
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/");
    },
  );
});

describe("the research-draft review screen escapes what a model wrote", () => {
  it("never emits raw HTML from the brief body", async () => {
    const { env } = makeEnv();
    const res = await app.fetch(
      new Request("http://test/op/library/research/draft1/review", {
        headers: { cookie: await operatorCookie() },
      }),
      env,
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain('onerror="alert');
    expect(html).toContain("&lt;script&gt;alert");
    // The legitimate prose still renders.
    expect(html).toContain("Some prose");
  });
});

describe("GET /og/:file reaches one flat key under og/", () => {
  it("serves og/<name>.png and nothing else", async () => {
    const { env, r2Gets } = makeEnv();
    const ok = await app.fetch(new Request("http://test/og/housing-record.png"), env);
    expect(ok.status).toBe(404); // the mock bucket is empty
    expect(r2Gets).toEqual(["og/housing-record.png"]);
  });

  it.each(["..%2Fuploads%2Fop1%2Fx.png", "a%2Fb.png", "..png", "x.png%00", "notes.txt"])(
    "refuses %s before touching R2",
    async (bad) => {
      const { env, r2Gets } = makeEnv();
      const res = await app.fetch(new Request(`http://test/og/${bad}`), env);
      expect(res.status).toBe(404);
      expect(r2Gets).toEqual([]);
    },
  );
});

describe("operator queries are keyed on the operator", () => {
  it("the video-import status poll resolves the piece under user_id", async () => {
    const { env, calls } = makeEnv();
    const res = await app.fetch(
      new Request("http://test/op/library/import-video/vi1/status", {
        headers: { cookie: await operatorCookie() },
      }),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reviewUrl?: string };
    expect(body.reviewUrl).toBe("/library/transcript");
    const pieceLookup = calls.find((c) => /SELECT slug FROM pieces WHERE id = \?/.test(c.sql));
    expect(pieceLookup).toBeDefined();
    expect(pieceLookup?.sql).toMatch(/AND user_id = \?/);
    expect(pieceLookup?.params).toEqual(["p1", "op1"]);
  });
});

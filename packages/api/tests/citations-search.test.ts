import { describe, expect, it } from "vitest";
import { buildSessionCookie, signSession } from "../src/auth/session.ts";
import app from "../src/index.ts";

const SECRET = "test-secret-citations-search";

// Reusable DB stub. citation_hits queries return the supplied rows; the
// users lookup returns the operator id when withOperator=true (so
// resolveOperatorId in render/search.ts resolves).
function makeDb(
  opts: {
    withOperator?: boolean;
    citationSummary?: Array<{ bot: string; hits: number; days_active: number }>;
    citationTopPaths?: Array<{ path: string; hits: number; bots: number }>;
    citationRecent?: Array<{ path: string; bot: string; created_at: string }>;
  } = {},
): D1Database {
  const summary = opts.citationSummary ?? [];
  const topPaths = opts.citationTopPaths ?? [];
  const recent = opts.citationRecent ?? [];
  const makeStmt = (sql: string) => ({
    bind() {
      return makeStmt(sql);
    },
    async first() {
      if (opts.withOperator && /FROM users/i.test(sql)) return { id: "op1" };
      return null;
    },
    async all() {
      if (/GROUP BY bot/i.test(sql)) return { results: summary };
      if (/GROUP BY path/i.test(sql)) return { results: topPaths };
      if (/FROM citation_hits[\s\S]*ORDER BY created_at DESC/i.test(sql))
        return { results: recent };
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
  DB: makeDb(),
};

async function operatorRequest(path: string): Promise<Request> {
  const cookie = await signSession(
    { uid: "op1", exp: Math.floor(Date.now() / 1000) + 3600 },
    SECRET,
  );
  const cookieValue = buildSessionCookie(cookie).split(";")[0] as string;
  return new Request(`http://test${path}`, { headers: { cookie: cookieValue } });
}

describe("/citations — operator-only ledger of AI-crawler hits", () => {
  it("redirects anonymous viewers to /", async () => {
    const res = await app.fetch(new Request("http://test/citations"), env);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
  });

  it("renders the empty state cleanly when no hits captured yet", async () => {
    const opEnv = { ...env, DB: makeDb({ withOperator: true }) };
    const res = await app.fetch(await operatorRequest("/citations"), opEnv);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Citations — the AI-crawler ledger");
    expect(html).toContain("No bot hits in the last 30 days yet");
  });

  it("renders summary / top paths / recent activity when hits exist", async () => {
    const opEnv = {
      ...env,
      DB: makeDb({
        withOperator: true,
        citationSummary: [
          { bot: "claudebot", hits: 42, days_active: 8 },
          { bot: "gptbot", hits: 17, days_active: 5 },
        ],
        citationTopPaths: [{ path: "/s/mark-carney", hits: 12, bots: 3 }],
        citationRecent: [
          { path: "/s/mark-carney", bot: "claudebot", created_at: "2026-06-12T18:00:00Z" },
        ],
      }),
    };
    const res = await app.fetch(await operatorRequest("/citations"), opEnv);
    const html = await res.text();
    expect(html).toContain("claudebot");
    expect(html).toContain("gptbot");
    expect(html).toContain("/s/mark-carney");
    // The three-stat strip
    expect(html).toContain('class="cit-stat-n">59'); // 42 + 17 total hits
    expect(html).toContain('class="cit-stat-n">2'); // bots
  });
});

describe("/search — public semantic search", () => {
  it("renders the search shell when ?q= is empty (no Vectorize call)", async () => {
    const res = await app.fetch(new Request("http://test/search"), env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Ask the record");
    expect(html).toContain('name="q"');
    // No results panel on an empty query.
    expect(html).not.toContain("matches for");
  });

  it("preserves the query in the input when ?q=carney is set", async () => {
    // Empty users table → resolveOperatorId returns null → renderer
    // short-circuits without calling Workers AI / Vectorize. That gives
    // us a deterministic test for the shell shape.
    const res = await app.fetch(new Request("http://test/search?q=carney"), env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('value="carney"');
  });
});

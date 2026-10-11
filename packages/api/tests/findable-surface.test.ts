// Findability (docs/the-record.md §7): section hubs, the breadcrumb and site
// entities in every document's JSON-LD, /llms-full.txt, and the IndexNow key
// file. Everything asserted here is something a crawler reads and a human
// does not, so nothing in the UI would say when it broke.

import { describe, expect, it } from "vitest";
import app from "../src/index.ts";

const DOC_A = {
  id: "pa",
  slug: "rent-report-2026",
  title: "Rent report 2026",
  subtitle: "Asking rents across twelve cities.",
  kind: "report",
  subtype: null,
  publication_status: "published",
  byline: null,
  published_at: "2026-05-01T00:00:00.000Z",
  signed_by: null,
  body_md: "# Rent report 2026\n\nAsking rents rose 4.1% in the year to March.\n",
  body_html: null,
  chain_id: null,
  tags: "[]",
  metadata: "{}",
  argument_summary_md: null,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-06-01T00:00:00.000Z",
  topic: "Housing & cities",
};

const DOC_B = {
  ...DOC_A,
  id: "pb",
  slug: "zoning-memo",
  title: "Zoning memo",
  subtitle: null,
  body_md: "# Zoning memo\n\nThe by-law permits four units per lot.\n",
  published_at: "2026-04-01T00:00:00.000Z",
  updated_at: "2026-04-02T00:00:00.000Z",
};

// A third document in another section, so /research takes its grouped path.
const DOC_C = {
  ...DOC_A,
  id: "pc",
  slug: "attention-study",
  title: "Attention study",
  subtitle: null,
  body_md: "# Attention study\n\nMedian session length fell to 41 seconds.\n",
  topic: "Media & information",
  published_at: "2026-03-01T00:00:00.000Z",
  updated_at: "2026-03-01T00:00:00.000Z",
};

const DOCS = [DOC_A, DOC_B, DOC_C];

function makeDb(): D1Database {
  const mk = (sql: string) => {
    let bound: unknown[] = [];
    const stmt = {
      bind(...args: unknown[]) {
        bound = args;
        return stmt;
      },
      async first() {
        if (/FROM users/i.test(sql)) return { id: "u1" };
        if (/FROM pieces WHERE user_id = \? AND slug = \?/i.test(sql)) {
          return DOCS.find((d) => d.slug === bound[1]) ?? null;
        }
        if (/SELECT topic FROM pieces WHERE id = \?/i.test(sql)) {
          return DOCS.find((d) => d.id === bound[0]) ?? null;
        }
        if (/COUNT\(\*\)/i.test(sql)) return { n: 0 };
        return null;
      },
      async all() {
        if (/FROM pieces/i.test(sql) && /publication_status IN/i.test(sql)) {
          return { results: DOCS };
        }
        return { results: [] };
      },
      async run() {
        return { results: [], meta: { changes: 0 } };
      },
    };
    return stmt as unknown as D1PreparedStatement;
  };
  return {
    prepare: (sql: string) => mk(sql),
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}

const baseEnv = {
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_SERVICE_ROLE_KEY: "test",
  ANTHROPIC_API_KEY: "test",
  OPENPARLIAMENT_USER_AGENT: "test",
  LOG_LEVEL: "info",
  DB: makeDb(),
};

const get = (path: string, env: Record<string, unknown> = baseEnv) =>
  app.fetch(new Request(`http://test${path}`), env);

describe("IndexNow key file", () => {
  it("404s when no key is configured", async () => {
    const res = await get("/abcdef1234567890.txt");
    expect(res.status).toBe(404);
  });

  it("serves the configured key and nothing else", async () => {
    const env = { ...baseEnv, INDEXNOW_KEY: "abcdef1234567890" };
    const ok = await get("/abcdef1234567890.txt", env);
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("abcdef1234567890\n");
    const other = await get("/fedcba0987654321.txt", env);
    expect(other.status).toBe(404);
  });
});

// The machine-readable surface: sitemap, robots, llms.txt, feed.json, the
// markdown twin, and the structured data on a piece page.
//
// These exist because the failure they guard against is silent. A sitemap
// that enumerates the wrong table, a canonical tag that is never emitted, or
// a .md twin served as a file download all render a perfectly fine-looking
// page that no search or answer engine can use — and nothing in the UI says
// so. Every assertion here is something a crawler sees and a human doesn't.

import { describe, expect, it } from "vitest";
import app from "../src/index.ts";

const PIECE = {
  id: "p1",
  slug: "the-logic-costume",
  title: "The Logic Costume",
  subtitle: "Authority performed as logic is still a performance.",
  kind: "essay",
  subtype: null,
  publication_status: "published",
  byline: null,
  published_at: "2026-06-14T00:00:00.000Z",
  signed_by: null,
  body_md:
    "A person who claims to run on logic has made a testable claim.\n\n" +
    "## What is the logic costume?\n\n" +
    "Authority borrowed from a method by someone who does not submit to its checks.\n\n" +
    "## Sources\n\n1. Author. Title. Publisher, 2026.\n",
  body_html: null,
  chain_id: null,
  tags: "[]",
  metadata: "{}",
  argument_summary_md: null,
  created_at: "2026-06-14T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
};

// A D1 stub that answers by inspecting the SQL, so the real query paths run.
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
          return bound[1] === PIECE.slug ? PIECE : null;
        }
        if (/COUNT\(\*\)/i.test(sql)) return { n: 0 };
        return null;
      },
      async all() {
        if (/FROM pieces/i.test(sql) && /publication_status IN/i.test(sql)) {
          return { results: [PIECE] };
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

const env = {
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_SERVICE_ROLE_KEY: "test",
  ANTHROPIC_API_KEY: "test",
  OPENPARLIAMENT_USER_AGENT: "test",
  LOG_LEVEL: "info",
  DB: makeDb(),
};

const get = (path: string) => app.fetch(new Request(`http://test${path}`), env);

describe("machine-readable surface", () => {
  it("robots.txt invites AI crawlers by name and points at the sitemap", async () => {
    const res = await get("/robots.txt");
    expect(res.status).toBe(200);
    const txt = await res.text();
    for (const bot of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "CCBot"]) {
      expect(txt, bot).toContain(`User-agent: ${bot}`);
    }
    expect(txt).toContain("Disallow: /op/");
    expect(txt).toContain("Sitemap: https://canopticon.com/sitemap.xml");
  });

  it("the markdown twin is served inline, never as a download", async () => {
    const res = await get(`/p/${PIECE.slug}.md`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/markdown/);
    // Served as an attachment, this is a file download rather than a twin —
    // which is the one thing a crawler cannot follow usefully.
    expect(res.headers.get("content-disposition")).toBeNull();
    const md = await res.text();
    expect(md).toContain(`# ${PIECE.title}`);
    expect(md).toContain(`Canonical: https://canopticon.com/p/${PIECE.slug}`);
    expect(md).toContain("CC BY 4.0");
    expect(md).toContain("## What is the logic costume?");
  });
});

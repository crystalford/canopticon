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
  it("sitemap lists published pieces, not just subject pages", async () => {
    const res = await get("/sitemap.xml");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/xml/);
    const xml = await res.text();
    // The bug this guards: the sitemap enumerated `pages` only, so every
    // uploaded document was invisible to search engines.
    expect(xml).toContain(`https://canopticon.com/p/${PIECE.slug}`);
    expect(xml).toContain("<lastmod>2026-09-01</lastmod>");
    expect(xml).toContain("https://canopticon.com/essays");
    expect(xml).toContain("https://canopticon.com/research");
  });

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

  it("llms.txt lists pieces as markdown twins", async () => {
    const res = await get("/llms.txt");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/plain/);
    const txt = await res.text();
    expect(txt).toContain("# Canopticon");
    expect(txt).toContain(`https://canopticon.com/p/${PIECE.slug}.md`);
    expect(txt).toContain(PIECE.title);
  });

  it("feed.json is a valid JSON Feed 1.1 document", async () => {
    const res = await get("/feed.json");
    expect(res.status).toBe(200);
    const feed = JSON.parse(await res.text());
    expect(feed.version).toBe("https://jsonfeed.org/version/1.1");
    expect(feed.feed_url).toBe("https://canopticon.com/feed.json");
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0].url).toBe(`https://canopticon.com/p/${PIECE.slug}`);
    expect(feed.items[0].date_published).toMatch(/^2026-06-14T/);
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

  it("a piece page emits Article JSON-LD, canonical and OpenGraph", async () => {
    const res = await get(`/p/${PIECE.slug}`);
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain(
      `<link rel="canonical" href="https://canopticon.com/p/${PIECE.slug}" />`,
    );
    expect(html).toContain('<meta property="og:type" content="article" />');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(html).toContain(
      `<link rel="alternate" type="text/markdown" href="https://canopticon.com/p/${PIECE.slug}.md" />`,
    );

    const ld = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    expect(ld, "piece page must carry JSON-LD").not.toBeNull();
    const doc = JSON.parse((ld?.[1] ?? "{}") as string);
    expect(doc["@type"]).toBe("Article");
    expect(doc.url).toBe(`https://canopticon.com/p/${PIECE.slug}`);
    expect(doc.license).toBe("https://creativecommons.org/licenses/by/4.0/");
    expect(doc.isAccessibleForFree).toBe(true);
    // The "## Sources" block becomes citation[] — a listed source is a claim
    // about provenance and belongs in the machine face too.
    expect(doc.citation).toEqual(["Author. Title. Publisher, 2026."]);
    expect(doc.speakable).toBeTruthy();
  });
});

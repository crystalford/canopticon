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

function ldDocs(html: string): Array<Record<string, unknown>> {
  return [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) =>
    JSON.parse(m[1] ?? "{}"),
  );
}

describe("section hubs", () => {
  it("renders a hub for a closed section with its documents and CollectionPage LD", async () => {
    const res = await get("/research/housing-cities");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<h1>Housing &amp; cities</h1>");
    expect(html).toContain('href="/p/rent-report-2026"');
    expect(html).toContain('href="/p/zoning-memo"');
    expect(html).toContain(
      '<link rel="canonical" href="https://canopticon.com/research/housing-cities" />',
    );
    const docs = ldDocs(html);
    const coll = docs.find((d) => d["@type"] === "CollectionPage");
    expect(coll).toBeTruthy();
    expect((coll?.mainEntity as { numberOfItems: number }).numberOfItems).toBe(2);
    const crumbs = docs.find((d) => d["@type"] === "BreadcrumbList");
    expect(crumbs).toBeTruthy();
  });

  it("renders an empty section honestly, and 404s an unknown slug", async () => {
    const empty = await get("/research/public-health");
    expect(empty.status).toBe(200);
    expect(await empty.text()).toContain("No documents filed in this section yet.");

    const missing = await get("/research/not-a-section");
    expect(missing.status).toBe(404);
  });

  it("/research links each section heading to its hub", async () => {
    const html = await (await get("/research")).text();
    expect(html).toContain('<a href="/research/housing-cities">Housing &amp; cities</a>');
    expect(html).toContain('<a href="/research/media-information">Media &amp; information</a>');
    const sitemap = await (await get("/sitemap.xml")).text();
    expect(sitemap).toContain("<loc>https://canopticon.com/research/housing-cities</loc>");
    expect(sitemap).toContain("<loc>https://canopticon.com/search</loc>");
    // Empty hubs are not announced.
    expect(sitemap).not.toContain("/research/public-health");
    const llms = await (await get("/llms.txt")).text();
    expect(llms).toContain("## Sections");
    expect(llms).toContain("https://canopticon.com/research/housing-cities");
    expect(llms).toContain("https://canopticon.com/llms-full.txt");
  });
});

describe("document structured data", () => {
  it("carries BreadcrumbList, isPartOf WebSite with SearchAction, and a Person author", async () => {
    const res = await get("/p/rent-report-2026");
    expect(res.status).toBe(200);
    const html = await res.text();
    const docs = ldDocs(html);
    const main = docs[0] as Record<string, unknown>;
    expect(main["@type"]).toBe("DigitalDocument");
    const site = main.isPartOf as Record<string, unknown>;
    expect(site["@type"]).toBe("WebSite");
    expect(site["@id"]).toBe("https://canopticon.com/#site");
    expect(
      ((site.potentialAction as Record<string, unknown>).target as Record<string, unknown>)
        .urlTemplate,
    ).toBe("https://canopticon.com/search?q={search_term_string}");
    expect((main.publisher as Record<string, unknown>)["@id"]).toBe("https://canopticon.com/#org");
    const author = main.author as Record<string, unknown>;
    expect(author["@type"]).toBe("Person");
    expect(author.sameAs).toEqual(["https://twitter.com/canoptics"]);

    const crumbs = docs.find((d) => d["@type"] === "BreadcrumbList") as Record<string, unknown>;
    expect(crumbs).toBeTruthy();
    const names = (crumbs.itemListElement as Array<{ name: string }>).map((i) => i.name);
    expect(names).toEqual(["Home", "Research", "Housing & cities", "Rent report 2026"]);
    // The visible trail matches the machine one.
    expect(html).toContain('<a href="/research/housing-cities">Housing &amp; cities</a>');
  });
});

describe("/llms-full.txt", () => {
  it("concatenates every published document's twin with separators and headers", async () => {
    const res = await get("/llms-full.txt");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/plain/);
    expect(res.headers.get("cache-control")).toContain("max-age=3600");
    const txt = await res.text();
    expect(txt).toContain("3 documents");
    expect(txt).toContain(
      "Rent report 2026 · https://canopticon.com/p/rent-report-2026 · 2026-05-01",
    );
    expect(txt).toContain("Zoning memo · https://canopticon.com/p/zoning-memo · 2026-04-01");
    expect(txt).toContain("Asking rents rose 4.1% in the year to March.");
    expect(txt).toContain("The by-law permits four units per lot.");
    // Two documents, two separators, each followed by a document header.
    expect(txt.match(/\n---\n\n<!-- /g)?.length).toBe(3);
    expect(txt.indexOf("Rent report 2026 ·")).toBeLessThan(txt.indexOf("Zoning memo ·"));
  });
});

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

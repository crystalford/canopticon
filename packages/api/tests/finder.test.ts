// The free source finder: news, papers, health research, Wikipedia and
// government data at once, keyless; Cloudflare's paid search only when it
// can bill.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";
import { pageLinks, resetPaidSearch, webSearch } from "../src/write/engines";
import { findSources } from "../src/write/finder";

afterEach(() => {
  vi.unstubAllGlobals();
  resetPaidSearch();
});

const answers: Record<string, unknown> = {
  "api.gdeltproject.org": {
    articles: [
      {
        url: "https://news.example/a",
        title: "Pharmacare deal",
        domain: "news.example",
        seendate: "20261002T1200Z",
      },
    ],
  },
  "api.crossref.org": {
    message: {
      items: [
        {
          URL: "https://doi.org/10.1/x",
          title: ["A study"],
          "container-title": ["J"],
          issued: { "date-parts": [[2025]] },
          type: "journal-article",
        },
      ],
    },
  },
  "en.wikipedia.org": {
    query: { search: [{ title: "Pharmacare Act", snippet: "The <b>Act</b>" }] },
  },
  "www.ebi.ac.uk": {
    resultList: {
      result: [{ title: "Drug coverage", doi: "10.2/y", journalTitle: "CMAJ", pubYear: "2024" }],
    },
  },
  "open.canada.ca": {
    result: {
      results: [
        { name: "drug-data", title: "Drug spending", organization: { title: "Health Canada" } },
      ],
    },
  },
};

function stubSources(fail: string[] = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const host = new URL(url).hostname;
      if (fail.includes(host)) return new Response("Please limit requests", { status: 200 });
      return new Response(JSON.stringify(answers[host] ?? {}), { status: 200 });
    }),
  );
}

describe("the free source finder", () => {
  it("asks every source at once and labels what each result is", async () => {
    stubSources();
    const r = await findSources("pharmacare");
    expect(r.map((x) => x.url)).toEqual([
      "https://news.example/a",
      "https://doi.org/10.1/x",
      "https://en.wikipedia.org/wiki/Pharmacare_Act",
      "https://doi.org/10.2/y",
      "https://open.canada.ca/data/en/dataset/drug-data",
    ]);
    expect(r[0]?.description).toContain("[news · news.example · 20261002]");
    expect(r[2]?.description).toContain("follow its references");
  });

  it("leaves out a source that answers with something other than JSON", async () => {
    stubSources(["api.gdeltproject.org"]);
    const r = await findSources("pharmacare");
    expect(r.some((x) => x.url.includes("news.example"))).toBe(false);
    expect(r).toHaveLength(4);
  });

  it("uses Cloudflare's paid search only when it can bill, and the free finder otherwise", async () => {
    stubSources();
    let paid = 0;
    const env = {
      SEARCH_GATEWAY_ID: "canopticon-search",
      AI: {
        websearch: async () => {
          paid++;
          throw new Error("402: Your AI Gateway credit balance is zero");
        },
      },
    } as unknown as Env;
    const first = await webSearch(env, "pharmacare");
    expect(first[0]?.url).toBe("https://news.example/a");
    await webSearch(env, "pharmacare again");
    // After a "cannot bill", the paid search is not asked again for a while.
    expect(paid).toBe(1);
    // No gateway at all: straight to the free finder.
    const none = await webSearch({ AI: {} } as unknown as Env, "pharmacare");
    expect(none).toHaveLength(5);
  });
});

describe("a page's links", () => {
  it("keeps reports, data and deeper pages, first; drops menus, log-ins and anchors", () => {
    const html = `<a href="/login">Log in</a><a href="#top">Top</a>
      <a href="/about">About this department</a>
      <a href="https://other.example/x">Some other site</a>
      <a href="/reports/2025-annual.pdf">Annual report 2025</a>
      <a href="/data/table-1">Data table: drug spending</a>`;
    const l = pageLinks(html, "https://gov.example/page");
    expect(l.map((x) => x.url)).toEqual([
      "https://gov.example/reports/2025-annual.pdf",
      "https://gov.example/data/table-1",
      "https://gov.example/about",
      "https://other.example/x",
    ]);
  });
});

describe("search engines' result pages", () => {
  it("are recognised and refused; scholarly APIs and ordinary pages are not", async () => {
    const { isSearchEnginePage } = await import("../src/write/finder");
    for (const u of [
      "https://html.duckduckgo.com/html/?q=pharmacare",
      "https://lite.duckduckgo.com/lite/?q=x",
      "https://www.bing.com/search?q=x",
      "https://search.brave.com/search?q=x",
      "https://www.google.com/search?q=x",
      "https://scholar.google.com/scholar?q=x",
      "https://search.marginalia.nu/search?query=x",
    ])
      expect(isSearchEnginePage(u)).toBe(true);
    for (const u of [
      "https://api.crossref.org/works?query=x",
      "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=x",
      "https://www.canada.ca/en/health-canada.html",
      "https://blog.google/technology/",
      "https://en.wikipedia.org/wiki/Pharmacare",
    ])
      expect(isSearchEnginePage(u)).toBe(false);
  });
});

describe("queries for the keyword sources", () => {
  it("lose quotation marks and operators and keep eight words", async () => {
    const { keywords } = await import("../src/write/finder");
    expect(keywords('"laws of media" McLuhan tetrad critique "procrustean" OR -blog')).toBe(
      "laws of media McLuhan tetrad critique procrustean blog",
    );
    expect(keywords("one two three four five six seven eight nine ten")).toBe(
      "one two three four five six seven eight",
    );
  });

  it("asks the book and paper indexes too", async () => {
    const asked: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        asked.push(new URL(url).hostname);
        return new Response("{}");
      }),
    );
    await findSources('"tetrad" McLuhan');
    expect(asked.sort()).toEqual(
      [
        "api.crossref.org",
        "api.gdeltproject.org",
        "api.semanticscholar.org",
        "archive.org",
        "en.wikipedia.org",
        "open.canada.ca",
        "openlibrary.org",
        "www.ebi.ac.uk",
      ].sort(),
    );
  });
});

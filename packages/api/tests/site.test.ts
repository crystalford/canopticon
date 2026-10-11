// The Black Box site — what it must always do, and what it must never do.
//
// docs/blackbox/README.md §Rules that must survive the port, as tests:
// verbatim or nothing; held documents on no public surface; projects private;
// no JavaScript required to read; every quote links to its passage. Plus the
// shapes the machine face promises (feeds, sitemap, llms.txt) and the
// redirects that keep the live site's URLs answering.

import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFrontMatter, verbatimNormal } from "../scripts/build-content.mjs";
import app from "../src/index";
import { privatePage, staticPage } from "../src/site/content/store";
import { articleQuotes } from "../src/site/md";
import { matchLabels } from "../src/site/pages/article";
import { searchTerms } from "../src/site/pages/search";
import { SITE_CSS } from "../src/site/styles";

function makeDb(): D1Database {
  const stmt = {
    bind: () => stmt,
    first: async () => null,
    all: async () => ({ results: [] }),
    run: async () => ({ results: [], meta: { changes: 0 } }),
  };
  return {
    prepare: () => stmt,
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}

const env = { ANTHROPIC_API_KEY: "test", LOG_LEVEL: "error", DB: makeDb() };
const get = (path: string) => app.fetch(new Request(`http://test${path}`), env);
const text = async (path: string) => (await get(path)).text();

const HELD = readdirSync("content/research-held").map((f) => f.replace(/\.md$/, ""));
const ARTICLES = readdirSync("content/articles").map((f) => f.replace(/\.md$/, ""));

describe("the content store", () => {
  it("parses the handoff's front matter, including based_on lists", () => {
    const { meta, body } = parseFrontMatter(
      '---\nslug: "a"\nquotes: 3\nlisted: true\nbased_on: \n  - id: doc-1\n    label: "One &quot;doc&quot;"\n---\nBody',
    );
    expect(meta).toEqual({
      slug: "a",
      quotes: 3,
      listed: true,
      based_on: [{ id: "doc-1", label: 'One "doc"' }],
    });
    expect(body).toBe("Body");
  });

  it("forgives only emphasis and code marks when checking a quote (ESSAY-CONTRACT §4)", () => {
    expect(verbatimNormal("a **bold** `code` claim")).toBe("a bold code claim");
    // Not whitespace, not quote style, not case, not punctuation.
    expect(verbatimNormal("a\n  claim")).not.toBe(verbatimNormal("a claim"));
    expect(verbatimNormal("“x”")).not.toBe(verbatimNormal('"x"'));
    expect(verbatimNormal("X")).not.toBe(verbatimNormal("x"));
  });
});

describe("held documents never reach a public surface", () => {
  it("there are held documents to guard", () => {
    expect(HELD.length).toBeGreaterThan(0);
  });

  it.each(HELD)("%s is not served, twinned, listed, fed or searchable", async (id) => {
    expect((await get(`/p/${id}`)).status).toBe(404);
    expect((await get(`/p/${id}.md`)).status).toBe(404);
    expect((await get(`/p/${id}.json`)).status).toBe(404);
    for (const path of ["/library", "/sitemap.xml", "/llms.txt", "/feed.json", "/investigations"]) {
      expect(await text(path), `${id} on ${path}`).not.toContain(id);
    }
  });

  it("no article quotes a held document", () => {
    for (const slug of ARTICLES) {
      const body = readFileSync(`content/articles/${slug}.md`, "utf8");
      for (const q of articleQuotes(body))
        expect(HELD, `${slug} quotes ${q.doc}`).not.toContain(q.doc);
    }
  });
});

describe("projects are private", () => {
  it("project hubs are not listed for a reader", async () => {
    const lib = await text("/library");
    expect(lib).not.toContain("/admin/projects/");
    expect(lib).not.toContain(">Projects<");
    expect(await text("/sitemap.xml")).not.toContain("/admin");
  });

  it("a project page asks a reader to sign in, and is not a public page", async () => {
    for (const p of ["/admin/projects/aldershot", "/admin/projects/ancaster"]) {
      const res = await get(p);
      expect(res.status).toBe(401);
      expect(await res.text()).not.toContain("Ported as-is");
    }
    expect(staticPage("/admin/projects/aldershot")).toBeNull();
    expect(privatePage("/admin/projects/aldershot")?.title).toBe("Aldershot");
    expect(privatePage("/about")).toBeNull();
  });
});

describe("a withdrawn draft", () => {
  it("says so, keeps out of search engines and is credited nowhere", async () => {
    const html = await text("/articles/the-change-you-stop-seeing");
    expect(html).toContain("Withdrawn draft.");
    expect(html).toContain('<meta name="robots" content="noindex,follow" />');
    const doc = await text(
      "/p/when-healed-is-the-treatment-working-the-stopping-mechanism-in-mainten",
    );
    expect(doc).not.toContain("/articles/the-change-you-stop-seeing");
    const problem = await text("/open/where-does-voice-beat-typing");
    expect(problem).not.toContain("/articles/the-change-you-stop-seeing");
    expect(await text("/sitemap.xml")).not.toContain("the-change-you-stop-seeing");
  });
});

describe("what the Markdown export dropped", () => {
  it("names figures render as cards, their quotes still verified", async () => {
    const html = await text("/articles/self-extinguishing-maintenance");
    expect(html).toContain('<div class="names">');
    expect(html).toContain('<div class="name-l">The belief</div>');
    expect(html).not.toContain("The cycleSelf-extinguishing");
  });

  it("contents labels follow the headings they name", () => {
    const heads = [
      "Coffee is close to the worst",
      "The smell is the protein",
      "What is coming",
    ].map((text, i) => ({ n: String(i + 1), text, href: `#e-${i + 1}` }));
    const byPosition = matchLabels(heads, ["Coffee’s acidity", "The smell", "What is coming"]);
    expect(byPosition.map((h) => h.text)).toEqual([
      "Coffee’s acidity",
      "The smell",
      "What is coming",
    ]);
    // The prototype's own list swaps two; the words put them back.
    const swapped = matchLabels(heads, ["Coffee’s acidity", "What is coming", "The smell"]);
    expect(swapped.map((h) => h.href)).toEqual(["#e-1", "#e-2", "#e-3"]);
    expect(swapped[1]?.text).toBe("The smell");
  });

  it("the thread a Dispatch article leaves open is on the page, honest about its prompts", async () => {
    const html = await text("/articles/paying-yourself-to-do-your-own-tasks");
    expect(html).toContain("This thread is still open");
    expect(html).toContain('href="/open/cash-micro-incentives-for-task-completion-in-adu"');
    expect(html).toMatch(/data-copy-prompt|Prompt not written yet/);
  });
});

describe("an article: verbatim or nothing", () => {
  it.each(ARTICLES)(
    "%s marks every quote and gives each a receipt to its passage",
    async (slug) => {
      const res = await get(`/articles/${slug}`);
      expect(res.status).toBe(200);
      const html = await res.text();
      const quotes = articleQuotes(readFileSync(`content/articles/${slug}.md`, "utf8"));
      const marks = html.match(/<mark class="q">/g) ?? [];
      expect(marks.length).toBe(quotes.length);
      // One receipt per quote, each to /p/<doc>#q=<passage>.
      const receipts = [
        ...html.matchAll(/<mark class="q">[\s\S]*?<\/mark><a class="rc" href="([^"]+)"/g),
      ];
      expect(receipts.length).toBe(quotes.length);
      for (const [, href] of receipts) expect(href).toMatch(/^\/p\/[a-z0-9-]+#q=[^&]+:~:text=/);
      // The author's own sentences say so.
      expect(html).toContain('class="own"');
    },
  );

  it("serves the Markdown twin with the quotes intact", async () => {
    const md = await text("/articles/canadas-short-term-rental-bans-and-rents.md");
    expect(md).toMatch(/^---\ntitle: /);
    expect(md).toContain(
      '<q doc="did-banning-airbnb-actually-fix-canadian-housing-evidence-based-audit"',
    );
  });
});

describe("a document page", () => {
  const id = "did-banning-airbnb-actually-fix-canadian-housing-evidence-based-audit";

  it("is whole without JavaScript: summary lifted, sections anchored, rail present", async () => {
    const html = await text(`/p/${id}`);
    expect(html).toContain('id="doc-summary"');
    expect(html).toContain('id="s-1"');
    expect(html).toContain("In this document");
    expect(html).toContain("Cited by");
    // The cited-by list is derived from the articles' own quotes.
    expect(html).toContain('href="/articles/canadas-short-term-rental-bans-and-rents"');
  });

  it("has a Markdown twin and a JSON twin", async () => {
    expect(await text(`/p/${id}.md`)).toContain("# Did Banning Airbnb");
    const json = JSON.parse(await text(`/p/${id}.json`)) as { id: string; license: string };
    expect(json.id).toBe(id);
    expect(json.license).toBe("CC BY 4.0");
  });

  it("answers an unknown id with the new 404, not the old design", async () => {
    const res = await get("/p/no-such-document");
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('class="hd-in"');
  });
});

describe("the machine face", () => {
  it("RSS carries full content and announces its WebSub hub, in the body and the headers", async () => {
    const res = await get("/feed.xml");
    expect(res.headers.get("link")).toContain('rel="hub"');
    const xml = await res.text();
    expect(xml).toContain('<atom:link rel="hub" href="https://pubsubhubbub.appspot.com/"/>');
    expect(xml).toContain("<content:encoded><![CDATA[");
    expect((xml.match(/<item>/g) ?? []).length).toBeLessThanOrEqual(30);
  });

  it("JSON Feed is valid 1.1 with content_html on every item", async () => {
    const feed = JSON.parse(await text("/feed.json")) as {
      version: string;
      hubs: unknown[];
      items: Array<{ content_html: string; url: string }>;
    };
    expect(feed.version).toBe("https://jsonfeed.org/version/1.1");
    expect(feed.hubs.length).toBe(1);
    for (const i of feed.items) {
      expect(i.content_html.length).toBeGreaterThan(0);
      // Links inside a feed are absolute: it is read somewhere else.
      expect(i.content_html).not.toMatch(/href="\/(?!\/)/);
    }
  });

  it("a topic feed and a combined ?t= feed hold only their topics", async () => {
    const one = JSON.parse(await text("/feeds/housing.json")) as {
      items: Array<{ tags: string[] }>;
    };
    expect(one.items.length).toBeGreaterThan(0);
    for (const i of one.items) expect(i.tags[0]).toBe("Housing");
    const two = JSON.parse(await text("/feed.json?t=housing,prices-and-markets")) as {
      items: Array<{ tags: string[] }>;
    };
    for (const i of two.items) expect(["Housing", "Prices & markets"]).toContain(i.tags[0]);
    expect((await get("/feeds/not-a-topic.xml")).status).toBe(404);
  });

  it("llms.txt has an H1, a summary and one section per topic", async () => {
    const t = await text("/llms.txt");
    expect(t).toMatch(/^# Canopticon\n\n> /);
    expect(t).toContain("## Housing");
    expect(t).toContain("https://canopticon.com/articles/canadas-short-term-rental-bans-and-rents");
  });

  it("the sitemap lists every article and document, and no filtered views", async () => {
    const xml = await text("/sitemap.xml");
    for (const slug of ARTICLES.filter((s) => s !== "the-change-you-stop-seeing")) {
      if (slug === "canadas-short-term-rental-rules") continue;
      expect(xml, slug).toContain(`/articles/${slug}<`);
    }
    expect(xml).toContain(
      "/p/did-banning-airbnb-actually-fix-canadian-housing-evidence-based-audit<",
    );
    expect(xml).not.toMatch(/<loc>[^<]*\?/);
  });
});

describe("the live site's addresses keep answering (ROUTES.md)", () => {
  it.each([
    ["/essays", "/library?kind=Article"],
    ["/essays/some-essay", "/articles/some-essay"],
    ["/research", "/library?kind=Research"],
    ["/research/housing-cities", "/topics/housing"],
    ["/method", "/about#m-rules"],
    ["/library/some-doc", "/p/some-doc"],
  ])("%s → %s", async (from, to) => {
    const res = await get(from);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(to);
  });
});

describe("the library", () => {
  it("filters by kind and topic with links, so every view has a URL", async () => {
    const html = await text("/library?kind=Research&topic=housing");
    expect(html).toContain("Open the Housing topic page");
    expect(html).toMatch(/2 items/);
    expect(html).toContain('href="/library?kind=Research&amp;topic=housing&amp;sort=az"');
  });

  it("offers Marked useful only to the author, who is the only one who can mark", async () => {
    expect(await text("/library")).not.toContain("Marked useful");
    expect(await text("/library?sort=useful")).not.toContain("data-useful-sort");
  });

  it("is finite: fifty rows a page, and a pager with an end", async () => {
    const html = await text("/library?kind=Figure");
    expect((html.match(/class="lib-row"/g) ?? []).length).toBe(50);
    expect(html).toContain('aria-label="Pages"');
  });
});

describe("search", () => {
  it("keeps quoted phrases whole and splits the rest", () => {
    expect(searchTerms('"short-term rental" Hamilton')).toEqual(["short-term rental", "hamilton"]);
  });

  it("AND-matches, marks the terms, and links passages to the document", async () => {
    const html = await text("/search?q=Hamilton+rents");
    expect(html).toContain("Passages in documents");
    expect(html).toContain("<mark>");
    expect(html).toMatch(/href="\/p\/[a-z0-9-]+#q=/);
  });

  it("returns no more than three passages from any one document", async () => {
    const html = await text("/search?q=rental&tab=passages");
    const docs = [...html.matchAll(/href="\/p\/([a-z0-9-]+)#q=/g)].map((m) => m[1]);
    const counts = new Map<string, number>();
    for (const d of docs) counts.set(d ?? "", (counts.get(d ?? "") ?? 0) + 1);
    for (const n of counts.values()) expect(n).toBeLessThanOrEqual(3);
  });
});

describe("the stylesheet", () => {
  it("contains no backtick and balanced braces", () => {
    expect(SITE_CSS).not.toContain("`");
    const css = SITE_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    expect((css.match(/{/g) ?? []).length).toBe((css.match(/}/g) ?? []).length);
  });

  it("has no shadows: depth is hairlines, and nothing lifts", () => {
    expect(SITE_CSS).not.toMatch(/box-shadow\s*:(?!\s*none)/);
    expect(SITE_CSS).not.toMatch(/translateY\(-/);
  });

  it("keeps the reading column at 720px", () => {
    expect(SITE_CSS).toMatch(/--read:\s*720px/);
  });
});

describe("no JavaScript required to read", () => {
  it.each(["/", "/library", "/articles/krasis", "/topics/housing", "/ideas", "/about", "/follow"])(
    "%s is complete in the HTML",
    async (path) => {
      const res = await get(path);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("</footer>");
      // The one script is deferred enhancement.
      expect(html).toMatch(/<script defer src="\/site\.js\?v=/);
      expect(html).not.toMatch(/<script>(?!.*ld\+json)/);
    },
  );
});

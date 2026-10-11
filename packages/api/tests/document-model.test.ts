// The document model (public/models/document.ts): the data seam under
// /p/<slug>. One typed object of everything the page shows, consumed by the
// HTML renderer and served as JSON at /p/<slug>.json — so a front end built
// against the JSON sees exactly what the page renders.
//
// The fake D1 is the readings-page test's: it answers by inspecting the SQL,
// so the real query paths run.

import { describe, expect, it } from "vitest";
import app from "../src/index.ts";
import type { PublicEnv } from "../src/public/data";
import { type DocumentModel, documentModel } from "../src/public/models/document";
import { renderPiece } from "../src/public/render/piece-template";

const VERBATIM =
  "Provincial health spending grew 4.8 percent over the same period, outpacing the transfer escalator of 3.0 percent set in 2023.";

const PIECE = {
  id: "p1",
  slug: "housing-record",
  title: "Housing in the record",
  subtitle: null,
  kind: "research",
  subtype: null,
  publication_status: "published",
  byline: "Chris Telford",
  published_at: "2026-09-01T00:00:00Z",
  signed_by: null,
  body_md: `# Housing in the record\n\n${VERBATIM}\n`,
  body_html: null,
  chain_id: null,
  tags: "[]",
  metadata: "{}",
  argument_summary_md: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

const READING = {
  id: "r1",
  quote_id: "q1",
  verbatim_text: VERBATIM,
  note_md: "Which escalator? The **2023** figure needs a source.",
  created_at: "2026-09-24T10:00:00Z",
};

const LOST = {
  ...READING,
  id: "r2",
  quote_id: "q2",
  verbatim_text: "A sentence the document no longer contains, kept from an earlier version of it.",
};

const FINDING = {
  id: "f1",
  figure: "4.8 percent",
  measures: "provincial health spending growth",
  period: "2023",
  attributed_to: "PBO",
  quote_id: "qf",
  verbatim_text: "Provincial health spending grew 4.8 percent",
  model: null,
};

function makeDb(opts: {
  readings?: (typeof READING)[];
  parent?: boolean;
  children?: boolean;
  findings?: boolean;
  section?: boolean;
}): D1Database {
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
        if (/JOIN pieces parent ON parent\.id = child\.parent_piece_id/.test(sql)) {
          return opts.parent
            ? { slug: "root-doc", title: "The root document", origin: "Why did transfers lag?" }
            : null;
        }
        if (/SELECT topic FROM pieces/.test(sql)) {
          return opts.section ? { topic: "Public health" } : null;
        }
        if (/COUNT\(\*\)/i.test(sql)) return { n: 0 };
        return null;
      },
      async all() {
        if (/FROM readings r JOIN quotes q/.test(sql)) return { results: opts.readings ?? [] };
        if (/FROM aeo_findings f JOIN quotes q/.test(sql)) {
          return { results: opts.findings ? [FINDING] : [] };
        }
        if (/WHERE user_id = \? AND parent_piece_id = \?/.test(sql)) {
          return {
            results: opts.children
              ? [
                  {
                    slug: "child-doc",
                    title: "A child brief",
                    origin: "What replaced the escalator?",
                  },
                ]
              : [],
          };
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

function makeEnv(opts: Parameters<typeof makeDb>[0]): PublicEnv {
  return { DB: makeDb(opts) } as unknown as PublicEnv;
}

describe("documentModel — shape", () => {
  it("is null for a slug that is not published", async () => {
    expect(await documentModel(makeEnv({}), "no-such-document")).toBeNull();
  });

  it("carries the page's data as plain fields, with no operator block for a reader", async () => {
    const m = await documentModel(
      makeEnv({ readings: [READING], parent: true, children: true, findings: true, section: true }),
      PIECE.slug,
    );
    expect(m).not.toBeNull();
    const model = m as DocumentModel;
    expect(model.slug).toBe("housing-record");
    expect(model.url).toBe("https://canopticon.com/p/housing-record");
    expect(model.classification).toBe("research");
    expect(model.kindLabel).toBe("research");
    expect(model.title).toBe("Housing in the record");
    expect(model.author).toBe("Chris Telford");
    expect(model.publishedAt).toBe("2026-09-01T00:00:00Z");
    expect(model.updatedShown).toBe(false);
    expect(model.words).toBe(25);
    expect(model.readMinutes).toBeNull();
    expect(model.license).toEqual({
      name: "CC BY 4.0",
      url: "https://creativecommons.org/licenses/by/4.0/",
    });
    // The section and the trail that includes it.
    expect(model.section).toEqual({ slug: "public-health", label: "Public health" });
    expect(model.breadcrumbs).toEqual([
      { name: "Home", href: "/" },
      { name: "Research", href: "/research" },
      { name: "Public health", href: "/research/public-health" },
      { name: "Housing in the record", href: null },
    ]);
    // No lede has been approved, so none is claimed.
    expect(model.leadPassage).toBeNull();
    // The finding, located in the body at model time.
    expect(model.keyFigures).toEqual([
      {
        figure: "4.8 percent",
        measures: "provincial health spending growth",
        source: "PBO",
        date: "2023",
        quoteId: "qf",
        located: true,
      },
    ]);
    expect(model.receipts).toHaveLength(1);
    const r = model.receipts[0];
    expect(r?.quoteId).toBe("qf");
    expect(model.bodyMd.slice(r?.start, r?.end)).toBe(FINDING.verbatim_text);
    expect(model.bodyMd).toBe(PIECE.body_md);
    // The reading, with its note as Markdown for the renderer to render.
    expect(model.readings).toEqual([
      {
        id: "r1",
        quoteId: "q1",
        noteMd: READING.note_md,
        verbatimText: VERBATIM,
        createdAt: READING.created_at,
        located: true,
      },
    ]);
    expect(model.readByOperator).toBe(true);
    expect(model.lineage).toEqual({
      parent: { slug: "root-doc", title: "The root document", origin: "Why did transfers lag?" },
      children: [
        { slug: "child-doc", title: "A child brief", origin: "What replaced the escalator?" },
      ],
    });
    expect(model.cite.apa).toContain("Chris Telford. (2026). Housing in the record.");
    expect(model.cite.bibtex).toContain("@misc{canopticon-housing-record,");
    expect(model.machine.mdUrl).toBe("https://canopticon.com/p/housing-record.md");
    expect(model.machine.jsonUrl).toBe("https://canopticon.com/p/housing-record.json");
    expect(model.machine.ogImage).toBeNull();
    // The JSON-LD is the same object machine.ts builds: the document, its
    // trail, and a Comment per reading with isBasedOn for the parent.
    const [doc, trail] = model.machine.jsonLd as Array<Record<string, unknown>>;
    expect(doc?.["@type"]).toBe("DigitalDocument");
    expect(doc?.commentCount).toBe(1);
    expect((doc?.isBasedOn as { url: string }).url).toBe("https://canopticon.com/p/root-doc");
    expect(trail?.["@type"]).toBe("BreadcrumbList");
    // A reader gets no operator block.
    expect(model.operator).toBeNull();
    // Nothing in the model is HTML.
    expect(JSON.stringify(model)).not.toMatch(/<(div|span|a|p)\b/);
  });

  it("says a reading is not located when its passage is gone from the text", async () => {
    const m = await documentModel(makeEnv({ readings: [READING, LOST] }), PIECE.slug);
    const located = Object.fromEntries((m?.readings ?? []).map((r) => [r.id, r.located]));
    expect(located).toEqual({ r1: true, r2: false });
    expect(m?.readByOperator).toBe(true);
  });

  it("carries the operator's leads and forms only for the operator", async () => {
    const m = await documentModel(makeEnv({ readings: [READING] }), PIECE.slug, {
      isOperator: true,
    });
    expect(m?.operator).not.toBeNull();
    expect(m?.operator?.leads).toEqual([]);
    const actions = m?.operator?.actions.map((a) => a.action) ?? [];
    expect(actions).toContain("/op/leads/dig");
    expect(actions).toContain("/op/pieces/p1/draft-tetrad");
    expect(actions).toContain("/op/readings");
    expect(actions).toContain("/op/readings/r1/delete");
    expect(actions).toContain("/op/readings/r1/draft-essay");
  });

  it("classifies an essay by kind and a tetrad by its four quadrants", async () => {
    const essay = {
      ...PIECE,
      kind: "essay",
      body_md:
        "# Housing in the record\nA dek.\n\nSummary.\n\n## Why did transfers lag?\n\nBecause [1].\n\n## Sources\n\n1. PBO. Report. 2026.\n",
    };
    const tetrad = {
      ...essay,
      body_md:
        "# The escalator\nA dek.\n\n## Enhances\n\nA.\n\n## Obsolesces\n\nB.\n\n## Retrieves\n\nC.\n\n## Reverses into\n\nD.\n",
    };
    const envFor = (p: typeof PIECE) => {
      const db = makeDb({});
      const inner = db.prepare;
      return {
        DB: {
          ...db,
          prepare: (sql: string) => {
            const stmt = inner(sql);
            if (/FROM pieces WHERE user_id = \? AND slug = \?/i.test(sql)) {
              return { bind: () => ({ first: async () => p }) } as unknown as D1PreparedStatement;
            }
            return stmt;
          },
        },
      } as unknown as PublicEnv;
    };
    const e = await documentModel(envFor(essay), PIECE.slug);
    expect(e?.classification).toBe("essay");
    expect(e?.toc).toEqual([{ anchor: "s1", text: "Why did transfers lag?" }]);
    expect(e?.sources).toEqual(["PBO. Report. 2026."]);
    expect(e?.breadcrumbs[1]).toEqual({ name: "Essays", href: "/essays" });
    const t = await documentModel(envFor(tetrad), PIECE.slug);
    expect(t?.classification).toBe("tetrad");
    expect(t?.toc.map((x) => x.anchor)).toEqual([
      "enhances",
      "obsolesces",
      "retrieves",
      "reverses",
    ]);
  });
});

describe("GET /p/:slug.json", () => {
  const env = (db: D1Database) => ({
    SUPABASE_URL: "http://localhost:54321",
    SUPABASE_SERVICE_ROLE_KEY: "test",
    ANTHROPIC_API_KEY: "test",
    OPENPARLIAMENT_USER_AGENT: "test",
    LOG_LEVEL: "info",
    DB: db,
  });

  it("serves the model as JSON, without the operator block, cached like the twin", async () => {
    const res = await app.fetch(
      new Request("http://test/p/housing-record.json"),
      env(makeDb({ readings: [READING] })),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    const body = (await res.json()) as DocumentModel;
    expect(body.slug).toBe("housing-record");
    expect(body.readings[0]?.located).toBe(true);
    expect(body.operator).toBeNull();
  });

  it("404s on a slug that does not exist", async () => {
    const res = await app.fetch(new Request("http://test/p/nope.json"), env(makeDb({})));
    expect(res.status).toBe(404);
  });
});

describe("renderPiece renders from the model", () => {
  it("still carries the readings page's landmarks", async () => {
    const html =
      (await renderPiece(makeEnv({ readings: [READING, LOST], parent: true }), PIECE.slug, {
        isOperator: true,
      })) ?? "";
    expect(html).toContain("Read by the operator");
    expect(html).toContain('href="#reading-r1" class="read-by"');
    expect(html).toContain('<aside class="reading" id="reading-r1">');
    expect(html).toContain("<strong>2023</strong>");
    expect(html).toContain("— the operator, ");
    expect(html).toContain("Passage not found in the current text");
    expect(html).toContain('href="/q/q2"');
    expect(html).toContain('"@type":"Comment"');
    expect(html).toContain('"author":{"@type":"Person","name":"Chris Telford"}');
    expect(html).toContain("Grew from");
    expect(html).toContain('href="/p/root-doc"');
    expect(html).toContain('<script src="/op/notes.js" defer></script>');
    expect(html).toContain('action="/op/readings/r1/delete"');
    expect(html).not.toContain("");
  });
});

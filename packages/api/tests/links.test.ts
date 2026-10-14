// The record linking itself (site/links.ts, graph/lib/crosslinks.ts): links
// inside a document's text to the other documents that share a subject and to
// the concepts it names; questions one document leaves open that another
// answers; figures two documents give for the same measure. Every link is a
// query, never a model's opinion, and never points at a held document.

import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { OWN_UPLOADS_SQL } from "../src/admin/runtime";
import type { Env } from "../src/env";
import { allCrossLinks, linksByDocument } from "../src/graph/lib/crosslinks";
import app from "../src/index";
import {
  answeredElsewhere,
  conceptUses,
  conceptsNamedIn,
  heldResearch,
  measuredElsewhere,
  publicResearch,
  setGraphLinks,
  setShownReads,
  subjectLinks,
  terms,
} from "../src/site/content/store";
import { type InlineLink, sharedTerms, spliceLinks } from "../src/site/links";
import type { Derivation, ReadRow } from "../src/write/read";

const link = (label: string, href: string): InlineLink => ({
  label,
  href,
  title: `Also in: ${href}`,
  kind: "subject",
});

describe("placing links in a document's text", () => {
  it("links the first prose occurrence, whole phrases only, case kept", () => {
    const html =
      "<p>The Rental Registry counted units. The rental registry later grew.</p><p>Registrys are not this.</p>";
    const r = spliceLinks(html, [link("rental registry", "/p/b"), link("registry", "/p/c")]);
    expect(r.html).toContain(
      '<a class="xl subject" href="/p/b" title="Also in: /p/b">Rental Registry</a> counted',
    );
    // "registry" alone is inside the first link, and its next whole-word
    // occurrence is the second "registry" — "Registrys" never matches.
    expect(r.html).toContain(
      'rental <a class="xl subject" href="/p/c" title="Also in: /p/c">registry</a> later',
    );
    expect(r.html).not.toContain(">Registry</a>s");
    expect(r.placed.map((p) => p.href)).toEqual(["/p/b", "/p/c"]);
  });

  it("never links inside a heading, an existing link or code, and each destination once", () => {
    const html =
      '<h2>Housing supply</h2><p><a href="/x">housing supply</a> and <code>housing supply</code>.</p><p>Housing supply fell. Housing supply rose.</p><p>Rent control matters.</p>';
    const r = spliceLinks(html, [link("housing supply", "/p/b"), link("rent control", "/p/b")]);
    expect(r.html.startsWith("<h2>Housing supply</h2>")).toBe(true);
    expect(r.html).toContain('<a href="/x">housing supply</a>');
    expect(r.html).toContain("<code>housing supply</code>");
    expect(r.html.match(/class="xl/g)).toHaveLength(1);
    expect(r.html).toContain('href="/p/b" title="Also in: /p/b">Housing supply</a> fell.');
  });

  it("matches text the page has escaped, and stops at the limit", () => {
    const r = spliceLinks("<p>Research &amp; Development spending rose.</p>", [
      link("Research & Development", "/p/b"),
    ]);
    expect(r.placed).toHaveLength(1);
    const many = Array.from({ length: 20 }, (_, i) => link(`phrase number ${i}`, `/p/${i}`));
    const text = `<p>${many.map((l) => l.label).join(". ")}.</p>`;
    expect(spliceLinks(text, many, 12).placed).toHaveLength(12);
  });
});

describe("what two documents share", () => {
  it("links every document carrying a label to the others, one link per label and destination", () => {
    const rows = [
      { label: "short-term rental registry", slug: "a", title: "A", pieces: 2 },
      { label: "short-term rental registry", slug: "b", title: "B", pieces: 2 },
      { label: "vacancy control", slug: "a", title: "A", pieces: 3 },
      { label: "vacancy control", slug: "b", title: "B", pieces: 3 },
      { label: "vacancy control", slug: "c", title: "C", pieces: 3 },
    ];
    const m = linksByDocument(rows, 12);
    expect(m.get("a")?.map((l) => [l.label, l.slug])).toEqual([
      ["short-term rental registry", "b"],
      ["vacancy control", "c"],
    ]);
    expect(m.get("c")?.map((l) => l.slug)).toEqual(["a"]);
  });

  it("matches questions and measures by shared terms, and says which", () => {
    expect(
      sharedTerms(
        "How many units did the registry delist?",
        "Did the registry delist many units in 2024?",
      ),
    ).toEqual(expect.arrayContaining(["unit", "registry", "delist"]));
    expect(sharedTerms("Did rents fall?", "Did crime fall?")).toBeNull();
  });
});

// A real SQLite database with every migration applied, standing in for D1.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (
    p: string,
  ) => {
    exec(sql: string): void;
    prepare(sql: string): {
      all(...a: unknown[]): Array<Record<string, unknown>>;
      run(...a: unknown[]): unknown;
    };
  };
};
function sqliteD1() {
  const db = new DatabaseSync(":memory:");
  const dir = "../../supabase/migrations";
  for (const f of readdirSync(dir)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort())
    db.exec(readFileSync(`${dir}/${f}`, "utf8"));
  const d1 = {
    prepare(sql: string) {
      let args: unknown[] = [];
      const stmt = {
        bind(...a: unknown[]) {
          args = a;
          return stmt;
        },
        async all() {
          return { results: db.prepare(sql).all(...args) };
        },
        async first() {
          return db.prepare(sql).all(...args)[0] ?? null;
        },
        async run() {
          db.prepare(sql).run(...args);
          return { results: [], meta: {} };
        },
      };
      return stmt;
    },
  } as unknown as D1Database;
  return { db, d1 };
}

describe("the subjects query, on the real schema", () => {
  it("links published own documents on shared subjects — never a person, an organisation, a short label or a draft", async () => {
    const { db, d1 } = sqliteD1();
    db.exec("INSERT INTO users (id, email) VALUES ('u1', 'a@b.c')");
    const piece = (id: string, status = "published", from = "feed-upload") =>
      db
        .prepare(
          "INSERT INTO pieces (id, user_id, slug, title, kind, publication_status, metadata) VALUES (?, 'u1', ?, ?, 'research-report', ?, ?)",
        )
        .run(id, `slug-${id}`, `Title ${id}`, status, JSON.stringify({ ingested_from: from }));
    piece("a");
    piece("b");
    piece("c");
    piece("d", "working-material");
    piece("e", "published", "deep-research");
    for (let i = 0; i < 6; i++) piece(`z${i}`); // enough documents that a ceiling of a third is above two
    let n = 0;
    const node = (piece: string, label: string, kind = "entity", type = "concept") =>
      db
        .prepare(
          "INSERT INTO nodes (id, user_id, kind, label, metadata, piece_id) VALUES (?, 'u1', ?, ?, ?, ?)",
        )
        .run(`n${n++}`, kind, label, JSON.stringify({ entity_type: type }), piece);
    for (const p of ["a", "b"]) node(p, "short-term rental registry");
    for (const p of ["a", "c"]) node(p, "Hamilton Spectator", "entity", "organization");
    for (const p of ["a", "c"]) node(p, "Jane Example", "entity", "person");
    for (const p of ["a", "c"]) node(p, "Ontario", "entity", "location"); // under 8 characters
    for (const p of ["a", "d"]) node(p, "vacancy decontrol"); // d is not published
    for (const p of ["a", "e"]) node(p, "rent stabilisation"); // e is not an own upload
    for (const p of ["b", "c"]) node(p, "the 2024 housing pledge", "event");
    const m = await allCrossLinks(d1, "u1", OWN_UPLOADS_SQL);
    expect(m.get("slug-a")?.map((l) => [l.label, l.slug])).toEqual([
      ["short-term rental registry", "slug-b"],
    ]);
    expect(m.get("slug-c")?.map((l) => l.label)).toEqual(["the 2024 housing pledge"]);
    expect(m.has("slug-d")).toBe(false);
    expect(m.has("slug-e")).toBe(false);
  });
});

describe("the links a page shows", () => {
  it("are only to public documents — a held document is never a destination", () => {
    const [a, b] = publicResearch();
    const held = heldResearch()[0];
    if (!a || !b) throw new Error("no public research");
    setGraphLinks(
      new Map([
        [
          a.id,
          [
            { label: "shared subject one", slug: b.id },
            ...(held ? [{ label: "shared subject two", slug: held.id }] : []),
            { label: "shared subject three", slug: "not-a-document" },
          ],
        ],
      ]),
    );
    expect(subjectLinks(a.id).map((l) => l.route)).toEqual([`/p/${b.id}`]);
    setGraphLinks(new Map());
  });

  it("names concepts both ways: the document links the concept, the concept lists the document", () => {
    const t = terms().find((x) =>
      publicResearch().some((d) => conceptsNamedIn(d.body).some((c) => c.id === x.id)),
    );
    if (!t) throw new Error("no concept is named in any public document");
    const doc = publicResearch().find((d) => conceptsNamedIn(d.body).some((c) => c.id === t.id));
    expect(conceptUses(t.id).some((u) => u.route === `/p/${doc?.id}`)).toBe(true);
    expect(conceptsNamedIn("nothing here names anything").length).toBe(0);
  });

  it("puts them in the public page's text, server-rendered", async () => {
    const env = { LOG_LEVEL: "error", DB: stubDb() } as unknown as Env;
    const docs = publicResearch();
    // A phrase that is in document A's body, linked to document B.
    const a = docs.find((d) => /\bthe evidence\b/i.test(d.body));
    const b = docs.find((d) => d.id !== a?.id);
    if (!a || !b) throw new Error("no documents");
    setGraphLinks(new Map([[a.id, [{ label: "the evidence", slug: b.id }]]]));
    const html = await (await app.fetch(new Request(`http://test/p/${a.id}`), env)).text();
    setGraphLinks(new Map());
    expect(html).toContain(`class="xl subject" href="/p/${b.id}"`);
  });
});

const read = (docId: string, id: string): ReadRow => ({
  id,
  docId,
  draftId: "d",
  status: "shown",
  charsHeld: 1,
  charsRead: 1,
  verified: 1,
  dropped: 0,
  cents: 0,
  startedAt: "2026-10-14T00:00:00Z",
  shownAt: "2026-10-14T00:00:00Z",
});
const card = (readId: string, docId: string, over: Partial<Derivation>): Derivation => ({
  id: Math.random().toString(36).slice(2),
  readId,
  docId,
  kind: "figure",
  origin: "read",
  span: "a passage of the document itself",
  data: {},
  status: "kept",
  createdAt: "2026-10-14T00:00:00Z",
  ...over,
});

describe("questions answered elsewhere, figures measured elsewhere", () => {
  it("links a question one document leaves open to another's answer, and two figures for one measure", () => {
    const [a, b, held] = [publicResearch()[0], publicResearch()[1], heldResearch()[0]];
    if (!a || !b) throw new Error("no docs");
    setShownReads([
      {
        read: read(a.id, "ra"),
        cards: [
          card("ra", a.id, {
            kind: "question_open",
            span: "No study measured how many units the registry delisted in Toronto.",
          }),
          card("ra", a.id, {
            data: { figure: "4.1%", measures: "fall in Toronto asking rents after the ban" },
          }),
        ],
      },
      {
        read: read(b.id, "rb"),
        cards: [
          card("rb", b.id, {
            kind: "question_answered",
            data: {
              question: "How many units did the Toronto registry delist?",
              answer: "About 12,000 units were delisted.",
            },
          }),
          card("rb", b.id, {
            span: "Asking rents in Toronto fell 2.8% after the ban",
            data: { figure: "2.8%", measures: "Toronto asking rents fall after the ban" },
          }),
        ],
      },
      ...(held
        ? [
            {
              read: read(held.id, "rh"),
              cards: [
                card("rh", held.id, {
                  kind: "question_answered",
                  data: {
                    question: "How many units did the Toronto registry delist?",
                    answer: "A held answer.",
                  },
                }),
              ],
            },
          ]
        : []),
    ]);
    const ans = answeredElsewhere(a.id);
    expect(ans.map((x) => x.answer)).toEqual(["About 12,000 units were delisted."]);
    expect(ans[0]?.terms).toEqual(expect.arrayContaining(["registry", "delist", "toronto"]));
    const fig = measuredElsewhere(a.id);
    expect(fig).toHaveLength(1);
    expect(fig[0]).toMatchObject({ figure: "4.1%", other: "2.8%" });
    expect(fig[0]?.route).toContain(`/p/${b.id}#q=`);
    setShownReads([]);
  });
});

function stubDb(): D1Database {
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

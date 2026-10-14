// The record linking itself (site/links.ts, graph/lib/crosslinks.ts): links
// inside a document's text to the other documents that share a subject and to
// the concepts it names; questions one document leaves open that another
// answers; figures two documents give for the same measure. Every link is a
// query, never a model's opinion, and never points at a held document.

import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { isLinkableSubject, subjectVocabulary } from "../src/graph/lib/crosslinks";
import app from "../src/index";
import {
  answeredElsewhere,
  conceptUses,
  conceptsNamedIn,
  heldResearch,
  linkIndexStats,
  measuredElsewhere,
  publicResearch,
  setGraphLabels,
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

  it("links a plain plural with its phrase, and nothing longer", () => {
    const r = spliceLinks("<p>Short-term rentally. Short-term rentals fell.</p>", [
      link("short-term rental", "/p/b"),
    ]);
    expect(r.html).toContain('title="Also in: /p/b">Short-term rentals</a> fell.');
    expect(r.html).toContain("Short-term rentally.");
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

describe("which subjects may link two documents", () => {
  it("keeps specific names, and drops what the live vocabulary showed to be noise", () => {
    const yes: Array<[string, string, string | null]> = [
      ["Online News Act", "entity", "concept"],
      ["Understanding Media", "entity", "work"],
      ["GFANZ collapse", "event", null],
      ["Ukraine Development Fund", "entity", "concept"],
      ["The Gutenberg Galaxy", "entity", "work"],
    ];
    const no: Array<[string, string, string | null]> = [
      ["interview", "event", null], // one word
      ["Canadians", "entity", "concept"],
      ["California", "entity", "location"],
      ["New York City", "entity", "location"], // a place, however many words
      ["The paper", "entity", "work"],
      ["March 14, 2025", "event", null],
      ["CBC News", "entity", "work"], // an outlet cited as a source
      ["Nature Communications", "entity", "work"],
      ["Bank of Canada", "entity", "institution"],
    ];
    for (const [l, k, t] of yes) expect(isLinkableSubject(l, k, t), l).toBe(true);
    for (const [l, k, t] of no) expect(isLinkableSubject(l, k, t), l).toBe(false);
  });
});

describe("the subjects vocabulary, on the real schema", () => {
  it("takes subjects of 8 characters or more — never a person, an organisation or an institution", async () => {
    const { db, d1 } = sqliteD1();
    db.exec("INSERT INTO users (id, email) VALUES ('u1', 'a@b.c')");
    let n = 0;
    const node = (label: string, kind = "entity", type = "concept") =>
      db
        .prepare(
          "INSERT INTO nodes (id, user_id, kind, label, metadata, piece_id) VALUES (?, 'u1', ?, ?, ?, 'p1')",
        )
        .run(`n${n++}`, kind, label, JSON.stringify({ entity_type: type }));
    node("short-term rental registry");
    node("the 2024 housing pledge", "event");
    node("Hamilton Spectator", "entity", "organization");
    node("Jane Example", "entity", "person");
    node("Bank of Canada", "entity", "institution");
    node("Ontario", "entity", "location");
    node("a long neutral fact sentence", "neutral_fact");
    expect((await subjectVocabulary(d1, "u1")).sort()).toEqual([
      "short-term rental registry",
      "the 2024 housing pledge",
    ]);
  });
});

describe("the links a page shows", () => {
  it("link two documents whose texts both carry a subject — both ways, never to a held document", () => {
    const a = "documented-corruption-conflicts-interest-self-dealing-transnational";
    const b = "public-record-transnational-financial-administrative-network-strict";
    setGraphLabels([
      "Texas v. BlackRock",
      "short-term rental",
      "a phrase no document carries at all",
    ]);
    expect(subjectLinks(a).map((l) => [l.label, l.route])).toEqual([
      ["Texas v. BlackRock", `/p/${b}`],
    ]);
    expect(subjectLinks(b).map((l) => l.route)).toEqual([`/p/${a}`]);
    expect(linkIndexStats().labelsShared).toBe(2);
    const held = new Set(heldResearch().map((d) => d.id));
    for (const d of publicResearch())
      for (const l of subjectLinks(d.id)) expect(held.has(l.route.slice(3))).toBe(false);
    setGraphLabels([]);
  });

  it("drop a phrase most documents carry: it connects nothing", () => {
    // "the evidence" is in 45 of the record's 123 documents: over a third.
    setGraphLabels(["the evidence", "Texas v. BlackRock"]);
    expect(linkIndexStats().labelsShared).toBe(1);
    setGraphLabels([]);
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
    const a = "documented-corruption-conflicts-interest-self-dealing-transnational";
    const b = "public-record-transnational-financial-administrative-network-strict";
    setGraphLabels(["Texas v. BlackRock"]);
    const html = await (await app.fetch(new Request(`http://test/p/${a}`), env)).text();
    setGraphLabels([]);
    expect(html).toContain(`class="xl subject" href="/p/${b}"`);
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

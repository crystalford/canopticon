// /library — "What the record wants", consolidation and lineage
// (docs/the-record.md §1b, §5, §5b, §6 part 3).
//
// Three things the page must now show, each pinned against a fake D1 that
// answers by the shape of the SQL: the corpus-wide worklist with a bridge and
// its two buttons; the consolidation line under a PROCESSED row and nowhere
// else; and the lineage line on a document that grew from another.

import { describe, expect, it } from "vitest";
import { buildSessionCookie, signSession } from "../src/auth/session.ts";
import app from "../src/index.ts";
import {
  HAS_ANYONE_SAID_THIS_ANGLE,
  renderLeadsForTest,
} from "../src/public/render/investigations.ts";

const SECRET = "test-secret-for-library-worklist";

const PIECES = [
  ["done-doc", "A Processed Document"],
  ["fresh-doc", "A Document Never Processed"],
  ["child-doc", "A Brief Grown From The First"],
].map(([id, title]) => ({
  id,
  slug: id,
  title,
  subtitle: null,
  kind: "research-report",
  subtype: null,
  publication_status: "published",
  byline: null,
  published_at: "2026-09-20T00:00:00.000Z",
  signed_by: null,
  metadata: "{}",
  original_title: null,
  title_auto_at: null,
}));

const PROCESSING = [
  {
    piece_id: "done-doc",
    status: "done",
    step: "done",
    chunks_done: 4,
    chunk_count: 4,
    error: null,
  },
].map((r) => ({
  ...r,
  user_id: "op1",
  model: null,
  attempts: 0,
  heartbeat_at: null,
  started_at: null,
  finished_at: "2026-09-24T09:04:00.000Z",
  updated_at: "2026-09-24T09:00:00.000Z",
}));

const BRIDGE = {
  label: "allostatic load",
  piece_id: "done-doc",
  piece_slug: "done-doc",
  piece_title: "A Processed Document",
  piece_topic: "Health & bodies",
  other_id: "fresh-doc",
  other_slug: "fresh-doc",
  other_title: "A Document Never Processed",
  other_topic: "Media & mind",
  created_at: "2026-09-20T00:00:00.000Z",
};

function makeDb(): D1Database {
  const makeStmt = (sql: string) => {
    const stmt = {
      bind() {
        return stmt;
      },
      async first() {
        if (/FROM users/i.test(sql)) return { id: "op1" };
        if (/FROM piece_processing/i.test(sql) && /SUM\(CASE/i.test(sql)) {
          return { queued: 0, running: 0, failed: 0, done: 1 };
        }
        if (/NOT EXISTS/i.test(sql) && /piece_processing/i.test(sql)) return { n: 2 };
        if (/COUNT\(\*\)/i.test(sql)) return { n: 0 };
        return null;
      },
      async all() {
        if (/FROM piece_processing/i.test(sql)) return { results: PROCESSING };
        if (/pa\.topic <> pb\.topic/i.test(sql)) return { results: [BRIDGE] };
        if (/AS src_id/i.test(sql) && /AS dst_id/i.test(sql)) {
          return {
            results: [
              {
                label: "allostatic load",
                src_id: "done-doc",
                dst_id: "fresh-doc",
                slug: "fresh-doc",
                title: "A Document Never Processed",
                pieces: 2,
              },
            ],
          };
        }
        if (/FROM pieces/i.test(sql) && /parent_piece_id/i.test(sql)) {
          return {
            results: PIECES.map((p) => ({
              id: p.id,
              slug: p.slug,
              title: p.title,
              parent_piece_id: p.id === "child-doc" ? "done-doc" : null,
              origin: p.id === "child-doc" ? "What connects these two?" : null,
            })),
          };
        }
        if (/SELECT id, slug FROM pieces/i.test(sql)) {
          return { results: PIECES.map((p) => ({ id: p.id, slug: p.slug })) };
        }
        if (/FROM aeo_question_evidence/i.test(sql) && /GROUP BY piece_id/i.test(sql)) {
          return { results: [{ piece_id: "done-doc", n: 2 }] };
        }
        if (/FROM pieces/i.test(sql) && /ORDER BY COALESCE\(published_at/i.test(sql)) {
          return { results: PIECES };
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
    prepare: (sql: string) => makeStmt(sql),
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}

const env = { ANTHROPIC_API_KEY: "test", LOG_LEVEL: "error", SESSION_SECRET: SECRET, DB: makeDb() };

async function operatorLibrary(query = ""): Promise<string> {
  const cookie = await signSession(
    { uid: "op1", exp: Math.floor(Date.now() / 1000) + 3600 },
    SECRET,
  );
  const cookieValue = buildSessionCookie(cookie).split(";")[0] as string;
  const res = await app.fetch(
    new Request(`http://test/library${query}`, { headers: { cookie: cookieValue } }),
    env,
  );
  expect(res.status).toBe(200);
  return res.text();
}

/** The row's own cell, so a per-row claim is made about that row alone. */
function rowFor(html: string, id: string): string {
  const start = html.indexOf(`href="/library/${id}" class="ac"`);
  expect(start).toBeGreaterThan(-1);
  const end = html.indexOf("</tr>", start);
  return html.slice(start, end);
}

describe("/library — what the record wants", () => {
  it("renders the worklist between the documents and the answered questions", async () => {
    const html = await operatorLibrary();
    const table = html.indexOf('class="lib-table"');
    const wants = html.indexOf('id="op-wants"');
    expect(table).toBeGreaterThan(-1);
    expect(wants).toBeGreaterThan(table);
    expect(html).toContain("What the record wants");
    expect(html).toContain("never by frequency");
  });

  it("shows a bridge with both buttons and both documents", async () => {
    const html = await operatorLibrary();
    const wants = html.slice(html.indexOf('id="op-wants"'));
    const li = wants.slice(wants.indexOf('class="lead lead-bridge"'), wants.indexOf("</li>"));
    expect(li).toContain("bridge between sections");
    expect(li).toContain("allostatic load — in Health &amp; bodies and Media &amp; mind");
    expect(li).toContain('class="lead-piece" href="/library/done-doc"');
    expect(li).toContain('class="lead-other" href="/library/fresh-doc"');
    // Two dig forms, both kind=bridge, both parented to the newer document.
    expect(li.match(/action="\/op\/leads\/dig"/g)?.length).toBe(2);
    expect(li.match(/name="kind" value="bridge"/g)?.length).toBe(2);
    expect(li.match(/name="piece_id" value="done-doc"/g)?.length).toBe(2);
    expect(li.match(/name="other_slug" value="fresh-doc"/g)?.length).toBe(2);
    expect(li).toContain(">Research →<");
    expect(li).toContain(">Has anyone said this? →<");
    expect(li).toContain(`name="angle" value="${HAS_ANYONE_SAID_THIS_ANGLE}"`);
    // The writer toggle survives on each.
    expect(li.match(/name="writer" value="anthropic"/g)?.length).toBe(2);
  });

  it("the bridge's seed is the connecting question", async () => {
    const html = await operatorLibrary();
    expect(html).toContain(
      'name="seed" value="What connects &quot;allostatic load&quot; in &quot;A Processed Document&quot; and &quot;A Document Never Processed&quot;?"',
    );
  });

  it("puts the consolidation line under a processed row and nowhere else", async () => {
    const html = await operatorLibrary();
    const done = rowFor(html, "done-doc");
    expect(done).toContain('class="rcpt-line rcpt-consol"');
    expect(done).toContain("Linked to 1 document · 1 bridge · 2 questions");
    const fresh = rowFor(html, "fresh-doc");
    expect(fresh).not.toContain("rcpt-consol");
    expect(html.match(/class="rcpt-line rcpt-consol"/g)?.length).toBe(1);
  });

  it("shows lineage: Grew from on the child, a branch count on the parent", async () => {
    const html = await operatorLibrary();
    const child = rowFor(html, "child-doc");
    expect(child).toContain(
      'Grew from <a class="ac" href="/library/done-doc">A Processed Document</a>',
    );
    expect(child).toContain("What connects these two?");
    const parent = rowFor(html, "done-doc");
    expect(parent).toContain("1 branch<");
    expect(rowFor(html, "fresh-doc")).not.toContain("lib-lineage");
  });
});

describe("renderLeads — the bridge block on its own", () => {
  it("labels each kind and gives a bridge two runs, no Settle", () => {
    const html = renderLeadsForTest([
      {
        kind: "bridge",
        summary: "x — in A and B",
        detail: "x",
        quote_id: null,
        piece_id: "p1",
        piece_slug: "one",
        piece_title: "One",
        other_piece_slug: "two",
        other_piece_title: "Two",
        created_at: "2026-09-20T00:00:00Z",
        seed: 'What connects "x" in "One" and "Two"?',
        angle: "why",
      },
    ]);
    expect(html).toContain("bridge between sections");
    expect(html).not.toContain("Settle this");
    expect(html).not.toContain("Dig here");
    expect(html).toContain('name="angle" value="why"');
    expect(html).toContain(`name="angle" value="${HAS_ANYONE_SAID_THIS_ANGLE}"`);
  });
});

describe("/library — the post-upload banner", () => {
  it("renders nothing without ?uploaded", async () => {
    const html = await operatorLibrary();
    expect(html).not.toContain('id="uploaded"');
    expect(html).not.toContain("Just uploaded");
  });

  it("opens on the uploaded documents: live now, status, and what the record made of a done row", async () => {
    const html = await operatorLibrary("?uploaded=done-doc,fresh-doc,no-such-id");
    const banner = html.slice(html.indexOf('id="uploaded"'), html.indexOf('id="lib-queue"'));
    expect(banner).toContain("Just uploaded");
    // At the top of the document list: after its header, before the table.
    expect(html.indexOf('id="uploaded"')).toBeGreaterThan(html.indexOf('id="documents"'));
    expect(html.indexOf('id="uploaded"')).toBeLessThan(html.indexOf('class="lib-table"'));
    // The processed one: title → /p/, live, Processed, the consolidation line.
    const done = banner.slice(banner.indexOf('data-uploaded="done-doc"'), banner.indexOf("</li>"));
    expect(done).toContain('href="/p/done-doc" class="uploaded-title">A Processed Document</a>');
    expect(done).toContain("Published — live now");
    expect(done).toContain('data-piece="done-doc"');
    expect(done).toContain(">Processed<");
    expect(done).toContain("Linked to 1 document · 1 bridge · 2 questions");
    // The never-processed one: live, "Not processed", and no consolidation
    // line — the record has not read it, so it has nothing to say yet.
    const fresh = banner.slice(banner.indexOf('data-uploaded="fresh-doc"'));
    expect(fresh).toContain('href="/p/fresh-doc"');
    expect(fresh).toContain("Published — live now");
    expect(fresh).toContain(">Not processed<");
    expect(fresh).not.toContain("rcpt-consol");
    // An id the library does not hold is skipped, not invented.
    expect(banner).not.toContain("no-such-id");
    // The row's own cell still renders too: the banner adds a place, not a copy
    // of the truth — both carry data-piece so the poller repaints both.
    expect(html.match(/data-piece="done-doc"/g)?.length).toBe(2);
  });

  it("caps a zip's banner at five titles", async () => {
    const ids = ["done-doc", "fresh-doc", "child-doc", "done-doc", "fresh-doc", "child-doc"];
    const html = await operatorLibrary(`?uploaded=${ids.join(",")}`);
    expect(html.match(/data-uploaded=/g)?.length).toBe(5);
  });
});

// The operator's action bar on /p/ (docs/the-record.md §6): this document's
// own leads with the dig form, a free question box that parents the brief to
// this document, and "Research this" wired into the note script. A reader
// sees none of it.

import { describe, expect, it, vi } from "vitest";
import type { PublicEnv } from "../src/public/data";
import { NOTES_LIVE_JS } from "../src/public/render/notes-live";
import { renderPiece } from "../src/public/render/piece-template";

vi.mock("../src/graph/lib/leads", () => ({
  leadsForCorpus: async (_db: unknown, _u: string, opts: { pieceId?: string }) =>
    opts.pieceId === "p1"
      ? [
          {
            kind: "contradiction",
            summary: "Two documents disagree on the escalator rate",
            detail: "3.0 percent",
            quote_id: "q9",
            piece_id: "p1",
            piece_slug: "housing-record",
            piece_title: "Housing in the record",
            other_piece_slug: "transfers-2025",
            other_piece_title: "Transfers in 2025",
            created_at: "2026-09-20T00:00:00Z",
            seed: "the escalator rate",
            angle: "Which figure is right?",
            answer_key: "k1",
          },
          {
            kind: "unsourced-figure",
            summary: "$9 billion by 2030 — no source named",
            detail: "$9 billion",
            quote_id: null,
            piece_id: "p1",
            piece_slug: "housing-record",
            piece_title: "Housing in the record",
            created_at: "2026-09-19T00:00:00Z",
            seed: "$9 billion by 2030",
            angle: "Who published this figure?",
            answer_key: "k2",
          },
        ]
      : [],
}));

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
  body_md: "# Housing in the record\n\nProvincial health spending grew 4.8 percent.\n",
  body_html: null,
  chain_id: null,
  tags: "[]",
  metadata: "{}",
  argument_summary_md: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

function makeEnv(): PublicEnv {
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
        return { results: [] };
      },
      async run() {
        return { results: [], meta: { changes: 0 } };
      },
    };
    return stmt as unknown as D1PreparedStatement;
  };
  const DB = {
    prepare: (sql: string) => mk(sql),
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
  return { DB } as unknown as PublicEnv;
}

describe("the document action bar", () => {
  it("renders nothing of it for a reader", async () => {
    const html = (await renderPiece(makeEnv(), PIECE.slug)) ?? "";
    expect(html).not.toContain('id="op-bar"');
    expect(html).not.toContain('id="op-ask"');
    expect(html).not.toContain("/op/leads/dig");
  });

  it("renders the document's leads and the free question box for the operator", async () => {
    const html = (await renderPiece(makeEnv(), PIECE.slug, { isOperator: true })) ?? "";
    expect(html).toContain('id="op-bar"');
    // The contradiction settles from documents already held; the figure digs.
    expect(html).toContain("Settle this →");
    expect(html).toContain("Dig here →");
    expect(html).toContain('name="seed" value="the escalator rate"');
    expect(html).toContain('name="angle" value="Which figure is right?"');
    expect(html).toContain('name="kind" value="contradiction"');
    expect(html).toContain('name="other_slug" value="transfers-2025"');
    expect(html).toContain('href="/q/q9"');
    // The free question: kind=question, parented to this document.
    expect(html).toContain('id="op-ask"');
    expect(html).toContain('name="kind" value="question"');
    expect(html).toContain('name="piece_id" value="p1"');
    expect(html).toContain('name="piece_slug" value="housing-record"');
    expect(html).toContain('<input type="text" name="seed"');
    // Every dig form carries the seed WITH its angle and its origin.
    const forms = html.match(/<form method="post" action="\/op\/leads\/dig"/g) ?? [];
    expect(forms).toHaveLength(3);
  });

  it("offers Research this beside Note this in the selection script", () => {
    expect(NOTES_LIVE_JS).toContain('"Research this"');
    expect(NOTES_LIVE_JS).toContain('"Note this"');
    expect(NOTES_LIVE_JS).toContain("#op-ask [name=seed]");
    expect(NOTES_LIVE_JS).toContain("ask.focus()");
  });
});

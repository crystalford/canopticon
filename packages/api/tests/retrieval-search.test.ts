// /search answers with passages first: the verbatim text, the document
// it came from, and its receipt — then the documents. Nothing composed.
import { describe, expect, it, vi } from "vitest";

const PASSAGE =
  "Allostasis is the McLuhanian mechanism described in neurobiological terms, the ground that the figure of the drug conceals.";

vi.mock("../src/graph/lib/embeddings", () => ({
  searchVectors: async (_env: unknown, args: { kinds?: string[] }) => {
    if (args.kinds?.includes("quote")) {
      return [
        { id: "quote:q1", score: 0.91, metadata: { kind: "quote", id: "q1", user_id: "op1" } },
        { id: "quote:q9", score: 0.7, metadata: { kind: "quote", id: "q9", user_id: "op1" } },
      ];
    }
    return [{ id: "piece:p1", score: 0.8, metadata: { kind: "piece", id: "p1", user_id: "op1" } }];
  },
  rerankResults: async <T>(_env: unknown, _q: string, items: T[]) => items,
}));

function makeDb(): D1Database {
  const makeStmt = (sql: string) => ({
    bind() {
      return makeStmt(sql);
    },
    async first() {
      if (/FROM users/i.test(sql)) return { id: "op1" };
      if (/FROM pieces WHERE id/i.test(sql))
        return { slug: "medium-ground", title: "The Medium Becomes the Ground", excerpt: "…" };
      return null;
    },
    async all() {
      if (/FROM quotes q/i.test(sql)) {
        // q9's document is unpublished: the JOIN's status filter drops it.
        return {
          results: [
            {
              id: "q1",
              verbatim_text: PASSAGE,
              slug: "medium-ground",
              title: "The Medium Becomes the Ground",
            },
          ],
        };
      }
      return { results: [] };
    },
    async run() {
      return { results: [], meta: { changes: 0 } };
    },
  });
  return { prepare: (sql: string) => makeStmt(sql) } as unknown as D1Database;
}

describe("/search — passages first", () => {
  it("renders a passage hit verbatim with its document link and receipt, then documents", async () => {
    const { renderSearchPage } = await import("../src/public/render/search");
    const html = await renderSearchPage({ DB: makeDb(), AI: {} } as never, "allostasis");
    expect(html).toContain("Ask the record");
    expect(html).toContain("word for word, each with its receipt");
    expect(html).toContain(`<blockquote class="search-passage-text">${PASSAGE}</blockquote>`);
    expect(html).toContain('href="/p/medium-ground"');
    expect(html).toContain('href="/q/q1">verified');
    expect(html).not.toContain("/q/q9");
    // Order: Passages heading before Documents heading before the doc hit.
    const iP = html.indexOf(">Passages<");
    const iD = html.indexOf(">Documents<");
    expect(iP).toBeGreaterThan(-1);
    expect(iD).toBeGreaterThan(iP);
    expect(html.indexOf("/library/medium-ground")).toBeGreaterThan(iD);
    expect(html).toContain("<b>1</b> passage and <b>1</b> document for <b>allostasis</b>");
    expect(html).not.toContain("<script");
  });
});

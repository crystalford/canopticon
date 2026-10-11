// A dropped file is read, sorted and HELD — never published on the drop.
// (docs/blackbox/README.md §Desk: "Nothing publishes without Publish.")
// The extractor is stubbed: what matters here is the pieces row the drop
// writes and the pipeline it does NOT start.

import { describe, expect, it, vi } from "vitest";

vi.mock("../src/graph/lib/extract", () => ({
  extractUpload: async () => ({
    source_id: "src-1",
    extracted_chars: 120,
    classification: "markdown",
  }),
  readFullExtractedText: async () => ({
    title: "Rents after the ban",
    text: "## TL;DR\nRents fell for other reasons [1].\n\n## Key findings\n- One.",
  }),
}));

const { createAndExtract } = await import("../src/operator/routes/upload");

function makeEnv() {
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const db = {
    prepare(sql: string) {
      let args: unknown[] = [];
      const stmt = {
        bind(...a: unknown[]) {
          args = a;
          return stmt;
        },
        async first() {
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          const m = /^INSERT INTO (\w+) \(([^)]*)\)/i.exec(sql.trim());
          if (m) {
            const cols = (m[2] ?? "").split(",").map((c) => c.trim());
            inserts.push({
              table: m[1] ?? "",
              row: Object.fromEntries(cols.map((c, i) => [c, args[i]])),
            });
          }
          return { results: [], meta: { changes: 1 } };
        },
      };
      return stmt as unknown as D1PreparedStatement;
    },
  } as unknown as D1Database;
  const env = { DB: db, FILES: { put: async () => ({}) } } as never;
  return { env, inserts };
}

describe("a drop on the desk", () => {
  it("is held as working-material, sorted, and waiting", async () => {
    const { env, inserts } = makeEnv();
    const bytes = new TextEncoder().encode("## TL;DR\nRents fell.");
    await createAndExtract(env, "op1", bytes, "rents.md", "text/markdown", bytes.length, {
      hold: true,
    });
    const piece = inserts.find((i) => i.table === "pieces")?.row ?? {};
    expect(piece.publication_status).toBe("working-material");
    expect(piece.published_at).toBeUndefined();
    const meta = JSON.parse(String(piece.metadata)) as Record<string, unknown>;
    expect(meta.ingested_from).toBe("feed-upload");
    expect(meta.desk).toBe("waiting");
    expect(meta.sorted_as).toBe("research");
    // Nothing queued for the pipeline: that waits for Publish.
    expect(inserts.some((i) => i.table === "piece_processing")).toBe(false);
  });

  it("other doors (video intake) still publish directly, unchanged", async () => {
    const { env, inserts } = makeEnv();
    const bytes = new TextEncoder().encode("transcript");
    await createAndExtract(env, "op1", bytes, "t.txt", "text/plain", bytes.length);
    const piece = inserts.find((i) => i.table === "pieces")?.row ?? {};
    expect(piece.publication_status).toBe("published");
  });
});

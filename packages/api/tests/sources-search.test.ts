// A record search reads the uploads' texts in a few queries, not one per
// document, and searches asked for together share one listing.
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { forgetListing, searchSources } from "../src/write/sources";

function fakeDb(bodies: Record<string, string>) {
  const sql: string[] = [];
  const db = {
    prepare(q: string) {
      return {
        bind(...p: unknown[]) {
          return {
            async first() {
              sql.push(q);
              return /FROM users/.test(q) ? { id: "u1" } : null;
            },
            async all() {
              sql.push(q);
              if (/slug IN/.test(q))
                return {
                  results: (p.slice(0, -1) as string[]).map((slug) => ({
                    slug,
                    body_md: bodies[slug],
                  })),
                };
              if (/length\(body_md\)/.test(q))
                return {
                  results: Object.entries(bodies).map(([slug, b]) => ({
                    slug,
                    title: slug,
                    created_at: "2026-11-01",
                    publication_status: "published",
                    chars: b.length,
                    topic: null,
                  })),
                };
              return { results: [] };
            },
          };
        },
      };
    },
  };
  return { env: { DB: db } as unknown as Env, sql };
}

describe("searchSources", () => {
  it("reads every upload in one query and shares the listing", async () => {
    forgetListing();
    const bodies: Record<string, string> = {};
    for (let i = 0; i < 12; i++) bodies[`up-${i}`] = `Upload ${i} about zebra pharmacare costs.`;
    const { env, sql } = fakeDb(bodies);
    const [a, b] = await Promise.all([
      searchSources(env, "zebra pharmacare"),
      searchSources(env, "zebra costs"),
    ]);
    expect(a.map((h) => h.source.id)).toContain("up-3");
    expect(b.length).toBeGreaterThan(0);
    expect(sql.filter((q) => /length\(body_md\)/.test(q))).toHaveLength(1);
    expect(sql.filter((q) => /slug IN/.test(q))).toHaveLength(2);
    expect(sql.filter((q) => /WHERE slug = \?/.test(q))).toHaveLength(0);
  });
});

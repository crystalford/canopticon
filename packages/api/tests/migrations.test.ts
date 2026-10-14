// Every migration, applied in order to a real SQLite database — the check
// that would have caught 0066 colliding with a legacy table of the same
// name (article_versions, from 0005), which failed the deploy instead.
// D1 is SQLite; a migration that fails here fails there.

import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const DIR = "../../supabase/migrations";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (
    p: string,
  ) => {
    exec(sql: string): void;
    prepare(sql: string): { all(): Array<Record<string, unknown>> };
  };
};

describe("the migrations", () => {
  it("apply in order, each one, with no error", () => {
    const db = new DatabaseSync(":memory:");
    const files = readdirSync(DIR)
      .filter((f) => /^\d{4}_.*\.sql$/.test(f))
      .sort();
    for (const f of files) {
      expect(() => db.exec(readFileSync(`${DIR}/${f}`, "utf8")), f).not.toThrow();
    }
    const cols = (t: string) =>
      db
        .prepare(`PRAGMA table_info(${t})`)
        .all()
        .map((r) => r.name);
    expect(cols("drafts")).toEqual(
      expect.arrayContaining([
        "meta",
        "body_md",
        "usage",
        "status",
        "slug",
        "frame",
        "turn_started_at",
      ]),
    );
    expect(cols("published_versions")).toEqual(
      expect.arrayContaining(["slug", "version", "draft_id", "meta", "body_md"]),
    );
    expect(cols("draft_messages")).toEqual(expect.arrayContaining(["seq", "message", "part"]));
    expect(cols("research_sources")).toEqual(
      expect.arrayContaining(["draft_id", "url", "text", "kind"]),
    );
    expect(cols("record_entries")).toEqual(
      expect.arrayContaining(["kind", "data", "status", "tool_use_id"]),
    );
  });

  it("never reuse a number", () => {
    const nums = readdirSync(DIR)
      .filter((f) => /^\d{4}_.*\.sql$/.test(f))
      .map((f) => f.slice(0, 4));
    expect(new Set(nums).size).toBe(nums.length);
  });
});

import { describe, expect, it } from "vitest";
import {
  canonicalize,
  initialsOf,
  isAliasOf,
  looksLikeAcronym,
  resolveEntities,
} from "../src/graph/lib/entity-resolution.ts";

describe("canonicalize", () => {
  it("normalizes case and whitespace", () => {
    expect(canonicalize("  Mark   Carney ")).toBe("mark carney");
    expect(canonicalize("MARK CARNEY")).toBe(canonicalize("mark carney"));
  });
});

describe("isAliasOf — whole-word subset folding", () => {
  it("folds a surname into a full name", () => {
    expect(isAliasOf("carney", "mark carney")).toBe(true);
    expect(isAliasOf("poilievre", "pierre poilievre")).toBe(true);
  });

  it("does not fold across unrelated institutions sharing a word", () => {
    // The exact false-positive this rule exists to avoid.
    expect(isAliasOf("bank of canada", "bank of england")).toBe(false);
  });

  it("rejects short single-word names under 4 characters (too weak a signal)", () => {
    expect(isAliasOf("gm", "general motors")).toBe(false);
  });

  it("rejects identical or reversed-length pairs", () => {
    expect(isAliasOf("mark carney", "mark carney")).toBe(false);
    expect(isAliasOf("mark carney", "carney")).toBe(false);
  });

  it("rejects a short name whose words are not ALL present in the long name", () => {
    expect(isAliasOf("mark poilievre", "mark carney")).toBe(false);
  });
});

describe("looksLikeAcronym", () => {
  it("matches 2-6 uppercase letters only", () => {
    expect(looksLikeAcronym("PBO")).toBe(true);
    expect(looksLikeAcronym("BIS")).toBe(true);
    expect(looksLikeAcronym("NATO")).toBe(true);
    expect(looksLikeAcronym("Carney")).toBe(false);
    expect(looksLikeAcronym("A")).toBe(false); // too short — too many false positives
    expect(looksLikeAcronym("TOOLONGACRONYM")).toBe(false);
  });
});

describe("initialsOf", () => {
  it("builds initials from significant words, skipping stopwords", () => {
    expect(initialsOf("Parliamentary Budget Officer")).toBe("PBO");
    expect(initialsOf("Bank for International Settlements")).toBe("BIS");
    expect(initialsOf("Bank of Canada")).toBe("BC");
  });
});

// ---------------------------------------------------------------------------
// resolveEntities — end-to-end against a capturing D1 stub. Verifies the
// three rules fire in the right order and produce the right merge count,
// AND — just as important for a forensic record — that genuinely ambiguous
// cases are left alone rather than guessed at.
// ---------------------------------------------------------------------------

interface FakeNode {
  id: string;
  label: string;
  created_at: string;
}

function makeResolutionDb(nodes: FakeNode[]): {
  db: D1Database;
  inserts: Array<{ table: string; values: unknown[] }>;
  updates: Array<{ sql: string; values: unknown[] }>;
  deletes: Array<{ sql: string; values: unknown[] }>;
} {
  const inserts: Array<{ table: string; values: unknown[] }> = [];
  const updates: Array<{ sql: string; values: unknown[] }> = [];
  const deletes: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      const stmt = {
        __sql: normalized,
        __binds: [] as unknown[],
        bind(...vs: unknown[]) {
          return { ...stmt, __binds: vs };
        },
        async first<T>() {
          return null as T | null;
        },
        async all<T>() {
          if (/^SELECT id, label, created_at FROM nodes/.test(normalized)) {
            return { results: nodes as unknown as T[] };
          }
          return { results: [] as T[] };
        },
        async run() {
          if (normalized.startsWith("INSERT INTO")) {
            const table = normalized.match(/^INSERT INTO (\w+)/)?.[1] ?? "unknown";
            inserts.push({ table, values: this.__binds });
          } else if (normalized.startsWith("UPDATE")) {
            updates.push({ sql: normalized, values: this.__binds });
          } else if (normalized.startsWith("DELETE")) {
            deletes.push({ sql: normalized, values: this.__binds });
          }
          return { results: [], meta: { changes: 1 } };
        },
      };
      return stmt as unknown as D1PreparedStatement;
    },
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
  return { db, inserts, updates, deletes };
}

describe("resolveEntities", () => {
  it("merges exact duplicates onto the oldest node", async () => {
    const nodes: FakeNode[] = [
      { id: "n1", label: "Mark Carney", created_at: "2026-01-01T00:00:00Z" },
      { id: "n2", label: "Mark Carney", created_at: "2026-01-02T00:00:00Z" },
      { id: "n3", label: "mark carney", created_at: "2026-01-03T00:00:00Z" },
    ];
    const { db, inserts } = makeResolutionDb(nodes);
    const report = await resolveEntities({ DB: db } as never, "u1");
    expect(report.examined).toBe(3);
    expect(report.merged).toBe(2);
    const merges = inserts.filter((i) => i.table === "entity_merges");
    expect(merges).toHaveLength(2);
    expect(merges.every((m) => m.values[1] === "n1")).toBe(true); // canonical_node_id
  });

  it("folds a surname into the full name via alias-fold", async () => {
    const nodes: FakeNode[] = [
      { id: "n1", label: "Mark Carney", created_at: "2026-01-01T00:00:00Z" },
      { id: "n2", label: "Carney", created_at: "2026-01-02T00:00:00Z" },
    ];
    const { db, inserts } = makeResolutionDb(nodes);
    const report = await resolveEntities({ DB: db } as never, "u1");
    expect(report.merged).toBe(1);
    const merge = inserts.find((i) => i.table === "entity_merges");
    expect(merge?.values).toContain("alias-fold");
  });

  it("merges an acronym into its unambiguous full name", async () => {
    const nodes: FakeNode[] = [
      { id: "n1", label: "Parliamentary Budget Officer", created_at: "2026-01-01T00:00:00Z" },
      { id: "n2", label: "PBO", created_at: "2026-01-02T00:00:00Z" },
    ];
    const { db, inserts } = makeResolutionDb(nodes);
    const report = await resolveEntities({ DB: db } as never, "u1");
    expect(report.merged).toBe(1);
    const merge = inserts.find((i) => i.table === "entity_merges");
    expect(merge?.values).toContain("acronym");
  });

  it("does NOT merge an ambiguous acronym with two candidates", async () => {
    const nodes: FakeNode[] = [
      { id: "n1", label: "Bank of Canada", created_at: "2026-01-01T00:00:00Z" },
      { id: "n2", label: "Bank of Cambodia", created_at: "2026-01-02T00:00:00Z" },
      { id: "n3", label: "BC", created_at: "2026-01-03T00:00:00Z" },
    ];
    const { db, inserts } = makeResolutionDb(nodes);
    const report = await resolveEntities({ DB: db } as never, "u1");
    expect(report.merged).toBe(0);
    expect(inserts.filter((i) => i.table === "entity_merges")).toHaveLength(0);
  });

  it("does NOT fold two distinct entities that merely share a word", async () => {
    const nodes: FakeNode[] = [
      { id: "n1", label: "Doug Ford", created_at: "2026-01-01T00:00:00Z" },
      { id: "n2", label: "Ford Motor Company", created_at: "2026-01-02T00:00:00Z" },
    ];
    const { db } = makeResolutionDb(nodes);
    const report = await resolveEntities({ DB: db } as never, "u1");
    // Neither is a whole-word SUBSET of the other ("doug ford" has "doug"
    // which "ford motor company" lacks, and vice versa with "motor"/"company")
    // — isAliasOf correctly returns false for both directions.
    expect(report.merged).toBe(0);
  });

  it("redirects edges, quotes, assertions, and node_props on merge", async () => {
    const nodes: FakeNode[] = [
      { id: "n1", label: "Parliamentary Budget Officer", created_at: "2026-01-01T00:00:00Z" },
      { id: "n2", label: "PBO", created_at: "2026-01-02T00:00:00Z" },
    ];
    const { db, updates, deletes } = makeResolutionDb(nodes);
    await resolveEntities({ DB: db } as never, "u1");
    const tables = updates.map((u) => u.sql.match(/^UPDATE (\w+)/)?.[1]);
    expect(tables).toEqual(
      expect.arrayContaining([
        "edges",
        "edges",
        "quotes",
        "quotes",
        "assertions",
        "assertions",
        "node_props",
      ]),
    );
    expect(deletes.some((d) => d.sql.startsWith("DELETE FROM pages"))).toBe(true);
    expect(deletes.some((d) => d.sql.startsWith("DELETE FROM nodes"))).toBe(true);
  });

  it("does nothing with fewer than two entity nodes", async () => {
    const { db, inserts } = makeResolutionDb([
      { id: "n1", label: "Mark Carney", created_at: "2026-01-01T00:00:00Z" },
    ]);
    const report = await resolveEntities({ DB: db } as never, "u1");
    expect(report.merged).toBe(0);
    expect(inserts).toHaveLength(0);
  });
});

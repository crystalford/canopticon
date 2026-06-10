import { describe, expect, it } from "vitest";
import {
  type TypedExtraction,
  parseTypedExtraction,
  persistTypedExtraction,
} from "../src/graph/lib/digestion-typed.ts";
import { chunkText } from "../src/graph/lib/digestion.ts";

// Capturing D1 stub: records every prepared INSERT and every batch() call so
// we can assert the persister batches its writes (the D1-timeout fix) instead
// of issuing one awaited roundtrip per row.
function makeBatchCaptureDb(): {
  db: D1Database;
  batches: string[][];
  runCalls: number;
  totalStatements: number;
} {
  const batches: string[][] = [];
  let runCalls = 0;
  const tableOf = (sql: string) => sql.match(/^INSERT INTO (\w+)/)?.[1] ?? sql.slice(0, 12);
  const db = {
    prepare(sql: string) {
      const stmt = {
        __sql: tableOf(sql.replace(/\s+/g, " ").trim()),
        bind() {
          return stmt;
        },
        async first<T>() {
          return null as T | null;
        },
        async all<T>() {
          return { results: [] as T[] };
        },
        async run() {
          runCalls++;
          return { results: [], meta: { changes: 1 } };
        },
      };
      return stmt as unknown as D1PreparedStatement;
    },
    async batch(stmts: D1PreparedStatement[]) {
      batches.push(stmts.map((s) => (s as unknown as { __sql: string }).__sql));
      return stmts.map(() => ({ results: [], meta: { changes: 1 } }));
    },
    dump: async () => new ArrayBuffer(0),
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
  return {
    db,
    batches,
    get runCalls() {
      return runCalls;
    },
    get totalStatements() {
      return batches.reduce((n, b) => n + b.length, 0);
    },
  };
}

describe("parseTypedExtraction — shape tolerance", () => {
  it("reads the canonical typed-graph object shape", () => {
    const out = parseTypedExtraction({
      entities: [{ lid: "e1", label: "OSFI", type: "institution" }],
      events: [{ lid: "ev1", label: "DSB raise", date: "2026-01" }],
      neutral_facts: [{ lid: "f1", text: "DSB is 4.0%" }],
      assertions: [{ lid: "a1", text: "rates will rise", stance: "pro" }],
      relationships: [{ src_lid: "e1", dst_lid: "f1", type: "controls" }],
      evidential: [{ src_lid: "f1", dst_lid: "a1", type: "supports" }],
      temporal: [{ src_lid: "ev1", dst_lid: "ev1", type: "before" }],
      open_threads: [{ question: "What about 2027?", related_lids: ["e1"] }],
    });
    expect(out.entities).toHaveLength(1);
    expect(out.entities[0]?.label).toBe("OSFI");
    expect(out.assertions[0]?.stance).toBe("pro");
    expect(out.relationships).toHaveLength(1);
    expect(out.open_threads[0]?.question).toBe("What about 2027?");
  });

  it("accepts a raw JSON string (Workers AI text fallback)", () => {
    const out = parseTypedExtraction(
      JSON.stringify({
        entities: [{ lid: "e1", label: "Y" }],
      }),
    );
    expect(out.entities).toHaveLength(1);
    expect(out.entities[0]?.label).toBe("Y");
  });

  it("recovers JSON wrapped in markdown code fences", () => {
    const fenced = '```json\n{"entities":[{"lid":"e1","label":"Fenced"}]}\n```';
    const out = parseTypedExtraction(fenced);
    expect(out.entities).toHaveLength(1);
    expect(out.entities[0]?.label).toBe("Fenced");
  });

  it("recovers JSON preceded by model prose", () => {
    const prose =
      'Here is the graph:\n\n{"neutral_facts":[{"lid":"f1","text":"Prefixed fact"}]}\n\nDone.';
    const out = parseTypedExtraction(prose);
    expect(out.neutral_facts).toHaveLength(1);
    expect(out.neutral_facts[0]?.text).toBe("Prefixed fact");
  });

  it("returns empty arrays for null / undefined / junk string", () => {
    expect(parseTypedExtraction(null).entities).toEqual([]);
    expect(parseTypedExtraction(undefined).entities).toEqual([]);
    expect(parseTypedExtraction("not json").entities).toEqual([]);
    expect(parseTypedExtraction(42).entities).toEqual([]);
  });

  it("skips entries missing required fields", () => {
    const out = parseTypedExtraction({
      entities: [
        { lid: "e1", label: "good" },
        { lid: "e2" }, // dropped — no label
        { label: "no lid" }, // dropped — no lid
        null,
        "string",
      ],
      assertions: [
        { lid: "a1", text: "ok" },
        { lid: "a2", text: "" }, // dropped
      ],
    });
    expect(out.entities).toHaveLength(1);
    expect(out.entities[0]?.label).toBe("good");
    expect(out.assertions).toHaveLength(1);
  });

  it("preserves unknown stance/type strings for downstream normalization", () => {
    // The persister normalizes; the parser just shapes. An unknown stance
    // arrives as-is so the persister can decide (defaulting to neutral).
    const out = parseTypedExtraction({
      assertions: [{ lid: "a1", text: "Z", stance: "bogus" }],
    });
    expect(out.assertions[0]?.stance).toBe("bogus");
  });

  it("omits missing arrays as empty (tolerant of partial output)", () => {
    const out = parseTypedExtraction({ entities: [{ lid: "e1", label: "X" }] });
    expect(out.events).toEqual([]);
    expect(out.relationships).toEqual([]);
    expect(out.open_threads).toEqual([]);
  });
});

describe("persistTypedExtraction — batched writes", () => {
  const chunkText = "OSFI raised the buffer. Critics say it is too high. The change took effect.";
  const extraction: TypedExtraction = {
    entities: [
      { lid: "e1", label: "OSFI", type: "institution" },
      { lid: "e2", label: "Critics", type: "concept" },
    ],
    events: [
      {
        lid: "ev1",
        label: "buffer raise",
        date: "2026-01",
        source_quote: "The change took effect.",
      },
    ],
    neutral_facts: [
      { lid: "f1", text: "buffer was raised", source_quote: "OSFI raised the buffer." },
    ],
    assertions: [
      {
        lid: "a1",
        text: "the buffer is too high",
        stance: "critical",
        asserted_by_lid: "e2",
        source_quote: "Critics say it is too high.",
      },
    ],
    relationships: [{ src_lid: "e1", dst_lid: "e2", type: "other" }],
    evidential: [{ src_lid: "f1", dst_lid: "a1", type: "supports" }],
    temporal: [{ src_lid: "ev1", dst_lid: "ev1", type: "before" }],
    open_threads: [{ question: "How high is too high?", related_lids: ["a1"] }],
  };

  it("routes every write through batch() — no per-row run() roundtrips", async () => {
    const cap = makeBatchCaptureDb();
    const env = { DB: cap.db } as unknown as Parameters<typeof persistTypedExtraction>[0];
    const stats = await persistTypedExtraction(
      env,
      { userId: "u1", pieceId: "p1", chunkText, sourceNodeId: "src1" },
      extraction,
    );

    expect(cap.batches.length).toBeGreaterThan(0);
    expect(cap.runCalls).toBe(0); // nothing persisted one-at-a-time
    // 4 nodes (2 entity + 1 event + 1 fact) + 1 assertion node = 5 nodes
    expect(stats.nodes).toBe(5);
    expect(stats.assertions).toBe(1);
    expect(stats.threads).toBe(1);
    // edges: relationship + evidential + temporal + attribution(a1→e2) = 4
    expect(stats.edges).toBe(4);
    // all 3 source_quotes are literal substrings of chunkText → 3 quotes, 0 killed
    expect(stats.quotes).toBe(3);
    expect(stats.killed_quotes).toBe(0);
  });

  it("drops quotes that aren't literal substrings (firewall) without a row", async () => {
    const cap = makeBatchCaptureDb();
    const env = { DB: cap.db } as unknown as Parameters<typeof persistTypedExtraction>[0];
    const stats = await persistTypedExtraction(
      env,
      { userId: "u1", pieceId: "p1", chunkText: "totally unrelated text", sourceNodeId: "src1" },
      {
        ...extraction,
        events: [],
        relationships: [],
        evidential: [],
        temporal: [],
        open_threads: [],
        assertions: [],
        neutral_facts: [{ lid: "f1", text: "x", source_quote: "not present in chunk" }],
        entities: [],
      },
    );
    expect(stats.quotes).toBe(0);
    expect(stats.killed_quotes).toBe(1);
    // the fact node still persists even though its quote was killed
    expect(stats.nodes).toBe(1);
  });

  it("queues node statements before the edges that reference them", async () => {
    const cap = makeBatchCaptureDb();
    const env = { DB: cap.db } as unknown as Parameters<typeof persistTypedExtraction>[0];
    await persistTypedExtraction(
      env,
      { userId: "u1", pieceId: "p1", chunkText, sourceNodeId: "src1" },
      extraction,
    );
    const flat = cap.batches.flat();
    const firstEdge = flat.indexOf("edges");
    const lastNode = flat.lastIndexOf("nodes");
    // every node insert precedes the first edge insert (FK-safe ordering)
    expect(firstEdge).toBeGreaterThan(lastNode);
  });
});

describe("chunkText", () => {
  it("returns a single chunk for small docs (no behavior change)", () => {
    expect(chunkText("short doc")).toEqual(["short doc"]);
  });

  it("returns [] for empty input", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("splits a long document into multiple chunks on paragraph boundaries", () => {
    const para = `${"word ".repeat(2000)}`;
    const doc = [para, para, para].join("\n\n");
    const chunks = chunkText(doc);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(24000 + 800);
  });

  it("hard-slices a single oversized paragraph", () => {
    const huge = "x".repeat(60000);
    const chunks = chunkText(huge, { maxChars: 24000, overlapChars: 0 });
    expect(chunks.length).toBe(3);
  });
});

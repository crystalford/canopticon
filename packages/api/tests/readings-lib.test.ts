// Readings — the operator's half of verification (docs/the-record.md §5c).
//
// A reading's passage is stored the way every receipt is: located verbatim
// in the document, or not at all. These pin the firewall, the stored shape,
// and the worklist shape another surface consumes.

import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { createReading, readingsAsLeads } from "../src/lib/readings";
import { relatedBySubject } from "../src/public/data";

const DOC = `# Housing in the record

Provincial health spending grew 4.8 percent over the same period, outpacing the transfer escalator of 3.0 percent set in 2023.

The Parliamentary Budget Officer noted in March 2026 that the gap would compound to roughly $9 billion annually by 2030.`;

interface Call {
  sql: string;
  params: unknown[];
}

function makeDb(opts: {
  first?: (sql: string, params: unknown[]) => unknown;
  all?: (sql: string, params: unknown[]) => unknown[];
}) {
  const calls: Call[] = [];
  const mk = (sql: string) => {
    let bound: unknown[] = [];
    const stmt = {
      bind(...args: unknown[]) {
        bound = args;
        return stmt;
      },
      async first() {
        calls.push({ sql, params: bound });
        return opts.first?.(sql, bound) ?? null;
      },
      async all() {
        calls.push({ sql, params: bound });
        return { results: opts.all?.(sql, bound) ?? [] };
      },
      async run() {
        calls.push({ sql, params: bound });
        return { results: [], meta: { changes: 1 } };
      },
    };
    return stmt as unknown as D1PreparedStatement;
  };
  const db = {
    prepare: (sql: string) => mk(sql),
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
  return { db, calls };
}

function envWith(db: D1Database): Env {
  return { DB: db } as unknown as Env;
}

const pieceFirst = (sql: string) => {
  if (/SELECT body_md, title FROM pieces/.test(sql)) return { body_md: DOC, title: "Housing" };
  if (/FROM nodes/.test(sql) && /kind = 'source'/.test(sql)) return { id: "src-1" };
  return null;
};

describe("createReading — the passage firewall", () => {
  it("rejects a passage that is not verbatim in the document, writing nothing", async () => {
    const { db, calls } = makeDb({ first: pieceFirst });
    const r = await createReading(
      envWith(db),
      "u1",
      "p1",
      "This dossier shows that provincial spending is outpacing federal transfers by a wide margin.",
      "A composed sentence should never anchor a note.",
    );
    expect(r.ok).toBe(false);
    expect(calls.some((c) => /INSERT INTO/.test(c.sql))).toBe(false);
  });

  it("rejects a passage shorter than 40 characters", async () => {
    const { db, calls } = makeDb({ first: pieceFirst });
    const r = await createReading(envWith(db), "u1", "p1", "grew 4.8 percent", "Too short.");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/needs 40/);
    expect(calls.some((c) => /INSERT INTO/.test(c.sql))).toBe(false);
  });

  it("accepts a verbatim passage and stores a quote and a reading", async () => {
    const { db, calls } = makeDb({ first: pieceFirst });
    // Reflowed whitespace, as a browser selection hands it over.
    const passage =
      "Provincial health spending grew 4.8 percent over the same\nperiod, outpacing the transfer escalator of 3.0 percent set in 2023.";
    const r = await createReading(envWith(db), "u1", "p1", passage, "Which escalator? Cite it.");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.id).toBeTruthy();
    expect(r.quoteId).toBeTruthy();
    const quote = calls.find((c) => /INSERT INTO quotes/.test(c.sql));
    expect(quote).toBeTruthy();
    // The DOCUMENT's bytes are stored, never the submitted text.
    expect(DOC).toContain(quote?.params[4] as string);
    expect(quote?.params[4]).not.toBe(passage);
    expect(quote?.params[2]).toBe("src-1");
    const reading = calls.find((c) => /INSERT INTO readings/.test(c.sql));
    expect(reading?.params).toEqual([r.id, "u1", "p1", r.quoteId, "Which escalator? Cite it."]);
  });

  it("creates the source node when the document has not been processed", async () => {
    const { db, calls } = makeDb({
      first: (sql) =>
        /SELECT body_md, title FROM pieces/.test(sql) ? { body_md: DOC, title: "Housing" } : null,
    });
    const r = await createReading(
      envWith(db),
      "u1",
      "p1",
      "The Parliamentary Budget Officer noted in March 2026 that the gap would compound",
      "Check the PBO figure.",
    );
    expect(r.ok).toBe(true);
    expect(calls.some((c) => /INSERT INTO nodes/.test(c.sql))).toBe(true);
  });
});

describe("readingsAsLeads — the worklist shape", () => {
  it("returns Lead-shaped objects of kind reading, recent first", async () => {
    const { db } = makeDb({
      all: () => [
        {
          id: "r1",
          quote_id: "q1",
          verbatim_text: "A passage that is long enough to anchor a note.",
          note_md: "Why does the table say 3.0 when the prose says 4.8? Someone should check.",
          created_at: "2026-09-24T10:00:00Z",
          piece_id: "p1",
          piece_slug: "housing",
          piece_title: "Housing",
        },
      ],
    });
    const leads = await readingsAsLeads(db, "u1", { limit: 10 });
    expect(leads).toHaveLength(1);
    const l = leads[0];
    expect(l?.kind).toBe("reading");
    expect(l?.summary).toBe(
      "Why does the table say 3.0 when the prose says 4.8? Someone should check.",
    );
    expect(l?.detail).toBe("A passage that is long enough to anchor a note.");
    expect(l?.quote_id).toBe("q1");
    expect(l?.piece_id).toBe("p1");
    expect(l?.piece_slug).toBe("housing");
    expect(l?.piece_title).toBe("Housing");
    expect(l?.created_at).toBe("2026-09-24T10:00:00Z");
    expect(l?.seed).toContain("Why does the table");
    expect(l?.seed).toContain("A passage that is long enough");
    expect(typeof l?.angle).toBe("string");
  });

  it("truncates the summary to 120 characters", async () => {
    const long = "x".repeat(300);
    const { db } = makeDb({
      all: () => [
        {
          id: "r1",
          quote_id: "q1",
          verbatim_text: "p",
          note_md: long,
          created_at: "2026-09-24T10:00:00Z",
          piece_id: "p1",
          piece_slug: "s",
          piece_title: "t",
        },
      ],
    });
    const [l] = await readingsAsLeads(db, "u1");
    expect(l?.summary.length).toBeLessThanOrEqual(120);
  });
});

describe("relatedBySubject", () => {
  const row = (id: string) => ({
    id,
    slug: id,
    title: id,
    subtitle: null,
    kind: "research",
    subtype: null,
    publication_status: "published",
    byline: null,
    published_at: "2026-09-01",
    signed_by: null,
  });

  it("asks for documents sharing entity/theme labels, most shared first", async () => {
    const { db, calls } = makeDb({
      all: (sql) =>
        /COUNT\(DISTINCT n\.label\) AS shared/.test(sql) ? [{ ...row("b"), shared: 3 }] : [],
    });
    const out = await relatedBySubject(db, "u1", "a", 4);
    expect(out.map((p) => p.id)).toEqual(["b"]);
    expect("shared" in (out[0] ?? {})).toBe(false);
    const q = calls.find((c) => /AS shared/.test(c.sql));
    expect(q?.sql).toMatch(/kind IN \('entity','theme'\)/);
    expect(q?.sql).toMatch(/LENGTH\(label\) >= \?/);
    expect(q?.sql).toMatch(/ORDER BY shared DESC, p\.published_at DESC/);
    // Only the shared query ran — no recency fallback when subjects exist.
    expect(calls.some((c) => /ORDER BY published_at DESC, updated_at DESC/.test(c.sql))).toBe(
      false,
    );
  });

  it("falls back to recency when the document shares no subjects", async () => {
    const { db } = makeDb({
      all: (sql) =>
        /AS shared/.test(sql)
          ? []
          : /publication_status IN/.test(sql)
            ? [row("a"), row("c"), row("d")]
            : [],
    });
    const out = await relatedBySubject(db, "u1", "a", 1);
    expect(out.map((p) => p.id)).toEqual(["c"]);
  });
});

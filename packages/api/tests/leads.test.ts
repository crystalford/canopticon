// Leads — where the corpus is strange.
//
// The rule these exist to defend is not a performance property or an output
// format. It is this: FREQUENCY IS NOT A LEAD TYPE. The tempting query — "this
// appears in N documents, so it matters" — is banned, because these documents
// are the operator's own research output rather than independent sources, so
// three of them agreeing may be one upstream page echoing three times. A tally
// would launder that repetition into apparent significance.
//
// If someone later adds a count-based lead, or sorts leads by one, these tests
// should be what stops it.

import { describe, expect, it } from "vitest";
import { contradictionLeads, leadsForCorpus, unsourcedFigureLeads } from "../src/graph/lib/leads";

/** A D1 stub that answers by which table the SQL names. */
function db(rows: { contradictions?: unknown[]; findings?: unknown[] } = {}) {
  const captured: string[] = [];
  const mk = (sql: string) => {
    const stmt = {
      bind: () => stmt,
      first: async () => null,
      all: async () => {
        captured.push(sql);
        if (/FROM edges/i.test(sql)) return { results: rows.contradictions ?? [] };
        if (/FROM aeo_findings/i.test(sql)) return { results: rows.findings ?? [] };
        return { results: [] };
      },
      run: async () => ({ results: [], meta: { changes: 0 } }),
    };
    return stmt;
  };
  return {
    sql: captured,
    d1: {
      prepare: (sql: string) => mk(sql),
      dump: async () => new ArrayBuffer(0),
      batch: async () => [],
      exec: async () => ({ count: 0, duration: 0 }),
    } as unknown as Parameters<typeof contradictionLeads>[0],
  };
}

const contradiction = {
  src_label: "Spending rose 18%",
  dst_label: "Spending was flat",
  edge_type: "contradicts",
  quote_id: "q1",
  verbatim_text: "Spending rose eighteen percent",
  piece_id: "p1",
  piece_slug: "doc-one",
  piece_title: "Document One",
  other_slug: "doc-two",
  other_title: "Document Two",
  created_at: "2026-09-02T00:00:00Z",
};

const unsourced = {
  figure: "$1.2B",
  measures: "total transfers",
  quote_id: "q2",
  verbatim_text: "transfers totalled 1.2 billion",
  piece_id: "p1",
  piece_slug: "doc-one",
  piece_title: "Document One",
  created_at: "2026-09-03T00:00:00Z",
};

describe("frequency is never the mechanism", () => {
  it("no lead query counts occurrences or orders by a count", async () => {
    const { sql, d1 } = db();
    await leadsForCorpus(d1, "u1");
    for (const q of sql) {
      // A COUNT in an ORDER BY is the exact shape being banned. (COUNT may
      // legitimately appear elsewhere one day; ranking by it may not.)
      expect(q).not.toMatch(/ORDER BY[\s\S]*COUNT/i);
      expect(q).not.toMatch(/ORDER BY[\s\S]*\b(n|occurrences|freq|mentions)\b\s+DESC/i);
    }
  });

  it("orders by recency, which is a list order and not a ranking", async () => {
    const { sql, d1 } = db();
    await leadsForCorpus(d1, "u1");
    expect(sql.length).toBeGreaterThan(0);
    for (const q of sql) expect(q).toMatch(/ORDER BY[\s\S]*created_at DESC/i);
  });

  it("merges the two kinds newest-first, not by kind priority", async () => {
    const { d1 } = db({ contradictions: [contradiction], findings: [unsourced] });
    const leads = await leadsForCorpus(d1, "u1");
    // The unsourced figure is newer, so it leads — even though a contradiction
    // is arguably the "better" lead. Nothing here scores one against another.
    expect(leads.map((l) => l.kind)).toEqual(["unsourced-figure", "contradiction"]);
  });
});

describe("a contradiction is cross-document by definition", () => {
  it("requires the two ends to come from different pieces", async () => {
    const { sql, d1 } = db();
    await contradictionLeads(d1, "u1");
    const q = sql[0] ?? "";
    expect(q).toMatch(/sn\.piece_id <> dn\.piece_id/);
    // Same-document disagreement is usually an author laying out both sides.
    expect(q).toMatch(/sn\.piece_id IS NOT NULL/);
    expect(q).toMatch(/dn\.piece_id IS NOT NULL/);
  });

  it("reads the evidential edges rather than assertions.rank", async () => {
    // rank='contested' is computed by a sweep in the dormant settle pipeline;
    // with the cron off it would be stale or empty, so a lead built on it
    // would silently report nothing.
    const { sql, d1 } = db();
    await contradictionLeads(d1, "u1");
    const q = sql[0] ?? "";
    expect(q).toMatch(/family = 'evidential'/);
    expect(q).toMatch(/contradicts/);
    expect(q).not.toMatch(/assertions/);
  });

  it("carries both documents so the lead can be followed either way", async () => {
    const { d1 } = db({ contradictions: [contradiction] });
    const [lead] = await contradictionLeads(d1, "u1");
    expect(lead?.piece_slug).toBe("doc-one");
    expect(lead?.other_piece_slug).toBe("doc-two");
    expect(lead?.quote_id).toBe("q1");
  });
});

describe("an unsourced figure", () => {
  it("matches only findings with no attribution at all", async () => {
    const { sql, d1 } = db();
    await unsourcedFigureLeads(d1, "u1");
    const q = sql[0] ?? "";
    expect(q).toMatch(/attributed_to IS NULL/);
    // Whitespace-only attribution is not attribution.
    expect(q).toMatch(/TRIM\(f\.attributed_to\) = ''/);
  });

  it("says what is missing without judging the figure", async () => {
    const { d1 } = db({ findings: [unsourced] });
    const [lead] = await unsourcedFigureLeads(d1, "u1");
    expect(lead?.summary).toContain("no source named");
    // It must not claim the number is wrong — only that the corpus cannot say
    // where it came from.
    expect(lead?.summary).not.toMatch(/wrong|false|incorrect|unreliable/i);
  });
});

describe("scoping to one document", () => {
  it("filters both kinds by piece when asked", async () => {
    const { sql, d1 } = db();
    await leadsForCorpus(d1, "u1", { pieceId: "p1" });
    expect(sql.some((q) => /sn\.piece_id = \?/.test(q))).toBe(true);
    expect(sql.some((q) => /f\.piece_id = \?/.test(q))).toBe(true);
  });

  it("degrades to an empty list rather than throwing", async () => {
    // These run on the library page. A query failure must not take the page
    // down — the operator loses the leads, not the ability to upload.
    const broken = {
      prepare: () => {
        throw new Error("no such table");
      },
    } as unknown as Parameters<typeof leadsForCorpus>[0];
    await expect(leadsForCorpus(broken, "u1")).resolves.toEqual([]);
  });
});

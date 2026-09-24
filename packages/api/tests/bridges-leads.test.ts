// Bridges — the fourth lead (docs/the-record.md §5b).
//
// A bridge is a subject that appears in two documents filed under DIFFERENT
// sections. The tests pin the shape of the query rather than its result: it
// must join on differing topics, both non-null; it must order by recency and
// never by a count; and it must carry both documents so a run can be parented
// to the newer one.

import { describe, expect, it } from "vitest";
import { bridgeLeads, leadsForCorpus } from "../src/graph/lib/leads";

function db(bridges: unknown[] = []) {
  const captured: { sql: string; params: unknown[] }[] = [];
  const mk = (sql: string) => {
    let bound: unknown[] = [];
    const stmt = {
      bind: (...a: unknown[]) => {
        bound = a;
        return stmt;
      },
      first: async () => null,
      all: async () => {
        captured.push({ sql, params: bound });
        if (/pa\.topic <> pb\.topic/i.test(sql)) return { results: bridges };
        return { results: [] };
      },
      run: async () => ({ results: [], meta: { changes: 0 } }),
    };
    return stmt;
  };
  return {
    captured,
    d1: {
      prepare: (sql: string) => mk(sql),
      dump: async () => new ArrayBuffer(0),
      batch: async () => [],
      exec: async () => ({ count: 0, duration: 0 }),
    } as unknown as Parameters<typeof bridgeLeads>[0],
  };
}

const bridge = {
  label: "allostatic load",
  piece_id: "p-neuro",
  piece_slug: "addiction-allostasis",
  piece_title: "Allostasis and Addiction",
  piece_topic: "Health & bodies",
  other_id: "p-media",
  other_slug: "medium-becomes-ground",
  other_title: "The Medium Becomes the Ground",
  other_topic: "Media & mind",
  created_at: "2026-09-20T00:00:00Z",
};

describe("bridgeLeads — the query", () => {
  it("joins only pieces whose sections differ, both filed", async () => {
    const { captured, d1 } = db();
    await bridgeLeads(d1, "u1");
    const q = captured[0]?.sql ?? "";
    expect(q).toMatch(/pa\.topic IS NOT NULL/);
    expect(q).toMatch(/pb\.topic IS NOT NULL/);
    expect(q).toMatch(/pa\.topic <> pb\.topic/);
    // A label shared by two documents, not one document with itself.
    expect(q).toMatch(/b\.piece_id <> a\.piece_id/);
    // Subjects only, long enough to be a phrase and not a surname or a year.
    expect(q).toMatch(/kind IN \('entity','theme'\)/);
    expect(q).toMatch(/LENGTH\(label\) >= 8/);
    // Published on both sides: a bridge to working material is not public.
    expect(q.match(/publication_status IN \('published','canonical'\)/g)?.length).toBe(2);
  });

  it("orders recent-first and never by a count", async () => {
    const { captured, d1 } = db();
    await bridgeLeads(d1, "u1");
    const q = captured[0]?.sql ?? "";
    expect(q).toMatch(/ORDER BY created_at DESC/);
    expect(q).not.toMatch(/ORDER BY[\s\S]*COUNT/i);
    expect(q).not.toMatch(/GROUP BY[\s\S]*HAVING/i);
  });

  it("puts the newer document first so a run is parented to it", async () => {
    const { captured, d1 } = db();
    await bridgeLeads(d1, "u1");
    const q = captured[0]?.sql ?? "";
    expect(q).toMatch(
      /COALESCE\(pa\.published_at, pa\.created_at\) > COALESCE\(pb\.published_at, pb\.created_at\)/,
    );
  });

  it("scopes to one document on either side, and defaults the limit to 12", async () => {
    const { captured, d1 } = db();
    await bridgeLeads(d1, "u1", { pieceId: "p-neuro" });
    expect(captured[0]?.sql).toMatch(/AND \(pa\.id = \? OR pb\.id = \?\)/);
    expect(captured[0]?.params).toEqual(["u1", "p-neuro", "p-neuro", 12]);
    const plain = db();
    await bridgeLeads(plain.d1, "u1");
    expect(plain.captured[0]?.params).toEqual(["u1", 12]);
  });

  it("shapes the lead: summary names both sections, seed is the connecting question", async () => {
    const { d1 } = db([bridge]);
    const [lead] = await bridgeLeads(d1, "u1");
    expect(lead?.kind).toBe("bridge");
    expect(lead?.summary).toBe("allostatic load — in Health & bodies and Media & mind");
    expect(lead?.seed).toBe(
      'What connects "allostatic load" in "Allostasis and Addiction" and "The Medium Becomes the Ground"?',
    );
    expect(lead?.piece_id).toBe("p-neuro");
    expect(lead?.piece_slug).toBe("addiction-allostasis");
    expect(lead?.other_piece_slug).toBe("medium-becomes-ground");
    expect(lead?.other_piece_title).toBe("The Medium Becomes the Ground");
    expect(lead?.quote_id).toBeNull();
    expect(lead?.angle).toContain("filed under different sections");
  });

  it("is part of leadsForCorpus, with an answer key", async () => {
    const { d1 } = db([bridge]);
    const leads = await leadsForCorpus(d1, "u1");
    const b = leads.find((l) => l.kind === "bridge");
    expect(b).toBeDefined();
    expect(b?.answer_key).toBeTruthy();
  });
});

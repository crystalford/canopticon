// An unsourced figure, answered the narrow way.
//
// The broad pipeline read twelve sources and wrote a brief. This reads three
// fetched pages and writes three sentences, and the only thing that makes it
// worth more than the brief is the firewall: a quote that is not in one of
// those pages is discarded and counted, an answer with no surviving quote is
// "not settled", and the stored row names the pages so the reader can follow
// every quote back to a URL.

import { beforeEach, describe, expect, it, vi } from "vitest";

const writer = vi.fn();
vi.mock("../src/llm/router", () => ({
  callResearchWriter: (...args: unknown[]) => writer(...args),
}));

import {
  type WebSource,
  answerUnsourcedFigure,
  figureQuery,
  sourcesOf,
} from "../src/graph/lib/answer-lead";
import type { Lead } from "../src/graph/lib/leads";

const LEAD: Lead = {
  kind: "unsourced-figure",
  summary: "$1.2B — the housing transfer, with no source named anywhere in the corpus",
  detail: "The province spent $1.2B on the housing transfer in 2025, its largest ever.",
  quote_id: "q1",
  piece_id: "p1",
  piece_slug: "budget-2026",
  piece_title: "Budget 2026",
  created_at: "2026-09-01T00:00:00Z",
  seed: "$1.2B the housing transfer",
  angle: "This figure appears on the record with no source named anywhere in it.",
};

const PAGES: Record<string, WebSource> = {
  s1: {
    id: "s1",
    url: "https://example.org/estimates-2025",
    title: "Main Estimates 2025",
    text:
      "The Ministry of Finance tabled the Main Estimates on 4 March 2025.\n\n" +
      "The housing transfer is listed at $1.2 billion for the fiscal year.",
  },
  s2: {
    id: "s2",
    url: "https://example.org/press",
    title: "Press release",
    text: "The minister announced the figure at a press conference in Toronto on 5 March 2025.",
  },
};

/** A D1 stub that records every INSERT so the persisted row can be inspected. */
function fakeEnv() {
  const inserts: Array<{ sql: string; params: unknown[] }> = [];
  const mk = (sql: string) => {
    let bound: unknown[] = [];
    const stmt = {
      bind(...args: unknown[]) {
        bound = args;
        return stmt;
      },
      async first() {
        return null;
      },
      async all() {
        return { results: [] };
      },
      async run() {
        if (/^INSERT/i.test(sql)) inserts.push({ sql, params: bound });
        return { results: [], meta: { changes: 1 } };
      },
    };
    return stmt;
  };
  const env = { DB: { prepare: mk } } as unknown as Parameters<typeof answerUnsourcedFigure>[0];
  return { env, inserts };
}

const bank = async () => ["s1", "s2", "s3"];
const read = async (_e: unknown, _u: unknown, id: string) => PAGES[id] ?? null;

function reply(answer: string, quotes: Array<{ text: string; document?: string }>) {
  writer.mockResolvedValueOnce({
    text: "",
    structured: { answer, quotes },
    model: "claude-test",
  });
}

function storedRow(inserts: Array<{ sql: string; params: unknown[] }>) {
  const ins = inserts.find((i) => /INSERT INTO lead_answers/.test(i.sql));
  if (!ins) throw new Error("no lead_answers row written");
  const cols =
    ins.sql
      .match(/\(([^)]+)\)/)?.[1]
      ?.split(",")
      .map((c) => c.trim()) ?? [];
  return Object.fromEntries(cols.map((c, i) => [c, ins.params[i]]));
}

beforeEach(() => writer.mockReset());

describe("figureQuery", () => {
  it("is the figure plus the sentence around it, without quotes", () => {
    const q = figureQuery(LEAD);
    expect(q.startsWith("$1.2B the housing transfer")).toBe(true);
    expect(q).toContain("province spent");
    expect(q).not.toMatch(/["“”]/);
  });
  it("falls back to the seed alone", () => {
    expect(figureQuery({ seed: "$1.2B housing", detail: "$1.2B housing" })).toBe("$1.2B housing");
  });
});

describe("answerUnsourcedFigure", () => {
  it("answers in three sentences from the fetched pages and cites them", async () => {
    const { env, inserts } = fakeEnv();
    reply("The Ministry of Finance reports it. It is in the Main Estimates. Tabled 4 March 2025.", [
      { text: "The housing transfer is listed at $1.2 billion for the fiscal year." },
      {
        text: "The minister announced the figure at a press conference in Toronto on 5 March 2025.",
      },
    ]);
    const a = await answerUnsourcedFigure(env, "u1", LEAD, { bank, read });
    expect(a.status).toBe("answered");
    expect(a.quotes).toHaveLength(2);
    expect(a.quotes[0]?.source_id).toBe("s1");
    expect(a.quotes[0]?.url).toBe("https://example.org/estimates-2025");
    expect(a.quotes[0]?.piece_id).toBeNull();
    expect(a.sources).toEqual([
      { id: "s1", url: "https://example.org/estimates-2025", title: "Main Estimates 2025" },
      { id: "s2", url: "https://example.org/press", title: "Press release" },
    ]);
    expect(a.discarded).toBe(0);

    // The writer saw the pages, not the corpus, and only the pages that read.
    const prompt = JSON.stringify(writer.mock.calls[0]?.[1]);
    expect(prompt).toContain("Main Estimates 2025");
    expect(prompt).toContain("FIGURE: $1.2B the housing transfer");

    // The row carries the source ids, on the quotes, under the lead's key.
    const row = storedRow(inserts);
    expect(row.kind).toBe("unsourced-figure");
    expect(row.status).toBe("answered");
    const quotes = JSON.parse(String(row.quotes)) as Array<{ source_id?: string }>;
    expect(quotes.map((q) => q.source_id)).toEqual(["s1", "s2"]);
    expect(sourcesOf(quotes as never).map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("kills a quote found in no fetched page and counts it", async () => {
    const { env } = fakeEnv();
    reply("The Ministry reports it in the Estimates.", [
      { text: "The housing transfer is listed at $1.2 billion for the fiscal year." },
      { text: "The housing transfer was $1.2 billion, the largest in provincial history." },
    ]);
    const a = await answerUnsourcedFigure(env, "u1", LEAD, { bank, read });
    expect(a.status).toBe("answered");
    expect(a.quotes).toHaveLength(1);
    expect(a.discarded).toBe(1);
  });

  it("is not settled when no quote survives — the prose is not published as sourced", async () => {
    const { env, inserts } = fakeEnv();
    reply("It was first reported by a newspaper in 2024.", [
      { text: "A newspaper first reported the figure in 2024." },
    ]);
    const a = await answerUnsourcedFigure(env, "u1", LEAD, { bank, read });
    expect(a.status).toBe("nothing_found");
    expect(a.quotes).toEqual([]);
    expect(a.discarded).toBe(1);
    expect(a.sources).toEqual([]);
    expect(storedRow(inserts).status).toBe("nothing_found");
  });

  it("fails plainly when nothing could be fetched", async () => {
    const { env } = fakeEnv();
    const a = await answerUnsourcedFigure(env, "u1", LEAD, {
      bank: async () => ["s9"],
      read,
    });
    expect(a.status).toBe("failed");
    expect(a.error).toMatch(/no page/);
    expect(writer).not.toHaveBeenCalled();
  });

  it("fails plainly when search is not configured", async () => {
    const { env } = fakeEnv();
    const a = await answerUnsourcedFigure(env, "u1", LEAD, {
      bank: async () => {
        throw new Error("web search is not configured (BRAVE_SEARCH_API_KEY)");
      },
      read,
    });
    expect(a.status).toBe("failed");
    expect(a.error).toMatch(/not configured/);
  });
});

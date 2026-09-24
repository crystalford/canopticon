// Walk a SECTIONED research run from banked sources to a finished draft.
//
// The single-call walk is research-run-walk.test.ts. This one drives the
// path a Claude-written run takes (migration 0062): after the last search,
// outline_pending → section_pending ×N → assemble_pending → done, with the
// model and the web fetcher stubbed. Two properties matter and are asserted:
// every advance is exactly ONE writer call (the whole reason the machine is
// a machine), and a quote the writer did not copy verbatim from a source is
// killed and counted, never kept.

import { beforeEach, describe, expect, it, vi } from "vitest";

const SOURCE_TEXT = `The attribution market consolidated through 2025. ${"Filler sentence about measurement. ".repeat(40)}Incrementality testing remains rare outside the largest advertisers, the survey found. ${"More filler. ".repeat(20)}`;

const VERBATIM =
  "Incrementality testing remains rare outside the largest advertisers, the survey found.";
const FABRICATED = "Incrementality testing is now universal among advertisers, the survey found.";

const SECTION_BODY = `The sources agree on the shape of the market. ${"A supported claim. ".repeat(80)}`;

const expandRecord = vi.fn(async (_env: unknown, _u: string, q: string) => ({
  banked_source_ids: [`src-${q.replace(/\W+/g, "-").slice(0, 12)}`],
  rejected: [],
  sources_rejected: 0,
  sources_found: 1,
  sources_fetched: 1,
  sources_banked: 1,
  sources_duplicate: 0,
  errors: [],
}));
vi.mock("../src/graph/lib/record-builder", () => ({
  expandRecord,
  getExpandStatus: async () => null,
}));

const writer = vi.fn();
vi.mock("../src/llm/router", () => ({
  callResearchWriter: (...a: unknown[]) => writer(...a),
  callRole: async () => ({ text: "" }),
  modelForRole: () => ({ model: "test-model" }),
  // Claude through the gateway: the run is written in sections.
  resolveWriter: () => ({ provider: "claude_gateway", model: "claude" }),
}));

import {
  advanceResearchRun,
  decideResearchMode,
  researchOnDemand,
  verifySectionQuotes,
} from "../src/graph/lib/deep-research";

/** The writer, dispatched on which of the four prompts it was handed. */
function answer(system: string, outlineSize: number): string {
  if (system.includes("Your only job now is the OUTLINE")) {
    return JSON.stringify({
      sections: Array.from({ length: outlineSize }, (_, i) => ({
        heading: `Section ${i + 1}`,
        brief_of_section: `What section ${i + 1} establishes.`,
        sources: ["S1", "S9"], // S9 does not exist and must be dropped, not guessed
      })),
    });
  }
  if (system.includes("You are writing ONE SECTION")) {
    return JSON.stringify({
      body_md: SECTION_BODY,
      quotes: [
        { text: VERBATIM, source: "S1" },
        { text: FABRICATED, source: "S1" },
      ],
    });
  }
  if (system.includes("Write ONLY what frames them")) {
    return JSON.stringify({
      title: "A sectioned brief",
      summary: `What the sections establish, in one paragraph. ${"Supported. ".repeat(10)}`,
      gaps: ["Whether the survey's sample was representative."],
    });
  }
  // The first synthesis: no follow-ups, so the run goes straight to the outline.
  return JSON.stringify({
    title: "T",
    body_md: `## F\n${"x ".repeat(120)}`,
    followup_queries: [],
  });
}

function makeEnv() {
  const runs = new Map<string, Record<string, unknown>>();
  const pieces: Array<Record<string, unknown>> = [];
  const db = {
    prepare(sql: string) {
      const stmt = {
        args: [] as unknown[],
        bind(...a: unknown[]) {
          stmt.args = a;
          return stmt;
        },
        async first() {
          if (/FROM research_runs/i.test(sql)) {
            const want = /status IN \(([^)]*)\)/i.exec(sql)?.[1] ?? "";
            const states = [...want.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
            return [...runs.values()].find((r) => states.includes(r.status as string)) ?? null;
          }
          if (/FROM sources/i.test(sql)) {
            return { title: "The survey", content_text: SOURCE_TEXT, metadata: "{}" };
          }
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          const head = sql.trim();
          const cols = (/\(([^)]*)\) VALUES/i.exec(sql)?.[1] ?? "").split(",").map((c) => c.trim());
          if (/^INSERT INTO research_runs/i.test(head)) {
            const row: Record<string, unknown> = {};
            cols.forEach((c, i) => (row[c] = stmt.args[i]));
            runs.set(row.id as string, row);
          } else if (/^INSERT INTO pieces/i.test(head)) {
            const row: Record<string, unknown> = {};
            cols.forEach((c, i) => (row[c] = stmt.args[i]));
            pieces.push(row);
          } else if (/^UPDATE research_runs/i.test(head)) {
            const set = [...sql.matchAll(/([a-z0-9_]+)\s*=\s*\?/gi)].map((m) => m[1] as string);
            const row = runs.get(stmt.args[stmt.args.length - 1] as string);
            if (row) set.forEach((c, i) => (row[c] = stmt.args[i]));
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
  return { env: { DB: db } as never, runs, pieces };
}

const only = (runs: Map<string, Record<string, unknown>>) =>
  [...runs.values()][0] as Record<string, unknown>;

describe("a sectioned research run reaches a draft", () => {
  beforeEach(() => {
    expandRecord.mockClear();
    writer.mockReset();
    writer.mockImplementation(async (_env: unknown, args: { system: string }) => ({
      text: answer(args.system, 3),
      structured: null,
    }));
  });

  it("is sectioned when the resolved writer is Claude", () => {
    expect(decideResearchMode({} as never, "anthropic")).toBe("sectioned");
  });

  it("walks synth → outline → one section per press → assemble → done, one call each", async () => {
    const { env, runs, pieces } = makeEnv();
    await researchOnDemand(env, "u1", "What is the white space?", undefined, {
      writer: "anthropic",
    });
    expect(only(runs).mode).toBe("sectioned");
    expect(writer).not.toHaveBeenCalled();

    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      const before = writer.mock.calls.length;
      const r = await advanceResearchRun(env, "u1");
      if (!r.advanced) break;
      // The property the machine exists for: one model-heavy step per press.
      expect(writer.mock.calls.length - before).toBe(1);
      seen.push(only(runs).status as string);
      if (only(runs).status === "done") break;
    }
    expect(seen).toEqual([
      "outline_pending", // first synthesis wanted nothing more; Claude writes in sections
      "section_pending", // outline of 3 stored
      "section_pending", // section 1
      "section_pending", // section 2
      "assemble_pending", // section 3 — all written
      "done", // title, summary, gaps; brief persisted
    ]);
    expect(expandRecord).toHaveBeenCalledTimes(1); // pass 1's own, and never again

    // The outline named a source that does not exist; it was dropped.
    const outline = JSON.parse(only(runs).outline as string) as Array<{ source_ids: string[] }>;
    expect(outline).toHaveLength(3);
    expect(outline[0]?.source_ids).toEqual(["src-What-is-the-"]);

    // Each section: the verbatim quote kept as the SOURCE's text, the
    // fabricated one killed and counted.
    const done = JSON.parse(only(runs).sections_done as string) as Array<{
      heading: string;
      body_md: string;
      quotes_ok: number;
      quotes_killed: number;
    }>;
    expect(done.map((s) => s.heading)).toEqual(["Section 1", "Section 2", "Section 3"]);
    for (const s of done) {
      expect(s.quotes_ok).toBe(1);
      expect(s.quotes_killed).toBe(1);
      expect(s.body_md).toContain(`> ${VERBATIM}`);
      expect(s.body_md).not.toContain(FABRICATED);
    }

    // The brief: summary, the sections in order, the gaps — and the killed
    // count summed into the piece's metadata for the review page.
    expect(pieces).toHaveLength(1);
    const piece = pieces[0] as { body_md: string; metadata: string; publication_status: string };
    expect(piece.publication_status).toBe("working-material");
    const body = piece.body_md;
    expect(body.indexOf("## Section 1")).toBeLessThan(body.indexOf("## Section 2"));
    expect(body.indexOf("## Section 3")).toBeLessThan(
      body.indexOf("## What this brief could not establish"),
    );
    expect(body).toContain("- Whether the survey's sample was representative.");
    const meta = JSON.parse(piece.metadata);
    expect(meta.mode).toBe("sectioned");
    expect(meta.sections).toBe(3);
    expect(meta.quotes_ok).toBe(3);
    expect(meta.quotes_killed).toBe(3);
    expect(only(runs).final_piece_id).toBeTruthy();
  });

  it("fails the run, stated, when the writer returns no outline", async () => {
    writer.mockImplementation(async (_env: unknown, args: { system: string }) => ({
      text: args.system.includes("OUTLINE") ? "not json" : answer(args.system, 3),
      structured: null,
    }));
    const { env, runs } = makeEnv();
    await researchOnDemand(env, "u1", "Q", undefined, { writer: "anthropic" });
    await advanceResearchRun(env, "u1"); // synth → outline_pending
    await advanceResearchRun(env, "u1"); // the outline, which is garbage
    expect(only(runs).status).toBe("failed");
    expect(only(runs).error).toMatch(/outline/);
  });
});

describe("the section firewall", () => {
  const sources = [{ title: "The survey", text: SOURCE_TEXT }];

  it("keeps the source's substring, not the model's string", () => {
    const r = verifySectionQuotes([{ text: `  ${VERBATIM.replace(/ /g, "  ")} ` }], sources);
    expect(r.quotes).toEqual([{ text: VERBATIM, title: "The survey" }]);
    expect(r.killed).toBe(0);
  });

  it("kills what is not in any source, and counts it", () => {
    const r = verifySectionQuotes(
      [{ text: FABRICATED }, { text: "" }, { text: VERBATIM }, { text: VERBATIM }],
      sources,
    );
    expect(r.quotes).toHaveLength(1); // the duplicate is neither kept twice nor counted as killed
    expect(r.killed).toBe(2);
  });
});

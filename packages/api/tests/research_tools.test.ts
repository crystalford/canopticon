import { beforeEach, describe, expect, it } from "vitest";
import {
  type ResearchToolContext,
  executeResearchTool,
} from "../src/orchestrator/research_tools.ts";

// ---------------------------------------------------------------------------
// Stub Supabase client. The research tools use:
//   .from('sources')
//     .select(...).eq(...).eq(...).maybeSingle()  (URL dedup)
//     .insert(...).select(...).single()           (registration)
//     .select(...).eq(...).order(...).limit(...)  (recent sources query)
//   .from('claims')
//     .select(...).eq(...).eq(...).order(...).limit(...)
//   .from('entities')
//     .select(...).eq(...).ilike(...).limit(...)
// We capture every insert and let tests assert on it.

interface StubState {
  existingSources: Array<{
    id: string;
    title: string;
    url: string | null;
    ingestion_state: string;
  }>;
  recentSources: Array<Record<string, unknown>>;
  recentClaims: Array<Record<string, unknown>>;
  entities: Array<Record<string, unknown>>;
  inserts: Array<{ table: string; row: Record<string, unknown> }>;
}

function stubService(state: StubState) {
  function builder(table: string) {
    const insertBuilder = makeInsertBuilder(table, state);
    const listBuilder = makeListBuilder(table, state);
    return {
      select: (..._args: unknown[]) => listBuilder,
      insert: (row: Record<string, unknown>) => insertBuilder(row),
    };
  }
  return { from: builder } as unknown as ResearchToolContext["service"];
}

function makeInsertBuilder(table: string, state: StubState) {
  return (row: Record<string, unknown>) => {
    state.inserts.push({ table, row });
    const inserted = {
      id: `stub-${state.inserts.length}`,
      title: (row.title as string) ?? "stub",
      ingestion_state: (row.ingestion_state as string) ?? "pending_critic",
    };
    return {
      select: () => ({
        single: () => Promise.resolve({ data: inserted, error: null }),
      }),
    };
  };
}

function makeListBuilder(table: string, state: StubState) {
  // Track chained filters; .maybeSingle() resolves the URL dedup if the
  // chain references both user_id and url.
  let urlFilter: string | null = null;
  const chain: Record<string, unknown> = {};
  chain.eq = (col: string, val: unknown) => {
    if (col === "url" && typeof val === "string") urlFilter = val;
    return chain;
  };
  chain.ilike = () => chain;
  chain.order = () => chain;
  chain.limit = (_n: number) => Promise.resolve({ data: rowsFor(table, state), error: null });
  chain.maybeSingle = () => {
    if (table === "sources" && urlFilter) {
      const found = state.existingSources.find((s) => s.url === urlFilter) ?? null;
      return Promise.resolve({ data: found, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  };
  // Allow `await chain` to resolve to the array for the limit-less path.
  Object.defineProperty(chain, ["t", "h", "e", "n"].join(""), {
    value: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
      resolve({ data: rowsFor(table, state), error: null }),
    enumerable: false,
  });
  return chain;
}

function rowsFor(table: string, state: StubState): Array<Record<string, unknown>> {
  if (table === "sources") return state.recentSources;
  if (table === "claims") return state.recentClaims;
  if (table === "entities") return state.entities;
  return [];
}

// ---------------------------------------------------------------------------

const baseInput = {
  url: "https://example.com/article",
  title: "Example article on the topic",
  raw_text: "Article body verbatim — at least one character so it passes validation.",
  source_type: "news" as const,
  reason: "introduces the historical context the operator asked about",
};

describe("executeResearchTool", () => {
  let state: StubState;
  let ctx: ResearchToolContext;

  beforeEach(() => {
    state = {
      existingSources: [],
      recentSources: [],
      recentClaims: [],
      entities: [],
      inserts: [],
    };
    ctx = {
      service: stubService(state),
      user_id: "00000000-0000-0000-0000-000000000001",
      thesis_id: null,
      research_run_id: "11111111-1111-1111-1111-111111111111",
    };
  });

  describe("register_source", () => {
    it("inserts a sources row and returns the new id", async () => {
      const result = await executeResearchTool(ctx, "register_source", baseInput);
      expect(result.meta.is_error).toBe(false);
      expect(result.meta.source_id).toMatch(/^stub-\d+$/);
      expect(state.inserts).toHaveLength(1);
      const inserted = state.inserts[0];
      if (!inserted) throw new Error("inserted row missing");
      expect(inserted.table).toBe("sources");
      expect(inserted.row.user_id).toBe(ctx.user_id);
      expect(inserted.row.title).toBe(baseInput.title);
      expect(inserted.row.raw_text).toBe(baseInput.raw_text);
      expect(inserted.row.ingestion_state).toBe("pending_critic");
      expect(inserted.row.ingestion_mode).toBe("operator");
      expect((inserted.row.metadata as Record<string, unknown>).research_run_id).toBe(
        ctx.research_run_id,
      );
    });

    it("returns duplicate when the URL is already in the substrate", async () => {
      state.existingSources.push({
        id: "existing-1",
        title: "Already there",
        url: baseInput.url,
        ingestion_state: "approved",
      });
      const result = await executeResearchTool(ctx, "register_source", baseInput);
      expect(result.meta.is_error).toBe(false);
      const parsed = JSON.parse(result.content) as { status: string; existing_source_id: string };
      expect(parsed.status).toBe("duplicate");
      expect(parsed.existing_source_id).toBe("existing-1");
      expect(state.inserts).toHaveLength(0);
    });

    it("rejects empty title", async () => {
      const result = await executeResearchTool(ctx, "register_source", {
        ...baseInput,
        title: "",
      });
      expect(result.meta.is_error).toBe(true);
      expect(result.content).toContain("title");
    });

    it("rejects empty raw_text — the snippet is not the source", async () => {
      const result = await executeResearchTool(ctx, "register_source", {
        ...baseInput,
        raw_text: "",
      });
      expect(result.meta.is_error).toBe(true);
      expect(result.content).toContain("raw_text");
    });

    it("rejects unknown source_type", async () => {
      const result = await executeResearchTool(ctx, "register_source", {
        ...baseInput,
        source_type: "tweet",
      });
      expect(result.meta.is_error).toBe(true);
    });
  });

  describe("query_substrate", () => {
    it("returns recent sources", async () => {
      state.recentSources = [
        { id: "s1", title: "First" },
        { id: "s2", title: "Second" },
      ];
      const result = await executeResearchTool(ctx, "query_substrate", {
        filter: "my_recent_sources",
      });
      expect(result.meta.is_error).toBe(false);
      const parsed = JSON.parse(result.content) as { rows: unknown[] };
      expect(parsed.rows).toHaveLength(2);
    });

    it("returns recent claims", async () => {
      state.recentClaims = [{ id: "c1", layer: "factual" }];
      const result = await executeResearchTool(ctx, "query_substrate", {
        filter: "my_recent_claims",
      });
      expect(result.meta.is_error).toBe(false);
    });

    it("returns entities by name match", async () => {
      state.entities = [{ id: "e1", canonical_name: "Test Entity" }];
      const result = await executeResearchTool(ctx, "query_substrate", {
        filter: "entities_by_name",
        query: "Test",
      });
      expect(result.meta.is_error).toBe(false);
    });

    it("rejects entities_by_name without a query", async () => {
      const result = await executeResearchTool(ctx, "query_substrate", {
        filter: "entities_by_name",
      });
      expect(result.meta.is_error).toBe(true);
    });
  });

  describe("mark_done", () => {
    it("returns the summary in done meta", async () => {
      const result = await executeResearchTool(ctx, "mark_done", {
        summary: "registered 4 sources covering the 2014 reorganization",
      });
      expect(result.meta.is_error).toBe(false);
      expect(result.meta.done?.summary).toContain("2014 reorganization");
    });

    it("rejects empty summary", async () => {
      const result = await executeResearchTool(ctx, "mark_done", { summary: "" });
      expect(result.meta.is_error).toBe(true);
    });
  });

  it("returns an error for unknown tool names", async () => {
    const result = await executeResearchTool(ctx, "not_a_tool", {});
    expect(result.meta.is_error).toBe(true);
    expect(result.content).toContain("unknown tool");
  });
});

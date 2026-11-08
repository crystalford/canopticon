// Test a thesis: a research conversation in thesis mode carries the thesis
// instructions in its frozen frame; an ordinary research conversation does not.
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { runTurn } from "../src/write/agent";
import { memoryDrafts } from "../src/write/drafts";
import { memoryNotes } from "../src/write/notes";
import { memorySources } from "../src/write/research";

const env = {
  LOG_LEVEL: "error",
  AI: {
    run: async () => ({
      choices: [
        { message: { role: "assistant", content: "Reading first." }, finish_reason: "stop" },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 2 },
    }),
  },
} as unknown as Env;

async function frameOf(mode?: "thesis" | "deepen") {
  const store = memoryDrafts();
  const d = await store.create("research");
  await store.save(d.id, {
    meta: { ...d.meta, engine: "team:flash", ...(mode ? { mode } : {}) },
  });
  await runTurn({
    stream: null,
    env,
    store,
    sources: memorySources(),
    notes: memoryNotes(),
    draftId: d.id,
    text: "Minimum wage rises cut youth jobs.",
    emit: () => {},
  });
  return JSON.parse((await store.get(d.id))?.frame ?? "{}") as { system: string };
}

describe("Test a thesis", () => {
  it("freezes the thesis instructions into a thesis conversation only", async () => {
    const thesis = await frameOf("thesis");
    expect(thesis.system).toContain("THIS CONVERSATION TESTS A THESIS");
    expect(thesis.system).toContain("The strongest case against");
    expect(thesis.system).toContain("**Verdict: Supported**");
    const plain = await frameOf();
    expect(plain.system).not.toContain("TESTS A THESIS");
  });

  it("is offered beside New research", async () => {
    const { renderWriteList } = await import("../src/site/pages/write");
    const html = renderWriteList([], { hasKey: false, engine: "team:flash" });
    expect(html).toContain('name="kind" value="thesis"');
    expect(html).toContain("Test a thesis");
  });
});

describe("Deepen", () => {
  it("lists the loose ends found in code: open questions, flags, echoing sources", async () => {
    const { deepenBrief } = await import("../src/write/research");
    const brief = deepenBrief({
      meta: {
        title: "Pharmacare",
        review: [
          { section: 2, kind: "unsupported", sentence: "BC was first.", why: "No note says so." },
        ],
        sources: { cited: 10, independent: 7, echoes: [{ why: "wording", sources: [3, 5] }] },
      },
      body: "## TL;DR\n\nX.\n\n## Open questions\n\n- How many people use it?\n\n## Sources\n\n1. [A](https://a)",
    });
    expect(brief).toContain('Deepen this report: "Pharmacare"');
    expect(brief).toContain("- How many people use it?");
    expect(brief).toContain('§2 unsupported: "BC was first."');
    expect(brief).toContain("10 cited, about 7 independent");
    expect(brief).toContain("[3] [5]");
  });

  it("freezes the deepen instructions into a deepen conversation", async () => {
    const f = await frameOf("deepen");
    expect(f.system).toContain("THIS CONVERSATION DEEPENS A FINISHED REPORT");
    expect(f.system).not.toContain("TESTS A THESIS");
  });

  it("offers Deepen, free or with Claude, on a written report", async () => {
    const { renderWorkspace } = await import("../src/site/pages/write");
    const { memoryDrafts } = await import("../src/write/drafts");
    const d = await memoryDrafts().create("research");
    const html = renderWorkspace(
      { ...d, body: "word ".repeat(200) } as never,
      [],
      { total: 0, failed: [] },
      { hasKey: true, research: { problems: [], pages: 3 } },
    );
    expect(html).toContain("/deepen?with=free");
    expect(html).toContain("Deepen with Claude");
    const empty = renderWorkspace(d, [], { total: 0, failed: [] }, { hasKey: true });
    expect(empty).not.toContain("/deepen?");
  });
});

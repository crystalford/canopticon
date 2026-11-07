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

async function frameOf(mode?: "thesis") {
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

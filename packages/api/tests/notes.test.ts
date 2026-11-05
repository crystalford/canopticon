// The research notes bank and writing a report section by section.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";
import { runTurn } from "../src/write/agent";
import { memoryDrafts } from "../src/write/drafts";
import { DEFAULT_ENGINE } from "../src/write/engines";
import {
  memoryNotes,
  placeNote,
  replacePart,
  skeleton,
  sourceNumbers,
  unwritten,
  withSources,
} from "../src/write/notes";
import { articleTopics } from "../src/write/publish";
import { memorySources, reportProblems } from "../src/write/research";

afterEach(() => vi.unstubAllGlobals());

const page = (url: string, text: string, title: string | null = null) => ({
  url,
  title,
  retrievedAt: null,
  kind: "text" as const,
  text,
});

describe("the report's shape", () => {
  it("lays out an outline, replaces one part at a time, and keeps what is written", () => {
    let body = skeleton([
      { heading: "Did starts fall?", words: 800 },
      { heading: "Why?", words: 600 },
    ]);
    expect(unwritten(body)).toEqual([
      "TL;DR",
      "Key Findings",
      "1. Did starts fall?",
      "2. Why?",
      "Open questions",
    ]);
    body = replacePart(body, "1", "They fell by 31 percent [1].") as string;
    expect(body).toContain("### 1. Did starts fall?\n\nThey fell by 31 percent [1].\n");
    expect(unwritten(body)).not.toContain("1. Did starts fall?");
    body = replacePart(
      body,
      "summary",
      "## TL;DR\n\nStarts fell.\n\n## Key Findings\n\n- Down 31% [1].",
    ) as string;
    body = replacePart(
      body,
      "closing",
      "## Open questions\n\nWhy rentals rose is unsettled.",
    ) as string;
    expect(unwritten(body)).toEqual(["2. Why?"]);
    expect(replacePart(body, "9", "x")).toBeNull();
    // A revised outline keeps the written section and the summary.
    const again = skeleton(
      [
        { heading: "Did starts fall?", words: 800 },
        { heading: "What did the programs do?", words: 500 },
      ],
      body,
    );
    expect(again).toContain("They fell by 31 percent [1].");
    expect(again).toContain("Starts fell.");
    expect(again).toContain("### 2. What did the programs do?");
  });

  it("builds the Sources list from the notes, numbered in the order sources were first noted", () => {
    const notes = [
      { n: 1, url: "https://b.example", quote: "q", claim: "c", section: 1 },
      { n: 2, url: "https://a.example", quote: "q", claim: "c", section: 1 },
      { n: 3, url: "https://b.example", quote: "q", claim: "c", section: 2 },
    ];
    expect([...sourceNumbers(notes).entries()]).toEqual([
      ["https://b.example", 1],
      ["https://a.example", 2],
    ]);
    const body = withSources(skeleton([{ heading: "X", words: 300 }]), notes, [
      page("https://a.example", "…", "Page A"),
    ]);
    expect(body).toContain(
      "## Sources\n\n1. [https://b.example](https://b.example)\n2. [Page A](https://a.example)\n",
    );
  });

  it("checks a note's words against the page, and gives the page's words when they are not there", () => {
    const pages = [
      page("https://a.example", "Housing starts in Toronto fell by 31 percent in 2025, CMHC said."),
    ];
    expect(placeNote("fell by 31 percent in 2025", "https://a.example", pages)).toEqual({
      url: "https://a.example",
    });
    const miss = placeNote(
      "Housing starts in Toronto fell by thirty-one percent in 2025",
      "https://a.example",
      pages,
    );
    expect("near" in miss && miss.near?.text).toContain(
      "Housing starts in Toronto fell by 31 percent",
    );
  });
});

describe("a research turn with notes and sections", () => {
  it("outlines, reads, notes (refusing a note not on the page), writes each part and builds the Sources", async () => {
    const text =
      "Housing starts in the Toronto CMA fell 31 percent in 2025, from 37,718 to 26,087, according to CMHC. Purpose-built rental starts rose to their highest level in decades.";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(`<p>${text}</p><p>${"More context. ".repeat(20)}</p>`, {
            headers: { "content-type": "text/html" },
          }),
      ),
    );
    const topic = articleTopics()[0] ?? "Housing";
    const call = (id: string, name: string, args: unknown) => ({
      id,
      type: "function",
      function: { name, arguments: JSON.stringify(args) },
    });
    const reply = (calls: unknown[] | null, content: string | null = null) => ({
      choices: [
        {
          message: { role: "assistant", content, ...(calls ? { tool_calls: calls } : {}) },
          finish_reason: calls ? "tool_calls" : "stop",
        },
      ],
      usage: { prompt_tokens: 1000, completion_tokens: 100 },
    });
    const script = [
      reply([
        call("o", "write_outline", {
          title: "Toronto housing starts",
          topic,
          sections: [{ heading: "Did starts fall?", words: 400 }],
        }),
      ]),
      reply([call("f", "web_fetch", { url: "https://cmhc.example/report" })]),
      reply([
        call("n1", "note_evidence", {
          url: "https://cmhc.example/report",
          quote: "fell 31 percent in 2025, from 37,718 to 26,087",
          claim: "Starts fell 31% in 2025",
          section: 1,
        }),
        call("n2", "note_evidence", {
          url: "https://cmhc.example/report",
          quote: "starts fell by a third in 2025 everywhere in Ontario",
          claim: "Made up",
          section: 1,
        }),
      ]),
      reply([
        call("s1", "write_section", {
          part: "1",
          text: `CMHC reports that starts "fell 31 percent in 2025, from 37,718 to 26,087" [1]. ${"Detail. ".repeat(40)}`,
        }),
      ]),
      reply([
        call("s2", "write_section", {
          part: "closing",
          text: "## Open questions\n\nWhether rentals keep rising.",
        }),
      ]),
      reply([
        call("s3", "write_section", {
          part: "summary",
          text: "## TL;DR\n\nStarts fell by about a third in 2025 [1].\n\n## Key Findings\n\n- Down 31% [1].",
        }),
      ]),
      reply(null, "The report is written."),
    ];
    const env = {
      LOG_LEVEL: "error",
      AI: { run: async () => script.shift() },
    } as unknown as Env;
    const store = memoryDrafts();
    const sources = memorySources();
    const notes = memoryNotes();
    const d = await store.create("research");
    const events: Array<{ type: string; message?: string; text?: string }> = [];
    await runTurn({
      stream: null,
      defaultEngine: DEFAULT_ENGINE,
      env,
      store,
      sources,
      notes,
      draftId: d.id,
      text: "Did starts fall?",
      maxSteps: 10,
      emit: (e) => events.push(e as never),
    });
    expect(events.filter((e) => e.type === "error")).toEqual([]);
    expect((await notes.list(d.id)).map((n) => n.claim)).toEqual(["Starts fell 31% in 2025"]);
    const msgs = JSON.stringify(await store.messages(d.id));
    expect(msgs).toContain("Noted #1. Cite it as [1].");
    expect(msgs).toContain("Not noted: those words are not on https://cmhc.example/report");
    const saved = await store.get(d.id);
    expect(saved?.meta.title).toBe("Toronto housing starts");
    expect(saved?.body).toContain("## Sources\n\n1. [");
    expect(saved?.body).toContain("(https://cmhc.example/report)");
    expect(unwritten(saved?.body ?? "")).toEqual([]);
    expect(reportProblems(saved as never, { total: 1, failed: [] }, articleTopics())).toEqual([]);
  });
});

// The research notes bank and writing a report section by section.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";
import { runTurn } from "../src/write/agent";
import { memoryDrafts } from "../src/write/drafts";
// One model on its own (the default is the research team, tests/team.test.ts).
const FLASH = "@cf/deepseek-ai/deepseek-v4.1-flash-1017";
import {
  memoryNotes,
  placeNote,
  replacePart,
  sectionsOf,
  skeleton,
  sourceNumbers,
  unwritten,
  withSources,
} from "../src/write/notes";
import type { Progress, TurnSummary } from "../src/write/progress";
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
      defaultEngine: FLASH,
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
    // The page was told where it stood at each step, in true counts …
    const prog = events.filter((e) => e.type === "progress") as unknown as Array<{
      p: Progress;
    }>;
    expect(prog.length).toBeGreaterThan(2);
    expect(prog[0]?.p.stage).toBe("plan");
    expect(prog.some((e) => e.p.stage === "write")).toBe(true);
    expect(prog.at(-1)?.p).toMatchObject({ stage: "summary", notes: 1 });
    // … and what it ended with.
    const done = events.find((e) => e.type === "done") as unknown as { summary?: TurnSummary };
    expect(done.summary?.words).toBeGreaterThan(5);
    expect(done.summary?.sections).toBe(saved ? sectionsOf(saved.body).length : -1);
  });
});

describe("the editing pass", () => {
  it("lists what a finished report should still fix, and nothing for one that reads well", async () => {
    const { polishList } = await import("../src/write/agent");
    const long =
      "The province's own figures, which were published in the spring and then revised twice over the following months as more employers reported and as the statistics office reconciled its survey with payroll records, show a fall that is much smaller than the first release suggested [1].";
    const body = (details: string) =>
      `## TL;DR\n\nStarts fell [1].\n\n## Key Findings\n\n- Down [1].\n\n## Details\n\n### 1. A\n\n${details}\n\n## Open questions\n\nNone.\n\n## Sources\n\n1. [A](https://a.example)\n`;
    const fix = polishList(body(`${long} ${long} Short one [1].`));
    expect(fix.join(" ")).toMatch(/Sentences average \d+ words/);
    expect(fix.join(" ")).toMatch(/% of sentences run past 35 words/);
    expect(polishList(body("Starts fell a third [1]. Rentals rose [1]. Prices held [1]."))).toEqual(
      [],
    );
  });
});

describe("keeping a cheaper model to the workflow", () => {
  it("asks for the outline after a few steps, and for notes after six pages, each once", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (url: string) =>
          new Response(`<p>${`Page ${url} about housing starts in Toronto. `.repeat(20)}</p>`, {
            headers: { "content-type": "text/html" },
          }),
      ),
    );
    let k = 0;
    const fetches = (n: number) => ({
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: Array.from({ length: n }, () => {
              k++;
              return {
                id: `f${k}`,
                type: "function",
                function: {
                  name: "web_fetch",
                  arguments: JSON.stringify({ url: `https://p${k}.example` }),
                },
              };
            }),
          },
          finish_reason: "tool_calls",
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 10 },
    });
    const script = [
      fetches(2),
      fetches(2),
      fetches(3),
      fetches(2),
      { choices: [{ message: { content: "Stopping." }, finish_reason: "stop" }] },
    ];
    const env = { LOG_LEVEL: "error", AI: { run: async () => script.shift() } } as unknown as Env;
    const store = memoryDrafts();
    const d = await store.create("research");
    await runTurn({
      stream: null,
      defaultEngine: FLASH,
      env,
      store,
      sources: memorySources(),
      notes: memoryNotes(),
      draftId: d.id,
      text: "Go.",
      emit: () => {},
    });
    const all = JSON.stringify(await store.messages(d.id));
    expect(all.split("Lay the report out now with write_outline").length - 1).toBe(1);
    expect(all.split("pages and noted nothing").length - 1).toBe(1);
  });
});

describe("the gap checkpoint", () => {
  it("asks for a look before the summary, once, when every section is written", async () => {
    const call = (id: string) => ({
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              { id, type: "function", function: { name: "list_notes", arguments: "{}" } },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 10 },
    });
    const script = [
      call("a"),
      call("b"),
      { choices: [{ message: { content: "Stopping." }, finish_reason: "stop" }] },
    ];
    const env = { LOG_LEVEL: "error", AI: { run: async () => script.shift() } } as unknown as Env;
    const store = memoryDrafts();
    const d = await store.create("research");
    await store.save(d.id, {
      body: "## TL;DR\n\n_(to write)_\n\n## Details\n\n### 1. Uptake\n\nNo province publishes usage.\n\n## Sources\n",
    });
    await runTurn({
      stream: null,
      defaultEngine: FLASH,
      env,
      store,
      sources: memorySources(),
      notes: memoryNotes(),
      draftId: d.id,
      text: "Go on.",
      emit: () => {},
    });
    const all = JSON.stringify(await store.messages(d.id));
    expect(all.split("A gap is a finding only after you have looked for it").length - 1).toBe(1);
  });
});

describe("citations that point at nothing", () => {
  it("names numbers past the Sources list and sources cited in words", async () => {
    const { citationProblems } = await import("../src/write/research");
    const body = [
      "## TL;DR",
      "Four signed [1][2]. BC paid [7] and [12 as background]; see [Canada.ca, BC gov].",
      "A link [the plan](https://example.ca) and [3, 4] are fine.",
      "",
      "## Sources",
      "",
      "1. [A](https://a.example)",
      "2. [B](https://b.example)",
      "3. [C](https://c.example)",
      "4. [D](https://d.example)",
    ].join("\n");
    const p = citationProblems(body);
    expect(p[0]).toContain("[7]");
    expect(p[0]).toContain("it has 4");
    expect(p[1]).toContain("[12 as background]");
    expect(p[1]).toContain("[Canada.ca, BC gov]");
    expect(
      citationProblems(
        body
          .replace(/ and \[12 as background\]; see \[Canada\.ca, BC gov\]/, "")
          .replace("[7]", "[4]"),
      ),
    ).toEqual([]);
  });

  it("lists notes by the number to cite, not the note number first", async () => {
    const { describeNotes } = await import("../src/write/notes");
    const out = describeNotes([
      { n: 1, url: "https://a.example", quote: "q one", claim: "c one", section: 1 },
      { n: 2, url: "https://b.example", quote: "q two", claim: "c two", section: 2 },
      { n: 3, url: "https://a.example", quote: "q three", claim: "c three", section: 2 },
    ] as never);
    expect(out.split("\n")[0]).toMatch(/^cite as \[1\] · section 1 · note 1: c one/);
    expect(out).toContain("cite as [1] · section 2 · note 3");
  });
});

describe("the engine menu", () => {
  it("is what the engine test passed: the research team, then Claude", async () => {
    const { ENGINES, DEFAULT_ENGINE, engine } = await import("../src/write/engines");
    expect(DEFAULT_ENGINE).toBe("team:flash");
    expect(ENGINES.filter((e) => e.provider === "workers").map((e) => e.id)).toEqual([
      "team:flash",
    ]);
    // Conversations frozen on an engine off the menu keep it.
    for (const id of [
      "@cf/zai-org/glm-5.3",
      "@cf/deepseek-ai/deepseek-v4-pro-0813",
      "@cf/deepseek-ai/deepseek-v4.1-flash-1017",
    ])
      expect(engine(id).id).toBe(id);
  });
});

describe("figures not in any page read", () => {
  const pages = [
    {
      url: "https://a.example",
      title: "A",
      text: "Manitoba reported 288,150 prescriptions. The PBO put it at $1.9 billion over five years, from 2024 to 2029. About 5 000 users.",
    },
  ] as never;

  it("finds figures with separators ignored and flags the rest", async () => {
    const { figureProblems } = await import("../src/write/research");
    const body = [
      "## Details",
      "### 1. Uptake",
      "Manitoba reported 288 150 prescriptions [1]. PEI had 5,000 users [1].",
      "The PBO said $1.9 billion [1] in 2024. Summed, that is $930 million.",
      "Section 3 of the Act; 41,000 Islanders were eligible.",
      "",
      "## Sources",
      "",
      "1. [A](https://a.example)",
    ].join("\n");
    const f = figureProblems(body, pages);
    expect(f.map((x) => x.figure)).toEqual(["930", "41,000"]);
    expect(f[1]?.sentence).toContain("Islanders");
  });

  it("is said to the writer with the sentence", async () => {
    const { describeFigures } = await import("../src/write/research");
    expect(describeFigures([])).toBe("");
    expect(describeFigures([{ figure: "41,000", sentence: "41,000 Islanders." }])).toContain(
      "FIGURES NOT FOUND in any page you read (1)",
    );
  });
});

describe("a section with its own subheadings", () => {
  it("is replaced whole when rewritten, and kept whole when the outline changes", async () => {
    const { replacePart, skeleton } = await import("../src/write/notes");
    const base = skeleton([
      { heading: "Who adopted bans?", words: 600 },
      { heading: "What changed?", words: 600 },
    ]);
    const first = replacePart(
      base,
      "1",
      "Intro.\n\n### Ontario\n\nOntario text.\n\n### England\n\nEngland text.",
    );
    expect(first).toContain("#### Ontario");
    const again = replacePart(first ?? "", "1", "New intro.\n\n### Ontario\n\nNew Ontario.");
    expect(again).not.toContain("England text.");
    expect(again?.split("Ontario").length).toBe(3); // heading + "New Ontario."
    expect(again).toContain("### 2. What changed?");
    // A revised outline keeps section 1 with all its subsections.
    const revised = skeleton(
      [
        { heading: "Who adopted bans?", words: 600 },
        { heading: "What changed?", words: 600 },
        { heading: "How strong is it?", words: 600 },
      ],
      first ?? "",
    );
    expect(revised).toContain("England text.");
    expect(revised).toContain("### 3. How strong is it?");
  });
});

describe("a section that carries its own ## heading", () => {
  it("keeps it inside the section, and the closing never cuts the Details", async () => {
    const { replacePart, skeleton, sectionsOf } = await import("../src/write/notes");
    let body = skeleton([
      { heading: "Who adopted bans?", words: 600 },
      { heading: "What changed?", words: 600 },
    ]);
    body = replacePart(body, "1", "Intro.\n\n## Ontario\n\nOntario text.") ?? "";
    body = replacePart(body, "2", "Second section text.") ?? "";
    body =
      replacePart(body, "closing", "## Beyond this question\n\nX.\n\n## Open questions\n\nY.") ??
      "";
    expect(body).toContain("#### Ontario");
    expect(sectionsOf(body).map((s) => [s.n, s.text.length > 0])).toEqual([
      [1, true],
      [2, true],
    ]);
    expect(body).toContain("Second section text.");
    expect(body.indexOf("## Beyond this question")).toBeGreaterThan(body.indexOf("Second section"));
  });
});

// The research team: after the outline, one researcher per section reads and
// notes at once on the reader model; the writer writes from the notes.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";
import { runTurn } from "../src/write/agent";
import { memoryDrafts } from "../src/write/drafts";
import { engine } from "../src/write/engines";
import { memoryNotes } from "../src/write/notes";
import { memorySources } from "../src/write/research";

afterEach(() => vi.unstubAllGlobals());

const reply = (content: string | null, calls: Array<[string, string, unknown]> = []) => ({
  choices: [
    {
      message: {
        role: "assistant",
        content,
        ...(calls.length
          ? {
              tool_calls: calls.map(([id, name, args]) => ({
                id,
                type: "function",
                function: { name, arguments: JSON.stringify(args) },
              })),
            }
          : {}),
      },
      finish_reason: calls.length ? "tool_calls" : "stop",
    },
  ],
  usage: { prompt_tokens: 1000, completion_tokens: 100 },
});

/** The perspectives call and second-round researchers, in tests about
 *  something else: no perspectives (the defaults stand in), and a second
 *  researcher that finds nothing new. */
const side = (opts?: { headers?: Record<string, string> }) => {
  const session = opts?.headers?.["x-session-affinity"] ?? "";
  if (/-views$/.test(session)) return reply("No.");
  if (/-d\d$/.test(session)) return reply("Found no other source.");
  return null;
};

describe("the research team", () => {
  it("researches every section at once and hands the writer the notes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (url: string) =>
          new Response(`<p>${`Page ${url} about housing starts in Toronto. `.repeat(20)}</p>`, {
            headers: { "content-type": "text/html" },
          }),
      ),
    );
    const team = engine("team:deepseek").team;
    if (!team) throw new Error("no team engine");
    const writer: unknown[] = [
      reply(null, [
        [
          "o1",
          "write_outline",
          {
            title: "Starts",
            topic: "Housing",
            sections: [
              { heading: "How many?", words: 400 },
              { heading: "Why?", words: 400 },
            ],
          },
        ],
      ]),
      reply("Done for now."),
    ];
    const researcher = (n: number) => [
      reply(null, [[`f${n}`, "web_fetch", { url: `https://p${n}.example` }]]),
      reply(null, [
        [
          `n${n}`,
          "note_evidence",
          {
            url: `https://p${n}.example`,
            quote: "about housing starts in Toronto",
            claim: `Claim ${n}`,
            section: 99,
          },
        ],
      ]),
      reply(`Found section ${n}'s evidence.\nCould not find a 2026 figure.`),
    ];
    const scripts: Record<string, unknown[]> = { s1: researcher(1), s2: researcher(2) };
    const models: string[] = [];
    const env = {
      LOG_LEVEL: "error",
      AI: {
        run: async (model: string, _i: unknown, opts?: { headers?: Record<string, string> }) => {
          models.push(model);
          const aside = side(opts);
          if (aside) return aside;
          const session = opts?.headers?.["x-session-affinity"] ?? "";
          const who = /-s(\d)$/.exec(session)?.[1];
          return who ? scripts[`s${who}`]?.shift() : writer.shift();
        },
      },
    } as unknown as Env;
    const store = memoryDrafts();
    const notes = memoryNotes();
    const d = await store.create("research");
    await store.save(d.id, { meta: { ...d.meta, engine: "team:deepseek" } });
    const events: Array<{ type: string; text?: string }> = [];
    await runTurn({
      stream: null,
      env,
      store,
      sources: memorySources(),
      notes,
      draftId: d.id,
      text: "How many homes were started?",
      emit: (e) => events.push(e as never),
    });

    // The writer's calls went to V4 Pro, the researchers' to Flash: three
    // steps each, the perspectives call, and a second researcher for each
    // section (each stood on one source).
    expect(models.filter((m) => m === team.writer)).toHaveLength(2);
    expect(models.filter((m) => m === team.reader)).toHaveLength(9);
    // Each researcher's note is filed under its own section, whatever it said.
    const kept = await notes.list(d.id);
    expect(kept.map((n) => [n.section, n.claim]).sort()).toEqual([
      [1, "Claim 1"],
      [2, "Claim 2"],
    ]);
    // The writer was told what each found and could not find.
    const all = JSON.stringify(await store.messages(d.id));
    expect(all).toContain("The researchers have finished");
    expect(all).toContain("Could not find a 2026 figure");
    expect(all).toContain("1 independent source");
    expect(all).toContain("A second researcher looked for other sources and found no new one");
    expect(events.some((e) => e.text?.startsWith("§1 Read:"))).toBe(true);
    // Every call is counted: two at Pro's rates, six at Flash's.
    const saved = await store.get(d.id);
    const pro = engine(team.writer).price;
    const flash = engine(team.reader).price;
    const cents =
      ((2 * (1000 * pro.input + 100 * pro.output) + 9 * (1000 * flash.input + 100 * flash.output)) /
        1e6) *
      100;
    expect(saved?.usage.cents).toBeCloseTo(cents, 6);
  });

  it("gives each researcher its own searches, two at a time, and pushes it to note", async () => {
    // Every source the finder asks answers with nothing: searches are cheap here.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { headers: { "content-type": "application/json" } })),
    );
    const writer: unknown[] = [
      reply(null, [
        [
          "o1",
          "write_outline",
          {
            title: "Tetrad",
            topic: "Media",
            sections: [{ heading: "Who applied it?", words: 400 }],
          },
        ],
      ]),
      reply("Done for now."),
    ];
    // A researcher that only ever searches, three at a time.
    let k = 0;
    const searching = () =>
      reply(
        null,
        [0, 1, 2].map((): [string, string, unknown] => {
          k++;
          return [`q${k}`, "web_search", { query: `tetrad ${k}` }];
        }),
      );
    const seen: Array<{ tools: string[]; messages: Array<{ role: string; content: unknown }> }> =
      [];
    const env = {
      LOG_LEVEL: "error",
      AI: {
        run: async (
          _model: string,
          input: { tools?: Array<{ function: { name: string } }>; messages: never[] },
          opts?: { headers?: Record<string, string> },
        ) => {
          const aside = side(opts);
          if (aside) return aside;
          const session = opts?.headers?.["x-session-affinity"] ?? "";
          if (!/-s\d$/.test(session)) return writer.shift();
          seen.push({
            tools: (input.tools ?? []).map((t) => t.function.name),
            messages: input.messages,
          });
          return searching();
        },
      },
    } as unknown as Env;
    const store = memoryDrafts();
    const d = await store.create("research");
    await store.save(d.id, { meta: { ...d.meta, engine: "team:flash" } });
    await runTurn({
      stream: null,
      env,
      store,
      sources: memorySources(),
      notes: memoryNotes(),
      draftId: d.id,
      text: "Who applied the tetrad?",
      emit: () => {},
    });
    // The researcher's last call carries every result it was given.
    const last = seen.at(-1);
    const results = (last?.messages ?? [])
      .filter((m) => m.role === "tool")
      .map((m) => String(m.content));
    const ran = results.filter((r) => !/spent|At most 2 searches|No more searching/.test(r));
    expect(ran).toHaveLength(8);
    expect(results.some((r) => /At most 2 searches at a time/.test(r))).toBe(true);
    // Halfway with nothing noted, it was told to stop searching and note.
    expect(JSON.stringify(last?.messages)).toContain(
      "Half your steps are gone and nothing is noted",
    );
    // Once its searches are spent, it is offered reading and noting only.
    expect(seen[0]?.tools).toContain("web_search");
    expect(seen.at(-1)?.tools).not.toContain("web_search");
    expect(seen.at(-1)?.tools).toContain("note_evidence");
  });
});

describe("the reviewers", () => {
  it("read every section once it is written, keep only flags on real sentences, and show them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (url: string) =>
          new Response(`<p>${`Page ${url} about housing starts in Toronto. `.repeat(20)}</p>`, {
            headers: { "content-type": "text/html" },
          }),
      ),
    );
    const one = "Starts rose ten per cent in 2025 because of the rebate [1].";
    const writer: unknown[] = [
      reply(null, [
        [
          "o1",
          "write_outline",
          {
            title: "Starts",
            topic: "Housing",
            sections: [
              { heading: "How many?", words: 400 },
              { heading: "Why?", words: 400 },
            ],
          },
        ],
      ]),
      reply(null, [["w1", "write_section", { part: "1", text: `${one} More text here.` }]]),
      reply(null, [
        ["w2", "write_section", { part: "2", text: "The second section, written [2]." }],
      ]),
      reply("Fixing next."),
    ];
    const researcher = (n: number) => [
      reply(null, [[`f${n}`, "web_fetch", { url: `https://p${n}.example` }]]),
      reply(null, [
        [
          `n${n}`,
          "note_evidence",
          {
            url: `https://p${n}.example`,
            quote: "about housing starts in Toronto",
            claim: `C${n}`,
          },
        ],
      ]),
      reply("Done."),
    ];
    const scripts: Record<string, unknown[]> = {
      s1: researcher(1),
      s2: researcher(2),
      r1: [
        reply(null, [
          ["g1", "flag", { sentence: one, kind: "overstated", why: "The page shows no cause." }],
          [
            "g2",
            "flag",
            { sentence: "A sentence the section never had.", kind: "unsupported", why: "x" },
          ],
        ]),
        reply("One flag."),
      ],
      r2: [reply("Nothing wrong.")],
    };
    const env = {
      LOG_LEVEL: "error",
      AI: {
        run: async (_m: string, _i: unknown, opts?: { headers?: Record<string, string> }) => {
          const aside = side(opts);
          if (aside) return aside;
          const who = /-([sr]\d)$/.exec(opts?.headers?.["x-session-affinity"] ?? "")?.[1];
          return who ? scripts[who]?.shift() : writer.shift();
        },
      },
    } as unknown as Env;
    const store = memoryDrafts();
    const d = await store.create("research");
    await store.save(d.id, { meta: { ...d.meta, engine: "team:flash" } });
    await runTurn({
      stream: null,
      env,
      store,
      sources: memorySources(),
      notes: memoryNotes(),
      draftId: d.id,
      text: "How many homes were started?",
      emit: () => {},
    });
    const saved = await store.get(d.id);
    expect(saved?.meta.review).toEqual([
      { section: 1, kind: "overstated", sentence: one, why: "The page shows no cause." },
    ]);
    const all = JSON.stringify(await store.messages(d.id));
    expect(all).toContain("The reviewers flagged 1 point");
    expect(all).toContain("1 refused");
    // Chris sees the flag, and that the sentence has not changed yet.
    const { renderWorkspace } = await import("../src/site/pages/write");
    const html = renderWorkspace(saved as never, [], { total: 0, failed: [] }, { hasKey: true });
    expect(html).toContain("Reviewers: 1 flagged · 0 changed since");
    expect(html).toContain("Says more than its source");
    const fixed = renderWorkspace(
      { ...(saved as object), body: (saved?.body ?? "").replace(one, "Starts rose [1].") } as never,
      [],
      { total: 0, failed: [] },
      { hasKey: true },
    );
    expect(fixed).toContain("1 changed since");
  });
});

describe("a researcher Workers AI stops", () => {
  it("is tried once more, and the stop is said in the chat", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (url: string) =>
          new Response(`<p>${`Page ${url} about housing starts in Toronto. `.repeat(20)}</p>`, {
            headers: { "content-type": "text/html" },
          }),
      ),
    );
    const writer: unknown[] = [
      reply(null, [
        [
          "o1",
          "write_outline",
          { title: "S", topic: "Housing", sections: [{ heading: "How many?", words: 400 }] },
        ],
      ]),
      reply("Done."),
    ];
    let failed = false;
    const s1 = [
      reply(null, [["f1", "web_fetch", { url: "https://p1.example" }]]),
      reply(null, [
        [
          "n1",
          "note_evidence",
          { url: "https://p1.example", quote: "about housing starts in Toronto", claim: "C" },
        ],
      ]),
      reply("Done."),
    ];
    const env = {
      LOG_LEVEL: "error",
      AI: {
        run: async (_m: string, _i: unknown, opts?: { headers?: Record<string, string> }) => {
          const aside = side(opts);
          if (aside) return aside;
          if (!/-s1$/.test(opts?.headers?.["x-session-affinity"] ?? "")) return writer.shift();
          if (!failed) {
            failed = true;
            throw new Error("5000: internal error");
          }
          return s1.shift();
        },
      },
    } as unknown as Env;
    const store = memoryDrafts();
    const notes = memoryNotes();
    const d = await store.create("research");
    await store.save(d.id, { meta: { ...d.meta, engine: "team:flash" } });
    const events: Array<{ type: string; text?: string }> = [];
    await runTurn({
      stream: null,
      env,
      store,
      sources: memorySources(),
      notes,
      draftId: d.id,
      text: "How many?",
      emit: (e) => events.push(e as never),
    });
    expect(events.some((e) => /§1 stopped .*trying again/.test(e.text ?? ""))).toBe(true);
    expect((await notes.list(d.id)).map((n) => n.section)).toEqual([1]);
  });
});

describe("a team with two reader models", () => {
  it("gives its researchers each model in turn", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (url: string) =>
          new Response(`<p>${`Page ${url} about housing starts in Toronto. `.repeat(20)}</p>`, {
            headers: { "content-type": "text/html" },
          }),
      ),
    );
    const writer: unknown[] = [
      reply(null, [
        [
          "o1",
          "write_outline",
          {
            title: "S",
            topic: "Housing",
            sections: [
              { heading: "How many?", words: 400 },
              { heading: "Why?", words: 400 },
            ],
          },
        ],
      ]),
      reply("Done."),
    ];
    const byResearcher = new Map<string, string>();
    const env = {
      LOG_LEVEL: "error",
      AI: {
        run: async (model: string, _i: unknown, opts?: { headers?: Record<string, string> }) => {
          const aside = side(opts);
          if (aside) return aside;
          const who = /-(s\d)$/.exec(opts?.headers?.["x-session-affinity"] ?? "")?.[1];
          if (!who) return writer.shift();
          byResearcher.set(who, model);
          return reply("Nothing found.");
        },
      },
    } as unknown as Env;
    const store = memoryDrafts();
    const d = await store.create("research");
    await store.save(d.id, { meta: { ...d.meta, engine: "team:flash2" } });
    await runTurn({
      stream: null,
      env,
      store,
      sources: memorySources(),
      notes: memoryNotes(),
      draftId: d.id,
      text: "How many?",
      emit: () => {},
    });
    expect(byResearcher.get("s1")).toBe("@cf/deepseek-ai/deepseek-v4.1-flash-1017");
    expect(byResearcher.get("s2")).toBe("@cf/deepseek-ai/deepseek-v4-flash-0731");
  });

  it("pushes a researcher whose notes all come from one source to find others", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        /p1\.example/.test(url)
          ? new Response(`<p>${"Rents rose four per cent in Toronto last year. ".repeat(20)}</p>`, {
              headers: { "content-type": "text/html" },
            })
          : new Response("{}", { headers: { "content-type": "application/json" } }),
      ),
    );
    const writer: unknown[] = [
      reply(null, [
        [
          "o1",
          "write_outline",
          {
            title: "Rents",
            topic: "Housing",
            sections: [{ heading: "What happened?", words: 400 }],
          },
        ],
      ]),
      reply("Done."),
    ];
    let k = 0;
    const step = (i: number) =>
      i === 0
        ? reply(null, [["f1", "web_fetch", { url: "https://p1.example/a" }]])
        : i === 1
          ? reply(null, [
              [
                "n1",
                "note_evidence",
                {
                  url: "https://p1.example/a",
                  quote: "Rents rose four per cent in Toronto last year.",
                  claim: "Rents rose",
                },
              ],
            ])
          : reply(null, [[`q${i}`, "web_search", { query: `rents ${i}` }]]);
    const seen: Array<Array<{ role: string; content: unknown }>> = [];
    const env = {
      LOG_LEVEL: "error",
      AI: {
        run: async (
          _m: string,
          input: { messages: never[] },
          opts?: { headers?: Record<string, string> },
        ) => {
          const aside = side(opts);
          if (aside) return aside;
          if (!/-s\d$/.test(opts?.headers?.["x-session-affinity"] ?? "")) return writer.shift();
          seen.push(input.messages);
          return step(k++);
        },
      },
    } as unknown as Env;
    const store = memoryDrafts();
    const d = await store.create("research");
    await store.save(d.id, { meta: { ...d.meta, engine: "team:flash" } });
    await runTurn({
      stream: null,
      env,
      store,
      sources: memorySources(),
      notes: memoryNotes(),
      draftId: d.id,
      text: "What happened to rents?",
      emit: () => {},
    });
    const all = JSON.stringify(seen.at(-1));
    expect(all).toContain(
      "Your notes come from 1 source; this section needs at least 3 independent ones",
    );
  });
});

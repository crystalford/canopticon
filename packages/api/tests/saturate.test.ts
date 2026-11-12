// Phase 1 of the Record method: perspectives before the researchers go, a
// second round for sections standing on too few sources (Saturate), and an
// outline the evidence may revise once — never moving a section's notes.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";
import { outlineMoves, runTurn } from "../src/write/agent";
import { memoryDrafts } from "../src/write/drafts";
import { memoryNotes, skeleton } from "../src/write/notes";
import { memorySources } from "../src/write/research";
import {
  DEFAULT_PERSPECTIVES,
  defaultPerspectives,
  diversifyBrief,
  parsePerspectives,
  researcherBrief,
  teamReport,
} from "../src/write/team";

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

const VIEWS = [
  "PERSPECTIVES",
  "1. **Tenant unions** — rent burden on low-income households",
  "2. Landlords' associations — the cost of new supply",
  "3. Bank of Canada economists: interest rates",
  "SECTIONS",
  "1: 1, 3",
  "2: 2",
].join("\n");

describe("perspectives", () => {
  const sections = [
    { n: 1, heading: "What happened?" },
    { n: 2, heading: "Who paid?" },
  ];
  it("reads the named stakeholders and which sections each bears on", () => {
    const v = parsePerspectives(VIEWS, sections);
    expect(v?.all.map((x) => x.name)).toEqual([
      "Tenant unions",
      "Landlords' associations",
      "Bank of Canada economists",
    ]);
    expect(v?.all[2]?.stress).toBe("interest rates");
    expect(v?.bySection.get(1)).toEqual([0, 2]);
    const brief = researcherBrief(
      "Why did rents rise?",
      sections,
      sections[0] as never,
      v as never,
    );
    expect(brief).toContain("Who sees this differently");
    expect(brief).toContain("- Tenant unions: rent burden");
    expect(brief).toContain("- Bank of Canada economists: interest rates");
    expect(brief).not.toContain("Landlords");
  });
  it("gives a section no one assigned every perspective, and falls back when the reply is thin", () => {
    const v = parsePerspectives(VIEWS.replace("2: 2", "2: 9"), sections);
    expect(v?.bySection.get(2)).toEqual([0, 1, 2]);
    expect(parsePerspectives("PERSPECTIVES\n1. Only one — x", sections)).toBeNull();
    expect(parsePerspectives("I cannot help with that.", sections)).toBeNull();
    const d = defaultPerspectives(sections);
    expect(d.all).toBe(DEFAULT_PERSPECTIVES);
    expect(d.bySection.get(2)).toHaveLength(DEFAULT_PERSPECTIVES.length);
  });
  it("tells a second researcher what the section already stands on", () => {
    const b = diversifyBrief("Q?", sections, sections[0] as never, {
      notes: 3,
      sites: ["cmhc-schl.gc.ca"],
    });
    expect(b).toContain("noted 3 passages for this section, from cmhc-schl.gc.ca");
    expect(b).toContain("More notes from those sites add nothing");
    expect(b).toContain("say so in your two lines");
  });
});

describe("the writer's report", () => {
  it("says what the second round added, or that it found nothing new", () => {
    const base = { heading: "H", notes: 4, pages: 3, said: "" };
    const r = teamReport([
      { ...base, n: 1, sites: 3, widened: { notes: 2, sites: 2, said: "" } },
      { ...base, n: 2, sites: 1, widened: { notes: 0, sites: 0, said: "Nothing else online." } },
    ]);
    expect(r).toContain("§1 H: 4 notes from 3 pages, 3 independent sources.");
    expect(r).toContain("+2 notes, +2 new sources");
    expect(r).toContain(
      "found no new one (Nothing else online.) — the section stands on what it has",
    );
    expect(r).not.toContain("revise it once");
    expect(teamReport([{ ...base, n: 1 }], { revise: true })).toContain(
      "revise it once with write_outline",
    );
  });
});

describe("a revised outline", () => {
  const before = skeleton([
    { heading: "What happened?", words: 400 },
    { heading: "Who paid?", words: 400 },
  ]);
  const notes = [{ section: 1 }, { section: 1 }, { section: 2 }];
  it("may rename a section in place and add sections after the last", () => {
    expect(
      outlineMoves(
        before,
        [
          { heading: "What happened to rents?", words: 400 },
          { heading: "Who paid?", words: 400 },
          { heading: "What did other provinces do?", words: 400 },
        ],
        notes,
      ),
    ).toBeNull();
    expect(outlineMoves(before, [{ heading: "Anything", words: 400 }], [])).toBeNull();
  });
  it("may not move or drop a section that has notes", () => {
    expect(
      outlineMoves(
        before,
        [
          { heading: "Who paid?", words: 400 },
          { heading: "What happened?", words: 400 },
        ],
        notes,
      ),
    ).toContain('section 1 ("What happened?") has 2 notes');
    expect(outlineMoves(before, [{ heading: "What happened?", words: 400 }], notes)).toContain(
      "section 2",
    );
  });
});

describe("a team that saturates", () => {
  it("assigns perspectives, widens a narrow section, and researches a revision once", async () => {
    const page = (n: number) =>
      `<p>${`Source ${n}: rents rose four per cent in Toronto last year. `.repeat(20)}</p>`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const n = /p(\d)\.example/.exec(url)?.[1];
        return n
          ? new Response(page(Number(n)), { headers: { "content-type": "text/html" } })
          : new Response("{}", { headers: { "content-type": "application/json" } });
      }),
    );
    const outline = (sections: string[]) =>
      reply(null, [
        [
          `o${sections.length}${sections[0]?.length}`,
          "write_outline",
          {
            title: "Rents",
            topic: "Housing",
            sections: sections.map((heading) => ({ heading, words: 400 })),
          },
        ],
      ]);
    const writer: unknown[] = [
      outline(["What happened?"]),
      outline(["What happened?", "Who paid?"]),
      outline(["Who paid?", "What happened?"]),
      outline(["What happened?", "Who paid?", "Where next?"]),
      reply("Done."),
    ];
    const reads = (k: number, n: number, said: string) => [
      reply(null, [[`f${k}`, "web_fetch", { url: `https://p${n}.example/a` }]]),
      reply(null, [
        [
          `n${k}`,
          "note_evidence",
          {
            url: `https://p${n}.example/a`,
            quote: `Source ${n}: rents rose four per cent in Toronto last year.`,
            claim: `Claim ${n}`,
          },
        ],
      ]),
      reply(said),
    ];
    const scripts: Record<string, unknown[]> = {
      s1: reads(1, 1, "Found one agency."),
      d1: reads(2, 2, "Found a study."),
      s2: reads(3, 3, "Found one source."),
      d2: [reply("Found no other source.")],
    };
    const briefs = new Map<string, string>();
    let views = 0;
    const env = {
      LOG_LEVEL: "error",
      AI: {
        run: async (
          _m: string,
          input: { messages: Array<{ role: string; content: string }> },
          opts?: { headers?: Record<string, string> },
        ) => {
          const session = opts?.headers?.["x-session-affinity"] ?? "";
          if (/-views$/.test(session)) {
            views++;
            return reply(VIEWS);
          }
          const who = /-([sd]\d)$/.exec(session)?.[1];
          if (!who) return writer.shift();
          if (!briefs.has(who))
            briefs.set(who, String(input.messages.find((m) => m.role === "user")?.content));
          return scripts[who]?.shift() ?? reply("Nothing more.");
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
      text: "Why did rents rise?",
      emit: (e) => events.push(e as never),
    });

    // One perspectives call per dispatch; each researcher hears its own.
    expect(views).toBe(2);
    expect(briefs.get("s1")).toContain("- Tenant unions");
    expect(briefs.get("s1")).not.toContain("Landlords");
    expect(briefs.get("s2")).toContain("- Landlords' associations");
    expect(events.some((e) => e.text?.startsWith("Perspectives: Tenant unions"))).toBe(true);
    // §1 stood on one site: a second researcher was told so and found another.
    expect(briefs.get("d1")).toContain("from p1.example");
    const kept = await notes.list(d.id);
    expect(kept.map((n) => [n.section, n.claim])).toEqual([
      [1, "Claim 1"],
      [1, "Claim 2"],
      [2, "Claim 3"],
    ]);
    const all = JSON.stringify(await store.messages(d.id));
    expect(all).toContain("+1 note, +1 new source");
    // The first report invites one revision; the revision's report does not.
    expect(all.split("revise it once with write_outline")).toHaveLength(2);
    // The revision sent researchers to the new section only (no s1 twice),
    // and §2's second researcher found nothing new: said so.
    expect(all).toContain("found no new one");
    // Moving a section with notes is refused; a third dispatch is refused.
    expect(all).toContain('Not revised: section 1 (\\"What happened?\\") has 2 notes');
    expect(all).toContain("No more researchers in this message");
  });
});

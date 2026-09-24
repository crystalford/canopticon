// THE REVIEW — a finished research run, read and published on the workspace.
//
// The loop is document → lead → research → brief → publish → child of the
// document, and this is the step that closes it on one screen: the status
// JSON carries the finished brief, the panel shows what survived and what
// was killed, and Publish is one press that keeps the lineage.

import { describe, expect, it, vi } from "vitest";

vi.mock("../src/graph/lib/record-builder", () => ({
  expandRecord: async () => ({ banked_source_ids: [] }),
  getExpandStatus: async () => ({ terminal: true, warn: false, line: "banked" }),
}));
vi.mock("../src/llm/router", () => ({
  callResearchWriter: async () => ({ text: "" }),
  callRole: async () => ({ text: "" }),
  modelForRole: () => ({ model: "test-model" }),
  resolveWriter: () => ({ provider: "claude_gateway", model: "claude-test" }),
}));

import {
  type ResearchReview,
  type ResearchStatus,
  getResearchStatus,
  splitGaps,
} from "../src/graph/lib/deep-research";
import app from "../src/index.ts";
import { RESEARCH_LIVE_JS } from "../src/public/render/research-live";
import {
  renderAction,
  renderResearchWorkspace,
  renderReview,
} from "../src/public/render/research-workspace";

const SECTIONS = [
  { heading: "Where the money moved", body_md: "Section one.", quotes_ok: 3, quotes_killed: 0 },
  {
    heading: "How the starts are counted",
    body_md: "Section two.",
    quotes_ok: 1,
    quotes_killed: 1,
  },
  { heading: "Reconciling the two", body_md: "Section three.", quotes_ok: 2, quotes_killed: 0 },
];

const BRIEF = {
  id: "brief-1",
  slug: "reprofiling-and-the-gap",
  title: "Reprofiling and the gap",
  body_md:
    "Summary.\n\n## Where the money moved\n\nSection one.\n\n## What this brief could not establish\n\n- The size of the lag.",
  publication_status: "working-material",
  parent_piece_id: "doc-1",
  origin: "Does reprofiling explain the gap?",
  metadata: JSON.stringify({ mode: "sectioned", sections: 3, quotes_ok: 6, quotes_killed: 1 }),
};

const RUN = {
  id: "run-1",
  status: "done",
  final_piece_id: "brief-1",
  error: null,
  followup_queries: "[]",
  followups_done: "[]",
  created_at: new Date().toISOString(),
  writer: "anthropic",
  mode: "sectioned",
  outline: JSON.stringify(SECTIONS.map((s) => ({ heading: s.heading, source_ids: [] }))),
  sections_done: JSON.stringify(SECTIONS),
};

/** A D1 that answers the review's queries and records every write. */
function makeDb(over: { piece?: Partial<typeof BRIEF> } = {}) {
  const piece = { ...BRIEF, ...(over.piece ?? {}) };
  const writes: Array<{ sql: string; args: unknown[] }> = [];
  const db = {
    writes,
    prepare(sql: string) {
      const stmt = {
        args: [] as unknown[],
        bind(...a: unknown[]) {
          stmt.args = a;
          return stmt;
        },
        async first() {
          if (/FROM users/i.test(sql)) return { id: "u1" };
          if (/FROM research_runs/i.test(sql)) return RUN;
          if (/FROM pieces WHERE id = \?/i.test(sql)) {
            if (stmt.args[0] === "brief-1") return piece;
            if (stmt.args[0] === "doc-1")
              return { id: "doc-1", slug: "budget-2026", title: "Budget 2026" };
            return null;
          }
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          writes.push({ sql, args: stmt.args });
          return { results: [], meta: { changes: 1 } };
        },
      };
      return stmt;
    },
    async batch() {
      return [];
    },
    async exec() {
      return { count: 0, duration: 0 };
    },
  };
  return db;
}

const env = (db: ReturnType<typeof makeDb>) =>
  ({ DB: db, AI_GATEWAY_ID: "gw", LOG_LEVEL: "info" }) as never;

const review = (over: Partial<ResearchReview> = {}): ResearchReview => ({
  pieceId: "brief-1",
  slug: BRIEF.slug,
  title: BRIEF.title,
  question: BRIEF.origin,
  parent: { id: "doc-1", slug: "budget-2026", title: "Budget 2026" },
  mode: "sectioned",
  sections: SECTIONS.map((s) => ({
    heading: s.heading,
    bodyMd: s.body_md,
    quotesOk: s.quotes_ok,
    quotesKilled: s.quotes_killed,
  })),
  bodyMd: "Summary.\n\n## Where the money moved\n\nSection one.",
  gapsMd: "- The size of the lag.",
  quotesOk: 6,
  quotesKilled: 1,
  writer: "claude-test",
  published: false,
  url: null,
  publishUrl: "/op/library/research/brief-1/publish",
  downloadUrl: "/op/library/research/brief-1/brief.md",
  ...over,
});

describe("the status JSON of a done run", () => {
  it("carries the review: brief, parent, question, sections, counts, actions", async () => {
    const s = await getResearchStatus(env(makeDb()), "u1", BRIEF.origin);
    expect(s?.terminal).toBe(true);
    const r = s?.review as ResearchReview;
    expect(r).toBeTruthy();
    expect(r.title).toBe(BRIEF.title);
    expect(r.parent).toEqual({ id: "doc-1", slug: "budget-2026", title: "Budget 2026" });
    expect(r.question).toBe(BRIEF.origin);
    expect(r.sections.map((x) => x.heading)).toEqual(SECTIONS.map((x) => x.heading));
    expect(r.quotesOk).toBe(6);
    expect(r.quotesKilled).toBe(1);
    expect(r.gapsMd).toContain("The size of the lag");
    expect(r.bodyMd).not.toContain("could not establish");
    expect(r.published).toBe(false);
    expect(r.publishUrl).toBe("/op/library/research/brief-1/publish");
    expect(r.downloadUrl).toBe("/op/library/research/brief-1/brief.md");
    expect(r.writer).toBe("claude-test");
  });

  it("says so once the brief is published, with its public URL", async () => {
    const db = makeDb({ piece: { publication_status: "published" } });
    const s = await getResearchStatus(env(db), "u1", BRIEF.origin);
    expect(s?.review?.published).toBe(true);
    expect(s?.review?.url).toBe(`/p/${BRIEF.slug}`);
    expect(s?.headline).toContain("Published");
  });

  it("keeps a single-mode run working: no sections, the whole body", async () => {
    const db = makeDb({ piece: { metadata: "{}" } });
    const single = { ...RUN, mode: "single", outline: null, sections_done: null };
    db.prepare = ((orig) =>
      function (this: unknown, sql: string) {
        const stmt = orig.call(db, sql);
        if (/FROM research_runs/i.test(sql)) stmt.first = async () => single;
        return stmt;
      })(db.prepare);
    const s = await getResearchStatus(env(db), "u1", BRIEF.origin);
    expect(s?.review?.mode).toBe("single");
    expect(s?.review?.sections).toEqual([]);
    expect(s?.review?.bodyMd).toContain("Summary.");
    expect(s?.review?.quotesOk).toBe(0);
  });

  it("splits the gaps block off the body and leaves a body without one alone", () => {
    expect(splitGaps("Body.\n\n## What this brief could not establish\n\n- A gap.")).toEqual({
      bodyMd: "Body.",
      gapsMd: "- A gap.",
    });
    expect(splitGaps("Body only.")).toEqual({ bodyMd: "Body only.", gapsMd: null });
  });
});

describe("the review panel", () => {
  it("renders every section with its counts, the killed count in red, the total, the lineage", () => {
    const html = renderReview(review());
    for (const s of SECTIONS) expect(html).toContain(s.heading);
    expect(html).toContain('<span class="lead-ans-disc">1 killed</span>');
    expect(html).toContain("6 quotes verified");
    expect(html).toContain('href="/p/budget-2026"');
    expect(html).toContain("Budget 2026");
    expect(html).toContain(BRIEF.origin);
    expect(html).toContain("<h3>Where the money moved</h3>");
    expect(html).toContain("The size of the lag");
    expect(html).toContain('action="/op/library/research/brief-1/publish"');
    expect(html).toContain("Publish to the record");
    expect(html).toContain('href="/op/library/research/brief-1/brief.md"');
    expect(html).toContain("Download .md");
    expect(html).not.toContain("More quotes failed verification");
  });

  it("warns in red — and only warns — when more quotes were killed than survived", () => {
    const html = renderReview(review({ quotesOk: 1, quotesKilled: 3 }));
    expect(html).toContain(
      '<p class="lead-ans-disc rw-review-warn">More quotes failed verification than survived — read before publishing.</p>',
    );
    // Advisory, never blocking: the publish button is still there (rule 2).
    expect(html).toContain("Publish to the record");
  });

  it("shows the published state with the link and no publish button", () => {
    const html = renderReview(review({ published: true, url: "/p/reprofiling-and-the-gap" }));
    expect(html).toContain('href="/p/reprofiling-and-the-gap"');
    expect(html).not.toContain("Publish to the record");
    expect(html).not.toContain("<form");
    expect(html).toContain("Download .md");
  });

  it("renders the whole for a single-mode brief, with no section list", () => {
    const html = renderReview(review({ mode: "single", sections: [] }));
    expect(html).not.toContain("rw-review-sections");
    expect(html).toContain("Written in one call");
    expect(html).toContain("<h3>Where the money moved</h3>");
  });

  it("is on the workspace, complete, with no script of its own", () => {
    const status: ResearchStatus = {
      terminal: true,
      warn: false,
      headline: "Draft brief ready",
      steps: [],
      review: review(),
    };
    const page = renderResearchWorkspace({ label: "Q", status, pollUrl: "/x" });
    expect(page).toContain('id="review"');
    expect(page).toContain("Publish to the record");
    expect(
      page.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, ""),
    ).not.toMatch(/<script/);
    expect(renderAction(status)).toContain('href="#review"');
    expect(renderAction({ ...status, review: review({ published: true, url: "/p/x" }) })).toContain(
      'href="/p/x"',
    );
  });

  it("escapes the brief's own text", () => {
    const html = renderReview(review({ title: "<b>x</b>", question: "<i>q</i>" }));
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<i>q</i>");
  });

  it("the live layer reloads once when a watched run finishes, and never composes the panel itself", () => {
    expect(RESEARCH_LIVE_JS).toContain(
      'if (s.review && !at("review")) { location.reload(); return; }',
    );
    expect(RESEARCH_LIVE_JS).not.toContain("Publish to the record");
  });
});

describe("publishing a brief", () => {
  it("flips the status, keeps parent_piece_id, and lands on the public page", async () => {
    const db = makeDb();
    const res = await app.fetch(
      new Request("http://test/op/library/research/brief-1/publish", { method: "POST" }),
      env(db),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`/p/${BRIEF.slug}`);
    const update = db.writes.find((w) => /UPDATE pieces/i.test(w.sql));
    expect(update).toBeTruthy();
    expect(update?.sql).toContain("publication_status = 'published'");
    expect(update?.sql).toContain("published_at = ?");
    // The lineage is never touched: the brief stays the document's child.
    expect(update?.sql).not.toMatch(/parent_piece_id|origin/);
    expect(update?.args).toContain("brief-1");
  });

  it("downloads the brief as a labelled .md — model, question and parent on the first line", async () => {
    const res = await app.fetch(
      new Request("http://test/op/library/research/brief-1/brief.md"),
      env(makeDb()),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain(`brief-${BRIEF.slug}.md`);
    const text = await res.text();
    const first = text.split("\n")[0] as string;
    expect(first).toContain("WRITTEN BY claude-test");
    expect(first).toContain(`from the question "${BRIEF.origin}"`);
    expect(first).toContain('the document "Budget 2026"');
    expect(first).toContain("Not published.");
    expect(first).toContain("the byline will be yours");
    expect(text).toContain(`# ${BRIEF.title}`);
  });
});

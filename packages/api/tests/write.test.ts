// The workspace — what it must always do, with a fake Claude in place of the
// real one: read before it writes, save every step, check every quotation
// word for word and hand the failures back, never quote what it may not
// read, and stay behind sign-in.

import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { verbatimNormal as buildNormal, parseFrontMatter } from "../scripts/build-content.mjs";
import type { Env } from "../src/env";
import app from "../src/index";
import { heldResearch, publicResearch } from "../src/site/content/store";
import { renderArticle } from "../src/site/pages/article";
import {
  type StreamFn,
  type WriteEvent,
  runTurn,
  systemPrompt,
  transcript,
} from "../src/write/agent";
import { draftArticle, draftMarkdown, slugify } from "../src/write/article";
import { checkQuotes, verbatimNormal } from "../src/write/check";
import { memoryDrafts } from "../src/write/drafts";
import { sourceText } from "../src/write/sources";

function stubDb(): D1Database {
  const stmt = {
    bind: () => stmt,
    first: async () => null,
    all: async () => ({ results: [] }),
    run: async () => ({ results: [], meta: { changes: 0 } }),
  };
  return {
    prepare: () => stmt,
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}

const env = { LOG_LEVEL: "error", DB: stubDb() } as unknown as Env;
const DOC = publicResearch().find((d) => d.body.length > 2000);
if (!DOC) throw new Error("the store has no public research");
const PASSAGE = DOC.body.slice(600, 680);
const ARTICLES = (await import("node:fs"))
  .readdirSync("content/articles")
  .map((f) => f.replace(/\.md$/, ""));

type Block = Anthropic.Beta.BetaContentBlock;
const msg = (content: unknown[], stop: string): Anthropic.Beta.BetaMessage =>
  ({
    id: "m",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: content as Block[],
    stop_reason: stop,
    usage: {
      input_tokens: 1000,
      output_tokens: 500,
      cache_read_input_tokens: 2000,
      cache_creation_input_tokens: 0,
    },
  }) as unknown as Anthropic.Beta.BetaMessage;

/** A fake model: answers each call with the next scripted message. */
function fakeStream(script: Anthropic.Beta.BetaMessage[]) {
  const calls: unknown[] = [];
  const stream: StreamFn = (params) => {
    calls.push(structuredClone(params));
    const m = script.shift() ?? msg([{ type: "text", text: "(out of script)" }], "end_turn");
    const handlers: Record<string, Array<(x: unknown) => void>> = {};
    return {
      on(event: string, cb: (x: never) => void) {
        const list = handlers[event] ?? [];
        list.push(cb as (x: unknown) => void);
        handlers[event] = list;
        return this;
      },
      async finalMessage() {
        for (const b of m.content) {
          if (b.type === "text") for (const h of handlers.text ?? []) h(b.text);
          if (b.type === "tool_use")
            for (const h of handlers.streamEvent ?? [])
              h({ type: "content_block_start", index: 0, content_block: b });
        }
        return m;
      },
    } as unknown as ReturnType<StreamFn>;
  };
  return { stream, calls };
}

describe("the verbatim check", () => {
  it("is the build's rule exactly", () => {
    for (const s of ["a **b** `c`", "“curly”", "  spaced  "])
      expect(verbatimNormal(s)).toBe(buildNormal(s));
  });

  it("passes a quote found word for word, ignoring only emphasis", () => {
    const texts = new Map([["d", "The cat sat on the **mat**."]]);
    expect(checkQuotes('<q doc="d" section="s">sat on the mat</q>', texts).failed).toEqual([]);
  });

  it("fails curly quotes the source writes straight, and unknown documents", () => {
    const texts = new Map<string, string | null>([
      ["d", 'He said "no".'],
      ["x", null],
    ]);
    const r = checkQuotes(
      '<q doc="d" section="s">said “no”</q> <q doc="x" section="s">anything</q>',
      texts,
    );
    expect(r.failed.map((f) => f.reason)).toEqual(["not-verbatim", "no-document"]);
  });

  it("checks pull quotes too", () => {
    const texts = new Map([["d", "Exactly this."]]);
    const body = '<figure data-kind="pull" doc="d" section="s">\n“Not this.”\n</figure>';
    expect(checkQuotes(body, texts).failed).toHaveLength(1);
  });
});

describe("what Claude may read", () => {
  it("reads public research, never a held document", async () => {
    expect(await sourceText(env, DOC.id)).toBe(DOC.body);
    for (const h of heldResearch()) expect(await sourceText(env, h.id)).toBeNull();
  });

  it("is told the essay contract, whole", () => {
    expect(systemPrompt()).toContain("The Essay Contract");
    expect(systemPrompt()).toContain("Never write it yourself");
  });
});

describe("a turn", () => {
  it("reads, writes, checks, saves every step, and hands failures back", async () => {
    const store = memoryDrafts();
    const d = await store.create();
    const body = `## A heading that says something\n\nThe research says <q doc="${DOC.id}" section="Summary">${PASSAGE}</q> and also <q doc="${DOC.id}" section="Summary">words the document never wrote</q>.`;
    const { stream, calls } = fakeStream([
      msg(
        [{ type: "tool_use", id: "t1", name: "read_document", input: { id: DOC.id } }],
        "tool_use",
      ),
      msg(
        [
          { type: "text", text: "Writing it now." },
          {
            type: "tool_use",
            id: "t2",
            name: "write_draft",
            input: {
              title: "A title",
              dek: "A dek.",
              topic: "Housing",
              thesis: "One idea.",
              based_on: [DOC.id],
              body,
            },
          },
        ],
        "tool_use",
      ),
      msg(
        [{ type: "text", text: "Done. One quote failed and I need your reason for asking." }],
        "end_turn",
      ),
    ]);
    const events: WriteEvent[] = [];
    await runTurn({
      stream,
      env,
      store,
      draftId: d.id,
      text: "Write about this.",
      emit: (e) => events.push(e),
    });

    const saved = await store.get(d.id);
    expect(saved?.body).toBe(body);
    expect(saved?.meta.title).toBe("A title");
    expect(saved?.meta.why).toBeUndefined();
    expect(saved?.usage.cents).toBeGreaterThan(0);

    const history = await store.messages(d.id);
    expect(history.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
      "user",
      "assistant",
    ]);
    const writeResult = JSON.stringify(history[4]);
    expect(writeResult).toContain("1 FAILED");
    expect(writeResult).toContain("words the document never wrote");

    const draft = events.find((e) => e.type === "draft");
    expect(draft?.type === "draft" && draft.check.failed.length).toBe(1);
    expect(events.some((e) => e.type === "text" && e.text === "Writing it now.")).toBe(true);
    expect(events.at(-1)?.type).toBe("done");

    const first = calls[0] as Record<string, unknown>;
    expect(first.model).toBe("claude-opus-5-5");
    expect(first.fallbacks).toBe("default");
    expect(first.cache_control).toEqual({ type: "ephemeral" });
    expect((first.tools as Array<{ name: string }>).map((t) => t.name)).toEqual([
      "list_documents",
      "search_documents",
      "read_document",
      "write_draft",
      "edit_draft",
      "propose_entry",
    ]);

    expect(transcript(history).map((i) => i.who)).toEqual([
      "you",
      "activity",
      "claude",
      "activity",
      "claude",
    ]);
  });

  it("refuses to read a document it may not quote", async () => {
    const store = memoryDrafts();
    const d = await store.create();
    const held = heldResearch()[0];
    if (!held) return;
    const { stream } = fakeStream([
      msg(
        [{ type: "tool_use", id: "t1", name: "read_document", input: { id: held.id } }],
        "tool_use",
      ),
      msg([{ type: "text", text: "ok" }], "end_turn"),
    ]);
    await runTurn({ stream, env, store, draftId: d.id, text: "Read it.", emit: () => {} });
    const result = JSON.stringify((await store.messages(d.id))[2]);
    expect(result).toContain("not a document you can read");
    expect(result).not.toContain(held.body.slice(0, 60));
  });

  it("edits one exact passage, and only when it is unique", async () => {
    const store = memoryDrafts();
    const d = await store.create();
    await store.save(d.id, { body: "One. Two. Two." });
    const { stream } = fakeStream([
      msg(
        [{ type: "tool_use", id: "a", name: "edit_draft", input: { find: "Two.", replace: "x" } }],
        "tool_use",
      ),
      msg(
        [
          {
            type: "tool_use",
            id: "b",
            name: "edit_draft",
            input: { find: "One.", replace: "Uno." },
          },
        ],
        "tool_use",
      ),
      msg([{ type: "text", text: "ok" }], "end_turn"),
    ]);
    await runTurn({ stream, env, store, draftId: d.id, text: "Change it.", emit: () => {} });
    expect((await store.get(d.id))?.body).toBe("Uno. Two. Two.");
    expect(JSON.stringify((await store.messages(d.id))[2])).toContain("occurs 2 times");
  });

  it("answers the calls of a turn that was cut off, so the next one is valid", async () => {
    const store = memoryDrafts();
    const d = await store.create();
    await store.append(d.id, [
      { role: "user", content: [{ type: "text", text: "Start." }] },
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "cut", name: "list_documents", input: {} }],
      },
    ]);
    const { stream, calls } = fakeStream([msg([{ type: "text", text: "ok" }], "end_turn")]);
    await runTurn({ stream, env, store, draftId: d.id, text: "Go on.", emit: () => {} });
    const sent = (calls[0] as { messages: Array<{ role: string; content: unknown }> }).messages;
    expect(sent.map((m) => m.role)).toEqual(["user", "assistant", "user", "user"]);
    expect(JSON.stringify(sent[2])).toContain('"tool_use_id":"cut"');
  });
});

describe("the preview is the page", () => {
  it("marks a failing quotation red and nothing else", () => {
    const d = {
      id: "x",
      kind: "article" as const,
      meta: { title: "T", topic: "Housing" },
      body: '## H\n\nA <q doc="a" section="s">good</q> and a <q doc="a" section="s">bad</q>.',
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cents: 0 },
      status: "draft" as const,
      createdAt: "",
      updatedAt: "",
    };
    const html = renderArticle(draftArticle(d, new Map()), {
      noindex: true,
      docTitle: () => "A document",
      quoteOk: (_doc, text) => text !== "bad",
    });
    expect((html.match(/class="q bad"/g) ?? []).length).toBe(1);
    expect(html).toContain('<meta name="robots" content="noindex');
  });

  it("downloads as a file the content store reads back", () => {
    const d = {
      id: "x",
      kind: "article" as const,
      meta: {
        title: "Rent bans: what happened",
        dek: "D.",
        topic: "Housing",
        thesis: "T.",
        based_on: [DOC.id],
      },
      body: "## H\n\nBody.",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cents: 0 },
      status: "draft" as const,
      createdAt: "",
      updatedAt: "",
    };
    const { meta, body } = parseFrontMatter(draftMarkdown(d, new Map([[DOC.id, "Its title"]])));
    expect(meta.slug).toBe(slugify("Rent bans: what happened"));
    expect(meta.based_on).toEqual([{ id: DOC.id, label: "Its title" }]);
    expect(body.trim()).toBe("## H\n\nBody.");
  });
});

describe("the workspace is for the author only", () => {
  it("asks a reader to sign in", async () => {
    const res = await app.fetch(new Request("http://test/admin/write"), env);
    expect(res.status).toBe(401);
  });

  it("says plainly when Claude is not connected", async () => {
    const res = await app.fetch(
      new Request("http://test/op/write/x/turn", {
        method: "POST",
        headers: {
          accept: "text/event-stream",
          origin: "http://test",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: "text=hello",
      }),
      env,
    );
    const text = await res.text();
    expect(text).toContain('"type":"error"');
  });
});

// ---- publishing ------------------------------------------------------------------

import { setPublishedArticles } from "../src/site/content/store";
import { citedBy } from "../src/site/data";
import { articleTopics, liveArticles, publishDraft, publishProblems } from "../src/write/publish";

/** Enough of D1 for publishing: versions kept in memory, no other drafts. */
function versionDb() {
  const versions: Array<{ slug: string; version: number }> = [];
  const db = {
    prepare(sql: string) {
      let args: unknown[] = [];
      const stmt = {
        bind(...a: unknown[]) {
          args = a;
          return stmt;
        },
        async first() {
          if (/MAX\(version\)/.test(sql)) {
            const n = versions.filter((v) => v.slug === args[0]).map((v) => v.version);
            return { n: n.length ? Math.max(...n) : null };
          }
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          if (/INSERT INTO published_versions/.test(sql))
            versions.push({ slug: String(args[0]), version: Number(args[1]) });
          return { results: [], meta: { changes: 1 } };
        },
      };
      return stmt;
    },
  } as unknown as D1Database;
  return { db, versions };
}

const goodDraft = () => ({
  id: "d1",
  kind: "article" as const,
  meta: {
    title: "A good article",
    dek: "D.",
    topic: articleTopics()[0] ?? "Housing",
    thesis: "T.",
    based_on: [DOC.id],
  },
  body: `## H\n\nIt says <q doc="${DOC.id}" section="S">${PASSAGE}</q>.`,
  usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cents: 0 },
  status: "draft" as const,
  createdAt: "",
  updatedAt: "",
});

describe("publishing from the workspace", () => {
  it("publishes a draft whose every quote is word for word, from public documents", async () => {
    expect(await publishProblems(env, "u1", goodDraft())).toEqual([]);
  });

  it("refuses a failing quote, an unknown topic, a draft that quotes nothing, and a document not yet public", async () => {
    const d = goodDraft();
    const bad = await publishProblems(env, "u1", {
      ...d,
      meta: { ...d.meta, topic: "Not a topic", based_on: ["an-upload-still-waiting"] },
      body: `<q doc="${DOC.id}" section="S">not in the document at all</q>`,
    });
    expect(bad.join(" ")).toMatch(/topic/);
    expect(bad.join(" ")).toMatch(/1 quotation is not word for word/);
    expect(bad.join(" ")).toMatch(/not yet public/);
    expect(
      (await publishProblems(env, "u1", { ...d, body: "## H\n\nNo quotes." })).join(" "),
    ).toMatch(/quotes nothing/);
  });

  it("publishes a new version each time, at one address that is kept", async () => {
    const { db, versions } = versionDb();
    const e = { ...env, DB: db } as Env;
    const store = memoryDrafts();
    const d = await store.create();
    const g = goodDraft();
    await store.save(d.id, { meta: g.meta, body: g.body });
    const first = await publishDraft(e, "u1", store, d.id);
    expect(first).toMatchObject({ ok: true, slug: "a-good-article", version: 1 });
    expect((await store.get(d.id))?.status).toBe("published");
    await store.save(d.id, { meta: { ...g.meta, title: "A retitled article" } });
    const second = await publishDraft(e, "u1", store, d.id);
    expect(second).toMatchObject({ ok: true, slug: "a-good-article", version: 2 });
    expect(versions).toHaveLength(2);
  });

  it("reads nothing live when the versions table is not there yet", async () => {
    expect(await liveArticles(env, "u1")).toEqual([]);
  });
});

describe("a published article is on every surface", () => {
  it("has its page, its Library row, its feed entry, its sitemap line and its receipts' cited-by", async () => {
    const a = {
      ...draftArticle(goodDraft(), new Map()),
      slug: "a-workspace-article",
      title: "A workspace article",
      date: "2026-10-14",
    };
    setPublishedArticles([
      {
        article: a,
        row: {
          route: "/articles/a-workspace-article",
          kind: "Article",
          topic: a.topic,
          date: a.date,
          title: a.title,
          dek: a.dek,
          stat: "1 quotes · 1 source · 1 min",
        },
      },
    ]);
    try {
      const get = async (p: string) =>
        (await app.fetch(new Request(`http://test${p}`), env)).text();
      expect(await get("/articles/a-workspace-article")).toContain("A workspace article");
      expect(await get("/library?kind=Article")).toContain("/articles/a-workspace-article");
      expect(await get("/feed.xml")).toContain("a-workspace-article");
      expect(await get("/sitemap.xml")).toContain("/articles/a-workspace-article");
      expect(citedBy(DOC.id).some((c) => c.route === "/articles/a-workspace-article")).toBe(true);
    } finally {
      setPublishedArticles([]);
    }
  });

  it("never shadows an article the store holds", async () => {
    const stored = ARTICLES[0] as string;
    setPublishedArticles([
      {
        article: { ...draftArticle(goodDraft(), new Map()), slug: stored, title: "An impostor" },
        row: {
          route: `/articles/${stored}`,
          kind: "Article",
          topic: "Housing",
          date: "2026-10-14",
          title: "An impostor",
          dek: "",
          stat: "",
        },
      },
    ]);
    try {
      const html = await (
        await app.fetch(new Request(`http://test/articles/${stored}`), env)
      ).text();
      expect(html).not.toContain("An impostor");
    } finally {
      setPublishedArticles([]);
    }
  });
});

// ---- step 3: frozen instructions, attachments, proposals --------------------------

import { setRecordEntries } from "../src/site/content/store";
import { keyFigures, term } from "../src/site/content/store";
import { addEntry, entryOverlay, memoryEntries } from "../src/write/entries";

describe("a conversation's instructions are frozen", () => {
  it("sends the same system prompt and tools on every turn, even after the record changes", async () => {
    const store = memoryDrafts();
    const d = await store.create();
    const one = fakeStream([msg([{ type: "text", text: "ok" }], "end_turn")]);
    await runTurn({
      stream: one.stream,
      env,
      store,
      draftId: d.id,
      text: "First.",
      emit: () => {},
    });
    setPublishedArticles([
      {
        article: {
          ...draftArticle(goodDraft(), new Map()),
          slug: "x-new-topic",
          topic: "A brand new topic",
        },
        row: {
          route: "/articles/x-new-topic",
          kind: "Article",
          topic: "A brand new topic",
          date: "2026-10-14",
          title: "X",
          dek: "",
          stat: "",
        },
      },
    ]);
    try {
      const two = fakeStream([msg([{ type: "text", text: "ok" }], "end_turn")]);
      await runTurn({
        stream: two.stream,
        env,
        store,
        draftId: d.id,
        text: "Second.",
        emit: () => {},
      });
      const a = one.calls[0] as Record<string, unknown>;
      const b = two.calls[0] as Record<string, unknown>;
      expect(JSON.stringify(b.system)).toBe(JSON.stringify(a.system));
      expect(JSON.stringify(b.tools)).toBe(JSON.stringify(a.tools));
      expect(JSON.stringify(a.system)).not.toContain("A brand new topic");
      expect(a.thinking).toEqual({
        type: "adaptive",
        display: "updates",
        block_binding: { prefix_mismatch_behavior: "drop_block" },
      });
      expect(a.betas).toContain("thinking-binding-controls-2026-08-01");
    } finally {
      setPublishedArticles([]);
    }
  });
});

describe("proposals for the record", () => {
  const topic = () => articleTopics()[0] ?? "Housing";

  it("proposes only what a document says word for word, and never publishes it", async () => {
    const store = memoryDrafts();
    const entries = memoryEntries();
    const d = await store.create();
    const good = {
      kind: "concept",
      title: "A brand-new pattern",
      body: "What it is.",
      doc: DOC.id,
      section: "S",
      quote: PASSAGE,
      topic: topic(),
    };
    const { stream } = fakeStream([
      msg([{ type: "tool_use", id: "p1", name: "propose_entry", input: good }], "tool_use"),
      msg(
        [
          {
            type: "tool_use",
            id: "p2",
            name: "propose_entry",
            input: { ...good, title: "Another", quote: "words the document never wrote" },
          },
        ],
        "tool_use",
      ),
      msg([{ type: "text", text: "ok" }], "end_turn"),
    ]);
    const events: WriteEvent[] = [];
    await runTurn({
      stream,
      env,
      store,
      entries,
      draftId: d.id,
      text: "Read it.",
      emit: (e) => events.push(e),
    });
    const made = [...entries.rows.values()];
    expect(made).toHaveLength(1);
    expect(made[0]).toMatchObject({ status: "proposed", toolUseId: "p1", draftId: d.id });
    expect(events.filter((e) => e.type === "proposal")).toHaveLength(1);
    expect(JSON.stringify((await store.messages(d.id))[4])).toContain("not word for word");
    expect(
      transcript(await store.messages(d.id)).find((i) => i.who === "proposal")?.toolUseId,
    ).toBe("p1");
  });

  it("adds a proposal as the author rewrote it, and it is on the site", async () => {
    const entries = memoryEntries();
    const e = await entries.create({
      kind: "concept",
      data: {
        title: "A brand-new pattern",
        body: "Claude's words.",
        doc: DOC.id,
        section: "S",
        quote: PASSAGE,
        topic: topic(),
      },
      draftId: "d",
    });
    const r = await addEntry(env, "u1", entries, e.id, { body: "My own words." });
    expect(r).toMatchObject({ ok: true, route: "/concepts/a-brand-new-pattern" });
    const added = await entries.get(e.id);
    expect(added?.data).toMatchObject({ body: "My own words.", edited: true });

    const fig = await entries.create({
      kind: "figure",
      data: {
        title: PASSAGE,
        body: PASSAGE.slice(5, 20),
        doc: DOC.id,
        section: "S",
        quote: PASSAGE,
        topic: topic(),
      },
    });
    expect((await addEntry(env, "u1", entries, fig.id, {})).ok).toBe(true);

    setRecordEntries(await entryOverlay(env, await entries.added()));
    try {
      expect(term("a-brand-new-pattern")?.body).toBe("My own words.");
      const page = await (
        await app.fetch(new Request("http://test/concepts/a-brand-new-pattern"), env)
      ).text();
      expect(page).toContain("My own words.");
      const ideas = await (await app.fetch(new Request("http://test/ideas"), env)).text();
      expect(ideas).toContain("A brand-new pattern");
      expect(keyFigures().some((f) => f.v === PASSAGE.slice(5, 20))).toBe(true);
    } finally {
      setRecordEntries({ terms: [], problems: [], figures: [], rows: [] });
    }
  });

  it("will not add a concept the record already has", async () => {
    const entries = memoryEntries();
    const existing = term("the-price-as-instruction");
    if (!existing) return;
    const e = await entries.create({
      kind: "concept",
      data: {
        title: existing.title,
        body: "x",
        doc: DOC.id,
        section: "S",
        quote: PASSAGE,
        topic: topic(),
      },
    });
    const r = await addEntry(env, "u1", entries, e.id, {});
    expect(r.ok).toBe(false);
  });
});

describe("reports added in the chat", () => {
  it("asks for a file, and refuses a zip", async () => {
    const post = (body: FormData) =>
      app.fetch(new Request("http://test/op/write/x/attach", { method: "POST", body }), env);
    const empty = await post(new FormData());
    expect(empty.status).toBe(400);
  });
});

describe("how the workspace reaches Claude", () => {
  it("prefers Cloudflare's AI Gateway when it is set up, else the Anthropic key, else nothing", async () => {
    const { claudeRoute } = await import("../src/write/agent");
    const gw = { AI_GATEWAY_ID: "g", CLOUDFLARE_ACCOUNT_ID: "a", CF_AIG_TOKEN: "t" };
    expect(claudeRoute({ ...env, ...gw } as Env)).toBe("gateway");
    expect(claudeRoute({ ...env, ...gw, ANTHROPIC_API_KEY: "k" } as Env)).toBe("gateway");
    expect(claudeRoute({ ...env, ANTHROPIC_API_KEY: "k" } as Env)).toBe("anthropic");
    expect(
      claudeRoute({ ...env, AI_GATEWAY_ID: "g", CLOUDFLARE_ACCOUNT_ID: "a" } as Env),
    ).toBeNull();
  });
});

// ---- after the review: what would have broken on first real use -----------------

import { afterFallback } from "../src/write/agent";
import { PART_CHARS, d1Drafts } from "../src/write/drafts";

describe("a draft survives real use", () => {
  it("runs one turn at a time", async () => {
    const store = memoryDrafts();
    const d = await store.create();
    await store.lock(d.id);
    const { stream, calls } = fakeStream([msg([{ type: "text", text: "ok" }], "end_turn")]);
    const events: WriteEvent[] = [];
    await runTurn({
      stream,
      env,
      store,
      draftId: d.id,
      text: "Again.",
      emit: (e) => events.push(e),
    });
    expect(calls).toHaveLength(0);
    expect(events[0]?.type).toBe("error");
    expect(await store.messages(d.id)).toEqual([]);
    await store.unlock(d.id);
  });

  it("keeps nothing empty from a refusal, so the next request is still valid", async () => {
    const store = memoryDrafts();
    const d = await store.create();
    const { stream } = fakeStream([msg([], "refusal")]);
    await runTurn({ stream, env, store, draftId: d.id, text: "Write it.", emit: () => {} });
    const history = await store.messages(d.id);
    expect(history.map((m) => m.role)).toEqual(["user"]);
    expect(await store.lock(d.id)).toBe(true);
  });

  it("does not freeze the instructions until a first reply has come back", async () => {
    const store = memoryDrafts();
    const d = await store.create();
    const broken: StreamFn = () => {
      throw new Error("bad request");
    };
    await runTurn({ stream: broken, env, store, draftId: d.id, text: "Hi.", emit: () => {} });
    expect((await store.get(d.id))?.frame).toBeUndefined();
    const { stream } = fakeStream([msg([{ type: "text", text: "ok" }], "end_turn")]);
    await runTurn({ stream, env, store, draftId: d.id, text: "Hi again.", emit: () => {} });
    expect((await store.get(d.id))?.frame).toBeTruthy();
  });

  it("drops the declined model's calls before a fallback, and keeps its text", () => {
    const content = [
      { type: "thinking", thinking: "", signature: "s" },
      { type: "text", text: "Partial." },
      { type: "tool_use", id: "cut", name: "write_draft", input: {} },
      { type: "fallback", from: { model: "a" }, to: { model: "b" } },
      { type: "tool_use", id: "kept", name: "read_document", input: { id: "x" } },
    ] as unknown as Anthropic.Beta.BetaContentBlock[];
    const out = afterFallback(content).map(
      (b) => (b as { type: string; id?: string }).id ?? b.type,
    );
    expect(out).toEqual(["text", "fallback", "kept"]);
  });

  it("stores a message larger than one D1 row in parts, and reads it back whole", async () => {
    const rows: Array<{ seq: number; message: string; part: number }> = [];
    const db = {
      prepare(sql: string) {
        let a: unknown[] = [];
        const st = {
          bind: (...x: unknown[]) => {
            a = x;
            return st;
          },
          first: async () =>
            /MAX\(seq\)/.test(sql)
              ? { n: rows.length ? Math.max(...rows.map((r) => r.seq)) : null }
              : null,
          all: async () => ({
            results: /FROM draft_messages/.test(sql) ? [...rows].sort((x, y) => x.seq - y.seq) : [],
          }),
          run: async () => {
            if (/INSERT INTO draft_messages/.test(sql))
              rows.push({ seq: Number(a[1]), message: String(a[2]), part: Number(a[4]) });
            return { results: [], meta: { changes: 1 } };
          },
        };
        return st;
      },
    } as unknown as D1Database;
    const store = d1Drafts({ ...env, DB: db } as Env, "u1");
    const big = "x".repeat(PART_CHARS * 2 + 10);
    await store.append("d", [
      { role: "user", content: [{ type: "text", text: big }] },
      { role: "user", content: "small" },
    ]);
    expect(rows.filter((r) => r.part > 0)).toHaveLength(2);
    const back = await store.messages("d");
    expect(back).toHaveLength(2);
    expect(JSON.stringify(back[0])).toContain(big);
  });
});

// ---- research ---------------------------------------------------------------------

import {
  checkReport,
  fetchedPages,
  memorySources,
  reportFile,
  reportProblems,
} from "../src/write/research";

const PAGE_TEXT =
  "The survey of 1,200 households found that rents fell by 4.1 percent in the first year after the ban.\nOther factors also mattered.";
const fetchBlock = (url: string, data: string, pdf = false) => ({
  type: "web_fetch_tool_result",
  tool_use_id: `f-${url}`,
  content: {
    type: "web_fetch_result",
    url,
    retrieved_at: "2026-10-14T00:00:00Z",
    content: {
      type: "document",
      title: "A page",
      source: pdf
        ? { type: "base64", media_type: "application/pdf", data }
        : { type: "text", media_type: "text/plain", data },
    },
  },
});

describe("research: what was read is kept and checked", () => {
  it("keeps fetched pages as text, and PDFs through the converter", async () => {
    const ai = { toMarkdown: async () => [{ format: "markdown", data: "PDF words." }] };
    const pages = await fetchedPages({ ...env, AI: ai } as unknown as Env, [
      { type: "text", text: "hi" },
      fetchBlock("https://a.example/page", PAGE_TEXT),
      fetchBlock("https://b.example/doc.pdf", btoa("%PDF-1.4"), true),
      {
        type: "web_fetch_tool_result",
        tool_use_id: "x",
        content: { type: "web_fetch_tool_result_error", error_code: "url_not_accessible" },
      },
    ]);
    expect(pages.map((p) => [p.url, p.kind, p.text.slice(0, 10)])).toEqual([
      ["https://a.example/page", "text", PAGE_TEXT.slice(0, 10)],
      ["https://b.example/doc.pdf", "pdf", "PDF words."],
    ]);
  });

  it("finds a quotation in a page read, whitespace aside, and fails one that is not there", () => {
    const pages = [
      { url: "u", title: null, retrievedAt: null, kind: "text" as const, text: PAGE_TEXT },
    ];
    const body =
      'The study found that "rents fell by 4.1 percent in the first year\n after the ban" [1], and that "rents rose sharply in every neighbourhood we measured" [2].';
    const r = checkReport(body, pages);
    expect(r.total).toBe(2);
    expect(r.failed.map((f) => f.text)).toEqual([
      "rents rose sharply in every neighbourhood we measured",
    ]);
  });

  it("reaches Admin only with a title, a real topic, sources with links, and every quote found", () => {
    const topic = articleTopics()[0] ?? "Housing";
    const ok = {
      meta: { title: "Rent bans", topic },
      body: `## TL;DR\n${"x ".repeat(250)}\n\n## Sources\n1. [A page](https://a.example/page)`,
    };
    const clean = { total: 0, failed: [] };
    expect(reportProblems(ok, clean, articleTopics())).toEqual([]);
    expect(
      reportProblems(
        { ...ok, body: ok.body.replace(/## Sources[\s\S]*/, "") },
        clean,
        articleTopics(),
      ).join(" "),
    ).toMatch(/Sources/);
    expect(reportFile(ok).startsWith("# Rent bans\n\n## TL;DR")).toBe(true);
    // A plain web address counts as much as a Markdown link.
    expect(
      reportProblems(
        {
          ...ok,
          body: ok.body.replace(
            "[A page](https://a.example/page)",
            "A page. https://a.example/page",
          ),
        },
        clean,
        articleTopics(),
      ),
    ).toEqual([]);
  });

  it("redraws the bar after Claude writes, so Save and Publish never stay stale", async () => {
    const { SITE_JS: SCRIPT } = await import("../src/site/script");
    const { renderWorkspace } = await import("../src/site/pages/write");
    const d = memoryDrafts();
    const draft = await d.create("research");
    const html = renderWorkspace(
      draft,
      [],
      { total: 0, failed: [] },
      {
        hasKey: true,
        research: { problems: ["Nothing is written yet."], pages: 0 },
      },
    );
    expect(html).toContain("data-ws-state");
    expect(html).toContain("data-ws-title");
    // The not-ready list sits inside the part that is redrawn.
    expect(html.indexOf("data-ws-state")).toBeLessThan(html.indexOf("Not ready for Admin"));
    expect(SCRIPT).toContain("restate()");
    expect(SCRIPT).toContain('"[data-ws-state]"');
  });
});

describe("research: a turn", () => {
  it("searches, reads, keeps the pages, writes the report and checks it against them", async () => {
    const store = memoryDrafts();
    const sources = memorySources();
    const d = await store.create("research");
    const topic = articleTopics()[0] ?? "Housing";
    const body = `## TL;DR\nThe study says "rents fell by 4.1 percent in the first year after the ban" [1] and "nothing here was ever actually written anywhere at all" [1].\n\n## Sources\n1. [A page](https://a.example/page)`;
    const { stream, calls } = fakeStream([
      msg(
        [
          {
            type: "server_tool_use",
            id: "s1",
            name: "web_search",
            input: { query: "rent ban study" },
          },
          { type: "web_search_tool_result", tool_use_id: "s1", content: [] },
        ],
        "pause_turn",
      ),
      msg(
        [
          {
            type: "server_tool_use",
            id: "f1",
            name: "web_fetch",
            input: { url: "https://a.example/page" },
          },
          fetchBlock("https://a.example/page", PAGE_TEXT),
          {
            type: "tool_use",
            id: "w1",
            name: "write_report",
            input: { title: "Rent bans", topic, body },
          },
        ],
        "tool_use",
      ),
      msg([{ type: "text", text: "One quote failed; fixing." }], "end_turn"),
    ]);
    const events: WriteEvent[] = [];
    await runTurn({
      stream,
      env,
      store,
      sources,
      draftId: d.id,
      text: "Did the bans lower rents?",
      emit: (e) => events.push(e),
    });

    expect((await sources.texts(d.id)).map((p) => p.url)).toEqual(["https://a.example/page"]);
    expect((await store.get(d.id))?.meta).toMatchObject({ title: "Rent bans", topic });
    const writeResult = JSON.stringify((await store.messages(d.id)).at(-2));
    expect(writeResult).toContain("1 NOT FOUND");
    expect(
      events.filter((e) => e.type === "activity").map((e) => (e as { text: string }).text),
    ).toEqual(
      expect.arrayContaining(["Searched the web: rent ban study", "Read: https://a.example/page"]),
    );
    expect(calls).toHaveLength(3); // the paused turn resumed
    const first = calls[0] as {
      tools: Array<Record<string, unknown>>;
      context_management?: unknown;
      system: Array<{ text: string }>;
    };
    expect(first.tools.find((t) => t.name === "web_fetch")).toMatchObject({
      type: "web_fetch_20260209",
      allowed_callers: ["direct"],
    });
    expect(first.tools.find((t) => t.name === "web_search")).toMatchObject({
      type: "web_search_20260209",
    });
    expect(first.tools.some((t) => t.name === "write_draft")).toBe(false);
    expect(first.context_management).toBeTruthy();
    expect(first.system[0]?.text).toContain("HOW YOU RESEARCH");
  });
});

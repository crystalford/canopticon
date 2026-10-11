// The library model (public/models/library.ts): the data seam under
// /library. The renderer builds the page from it and GET /library.json serves
// it, so the shape is pinned here against the same fake D1 the pipeline test
// uses — counts, one row per processing state, the post-upload banner, the
// worklist's order, and the route's two answers (404 for a reader, JSON for
// the operator).

import { describe, expect, it } from "vitest";
import { buildSessionCookie, signSession } from "../src/auth/session.ts";
import app from "../src/index.ts";
import { type LibraryModel, libraryModel } from "../src/public/models/library.ts";

const SECRET = "test-secret-for-library-model";

const PIECES = [
  ["done-doc", "A Processed Document", null, null],
  ["running-doc", "A Document Being Read", "running_doc_final (2).md", "2026-09-24T09:00:00Z"],
  ["queued-doc", "A Queued Document", null, null],
  ["failed-doc", "A Failed Document", null, null],
  ["fresh-doc", "A Document Never Processed", null, null],
].map(([id, title, original_title, title_auto_at]) => ({
  id,
  slug: id,
  title,
  subtitle: null,
  kind: "research-report",
  subtype: null,
  publication_status: "published",
  byline: null,
  published_at: "2026-09-20T00:00:00.000Z",
  signed_by: null,
  metadata: "{}",
  original_title,
  title_auto_at,
}));

const PROCESSING = [
  {
    piece_id: "done-doc",
    status: "done",
    step: "done",
    chunks_done: 4,
    chunk_count: 4,
    error: null,
  },
  {
    piece_id: "running-doc",
    status: "running",
    step: "digest",
    chunks_done: 3,
    chunk_count: 7,
    error: null,
  },
  {
    piece_id: "queued-doc",
    status: "queued",
    step: "title",
    chunks_done: 0,
    chunk_count: 0,
    error: null,
  },
  {
    piece_id: "failed-doc",
    status: "failed",
    step: "findings",
    chunks_done: 2,
    chunk_count: 2,
    error: "model returned no JSON",
  },
].map((r) => ({
  ...r,
  user_id: "op1",
  model: r.piece_id === "done-doc" ? "@cf/openai/gpt-oss-120b" : null,
  attempts: 0,
  heartbeat_at: null,
  started_at: null,
  finished_at: null,
  updated_at: "2026-09-24T09:00:00.000Z",
}));

// Two bridges, returned OLDER FIRST so the model's own recent-first sort is
// what the assertion exercises, not the fake's order.
const BRIDGES = [
  {
    label: "allostatic load",
    piece_id: "fresh-doc",
    piece_slug: "fresh-doc",
    piece_title: "A Document Never Processed",
    piece_topic: "Health & bodies",
    other_id: "done-doc",
    other_slug: "done-doc",
    other_title: "A Processed Document",
    other_topic: "Media & mind",
    created_at: "2026-09-18T00:00:00.000Z",
  },
  {
    label: "mortgage stress",
    piece_id: "done-doc",
    piece_slug: "done-doc",
    piece_title: "A Processed Document",
    piece_topic: "Housing",
    other_id: "queued-doc",
    other_slug: "queued-doc",
    other_title: "A Queued Document",
    other_topic: "Money",
    created_at: "2026-09-22T00:00:00.000Z",
  },
];

function makeDb(): D1Database {
  const makeStmt = (sql: string) => {
    let bound: unknown[] = [];
    const stmt = {
      bind(...a: unknown[]) {
        bound = a;
        return stmt;
      },
      async first() {
        if (/FROM users/i.test(sql)) return { id: "op1" };
        if (/FROM piece_processing/i.test(sql) && /SUM\(CASE/i.test(sql)) {
          return { queued: 1, running: 1, failed: 1, done: 1 };
        }
        if (/NOT EXISTS/i.test(sql) && /piece_processing/i.test(sql)) return { n: 2 };
        if (/COUNT\(\*\)/i.test(sql)) return { n: 0 };
        return null;
      },
      async all() {
        if (/FROM piece_processing/i.test(sql)) return { results: PROCESSING };
        if (/pa\.topic <> pb\.topic/i.test(sql)) return { results: BRIDGES };
        if (/SELECT id, slug FROM pieces/i.test(sql)) {
          return { results: PIECES.map((p) => ({ id: p.id, slug: p.slug })) };
        }
        if (/FROM pieces/i.test(sql) && /ORDER BY COALESCE\(published_at/i.test(sql)) {
          return { results: PIECES };
        }
        if (/FROM pieces/i.test(sql) && /body_md/i.test(sql) && /id IN/i.test(sql)) {
          const ids = bound.slice(1);
          return {
            results: PIECES.filter((p) => ids.includes(p.id)).map((p) => ({
              id: p.id,
              body_md: "",
            })),
          };
        }
        return { results: [] };
      },
      async run() {
        return { results: [], meta: { changes: 0 } };
      },
    };
    return stmt as unknown as D1PreparedStatement;
  };
  return {
    prepare: (sql: string) => makeStmt(sql),
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}

const env = { ANTHROPIC_API_KEY: "test", LOG_LEVEL: "error", SESSION_SECRET: SECRET, DB: makeDb() };

async function operatorCookie(): Promise<string> {
  const cookie = await signSession(
    { uid: "op1", exp: Math.floor(Date.now() / 1000) + 3600 },
    SECRET,
  );
  return buildSessionCookie(cookie).split(";")[0] as string;
}

const row = (m: LibraryModel, id: string) => {
  const r = m.rows.find((x) => x.id === id);
  if (!r) throw new Error(`no row ${id}`);
  return r;
};

describe("libraryModel — the shape under /library", () => {
  it("counts the documents and the pipeline", async () => {
    const m = await libraryModel(env, { userId: "op1" });
    expect(m.operator).toBe(true);
    expect(m.counts).toEqual({
      documents: 5,
      queued: 1,
      processing: 1,
      failed: 1,
      done: 1,
      unprocessed: 2,
      active: 2,
    });
    expect(m.maintenance).toEqual({ processEverything: { count: 2 }, advanceResearch: true });
    expect(m.model.provider).toBe("workers_ai");
    expect(m.model.gatewayConfigured).toBe(false);
    expect(m.model.note).toBe("gateway not configured");
    expect(m.research.href).toBe("/op/research");
    expect(m.notice).toBeNull();
    expect(m.importing).toBeNull();
  });

  it("gives every row one status, in each of the pipeline's states", async () => {
    const m = await libraryModel(env, { userId: "op1" });
    expect(row(m, "done-doc").status).toMatchObject({
      state: "done",
      text: "Processed",
      step: "done",
      stepIndex: 0,
      stepCount: 7,
      error: null,
      model: "@cf/openai/gpt-oss-120b",
    });
    expect(row(m, "running-doc").status).toMatchObject({
      state: "running",
      text: "Processing 2/7 · reading (3/7)",
      step: "digest",
      stepIndex: 2,
    });
    expect(row(m, "queued-doc").status).toMatchObject({
      state: "queued",
      text: "Queued 1/7 · titling",
      stepIndex: 1,
    });
    expect(row(m, "failed-doc").status).toMatchObject({
      state: "failed",
      text: "Failed at finding figures: model returned no JSON",
      error: "model returned no JSON",
    });
    expect(row(m, "fresh-doc").status).toMatchObject({
      state: "none",
      text: "Not processed",
      step: null,
      stepIndex: 0,
    });
  });

  it("carries what the row shows: actions, the rename, the receipt state", async () => {
    const m = await libraryModel(env, { userId: "op1" });
    expect(row(m, "failed-doc").actions.map((a) => [a.kind, a.label, a.action])).toEqual([
      ["retry", "Retry", "/op/library/failed-doc/retry"],
      ["reprocess", "Re-process", "/op/library/failed-doc/reprocess"],
      ["replace", "New version", "/op/library/failed-doc/replace"],
    ]);
    expect(row(m, "running-doc").actions.map((a) => a.label)).toEqual(["Restart", "New version"]);
    expect(row(m, "done-doc").actions.some((a) => a.kind === "retry")).toBe(false);
    expect(row(m, "running-doc").workingTitle).toEqual({
      original: "running_doc_final (2).md",
      candidates: [],
    });
    expect(row(m, "done-doc").workingTitle).toBeNull();
    // Nothing extracted in this fixture: the receipt is null, never zeros.
    expect(row(m, "fresh-doc").receipt).toBeNull();
    expect(row(m, "fresh-doc").chip).toBeNull();
    expect(row(m, "fresh-doc").href).toBe("/p/fresh-doc");
    expect(row(m, "fresh-doc").kindLabel).toBe("research report");
  });

  it("lists the just-uploaded documents in order, skipping unknown ids, capped at five", async () => {
    const m = await libraryModel(env, {
      userId: "op1",
      uploaded: "done-doc,no-such-id,fresh-doc",
    });
    expect(m.uploaded.map((u) => u.id)).toEqual(["done-doc", "fresh-doc"]);
    expect(m.uploaded[0]?.status.state).toBe("done");
    expect(m.uploaded[0]?.consolidation).not.toBeNull();
    expect(m.uploaded[0]?.consolidation?.line).toContain("bridge");
    // Before the pipeline has finished the record has nothing to say.
    expect(m.uploaded[1]?.status.state).toBe("none");
    expect(m.uploaded[1]?.consolidation).toBeNull();
    expect(m.uploaded[1]?.leads).toEqual([]);

    const six = ["done-doc", "fresh-doc", "queued-doc", "done-doc", "fresh-doc", "queued-doc"];
    const capped = await libraryModel(env, { userId: "op1", uploaded: six.join(",") });
    expect(capped.uploaded).toHaveLength(5);
  });

  it("orders the worklist recent-first, never by frequency", async () => {
    const m = await libraryModel(env, { userId: "op1" });
    expect(m.worklist.map((l) => l.createdAt)).toEqual([
      "2026-09-22T00:00:00.000Z",
      "2026-09-18T00:00:00.000Z",
    ]);
    const first = m.worklist[0];
    expect(first?.kind).toBe("bridge");
    expect(first?.label).toBe("bridge between sections");
    expect(first?.pieceSlug).toBe("done-doc");
    expect(first?.otherSlug).toBe("queued-doc");
    expect(first?.digs.map((d) => d.verb)).toEqual(["Research", "Has anyone said this?"]);
    expect(first?.answer).toBeNull();
  });

  it("turns the query-string flashes into one notice", async () => {
    const m = await libraryModel(env, { userId: "op1", queued: "3" });
    expect(m.notice).toEqual({
      kind: "info",
      text: "Queued 3 documents. Processing runs while this tab is open.",
    });
    const e = await libraryModel(env, { userId: "op1", error: "bad zip", videoError: "no url" });
    expect(e.notice).toEqual({ kind: "error", text: "bad zip" });
    expect(e.videoError).toBe("no url");
  });

  it("survives JSON round-tripping without loss", async () => {
    const m = await libraryModel(env, { userId: "op1", uploaded: "done-doc" });
    expect(JSON.parse(JSON.stringify(m))).toEqual(m);
  });
});

describe("GET /library.json", () => {
  it("is not a door: a reader gets 404", async () => {
    const res = await app.fetch(new Request("http://test/library.json"), env);
    expect(res.status).toBe(404);
  });

  it("serves the operator the model as JSON, uncached", async () => {
    const res = await app.fetch(
      new Request("http://test/library.json?uploaded=done-doc&queued=1", {
        headers: { cookie: await operatorCookie() },
      }),
      env,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const m = (await res.json()) as LibraryModel;
    expect(m.counts.documents).toBe(5);
    expect(m.rows.map((r) => r.id)).toEqual(PIECES.map((p) => p.id));
    expect(m.uploaded.map((u) => u.id)).toEqual(["done-doc"]);
    expect(m.notice?.text).toContain("Queued 1 document.");
    expect(m.worklist).toHaveLength(2);
  });
});

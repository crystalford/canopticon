// /library as the workbench (docs/the-record.md §4, §6): one pipeline status
// per row, one button that drives the queue, a poller that only the operator
// gets, a reversible rename — and none of the retired per-row machinery.

import { describe, expect, it } from "vitest";
import { buildSessionCookie, signSession } from "../src/auth/session.ts";
import app from "../src/index.ts";

const SECRET = "test-secret-for-library-pipeline";

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
  model: null,
  attempts: 0,
  heartbeat_at: null,
  started_at: null,
  finished_at: null,
  updated_at: "2026-09-24T09:00:00.000Z",
}));

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

async function operatorLibrary(): Promise<string> {
  const cookie = await signSession(
    { uid: "op1", exp: Math.floor(Date.now() / 1000) + 3600 },
    SECRET,
  );
  const cookieValue = buildSessionCookie(cookie).split(";")[0] as string;
  const res = await app.fetch(
    new Request("http://test/library", { headers: { cookie: cookieValue } }),
    env,
  );
  expect(res.status).toBe(200);
  return res.text();
}

describe("/library — the pipeline workbench", () => {
  it("renders one pipeline status per row, addressable by the poller", async () => {
    const html = await operatorLibrary();
    expect(html).toContain('class="lib-st lib-st-done" data-piece="done-doc"');
    expect(html).toContain(">Processed<");
    expect(html).toContain('class="lib-st lib-st-running" data-piece="running-doc"');
    expect(html).toContain("Processing 2/5 · reading (3/7)");
    expect(html).toContain('class="lib-st lib-st-queued" data-piece="queued-doc"');
    expect(html).toContain("Queued 1/5 · titling");
    expect(html).toContain('class="lib-st lib-st-failed" data-piece="failed-doc"');
    expect(html).toContain("Failed at finding figures: model returned no JSON");
    expect(html).toContain('class="lib-st lib-st-none" data-piece="fresh-doc"');
    expect(html).toContain(">Not processed<");
    // A published row wears no "published" chip: upload is publication.
    expect(html).not.toContain('<span class="chip">published</span>');
  });

  it("shows the queue line and counts, and 'Process everything' with its count", async () => {
    const html = await operatorLibrary();
    expect(html).toContain('id="lib-queue"');
    expect(html).toContain('data-lib-active="2"');
    expect(html).toContain("1 queued · 1 processing · 1 failed");
    expect(html).toContain('action="/op/process/all"');
    expect(html).toContain("Process everything (2)");
    expect(html).toContain('action="/op/research/advance"');
  });

  it("offers Re-process on every published row and Retry only on the failed one", async () => {
    const html = await operatorLibrary();
    expect(html).toContain('action="/op/library/done-doc/reprocess"');
    expect(html).toContain('action="/op/library/failed-doc/retry"');
    expect(html).not.toContain('action="/op/library/done-doc/retry"');
    expect(html).not.toContain('action="/op/library/queued-doc/retry"');
  });

  it("shows the pipeline rename with a way back", async () => {
    const html = await operatorLibrary();
    expect(html).toContain("Renamed from “running_doc_final (2).md” by the pipeline");
    expect(html).toContain('action="/op/pieces/running-doc/title/revert"');
    expect(html).toContain(">Put it back<");
    expect(html).not.toContain('action="/op/pieces/done-doc/title/revert"');
  });

  it("includes the poller only for the operator, and never the retired controls", async () => {
    const html = await operatorLibrary();
    expect(html).toContain('fetch("/op/process/advance"');
    expect(html).toContain('Accept: "application/json"');
    for (const gone of [
      "/op/library/extract",
      "/op/library/drain",
      "/op/library/topics",
      "/extract-atoms",
      "/lede/approve",
      'id="aeo-models"',
      "Select lead passage",
      "Extract findings",
      "File into sections",
      "Re-extract all",
    ]) {
      expect(html, gone).not.toContain(gone);
    }
    // Signed out: the sign-in page, and no script that would press anything.
    const anon = await app.fetch(new Request("http://test/library"), env);
    expect(anon.status).toBe(401);
    const anonHtml = await anon.text();
    expect(anonHtml).not.toContain("/op/process/advance");
    expect(anonHtml).not.toContain('id="lib-queue"');
  });

  it("banners: queued is said, and the retired banners are not", async () => {
    const cookie = await signSession(
      { uid: "op1", exp: Math.floor(Date.now() / 1000) + 3600 },
      SECRET,
    );
    const cookieValue = buildSessionCookie(cookie).split(";")[0] as string;
    const res = await app.fetch(
      new Request("http://test/library?queued=3&atoms=1.2.3.4&topics=5.1&draining=2", {
        headers: { cookie: cookieValue },
      }),
      env,
    );
    const html = await res.text();
    expect(html).toContain("Queued 3 documents. Processing runs while this tab is open.");
    expect(html).not.toContain("Extracted <b>");
    expect(html).not.toContain("into sections");
    expect(html).not.toContain("queued job");
  });
});

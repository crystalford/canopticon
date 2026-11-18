// The processing pipeline in Admin (docs/the-record.md §4, §6). Publish queues
// a document; Admin lists what is queued, running, failed or renamed, drives
// the queue while it is open, and offers Retry, Start over and a reversible
// rename. The Workbench that used to hold this redirects to Admin.

import { describe, expect, it } from "vitest";
import { buildSessionCookie, signSession } from "../src/auth/session.ts";
import app from "../src/index.ts";

const SECRET = "test-secret-for-library-pipeline";

const PIECES = [
  ["done-doc", "A Processed Document", "done_doc_v3.md", "2026-09-24T08:00:00Z"],
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
        if (/FROM piece_processing x JOIN pieces/i.test(sql)) {
          return {
            results: PROCESSING.filter((r) => r.status !== "done").map((r) => {
              const p = PIECES.find((x) => x.id === r.piece_id);
              return { ...r, title: p?.title, slug: p?.slug };
            }),
          };
        }
        if (/title_auto_at IS NOT NULL/i.test(sql)) {
          return {
            results: PIECES.filter((p) => p.title_auto_at).map((p) => ({
              id: p.id,
              slug: p.slug,
              title: p.title,
              original_title: p.original_title,
            })),
          };
        }
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

async function signedIn(path: string): Promise<Response> {
  const cookie = await signSession(
    { uid: "op1", exp: Math.floor(Date.now() / 1000) + 3600 },
    SECRET,
  );
  const cookieValue = buildSessionCookie(cookie).split(";")[0] as string;
  return app.fetch(new Request(`http://test${path}`, { headers: { cookie: cookieValue } }), env);
}

async function admin(): Promise<string> {
  const res = await signedIn("/admin");
  expect(res.status).toBe(200);
  return res.text();
}

describe("processing, in Admin", () => {
  it("lists what is queued, running and failed, each line addressable by the poller", async () => {
    const html = await admin();
    expect(html).toContain('aria-label="Processing"');
    expect(html).toMatch(/data-proc-line="running-doc"[^>]*>Processing 2\//);
    expect(html).toMatch(/data-proc-line="queued-doc"[^>]*>Queued 1\//);
    expect(html).toMatch(/data-proc-line="failed-doc"[^>]*>Failed at/);
    expect(html).toContain("model returned no JSON");
  });

  it("drives the queue only while something is waiting, and says so", async () => {
    const html = await admin();
    expect(html).toContain('data-proc-active="2"');
    expect(html).toContain("2 to go · runs while this page is open");
  });

  it("offers Retry and Start over only on the failed document", async () => {
    const html = await admin();
    expect(html).toContain('action="/op/library/failed-doc/retry"');
    expect(html).toContain('action="/op/library/failed-doc/reprocess"');
    expect(html).not.toContain('action="/op/library/running-doc/retry"');
    expect(html).not.toContain('action="/op/library/queued-doc/retry"');
  });

  it("shows a pipeline rename with a way back and a way to keep it", async () => {
    const html = await admin();
    expect(html).toContain("Renamed from &quot;done_doc_v3.md&quot;");
    expect(html).toContain('action="/op/pieces/done-doc/title/revert"');
    expect(html).toContain('action="/op/pieces/done-doc/title"');
  });

  it("has no Workbench: the old address goes to Admin", async () => {
    const html = await admin();
    expect(html).not.toContain('href="/admin/workbench"');
    const res = await signedIn("/admin/workbench");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/admin");
  });
});

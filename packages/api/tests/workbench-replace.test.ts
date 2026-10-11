// A NEW VERSION of a document (docs/the-record.md §4): POST /op/library/:id/replace.
//
// The body is replaced, the slug and published_at are never touched, the
// previous source id is appended (nothing deleted), stale quotes are purged,
// and the operator's readings are re-anchored in the new body — the ones the
// new body no longer contains are dropped and counted. A byte-identical
// upload is refused before anything is written.

import { describe, expect, it } from "vitest";
import { buildSessionCookie, signSession } from "../src/auth/session.ts";
import app from "../src/index.ts";

const SECRET = "test-secret-for-replace";

const OLD_BODY = `# Housing in the record

Provincial health spending grew 4.8 percent over the same period, outpacing the transfer escalator of 3.0 percent set in 2023.

The Parliamentary Budget Officer noted in March 2026 that the gap would compound to roughly $9 billion annually by 2030.`;

// The first passage survives the revision; the second does not.
const NEW_BODY = `# Housing in the record

Provincial health spending grew 4.8 percent over the same period, outpacing the transfer escalator of 3.0 percent set in 2023.

A revised estimate from the same office put the compounding gap nearer $11 billion by 2030.`;

const READINGS = [
  {
    id: "r1",
    quote_id: "q1",
    verbatim_text:
      "Provincial health spending grew 4.8 percent over the same period, outpacing the transfer escalator of 3.0 percent set in 2023.",
    note_md: "Which escalator? Needs a source.",
    created_at: "2026-09-20T10:00:00Z",
  },
  {
    id: "r2",
    quote_id: "q2",
    verbatim_text:
      "The Parliamentary Budget Officer noted in March 2026 that the gap would compound to roughly $9 billion annually by 2030.",
    note_md: "Check the PBO report date.",
    created_at: "2026-09-21T10:00:00Z",
  },
];

interface Call {
  sql: string;
  params: unknown[];
}

function makeEnv(opts: { metadata?: Record<string, unknown> } = {}) {
  const calls: Call[] = [];
  const state = { body: OLD_BODY, lastPut: "" };
  const piece = {
    id: "p1",
    slug: "housing-record",
    title: "Housing in the record",
    body_md: OLD_BODY,
    metadata: JSON.stringify({ source_id: "src-old", ...opts.metadata }),
  };
  const mk = (sql: string) => {
    let bound: unknown[] = [];
    const stmt = {
      bind(...args: unknown[]) {
        bound = args;
        return stmt;
      },
      async first() {
        calls.push({ sql, params: bound });
        if (/FROM users/i.test(sql)) return { id: "op1" };
        if (/SELECT id, slug, title, body_md, metadata FROM pieces/.test(sql)) return piece;
        if (/SELECT body_md, title FROM pieces/.test(sql)) {
          return { body_md: state.body, title: piece.title };
        }
        if (/FROM uploaded_files WHERE id = \?/.test(sql)) {
          return {
            id: bound[0],
            user_id: "op1",
            r2_key: state.lastPut,
            mime: "text/markdown",
            classification: "markdown",
            original_filename: "housing.md",
          };
        }
        if (/FROM sources WHERE id = \?/.test(sql)) {
          return { content_text: NEW_BODY, title: piece.title, metadata: "{}" };
        }
        return null;
      },
      async all() {
        calls.push({ sql, params: bound });
        if (/FROM readings r JOIN quotes q/.test(sql)) return { results: READINGS };
        return { results: [] };
      },
      async run() {
        calls.push({ sql, params: bound });
        if (/UPDATE pieces SET body_md = \?/.test(sql)) state.body = bound[0] as string;
        return { results: [], meta: { changes: 1 } };
      },
    };
    return stmt as unknown as D1PreparedStatement;
  };
  const files = new Map<string, Uint8Array>();
  const env = {
    LOG_LEVEL: "error",
    SESSION_SECRET: SECRET,
    DB: {
      prepare: (sql: string) => mk(sql),
      dump: async () => new ArrayBuffer(0),
      batch: async () => [],
      exec: async () => ({ count: 0, duration: 0 }),
    },
    FILES: {
      put: async (key: string, bytes: Uint8Array) => {
        files.set(key, bytes);
        state.lastPut = key;
      },
      get: async (key: string) => {
        const b = files.get(key);
        return b ? { text: async () => new TextDecoder().decode(b) } : null;
      },
      head: async () => null,
    },
  };
  return { env, calls };
}

async function replace(env: object, body: string, pieceId = "p1") {
  const cookie = await signSession(
    { uid: "op1", exp: Math.floor(Date.now() / 1000) + 3600 },
    SECRET,
  );
  const form = new FormData();
  form.set("file", new File([body], "housing.md", { type: "text/markdown" }));
  return app.fetch(
    new Request(`http://test/op/library/${pieceId}/replace`, {
      method: "POST",
      headers: { cookie: buildSessionCookie(cookie).split(";")[0] as string },
      body: form,
    }),
    env,
  );
}

async function sha256(s: string): Promise<string> {
  const out = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(out))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("POST /op/library/:id/replace — a new version", () => {
  it("replaces the body, keeps slug and published_at, appends the previous source id", async () => {
    const { env, calls } = makeEnv();
    const res = await replace(env, NEW_BODY);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/desk?replaced=1&readings_lost=1");

    const update = calls.find((c) => /UPDATE pieces SET body_md = \?/.test(c.sql));
    expect(update).toBeDefined();
    expect(update?.sql).not.toMatch(/slug|published_at/);
    expect(update?.sql).toMatch(/updated_at = \?/);
    expect(update?.params[0]).toBe(NEW_BODY);
    expect(update?.params[1]).toBe("research-report");
    const meta = JSON.parse(update?.params[3] as string);
    expect(meta.previous_source_ids).toEqual(["src-old"]);
    expect(meta.source_id).not.toBe("src-old");
    expect(meta.content_sha256).toBe(await sha256(NEW_BODY));

    // Nothing is deleted: no DELETE touches pieces, sources or uploaded_files.
    expect(calls.some((c) => /DELETE FROM (pieces|sources|uploaded_files)/.test(c.sql))).toBe(
      false,
    );
    // Stale quotes never survive a body change.
    expect(
      calls.some((c) => /DELETE FROM nodes WHERE user_id = \? AND piece_id = \?/.test(c.sql)),
    ).toBe(true);
    expect(calls.some((c) => /DELETE FROM aeo_findings/.test(c.sql))).toBe(true);
    // The pipeline restarts.
    expect(calls.some((c) => /INSERT INTO piece_processing/.test(c.sql))).toBe(true);
  });

  it("re-locates a surviving reading in the new body and drops the lost one", async () => {
    const { env, calls } = makeEnv();
    await replace(env, NEW_BODY);
    const quotes = calls.filter((c) => /INSERT INTO quotes/.test(c.sql));
    const readings = calls.filter((c) => /INSERT INTO readings/.test(c.sql));
    expect(quotes).toHaveLength(1);
    expect(readings).toHaveLength(1);
    // The DOCUMENT's bytes for the passage, located in the NEW body.
    expect(quotes[0]?.params[4]).toBe(READINGS[0]?.verbatim_text);
    expect(readings[0]?.params[4]).toBe("Which escalator? Needs a source.");
    // The note keeps the date it was written.
    const kept = calls.find((c) => /UPDATE readings SET created_at = \?/.test(c.sql));
    expect(kept?.params[0]).toBe("2026-09-20T10:00:00Z");
    // The old readings were cleared before the new anchors went in.
    const cleared = calls.findIndex((c) =>
      /DELETE FROM readings WHERE user_id = \? AND piece_id = \?/.test(c.sql),
    );
    const inserted = calls.findIndex((c) => /INSERT INTO readings/.test(c.sql));
    expect(cleared).toBeGreaterThan(-1);
    expect(cleared).toBeLessThan(inserted);
  });

  it("refuses the same file before writing anything", async () => {
    const { env, calls } = makeEnv({ metadata: { content_sha256: await sha256(OLD_BODY) } });
    const res = await replace(env, OLD_BODY);
    expect(res.headers.get("location")).toBe("/desk?error=same+file");
    expect(calls.some((c) => /INSERT|UPDATE|DELETE/.test(c.sql))).toBe(false);
  });
});

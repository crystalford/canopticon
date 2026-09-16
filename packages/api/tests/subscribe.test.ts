// The mailing list: a plain form POST, a duplicate guard, and a working way
// out. No sending infrastructure exists yet — these cover what does.

import { describe, expect, it } from "vitest";
import app from "../src/index.ts";

interface Recorded {
  sql: string;
  args: unknown[];
}

function makeDb(opts: { existingEmail?: string; token?: string } = {}) {
  const writes: Recorded[] = [];
  const mk = (sql: string) => {
    let bound: unknown[] = [];
    const stmt = {
      bind(...a: unknown[]) {
        bound = a;
        return stmt;
      },
      async first() {
        if (/FROM users/i.test(sql)) return { id: "u1" };
        if (/FROM pub_subscriptions WHERE email/i.test(sql)) {
          return opts.existingEmail && bound[0] === opts.existingEmail ? { id: "sub1" } : null;
        }
        if (/unsubscribe_token = \?|confirmation_token = \?/i.test(sql)) {
          return opts.token && bound[0] === opts.token ? { id: "sub1" } : null;
        }
        return null;
      },
      async all() {
        return { results: [] };
      },
      async run() {
        writes.push({ sql, args: bound });
        return { results: [], meta: { changes: 1 } };
      },
    };
    return stmt as unknown as D1PreparedStatement;
  };
  const db = {
    prepare: (sql: string) => mk(sql),
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
  return { db, writes };
}

const envWith = (db: D1Database) => ({
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_SERVICE_ROLE_KEY: "test",
  ANTHROPIC_API_KEY: "test",
  OPENPARLIAMENT_USER_AGENT: "test",
  LOG_LEVEL: "error",
  DB: db,
});

const post = (db: D1Database, body: string) =>
  app.fetch(
    new Request("http://test/subscribe", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    }),
    envWith(db),
  );

describe("mailing list", () => {
  it("accepts a plain form post and stores the address", async () => {
    const { db, writes } = makeDb();
    const res = await post(db, "email=Reader%40Example.com");
    expect(res.status).toBe(200);
    // NOT "you're on the list" — they are not, until they confirm. The page
    // used to say so before anything was ever sent; now a confirmation goes
    // out and the copy has to match what actually happened.
    expect(await res.text()).toContain("Check your email");
    const insert = writes.find((w) => /INSERT INTO pub_subscriptions/i.test(w.sql));
    expect(insert, "an address must actually be written").toBeTruthy();
    // Normalised, so the duplicate guard can't be defeated by capitalisation.
    expect(insert?.args).toContain("reader@example.com");
  });

  it("rejects a malformed address without writing anything", async () => {
    const { db, writes } = makeDb();
    const res = await post(db, "email=not-an-email");
    expect(res.status).toBe(400);
    expect(writes.filter((w) => /INSERT/i.test(w.sql))).toHaveLength(0);
  });

  it("does not write a duplicate", async () => {
    // SQLite treats NULLs as distinct, so the table's UNIQUE (email,
    // thesis_id) does NOT catch a repeat site-wide signup. The guard is
    // explicit in the route, and this is what proves it.
    const { db, writes } = makeDb({ existingEmail: "reader@example.com" });
    const res = await post(db, "email=reader%40example.com");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("already on the list");
    expect(writes.filter((w) => /INSERT/i.test(w.sql))).toHaveLength(0);
  });

  it("unsubscribes on a valid token and marks the row, not deletes it", async () => {
    const { db, writes } = makeDb({ token: "tok-123" });
    const res = await app.fetch(new Request("http://test/unsubscribe?token=tok-123"), envWith(db));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Unsubscribed");
    const update = writes.find((w) => /UPDATE pub_subscriptions SET unsubscribed_at/i.test(w.sql));
    expect(update).toBeTruthy();
  });

  it("refuses an unknown unsubscribe token", async () => {
    const { db, writes } = makeDb({ token: "tok-123" });
    const res = await app.fetch(new Request("http://test/unsubscribe?token=wrong"), envWith(db));
    expect(res.status).toBe(404);
    expect(writes.filter((w) => /UPDATE/i.test(w.sql))).toHaveLength(0);
  });

  it("confirms on a valid token and clears the token", async () => {
    const { db, writes } = makeDb({ token: "c-9" });
    const res = await app.fetch(new Request("http://test/confirm?token=c-9"), envWith(db));
    expect(res.status).toBe(200);
    const update = writes.find((w) => /SET confirmed = 1/i.test(w.sql));
    expect(update).toBeTruthy();
    expect(update?.sql).toContain("confirmation_token = NULL");
  });

  it("puts the signup form in the footer of ordinary pages, no JS needed", async () => {
    const { db } = makeDb();
    const res = await app.fetch(new Request("http://test/essays"), envWith(db));
    const html = await res.text();
    expect(html).toContain('method="post" action="/subscribe"');
    expect(html).toContain('type="email"');
  });
});

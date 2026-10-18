// Saving a research report to Admin, and starting an article from it — run
// against a real SQLite with every migration applied. The same report,
// revised, replaces its waiting copy; a new title is a new document; an
// article starts from the saved report and reads it first.

import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { buildSessionCookie, signSession } from "../src/auth/session";
import type { Env } from "../src/env";
import app from "../src/index";
import { d1Drafts } from "../src/write/drafts";
import { articleTopics } from "../src/write/publish";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (
    p: string,
  ) => {
    exec(sql: string): void;
    prepare(sql: string): {
      all(...a: unknown[]): Array<Record<string, unknown>>;
      run(...a: unknown[]): unknown;
    };
  };
};

function sqliteD1() {
  const db = new DatabaseSync(":memory:");
  const dir = "../../supabase/migrations";
  for (const f of readdirSync(dir)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort())
    db.exec(readFileSync(`${dir}/${f}`, "utf8"));
  const norm = (a: unknown[]) => a.map((x) => (x === undefined ? null : x));
  const d1 = {
    prepare(sql: string) {
      let args: unknown[] = [];
      const stmt = {
        bind(...a: unknown[]) {
          args = norm(a);
          return stmt;
        },
        async all() {
          return { results: db.prepare(sql).all(...args) };
        },
        async first() {
          return db.prepare(sql).all(...args)[0] ?? null;
        },
        async run() {
          db.prepare(sql).run(...args);
          return { results: [], meta: { changes: 1 } };
        },
      };
      return stmt;
    },
    async batch(stmts: Array<{ run(): Promise<unknown> }>) {
      const out = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    },
  } as unknown as D1Database;
  return { db, d1 };
}

const SECRET = "research-save-secret";
const files = new Map<string, Uint8Array>();
const R2 = {
  async put(key: string, v: Uint8Array) {
    files.set(key, v);
    return {};
  },
  async get(key: string) {
    const v = files.get(key);
    return v
      ? { arrayBuffer: async () => v.buffer, text: async () => new TextDecoder().decode(v) }
      : null;
  },
  async delete() {},
};

async function post(env: Env, path: string): Promise<Response> {
  const cookie = await signSession(
    { uid: "op1", exp: Math.floor(Date.now() / 1000) + 3600 },
    SECRET,
  );
  const value = buildSessionCookie(cookie).split(";")[0] as string;
  return app.fetch(
    new Request(`http://test${path}`, {
      method: "POST",
      headers: { cookie: value, origin: "http://test" },
    }),
    env,
  );
}

const report = (title: string, extra = "") => ({
  meta: { title, topic: articleTopics()[0] ?? "Housing" },
  body: `## TL;DR\n${"Starts fell. ".repeat(60)}${extra}\n\n## Sources\n1. [A page](https://a.example/page)`,
});

describe("research: Save to Admin", () => {
  it("updates the waiting copy for the same report, adds a new one for a new title, and starts an article from it", async () => {
    const { db, d1 } = sqliteD1();
    db.exec(
      "INSERT INTO users (id, email, created_at) VALUES ('op1', 'op@example.com', '2026-01-01T00:00:00Z')",
    );
    const env = { DB: d1, FILES: R2, SESSION_SECRET: SECRET, LOG_LEVEL: "error" } as unknown as Env;
    const drafts = d1Drafts(env, "op1");
    const d = await drafts.create("research");
    // As write_report does: the new report over the meta already there.
    const write = async (r: ReturnType<typeof report>) => {
      const now = await drafts.get(d.id);
      await drafts.save(d.id, { meta: { ...(now?.meta ?? {}), ...r.meta }, body: r.body });
    };
    const waiting = () =>
      db
        .prepare("SELECT slug, title, publication_status FROM pieces ORDER BY created_at")
        .all() as Array<{ slug: string; title: string; publication_status: string }>;

    await write(report("Housing starts in Toronto"));
    let res = await post(env, `/op/write/${d.id}/save`);
    expect(decodeURIComponent(res.headers.get("location") ?? "")).toContain("Saved to Admin.");
    expect(waiting()).toHaveLength(1);
    expect(waiting()[0]?.publication_status).not.toBe("published");

    // The same report, revised: one copy in Admin, the new text.
    await write(report("Housing starts in Toronto", " And rents rose."));
    res = await post(env, `/op/write/${d.id}/save`);
    expect(decodeURIComponent(res.headers.get("location") ?? "")).toContain("Updated in Admin");
    expect(waiting()).toHaveLength(1);
    const body = db.prepare("SELECT body_md FROM pieces").all()[0] as { body_md: string };
    expect(body.body_md).toContain("And rents rose.");

    // Unchanged: nothing new.
    res = await post(env, `/op/write/${d.id}/save`);
    expect(decodeURIComponent(res.headers.get("location") ?? "")).toContain("unchanged");
    expect(waiting()).toHaveLength(1);

    // A different report in the same conversation: a second document.
    await write(report("Condo presales in the GTA"));
    res = await post(env, `/op/write/${d.id}/save`);
    expect(decodeURIComponent(res.headers.get("location") ?? "")).toContain("as a new document");
    expect(waiting()).toHaveLength(2);

    // Write an article from it: an article draft that reads the saved report first.
    const saved = (await drafts.get(d.id))?.meta.savedAs ?? "";
    expect(saved).toBeTruthy();
    res = await post(env, `/op/write/${d.id}/article`);
    const to = res.headers.get("location") ?? "";
    expect(to).toMatch(/^\/admin\/write\/[^/?]+\?start=1$/);
    const articleId = to.split("/").pop()?.split("?")[0] ?? "";
    const article = await drafts.get(articleId);
    expect(article?.kind).toBe("article");
    expect(article?.meta.based_on).toEqual([saved]);
    expect(article?.meta.seed).toContain(`(id: ${saved})`);
    // Pressed again, it opens the same draft.
    res = await post(env, `/op/write/${d.id}/article`);
    expect(res.headers.get("location")).toBe(`/admin/write/${articleId}`);
  });
});

describe("research: the bar's buttons", () => {
  it("says Update in Admin for the same report, Save to Admin for a new one, and offers an article once saved", async () => {
    const { renderWorkspace } = await import("../src/site/pages/write");
    const { memoryDrafts } = await import("../src/write/drafts");
    const d = await memoryDrafts().create("research");
    const bar = (research: { savedAs?: string; update?: boolean }) =>
      renderWorkspace(
        d,
        [],
        { total: 0, failed: [] },
        {
          hasKey: true,
          research: { problems: [], pages: 3, ...research },
        },
      );
    expect(bar({})).toContain(">Save to Admin<");
    expect(bar({})).not.toContain("Write an article from this");
    expect(bar({ savedAs: "a", update: true })).toContain(">Update in Admin<");
    expect(bar({ savedAs: "a", update: false })).toContain(">Save to Admin<");
    expect(bar({ savedAs: "a" })).toContain(`action="/op/write/${d.id}/article"`);
  });
});

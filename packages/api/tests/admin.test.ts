// Admin — "Nothing publishes without Publish" (docs/blackbox/README.md §Desk).
//
// What these pin: an upload is read, sorted and HELD, never published on the
// drop; the sorter reads shape, not a model; every card is a working form;
// Publish, Keep private, Undo and Remove each do exactly what they say, on
// the operator's own uploads only; and a reader never gets in.

import { describe, expect, it } from "vitest";
import { buildSessionCookie, signSession } from "../src/auth/session";
import app from "../src/index";
import { sortUpload } from "../src/lib/sort-upload";
import type { AdminModel, AdminPiece } from "../src/site/admin-data";
import { draftRow, renderAdmin } from "../src/site/pages/admin";
import type { Draft } from "../src/write/drafts";
import type { ReadBadge } from "../src/write/read";

const SECRET = "test-secret-for-admin";

interface Call {
  sql: string;
  args: unknown[];
}

function makeDb(
  opts: { rows?: Array<Record<string, unknown>>; piece?: Record<string, unknown> } = {},
) {
  const calls: Call[] = [];
  const db = {
    prepare(sql: string) {
      let args: unknown[] = [];
      const stmt = {
        bind(...a: unknown[]) {
          args = a;
          return stmt;
        },
        async first() {
          calls.push({ sql, args });
          if (/FROM users/i.test(sql)) return { id: "op1" };
          if (/FROM pieces\s+WHERE id = \? AND user_id = \?/i.test(sql)) return opts.piece ?? null;
          return null;
        },
        async all() {
          calls.push({ sql, args });
          if (/'\$\.desk'\)\) IS NOT NULL/.test(sql)) return { results: opts.rows ?? [] };
          return { results: [] };
        },
        async run() {
          calls.push({ sql, args });
          return { results: [], meta: { changes: 1 } };
        },
      };
      return stmt as unknown as D1PreparedStatement;
    },
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
  return { db, calls };
}

const envWith = (db: D1Database) => ({
  ANTHROPIC_API_KEY: "test",
  LOG_LEVEL: "error",
  SESSION_SECRET: SECRET,
  DB: db,
});

async function signedIn(path: string, init: RequestInit = {}): Promise<Request> {
  const cookie = await signSession(
    { uid: "op1", exp: Math.floor(Date.now() / 1000) + 3600 },
    SECRET,
  );
  const value = buildSessionCookie(cookie).split(";")[0] as string;
  return new Request(`http://test${path}`, {
    ...init,
    headers: { cookie: value, origin: "http://test", ...(init.headers ?? {}) },
  });
}

const piece = (over: Partial<AdminPiece> = {}): AdminPiece => ({
  id: "p1",
  slug: "a-report",
  title: "A Report",
  status: "working-material",
  chars: 24000,
  head: "",
  createdAt: "2026-10-11T12:00:00Z",
  publishedAt: null,
  adminStatus: "waiting",
  sortedAs: "research",
  sortedWhy: "has a TL;DR or key findings and numbered sources",
  topic: "",
  filename: "a-report.md",
  ...over,
});

const empty: AdminModel = { waiting: [], failed: [], kept: [], published: [] };

describe("sorting an upload: shape before model", () => {
  it.each([
    ["## TL;DR\nThe answer.\n\n## Findings\nA figure [1].", "research"],
    ["# Title\n\n## Abstract\nWe argue.\n\n## References\n1. A.", "paper"],
    ["I have been thinking about rent, and I think the bans failed.", "article"],
    ["My doctor changed my medication last spring.", "personal"],
    ["A plain report about tariffs.", "research"],
  ])("%s → %s", (text, as) => {
    expect(sortUpload(text).as).toBe(as);
  });

  it("says why, so the card can say why", () => {
    expect(sortUpload("## Key findings\n- one").why).toMatch(/key findings/);
  });
});

describe("the Admin page", () => {
  it("is for the author only: a reader is asked to sign in", async () => {
    const { db } = makeDb();
    const res = await app.fetch(new Request("http://test/admin"), envWith(db));
    expect(res.status).toBe(401);
    expect(await res.text()).toContain('href="/op/login?next=%2Fadmin"');
  });

  it("shows a waiting upload as a card with Publish, Keep private, Remove and Review", () => {
    const html = renderAdmin({ ...empty, waiting: [piece()] });
    expect(html).toContain('action="/op/admin/p1/publish"');
    expect(html).toContain('formaction="/op/admin/p1/private"');
    expect(html).toContain('formaction="/op/admin/p1/remove"');
    expect(html).toContain('href="/admin/review/p1"');
    expect(html).toContain('name="sorted_as" value="research" checked');
    expect(html).toContain("Ready to publish");
    expect(html).toContain("1 waiting");
  });

  it("holds a personal file private, and says publishing it is a choice", () => {
    const html = renderAdmin({
      ...empty,
      waiting: [piece({ sortedAs: "personal", sortedWhy: "names you or your health" })],
    });
    expect(html).toContain("Held private");
    expect(html).toContain("Publish anyway");
  });

  it("asks for a text version of a file that could not be read", () => {
    const html = renderAdmin({ ...empty, failed: [piece({ chars: 0, filename: "scan.pdf" })] });
    expect(html).toContain("Needs a text version");
    expect(html).toContain('action="/op/library/p1/replace"');
    expect(html).toContain("scan.pdf");
  });

  it("offers Undo on what was decided this week, behind Show decided", () => {
    const model = {
      ...empty,
      published: [
        piece({
          status: "published",
          adminStatus: "published",
          publishedAt: new Date().toISOString(),
        }),
      ],
      kept: [piece({ id: "p2", adminStatus: "private" })],
    };
    // Off: decided cards drop out of the list, and the toggle counts them.
    const off = renderAdmin(model);
    expect(off).not.toContain('action="/op/admin/p1/unpublish"');
    expect(off).toMatch(
      /aria-pressed="false"><span class="sw"[^>]*><\/span>Show decided<span class="n">2</,
    );
    expect(off).toContain('name="decided" value="1"');
    // On: they come back, each with Undo.
    const on = renderAdmin(model, {}, new Map(), { drafts: [], decided: true });
    expect(on).toContain('aria-pressed="true"');
    expect(on).toContain('action="/op/admin/p1/unpublish"');
    expect(on).toContain('action="/op/admin/p2/undo"');
  });

  it("gives each waiting card one primary action and a ⋯ menu", () => {
    const html = renderAdmin({ ...empty, waiting: [piece()] });
    const cardHtml = html.slice(html.indexOf('class="d-card"'));
    expect(cardHtml).toContain('<button type="submit" class="btn primary">Publish</button>');
    expect(cardHtml).toMatch(/<details class="more"><summary aria-label="More actions"/);
    // Read as and topic still go with Publish, tucked into a disclosure.
    expect(cardHtml).toMatch(
      /<details class="d-change">[\s\S]*name="sorted_as"[\s\S]*name="topic"/,
    );
  });

  it("says plainly when nothing is waiting", () => {
    expect(renderAdmin(empty)).toContain("Nothing waiting. Add something above.");
  });

  it("reads the operator's own uploads, signed in", async () => {
    const { db, calls } = makeDb({
      rows: [
        {
          id: "p9",
          slug: "s",
          title: "From D1",
          publication_status: "working-material",
          chars: 5000,
          head: "## TL;DR\nx",
          created_at: "2026-10-11T00:00:00Z",
          published_at: null,
          metadata: JSON.stringify({
            ingested_from: "feed-upload",
            admin_status: "waiting",
            sorted_as: "paper",
          }),
        },
      ],
    });
    const res = await app.fetch(await signedIn("/admin"), envWith(db));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("From D1");
    expect(html).toContain('name="sorted_as" value="paper" checked');
    const q = calls.find((c) => /'\$\.desk'\)\) IS NOT NULL/.test(c.sql));
    expect(q?.sql).toContain("feed-upload");
  });
});

describe("the private pages, signed in", () => {
  it("serves the project pages to the author", async () => {
    const { db } = makeDb();
    const res = await app.fetch(await signedIn("/admin/projects/ancaster"), envWith(db));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(">Ancaster<");
    expect(html).toContain('<meta name="robots" content="noindex,follow" />');
  });

  it("offers the author a Marked useful sort, with the whole list on one page", async () => {
    const { db } = makeDb();
    const res = await app.fetch(await signedIn("/library?sort=useful"), envWith(db));
    const html = await res.text();
    expect(html).toContain("Marked useful");
    expect(html).toContain("data-useful-sort");
    expect(html).not.toContain('aria-label="Pages"');
  });
});

describe("Admin's buttons", () => {
  const owned = {
    id: "p1",
    slug: "a-report",
    title: "A Report",
    publication_status: "working-material",
    published_at: null,
  };
  const post = async (path: string, body: Record<string, string> = {}) => {
    const { db, calls } = makeDb({ piece: owned });
    const res = await app.fetch(
      await signedIn(path, {
        method: "POST",
        body: new URLSearchParams(body),
        headers: { "content-type": "application/x-www-form-urlencoded" },
      }),
      envWith(db),
    );
    return { res, calls };
  };

  it("Publish publishes, files it as chosen, and only then queues the pipeline", async () => {
    const { res, calls } = await post("/op/admin/p1/publish", {
      sorted_as: "paper",
      topic: "Housing",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toMatch(/^\/admin\?done=Published/);
    expect(calls.some((c) => /SET publication_status = 'published'/.test(c.sql))).toBe(true);
    const meta = calls.find((c) => /json_set/.test(c.sql));
    expect(meta?.args).toEqual(["published", "paper", "was set by you", "Housing", "p1"]);
    expect(calls.some((c) => /piece_processing/i.test(c.sql))).toBe(true);
  });

  it("ignores a topic the site has no hub for", async () => {
    const { calls } = await post("/op/admin/p1/publish", { topic: "Not a topic" });
    const meta = calls.find((c) => /json_set/.test(c.sql));
    expect(meta?.args).toEqual(["published", "p1"]);
  });

  it("Keep private keeps it off the site", async () => {
    const { calls } = await post("/op/admin/p1/private");
    expect(calls.some((c) => /publication_status = 'published'/.test(c.sql))).toBe(false);
    expect(calls.find((c) => /json_set/.test(c.sql))?.args[0]).toBe("private");
  });

  it("Unpublish takes it off the site and puts it back in Admin", async () => {
    const { calls } = await post("/op/admin/p1/unpublish");
    expect(calls.some((c) => /SET publication_status = 'working-material'/.test(c.sql))).toBe(true);
    expect(calls.find((c) => /json_set/.test(c.sql))?.args[0]).toBe("waiting");
  });

  it("Remove clears the graph before the row, never the row alone", async () => {
    const { calls } = await post("/op/admin/p1/remove");
    const purge = calls.findIndex((c) => /DELETE FROM nodes|FROM quotes|readings/i.test(c.sql));
    const del = calls.findIndex((c) => /DELETE FROM pieces/.test(c.sql));
    expect(purge).toBeGreaterThan(-1);
    expect(del).toBeGreaterThan(purge);
  });

  it("refuses a document that is not one of the operator's uploads", async () => {
    const { db, calls } = makeDb({});
    const res = await app.fetch(
      await signedIn("/op/admin/nope/publish", { method: "POST", body: new URLSearchParams({}) }),
      envWith(db),
    );
    expect(res.headers.get("location")).toMatch(/^\/admin\?error=/);
    expect(calls.some((c) => /^UPDATE/i.test(c.sql.trim()))).toBe(false);
    // And the lookup itself is the own-uploads guard.
    expect(calls.find((c) => /FROM pieces\s+WHERE id = \?/.test(c.sql))?.sql).toContain(
      "feed-upload",
    );
  });
});

describe("the desk's left column", () => {
  const draft = (over: Partial<Draft> = {}): Draft =>
    ({
      id: "d1",
      kind: "research",
      body: "",
      meta: { title: "Did the bans lower rents?" },
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cents: 120 },
      status: "draft",
      createdAt: "2026-11-08T10:00:00Z",
      updatedAt: "2026-11-08T10:00:00Z",
      ...over,
    }) as Draft;

  it("lists what is in progress with a status line, and leaves out what is finished", () => {
    const html = renderAdmin(empty, {}, new Map(), {
      drafts: [
        draft(),
        draft({ id: "d2", meta: { title: "Saved one", savedAs: "x" } }),
        draft({
          id: "d3",
          kind: "article",
          meta: { title: "Live one" },
          status: "published",
        }),
        draft({
          id: "d4",
          meta: { title: "Untouched", mode: "thesis" },
          usage: { cents: 0 } as Draft["usage"],
        }),
      ],
    });
    expect(html).toContain('href="/admin/write/d1"');
    expect(html).toContain("Research · in progress · 8 Nov");
    expect(html).toContain("Thesis · not started");
    expect(html).not.toContain("Saved one");
    expect(html).not.toContain("Live one");
    expect(html).toMatch(/In progress <span>2<\/span>/);
  });

  it("says what a read found and what needs you", () => {
    const row = draftRow(draft({ id: "r1", kind: "read", meta: { title: "Read: Whey" } }), {
      kept: 27,
      proposed: 3,
      status: "read",
      dropped: 1,
    } as ReadBadge);
    expect(row.title).toBe("Whey");
    expect(row.status).toBe("Read · 27 kept · 3 need you · 1 dropped · 8 Nov");
    expect(row.finished).toBe(false);
  });

  it("lists the projects, private to Admin", () => {
    const html = renderAdmin(empty);
    expect(html).toMatch(/Projects <span>\d+<\/span>/);
    expect(html).toContain('href="/admin/projects/ancaster"');
  });

  it("has one composer that guesses the kind with the server's rules", () => {
    const html = renderAdmin(empty, {}, new Map(), { drafts: [], engine: "team:flash" });
    expect(html).toContain('action="/op/admin/start" enctype="multipart/form-data"');
    expect(html).toContain('data-kinds="[[&quot;thesis&quot;');
    for (const k of ["research", "article", "read", "thesis"])
      expect(html).toContain(`data-cmp-make="${k}"`);
    expect(html).toContain('<option value="team:flash" selected');
  });

  it("shows this month's spend when it is known", () => {
    const html = renderAdmin(empty, { claude: true }, new Map(), { drafts: [], monthCents: 319 });
    expect(html).toContain("$3.19 in conversations this month");
    // A working page: full-width header, no footer.
    expect(html).toContain('<body class="app">');
    expect(html).toContain('<div class="hd wide">');
    expect(html).not.toContain('<footer class="ft">');
    expect(html).toContain("Claude connected");
  });
});

describe("the composer's route", () => {
  const post = async (fields: Record<string, string>) => {
    const { db, calls } = makeDb();
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    const res = await app.fetch(
      await signedIn("/op/admin/start", { method: "POST", body }),
      envWith(db),
    );
    return { res, calls, to: res.headers.get("location") ?? "" };
  };

  it("asks for something when nothing was typed", async () => {
    const { res, to } = await post({ text: "  " });
    expect(res.status).toBe(303);
    expect(decodeURIComponent(to)).toContain("Type what you want first.");
  });

  it("starts a research conversation with the message waiting", async () => {
    const { to, calls } = await post({ text: "Did the bans lower rents?", engine: "team:flash" });
    expect(to).toMatch(/^\/admin\/write\/[^?]+\?start=1$/);
    const saved = calls.find(
      (c) => /UPDATE drafts/i.test(c.sql) && JSON.stringify(c.args).includes("seed"),
    );
    expect(JSON.stringify(saved?.args)).toContain("Did the bans lower rents?");
  });

  it("a read of a title it cannot find asks which document", async () => {
    const { to } = await post({ text: "Read Nothing By This Name Exists" });
    expect(decodeURIComponent(to)).toContain("Which document?");
  });
});

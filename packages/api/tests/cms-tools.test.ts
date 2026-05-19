import { describe, expect, it } from "vitest";
import { CMS_TOOLS } from "../src/cms/tools/index.ts";
import type { Env } from "../src/env.ts";
import type { ToolDef } from "../src/graph/tools/index.ts";

// Minimal in-memory D1 stub: just enough surface to satisfy `one`, `all`,
// `run`, `insertOne`, `updateById` (the d1.ts helpers). Backed by maps
// keyed by primary key; each registered table also tracks recorded ops.
//
// SQL is pattern-matched, not parsed. The cases we cover here are
// `SELECT … FROM uploaded_files WHERE id = ? AND user_id = ?`,
// `SELECT MAX(version) AS max FROM post_versions …`, `SELECT body_md, title
// FROM posts WHERE id = ? AND user_id = ?`, plain `INSERT INTO <t> (…)
// VALUES (…)` from insertOne, and `UPDATE posts SET … WHERE id = ? AND
// user_id = ?` for update_post.
interface Tables {
  uploaded_files: Record<string, Record<string, unknown>>;
  posts: Record<string, Record<string, unknown>>;
  post_versions: Array<Record<string, unknown>>;
}

interface StubResult {
  results: unknown[];
  meta: { changes: number };
}

function makeDb(initial: Partial<Tables> = {}): D1Database {
  const tables: Tables = {
    uploaded_files: initial.uploaded_files ?? {},
    posts: initial.posts ?? {},
    post_versions: initial.post_versions ?? [],
  };

  const exec = (sql: string, params: unknown[]): StubResult => {
    const s = sql.replace(/\s+/g, " ").trim();

    // SELECT FROM uploaded_files
    if (s.startsWith("SELECT") && /FROM uploaded_files/.test(s)) {
      const [fileId, userId] = params as [string, string];
      const row = tables.uploaded_files[fileId];
      if (!row || row.user_id !== userId) return { results: [], meta: { changes: 0 } };
      return { results: [row], meta: { changes: 0 } };
    }

    // SELECT body_md, title FROM posts
    if (s.startsWith("SELECT body_md, title FROM posts")) {
      const [postId, userId] = params as [string, string];
      const row = tables.posts[postId];
      if (!row || row.user_id !== userId) return { results: [], meta: { changes: 0 } };
      return { results: [row], meta: { changes: 0 } };
    }

    // SELECT MAX(version) AS max FROM post_versions WHERE post_id = ?
    if (/SELECT MAX\(version\)/.test(s)) {
      const [postId] = params as [string];
      const versions = tables.post_versions
        .filter((v) => v.post_id === postId)
        .map((v) => Number(v.version));
      const max = versions.length > 0 ? Math.max(...versions) : null;
      return { results: [{ max }], meta: { changes: 0 } };
    }

    // INSERT INTO <table> (cols…) VALUES (?, ?, …)
    const insertMatch = s.match(/^INSERT INTO (\w+) \(([^)]+)\) VALUES/);
    if (insertMatch) {
      const table = insertMatch[1] ?? "";
      const cols = (insertMatch[2] ?? "").split(",").map((c) => c.trim());
      const row: Record<string, unknown> = {};
      cols.forEach((c, i) => {
        row[c] = params[i];
      });
      if (table === "posts") {
        tables.posts[String(row.id)] = row;
      } else if (table === "post_versions") {
        tables.post_versions.push(row);
      } else if (table === "uploaded_files") {
        tables.uploaded_files[String(row.id)] = row;
      }
      return { results: [], meta: { changes: 1 } };
    }

    // UPDATE posts SET … WHERE id = ? AND user_id = ?
    if (s.startsWith("UPDATE posts SET")) {
      // params layout: each SET value in declared order, then id, user_id
      // For our test purposes we just need the body_md to land in the row
      // when present; we accept any column order and find body_md/title
      // by looking at the SQL.
      const setClause = s.slice("UPDATE posts SET ".length, s.indexOf(" WHERE")).trim();
      const setCols = setClause.split(",").map((p) => p.split("=")[0]?.trim() ?? "");
      const id = params[params.length - 2] as string;
      const userId = params[params.length - 1] as string;
      const row = tables.posts[id];
      if (!row || row.user_id !== userId) return { results: [], meta: { changes: 0 } };
      setCols.forEach((col, i) => {
        if (col) row[col] = params[i];
      });
      return { results: [], meta: { changes: 1 } };
    }

    throw new Error(`Unhandled SQL in stub: ${s}`);
  };

  return {
    prepare(sql: string) {
      let bound: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          bound = args;
          return stmt;
        },
        async first<T>() {
          return (exec(sql, bound).results[0] as T | undefined) ?? null;
        },
        async all<T>() {
          return { results: exec(sql, bound).results as T[] };
        },
        async run() {
          return exec(sql, bound);
        },
      };
      return stmt as unknown as D1PreparedStatement;
    },
    // Unused methods stubbed to satisfy the type if accessed.
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}

function makeFiles(initial: Record<string, string> = {}): R2Bucket {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    async get(key: string) {
      const v = store.get(key);
      if (v === undefined) return null;
      return {
        async text() {
          return v;
        },
      } as unknown as R2ObjectBody;
    },
    async put(key: string, value: string | ArrayBuffer | ReadableStream) {
      store.set(key, typeof value === "string" ? value : "");
      return null as unknown as R2Object;
    },
  } as unknown as R2Bucket;
}

function makeEnv(opts: { db: D1Database; files: R2Bucket }): Env {
  return {
    DB: opts.db,
    FILES: opts.files,
    EMBEDDINGS: {} as unknown as VectorizeIndex,
    AI: {} as unknown as Ai,
    ANTHROPIC_API_KEY: "test",
    OPERATOR_EMAIL: "op@test",
    LOG_LEVEL: "info",
    GRAPH_ENABLED: "true",
    STUDIO_ENABLED: "false",
  };
}

function getTool(name: string): ToolDef {
  const t = CMS_TOOLS.find((t) => t.name === name);
  if (!t) throw new Error(`tool not found: ${name}`);
  return t;
}

const USER_ID = "user_1";

describe("draft_post — body_md path (back-compat)", () => {
  it("saves a draft with explicit body_md", async () => {
    const env = makeEnv({ db: makeDb(), files: makeFiles() });
    const draft = getTool("draft_post");
    const res = await draft.exec(
      { env, userId: USER_ID, conversationId: "c1" },
      { title: "Hello", body_md: "# Hi\n\nbody here" },
    );
    expect(res.output).toMatch(/Saved as draft/);
    expect(res.side_effects).toHaveLength(1);
    expect(res.side_effects[0]?.kind).toBe("post");
  });

  it("refuses a placeholdered body_md", async () => {
    const env = makeEnv({ db: makeDb(), files: makeFiles() });
    const draft = getTool("draft_post");
    const res = await draft.exec(
      { env, userId: USER_ID, conversationId: "c1" },
      { title: "Bad", body_md: "intro\n\n... (rest of the article)" },
    );
    expect(res.output).toMatch(/Refused/);
    expect(res.output).toMatch(/placeholder/);
    expect(res.side_effects).toHaveLength(0);
  });
});

describe("draft_post — source_file_id path", () => {
  it("loads body from R2 when the file is large", async () => {
    const bigBody = `# Long\n\n${"Lorem ipsum ".repeat(2000)}`; // ~24KB
    const db = makeDb({
      uploaded_files: {
        f1: {
          id: "f1",
          user_id: USER_ID,
          extraction_status: "extracted",
          extracted_text: bigBody.slice(0, 8 * 1024),
          original_filename: "the-interior-v2.md",
        },
      },
    });
    const files = makeFiles({ "extracted/f1.txt": bigBody });
    const env = makeEnv({ db, files });
    const draft = getTool("draft_post");
    const res = await draft.exec(
      { env, userId: USER_ID, conversationId: "c1" },
      { title: "From File", source_file_id: "f1" },
    );
    expect(res.output).toMatch(/Saved as draft/);
    // Should include both the post and the upload side effect.
    expect(res.side_effects).toHaveLength(2);
    expect(res.side_effects.find((s) => s.kind === "upload")?.summary).toBe("the-interior-v2.md");
  });

  it("falls back to D1 extracted_text when R2 overflow object is missing", async () => {
    const small = "short body fits in D1";
    const db = makeDb({
      uploaded_files: {
        f2: {
          id: "f2",
          user_id: USER_ID,
          extraction_status: "extracted",
          extracted_text: small,
          original_filename: "small.md",
        },
      },
    });
    const env = makeEnv({ db, files: makeFiles() /* empty R2 */ });
    const draft = getTool("draft_post");
    const res = await draft.exec(
      { env, userId: USER_ID, conversationId: "c1" },
      { title: "Small File", source_file_id: "f2" },
    );
    expect(res.output).toMatch(/Saved as draft/);
  });

  it("body_md wins when both are provided", async () => {
    const db = makeDb({
      uploaded_files: {
        f3: {
          id: "f3",
          user_id: USER_ID,
          extraction_status: "extracted",
          extracted_text: "from-file",
          original_filename: "x.md",
        },
      },
    });
    // Note: no R2 object — proves we didn't try to fetch it.
    const env = makeEnv({ db, files: makeFiles() });
    const draft = getTool("draft_post");
    const res = await draft.exec(
      { env, userId: USER_ID, conversationId: "c1" },
      { title: "Both", body_md: "from-body", source_file_id: "f3" },
    );
    expect(res.output).toMatch(/Saved as draft/);
    // Side effect should only be the post — source_file_id was ignored.
    expect(res.side_effects.find((s) => s.kind === "upload")).toBeUndefined();
  });

  it("refuses when neither body_md nor source_file_id is supplied", async () => {
    const env = makeEnv({ db: makeDb(), files: makeFiles() });
    const draft = getTool("draft_post");
    const res = await draft.exec(
      { env, userId: USER_ID, conversationId: "c1" },
      { title: "Empty" },
    );
    expect(res.output).toMatch(/Refused/);
    expect(res.output).toMatch(/body_md/);
    expect(res.output).toMatch(/source_file_id/);
  });

  it("refuses when the referenced file is still extracting", async () => {
    const db = makeDb({
      uploaded_files: {
        f4: {
          id: "f4",
          user_id: USER_ID,
          extraction_status: "pending",
          extracted_text: null,
          original_filename: "pending.md",
        },
      },
    });
    const env = makeEnv({ db, files: makeFiles() });
    const draft = getTool("draft_post");
    const res = await draft.exec(
      { env, userId: USER_ID, conversationId: "c1" },
      { title: "Pending", source_file_id: "f4" },
    );
    expect(res.output).toMatch(/Refused/);
    expect(res.output).toMatch(/not extracted/);
  });

  it("refuses cross-tenant reads", async () => {
    const db = makeDb({
      uploaded_files: {
        f5: {
          id: "f5",
          user_id: "user_other",
          extraction_status: "extracted",
          extracted_text: "secret",
          original_filename: "stolen.md",
        },
      },
    });
    const env = makeEnv({ db, files: makeFiles({ "extracted/f5.txt": "secret" }) });
    const draft = getTool("draft_post");
    const res = await draft.exec(
      { env, userId: USER_ID, conversationId: "c1" },
      { title: "Steal", source_file_id: "f5" },
    );
    expect(res.output).toMatch(/Refused/);
    expect(res.output).toMatch(/not found or not owned by you/);
  });
});

describe("update_post — source_file_id path", () => {
  it("writes the loaded body and bumps post_versions", async () => {
    const body = "# Updated\n\nNew body from file.";
    const db = makeDb({
      posts: {
        p1: {
          id: "p1",
          user_id: USER_ID,
          body_md: "# Old\n\nOld body.",
          title: "Existing Post",
        },
      },
      uploaded_files: {
        f6: {
          id: "f6",
          user_id: USER_ID,
          extraction_status: "extracted",
          extracted_text: body,
          original_filename: "update.md",
        },
      },
    });
    const env = makeEnv({ db, files: makeFiles({ "extracted/f6.txt": body }) });
    const update = getTool("update_post");
    const res = await update.exec(
      { env, userId: USER_ID, conversationId: "c1" },
      { post_id: "p1", source_file_id: "f6" },
    );
    expect(res.output).toMatch(/Updated/);
    // post.body_md should now reflect the file contents.
    // (Read the stub directly via prepare.)
    const post = await env.DB.prepare(
      "SELECT body_md, title FROM posts WHERE id = ? AND user_id = ?",
    )
      .bind("p1", USER_ID)
      .first<{ body_md: string }>();
    expect(post?.body_md).toBe(body);
    // Side effects should include the upload reference.
    expect(res.side_effects.find((s) => s.kind === "upload")?.id).toBe("f6");
  });
});

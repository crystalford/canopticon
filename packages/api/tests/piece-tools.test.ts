import { describe, expect, it } from "vitest";
import { PIECE_TOOLS } from "../src/cms/tools/pieces.ts";
import type { Env } from "../src/env.ts";
import type { ToolDef } from "../src/graph/tools/index.ts";

// In-memory D1 stub: pattern-matches the queries the piece tools issue.
interface Tables {
  pieces: Record<string, Record<string, unknown>>;
  piece_versions: Array<Record<string, unknown>>;
  topics: Record<string, Record<string, unknown>>;
  topic_pieces: Array<Record<string, unknown>>;
}

function makeDb(initial: Partial<Tables> = {}): D1Database {
  const t: Tables = {
    pieces: initial.pieces ?? {},
    piece_versions: initial.piece_versions ?? [],
    topics: initial.topics ?? {},
    topic_pieces: initial.topic_pieces ?? [],
  };
  const exec = (sql: string, params: unknown[]) => {
    const s = sql.replace(/\s+/g, " ").trim();
    if (s.startsWith("SELECT publication_status AS status, body_md FROM pieces")) {
      const [id] = params;
      const row = t.pieces[String(id)];
      return { results: row ? [{ status: row.publication_status, body_md: row.body_md }] : [] };
    }
    if (s.startsWith("SELECT body_md, title, slug FROM pieces")) {
      const [id] = params;
      const row = t.pieces[String(id)];
      return { results: row ? [row] : [] };
    }
    if (s.startsWith("SELECT MAX(version) AS max FROM piece_versions")) {
      const [id] = params;
      const vs = t.piece_versions.filter((v) => v.piece_id === id).map((v) => Number(v.version));
      return { results: [{ max: vs.length ? Math.max(...vs) : null }] };
    }
    if (s.startsWith("SELECT COUNT(*) AS n FROM topic_pieces")) {
      const [id] = params;
      return { results: [{ n: t.topic_pieces.filter((tp) => tp.piece_id === id).length }] };
    }
    if (s.startsWith("SELECT id, label FROM topics")) {
      const [, slug] = params;
      const found = Object.values(t.topics).find((to) => to.slug === slug);
      return { results: found ? [{ id: found.id, label: found.label }] : [] };
    }
    if (s.startsWith("SELECT 1 AS one FROM topic_pieces")) {
      const [topicId, pieceId] = params;
      const found = t.topic_pieces.find((tp) => tp.topic_id === topicId && tp.piece_id === pieceId);
      return { results: found ? [{ one: 1 }] : [] };
    }
    const ins = s.match(/^INSERT INTO (\w+) \(([^)]+)\) VALUES/);
    if (ins) {
      const table = ins[1] ?? "";
      const cols = (ins[2] ?? "").split(",").map((c) => c.trim());
      const row: Record<string, unknown> = {};
      cols.forEach((c, i) => {
        row[c] = params[i];
      });
      if (table === "pieces") t.pieces[String(row.id)] = row;
      else if (table === "piece_versions") t.piece_versions.push(row);
      else if (table === "topics") t.topics[String(row.id)] = row;
      else if (table === "topic_pieces") t.topic_pieces.push(row);
      return { results: [] };
    }
    if (s.startsWith("UPDATE pieces SET")) {
      const id = params[params.length - 2];
      const row = t.pieces[String(id)];
      if (row) {
        // Apply the values we care about for assertions.
        if (s.includes("publication_status = ?")) row.publication_status = params[0];
      }
      return { results: [] };
    }
    throw new Error(`Unhandled SQL: ${s}`);
  };
  return {
    prepare(sql: string) {
      let bound: unknown[] = [];
      const stmt = {
        bind(...a: unknown[]) {
          bound = a;
          return stmt;
        },
        async first<T>() {
          return (exec(sql, bound).results[0] as T | undefined) ?? null;
        },
        async all<T>() {
          return { results: exec(sql, bound).results as T[] };
        },
        async run() {
          return { ...exec(sql, bound), meta: { changes: 1 } };
        },
      };
      return stmt as unknown as D1PreparedStatement;
    },
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}

function makeEnv(db: D1Database): Env {
  return {
    DB: db,
    FILES: {} as unknown as R2Bucket,
    EMBEDDINGS: {} as unknown as VectorizeIndex,
    AI: {} as unknown as Ai,
    ANTHROPIC_API_KEY: "test",
    OPERATOR_EMAIL: "op@test",
    LOG_LEVEL: "info",
    GRAPH_ENABLED: "true",
    STUDIO_ENABLED: "false",
  };
}

function tool(name: string): ToolDef {
  const t = PIECE_TOOLS.find((x) => x.name === name);
  if (!t) throw new Error(`missing tool ${name}`);
  return t;
}

const USER = "user_1";

describe("piece tools", () => {
  it("draft_piece creates a working-material piece", async () => {
    const db = makeDb();
    const env = makeEnv(db);
    const res = await tool("draft_piece").exec(
      { env, userId: USER, conversationId: "c" },
      {
        title: "Monetary architecture",
        kind: "research-report",
        body_md: "# Body\n\nReal content.",
      },
    );
    expect(res.output).toMatch(/Saved piece/);
    expect(res.output).toMatch(/working material/);
    expect(res.side_effects[0]?.kind).toBe("post");
  });

  it("draft_piece refuses a placeholder body", async () => {
    const env = makeEnv(makeDb());
    const res = await tool("draft_piece").exec(
      { env, userId: USER, conversationId: "c" },
      { title: "Bad", body_md: "intro\n\n... (rest of the article)" },
    );
    expect(res.output).toMatch(/Refused/);
    expect(res.output).toMatch(/placeholder/);
  });

  it("draft_piece refuses with neither body nor file", async () => {
    const env = makeEnv(makeDb());
    const res = await tool("draft_piece").exec(
      { env, userId: USER, conversationId: "c" },
      { title: "Empty" },
    );
    expect(res.output).toMatch(/Refused/);
    expect(res.output).toMatch(/body_md.*source_file_id/);
  });

  it("publish_piece refuses an orphan (no topic)", async () => {
    const db = makeDb({
      pieces: {
        p1: {
          id: "p1",
          user_id: USER,
          title: "Orphan",
          slug: "orphan",
          body_md: "# Orphan",
          publication_status: "working-material",
        },
      },
    });
    const env = makeEnv(db);
    const res = await tool("publish_piece").exec(
      { env, userId: USER, conversationId: "c" },
      { piece_id: "p1" },
    );
    expect(res.output).toMatch(/Refused/);
    expect(res.output).toMatch(/anti-orphan|topic home/i);
  });

  it("file_piece_under_topic then publish_piece succeeds", async () => {
    const db = makeDb({
      pieces: {
        p2: {
          id: "p2",
          user_id: USER,
          title: "Filed",
          slug: "filed",
          body_md: "# Filed\n\nContent.",
          publication_status: "working-material",
        },
      },
    });
    const env = makeEnv(db);
    const fileRes = await tool("file_piece_under_topic").exec(
      { env, userId: USER, conversationId: "c" },
      { piece_id: "p2", topic_slug: "monetary-power", topic_label: "Monetary power" },
    );
    expect(fileRes.output).toMatch(/Filed piece under topic/);

    const pubRes = await tool("publish_piece").exec(
      { env, userId: USER, conversationId: "c" },
      { piece_id: "p2", status: "published" },
    );
    expect(pubRes.output).toMatch(/Published/);
    expect(pubRes.output).toMatch(/\/investigations\/filed/);
  });
});

import { describe, expect, it } from "vitest";
import app from "../src/index.ts";

// Minimal D1 stub that lets the ingest endpoint actually exercise its
// upsert path. Tracks pieces by slug so we can assert idempotency.
function makeDb(): { db: D1Database; pieces: Map<string, Record<string, unknown>> } {
  const pieces = new Map<string, Record<string, unknown>>();
  const exec = (sql: string, params: unknown[]) => {
    const s = sql.replace(/\s+/g, " ").trim();
    // Auth middleware looks up the user by email.
    if (s.startsWith("SELECT id FROM users WHERE email = ?")) {
      return { results: [{ id: "user_1" }] };
    }
    // Auth middleware inserts an audit row on each request.
    if (s.startsWith("INSERT INTO auth_audit")) {
      return { results: [] };
    }
    if (s.startsWith("SELECT id FROM pieces WHERE user_id = ? AND slug = ?")) {
      const [, slug] = params;
      const row = pieces.get(String(slug));
      return { results: row ? [{ id: row.id }] : [] };
    }
    const ins = s.match(/^INSERT INTO (\w+) \(([^)]+)\) VALUES/);
    if (ins && ins[1] === "pieces") {
      const cols = (ins[2] ?? "").split(",").map((c) => c.trim());
      const row: Record<string, unknown> = {};
      cols.forEach((c, i) => {
        row[c] = params[i];
      });
      pieces.set(String(row.slug), row);
      return { results: [] };
    }
    if (s.startsWith("UPDATE pieces SET")) {
      // Force-update path; we don't care about the new values for these tests.
      return { results: [] };
    }
    throw new Error(`Unhandled SQL: ${s}`);
  };
  const db = {
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
  return { db, pieces };
}

const cfHeaders = {
  "cf-access-authenticated-user-email": "op@test",
  "cf-access-jwt-assertion": "test-jwt",
  "content-type": "application/json",
};

describe("/v1/admin/ingest-library", () => {
  it("inserts a fresh report as a working-material piece", async () => {
    const { db, pieces } = makeDb();
    const env = {
      ANTHROPIC_API_KEY: "test",
      LOG_LEVEL: "info",
      OPERATOR_EMAIL: "op@test",
      DB: db,
    };
    const payload = {
      reports: [
        {
          slug: "test-report",
          title: "# A Test Report",
          kind: "research-report",
          body_md: "## Body\n\nReal content for the test.",
          detected_entities: ["Carney"],
        },
      ],
    };
    const res = await app.fetch(
      new Request("http://test/v1/admin/ingest-library", {
        method: "POST",
        headers: cfHeaders,
        body: JSON.stringify(payload),
      }),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { report: { pieces_inserted: number } };
    expect(body.report.pieces_inserted).toBe(1);
    const inserted = pieces.get("test-report");
    expect(inserted).toBeTruthy();
    // Title leading '#' is scrubbed.
    expect(inserted?.title).toBe("A Test Report");
    expect(inserted?.publication_status).toBe("working-material");
  });

  it("is idempotent by slug — re-ingest without force skips", async () => {
    const { db, pieces } = makeDb();
    const env = {
      ANTHROPIC_API_KEY: "test",
      LOG_LEVEL: "info",
      OPERATOR_EMAIL: "op@test",
      DB: db,
    };
    const reports = [
      {
        slug: "duplicate",
        title: "Duplicate Report",
        kind: "research-report",
        body_md: "body",
      },
    ];
    // First insert
    await app.fetch(
      new Request("http://test/v1/admin/ingest-library", {
        method: "POST",
        headers: cfHeaders,
        body: JSON.stringify({ reports }),
      }),
      env,
    );
    expect(pieces.size).toBe(1);
    // Second insert without force
    const res = await app.fetch(
      new Request("http://test/v1/admin/ingest-library", {
        method: "POST",
        headers: cfHeaders,
        body: JSON.stringify({ reports }),
      }),
      env,
    );
    const body = (await res.json()) as {
      report: { pieces_inserted: number; pieces_skipped: number };
    };
    expect(body.report.pieces_inserted).toBe(0);
    expect(body.report.pieces_skipped).toBe(1);
  });

  it("rejects an empty payload", async () => {
    const { db } = makeDb();
    const env = {
      ANTHROPIC_API_KEY: "test",
      LOG_LEVEL: "info",
      OPERATOR_EMAIL: "op@test",
      DB: db,
    };
    const res = await app.fetch(
      new Request("http://test/v1/admin/ingest-library", {
        method: "POST",
        headers: cfHeaders,
        body: JSON.stringify({ reports: [] }),
      }),
      env,
    );
    expect(res.status).toBe(400);
  });

  it("accepts a Cloudflare Access service token (common_name, no email)", async () => {
    const { db } = makeDb();
    const env = {
      ANTHROPIC_API_KEY: "test",
      LOG_LEVEL: "info",
      OPERATOR_EMAIL: "op@test",
      DB: db,
    };
    // A service-token JWT: header.payload.sig, payload carries common_name
    // and no email. Access already verified the signature upstream, so the
    // middleware only base64-decodes the payload.
    const payload = Buffer.from(JSON.stringify({ common_name: "claude-code-bridge" })).toString(
      "base64url",
    );
    const serviceJwt = `eyJhbGciOiJSUzI1NiJ9.${payload}.sig`;
    const res = await app.fetch(
      new Request("http://test/v1/admin/ingest-library", {
        method: "POST",
        headers: {
          // Only the signed JWT — no client-id header. The common_name in
          // the JWT is the trust anchor.
          "cf-access-jwt-assertion": serviceJwt,
          "content-type": "application/json",
        },
        body: JSON.stringify({ reports: [] }),
      }),
      env,
    );
    // Auth passes (resolves to the operator), so we get the 400 from the
    // empty-payload validator — not a 401/403.
    expect(res.status).toBe(400);
  });
});

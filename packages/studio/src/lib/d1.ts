// D1 helpers. Same shape as the Record's, deliberately duplicated rather
// than shared: the two Workers have separate lifecycles and neither should
// be able to break the other by changing a query helper.

export async function one<T>(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const row = await db
    .prepare(sql)
    .bind(...(params as never[]))
    .first<T>();
  return row ?? null;
}

export async function all<T>(db: D1Database, sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await db
    .prepare(sql)
    .bind(...(params as never[]))
    .all<T>();
  return res.results ?? [];
}

export async function run(db: D1Database, sql: string, params: unknown[] = []): Promise<D1Result> {
  return db
    .prepare(sql)
    .bind(...(params as never[]))
    .run();
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export async function sha256Hex(data: ArrayBuffer | string): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// D1 query helpers.
//
// D1 is SQLite. Boolean columns are INTEGER 0/1. JSON columns are TEXT.
// Helpers handle the (de)serialization so route code reads cleanly.

export type Row = Record<string, unknown>;

export async function one<T = Row>(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.first<T>();
  return result ?? null;
}

export async function all<T = Row>(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<T>();
  return result.results ?? [];
}

export async function run(db: D1Database, sql: string, params: unknown[] = []): Promise<D1Result> {
  const stmt = db.prepare(sql).bind(...params);
  return stmt.run();
}

/** Convenience for inserts that need the new id. */
export async function insertOne(
  db: D1Database,
  table: string,
  values: Record<string, unknown>,
): Promise<string> {
  const id = (values.id as string | undefined) ?? crypto.randomUUID();
  const row: Record<string, unknown> = { ...values, id };
  const cols = Object.keys(row);
  const placeholders = cols.map(() => "?").join(", ");
  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`;
  const params = cols.map((c) => serialize(row[c]));
  await run(db, sql, params);
  return id;
}

/** Update by id; returns row count affected. */
export async function updateById(
  db: D1Database,
  table: string,
  id: string,
  values: Record<string, unknown>,
): Promise<number> {
  const cols = Object.keys(values);
  if (cols.length === 0) return 0;
  const set = cols.map((c) => `${c} = ?`).join(", ");
  const sql = `UPDATE ${table} SET ${set}, updated_at = ? WHERE id = ?`;
  const params = [...cols.map((c) => serialize(values[c])), nowIso(), id];
  const result = await run(db, sql, params);
  return result.meta.changes ?? 0;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Convert JS values to D1-friendly primitives.
 *  - booleans → 0/1
 *  - undefined → null
 *  - objects/arrays → JSON string
 */
export function serialize(v: unknown): D1ColumnValue {
  if (v === undefined) return null;
  if (v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "object") return JSON.stringify(v);
  return v as D1ColumnValue;
}

type D1ColumnValue = string | number | null;

/** Parse JSON columns; safe on null/undefined. */
export function parseJson<T = unknown>(s: unknown, fallback: T): T {
  if (s === null || s === undefined || s === "") return fallback;
  if (typeof s !== "string") return s as T;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

/** Convert SQLite 0/1 to JS boolean. */
export function toBool(v: unknown): boolean {
  return v === 1 || v === true || v === "1";
}

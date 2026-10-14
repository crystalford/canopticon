// Drafts and their conversations (migration 0065). One interface, two
// stores: D1 for the site, memory for tests.

import type Anthropic from "@anthropic-ai/sdk";
import type { Env } from "../env";
import { all, one, run } from "../lib/d1";

export interface DraftMeta {
  title?: string;
  dek?: string;
  topic?: string;
  /** "Why I asked": the author's own words, never the model's. */
  why?: string;
  thesis?: string;
  based_on?: string[];
}

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  /** Estimated, in US cents, at the model's list price. */
  cents: number;
}

export interface Draft {
  id: string;
  kind: "article";
  meta: DraftMeta;
  body: string;
  usage: Usage;
  status: "draft" | "published";
  /** The address, fixed at first publish and kept after a take-down. */
  slug?: string;
  /** The system prompt and tools the conversation started with (JSON). */
  frame?: string;
  createdAt: string;
  updatedAt: string;
}

export type Message = Anthropic.Beta.BetaMessageParam;

export interface DraftStore {
  list(): Promise<Draft[]>;
  get(id: string): Promise<Draft | null>;
  create(): Promise<Draft>;
  save(id: string, patch: DraftPatch): Promise<void>;
  messages(id: string): Promise<Message[]>;
  append(id: string, messages: Message[]): Promise<void>;
  /** Claim the draft for one turn; false when a turn is already running. */
  lock(id: string): Promise<boolean>;
  unlock(id: string): Promise<void>;
}

/** A message is stored in rows of at most this many characters (D1 caps a
 *  row at 2MB; a character can take three bytes). */
export const PART_CHARS = 500_000;
/** A turn's claim on a draft lapses after this long. */
const STALE_MS = 20 * 60_000;

export interface DraftPatch {
  meta?: DraftMeta;
  body?: string;
  usage?: Usage;
  status?: Draft["status"];
  slug?: string;
  frame?: string;
}

export const NO_USAGE: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cents: 0 };

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

function parse<T>(s: string | null | undefined, fallback: T): T {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}

interface DraftRow {
  id: string;
  meta: string;
  body_md: string;
  usage: string;
  status: string;
  slug?: string | null;
  frame?: string | null;
  created_at: string;
  updated_at: string;
}

const fromRow = (r: DraftRow): Draft => ({
  id: r.id,
  kind: "article",
  meta: parse<DraftMeta>(r.meta, {}),
  body: r.body_md ?? "",
  usage: { ...NO_USAGE, ...parse<Partial<Usage>>(r.usage, {}) },
  status: r.status === "published" ? "published" : "draft",
  ...(r.slug ? { slug: r.slug } : {}),
  ...(r.frame ? { frame: r.frame } : {}),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export function d1Drafts(env: Env, userId: string): DraftStore {
  const db = env.DB;
  return {
    async list() {
      const rows = await all<DraftRow>(
        db,
        "SELECT * FROM drafts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 200",
        [userId],
      );
      return rows.map(fromRow);
    },
    async get(id) {
      const r = await one<DraftRow>(db, "SELECT * FROM drafts WHERE id = ? AND user_id = ?", [
        id,
        userId,
      ]);
      return r ? fromRow(r) : null;
    },
    async create() {
      const id = newId();
      const t = now();
      await run(
        db,
        "INSERT INTO drafts (id, user_id, kind, meta, body_md, usage, status, created_at, updated_at) VALUES (?, ?, 'article', '{}', '', '{}', 'draft', ?, ?)",
        [id, userId, t, t],
      );
      return {
        id,
        kind: "article",
        meta: {},
        body: "",
        usage: NO_USAGE,
        status: "draft",
        createdAt: t,
        updatedAt: t,
      };
    },
    async save(id, patch) {
      const sets: string[] = [];
      const args: unknown[] = [];
      if (patch.meta) {
        sets.push("meta = ?");
        args.push(JSON.stringify(patch.meta));
      }
      if (patch.body !== undefined) {
        sets.push("body_md = ?");
        args.push(patch.body);
      }
      if (patch.usage) {
        sets.push("usage = ?");
        args.push(JSON.stringify(patch.usage));
      }
      if (patch.status) {
        sets.push("status = ?");
        args.push(patch.status);
      }
      if (patch.slug) {
        sets.push("slug = ?");
        args.push(patch.slug);
      }
      if (patch.frame) {
        sets.push("frame = ?");
        args.push(patch.frame);
      }
      sets.push("updated_at = ?");
      args.push(now(), id, userId);
      await run(db, `UPDATE drafts SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`, args);
    },
    async messages(id) {
      const rows = await all<{ message: string; part: number | null }>(
        db,
        `SELECT m.message, m.part FROM draft_messages m JOIN drafts d ON d.id = m.draft_id
          WHERE m.draft_id = ? AND d.user_id = ? ORDER BY m.seq`,
        [id, userId],
      );
      // A long message spans rows; a row with part > 0 continues the last.
      const joined: string[] = [];
      for (const r of rows) {
        if (r.part && joined.length) joined[joined.length - 1] += r.message;
        else joined.push(r.message);
      }
      return joined.map((m) => JSON.parse(m) as Message);
    },
    async append(id, messages) {
      if (!messages.length) return;
      const last = await one<{ n: number | null }>(
        db,
        "SELECT MAX(seq) AS n FROM draft_messages WHERE draft_id = ?",
        [id],
      );
      let seq = (last?.n ?? -1) + 1;
      const t = now();
      for (const m of messages) {
        const json = JSON.stringify(m);
        for (let part = 0, at = 0; part === 0 || at < json.length; part++, at += PART_CHARS) {
          await run(
            db,
            "INSERT INTO draft_messages (draft_id, seq, message, created_at, part) VALUES (?, ?, ?, ?, ?)",
            [id, seq++, json.slice(at, at + PART_CHARS), t, part],
          );
        }
      }
      await run(db, "UPDATE drafts SET updated_at = ? WHERE id = ? AND user_id = ?", [
        t,
        id,
        userId,
      ]);
    },
    async lock(id) {
      const t = Date.now();
      const r = await run(
        db,
        `UPDATE drafts SET turn_started_at = ? WHERE id = ? AND user_id = ?
           AND (turn_started_at IS NULL OR turn_started_at < ?)`,
        [new Date(t).toISOString(), id, userId, new Date(t - STALE_MS).toISOString()],
      );
      return (r.meta?.changes ?? 0) === 1;
    },
    async unlock(id) {
      await run(db, "UPDATE drafts SET turn_started_at = NULL WHERE id = ? AND user_id = ?", [
        id,
        userId,
      ]);
    },
  };
}

/** For tests: the same contract, in memory. */
export function memoryDrafts(): DraftStore & {
  rows: Map<string, Draft>;
  log: Map<string, Message[]>;
} {
  const rows = new Map<string, Draft>();
  const log = new Map<string, Message[]>();
  const locked = new Set<string>();
  return {
    rows,
    log,
    async list() {
      return [...rows.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async get(id) {
      return rows.get(id) ?? null;
    },
    async create() {
      const t = now();
      const d: Draft = {
        id: newId(),
        kind: "article",
        meta: {},
        body: "",
        usage: NO_USAGE,
        status: "draft",
        createdAt: t,
        updatedAt: t,
      };
      rows.set(d.id, d);
      log.set(d.id, []);
      return d;
    },
    async save(id, patch) {
      const d = rows.get(id);
      if (!d) return;
      rows.set(id, {
        ...d,
        ...(patch.meta ? { meta: patch.meta } : {}),
        ...(patch.body !== undefined ? { body: patch.body } : {}),
        ...(patch.usage ? { usage: patch.usage } : {}),
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.slug ? { slug: patch.slug } : {}),
        ...(patch.frame ? { frame: patch.frame } : {}),
        updatedAt: now(),
      });
    },
    async messages(id) {
      return structuredClone(log.get(id) ?? []);
    },
    async append(id, messages) {
      log.set(id, [...(log.get(id) ?? []), ...structuredClone(messages)]);
    },
    async lock(id) {
      if (locked.has(id)) return false;
      locked.add(id);
      return true;
    },
    async unlock(id) {
      locked.delete(id);
    },
  };
}

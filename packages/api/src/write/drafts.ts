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
  createdAt: string;
  updatedAt: string;
}

export type Message = Anthropic.Beta.BetaMessageParam;

export interface DraftStore {
  list(): Promise<Draft[]>;
  get(id: string): Promise<Draft | null>;
  create(): Promise<Draft>;
  save(id: string, patch: { meta?: DraftMeta; body?: string; usage?: Usage }): Promise<void>;
  messages(id: string): Promise<Message[]>;
  append(id: string, messages: Message[]): Promise<void>;
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
      sets.push("updated_at = ?");
      args.push(now(), id, userId);
      await run(db, `UPDATE drafts SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`, args);
    },
    async messages(id) {
      const rows = await all<{ message: string }>(
        db,
        `SELECT m.message FROM draft_messages m JOIN drafts d ON d.id = m.draft_id
          WHERE m.draft_id = ? AND d.user_id = ? ORDER BY m.seq`,
        [id, userId],
      );
      return rows.map((r) => JSON.parse(r.message) as Message);
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
        await run(
          db,
          "INSERT INTO draft_messages (draft_id, seq, message, created_at) VALUES (?, ?, ?, ?)",
          [id, seq++, JSON.stringify(m), t],
        );
      }
      await run(db, "UPDATE drafts SET updated_at = ? WHERE id = ? AND user_id = ?", [
        t,
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
        updatedAt: now(),
      });
    },
    async messages(id) {
      return structuredClone(log.get(id) ?? []);
    },
    async append(id, messages) {
      log.set(id, [...(log.get(id) ?? []), ...structuredClone(messages)]);
    },
  };
}

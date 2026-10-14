// What Claude proposes for the record from the workspace: a concept (a name
// for a pattern nobody had named), an open problem (something wanted that
// does not exist, and why), or a key figure (a number with its source).
//
// Each proposal is grounded in a passage checked word for word in its
// document. Nothing is public until the author adds it — approving Claude's
// paragraph as written or rewriting it first (ESSAY-CONTRACT §1b–1c: a
// person writes the paragraph). Added entries join the store's concepts,
// problems and figures (setRecordEntries) and the Library, so /concepts/<id>,
// /open/<id>, Ideas and the key-figures list read them like any other.

import type { Env } from "../env";
import { all, one, run } from "../lib/d1";
import type { DerivedRow, Idea, LibraryItem } from "../site/content/store";
import { problems, terms } from "../site/content/store";
import { passageHref } from "../site/md";
import { shortDate } from "../site/theme";
import { slugify } from "./article";
import { verbatimNormal } from "./check";
import { articleTopics } from "./publish";
import { sourceText, sourceTitles } from "./sources";

export type EntryKind = "concept" | "open_problem" | "figure";

export interface EntryData {
  /** Concept: its name. Open problem: the problem in one line. Figure: the
   *  sentence that carries the figure, verbatim. */
  title: string;
  /** Concept: the definition. Open problem: the statement. Figure: the
   *  figure as the source writes it. */
  body: string;
  doc: string;
  section: string;
  /** The grounding passage, word for word from `doc`. */
  quote: string;
  topic: string;
  /** Set when the author rewrote Claude's paragraph before adding it. */
  edited?: boolean;
}

export interface Entry {
  id: string;
  kind: EntryKind;
  slug?: string;
  data: EntryData;
  status: "proposed" | "added" | "dismissed";
  draftId?: string;
  toolUseId?: string;
  createdAt: string;
  decidedAt?: string;
}

export interface EntryStore {
  create(e: Omit<Entry, "id" | "createdAt" | "status">): Promise<Entry>;
  get(id: string): Promise<Entry | null>;
  forDraft(draftId: string): Promise<Entry[]>;
  added(): Promise<Entry[]>;
  decide(
    id: string,
    patch: { status: Entry["status"]; data?: EntryData; slug?: string },
  ): Promise<void>;
  slugTaken(slug: string, kind: EntryKind): Promise<boolean>;
}

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

interface Row {
  id: string;
  kind: string;
  slug: string | null;
  data: string;
  status: string;
  draft_id: string | null;
  tool_use_id: string | null;
  created_at: string;
  decided_at: string | null;
}

const fromRow = (r: Row): Entry => ({
  id: r.id,
  kind: r.kind as EntryKind,
  ...(r.slug ? { slug: r.slug } : {}),
  data: JSON.parse(r.data) as EntryData,
  status: r.status === "added" ? "added" : r.status === "dismissed" ? "dismissed" : "proposed",
  ...(r.draft_id ? { draftId: r.draft_id } : {}),
  ...(r.tool_use_id ? { toolUseId: r.tool_use_id } : {}),
  createdAt: r.created_at,
  ...(r.decided_at ? { decidedAt: r.decided_at } : {}),
});

export function d1Entries(env: Env, userId: string): EntryStore {
  const db = env.DB;
  return {
    async create(e) {
      const entry: Entry = { ...e, id: newId(), createdAt: now(), status: "proposed" };
      await run(
        db,
        "INSERT INTO record_entries (id, user_id, draft_id, tool_use_id, kind, data, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'proposed', ?)",
        [
          entry.id,
          userId,
          e.draftId ?? null,
          e.toolUseId ?? null,
          e.kind,
          JSON.stringify(e.data),
          entry.createdAt,
        ],
      );
      return entry;
    },
    async get(id) {
      const r = await one<Row>(db, "SELECT * FROM record_entries WHERE id = ? AND user_id = ?", [
        id,
        userId,
      ]);
      return r ? fromRow(r) : null;
    },
    async forDraft(draftId) {
      const rows = await all<Row>(
        db,
        "SELECT * FROM record_entries WHERE draft_id = ? AND user_id = ? ORDER BY created_at",
        [draftId, userId],
      ).catch(() => [] as Row[]);
      return rows.map(fromRow);
    },
    async added() {
      const rows = await all<Row>(
        db,
        "SELECT * FROM record_entries WHERE user_id = ? AND status = 'added' ORDER BY decided_at DESC",
        [userId],
      ).catch(() => [] as Row[]);
      return rows.map(fromRow);
    },
    async decide(id, patch) {
      await run(
        db,
        `UPDATE record_entries SET status = ?, decided_at = ?${patch.data ? ", data = ?" : ""}${patch.slug ? ", slug = ?" : ""}
          WHERE id = ? AND user_id = ?`,
        [
          patch.status,
          now(),
          ...(patch.data ? [JSON.stringify(patch.data)] : []),
          ...(patch.slug ? [patch.slug] : []),
          id,
          userId,
        ],
      );
    },
    async slugTaken(slug, kind) {
      const r = await one<{ id: string }>(
        db,
        "SELECT id FROM record_entries WHERE slug = ? AND kind = ? AND user_id = ?",
        [slug, kind, userId],
      ).catch(() => null);
      return !!r;
    },
  };
}

/** For tests: the same contract, in memory. */
export function memoryEntries(): EntryStore & { rows: Map<string, Entry> } {
  const rows = new Map<string, Entry>();
  return {
    rows,
    async create(e) {
      const entry: Entry = { ...e, id: newId(), createdAt: now(), status: "proposed" };
      rows.set(entry.id, entry);
      return entry;
    },
    async get(id) {
      return rows.get(id) ?? null;
    },
    async forDraft(draftId) {
      return [...rows.values()].filter((e) => e.draftId === draftId);
    },
    async added() {
      return [...rows.values()].filter((e) => e.status === "added");
    },
    async decide(id, patch) {
      const e = rows.get(id);
      if (!e) return;
      rows.set(id, {
        ...e,
        status: patch.status,
        decidedAt: now(),
        ...(patch.data ? { data: patch.data } : {}),
        ...(patch.slug ? { slug: patch.slug } : {}),
      });
    },
    async slugTaken(slug, kind) {
      return [...rows.values()].some((e) => e.slug === slug && e.kind === kind);
    },
  };
}

// ---- checking a proposal ------------------------------------------------------

/** Why a proposal cannot stand; empty when it can. */
export async function proposalProblems(env: Env, kind: EntryKind, d: EntryData): Promise<string[]> {
  const p: string[] = [];
  const text = await sourceText(env, d.doc);
  if (text == null) p.push(`"${d.doc}" is not a document you can quote.`);
  else if (!verbatimNormal(text).includes(verbatimNormal(d.quote)))
    p.push("The quote is not word for word in the document. Copy it exactly from read_document.");
  if (!articleTopics().includes(d.topic))
    p.push(`The topic must be one of: ${articleTopics().join("; ")}.`);
  if (kind === "figure") {
    if (!d.quote.includes(d.body))
      p.push("The figure must appear, as written, inside the quoted sentence.");
  } else {
    if (!d.title.trim() || d.title.length > 140) p.push("Give a title of at most 140 characters.");
    if (!d.body.trim()) p.push("Write the paragraph.");
    const list = kind === "concept" ? terms() : problems();
    if (list.some((i) => i.title.toLowerCase() === d.title.trim().toLowerCase()))
      p.push("That is already in the record.");
  }
  return p;
}

const ROUTE: Record<Exclude<EntryKind, "figure">, string> = {
  concept: "/concepts/",
  open_problem: "/open/",
};

/** Add a proposal to the record, as written or as the author rewrote it. */
export async function addEntry(
  env: Env,
  store: EntryStore,
  id: string,
  edits: { title?: string; body?: string },
): Promise<{ ok: true; route: string } | { ok: false; problems: string[] }> {
  const e = await store.get(id);
  if (!e) return { ok: false, problems: ["That proposal does not exist."] };
  if (e.status === "added") return { ok: true, route: entryRoute(e) };
  const title = e.kind === "figure" ? e.data.title : (edits.title ?? e.data.title).trim();
  const body = e.kind === "figure" ? e.data.body : (edits.body ?? e.data.body).trim();
  const data: EntryData = {
    ...e.data,
    title,
    body,
    ...(title !== e.data.title || body !== e.data.body ? { edited: true } : {}),
  };
  const issues = await proposalProblems(env, e.kind, data);
  if (issues.length) return { ok: false, problems: issues };
  let slug: string | undefined;
  if (e.kind !== "figure") {
    const base = slugify(title);
    const existing = new Set((e.kind === "concept" ? terms() : problems()).map((i) => i.id));
    for (let n = 1; n < 50 && !slug; n++) {
      const s = n === 1 ? base : `${base}-${n}`;
      if (!existing.has(s) && !(await store.slugTaken(s, e.kind))) slug = s;
    }
  }
  await store.decide(id, { status: "added", data, ...(slug ? { slug } : {}) });
  return { ok: true, route: entryRoute({ ...e, data, ...(slug ? { slug } : {}) }) };
}

export function entryRoute(e: Pick<Entry, "kind" | "slug" | "data">): string {
  if (e.kind === "figure") return passageHref(e.data.doc, e.data.quote);
  return `${ROUTE[e.kind]}${e.slug ?? ""}`;
}

// ---- what the site shows -------------------------------------------------------

/** Added entries as the store's concepts, problems, figures and Library rows. */
export async function entryOverlay(env: Env, entries: Entry[]) {
  const titles = await sourceTitles(
    env,
    entries.map((e) => e.data.doc),
  );
  const out = {
    terms: [] as Idea[],
    problems: [] as Idea[],
    figures: [] as DerivedRow[],
    rows: [] as LibraryItem[],
  };
  for (const e of entries) {
    if (e.status !== "added") continue;
    const date = (e.decidedAt ?? e.createdAt).slice(0, 10);
    const from = titles.get(e.data.doc) ?? e.data.doc;
    const docRoute = passageHref(e.data.doc, e.data.quote);
    if (e.kind === "figure") {
      out.figures.push({
        route: docRoute,
        kind: "Figure",
        topic: e.data.topic,
        date,
        dateLabel: shortDate(date),
        title: e.data.title,
        dek: from,
        v: e.data.body,
      });
      continue;
    }
    if (!e.slug) continue;
    const route = entryRoute(e);
    const concept = e.kind === "concept";
    out[concept ? "terms" : "problems"].push({
      id: e.slug,
      kick: e.data.topic.toLowerCase(),
      title: e.data.title,
      body: e.data.body,
      foot: concept
        ? `proposed ${shortDate(date)} · name check pending`
        : `${shortDate(date)} · from ${from}`,
      from,
      route,
      docRoute,
    });
    out.rows.push({
      route,
      kind: concept ? "Concept" : "Open problem",
      topic: e.data.topic,
      date,
      dateLabel: shortDate(date),
      title: e.data.title,
      dek: e.data.body.length > 240 ? `${e.data.body.slice(0, 239).trimEnd()}…` : e.data.body,
      stat: concept ? "name check pending" : "open",
    });
  }
  return out;
}

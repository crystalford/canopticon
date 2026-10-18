// What the workspace may read and quote: the public research documents in
// the content store, and the operator's own Admin uploads that are published
// or waiting (OWN_UPLOADS_SQL). Never a held document, never one kept
// private, never someone else's page: a quote in an article is public, so
// its source must be something that can be public.
//
// A document's id is the id its quotes name (<q doc="id">) and the address
// it lives at (/p/<id>). Where an upload and the store share an id, the
// store's text is the one the site shows, so it is the one quoted.

import { OWN_UPLOADS_SQL } from "../admin/runtime";
import type { Env } from "../env";
import { all, one } from "../lib/d1";
import { resolveOperatorId } from "../public/data";
import {
  allArticles,
  allPapers,
  article,
  paper,
  publicResearch,
  researchDoc,
} from "../site/content/store";
import { searchTerms } from "../site/pages/search";

export interface Source {
  id: string;
  title: string;
  topic: string;
  kind: string;
  date: string;
  chars: number;
  /** "record" is the content store; an upload is "published" or "waiting". */
  status: "record" | "published" | "waiting";
}

// A waiting upload sorted as personal (the author's health, a first-person
// note) is never offered to Claude: it was held private for a reason.
const UPLOAD_WHERE = `user_id = ? AND ${OWN_UPLOADS_SQL}
  AND (publication_status IN ('published', 'canonical')
       OR (COALESCE(json_extract(metadata, '$.admin_status'), json_extract(metadata, '$.desk')) = 'waiting'
           AND COALESCE(json_extract(metadata, '$.sorted_as'), '') <> 'personal'))`;

interface UploadRow {
  slug: string;
  title: string;
  created_at: string;
  publication_status: string;
  chars: number;
  topic: string | null;
}

function fromStore(): Source[] {
  return publicResearch().map((d) => ({
    id: d.id,
    title: d.title.replace(/^#\s*/, ""),
    topic: d.topic,
    kind: d.kind,
    date: d.date,
    chars: d.body.length,
    status: "record" as const,
  }));
}

async function uploads(env: Env): Promise<Source[]> {
  const userId = await resolveOperatorId(env.DB).catch(() => null);
  if (!userId) return [];
  const rows = await all<UploadRow>(
    env.DB,
    `SELECT slug, title, created_at, publication_status, COALESCE(length(body_md), 0) AS chars,
            json_extract(metadata, '$.library_topic') AS topic
       FROM pieces WHERE ${UPLOAD_WHERE} ORDER BY created_at DESC LIMIT 500`,
    [userId],
  ).catch(() => [] as UploadRow[]);
  return rows
    .filter((r) => !researchDoc(r.slug))
    .map((r) => ({
      id: r.slug,
      title: r.title,
      topic: r.topic ?? "",
      kind: "Upload",
      date: (r.created_at ?? "").slice(0, 10),
      chars: r.chars,
      status:
        r.publication_status === "working-material" ? ("waiting" as const) : ("published" as const),
    }));
}

/** Every document the draft may quote: uploads first (newest), then the record. */
export async function listSources(env: Env): Promise<Source[]> {
  const store = fromStore().sort((a, b) => b.date.localeCompare(a.date));
  return [...(await uploads(env)), ...store];
}

async function uploadText(env: Env, id: string): Promise<string | null> {
  const userId = await resolveOperatorId(env.DB).catch(() => null);
  if (!userId) return null;
  const row = await one<{ body_md: string | null }>(
    env.DB,
    `SELECT body_md FROM pieces WHERE slug = ? AND ${UPLOAD_WHERE}`,
    [id, userId],
  ).catch(() => null);
  return row?.body_md ?? null;
}

/** A document's full text, or null if it is not one the draft may quote. */
export async function sourceText(env: Env, id: string): Promise<string | null> {
  const doc = researchDoc(id);
  if (doc) return doc.body;
  return uploadText(env, id);
}

/** Texts for every id a draft quotes, for the verbatim check. */
export async function sourceTexts(env: Env, ids: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  for (const id of new Set(ids)) out.set(id, await sourceText(env, id));
  return out;
}

export interface SearchHit {
  source: Source;
  snippets: string[];
}

const lower = (s: string) => s.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

/** Documents that contain every term (or, failing that, any term), best
 *  first, each with up to two short passages around the first term. */
export async function searchSources(env: Env, query: string, limit = 10): Promise<SearchHit[]> {
  const terms = searchTerms(query);
  if (!terms.length) return [];
  const sources = await listSources(env);
  const scored: Array<{ source: Source; text: string; score: number; all: boolean }> = [];
  for (const source of sources) {
    const text = (await sourceText(env, source.id)) ?? "";
    const lc = lower(text);
    const title = lower(source.title);
    let score = 0;
    let matched = 0;
    for (const t of terms) {
      let n = 0;
      for (let i = lc.indexOf(t); i !== -1 && n < 50; i = lc.indexOf(t, i + t.length)) n++;
      if (n || title.includes(t)) matched++;
      score += n + (title.includes(t) ? 10 : 0);
    }
    if (matched) scored.push({ source, text, score, all: matched === terms.length });
  }
  const pool = scored.some((s) => s.all) ? scored.filter((s) => s.all) : scored;
  return pool
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ source, text }) => {
      const lc = lower(text);
      const first = terms.find((t) => lc.includes(t)) ?? "";
      const snippets: string[] = [];
      for (let i = lc.indexOf(first); i !== -1 && first && snippets.length < 2; ) {
        const from = Math.max(0, i - 160);
        snippets.push(
          text
            .slice(from, i + first.length + 160)
            .replace(/\s+/g, " ")
            .trim(),
        );
        i = lc.indexOf(first, i + 400);
      }
      return { source, snippets };
    });
}

/** A source's title by id, for the preview's receipts. */
export async function sourceTitles(env: Env, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const want = new Set(ids);
  if (!want.size) return out;
  for (const s of await listSources(env)) if (want.has(s.id)) out.set(s.id, s.title);
  return out;
}

// ---- the author's own writing: read, never quoted ---------------------------------
//
// The articles and papers Chris has published. Claude may list, search and
// read them — to know what is already written and to build on it — but they
// are not sources: a quotation must come from a research document, and the
// verbatim check (sourceTexts above) never returns their text, so a <q> that
// names one fails.

export interface OwnWriting {
  id: string;
  title: string;
  kind: "Article" | "Paper";
  topic: string;
  date: string;
  route: string;
}

export function ownWriting(): OwnWriting[] {
  const articles = allArticles()
    .filter((a) => !a.withdrawn)
    .map((a) => ({
      id: a.slug,
      title: a.title,
      kind: "Article" as const,
      topic: a.topic,
      date: a.date,
      route: `/articles/${a.slug}`,
    }));
  const papers = allPapers().map((p) => ({
    id: p.slug,
    title: p.title,
    kind: "Paper" as const,
    topic: p.topic ?? "",
    date: p.date ?? "",
    route: `/articles/${p.slug}`,
  }));
  return [...articles, ...papers].sort((a, b) => b.date.localeCompare(a.date));
}

/** An article's or paper's text, for reading only. */
export function ownWritingText(
  id: string,
): { title: string; kind: string; route: string; text: string } | null {
  const a = article(id);
  if (a && !a.withdrawn)
    return { title: a.title, kind: "Article", route: `/articles/${id}`, text: a.body };
  const p = paper(id);
  if (p) return { title: p.title, kind: "Paper", route: `/articles/${id}`, text: p.body };
  return null;
}

/** The author's articles and papers that contain every term, each with a passage. */
export function searchOwnWriting(
  query: string,
  limit = 5,
): Array<{ item: OwnWriting; snippet: string }> {
  const terms = searchTerms(query);
  if (!terms.length) return [];
  const out: Array<{ item: OwnWriting; snippet: string; score: number }> = [];
  for (const item of ownWriting()) {
    const text = ownWritingText(item.id)?.text ?? "";
    const lc = lower(`${item.title}\n${text}`);
    if (!terms.every((t) => lc.includes(t))) continue;
    const at = lower(text).indexOf(terms[0] ?? "");
    const snippet =
      at >= 0
        ? text
            .slice(Math.max(0, at - 160), at + 200)
            .replace(/\s+/g, " ")
            .trim()
        : "";
    out.push({ item, snippet, score: terms.reduce((n, t) => n + lc.split(t).length - 1, 0) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

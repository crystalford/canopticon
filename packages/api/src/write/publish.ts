// Publish from the workspace: one button, the same gates as the build.
//
// A draft publishes only when every quotation is word for word in its
// document (check.ts, the build's rule) and every document it quotes or
// names is itself public — a receipt must land on a page a reader can open.
// Publishing copies the draft into a new row of published_versions (migration
// 0066); nothing is overwritten, and the site shows the latest version of
// each published article. Editing the draft afterwards changes nothing live
// until Update. Take down sets the draft back to 'draft' and keeps the
// address and every version.

import { OWN_UPLOADS_SQL } from "../admin/runtime";
import type { Env } from "../env";
import { all, one, run } from "../lib/d1";
import { pingIndexNow } from "../lib/indexnow";
import {
  type Article,
  type LibraryItem,
  allPapers,
  article,
  libraryItems,
  researchDoc,
} from "../site/content/store";
import { articleQuotes } from "../site/md";
import { shortDate } from "../site/theme";
import { draftArticle, slugify } from "./article";
import { checkQuotes, draftQuotes } from "./check";
import type { Draft, DraftMeta, DraftStore } from "./drafts";
import { sourceTexts, sourceTitles } from "./sources";

/** The topics an article may be filed under: the ones the record uses. */
export function articleTopics(): string[] {
  return [
    ...new Set(
      libraryItems()
        .map((r) => r.topic)
        .filter((t) => t && t !== "Other"),
    ),
  ].sort();
}

/** Ids among `ids` a reader can open: public research, or the operator's own
 *  published uploads. A waiting upload is not public yet. */
async function publicIds(env: Env, userId: string, ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const rest: string[] = [];
  for (const id of new Set(ids)) researchDoc(id) ? out.add(id) : rest.push(id);
  for (const id of rest) {
    const row = await one<{ slug: string }>(
      env.DB,
      `SELECT slug FROM pieces WHERE slug = ? AND user_id = ? AND ${OWN_UPLOADS_SQL}
         AND publication_status IN ('published', 'canonical')`,
      [id, userId],
    ).catch(() => null);
    if (row) out.add(id);
  }
  return out;
}

/** Why a draft cannot be published, in plain words; empty when it can. */
export async function publishProblems(env: Env, userId: string, d: Draft): Promise<string[]> {
  const problems: string[] = [];
  if (!d.meta.title?.trim()) problems.push("It has no title.");
  if (!d.body.trim()) problems.push("It has no body.");
  if (!d.meta.topic || !articleTopics().includes(d.meta.topic))
    problems.push("Its topic is not one of the record's topics.");
  const quotes = draftQuotes(d.body);
  if (!quotes.length) problems.push("It quotes nothing: an article argues from the record.");
  const ids = [...quotes.map((q) => q.doc), ...(d.meta.based_on ?? [])];
  const failed = checkQuotes(d.body, await sourceTexts(env, ids)).failed.length;
  if (failed)
    problems.push(
      `${failed} ${failed === 1 ? "quotation is" : "quotations are"} not word for word.`,
    );
  const open = await publicIds(env, userId, ids);
  const closed = [...new Set(ids)].filter((id) => !open.has(id));
  if (closed.length) {
    const titles = await sourceTitles(env, closed);
    problems.push(
      `It quotes or names ${closed.length === 1 ? "a document" : "documents"} not yet public: ${closed
        .map((id) => titles.get(id) ?? id)
        .join("; ")}. Publish ${closed.length === 1 ? "it" : "them"} in Admin first.`,
    );
  }
  return problems;
}

/** A free address for a new article: not a stored article or paper, not
 *  another draft's. */
async function freeSlug(env: Env, userId: string, title: string, draftId: string): Promise<string> {
  const base = slugify(title);
  const papers = new Set(allPapers().map((p) => p.slug));
  for (let n = 1; n < 50; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (article(slug) || papers.has(slug)) continue;
    const taken = await one<{ id: string }>(
      env.DB,
      "SELECT id FROM drafts WHERE slug = ? AND user_id = ? AND id != ?",
      [slug, userId, draftId],
    ).catch(() => null);
    if (!taken) return slug;
  }
  return `${base}-${draftId.slice(0, 6)}`;
}

export interface LiveVersion {
  slug: string;
  version: number;
  meta: DraftMeta;
  body: string;
  publishedAt: string;
  firstPublishedAt: string;
}

/** The latest published version of a draft, if it was ever published. */
export async function latestVersion(
  env: Env,
  userId: string,
  draftId: string,
): Promise<LiveVersion | null> {
  const r = await one<{
    slug: string;
    version: number;
    meta: string;
    body_md: string;
    published_at: string;
    first_at: string;
  }>(
    env.DB,
    `SELECT v.slug, v.version, v.meta, v.body_md, v.published_at,
            (SELECT MIN(f.published_at) FROM published_versions f WHERE f.slug = v.slug) AS first_at
       FROM published_versions v
      WHERE v.draft_id = ? AND v.user_id = ?
      ORDER BY v.version DESC LIMIT 1`,
    [draftId, userId],
  ).catch(() => null);
  if (!r) return null;
  return {
    slug: r.slug,
    version: r.version,
    meta: JSON.parse(r.meta) as DraftMeta,
    body: r.body_md,
    publishedAt: r.published_at,
    firstPublishedAt: r.first_at,
  };
}

/** Whether the draft has changed since the version that is live. */
export const changedSince = (d: Draft, v: LiveVersion): boolean =>
  v.body !== d.body || JSON.stringify(v.meta) !== JSON.stringify(d.meta);

export type PublishResult =
  | { ok: true; slug: string; version: number }
  | { ok: false; problems: string[] };

export async function publishDraft(
  env: Env,
  userId: string,
  store: DraftStore,
  draftId: string,
): Promise<PublishResult> {
  const d = await store.get(draftId);
  if (!d) return { ok: false, problems: ["That draft does not exist."] };
  const problems = await publishProblems(env, userId, d);
  if (problems.length) return { ok: false, problems };
  const slug = d.slug ?? (await freeSlug(env, userId, d.meta.title ?? "", d.id));
  const last = await one<{ n: number | null }>(
    env.DB,
    "SELECT MAX(version) AS n FROM published_versions WHERE slug = ?",
    [slug],
  );
  const version = (last?.n ?? 0) + 1;
  await run(
    env.DB,
    "INSERT INTO published_versions (slug, version, draft_id, user_id, meta, body_md, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [slug, version, d.id, userId, JSON.stringify(d.meta), d.body, new Date().toISOString()],
  );
  await store.save(d.id, { status: "published", slug });
  return { ok: true, slug, version };
}

export async function takeDown(store: DraftStore, draftId: string): Promise<void> {
  await store.save(draftId, { status: "draft" });
}

/** Tell the search engines; never blocks the publish. */
export function announce(env: Env, slug: string): Promise<unknown> {
  return pingIndexNow(env, [`/articles/${slug}`, "/library", "/sitemap.xml"]).catch(() => null);
}

// ---- what the site shows -------------------------------------------------------

/** Every live workspace article, latest version each, as the store's Article
 *  and Library row. Read by site/uploads.ts into the store overlay. */
export async function liveArticles(
  env: Env,
  userId: string,
): Promise<Array<{ article: Article; row: LibraryItem }>> {
  const rows = await all<{
    slug: string;
    meta: string;
    body_md: string;
    first_at: string;
    published_at: string;
  }>(
    env.DB,
    `SELECT v.slug, v.meta, v.body_md, v.published_at,
            (SELECT MIN(f.published_at) FROM published_versions f WHERE f.slug = v.slug) AS first_at
       FROM published_versions v
       JOIN drafts d ON d.id = v.draft_id AND d.user_id = v.user_id
      WHERE v.user_id = ? AND d.status = 'published'
        AND v.version = (SELECT MAX(w.version) FROM published_versions w WHERE w.slug = v.slug)
      ORDER BY first_at DESC`,
    [userId],
  ).catch(() => []);
  const out: Array<{ article: Article; row: LibraryItem }> = [];
  for (const r of rows) {
    const meta = JSON.parse(r.meta) as DraftMeta;
    const titles = await sourceTitles(env, meta.based_on ?? []);
    const date = (r.first_at ?? r.published_at).slice(0, 10);
    const a: Article = {
      ...draftArticle(
        {
          id: r.slug,
          kind: "article",
          meta,
          body: r.body_md,
          usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cents: 0 },
          status: "published",
          createdAt: "",
          updatedAt: "",
        },
        titles,
      ),
      slug: r.slug,
      date,
      cite: `Telford, C. (${date.slice(0, 4)}). ${meta.title}. Canopticon. canopticon.com/articles/${r.slug}`,
    };
    const quotes = articleQuotes(a.body).length;
    const sources = new Set(articleQuotes(a.body).map((q) => q.doc)).size;
    const min = Math.max(1, Math.round((a.words ?? 0) / 200));
    out.push({
      article: a,
      row: {
        route: `/articles/${r.slug}`,
        kind: "Article",
        topic: a.topic,
        date,
        dateLabel: shortDate(date),
        title: a.title,
        dek: a.dek,
        stat: `${quotes} quotes · ${sources} ${sources === 1 ? "source" : "sources"} · ${min} min`,
        min,
        quotes,
        sources,
        own: 0,
        coined: 0,
      },
    });
  }
  return out;
}

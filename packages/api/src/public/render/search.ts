// Search — semantic search over the corpus (spec v2.6 Part 18 #6).
//
// Uses the existing Vectorize index (canopticon-embeddings, 1024-dim
// cosine) that already holds embeddings for entities, claims, pieces,
// theses, sources, and signed readings. The query embeds via Workers AI
// bge-large-en-v1.5 (same model used at upsert time) and queries
// Vectorize for the top matches.
//
// Results are resolved to public URLs by kind:
//   entity  → /s/<slug>          (Record page)
//   claim   → /s/<slug>#claim    (host page anchor)
//   piece   → /library/<slug>    (source document)
//   thesis  → /s/<slug>?mode=signed
//   article → /investigations/<slug>
//   source  → /q/<id>            (quote receipt)
//
// Empty query renders the search shell with no results panel — same URL
// for results and empty state so `/search?q=` is a valid landing.

import type { Env } from "../../env";
import { getAnswerPreview } from "../../graph/lib/answers-preview";
import { type VectorMeta, searchVectors } from "../../graph/lib/embeddings";
import { insertOne, one } from "../../lib/d1";
import { resolveOperatorId } from "../data";
import { escapeAttr, escapeHtml, renderPage } from "../layout";
import { renderExpandBanner } from "./subject-page";

interface ResolvedHit {
  url: string;
  kind: VectorMeta["kind"];
  title: string;
  snippet: string;
  score: number;
}

const KIND_LABEL: Record<VectorMeta["kind"], string> = {
  entity: "File",
  claim: "Claim",
  piece: "Source document",
  thesis: "Reading",
  article: "Investigation",
  source: "Quote",
};

export async function renderSearchPage(
  env: Env,
  q: string,
  opts: { isOperator?: boolean; researching?: boolean } = {},
): Promise<string> {
  const query = q.trim();
  const userId = await resolveOperatorId(env.DB);
  let resultsBlock = "";
  let summary = "";
  // Whether to keep auto-refreshing. Only true while research is genuinely
  // still in flight — without a terminal check this refreshed forever
  // (every 5s, indefinitely) even after the expansion finished, because
  // `researching=1` stayed in the URL across every reload. Mirrors the
  // terminal-state check bulk-expand.ts already does for the same reason.
  let keepPolling = false;

  if (query.length > 0 && userId) {
    const hits = await searchVectors(env, { query, userId, topK: 25 }).catch(() => []);
    const resolved = await resolveHits(env, hits);
    if (resolved.length === 0) {
      // A real miss — log it (cheap; feeds the future "what readers are
      // asking for" research signal) and, if configured, show a fast
      // AI-generated preview. That preview is Brave's own synthesis, not a
      // quote from any stored document, so it can never become a fact —
      // it's shown clearly labeled, purely to help decide whether the
      // question is worth real (verified) research.
      await insertOne(env.DB, "orchestrator_events", {
        user_id: userId,
        event_type: "search.miss",
        subject_kind: "search",
        subject_id: null,
        payload: JSON.stringify({ query }),
      }).catch(() => {});

      summary = `No matches for <b>${escapeHtml(query)}</b> in the record yet.`;
      if (opts.researching) {
        resultsBlock = await renderExpandBanner(env, userId, query);
        keepPolling = !(await isExpandTerminal(env.DB, userId, query));
      } else {
        resultsBlock = `<div class="search-empty">Try a different phrasing, or check <a href="/topics">Topics</a> for browsable doorways.</div>`;
      }

      const preview =
        env.BRAVE_ANSWERS_API_KEY && !opts.researching
          ? await getAnswerPreview(env, query).catch(() => null)
          : null;
      if (preview) {
        const researchForm = opts.isOperator
          ? `<form class="search-research-form" method="POST" action="/op/search/research">
               <input type="hidden" name="q" value="${escapeAttr(query)}">
               <button class="search-research-go" type="submit">Research this for real →</button>
             </form>`
          : "";
        resultsBlock += `<div class="search-preview">
  <div class="search-preview-label">AI-generated preview — not verified against any stored document. Not a fact.</div>
  <div class="search-preview-body">${escapeHtml(preview).replace(/\n/g, "<br>")}</div>
  ${researchForm}
</div>`;
      }
    } else {
      summary = `<b>${resolved.length}</b> matches for <b>${escapeHtml(query)}</b>.`;
      resultsBlock = `<ol class="search-hits">${resolved
        .map(
          (h) => `<li class="search-hit">
  <a class="search-link" href="${escapeAttr(h.url)}">
    <span class="search-kind">${escapeHtml(KIND_LABEL[h.kind] ?? h.kind)}</span>
    <span class="search-title">${escapeHtml(h.title)}</span>
  </a>
  ${h.snippet ? `<div class="search-snippet">${escapeHtml(h.snippet)}</div>` : ""}
  <div class="search-score">${(h.score * 100).toFixed(1)}% match</div>
</li>`,
        )
        .join("")}</ol>`;
    }
  } else if (query.length === 0) {
    summary = "Phrase queries work as well as keywords.";
    resultsBlock = "";
  } else {
    summary = "The record is empty so far.";
    resultsBlock = "";
  }

  const body = `${keepPolling ? '<meta http-equiv="refresh" content="5">' : ""}
<section class="search-section">
  <h1 class="search-h1">Ask the record</h1>
  <form class="search-form" method="GET" action="/search">
    <input
      class="search-input"
      type="search"
      name="q"
      value="${escapeAttr(query)}"
      placeholder="A subject, a claim, a phrase…"
      autofocus
    >
    <button class="search-go" type="submit">Search</button>
  </form>
  <div class="search-summary">${summary}</div>
  ${resultsBlock}
</section>
<style>
  .search-section { max-width: 760px; margin: 32px auto; padding: 0 24px 80px; }
  .search-h1 { font-family: var(--serif); font-size: 28px; margin: 0 0 18px; color: var(--ink); }
  .search-form { display: flex; gap: 10px; margin-bottom: 14px; }
  .search-input { flex: 1; padding: 12px 16px; font-family: var(--serif); font-size: 16px;
    border: 1px solid var(--rule); border-radius: 8px; background: var(--surface); color: var(--ink); }
  .search-input:focus { outline: 2px solid var(--ink); outline-offset: 0; }
  .search-go { padding: 12px 22px; font-family: var(--mono); font-size: 13px;
    background: var(--ink); color: var(--paper); border: none; border-radius: 8px; cursor: pointer; }
  .search-go:hover { background: var(--accent-2); color: var(--paper); }
  .search-summary { font-family: var(--serif); font-style: italic; font-size: 14px;
    color: var(--ink-3); margin-bottom: 22px; }
  .search-hits { list-style: none; padding: 0; margin: 0; }
  .search-hit { padding: 14px 0; border-top: 1px solid var(--rule-soft); }
  .search-link { display: flex; align-items: baseline; gap: 12px; text-decoration: none; color: var(--ink); }
  .search-kind { font-family: var(--mono); font-size: 10.5px; padding: 2px 7px; border-radius: 3px;
    background: var(--paper-2); color: var(--ink-3); letter-spacing: .04em; }
  .search-title { font-family: var(--serif); font-size: 17px; line-height: 1.3; flex: 1; }
  .search-link:hover .search-title { text-decoration: underline; text-decoration-color: var(--ink-3); text-underline-offset: 4px; }
  .search-snippet { font-family: var(--serif); font-size: 13.5px; color: var(--ink-3);
    margin-top: 6px; line-height: 1.5; }
  .search-score { font-family: var(--mono); font-size: 10.5px; color: var(--ink-3);
    margin-top: 4px; letter-spacing: .03em; }
  .search-empty { font-family: var(--serif); font-style: italic; color: var(--ink-3);
    font-size: 14.5px; padding: 16px 0; }
  .search-preview { margin-top: 10px; padding: 16px 18px; border: 1px dashed var(--rule);
    border-radius: 8px; background: var(--paper-2, var(--surface)); }
  .search-preview-label { font-family: var(--mono); font-size: 10.5px; letter-spacing: .04em;
    text-transform: uppercase; color: var(--ink-3); margin-bottom: 10px; }
  .search-preview-body { font-family: var(--serif); font-size: 14.5px; line-height: 1.6; color: var(--ink); }
  .search-research-form { margin-top: 14px; }
  .search-research-go { padding: 9px 16px; font-family: var(--mono); font-size: 12px;
    background: var(--ink); color: var(--paper); border: none; border-radius: 6px; cursor: pointer; }
  .search-research-go:hover { background: var(--accent-2); color: var(--paper); }
</style>`;

  return renderPage({
    title: query ? `Search · "${query}" · canopticon` : "Search · canopticon",
    description:
      "Ask the record — search documented facts, disputed claims, signed analyses, and sources.",
    body,
    activeNav: "/search",
  });
}

// Mirrors the completed/failed/skipped check bulk-expand.ts uses to know
// when to stop its own auto-refresh.
async function isExpandTerminal(db: D1Database, userId: string, subject: string): Promise<boolean> {
  const row = await one<{ id: string }>(
    db,
    `SELECT id FROM orchestrator_events
      WHERE user_id = ?
        AND event_type IN ('record.expand.completed','record.expand.failed','record.expand.skipped')
        AND json_extract(payload, '$.subject') = ?
        AND created_at > datetime('now','-15 minutes')
      LIMIT 1`,
    [userId, subject],
  ).catch(() => null);
  return !!row;
}

async function resolveHits(
  env: Env,
  hits: Array<{ id: string; score: number; metadata: VectorMeta }>,
): Promise<ResolvedHit[]> {
  // Resolve in parallel — each kind has its own lookup. Most lookups are
  // a single SELECT.
  const resolved = await Promise.all(hits.map((h) => resolveOneHit(env, h)));
  return resolved.filter((r): r is ResolvedHit => r !== null);
}

async function resolveOneHit(
  env: Env,
  hit: { id: string; score: number; metadata: VectorMeta },
): Promise<ResolvedHit | null> {
  const md = hit.metadata;
  if (!md.kind) return null;
  try {
    if (md.kind === "entity") {
      const row = await one<{ slug: string; label: string }>(
        env.DB,
        `SELECT p.slug, n.label
           FROM pages p JOIN nodes n ON n.id = p.subject_node_id
          WHERE n.id = ? LIMIT 1`,
        [md.id],
      );
      if (!row) return null;
      return {
        url: `/s/${row.slug}`,
        kind: "entity",
        title: row.label ?? md.title ?? md.id,
        snippet: "",
        score: hit.score,
      };
    }
    if (md.kind === "piece") {
      const row = await one<{ slug: string; title: string; excerpt: string | null }>(
        env.DB,
        `SELECT slug, title, substr(body_md, 1, 220) AS excerpt
           FROM pieces WHERE id = ? LIMIT 1`,
        [md.id],
      );
      if (!row) return null;
      return {
        url: `/library/${row.slug}`,
        kind: "piece",
        title: row.title ?? md.title ?? md.id,
        snippet: (row.excerpt ?? "").replace(/\s+/g, " ").trim(),
        score: hit.score,
      };
    }
    if (md.kind === "claim") {
      const row = await one<{ claim_text: string; page_slug: string | null }>(
        env.DB,
        `SELECT pc.claim_text,
                (SELECT p.slug FROM pages p WHERE p.id = pc.page_id) AS page_slug
           FROM page_claims pc WHERE pc.id = ? LIMIT 1`,
        [md.id],
      );
      if (!row || !row.page_slug) return null;
      return {
        url: `/s/${row.page_slug}?mode=signed`,
        kind: "claim",
        title: row.claim_text.slice(0, 140),
        snippet: "",
        score: hit.score,
      };
    }
    if (md.kind === "thesis" || md.kind === "article") {
      const row = await one<{ slug: string; thesis: string | null }>(
        env.DB,
        "SELECT slug, thesis FROM pages WHERE id = ? LIMIT 1",
        [md.id],
      );
      if (!row) return null;
      const kind: VectorMeta["kind"] = md.kind;
      return {
        url: kind === "article" ? `/investigations/${row.slug}` : `/s/${row.slug}?mode=signed`,
        kind,
        title: row.thesis ?? md.title ?? md.id,
        snippet: "",
        score: hit.score,
      };
    }
    if (md.kind === "source") {
      return {
        url: `/q/${md.id}`,
        kind: "source",
        title: md.title ?? "Quote",
        snippet: "",
        score: hit.score,
      };
    }
  } catch {
    return null;
  }
  return null;
}

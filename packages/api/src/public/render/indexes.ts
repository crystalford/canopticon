// Essays and Research — the two public doors.
//
// Both read `pieces`; the split is `kind`. The two indexes deliberately use
// different shapes because they answer different questions: an essay index
// is scanned by title and date (dense rows), a research index is browsed by
// what kind of document a thing is (cards).
//
// Piece URLs stay at /p/<slug>. The indexes live at /essays and /research
// but do not own a URL namespace of their own — /p/ is already live and
// possibly indexed, and moving every document's canonical URL to win a path
// segment would trade real link equity for a cosmetic gain.

import { UNGROUPED } from "../../graph/lib/topics";
import { displayTitle } from "../../lib/title";
import {
  type IndexPiece,
  type PublicEnv,
  listEssays,
  listResearch,
  readMinutes,
  resolveOperatorId,
} from "../data";
import { escapeHtml, renderPage } from "../layout";
import { emptyState, formatDate, kindLabel } from "./components";

const CANONICAL = "https://canopticon.com";

// Shared with the homepage, which is built from the same two components so
// the front door and the indexes can't drift into looking like two sites.
export { essayRow, researchCard };

// A dense list row: date | title + dek | read time. The right-hand column
// is hidden under 760px (see .tbl in styles.ts).
function essayRow(p: IndexPiece): string {
  const date = p.published_at ? formatDate(p.published_at) : "";
  const dek = p.subtitle ? `<div class="row-dek">${escapeHtml(p.subtitle)}</div>` : "";
  return `<a class="row" href="/p/${escapeHtml(p.slug)}">
  <div class="row-date">${escapeHtml(date)}</div>
  <div class="row-main">
    <div class="row-title">${escapeHtml(displayTitle(p.title, p.body_head))}</div>
    ${dek}
  </div>
  <div class="row-meta">${readMinutes(p.body_chars)} min</div>
</a>`;
}

function researchCard(p: IndexPiece): string {
  const date = p.published_at ? formatDate(p.published_at) : "";
  const note = p.subtitle ? `<div class="rcard-note">${escapeHtml(p.subtitle)}</div>` : "";
  return `<a class="rcard" href="/p/${escapeHtml(p.slug)}">
  <div class="rcard-badge">${escapeHtml(kindLabel(p.kind))}</div>
  <div class="rcard-title">${escapeHtml(displayTitle(p.title, p.body_head))}</div>
  ${note}
  <div class="rcard-meta"><span>${escapeHtml(date)}</span><span>${readMinutes(p.body_chars)} min</span></div>
</a>`;
}

export async function renderEssaysIndex(env: PublicEnv): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const essays = userId ? await listEssays(env.DB, userId) : [];
  const body = `<header class="phead">
  <div class="eyebrow">Essays</div>
  <h1>Written to stand alone</h1>
  <p class="phead-dek">Arguments made once, in full, with their sources named. Every section
  answers a question in its opening line, so a passage can be quoted without the rest.</p>
</header>
${
  essays.length
    ? `<div class="tbl">${essays.map(essayRow).join("\n")}</div>`
    : emptyState("No essays published yet.")
}`;
  return renderPage({
    title: "Essays",
    description:
      "Essays from Canopticon — arguments made in full, with named sources and answer-first sections.",
    body,
    activeNav: "/essays",
    zone: "essays",
    canonical: `${CANONICAL}/essays`,
  });
}

/**
 * The research index, in sections.
 *
 * Fifty documents spanning political research, tech, housing and several other
 * worlds, in one undifferentiated list, was the operator's complaint and the
 * site's largest topical-authority gap: search and answer engines accumulate
 * authority per subject area, and a corpus with no clusters accumulates it in
 * none of them.
 *
 * ⚠ THIS CREATES NO NEW URLS. /answers and /numbers were both derived index
 * pages and both were removed for the same reason — thin pages competing with
 * the documents they index. Sections inside an index a reader already asked
 * for are navigation, not content. A topic earns a page of its own when it has
 * enough documents to be worth one, and not before.
 *
 * Falls back to a flat grid when grouping would not help: one section holding
 * everything is worse than no sections, because it implies a taxonomy exists
 * and then shows none of it.
 */
function renderGroupedByTopic(docs: IndexPiece[]): string {
  const flat = `<div class="rgrid">${docs.map(researchCard).join("\n")}</div>`;

  const groups = new Map<string, IndexPiece[]>();
  for (const d of docs) {
    const key = d.topic?.trim() || UNGROUPED;
    const list = groups.get(key) ?? [];
    list.push(d);
    groups.set(key, list);
  }
  // Nothing has been topiced yet, or everything landed in one bucket.
  if (groups.size < 2) return flat;

  // Biggest first, but the holding pen always last: "Everything else" is not a
  // subject and must not lead a page that claims to have subjects.
  const ordered = [...groups.entries()].sort((a, b) => {
    if (a[0] === UNGROUPED) return 1;
    if (b[0] === UNGROUPED) return -1;
    return b[1].length - a[1].length;
  });

  return ordered
    .map(
      ([topic, list]) => `<section class="topic-sec">
  <div class="topic-head">
    <h2>${escapeHtml(topic)}</h2>
    <span class="topic-n">${list.length} document${list.length === 1 ? "" : "s"}</span>
  </div>
  <div class="rgrid">${list.map(researchCard).join("\n")}</div>
</section>`,
    )
    .join("\n");
}

export async function renderResearchIndex(env: PublicEnv): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const docs = userId ? await listResearch(env.DB, userId) : [];
  const body = `<header class="phead">
  <div class="eyebrow">Research</div>
  <h1>Published as itself</h1>
  <p class="phead-dek">Primary documents, kept whole and citable. Each one keeps its own page,
  its own address, and a machine-readable twin.</p>
</header>
${docs.length ? renderGroupedByTopic(docs) : emptyState("No research documents published yet.")}`;
  return renderPage({
    title: "Research",
    description:
      "Primary research documents published by Canopticon — kept whole, citable, and machine-readable.",
    body,
    activeNav: "/research",
    zone: "research",
    canonical: `${CANONICAL}/research`,
  });
}

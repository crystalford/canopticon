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
    <div class="row-title">${escapeHtml(p.title)}</div>
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
  <div class="rcard-title">${escapeHtml(p.title)}</div>
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

export async function renderResearchIndex(env: PublicEnv): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const docs = userId ? await listResearch(env.DB, userId) : [];
  const body = `<header class="phead">
  <div class="eyebrow">Research</div>
  <h1>Published as itself</h1>
  <p class="phead-dek">Primary documents, kept whole and citable. Each one keeps its own page,
  its own address, and a machine-readable twin.</p>
</header>
${
  docs.length
    ? `<div class="rgrid">${docs.map(researchCard).join("\n")}</div>`
    : emptyState("No research documents published yet.")
}`;
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

// Investigations — the signed-analysis index + the piece page.
// The piece page is the public face of a research thread: title, dek,
// byline, the rendered body, and a "filed under" topic line.

import { renderMarkdown } from "../../cms/lib/render-post";
import {
  type PublicEnv,
  getPieceBySlug,
  listInvestigations,
  resolveOperatorId,
  topicsForPiece,
} from "../data";
import { escapeHtml, renderPage } from "../layout";
import { emptyState, formatDate, kindLabel, pieceCard, sectionHeader } from "./components";

export async function renderInvestigationsIndex(env: PublicEnv): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const pieces = userId ? await listInvestigations(env.DB, userId) : [];

  const list = pieces.length
    ? `<div class="cards-row">${pieces.map((p) => pieceCard(p)).join("")}</div>`
    : emptyState(
        "No published investigations yet. The signed analysis layer fills as pieces publish.",
      );

  const body = `
<section style="margin-bottom:24px">
  <div class="kicker" style="margin-bottom:16px"><span class="live"></span> Signed analysis</div>
  <h1 style="font-family:var(--serif);font-size:40px;line-height:1.12;letter-spacing:-0.015em;margin:0 0 12px;color:var(--ink)">Investigations</h1>
  <p style="font-family:var(--serif);font-size:18px;line-height:1.55;color:var(--ink-2);max-width:680px">
    The figure cut across the facts. Theses, research reports, and briefs —
    every load-bearing assertion tied back to the external evidence it rests on.
  </p>
</section>
<section>${list}</section>
`;
  return renderPage({
    title: "Investigations",
    description: "Signed analysis on Canadian power — theses, research reports, briefs.",
    body,
    activeNav: "/investigations",
    zone: "investigations",
  });
}

export async function renderPiecePage(env: PublicEnv, slug: string): Promise<string | null> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return null;
  const piece = await getPieceBySlug(env.DB, userId, slug);
  if (!piece) return null;
  // Working-material chain passes are not publicly reachable (spec §2.6).
  if (piece.publication_status === "working-material") return null;

  const topics = await topicsForPiece(env.DB, userId, piece.id);
  const bodyHtml = piece.body_html ?? (piece.body_md ? renderMarkdown(piece.body_md) : "");

  const metaBits = [
    piece.published_at ? formatDate(piece.published_at) : "",
    kindLabel(piece.kind),
    piece.byline ? `by ${piece.byline}` : "",
  ]
    .filter(Boolean)
    .map((m) => escapeHtml(m))
    .join(" · ");

  const filedUnder = topics.length
    ? `<p class="coord" style="margin-top:14px">Filed under ${topics
        .map((t) => `<a href="/topics/${escapeHtml(t.slug)}" class="ac">${escapeHtml(t.label)}</a>`)
        .join(" · ")}</p>`
    : "";

  const body = `
<article style="max-width:var(--reading-width);margin:0 auto">
  <p class="kicker" style="margin-bottom:14px">CANOPTICON · ${metaBits}</p>
  <h1 style="font-family:var(--serif);font-size:44px;line-height:1.08;letter-spacing:-0.02em;margin:0 0 14px;color:var(--ink)">${escapeHtml(piece.title)}</h1>
  ${piece.subtitle ? `<p style="font-family:var(--serif);font-size:20px;font-style:italic;line-height:1.4;color:var(--ink-3);margin:0 0 8px">${escapeHtml(piece.subtitle)}</p>` : ""}
  ${filedUnder}
  <div class="prose" style="margin-top:28px">${bodyHtml}</div>
</article>
`;
  return renderPage({
    title: piece.title,
    description: piece.subtitle ?? `${piece.title} — a Canopticon investigation.`,
    body,
    activeNav: "/investigations",
    zone: "investigations",
  });
}

// Library — the raw research layer. Lists everything (incl. working-
// material) with an honest status tag.
export async function renderLibraryIndex(env: PublicEnv): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const { listLibrary } = await import("../data");
  const pieces = userId ? await listLibrary(env.DB, userId) : [];

  const rows = pieces.length
    ? pieces
        .map((p) => {
          const status =
            p.publication_status === "working-material"
              ? `<span class="chip">working material</span>`
              : p.publication_status === "canonical"
                ? `<span class="chip">canonical</span>`
                : `<span class="chip">published</span>`;
          const href =
            p.publication_status === "working-material"
              ? ""
              : `/investigations/${escapeHtml(p.slug)}`;
          const title = href
            ? `<a href="${href}" class="ac">${escapeHtml(p.title)}</a>`
            : escapeHtml(p.title);
          return `<tr>
  <td>${title}</td>
  <td class="coord">${escapeHtml(kindLabel(p.kind))}</td>
  <td>${status}</td>
  <td class="coord">${p.published_at ? escapeHtml(formatDate(p.published_at)) : "—"}</td>
</tr>`;
        })
        .join("")
    : "";

  const table = pieces.length
    ? `<table class="lib-table" style="width:100%;border-collapse:collapse;margin-top:8px">
  <thead><tr>
    <th style="text-align:left;padding:8px 0;border-bottom:1px solid var(--rule)" class="label">Title</th>
    <th style="text-align:left;padding:8px 0;border-bottom:1px solid var(--rule)" class="label">Kind</th>
    <th style="text-align:left;padding:8px 0;border-bottom:1px solid var(--rule)" class="label">Status</th>
    <th style="text-align:left;padding:8px 0;border-bottom:1px solid var(--rule)" class="label">Date</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>`
    : emptyState("The library is empty. The 65-report seed corpus imports in a later phase.");

  const body = `
<section style="margin-bottom:24px">
  <div class="kicker" style="margin-bottom:16px"><span class="live"></span> The raw research</div>
  <h1 style="font-family:var(--serif);font-size:40px;line-height:1.12;letter-spacing:-0.015em;margin:0 0 12px;color:var(--ink)">Library</h1>
  <p style="font-family:var(--serif);font-size:18px;line-height:1.55;color:var(--ink-2);max-width:680px">
    The working material the rest is built on, kept whole. Research reports and
    documented records. Interior chain passes are marked working material — they
    deposit claims into the record but don't get their own public page.
  </p>
</section>
<section>${sectionHeader(`All material (${pieces.length})`)}${table}</section>
`;
  return renderPage({
    title: "Library",
    description: "The raw research corpus — every report the analysis is built on.",
    body,
    activeNav: "/library",
    zone: "library",
  });
}

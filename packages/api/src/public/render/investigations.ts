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

// Reader-facing intent labels for published outputs (spec Part 18.2: intents
// are badges and filters, not nav).
const INTENT_LABELS: Record<string, string> = {
  investigation: "Investigation",
  argument: "Argument",
  assessment: "Assessment",
  definition: "Definition",
  comparison: "Comparison",
  timeline: "Timeline",
  faq: "FAQ",
  "stat-roundup": "Statistics",
  "entity-profile": "Profile",
  "claim-table": "Claims & sources",
};

export async function renderInvestigationsIndex(
  env: PublicEnv,
  intentFilter?: string,
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const pieces = userId ? await listInvestigations(env.DB, userId) : [];

  // Published outputs (graph-derived, operator-approved). Interpretive
  // pieces are SIGNED; factual arrangements are neutral.
  const { all } = await import("../../lib/d1");
  const outputs = userId
    ? await all<{
        slug: string;
        title: string;
        content_type: string;
        layer: string;
        published_at: string | null;
        signed_by: string | null;
      }>(
        env.DB,
        `SELECT slug, title, content_type, layer, published_at, signed_by
           FROM briefs WHERE user_id = ? AND status = 'published'
          ORDER BY published_at DESC LIMIT 60`,
        [userId],
      ).catch(() => [])
    : [];
  const shownOutputs = intentFilter
    ? outputs.filter((o) => o.content_type === intentFilter)
    : outputs;

  const presentTypes = [...new Set(outputs.map((o) => o.content_type))];
  const filterRow = presentTypes.length
    ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">
  <a href="/investigations" class="chip" style="text-decoration:none${intentFilter ? "" : ";border-color:var(--accent)"}">All</a>
  ${presentTypes
    .map(
      (t) =>
        `<a href="/investigations?intent=${escapeHtml(t)}" class="chip" style="text-decoration:none${intentFilter === t ? ";border-color:var(--accent)" : ""}">${escapeHtml(INTENT_LABELS[t] ?? t)}</a>`,
    )
    .join("")}
</div>`
    : "";

  const outputCards = shownOutputs.length
    ? `<div style="margin-bottom:28px">${shownOutputs
        .map(
          (o) => `<div style="padding:14px 0;border-bottom:1px solid var(--rule)">
  <span class="chip">${escapeHtml(INTENT_LABELS[o.content_type] ?? o.content_type)}</span>
  ${o.layer === "interpretive" ? `<span class="chip" title="A signed reading — not neutral fact">signed${o.signed_by ? ` · ${escapeHtml(o.signed_by)}` : ""}</span>` : ""}
  <div style="margin-top:6px"><a class="ac" href="/briefs/${escapeHtml(o.slug)}" style="font-family:var(--serif);font-size:20px">${escapeHtml(o.title)}</a></div>
  ${o.published_at ? `<p class="coord" style="margin-top:4px">${escapeHtml(formatDate(o.published_at))}</p>` : ""}
</div>`,
        )
        .join("")}</div>`
    : "";

  const list = pieces.length
    ? `<div class="cards-row">${pieces.map((p) => pieceCard(p)).join("")}</div>`
    : "";

  const empty =
    !outputCards && !pieces.length
      ? emptyState(
          "No published investigations yet. The signed analysis layer fills as outputs publish.",
        )
      : "";

  const body = `
<section style="margin-bottom:24px">
  <div class="kicker" style="margin-bottom:16px"><span class="live"></span> Signed analysis</div>
  <h1 style="font-family:var(--serif);font-size:40px;line-height:1.12;letter-spacing:-0.015em;margin:0 0 12px;color:var(--ink)">Investigations</h1>
  <p style="font-family:var(--serif);font-size:18px;line-height:1.55;color:var(--ink-2);max-width:680px">
    The figure cut across the facts. Every piece wears its intent as a badge;
    every load-bearing assertion ties back to the evidence it rests on.
  </p>
</section>
${filterRow}
<section>${outputCards}${list}${empty}</section>
`;
  return renderPage({
    title: "Investigations",
    description: "Signed analysis on Canadian power — investigations, arguments, assessments.",
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

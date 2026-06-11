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
  // Signed readings from the fabric (pages.signed_status='published'). These
  // are the Phase-3 auto-drafted, operator-signed readings of subjects.
  const readings = userId
    ? await all<{
        slug: string;
        label: string;
        kind: string;
        thesis: string | null;
        signed_by: string | null;
        signed_at: string | null;
        confidence: string | null;
      }>(
        env.DB,
        `SELECT p.slug, n.label, n.kind, p.thesis, p.signed_by, p.signed_at, p.confidence
           FROM pages p JOIN nodes n ON n.id = p.subject_node_id
          WHERE p.user_id = ? AND p.signed_status = 'published'
          ORDER BY p.signed_at DESC LIMIT 40`,
        [userId],
      ).catch(() => [])
    : [];

  const shownOutputs = intentFilter
    ? outputs.filter((o) => o.content_type === intentFilter)
    : outputs;

  const readingCards =
    readings.length && !intentFilter
      ? `<div style="margin-bottom:28px">${readings
          .map(
            (r) => `<div style="padding:14px 0;border-bottom:1px solid var(--rule)">
  <span class="chip" title="A signed reading of a subject">Signed reading${r.signed_by ? ` · ${escapeHtml(r.signed_by)}` : ""}</span>
  ${r.confidence ? `<span class="chip">${escapeHtml(r.confidence)} confidence</span>` : ""}
  <div style="margin-top:6px"><a class="ac" href="/s/${escapeHtml(r.slug)}?mode=signed" style="font-family:var(--serif);font-size:20px">${escapeHtml(r.label)}</a></div>
  ${r.thesis ? `<p style="font-family:var(--serif);font-style:italic;color:var(--ink-2);margin-top:5px;max-width:620px">${escapeHtml(r.thesis.slice(0, 180))}</p>` : ""}
  ${r.signed_at ? `<p class="coord" style="margin-top:4px">${escapeHtml(formatDate(r.signed_at))}</p>` : ""}
</div>`,
          )
          .join("")}</div>`
      : "";

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

  // The fabric-era ledger: signed readings of subjects/themes. When no
  // readings exist yet — and we only have legacy briefs (or nothing) —
  // explain the SHAPE that fills this page rather than show a dead empty.
  const shapeBlock =
    readings.length === 0
      ? `<section class="shape-block" aria-label="What this page will contain">
  <div class="sec-k">What lands here</div>
  <ul>
    <li><b>Signed readings</b> — the system auto-drafts a reading of any subject (entity, event, or theme) the corpus has enough material on; the operator reads and signs. Each carries a thesis, a confidence band, and a mandatory box of facts that complicate it.</li>
    <li><b>Intent badges</b> — every signed piece wears its kind: Investigation · Argument · Pattern · Assessment · Critique · Explanation. Filter above when there are enough to filter.</li>
    <li><b>Receipts</b> — every load-bearing assertion ties back to a verbatim quote from a stored source document.</li>
  </ul>
  ${pieces.length > 0 ? `<p>Showing ${pieces.length} legacy investigation${pieces.length === 1 ? "" : "s"} from before the fabric era below. Fabric-era signed readings have not begun yet — the auto-drafter runs when the corpus settles after extraction.</p>` : "<p>The auto-drafter runs when the corpus settles after extraction. No readings yet.</p>"}
</section>`
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
${shapeBlock}
${filterRow}
<section>${readingCards}${outputCards}${list}</section>
<style>
  .shape-block { padding:20px 22px; border:1px solid var(--rule); border-radius:9px;
    background:var(--panel-soft, rgba(0,0,0,.02)); margin-bottom:28px; }
  .shape-block .sec-k { font-size:11px; letter-spacing:.14em; color:var(--ink-3);
    text-transform:uppercase; font-weight:600; margin:0 0 12px; }
  .shape-block ul { list-style:none; padding:0; margin:0 0 14px; }
  .shape-block li { font-size:14.5px; line-height:1.6; color:var(--ink-2); padding:7px 0;
    border-top:1px solid var(--rule); }
  .shape-block li:first-child { border-top:none; }
  .shape-block li b { color:var(--ink); font-weight:600; }
  .shape-block p { font-size:13.5px; color:var(--ink-3); font-style:italic; margin:0; }
</style>
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
export async function renderLibraryIndex(
  env: PublicEnv,
  opts: { isOperator?: boolean } = {},
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const { listLibrary } = await import("../data");
  const pieces = userId ? await listLibrary(env.DB, userId) : [];

  // Operator affordance strip — only rendered when logged in. Surfaces the
  // bulk extract action (the work behind it lives at POST /op/library/extract
  // and is unchanged). Spec v2.5 Part 9: same URL, controls woven in. Visual
  // treatment is deliberately minimal — a band, two buttons. The handoff doc
  // says "implement the model and leave the exact visual treatment for review".
  let opStrip = "";
  if (opts.isOperator && userId) {
    const { one } = await import("../../lib/d1");
    const counts = await one<{ total: number; unextracted: number }>(
      env.DB,
      `SELECT
         (SELECT COUNT(*) FROM pieces WHERE user_id = ?) AS total,
         (SELECT COUNT(*) FROM pieces p
            WHERE p.user_id = ? AND NOT EXISTS (
              SELECT 1 FROM digest_jobs j
               WHERE j.user_id = p.user_id AND j.piece_id = p.id AND j.status = 'completed')
         ) AS unextracted`,
      [userId, userId],
    ).catch(() => null);
    const total = counts?.total ?? 0;
    const unextracted = counts?.unextracted ?? 0;
    const extractBtn =
      unextracted > 0
        ? `<form method="POST" action="/op/library/extract" style="display:inline;margin-right:8px">
  <input type="hidden" name="mode" value="all-unextracted" />
  <button type="submit" class="op-strip-btn op-strip-btn-primary">Extract all (${unextracted})</button>
</form>`
        : "";
    const reextractBtn =
      total > 0
        ? `<form method="POST" action="/op/library/extract" style="display:inline" onsubmit="return confirm('Re-extract all ${total} documents?');">
  <input type="hidden" name="mode" value="all" />
  <button type="submit" class="op-strip-btn">Re-extract all (${total})</button>
</form>`
        : "";
    opStrip = `<div class="op-strip">
  <div class="op-strip-label">Operator</div>
  <div class="op-strip-actions">${extractBtn}${reextractBtn}</div>
</div>
<style>
  .op-strip { display:flex; align-items:center; gap:14px; padding:10px 14px; margin:0 0 18px;
    border:1px solid var(--rule); border-radius:8px; background:rgba(0,0,0,.03); }
  .op-strip-label { font-size:11px; letter-spacing:.12em; text-transform:uppercase;
    color:var(--ink-3); font-weight:600; }
  .op-strip-actions { display:flex; gap:8px; flex-wrap:wrap; margin-left:auto; }
  .op-strip-btn { font-size:12.5px; padding:6px 14px; border-radius:6px; cursor:pointer;
    border:1px solid var(--rule); background:#fff; color:var(--ink); }
  .op-strip-btn-primary { background:var(--ink); color:#fff; border-color:var(--ink); }
</style>`;
  }

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
${opStrip}
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

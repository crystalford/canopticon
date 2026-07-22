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
// are badges and filters, not nav). The first seven are the canonical signed
// reading intents (spec v2.5 Part 5); the rest are factual arrangement
// types from the older briefs era still in circulation.
const INTENT_LABELS: Record<string, string> = {
  investigation: "Investigation",
  argument: "Argument",
  pattern: "Pattern",
  hypothesis: "Hypothesis",
  assessment: "Assessment",
  critique: "Critique",
  explanation: "Explanation",
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
        intent: string | null;
        signed_by: string | null;
        signed_at: string | null;
        confidence: string | null;
      }>(
        env.DB,
        `SELECT p.slug, n.label, n.kind, p.thesis, p.intent, p.signed_by, p.signed_at, p.confidence
           FROM pages p JOIN nodes n ON n.id = p.subject_node_id
          WHERE p.user_id = ? AND p.signed_status = 'published'
          ORDER BY p.signed_at DESC LIMIT 40`,
        [userId],
      ).catch(() => [])
    : [];

  const shownOutputs = intentFilter
    ? outputs.filter((o) => o.content_type === intentFilter)
    : outputs;

  // Apply the intent filter to readings — clicking an intent badge narrows
  // both layers (factual outputs and signed readings).
  const shownReadings = intentFilter ? readings.filter((r) => r.intent === intentFilter) : readings;

  // Editorial hierarchy: a LEAD reading + secondary cards row + the rest as
  // a compact ordered list. A real investigations page foregrounds the
  // strongest piece instead of treating every reading as equal.
  const leadReading = shownReadings[0];
  const secondaryReadings = shownReadings.slice(1, 3);
  const tailReadings = shownReadings.slice(3);

  const intentChip = (intent: string | null | undefined): string =>
    intent
      ? `<span class="intent-badge intent-${escapeHtml(intent)}">${escapeHtml(INTENT_LABELS[intent] ?? intent)}</span>`
      : `<span class="chip">Signed reading</span>`;

  const leadReadingCard = leadReading
    ? `<a class="inv-lead" href="/s/${escapeHtml(leadReading.slug)}?mode=signed">
  <div class="inv-lead-kicker">
    ${intentChip(leadReading.intent)}
    ${leadReading.confidence ? `<span class="inv-meta">${escapeHtml(leadReading.confidence)} confidence</span>` : ""}
    ${leadReading.signed_by ? `<span class="inv-meta">signed · ${escapeHtml(leadReading.signed_by)}</span>` : ""}
    ${leadReading.signed_at ? `<span class="inv-meta inv-date">${escapeHtml(formatDate(leadReading.signed_at))}</span>` : ""}
  </div>
  <h2 class="inv-lead-title">${escapeHtml(leadReading.label)}</h2>
  ${leadReading.thesis ? `<p class="inv-lead-thesis">${escapeHtml(leadReading.thesis.slice(0, 220))}</p>` : ""}
</a>`
    : "";

  const secondaryReadingsRow = secondaryReadings.length
    ? `<div class="inv-secondaries">${secondaryReadings
        .map(
          (r) => `<a class="inv-secondary" href="/s/${escapeHtml(r.slug)}?mode=signed">
  <div class="inv-secondary-kicker">${intentChip(r.intent)}${r.confidence ? ` <span class="inv-meta">${escapeHtml(r.confidence)} confidence</span>` : ""}</div>
  <h3 class="inv-secondary-title">${escapeHtml(r.label)}</h3>
  ${r.thesis ? `<p class="inv-secondary-thesis">${escapeHtml(r.thesis.slice(0, 130))}</p>` : ""}
  ${r.signed_at ? `<div class="inv-meta inv-date">${escapeHtml(formatDate(r.signed_at))}</div>` : ""}
</a>`,
        )
        .join("")}</div>`
    : "";

  const tailReadingsList = tailReadings.length
    ? `<div class="inv-tail-list">${tailReadings
        .map(
          (r) => `<div class="inv-row">
  ${intentChip(r.intent)}
  <a class="inv-row-link" href="/s/${escapeHtml(r.slug)}?mode=signed">${escapeHtml(r.label)}</a>
  ${r.signed_at ? `<span class="inv-meta inv-date">${escapeHtml(formatDate(r.signed_at))}</span>` : ""}
</div>`,
        )
        .join("")}</div>`
    : "";

  const readingCards = leadReadingCard + secondaryReadingsRow + tailReadingsList;

  // Filter row collects intents from BOTH signed readings (pages.intent) and
  // legacy outputs (briefs.content_type). Click an intent to narrow.
  const presentTypes = [
    ...new Set([
      ...outputs.map((o) => o.content_type),
      ...readings.map((r) => r.intent).filter((i): i is string => !!i),
    ]),
  ];
  const filterRow = presentTypes.length
    ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">
  <a href="/investigations" class="chip" style="text-decoration:none${intentFilter ? "" : ";border-color:var(--accent)"}">All</a>
  ${presentTypes
    .map(
      (t) =>
        `<a href="/investigations?intent=${escapeHtml(t)}" class="chip" style="text-decoration:none${intentFilter === t ? ";border-color:var(--accent)" : ""}">${escapeHtml(INTENT_LABELS[t] ?? t)}</a>`,
    )
    .join("")}
</div>
<style>
  .intent-badge { display:inline-block; font-size:10px; padding:2px 9px; border-radius:4px;
    font-weight:600; letter-spacing:.04em; margin-right:6px; }
  .intent-investigation { background:rgba(77,156,111,.16); color:#4d9c6f; }
  .intent-argument { background:rgba(201,106,83,.16); color:#c96a53; }
  .intent-pattern { background:rgba(126,166,216,.16); color:#7ea6d8; }
  .intent-hypothesis { background:rgba(183,158,224,.16); color:#b79ee0; }
  .intent-assessment { background:rgba(209,171,92,.16); color:#d1ab5c; }
  .intent-critique { background:rgba(196,123,152,.16); color:#c47b98; }
  .intent-explanation { background:rgba(126,200,227,.16); color:#7ec8e3; }
</style>`
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

  /* Investigations editorial hierarchy — lead piece, two secondaries,
     compact tail list. Matches the home pattern so the reader's mental
     model carries across surfaces. */
  .inv-lead {
    display: block; text-decoration: none;
    padding: 28px 32px; margin-bottom: 24px;
    border: 1px solid var(--rule); border-radius: 13px;
    background: var(--surface, #fff);
    transition: border-color .12s;
  }
  .inv-lead:hover { border-color: #c9bfa9; }
  .inv-lead-kicker { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
  .inv-lead-title {
    font-family: var(--serif);
    font-size: 32px; line-height: 1.16;
    letter-spacing: -0.018em;
    color: var(--ink);
    margin: 0 0 12px;
  }
  .inv-lead-thesis {
    font-family: var(--serif);
    font-size: 18px; line-height: 1.55;
    font-style: italic;
    color: var(--ink-2);
    margin: 0;
    max-width: 720px;
  }
  .inv-secondaries { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 28px; }
  .inv-secondary {
    display: block; text-decoration: none;
    padding: 20px 22px;
    border: 1px solid var(--rule); border-radius: 10px;
    background: var(--surface, #fff);
    transition: border-color .12s;
  }
  .inv-secondary:hover { border-color: #c9bfa9; }
  .inv-secondary-kicker { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 9px; }
  .inv-secondary-title {
    font-family: var(--serif);
    font-size: 20px; line-height: 1.22;
    color: var(--ink);
    margin: 0 0 8px;
  }
  .inv-secondary-thesis {
    font-family: var(--serif);
    font-size: 14px; line-height: 1.5;
    color: var(--ink-2);
    margin: 0 0 10px;
  }
  .inv-tail-list { margin-top: 16px; }
  .inv-row {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    padding: 12px 0; border-top: 1px solid var(--rule);
  }
  .inv-row:first-child { border-top: none; }
  .inv-row-link {
    font-family: var(--serif); font-size: 17px;
    color: var(--ink); text-decoration: none;
    flex: 1;
  }
  .inv-row-link:hover { color: var(--accent); }
  .inv-meta {
    font-size: 12px;
    color: var(--ink-3);
    letter-spacing: .03em;
  }
  .inv-date { font-family: var(--mono); font-size: 11.5px; }
  @media (max-width: 720px) {
    .inv-secondaries { grid-template-columns: 1fr; }
    .inv-lead-title { font-size: 26px; }
    .inv-lead-thesis { font-size: 16px; }
  }
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
// A stored piece's title is sometimes the raw upload filename — e.g.
// "compass_artifact_wf-c96cfa7c-3f5d-…_text_markdown.md" — when the
// operator dropped a file whose name was never meant to be read. Showing
// that verbatim as a page title reads as broken, not honest. Detect the
// machine-filename shape (long, no spaces, a file extension or a uuid-ish
// segment) and show a plain placeholder with the real filename kept
// visible underneath in mono, never hidden.
function looksLikeMachineFilename(title: string): boolean {
  if (/\s/.test(title)) return false;
  if (title.length < 20) return false;
  const hasExt = /\.(md|txt|pdf|html?|docx?|csv|json)$/i.test(title);
  const hasUuidish = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(title);
  return hasExt || hasUuidish;
}

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
    border:1px solid var(--rule); background:var(--surface); color:var(--ink); }
  .op-strip-btn-primary { background:var(--ink); color:#fff; border-color:var(--ink); }
</style>`;
  }

  // Library weight — the proof-of-work line. Documents read, facts extracted,
  // subjects fed, contested claims surfaced. Numbers come straight from the
  // typed graph; if extraction hasn't run, the line shrinks honestly.
  const { one, all: allRows } = await import("../../lib/d1");
  const weight = userId
    ? await one<{
        docs: number;
        facts: number;
        subjects: number;
        contested: number;
        threads: number;
      }>(
        env.DB,
        `SELECT
           (SELECT COUNT(*) FROM pieces WHERE user_id = ?) AS docs,
           (SELECT COUNT(*) FROM nodes WHERE user_id = ?
              AND kind IN ('neutral_fact', 'event', 'entity', 'assertion')) AS facts,
           (SELECT COUNT(DISTINCT subject_node_id) FROM pages WHERE user_id = ?) AS subjects,
           (SELECT COUNT(*) FROM assertions a JOIN nodes n ON n.id = a.node_id
              WHERE n.user_id = ? AND a.rank = 'contested') AS contested,
           (SELECT COUNT(*) FROM inquiry_threads WHERE user_id = ?) AS threads`,
        [userId, userId, userId, userId, userId],
      ).catch(() => null)
    : null;

  // Per-piece "what it fed" — one query, indexed by piece_id. Renders in the
  // table row so the operator can see at a glance which docs are pulling
  // weight and which are dead. Includes node count and distinct-subjects count.
  const fedRows = userId
    ? await allRows<{ piece_id: string; nodes: number; subjects: number }>(
        env.DB,
        `SELECT n.piece_id,
                COUNT(*) AS nodes,
                COUNT(DISTINCT e.dst_node_id) AS subjects
           FROM nodes n
           LEFT JOIN edges e ON e.src_node_id = n.id AND e.family = 'aboutness'
          WHERE n.user_id = ? AND n.piece_id IS NOT NULL
            AND n.kind IN ('neutral_fact', 'event', 'assertion')
          GROUP BY n.piece_id`,
        [userId],
      ).catch(() => [])
    : [];
  const fedByPiece = new Map(fedRows.map((r) => [r.piece_id, r] as const));

  const rows = pieces.length
    ? pieces
        .map((p) => {
          const fed = fedByPiece.get(p.id);
          const status =
            p.publication_status === "working-material"
              ? `<span class="chip">working material</span>`
              : p.publication_status === "canonical"
                ? `<span class="chip">canonical</span>`
                : `<span class="chip">published</span>`;
          const href =
            p.publication_status === "working-material" ? "" : `/library/${escapeHtml(p.slug)}`;
          const isRawFilename = looksLikeMachineFilename(p.title);
          const displayTitle = isRawFilename ? "Untitled research document" : p.title;
          const rawFilenameLine = isRawFilename
            ? `<div class="lib-title-raw">${escapeHtml(p.title)}</div>`
            : "";
          const title = href
            ? `<a href="${href}" class="ac">${escapeHtml(displayTitle)}</a>${rawFilenameLine}`
            : `${escapeHtml(displayTitle)}${rawFilenameLine}`;
          const fedCell =
            fed && fed.nodes > 0
              ? `<span><b>${fed.nodes}</b> fact${fed.nodes === 1 ? "" : "s"}${fed.subjects > 0 ? ` · ${fed.subjects} subject${fed.subjects === 1 ? "" : "s"}` : ""}</span>`
              : `<span class="lib-fed-quiet">not extracted</span>`;
          return `<tr>
  <td>${title}</td>
  <td class="coord">${escapeHtml(kindLabel(p.kind))}</td>
  <td class="lib-fed">${fedCell}</td>
  <td>${status}</td>
  <td class="coord">${p.published_at ? escapeHtml(formatDate(p.published_at)) : "—"}</td>
</tr>`;
        })
        .join("")
    : "";

  const table = pieces.length
    ? `<table class="lib-table">
  <thead><tr>
    <th class="label">Title</th>
    <th class="label">Kind</th>
    <th class="label">Fed the fabric</th>
    <th class="label">Status</th>
    <th class="label">Date</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>`
    : emptyState(
        "No documents yet. Once research reports are dropped into the Library, every one will land here with what it fed showing in its row.",
      );

  // The research-weight band — proof-of-work line that sits between the lede
  // and the table. Sized for skim: large numerals, plain English on the labels.
  const weightBand =
    weight && weight.docs > 0
      ? `<div class="lib-weight">
  <div class="lw-cell"><b>${weight.docs}</b><span>source document${weight.docs === 1 ? "" : "s"}</span></div>
  ${weight.facts > 0 ? `<div class="lw-cell"><b>${weight.facts.toLocaleString()}</b><span>facts extracted</span></div>` : ""}
  ${weight.subjects > 0 ? `<div class="lw-cell"><b>${weight.subjects}</b><span>subject page${weight.subjects === 1 ? "" : "s"} fed</span></div>` : ""}
  ${weight.contested > 0 ? `<div class="lw-cell"><b>${weight.contested}</b><span>contested claim${weight.contested === 1 ? "" : "s"}</span></div>` : ""}
  ${weight.threads > 0 ? `<div class="lw-cell"><b>${weight.threads}</b><span>open thread${weight.threads === 1 ? "" : "s"}</span></div>` : ""}
</div>`
      : "";

  const body = `
<section style="margin-bottom:18px">
  <div class="kicker" style="margin-bottom:16px"><span class="live"></span> The raw research</div>
  <h1 style="font-family:var(--serif);font-size:40px;line-height:1.12;letter-spacing:-0.015em;margin:0 0 12px;color:var(--ink)">Library</h1>
  <p style="font-family:var(--serif);font-size:18px;line-height:1.55;color:var(--ink-2);max-width:680px">
    Every document the rest is built on, kept whole. Each row shows what it fed the record —
    facts extracted, subjects it touched. Working material feeds the record but
    doesn't get its own public page.
  </p>
</section>
${weightBand}
${opStrip}
<section>${sectionHeader(`All material (${pieces.length})`)}${table}</section>
<style>
  .lib-weight {
    display: flex; flex-wrap: wrap;
    gap: 20px 36px;
    padding: 22px 24px;
    margin: 0 0 28px;
    border: 1px solid var(--rule);
    border-radius: 11px;
    background: var(--surface, #fff);
  }
  .lw-cell { display: flex; flex-direction: column; gap: 2px; }
  .lw-cell b {
    font-family: var(--serif);
    font-size: 28px; line-height: 1;
    color: var(--ink);
    font-weight: 600;
  }
  .lw-cell span {
    font-size: 12.5px;
    color: var(--ink-3);
    letter-spacing: .02em;
  }
  .lib-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-family: var(--serif); }
  .lib-table th { text-align: left; padding: 10px 14px 10px 0; border-bottom: 1px solid var(--rule); font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3); font-weight: 600; }
  .lib-table td { padding: 14px 14px 14px 0; border-bottom: 1px solid var(--rule-soft, var(--rule)); vertical-align: top; font-size: 15px; line-height: 1.4; }
  .lib-table td.coord { font-family: var(--mono); font-size: 12.5px; color: var(--ink-3); }
  .lib-table tr:hover td { background: rgba(0,0,0,0.015); }
  .lib-fed { color: var(--ink-2); font-size: 13.5px; }
  .lib-fed b { color: var(--ink); font-weight: 600; }
  .lib-fed-quiet { color: var(--ink-3); font-style: italic; font-size: 13px; }
  .lib-title-raw { font-family: var(--mono); font-size: 11px; color: var(--ink-mute); margin-top: 3px; word-break: break-all; }
</style>
`;
  return renderPage({
    title: "Library",
    description:
      "Every source document the rest is built on. Each row shows what it fed the record — facts extracted, subjects it touched.",
    body,
    activeNav: "/library",
    zone: "library",
  });
}

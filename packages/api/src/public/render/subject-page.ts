// Unified subject page renderer — the fabric, made visible.
//
// One template, two modes, three subject kinds:
//
//   Subjects: entity | event | theme
//   Modes:    neutral (the Record — facts, receipts, contested as contested)
//             | signed (the operator's reading)
//
// A subject page in NEUTRAL mode is the knowledge graph rendered — facts
// with receipts, contested claims attributed, timeline, connections.
// Nobody writes it; it grows as extraction lands.
//
// A subject page in SIGNED mode is the SAME data with a thesis pulling
// the facts into order. The operator signed off; the prose argues.
//
// Mode switching is one query parameter. Same URL, same fabric, both modes
// link to each other at the top.

import { renderMarkdown } from "../../cms/lib/render-post";
import { all, one, parseJson } from "../../lib/d1";
import { type PublicEnv, resolveOperatorId } from "../data";
import { escapeAttr, escapeHtml, renderPage } from "../layout";

interface SubjectRow {
  node_id: string;
  kind: string;
  label: string;
  metadata: string;
}

// Intent labels (spec v2.5 Part 5). The seven epistemic stances a signed
// reading can wear as a badge.
const INTENT_LABELS: Record<string, string> = {
  investigation: "Investigation",
  argument: "Argument",
  pattern: "Pattern",
  hypothesis: "Hypothesis",
  assessment: "Assessment",
  critique: "Critique",
  explanation: "Explanation",
};

interface PageRow {
  id: string;
  slug: string;
  thesis: string | null;
  intent: string | null;
  body_md: string | null;
  body_html: string | null;
  signed_status: string;
  signed_by: string | null;
  signed_at: string | null;
  confidence: string | null;
  claims_verified: number;
  judge_model: string | null;
}

interface FactRow {
  id: string;
  label: string;
  kind: string;
  metadata: string;
  // Quote anchoring (when present)
  quote_id: string | null;
  quote_text: string | null;
  piece_slug: string | null;
  piece_title: string | null;
}

interface AssertionRow {
  node_id: string;
  label: string;
  actor: string | null;
  stance: string;
  evidence_balance: number;
  quote_text: string | null;
  piece_slug: string | null;
  piece_title: string | null;
  rank: string;
}

interface EventRow {
  id: string;
  label: string;
  event_date: string | null;
  quote_text: string | null;
  piece_slug: string | null;
}

interface ConnectionRow {
  other_node_id: string;
  other_label: string;
  other_kind: string;
  edge_type: string;
  family: string;
  weight: number;
}

interface ThemeRow {
  received_account: string;
  convergence_count: number;
}

export async function renderSubjectPage(
  env: PublicEnv,
  slug: string,
  mode: "neutral" | "signed" = "neutral",
  opts: { isOperator?: boolean } = {},
): Promise<string | null> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return null;

  // Resolve the page + its subject node.
  const page = await one<
    PageRow & { node_id: string; kind: string; label: string; metadata: string }
  >(
    env.DB,
    `SELECT p.id, p.slug, p.thesis, p.intent, p.body_md, p.body_html, p.signed_status,
            p.signed_by, p.signed_at, p.confidence, p.claims_verified, p.judge_model,
            n.id AS node_id, n.kind, n.label, n.metadata
       FROM pages p
       JOIN nodes n ON n.id = p.subject_node_id
      WHERE p.user_id = ? AND p.slug = ?`,
    [userId, slug],
  );
  if (!page) return null;

  // Mode resolution: if the operator asked for signed but no signed body
  // exists, fall back to neutral (and the band at top still offers nothing).
  const hasSignedReading =
    (page.signed_status === "signed" || page.signed_status === "published") && !!page.body_md;
  const resolvedMode: "neutral" | "signed" =
    mode === "signed" && hasSignedReading ? "signed" : "neutral";

  const subject: SubjectRow = {
    node_id: page.node_id,
    kind: page.kind,
    label: page.label,
    metadata: page.metadata,
  };

  if (resolvedMode === "signed") {
    return renderSigned(env, subject, page, hasSignedReading, !!opts.isOperator);
  }
  return renderNeutral(env, subject, page, hasSignedReading, !!opts.isOperator);
}

// ===========================================================================
// NEUTRAL MODE — the wiki view, rendered from the graph
// ===========================================================================
async function renderNeutral(
  env: PublicEnv,
  subject: SubjectRow,
  page: PageRow,
  hasSignedReading: boolean,
  isOperator: boolean,
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return renderPage({ title: subject.label, body: "", description: "" });

  // Theme subjects render differently — they're about a received account,
  // not an entity with attributes. Branch here.
  if (subject.kind === "theme") {
    const theme = await one<ThemeRow>(
      env.DB,
      "SELECT received_account, convergence_count FROM themes WHERE node_id = ?",
      [subject.node_id],
    );
    return renderThemePageNeutral(env, subject, page, theme, hasSignedReading, isOperator);
  }

  // Pull the four neutral-mode sections in parallel.
  const [established, contested, events, connections, sourceCount] = await Promise.all([
    loadEstablishedFacts(env, userId, subject.node_id),
    loadContestedAssertions(env, userId, subject.node_id),
    loadTimelineEvents(env, userId, subject.node_id),
    loadConnections(env, userId, subject.node_id),
    loadSourceCount(env, userId, subject.node_id),
  ]);

  const lede = buildLede(subject, established);
  const establishedBlock = renderEstablishedBlock(established);
  const contestedBlock = renderContestedBlock(contested);
  const timelineBlock = renderTimelineBlock(events);
  const connectionsBlock = renderConnectionsBlock(connections);
  const provenanceBlock = renderProvenance(sourceCount, hasSignedReading, page);
  const modeBand = renderModeBand(page.slug, "neutral", hasSignedReading, page);

  // When all four content blocks are empty, the page still says what FILLS
  // each section, so the reader sees the SHAPE of the Record (Established,
  // Contested, Timeline, Connections) rather than landing on a near-blank
  // page. The Feels Like Brief: never look like a shell.
  const isEmpty =
    established.length === 0 &&
    contested.length === 0 &&
    events.length === 0 &&
    connections.length === 0;
  const shapeBlock = isEmpty
    ? `<section class="shape-block" aria-label="What this page will contain">
  <div class="sec-k">What this Record carries</div>
  <ul>
    <li><b>Established</b> — neutral facts about ${escapeHtml(subject.label)}, each linked to a verbatim source span.</li>
    <li><b>Contested</b> — attributed assertions where the evidence is split or rebutted, shown gray, never silently as fact.</li>
    <li><b>Timeline</b> — dated events involving this subject, ordered.</li>
    <li><b>Connections</b> — typed relationships to other entities (ownership, employment, funding, membership).</li>
  </ul>
  <p>Nothing has been extracted yet that fills these. Documents in the Library are read into a typed graph; this page grows from that graph automatically.</p>
</section>`
    : "";

  // Operator affordance: a Record is "thin" when there's almost nothing on
  // it. Logged-in operator sees an "Expand this Record" prompt that POSTs
  // to /op/records/:slug/expand — kicks off Brave Search + the same
  // extraction pipeline used on uploads (spec v2.5 Part 23). Without
  // BRAVE_SEARCH_API_KEY set as a Worker secret, the action no-ops and logs
  // an event saying so — the affordance is real even before the key lands.
  const isThin = established.length + events.length + contested.length < 5;
  const opAffordance =
    isOperator && isThin
      ? `<form method="POST" action="/op/records/${escapeAttr(page.slug)}/expand" class="op-aff" style="display:flex">
  <span class="op-aff-label">Operator</span>
  <button class="op-aff-btn op-aff-btn-action" type="submit">Expand this Record →</button>
  <span class="op-aff-hint">few facts here yet — click to search the web for ${escapeHtml(subject.label)} and extract new sources into the graph</span>
</form>`
      : "";
  // GEO/citability: a schema.org JSON-LD graph so AI engines can cite the
  // page and its blocks. The subject's schema type follows its kind.
  const jsonLd = buildSubjectJsonLd(subject, page, established, events);

  const body = `
<script type="application/ld+json">${jsonLd}</script>
<article class="subject-page">
  ${modeBand}
  ${opAffordance}
  <header class="subject-head">
    <div class="kicker">${escapeHtml(subjectKindLabel(subject.kind))}</div>
    <h1>${escapeHtml(subject.label)}</h1>
    ${lede ? `<p class="subject-lede">${lede}</p>` : ""}
  </header>

  <div class="subject-grid">
    <div class="subject-main">
      ${shapeBlock}
      ${establishedBlock}
      ${contestedBlock}
      ${timelineBlock}
    </div>
    <aside class="subject-side">
      ${connectionsBlock}
      ${provenanceBlock}
    </aside>
  </div>
</article>

<style>
  .subject-page { max-width: 920px; margin: 0 auto; padding: 28px 0 80px; }
  .mode-band { display:flex; align-items:center; gap:14px; margin-bottom:22px;
    padding:12px 16px; border:1px solid var(--rule); border-radius:9px;
    background:var(--panel-soft, transparent); font-size:13.5px; color:var(--ink-3); }
  .mode-band a { color:var(--accent); text-decoration:none; font-weight:600; }
  .mode-band .here { color:var(--ink); }
  .subject-head { margin-bottom:32px; }
  .subject-head .kicker { font-size:11px; letter-spacing:.14em; color:var(--faint); text-transform:uppercase; margin-bottom:10px; }
  .subject-head h1 { font-family:var(--serif); font-size:42px; line-height:1.1; letter-spacing:-.02em; font-weight:600; margin-bottom:14px; }
  .subject-lede { font-family:var(--serif); font-size:19px; line-height:1.5; color:var(--ink-2); max-width:660px; }
  .subject-lede sup { color:var(--accent); font-size:11px; }
  .subject-grid { display:grid; grid-template-columns: 1fr 260px; gap:42px; }
  @media (max-width: 760px) { .subject-grid { grid-template-columns: 1fr; } }
  .sec-k { font-size:11px; letter-spacing:.14em; color:var(--faint); text-transform:uppercase; margin:30px 0 12px; }
  .sec-k:first-child { margin-top:0; }
  .fact-row { padding:13px 0; border-top:1px solid var(--rule); font-size:15.5px; color:var(--ink-2); }
  .fact-row b { color:var(--ink); font-weight:600; }
  .fact-row.last { border-bottom:1px solid var(--rule); }
  .fact-row sup { color:var(--accent); font-size:11px; cursor:pointer; }
  .contested-card { background:var(--panel-2, rgba(0,0,0,.15)); border:1px solid var(--rule);
    border-radius:11px; padding:18px 20px; margin-bottom:10px; }
  .contested-card .body { font-size:15.5px; color:var(--ink-2); margin-bottom:11px; }
  .contested-card .body b { color:var(--ink); font-weight:600; }
  .contested-meta { display:flex; gap:7px; flex-wrap:wrap; }
  .contested-meta .chip { font-size:11px; letter-spacing:.05em; padding:2px 9px;
    border:1px solid var(--rule); border-radius:99px; color:var(--ink-3); text-transform:uppercase; }
  .contested-meta .chip.balance { background:var(--panel-2, rgba(0,0,0,.2)); }
  .tl-row { display:flex; gap:14px; padding:11px 0; border-top:1px solid var(--rule); font-size:14.5px; color:var(--ink-2); }
  .tl-row .when { color:var(--faint); font-family:var(--mono); font-size:12px; min-width:84px; }
  .conn-row { padding:11px 0; border-top:1px solid var(--rule); font-size:13.5px; color:var(--ink-2); }
  .conn-row a { color:var(--accent); text-decoration:none; }
  .conn-row .why { display:block; color:var(--ink-3); font-size:12.5px; margin-top:2px; }
  .prov { padding:14px 16px; background:var(--panel-2, rgba(0,0,0,.15));
    border:1px solid var(--rule); border-radius:9px; font-size:12.5px; color:var(--ink-3); margin-top:18px; }
  .signed-band { background:var(--panel-2, rgba(0,0,0,.2)); border:1px solid var(--accent);
    border-radius:11px; padding:16px 20px; margin-bottom:22px; }
  .signed-band a { color:var(--accent); font-weight:600; text-decoration:none; }
  .signed-band .meta { color:var(--ink-3); font-size:12.5px; margin-top:4px; }
  .op-aff { display:flex; align-items:center; gap:12px; margin-bottom:18px; padding:9px 14px;
    border:1px dashed var(--rule); border-radius:8px; background:rgba(0,0,0,.02); flex-wrap:wrap; }
  .op-aff-label { font-size:10px; letter-spacing:.12em; text-transform:uppercase;
    color:var(--ink-3); font-weight:600; }
  .op-aff-btn { font-size:12.5px; padding:5px 12px; border-radius:6px; border:1px solid var(--rule);
    background:#fff; color:var(--ink); cursor:not-allowed; opacity:.6; }
  .op-aff-hint { font-size:12px; color:var(--ink-3); }
  .shape-block { padding:20px 22px; border:1px solid var(--rule); border-radius:9px;
    background:var(--panel-soft, rgba(0,0,0,.02)); margin-bottom:24px; }
  .shape-block .sec-k { margin-top:0; }
  .shape-block ul { list-style:none; padding:0; margin:10px 0 14px; }
  .shape-block li { font-size:14.5px; line-height:1.6; color:var(--ink-2); padding:7px 0;
    border-top:1px solid var(--rule); }
  .shape-block li:first-child { border-top:none; }
  .shape-block li b { color:var(--ink); font-weight:600; }
  .shape-block p { font-size:13.5px; color:var(--ink-3); font-style:italic; margin:0; }
</style>
`;

  return renderPage({
    title: subject.label,
    description:
      stripHtml(lede).slice(0, 200) ||
      `Reference page on ${subject.label} — sourced facts, contested claims, timeline.`,
    body,
    activeNav: "/topics",
    zone: "topics",
  });
}

// ===========================================================================
// SIGNED MODE — the operator's reading, prose with anchored facts
// ===========================================================================
async function renderSigned(
  env: PublicEnv,
  subject: SubjectRow,
  page: PageRow,
  hasSignedReading: boolean,
  isOperator: boolean,
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const bodyHtml = page.body_html || (page.body_md ? renderMarkdown(page.body_md) : "");
  const modeBand = renderModeBand(page.slug, "signed", hasSignedReading, page);
  // Faces (spec v2.5 Part 24) — the four formats of this reading. Pre-rendered
  // on signing; appear as tabs at the bottom of the page. Each face is either
  // ready, rendering, queued, or failed; the renderer reflects the state.
  // Operator gets per-face Re-render buttons when faces aren't ready.
  const faces = await loadFaces(env, page.id);
  const facesBlock = renderFacesBlock(faces, page.id, isOperator);

  const meta: string[] = [];
  if (page.signed_by) meta.push(`signed · ${escapeHtml(page.signed_by)}`);
  if (page.signed_at) meta.push(escapeHtml(page.signed_at.slice(0, 10)));
  if (page.confidence) meta.push(`confidence · ${escapeHtml(page.confidence)}`);
  if (page.claims_verified) meta.push(`${page.claims_verified} claims verified`);

  // The firewall, made visible IN the reading: any contested assertion this
  // subject carries MUST be shown, by rule, not by the writer's choice. This
  // is what makes a signed reading trustworthy — it cannot hide the facts
  // that complicate it.
  const contested = userId
    ? (await loadContestedAssertions(env, userId, subject.node_id)).filter(
        (a) => a.rank === "contested" || (a.evidence_balance ?? 0) < 1,
      )
    : [];
  const complicateBox = contested.length
    ? `<div class="complicate">
  <div class="ch">What complicates this reading — shown by rule, not choice</div>
  ${contested
    .slice(0, 4)
    .map(
      (a) =>
        `<p><i>"${escapeHtml(a.label)}"</i> — ${a.actor ? `asserted by ${escapeHtml(a.actor)}; ` : ""}${a.rank === "contested" ? "contested" : "weakly supported"} in the record${a.piece_slug ? ` (<a href="/library/${escapeAttr(a.piece_slug)}">source</a>)` : ""}. This reading must engage it, not omit it.</p>`,
    )
    .join("")}
</div>`
    : "";

  // Operator affordances on a signed reading: Edit (open the existing
  // /op/out/:id/edit screen), Re-sign placeholder, Discard. The handler
  // routes are already mounted under /op/out — PR 1 surfaces them inline
  // on the public URL the operator landed on, instead of bouncing them
  // through a separate console.
  const opSignedAff = isOperator
    ? `<div class="op-aff">
  <span class="op-aff-label">Operator</span>
  <a class="op-aff-btn op-aff-btn-action" href="/op/out/${escapeAttr(page.id)}/edit">Edit reading</a>
  <form method="POST" action="/op/out/${escapeAttr(page.id)}/discard" style="display:inline" onsubmit="return confirm('Discard this signed reading?');">
    <button class="op-aff-btn op-aff-btn-action" type="submit">Discard</button>
  </form>
</div>`
    : "";

  const intentLabel = page.intent ? (INTENT_LABELS[page.intent] ?? page.intent) : "";
  const intentBadge = page.intent
    ? `<span class="intent-badge intent-${escapeAttr(page.intent)}">${escapeHtml(intentLabel)}</span>`
    : "";

  const body = `
<article class="subject-page">
  ${modeBand}
  ${opSignedAff}
  <header class="signed-head">
    <div class="kicker">${escapeHtml(subjectKindLabel(subject.kind))} · the operator's reading ${intentBadge}</div>
    <h1>${escapeHtml(subject.label)}</h1>
    ${page.thesis ? `<p class="thesis">${escapeHtml(page.thesis)}</p>` : ""}
    ${meta.length ? `<div class="signed-meta">${meta.join(" · ")}</div>` : ""}
  </header>
  <div class="prose signed-body">${bodyHtml}</div>
  ${complicateBox}
  ${facesBlock}
  <div class="prov" style="margin-top:32px">
    The operator drafted and signed this reading. Every load-bearing fact links down to a quote in a stored
    source document. Contested material appears attributed; the firewall kills any assertion-backed claim
    without attribution before publish.
  </div>
  <p style="margin-top:18px"><a href="/p/${escapeAttr(page.slug)}" style="color:var(--accent);text-decoration:none">↩ See the neutral facts this reading stands on</a></p>
</article>

<style>
  .subject-page { max-width: 760px; margin: 0 auto; padding: 28px 0 80px; }
  .mode-band { display:flex; align-items:center; gap:14px; margin-bottom:22px;
    padding:12px 16px; border:1px solid var(--rule); border-radius:9px;
    font-size:13.5px; color:var(--ink-3); }
  .mode-band a { color:var(--accent); text-decoration:none; font-weight:600; }
  .mode-band .here { color:var(--ink); }
  .signed-head { margin-bottom:28px; }
  .signed-head .kicker { font-size:11px; letter-spacing:.14em; color:var(--accent); text-transform:uppercase; margin-bottom:10px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .intent-badge { font-size:10px; padding:2px 9px; border-radius:4px; font-weight:600;
    letter-spacing:.04em; }
  .intent-investigation { background:#e6efe9; color:#1d6a5e; }
  .intent-argument { background:#f4e9e6; color:#8a3324; }
  .intent-pattern { background:#e8eef7; color:#33567e; }
  .intent-hypothesis { background:#ece6f2; color:#5a4a7e; }
  .intent-assessment { background:#f1ead9; color:#7a6324; }
  .intent-critique { background:#f4e3e0; color:#964434; }
  .intent-explanation { background:#e4ecef; color:#3a6a7e; }
  .signed-head h1 { font-family:var(--serif); font-size:42px; line-height:1.1; letter-spacing:-.02em; font-weight:600; margin-bottom:16px; }
  .signed-head .thesis { font-family:var(--serif); font-size:22px; line-height:1.45; color:var(--ink); font-style:italic; margin-bottom:12px; }
  .signed-head .signed-meta { font-size:12.5px; color:var(--faint); letter-spacing:.04em; text-transform:uppercase; }
  .signed-body { font-family:var(--serif); font-size:18px; line-height:1.62; color:var(--ink-2); }
  .signed-body p { margin-bottom:18px; }
  .signed-body sup { color:var(--accent); font-size:11px; }
  .signed-body .factref { background:var(--panel-2, rgba(0,0,0,.18)); border-bottom:1px solid var(--accent); padding:0 2px; cursor:pointer; }
  .complicate { border:1px solid var(--accent); background:var(--panel-2, rgba(0,0,0,.18)); border-radius:9px; padding:14px 18px; margin:24px 0; }
  .complicate .ch { font-size:10px; letter-spacing:.09em; text-transform:uppercase; color:var(--accent); margin-bottom:8px; font-weight:600; }
  .complicate p { font-family:var(--sans); font-size:14px; line-height:1.55; color:var(--ink-3); margin-bottom:8px; }
  .complicate p:last-child { margin-bottom:0; }
  .complicate a { color:var(--accent); text-decoration:none; }
  .prov { padding:14px 16px; background:var(--panel-2, rgba(0,0,0,.15)); border:1px solid var(--rule); border-radius:9px; font-size:12.5px; color:var(--ink-3); }
  .op-aff { display:flex; align-items:center; gap:12px; margin-bottom:18px; padding:9px 14px;
    border:1px dashed var(--rule); border-radius:8px; background:rgba(0,0,0,.02); flex-wrap:wrap; }
  .op-aff-label { font-size:10px; letter-spacing:.12em; text-transform:uppercase;
    color:var(--ink-3); font-weight:600; }
  .op-aff-btn { font-size:12.5px; padding:5px 12px; border-radius:6px; border:1px solid var(--rule);
    background:#fff; color:var(--ink); text-decoration:none; cursor:pointer; }
  .op-aff-btn-action { cursor:pointer; opacity:1; }
</style>
`;

  return renderPage({
    title: `${subject.label} — the operator's reading`,
    description: page.thesis?.slice(0, 200) ?? `Signed reading of ${subject.label}.`,
    body,
    activeNav: "/topics",
    zone: "topics",
  });
}

// ===========================================================================
// THEME NEUTRAL MODE — the received-account view
// ===========================================================================
async function renderThemePageNeutral(
  env: PublicEnv,
  subject: SubjectRow,
  page: PageRow,
  theme: ThemeRow | null,
  hasSignedReading: boolean,
  _isOperator: boolean,
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId || !theme) {
    return renderPage({ title: subject.label, body: "", description: "" });
  }

  // The complicating evidence is the contradicting assertions the theme was
  // surfaced from. Read the evidence_quote_ids list and resolve each.
  const evidenceQuoteIds: string[] = parseJson(
    theme["evidence_quote_ids" as keyof ThemeRow] ?? "[]",
    [],
  );
  let evidence: Array<{
    verbatim_text: string;
    piece_slug: string | null;
    piece_title: string | null;
    actor: string | null;
  }> = [];
  if (evidenceQuoteIds.length > 0) {
    const placeholders = evidenceQuoteIds.map(() => "?").join(",");
    evidence = await all<{
      verbatim_text: string;
      piece_slug: string | null;
      piece_title: string | null;
      actor: string | null;
    }>(
      env.DB,
      `SELECT q.verbatim_text,
              p.slug AS piece_slug, p.title AS piece_title,
              (SELECT label FROM nodes WHERE id = a.asserted_by_node_id) AS actor
         FROM quotes q
         JOIN nodes n ON n.id = q.node_id
         LEFT JOIN assertions a ON a.node_id = n.id
         LEFT JOIN pieces p ON p.id = n.piece_id
        WHERE q.id IN (${placeholders}) AND q.user_id = ?
        LIMIT 12`,
      [...evidenceQuoteIds, userId],
    );
  }

  const modeBand = renderModeBand(page.slug, "neutral", hasSignedReading, page);
  const evidenceBlock = evidence.length
    ? `<div class="sec-k">How the corpus complicates it</div>
${evidence
  .map(
    (e) => `<div class="evidence-card">
  <blockquote>“${escapeHtml(e.verbatim_text.slice(0, 320))}${e.verbatim_text.length > 320 ? "…" : ""}”</blockquote>
  <div class="evidence-src">${e.actor ? `${escapeHtml(e.actor)} · ` : ""}${e.piece_title ? `<a href="/library/${escapeAttr(e.piece_slug ?? "")}">${escapeHtml(e.piece_title)}</a>` : "source unknown"}</div>
</div>`,
  )
  .join("")}`
    : "";

  const body = `
<article class="subject-page">
  ${modeBand}
  <header class="subject-head">
    <div class="kicker">Theme · what the corpus is engaging with</div>
    <h1>${escapeHtml(subject.label)}</h1>
    <div class="received">
      <div class="received-k">The received account</div>
      <p>${escapeHtml(theme.received_account)}</p>
    </div>
    <p class="convergence">Surfaced from ${theme.convergence_count} independent source documents that push back on this account.</p>
  </header>

  ${evidenceBlock}

  <div class="prov" style="margin-top:32px">
    Themes are surfaced deterministically — the system only NAMES the received account. The convergence
    of contradicting evidence across multiple sources is what makes a theme real. ${hasSignedReading ? "" : "Nobody has signed a reading of this theme yet."}
  </div>
</article>

<style>
  .subject-page { max-width: 760px; margin: 0 auto; padding: 28px 0 80px; }
  .mode-band { display:flex; align-items:center; gap:14px; margin-bottom:22px;
    padding:12px 16px; border:1px solid var(--rule); border-radius:9px; font-size:13.5px; color:var(--ink-3); }
  .mode-band a { color:var(--accent); text-decoration:none; font-weight:600; }
  .mode-band .here { color:var(--ink); }
  .subject-head .kicker { font-size:11px; letter-spacing:.14em; color:var(--accent); text-transform:uppercase; margin-bottom:10px; }
  .subject-head h1 { font-family:var(--serif); font-size:36px; line-height:1.15; letter-spacing:-.02em; font-weight:600; margin-bottom:24px; }
  .received { background:var(--panel-2, rgba(0,0,0,.15)); border-left:3px solid var(--accent);
    padding:16px 20px; margin-bottom:18px; }
  .received-k { font-size:10.5px; letter-spacing:.14em; color:var(--faint); text-transform:uppercase; margin-bottom:6px; }
  .received p { font-family:var(--serif); font-size:20px; line-height:1.45; color:var(--ink); font-style:italic; }
  .convergence { font-size:13.5px; color:var(--ink-3); }
  .sec-k { font-size:11px; letter-spacing:.14em; color:var(--faint); text-transform:uppercase; margin:30px 0 14px; }
  .evidence-card { padding:14px 16px; border:1px solid var(--rule); border-radius:9px; margin-bottom:10px; }
  .evidence-card blockquote { font-family:var(--serif); font-size:16px; line-height:1.5; color:var(--ink-2); font-style:italic;
    border-left:2px solid var(--accent); padding-left:14px; margin-bottom:8px; }
  .evidence-src { font-size:12.5px; color:var(--faint); }
  .evidence-src a { color:var(--accent); text-decoration:none; }
  .prov { padding:14px 16px; background:var(--panel-2, rgba(0,0,0,.15)); border:1px solid var(--rule); border-radius:9px; font-size:12.5px; color:var(--ink-3); }
</style>
`;

  return renderPage({
    title: subject.label,
    description: theme.received_account.slice(0, 200),
    body,
    activeNav: "/topics",
    zone: "topics",
  });
}

// ===========================================================================
// Section loaders — small SQL functions, kept narrow
// ===========================================================================

// Established facts: neutral_fact nodes connected to this subject, with their
// supporting quote. The 'aboutness' edge family is the canonical "fact about X"
// link; we also accept neutral_facts directly attached to the subject's piece.
async function loadEstablishedFacts(
  env: PublicEnv,
  userId: string,
  subjectId: string,
): Promise<FactRow[]> {
  return all<FactRow>(
    env.DB,
    `SELECT n.id, n.label, n.kind, n.metadata,
            q.id AS quote_id, q.verbatim_text AS quote_text,
            p.slug AS piece_slug, p.title AS piece_title
       FROM nodes n
       LEFT JOIN edges e ON (e.dst_node_id = ? AND e.src_node_id = n.id AND e.family = 'aboutness')
       LEFT JOIN quotes q ON q.node_id = n.id
       LEFT JOIN pieces p ON p.id = n.piece_id
      WHERE n.user_id = ?
        AND n.kind = 'neutral_fact'
        AND (e.id IS NOT NULL OR EXISTS (
              SELECT 1 FROM edges e2 WHERE e2.src_node_id = ? AND e2.dst_node_id = n.id
            )
            OR n.label LIKE ?
            OR (SELECT label FROM nodes WHERE id = ?) LIKE '%' || substr(n.label, 1, 30) || '%')
      GROUP BY n.id
      ORDER BY n.created_at DESC
      LIMIT 12`,
    [subjectId, userId, subjectId, `%${subjectId.slice(0, 8)}%`, subjectId],
  ).catch(async () => {
    // Fallback: grab the most recent neutral facts touching the subject's piece.
    return all<FactRow>(
      env.DB,
      `SELECT n.id, n.label, n.kind, n.metadata,
              q.id AS quote_id, q.verbatim_text AS quote_text,
              p.slug AS piece_slug, p.title AS piece_title
         FROM nodes n
         LEFT JOIN quotes q ON q.node_id = n.id
         LEFT JOIN pieces p ON p.id = n.piece_id
        WHERE n.user_id = ? AND n.kind = 'neutral_fact'
        ORDER BY n.created_at DESC LIMIT 8`,
      [userId],
    ).catch(() => []);
  });
}

async function loadContestedAssertions(
  env: PublicEnv,
  userId: string,
  subjectId: string,
): Promise<AssertionRow[]> {
  return all<AssertionRow>(
    env.DB,
    `SELECT n.id AS node_id, n.label,
            (SELECT label FROM nodes WHERE id = a.asserted_by_node_id) AS actor,
            a.stance, a.evidence_balance, a.rank,
            q.verbatim_text AS quote_text,
            p.slug AS piece_slug, p.title AS piece_title
       FROM nodes n
       JOIN assertions a ON a.node_id = n.id
       LEFT JOIN quotes q ON q.node_id = n.id
       LEFT JOIN pieces p ON p.id = n.piece_id
      WHERE n.user_id = ? AND n.kind = 'assertion'
        AND (EXISTS (SELECT 1 FROM edges e WHERE e.src_node_id = n.id AND e.dst_node_id = ?)
             OR EXISTS (SELECT 1 FROM edges e WHERE e.dst_node_id = n.id AND e.src_node_id = ?))
      GROUP BY n.id
      ORDER BY (a.rank = 'contested') DESC, a.updated_at DESC
      LIMIT 8`,
    [userId, subjectId, subjectId],
  ).catch(() => []);
}

async function loadTimelineEvents(
  env: PublicEnv,
  userId: string,
  subjectId: string,
): Promise<EventRow[]> {
  return all<EventRow>(
    env.DB,
    `SELECT n.id, n.label,
            json_extract(n.metadata, '$.event_date') AS event_date,
            (SELECT verbatim_text FROM quotes WHERE node_id = n.id LIMIT 1) AS quote_text,
            (SELECT slug FROM pieces WHERE id = n.piece_id) AS piece_slug
       FROM nodes n
      WHERE n.user_id = ? AND n.kind = 'event'
        AND (EXISTS (SELECT 1 FROM edges e WHERE e.src_node_id = n.id AND e.dst_node_id = ?)
             OR EXISTS (SELECT 1 FROM edges e WHERE e.dst_node_id = n.id AND e.src_node_id = ?))
      ORDER BY json_extract(n.metadata, '$.event_date') ASC
      LIMIT 12`,
    [userId, subjectId, subjectId],
  ).catch(() => []);
}

async function loadConnections(
  env: PublicEnv,
  userId: string,
  subjectId: string,
): Promise<ConnectionRow[]> {
  return all<ConnectionRow>(
    env.DB,
    `SELECT
       CASE WHEN e.src_node_id = ? THEN e.dst_node_id ELSE e.src_node_id END AS other_node_id,
       (SELECT label FROM nodes WHERE id =
         CASE WHEN e.src_node_id = ? THEN e.dst_node_id ELSE e.src_node_id END) AS other_label,
       (SELECT kind FROM nodes WHERE id =
         CASE WHEN e.src_node_id = ? THEN e.dst_node_id ELSE e.src_node_id END) AS other_kind,
       e.edge_type, e.family, e.weight
     FROM edges e
     WHERE e.user_id = ?
       AND (e.src_node_id = ? OR e.dst_node_id = ?)
       AND e.family IN ('relationship', 'aboutness')
     GROUP BY other_node_id
     ORDER BY e.weight DESC
     LIMIT 8`,
    [subjectId, subjectId, subjectId, userId, subjectId, subjectId],
  ).catch(() => []);
}

async function loadSourceCount(env: PublicEnv, userId: string, subjectId: string): Promise<number> {
  const row = await one<{ n: number }>(
    env.DB,
    `SELECT COUNT(DISTINCT piece_id) AS n FROM nodes
      WHERE user_id = ? AND piece_id IS NOT NULL
        AND (id = ? OR EXISTS (
          SELECT 1 FROM edges e
          WHERE (e.src_node_id = nodes.id AND e.dst_node_id = ?)
             OR (e.dst_node_id = nodes.id AND e.src_node_id = ?)))`,
    [userId, subjectId, subjectId, subjectId],
  ).catch(() => null);
  return row?.n ?? 0;
}

// ===========================================================================
// Block renderers
// ===========================================================================

function buildLede(_subject: SubjectRow, facts: FactRow[]): string {
  // Take up to two leading neutral facts and weave them into a lede sentence.
  // Each fact gets its quote receipt as a superscript link. When no facts
  // have been extracted yet, the lede is intentionally absent — the shape
  // block below tells the reader what will fill the page. (Cleaner than a
  // placeholder sentence pretending to be a lede.)
  if (facts.length === 0) return "";
  const top = facts.slice(0, 2);
  const joined = top
    .map(
      (f, i) =>
        `${escapeHtml(f.label)}${f.quote_id ? `<sup title="${escapeAttr(f.quote_text?.slice(0, 120) ?? "")}">${i + 1}</sup>` : ""}`,
    )
    .join(". ");
  return `${joined}.`;
}

function renderEstablishedBlock(facts: FactRow[]): string {
  if (facts.length === 0) return "";
  const rows = facts
    .map(
      (f, i) =>
        `<div class="fact-row${i === facts.length - 1 ? " last" : ""}"><b>${escapeHtml(f.label)}</b>${f.quote_id ? ` <sup title="${escapeAttr(f.quote_text?.slice(0, 120) ?? "")}">${i + 1}</sup>` : ""}${f.piece_title ? ` <span style="color:var(--faint);font-size:12.5px"> · <a href="/library/${escapeAttr(f.piece_slug ?? "")}" style="color:var(--faint)">${escapeHtml(f.piece_title.slice(0, 40))}</a></span>` : ""}</div>`,
    )
    .join("");
  return `<section id="established" data-schema="ItemList"><div class="sec-k">Established</div>${rows}</section>`;
}

function renderContestedBlock(rows: AssertionRow[]): string {
  if (rows.length === 0) return "";
  const cards = rows
    .map((a) => {
      const balance = a.evidence_balance ?? 0;
      const balanceChip =
        a.rank === "contested"
          ? `<span class="chip balance">contested · ${balance >= 0 ? "+" : ""}${balance.toFixed(1)}</span>`
          : balance > 0
            ? `<span class="chip balance">+${balance.toFixed(1)} support</span>`
            : balance < 0
              ? `<span class="chip balance">${balance.toFixed(1)} support</span>`
              : "";
      return `<div class="contested-card">
  <div class="body"><i>"${escapeHtml(a.label)}"</i></div>
  <div class="contested-meta">
    ${a.actor ? `<span class="chip">asserted by · ${escapeHtml(a.actor)}</span>` : `<span class="chip">unattributed</span>`}
    <span class="chip">stance · ${escapeHtml(a.stance)}</span>
    ${balanceChip}
    ${a.piece_title ? `<span class="chip"><a href="/library/${escapeAttr(a.piece_slug ?? "")}" style="color:inherit;text-decoration:none">source</a></span>` : ""}
  </div>
</div>`;
    })
    .join("");
  return `<section id="contested" data-schema="Claim"><div class="sec-k">Contested — shown as contested</div>${cards}</section>`;
}

function renderTimelineBlock(events: EventRow[]): string {
  if (events.length === 0) return "";
  const rows = events
    .map((e, i) => {
      const when = e.event_date?.slice(0, 7) ?? "—";
      return `<div class="tl-row${i === events.length - 1 ? " last" : ""}"><span class="when">${escapeHtml(when)}</span> <span>${escapeHtml(e.label)}${e.piece_slug ? ` <a href="/library/${escapeAttr(e.piece_slug)}" style="color:var(--accent);font-size:12px">↗</a>` : ""}</span></div>`;
    })
    .join("");
  return `<section id="timeline" data-schema="Event"><div class="sec-k">Timeline</div>${rows}</section>`;
}

function renderConnectionsBlock(conns: ConnectionRow[]): string {
  if (conns.length === 0) return "";
  const rows = conns
    .map(
      (c) =>
        `<div class="conn-row"><a href="/topics/${escapeAttr(slugifyConnection(c.other_label))}">${escapeHtml(c.other_label)}</a><span class="why">${escapeHtml(c.edge_type)}${c.family !== "relationship" ? ` · ${c.family}` : ""}</span></div>`,
    )
    .join("");
  return `<section id="connections" data-schema="OwnershipInfo"><div class="sec-k">Connections</div>${rows}</section>`;
}

function renderProvenance(sourceCount: number, hasSigned: boolean, page: PageRow): string {
  const lines: string[] = [];
  if (sourceCount > 0) {
    lines.push(
      `Appears in ${sourceCount} source document${sourceCount === 1 ? "" : "s"} in the Library.`,
    );
  }
  if (hasSigned && page.signed_status !== "none") {
    lines.push("<b>The operator has signed a reading of this subject.</b>");
  } else {
    lines.push("Nobody has signed a reading of this subject yet.");
  }
  lines.push("This page is not written — it is the knowledge graph, rendered.");
  return `<div class="prov">${lines.join("<br/>")}</div>`;
}

function renderModeBand(
  slug: string,
  current: "neutral" | "signed",
  hasSigned: boolean,
  page: PageRow,
): string {
  if (current === "signed") {
    return `<div class="mode-band signed-band">
  <span class="here">You are reading the operator's signed reading.</span>
  <a href="/p/${escapeAttr(slug)}">See the neutral page →</a>
</div>`;
  }
  if (!hasSigned) {
    return "";
  }
  const thesisPreview = page.thesis
    ? `"${escapeHtml(page.thesis.slice(0, 140))}${page.thesis.length > 140 ? "…" : ""}"`
    : "the operator's reading of this subject";
  return `<div class="mode-band signed-band">
  <span class="here">The operator has signed a reading:</span>
  <a href="/p/${escapeAttr(slug)}?mode=signed">Read it →</a>
  <div class="meta" style="flex-basis:100%;margin-top:4px">${thesisPreview}</div>
</div>`;
}

// ===========================================================================
// helpers
// ===========================================================================

// schema.org JSON-LD for the subject page. The @type follows the subject
// kind; timeline events become a hasPart ItemList. Built defensively — only
// fields we actually have. This is the citability payoff (Princeton GEO):
// AI engines cite schema-tagged, sourced pages over general sources.
function buildSubjectJsonLd(
  subject: SubjectRow,
  page: PageRow,
  facts: FactRow[],
  events: EventRow[],
): string {
  const typeMap: Record<string, string> = {
    entity: "Thing",
    event: "Event",
    theme: "CreativeWork",
  };
  const graph: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": typeMap[subject.kind] ?? "Thing",
    name: subject.label,
    url: `/s/${page.slug}`,
  };
  if (page.signed_at) graph.dateModified = page.signed_at.slice(0, 10);
  if (facts.length > 0) {
    graph.description = facts
      .slice(0, 3)
      .map((f) => f.label)
      .join(". ");
  }
  if (events.length > 0) {
    graph.subjectOf = events.slice(0, 12).map((e) => ({
      "@type": "Event",
      name: e.label,
      ...(e.event_date ? { startDate: e.event_date } : {}),
    }));
  }
  // Escape </script> to keep the JSON-LD from breaking out of its tag.
  return JSON.stringify(graph).replace(/<\/script/gi, "<\\/script");
}

function subjectKindLabel(kind: string): string {
  switch (kind) {
    case "entity":
      return "Reference · Entity";
    case "event":
      return "Reference · Event";
    case "theme":
      return "Reference · Theme";
    default:
      return "Reference";
  }
}

function slugifyConnection(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

// ===========================================================================
// FACES (spec v2.5 Part 24) — thread / script / meme / chapter rendered into
// the signed reading. No generate buttons, no Studio destination; faces are
// pre-rendered on signing (operator/routes.ts:/out/:id/sign queues them via
// waitUntil) and surface here as a tab strip. Each face is either ready,
// rendering, queued, or failed — the renderer reflects state honestly.
// ===========================================================================

interface FaceRow {
  kind: string;
  body_html: string | null;
  body_md: string | null;
  status: string;
  error: string | null;
  updated_at: string;
}

async function loadFaces(env: PublicEnv, pageId: string): Promise<FaceRow[]> {
  return all<FaceRow>(
    env.DB,
    `SELECT kind, body_html, body_md, status, error, updated_at
       FROM page_faces WHERE page_id = ?
      ORDER BY CASE kind
                  WHEN 'thread' THEN 0 WHEN 'script' THEN 1
                  WHEN 'meme' THEN 2 WHEN 'chapter' THEN 3 ELSE 9 END`,
    [pageId],
  ).catch(() => []);
}

const FACE_LABELS: Record<string, string> = {
  thread: "Thread",
  script: "Video script",
  meme: "Meme",
  chapter: "Chapter outline",
};

const FACE_HINTS: Record<string, string> = {
  thread: "Thesis + the four most cutting facts, one per post.",
  script: "Locked reasoning skeleton for a 3–4 minute video — structure, not voice.",
  meme: "Thesis over the single most damning fact.",
  chapter: "The reading's structure expanded for long-form treatment.",
};

function renderFacesBlock(faces: FaceRow[], pageId?: string, isOperator?: boolean): string {
  if (faces.length === 0) return "";
  // The first ready face is opened by default; the rest are headed but
  // collapsed (server-rendered, no-JS — just <details>).
  const orderedKinds = ["thread", "script", "meme", "chapter"];
  const byKind = new Map<string, FaceRow>(faces.map((f) => [f.kind, f]));
  let firstReadyShown = false;
  const items = orderedKinds
    .map((kind) => {
      const f = byKind.get(kind);
      if (!f) return "";
      const label = FACE_LABELS[kind] ?? kind;
      const hint = FACE_HINTS[kind] ?? "";
      const open = !firstReadyShown && f.status === "ready";
      if (open) firstReadyShown = true;
      // The operator's per-face Retry affordance — surfaces when the face
      // failed or stayed queued/rendering past a fresh sign. Public readers
      // never see it (it's a POST against an /op/* action endpoint).
      const retryBtn =
        isOperator &&
        pageId &&
        (f.status === "failed" || f.status === "rendering" || f.status === "queued")
          ? `<form method="POST" action="/op/faces/${escapeAttr(pageId)}/${escapeAttr(kind)}/render" style="display:inline">
  <button class="face-retry" type="submit">Re-render</button>
</form>`
          : "";
      const inner =
        f.status === "ready"
          ? `<div class="face-body">${f.body_html ?? escapeHtml(f.body_md ?? "")}</div>`
          : f.status === "failed"
            ? `<div class="face-fail">Render failed${f.error ? `: ${escapeHtml(f.error)}` : ""}.${retryBtn ? "" : " Re-sign the reading to retry."}${retryBtn}</div>`
            : `<div class="face-pending">Rendering — this face is being generated in the background. Reload in a moment.${retryBtn}</div>`;
      const statusChip =
        f.status === "ready"
          ? `<span class="face-chip face-ready">ready</span>`
          : f.status === "failed"
            ? `<span class="face-chip face-fail-chip">failed</span>`
            : `<span class="face-chip face-pending-chip">${escapeHtml(f.status)}</span>`;
      return `<details class="face" ${open ? "open" : ""}>
  <summary>
    <span class="face-label">${escapeHtml(label)}</span>
    ${statusChip}
    <span class="face-hint">${escapeHtml(hint)}</span>
  </summary>
  ${inner}
</details>`;
    })
    .join("");
  return `<section class="faces" aria-label="Faces of this reading">
  <div class="faces-head">
    <div class="faces-k">Faces of this reading</div>
    <div class="faces-sub">Selection, not regeneration — the reading carries all truth claims; these formats re-arrange them.</div>
  </div>
  ${items}
</section>
<style>
  .faces { margin:36px 0 8px; padding:18px 20px; border:1px solid var(--rule);
    border-radius:11px; background:var(--panel-soft, rgba(0,0,0,.02)); }
  .faces-head { margin-bottom:12px; }
  .faces-k { font-size:11px; letter-spacing:.14em; text-transform:uppercase;
    color:var(--ink-3); font-weight:600; margin-bottom:4px; }
  .faces-sub { font-size:12.5px; color:var(--ink-3); font-style:italic; }
  .face { border-top:1px solid var(--rule); padding:11px 0; }
  .face:first-of-type { border-top:none; }
  .face summary { cursor:pointer; display:flex; align-items:center; gap:10px;
    flex-wrap:wrap; list-style:none; user-select:none; }
  .face summary::-webkit-details-marker { display:none; }
  .face-label { font-family:var(--serif); font-size:16px; color:var(--ink); }
  .face-chip { font-size:9.5px; letter-spacing:.08em; padding:2px 7px; border-radius:3px;
    text-transform:uppercase; font-weight:600; }
  .face-ready { background:var(--confirmed-bg, #e7f0e6); color:var(--confirmed, #2f7d52); }
  .face-fail-chip { background:var(--correction-bg, #f6e4df); color:var(--correction, #b0402c); }
  .face-pending-chip { background:rgba(0,0,0,.06); color:var(--ink-3); }
  .face-hint { font-size:12px; color:var(--ink-3); margin-left:auto; flex:1; text-align:right; min-width:200px; }
  .face-body { margin-top:12px; font-size:14.5px; line-height:1.65; color:var(--ink-2); }
  .face-body p { margin-bottom:10px; }
  .face-body strong { color:var(--ink); }
  .face-fail { margin-top:10px; padding:9px 12px; border-radius:6px;
    background:var(--correction-bg, #f6e4df); color:var(--correction, #b0402c); font-size:13px; }
  .face-pending { margin-top:10px; padding:9px 12px; border-radius:6px;
    background:rgba(0,0,0,.04); color:var(--ink-3); font-size:13px; font-style:italic; }
  .face-retry { font-size:11.5px; padding:4px 11px; margin-left:9px; border-radius:5px;
    border:1px solid var(--rule); background:#fff; color:var(--ink); cursor:pointer; }
  .face-retry:hover { background:var(--accent-bg, #e8ecf3); }
  @media(max-width:680px) { .face-hint { text-align:left; min-width:0; flex-basis:100%; margin-left:0; } }
</style>`;
}

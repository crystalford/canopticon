// Memetic faces — three new single-image formats (2026-07-24), alongside
// card.ts's original thesis-card. Where card.ts compresses TOWARD AN
// ARGUMENT (a thesis, supported), these compress toward a single
// irreducible frame that survives getting screenshotted with no context.
// Same rule as everywhere else this session touched tone: the irony has
// to come from juxtaposing true things already in the graph, never from
// invented spin — every one of these is pure template + query over
// already judge-verified or mechanically-verified rows, no LLM at
// render time.
//
//   contradiction  — a self-contradiction pair (graph/lib/self-
//                    contradictions.ts). "On record, both ways."
//   versus         — a contested assertion, claim-vs-record. Reuses the
//                    exact plain-language balance wording subject-
//                    page.ts's Contested block already uses — no new
//                    framing invented for this format.
//   timeline-drop  — a handful of dated facts, zero commentary. The
//                    pattern does the work.

import { all } from "../../../lib/d1";
import { escapeAttr, escapeHtml } from "../../layout";

// ---------------------------------------------------------------------------
// contradiction
// ---------------------------------------------------------------------------
interface ContradictionRow {
  tension_summary: string;
  quote_a_text: string;
  quote_a_id: string | null;
  piece_a_title: string | null;
  quote_b_text: string;
  quote_b_id: string | null;
  piece_b_title: string | null;
}

export async function loadTopContradiction(
  db: D1Database,
  subjectNodeId: string,
): Promise<ContradictionRow | null> {
  const rows = await all<ContradictionRow>(
    db,
    `SELECT tension_summary, quote_a_text, quote_a_id, piece_a_title,
            quote_b_text, quote_b_id, piece_b_title
       FROM self_contradictions
      WHERE person_node_id = ? AND judge_pass = 1
      ORDER BY created_at DESC
      LIMIT 1`,
    [subjectNodeId],
  ).catch(() => []);
  return rows[0] ?? null;
}

export async function renderContradictionFace(
  db: D1Database,
  subjectNodeId: string,
): Promise<string> {
  const row = await loadTopContradiction(db, subjectNodeId);
  if (!row) {
    return emptyFace("No verified self-contradiction on file yet for this subject.");
  }
  return `<div class="meme-face meme-contradiction">
  <div class="card-meta">On record, both ways · pure rendering, no LLM</div>
  <div class="card-art">
    <blockquote class="meme-quote">"${escapeHtml(row.quote_a_text)}"</blockquote>
    <div class="meme-vs">—</div>
    <blockquote class="meme-quote">"${escapeHtml(row.quote_b_text)}"</blockquote>
    <div class="card-receipt">${escapeHtml(row.tension_summary)}</div>
  </div>
</div>
${MEME_STYLES}`;
}

// ---------------------------------------------------------------------------
// versus — claim vs. record
// ---------------------------------------------------------------------------
interface VersusRow {
  label: string;
  actor: string | null;
  evidence_balance: number;
  rank: string;
  quote_text: string | null;
  quote_id: string | null;
  piece_title: string | null;
}

async function loadTopContested(db: D1Database, subjectNodeId: string): Promise<VersusRow | null> {
  const rows = await all<VersusRow>(
    db,
    `SELECT n.label,
            (SELECT label FROM nodes WHERE id = a.asserted_by_node_id) AS actor,
            a.evidence_balance, a.rank,
            q.verbatim_text AS quote_text,
            q.id AS quote_id,
            p.title AS piece_title
       FROM nodes n
       JOIN assertions a ON a.node_id = n.id
       LEFT JOIN quotes q ON q.node_id = n.id
       LEFT JOIN pieces p ON p.id = n.piece_id
      WHERE n.user_id = (SELECT user_id FROM nodes WHERE id = ?)
        AND n.kind = 'assertion'
        AND (EXISTS (SELECT 1 FROM edges e WHERE e.src_node_id = n.id AND e.dst_node_id = ?)
             OR EXISTS (SELECT 1 FROM edges e WHERE e.dst_node_id = n.id AND e.src_node_id = ?))
      ORDER BY (a.rank = 'contested') DESC, a.updated_at DESC
      LIMIT 1`,
    [subjectNodeId, subjectNodeId, subjectNodeId],
  ).catch(() => []);
  return rows[0] ?? null;
}

// Same plain-language balance wording as subject-page.ts's Contested
// block — deliberately not reworded here, so this card never says
// something about a claim's strength that the neutral page doesn't.
function balanceLine(row: VersusRow): string {
  if (row.rank === "contested") {
    return "Evidence is genuinely split — real support and real pushback both on record.";
  }
  if (row.evidence_balance > 0.5) return "The evidence on file mostly supports this.";
  if (row.evidence_balance < -0.5) return "The evidence on file mostly runs against this.";
  return "Not yet independently weighed — one source's claim, unconfirmed elsewhere.";
}

export async function renderVersusFace(db: D1Database, subjectNodeId: string): Promise<string> {
  const row = await loadTopContested(db, subjectNodeId);
  if (!row || !row.quote_text) {
    return emptyFace("No contested claim on file yet for this subject.");
  }
  return `<div class="meme-face meme-versus">
  <div class="card-meta">Claim vs. record · pure rendering, no LLM</div>
  <div class="card-art">
    <div class="meme-versus-label">CLAIMED${row.actor ? ` — ${escapeHtml(row.actor)}` : ""}</div>
    <blockquote class="meme-quote">"${escapeHtml(row.quote_text)}"</blockquote>
    <div class="meme-versus-label meme-versus-label-record">ON RECORD</div>
    <div class="meme-versus-record">${escapeHtml(balanceLine(row))}</div>
    <div class="card-receipt">
      ${row.quote_id ? `<a href="/q/${escapeAttr(row.quote_id)}">receipt ↗</a>` : ""}
      ${row.piece_title ? ` · ${escapeHtml(row.piece_title)}` : ""}
    </div>
  </div>
</div>
${MEME_STYLES}`;
}

// ---------------------------------------------------------------------------
// timeline-drop — dated facts, zero commentary
// ---------------------------------------------------------------------------
interface TimelineDropRow {
  label: string;
  event_date: string | null;
}

async function loadTimelineDrop(db: D1Database, subjectNodeId: string): Promise<TimelineDropRow[]> {
  return all<TimelineDropRow>(
    db,
    `SELECT n.label, json_extract(n.metadata, '$.event_date') AS event_date
       FROM nodes n
      WHERE n.user_id = (SELECT user_id FROM nodes WHERE id = ?)
        AND n.kind = 'event'
        AND json_extract(n.metadata, '$.event_date') IS NOT NULL
        AND (EXISTS (SELECT 1 FROM edges e WHERE e.src_node_id = n.id AND e.dst_node_id = ?)
             OR EXISTS (SELECT 1 FROM edges e WHERE e.dst_node_id = n.id AND e.src_node_id = ?))
      ORDER BY json_extract(n.metadata, '$.event_date') ASC
      LIMIT 6`,
    [subjectNodeId, subjectNodeId, subjectNodeId],
  ).catch(() => []);
}

export async function renderTimelineDropFace(
  db: D1Database,
  subjectNodeId: string,
): Promise<string> {
  const rows = await loadTimelineDrop(db, subjectNodeId);
  if (rows.length < 3) {
    return emptyFace("Not enough dated events on file yet for a timeline drop (needs 3+).");
  }
  const items = rows
    .map(
      (r) => `<div class="meme-tl-row">
  <span class="meme-tl-date">${escapeHtml((r.event_date ?? "").slice(0, 10))}</span>
  <span class="meme-tl-label">${escapeHtml(r.label)}</span>
</div>`,
    )
    .join("");
  return `<div class="meme-face meme-timeline-drop">
  <div class="card-meta">Timeline drop · pure rendering, no LLM, no commentary</div>
  <div class="card-art card-art-list">
    ${items}
  </div>
</div>
${MEME_STYLES}`;
}

function emptyFace(message: string): string {
  return `<div class="face-empty">${escapeHtml(message)}</div>
<style>.face-empty { font-family: var(--serif); font-style: italic; color: var(--ink-3); font-size: 14px; }</style>`;
}

const MEME_STYLES = `<style>
  .meme-face { display: flex; flex-direction: column; gap: 10px; }
  .card-art {
    padding: 36px 32px;
    background: var(--ink);
    color: var(--paper, #faf6ef);
    border-radius: 12px;
    text-align: center;
    position: relative;
  }
  .card-art-list { text-align: left; }
  .meme-quote {
    font-family: var(--serif);
    font-size: 21px;
    line-height: 1.35;
    font-style: italic;
    color: var(--paper, #faf6ef);
    margin: 0 0 8px;
  }
  .meme-vs {
    font-family: var(--mono);
    font-size: 12px;
    color: #8a867c;
    margin: 4px 0 12px;
  }
  .meme-versus-label {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: .1em;
    color: #8a867c;
    margin-bottom: 8px;
  }
  .meme-versus-label-record { margin-top: 20px; }
  .meme-versus-record {
    font-family: var(--serif);
    font-size: 17px;
    line-height: 1.4;
    color: #d4c9a8;
    margin-bottom: 8px;
  }
  .meme-tl-row {
    display: flex; gap: 16px; align-items: baseline;
    padding: 10px 0; border-top: 1px solid #2a2c30;
  }
  .meme-tl-row:first-child { border-top: none; }
  .meme-tl-date {
    font-family: var(--mono); font-size: 12px; color: #8a867c;
    flex-shrink: 0; width: 76px;
  }
  .meme-tl-label {
    font-family: var(--serif); font-size: 16px; line-height: 1.35;
    color: var(--paper, #faf6ef);
  }
  .card-receipt {
    font-family: var(--mono);
    font-size: 10.5px;
    color: #8a867c;
    letter-spacing: .03em;
    margin-top: 10px;
  }
  .card-receipt a { color: #d4c9a8; text-decoration: none; }
  .card-receipt a:hover { color: #faf6ef; }
</style>`;

// Statistics roundup arrangement — `/stat/:slug`.
//
// Numeric facts about a subject, laid out as stat cards. Pure rendering —
// a query for facts containing numeric tokens + a stat-card grid. No LLM
// at render time.
//
// Why a numeric heuristic: the extractor doesn't tag facts as
// "statistical" today. So we pattern-match for dollar amounts / percentages
// / large numbers / years in the fact label. Imperfect but useful — the
// page renders nothing when no candidates match (honest empty state) and
// shows a stat-card grid when matches exist.

import type { PublicEnv } from "../../data";
import {
  type SubjectContext,
  all,
  escapeAttr,
  escapeHtml,
  loadSubject,
  renderArrangementStandalone,
} from "./shared";

interface StatRow {
  label: string;
  quote_id: string | null;
  piece_slug: string | null;
  piece_title: string | null;
}

interface StatCard {
  numeral: string;
  caption: string;
  quote_id: string | null;
  piece_slug: string | null;
  piece_title: string | null;
}

const NUMERIC_RE =
  /(\$?[\d,]+\.?\d*\s*(?:million|billion|trillion|M|B|T|%|years?|months?)?|\d{4}|\d+\s*(?:million|billion|trillion|%))/i;

/** Pattern: pull the first numeric token out of a label as the "numeral".
 *  The rest of the label becomes the "caption" beneath. Imperfect; the
 *  surrounding sentence is preserved as the caption so context survives. */
function extractStatCard(row: StatRow): StatCard | null {
  const m = row.label.match(NUMERIC_RE);
  if (!m) return null;
  const numeral = m[0].trim();
  // Caption = label with the numeral substituted out + cleaned up.
  const caption = row.label.replace(numeral, "").replace(/\s+/g, " ").trim();
  return {
    numeral,
    caption: caption.length > 5 ? caption : row.label,
    quote_id: row.quote_id,
    piece_slug: row.piece_slug,
    piece_title: row.piece_title,
  };
}

/** Load candidate facts about the subject. */
async function loadStats(env: PublicEnv, subject: SubjectContext): Promise<StatCard[]> {
  const rows = await all<StatRow>(
    env.DB,
    `SELECT n.label,
            (SELECT id FROM quotes WHERE node_id = n.id LIMIT 1) AS quote_id,
            (SELECT slug FROM pieces WHERE id = n.piece_id) AS piece_slug,
            (SELECT title FROM pieces WHERE id = n.piece_id) AS piece_title
       FROM nodes n
       LEFT JOIN edges e ON (e.src_node_id = n.id AND e.dst_node_id = ? AND e.family = 'aboutness')
      WHERE n.user_id = ?
        AND n.kind = 'neutral_fact'
        AND e.id IS NOT NULL
      ORDER BY n.created_at DESC
      LIMIT 60`,
    [subject.nodeId, subject.userId],
  ).catch(() => []);
  return rows
    .map(extractStatCard)
    .filter((c): c is StatCard => c !== null)
    .slice(0, 12);
}

export function renderStatsBlock(stats: StatCard[]): string {
  if (stats.length === 0) {
    return `<section class="stats-empty">
  <p>No numeric facts isolated yet for this subject. Dollar amounts, percentages, dates, and counts surface here as the extractor reads them.</p>
</section>
<style>
  .stats-empty p { font-family: var(--serif); font-size: 15px; color: var(--ink-3); font-style: italic; max-width: 640px; margin: 0; }
</style>`;
  }
  const cards = stats
    .map(
      (s) => `<div class="stat-card">
  <div class="stat-numeral">${escapeHtml(s.numeral)}</div>
  <div class="stat-caption">${escapeHtml(s.caption)}</div>
  <div class="stat-prov">
    ${s.quote_id ? `<a href="/q/${escapeAttr(s.quote_id)}">receipt ↗</a>` : ""}${s.quote_id && s.piece_slug ? " · " : ""}${s.piece_slug ? `<a href="/library/${escapeAttr(s.piece_slug)}">${escapeHtml((s.piece_title ?? "source").slice(0, 32))}</a>` : ""}
  </div>
</div>`,
    )
    .join("");
  return `<section data-schema="Dataset">
  <div class="stats-grid">${cards}</div>
</section>
<style>
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 14px;
  }
  .stat-card {
    padding: 22px 24px;
    border: 1px solid var(--rule);
    border-radius: 11px;
    background: var(--surface, #fff);
  }
  .stat-numeral {
    font-family: var(--serif);
    font-size: 36px; line-height: 1;
    letter-spacing: -.022em;
    color: var(--ink);
    font-weight: 600;
    margin-bottom: 10px;
  }
  .stat-caption {
    font-family: var(--serif);
    font-size: 14.5px; line-height: 1.45;
    color: var(--ink-2);
    margin-bottom: 12px;
  }
  .stat-prov {
    font-size: 11.5px;
    color: var(--ink-3);
    letter-spacing: .02em;
  }
  .stat-prov a {
    color: var(--accent);
    text-decoration: none;
  }
  .stat-prov a:hover { text-decoration: underline; }
</style>`;
}

/** Standalone `/stat/:slug` page. */
export async function renderStatsPage(env: PublicEnv, slug: string): Promise<string | null> {
  const subject = await loadSubject(env, slug);
  if (!subject) return null;
  const stats = await loadStats(env, subject);
  const inner = renderStatsBlock(stats);

  // schema.org Dataset is the closest match for a stats roundup.
  // variableMeasured lists each numeric variable.
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `Statistics · ${subject.label}`,
    description: `Numeric facts about ${subject.label} extracted from source documents — each with a verbatim receipt.`,
    variableMeasured: stats.slice(0, 20).map((s) => ({
      "@type": "PropertyValue",
      name: s.caption,
      value: s.numeral,
    })),
    about: { "@type": "Thing", name: subject.label },
    publisher: { "@id": "https://canopticon.com/#org" },
  }).replace(/<\/script/gi, "<\\/script");

  return renderArrangementStandalone({
    subject,
    arrangementLabel: "Statistics",
    arrangementKind: "stats",
    inner,
    jsonLd,
    title: `Statistics · ${subject.label}`,
    description: `Numeric facts about ${subject.label} — receipts attached.`,
  });
}

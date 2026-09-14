// Claim-and-source table arrangement — `/ct/:slug`.
//
// Every attributed assertion about a subject, with stance, attribution,
// evidence balance, source. The firewall made visible at table grain.
// Pure rendering — a query for assertion nodes attached to the subject
// + a table. No LLM at render time. Schema.org ClaimReview JSON-LD so AI
// engines can cite individual claims with attribution.

import type { PublicEnv } from "../../data";
import {
  type SubjectContext,
  all,
  escapeAttr,
  escapeHtml,
  loadSubject,
  renderArrangementStandalone,
} from "./shared";

interface ClaimRow {
  node_id: string;
  label: string;
  stance: string;
  rank: string;
  evidence_balance: number;
  actor: string | null;
  quote_id: string | null;
  piece_slug: string | null;
  piece_title: string | null;
}

async function loadClaims(env: PublicEnv, subject: SubjectContext): Promise<ClaimRow[]> {
  return all<ClaimRow>(
    env.DB,
    `SELECT n.id AS node_id, n.label,
            a.stance, a.rank, a.evidence_balance,
            (SELECT label FROM nodes WHERE id = a.asserted_by_node_id) AS actor,
            (SELECT id FROM quotes WHERE node_id = n.id LIMIT 1) AS quote_id,
            (SELECT slug FROM pieces WHERE id = n.piece_id) AS piece_slug,
            (SELECT title FROM pieces WHERE id = n.piece_id) AS piece_title
       FROM nodes n
       JOIN assertions a ON a.node_id = n.id
      WHERE n.user_id = ? AND n.kind = 'assertion'
        AND (EXISTS (SELECT 1 FROM edges e WHERE e.src_node_id = n.id AND e.dst_node_id = ?)
             OR EXISTS (SELECT 1 FROM edges e WHERE e.dst_node_id = n.id AND e.src_node_id = ?))
      ORDER BY (a.rank = 'contested') DESC, a.evidence_balance DESC
      LIMIT 60`,
    [subject.userId, subject.nodeId, subject.nodeId],
  ).catch(() => []);
}

export function renderClaimTableBlock(claims: ClaimRow[]): string {
  if (claims.length === 0) {
    return `<section class="ct-empty">
  <p>No attributed assertions extracted yet for this subject. Each row of this table is a claim someone made about the subject — attributed, stance-tagged, evidence-balanced, and never silently rendered as a neutral fact.</p>
</section>
<style>
  .ct-empty p { font-family: var(--serif); font-size: 15px; color: var(--ink-3); font-style: italic; max-width: 640px; margin: 0; }
</style>`;
  }
  const rows = claims
    .map((c) => {
      const balance = c.evidence_balance ?? 0;
      const balanceCell =
        c.rank === "contested"
          ? `<span class="ct-balance ct-contested">contested · ${balance >= 0 ? "+" : ""}${balance.toFixed(1)}</span>`
          : balance > 0
            ? `<span class="ct-balance">+${balance.toFixed(1)}</span>`
            : balance < 0
              ? `<span class="ct-balance">${balance.toFixed(1)}</span>`
              : `<span class="ct-balance ct-zero">—</span>`;
      const sourceCell = c.piece_slug
        ? `<a href="/library/${escapeAttr(c.piece_slug)}">${escapeHtml((c.piece_title ?? "source").slice(0, 40))}</a>`
        : "—";
      const quoteCell = c.quote_id
        ? `<a href="/q/${escapeAttr(c.quote_id)}" title="See the verbatim receipt">↗</a>`
        : "";
      return `<tr class="${c.rank === "contested" ? "ct-row-contested" : ""}">
  <td class="ct-claim">${escapeHtml(c.label)}</td>
  <td class="ct-actor">${c.actor ? escapeHtml(c.actor) : "<i>unattributed</i>"}</td>
  <td class="ct-stance ct-stance-${escapeAttr(c.stance)}">${escapeHtml(c.stance)}</td>
  <td>${balanceCell}</td>
  <td>${sourceCell}</td>
  <td>${quoteCell}</td>
</tr>`;
    })
    .join("");
  return `<section data-schema="Claim">
  <table class="ct-table">
    <thead>
      <tr>
        <th>Claim</th>
        <th>Asserted by</th>
        <th>Stance</th>
        <th>Evidence balance</th>
        <th>Source</th>
        <th>Receipt</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</section>
<style>
  .ct-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--serif);
  }
  .ct-table th {
    text-align: left;
    padding: 10px 14px 10px 0;
    border-bottom: 1px solid var(--rule);
    font-size: 11.5px;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: var(--ink-3);
    font-weight: 600;
    font-family: var(--mono);
  }
  .ct-table td {
    padding: 14px 14px 14px 0;
    border-bottom: 1px solid var(--rule-soft, var(--rule));
    vertical-align: top;
    font-size: 15px;
    line-height: 1.45;
    color: var(--ink);
  }
  .ct-row-contested td {
    background: var(--cont-bg);
  }
  .ct-claim { max-width: 360px; }
  .ct-actor { font-style: italic; color: var(--ink-2); font-size: 14px; }
  .ct-actor i { color: var(--ink-3); }
  .ct-stance {
    font-family: var(--mono);
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: .04em;
  }
  .ct-stance-pro { color: var(--confirmed); }
  .ct-stance-critical { color: var(--correction); }
  .ct-stance-neutral { color: var(--ink-3); }
  .ct-balance {
    font-family: var(--mono);
    font-size: 12.5px;
    color: var(--ink-2);
    letter-spacing: .03em;
  }
  .ct-balance.ct-contested { color: var(--contested); font-weight: 600; }
  .ct-balance.ct-zero { color: var(--ink-3); }
  .ct-table a { color: var(--accent); text-decoration: none; }
  .ct-table a:hover { text-decoration: underline; }
  @media (max-width: 720px) {
    .ct-table th, .ct-table td { font-size: 13.5px; padding: 10px 8px 10px 0; }
    .ct-claim { max-width: none; }
  }
</style>`;
}

/** Standalone `/ct/:slug` page. */
export async function renderClaimTablePage(env: PublicEnv, slug: string): Promise<string | null> {
  const subject = await loadSubject(env, slug);
  if (!subject) return null;
  const claims = await loadClaims(env, subject);
  const inner = renderClaimTableBlock(claims);

  // This emitted ClaimReview per row. It shouldn't have.
  //
  // ClaimReview is restricted to publishers in Google's fact-check programme —
  // algorithmically-determined authoritative fact-checking organisations — and
  // the rich result was retired in June 2025 regardless. Emitting it is a claim
  // to a standing this publication does not have, and it renders nothing.
  //
  // Plain `Claim` is left: valid schema.org, honest about what these rows are
  // (attributed assertions, not adjudications), and `isBasedOn` carries the
  // provenance that actually matters.
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": claims.slice(0, 25).map((c, i) => ({
      "@type": "Claim",
      "@id": `https://canopticon.com/ct/${subject.slug}#claim-${i}`,
      text: c.label,
      ...(c.actor ? { author: { "@type": "Person", name: c.actor } } : {}),
      ...(c.piece_slug ? { isBasedOn: `https://canopticon.com/p/${c.piece_slug}` } : {}),
    })),
  }).replace(/<\/script/gi, "<\\/script");

  return renderArrangementStandalone({
    subject,
    arrangementLabel: "Claims & sources",
    arrangementKind: "claim-table",
    inner,
    jsonLd,
    title: `Claims & sources · ${subject.label}`,
    description: `Attributed assertions about ${subject.label} — stance, evidence balance, and source per row. Nothing here counts as settled fact until it's checked.`,
  });
}

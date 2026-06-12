// Ledger of flows — `/l/:slug`.
//
// Monetary flows involving the subject — "PCO paid Pollara $X over Y years".
// Renders facts whose label contains $ amounts AND a directional verb
// (paid / received / funded / contracted). The extractor doesn't yet tag
// flow-shaped facts; this is a heuristic surface until it does.

import type { PublicEnv } from "../../data";
import { all, escapeAttr, escapeHtml, loadSubject, renderArrangementStandalone } from "./shared";

interface FlowRow {
  label: string;
  quote_id: string | null;
  piece_slug: string | null;
}

const FLOW_RE = /\$[\d,]+\.?\d*\s*(?:million|billion|trillion|M|B|T)?/i;
const VERB_RE =
  /(paid|received|funded|contracted|invested|donated|granted|loaned|transferred|spent|earned)/i;

async function loadFlows(
  env: PublicEnv,
  subject: { userId: string; nodeId: string },
): Promise<FlowRow[]> {
  const rows = await all<FlowRow>(
    env.DB,
    `SELECT n.label,
            (SELECT id FROM quotes WHERE node_id = n.id LIMIT 1) AS quote_id,
            (SELECT slug FROM pieces WHERE id = n.piece_id) AS piece_slug
       FROM nodes n
       LEFT JOIN edges e ON (e.src_node_id = n.id AND e.dst_node_id = ? AND e.family = 'aboutness')
      WHERE n.user_id = ?
        AND n.kind = 'neutral_fact'
        AND e.id IS NOT NULL
      ORDER BY n.created_at DESC
      LIMIT 60`,
    [subject.nodeId, subject.userId],
  ).catch(() => []);
  return rows.filter((r) => FLOW_RE.test(r.label) && VERB_RE.test(r.label)).slice(0, 24);
}

export function renderLedgerBlock(flows: FlowRow[]): string {
  if (flows.length === 0) {
    return `<section class="ldg-empty">
  <p>No monetary flows isolated yet for this subject. Flow-shaped facts — paid, received, funded, contracted — with dollar amounts surface here as the extractor reads them.</p>
</section>
<style>
  .ldg-empty p { font-family: var(--serif); font-size: 15px; color: var(--ink-3); font-style: italic; max-width: 640px; margin: 0; }
</style>`;
  }
  const rows = flows
    .map((f) => {
      const amount = f.label.match(FLOW_RE)?.[0] ?? "";
      const description = f.label.replace(amount, "").replace(/\s+/g, " ").trim();
      return `<tr>
  <td class="ldg-amount">${escapeHtml(amount)}</td>
  <td class="ldg-desc">${escapeHtml(description || f.label)}</td>
  <td class="ldg-prov">${f.quote_id ? `<a href="/q/${escapeAttr(f.quote_id)}">↗</a>` : ""}${f.quote_id && f.piece_slug ? " · " : ""}${f.piece_slug ? `<a href="/library/${escapeAttr(f.piece_slug)}">source</a>` : ""}</td>
</tr>`;
    })
    .join("");
  return `<section data-schema="Dataset">
  <table class="ldg-table">
    <thead><tr><th>Amount</th><th>Flow</th><th>Receipt</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>
<style>
  .ldg-table { width: 100%; border-collapse: collapse; }
  .ldg-table th {
    text-align: left;
    padding: 10px 14px 10px 0;
    border-bottom: 1px solid var(--rule);
    font-family: var(--mono);
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: .12em;
    color: var(--ink-3);
    font-weight: 600;
  }
  .ldg-table td {
    padding: 14px 14px 14px 0;
    border-bottom: 1px solid var(--rule-soft, var(--rule));
    vertical-align: top;
    font-size: 15px; line-height: 1.45;
    color: var(--ink);
  }
  .ldg-amount {
    font-family: var(--serif);
    font-size: 18px;
    font-weight: 600;
    color: var(--ink);
    white-space: nowrap;
  }
  .ldg-desc { font-family: var(--serif); color: var(--ink-2); max-width: 480px; }
  .ldg-prov { font-size: 12px; }
  .ldg-prov a { color: var(--accent); text-decoration: none; }
  .ldg-prov a:hover { text-decoration: underline; }
</style>`;
}

export async function renderLedgerPage(env: PublicEnv, slug: string): Promise<string | null> {
  const subject = await loadSubject(env, slug);
  if (!subject) return null;
  const flows = await loadFlows(env, subject);
  const inner = renderLedgerBlock(flows);
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `Ledger · ${subject.label}`,
    description: `Monetary flows involving ${subject.label} — extracted from source documents, each with a verbatim receipt.`,
    variableMeasured: flows.slice(0, 20).map((f) => ({
      "@type": "MonetaryAmount",
      currency: "USD",
      value: f.label.match(FLOW_RE)?.[0] ?? "",
      description: f.label,
    })),
    about: { "@type": "Thing", name: subject.label },
    publisher: { "@id": "https://canopticon.com/#org" },
  }).replace(/<\/script/gi, "<\\/script");
  return renderArrangementStandalone({
    subject,
    arrangementLabel: "Ledger",
    arrangementKind: "ledger",
    inner,
    jsonLd,
    title: `Ledger · ${subject.label}`,
    description: `Monetary flows involving ${subject.label}.`,
  });
}

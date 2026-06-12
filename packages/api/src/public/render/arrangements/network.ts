// Network map arrangement — `/n/:slug`.
//
// All typed relationships radiating from a subject. Pure rendering — a
// graph traversal query + a chip layout. No LLM at render time.
// Visualises ownership / employment / membership / control links and
// links each to a quote receipt where the edge was sourced.

import type { PublicEnv } from "../../data";
import {
  type SubjectContext,
  all,
  escapeAttr,
  escapeHtml,
  loadSubject,
  renderArrangementStandalone,
} from "./shared";

interface EdgeRow {
  other_label: string;
  other_kind: string;
  other_slug: string | null;
  edge_type: string;
  direction: "out" | "in";
  valid_from: string | null;
  valid_to: string | null;
}

/** Load relationship edges in both directions. */
async function loadNetwork(env: PublicEnv, subject: SubjectContext): Promise<EdgeRow[]> {
  return all<EdgeRow>(
    env.DB,
    `SELECT
       (SELECT label FROM nodes WHERE id =
         CASE WHEN e.src_node_id = ? THEN e.dst_node_id ELSE e.src_node_id END) AS other_label,
       (SELECT kind FROM nodes WHERE id =
         CASE WHEN e.src_node_id = ? THEN e.dst_node_id ELSE e.src_node_id END) AS other_kind,
       (SELECT p.slug FROM pages p WHERE p.subject_node_id =
         CASE WHEN e.src_node_id = ? THEN e.dst_node_id ELSE e.src_node_id END
         LIMIT 1) AS other_slug,
       e.edge_type,
       CASE WHEN e.src_node_id = ? THEN 'out' ELSE 'in' END AS direction,
       e.valid_from, e.valid_to
     FROM edges e
     WHERE e.user_id = ?
       AND (e.src_node_id = ? OR e.dst_node_id = ?)
       AND e.family = 'relationship'
     GROUP BY other_label, edge_type
     LIMIT 60`,
    [
      subject.nodeId,
      subject.nodeId,
      subject.nodeId,
      subject.nodeId,
      subject.userId,
      subject.nodeId,
      subject.nodeId,
    ],
  ).catch(() => []);
}

/** Inner block — embedded on subject pages, used by the standalone. */
export function renderNetworkBlock(subject: SubjectContext, edges: EdgeRow[]): string {
  if (edges.length === 0) {
    return `<section class="net-empty">
  <p>No typed relationships extracted yet. Network links — ownership, employment, funding, membership, control — surface as documents are read into the graph.</p>
</section>
<style>
  .net-empty p { font-family: var(--serif); font-size: 15px; color: var(--ink-3); font-style: italic; max-width: 640px; margin: 0; }
</style>`;
  }

  // Group by edge_type so a Carney page shows "Governs · BoC, BoE", then
  // "Vice-chair · Brookfield", then "Co-founder · GFANZ" — same-kind
  // relationships clustered. Reads better than a flat list.
  const groups = new Map<string, EdgeRow[]>();
  for (const e of edges) {
    const arr = groups.get(e.edge_type) ?? [];
    arr.push(e);
    groups.set(e.edge_type, arr);
  }

  const groupBlocks = Array.from(groups.entries())
    .map(([edgeType, list]) => {
      const chips = list
        .map((e) => {
          const inner = e.other_slug
            ? `<a href="/s/${escapeAttr(e.other_slug)}">${escapeHtml(e.other_label)}</a>`
            : escapeHtml(e.other_label);
          const when = e.valid_from
            ? `<span class="net-chip-when">${escapeHtml(e.valid_from.slice(0, 4))}${e.valid_to ? `–${escapeHtml(e.valid_to.slice(0, 4))}` : ""}</span>`
            : "";
          return `<div class="net-chip">${inner}${when}</div>`;
        })
        .join("");
      return `<div class="net-group">
  <div class="net-group-k">${escapeHtml(edgeType)}</div>
  <div class="net-chips">${chips}</div>
</div>`;
    })
    .join("");

  return `<section data-schema="ItemList" data-schema-item="Relationship">
  <div class="net-block">
    <div class="net-subject">${escapeHtml(subject.label)}</div>
    ${groupBlocks}
  </div>
</section>
<style>
  .net-block { margin: 0; }
  .net-subject {
    display: inline-block;
    font-family: var(--serif);
    font-size: 16px;
    padding: 6px 14px;
    background: var(--accent-bg, #e8ecf3);
    color: var(--accent);
    border-radius: 4px;
    margin-bottom: 22px;
    font-weight: 600;
  }
  .net-group { margin-bottom: 22px; }
  .net-group-k {
    font-family: var(--mono);
    font-size: 11.5px;
    color: var(--ink-3);
    text-transform: uppercase;
    letter-spacing: .06em;
    margin-bottom: 10px;
  }
  .net-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .net-chip {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    padding: 7px 14px;
    border: 1px solid var(--rule);
    border-radius: 18px;
    background: var(--surface, #fff);
    font-family: var(--serif);
    font-size: 14.5px;
    color: var(--ink);
  }
  .net-chip a { color: var(--ink); text-decoration: none; }
  .net-chip a:hover { color: var(--accent); }
  .net-chip-when {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--ink-3);
  }
</style>`;
}

/** Standalone `/n/:slug` page. */
export async function renderNetworkPage(env: PublicEnv, slug: string): Promise<string | null> {
  const subject = await loadSubject(env, slug);
  if (!subject) return null;
  const edges = await loadNetwork(env, subject);
  const inner = renderNetworkBlock(subject, edges);

  // schema.org doesn't have a great "personal network" type. Use ItemList +
  // hasPart of Role-style edges. AI engines will at least see the
  // structured connections; richer typed-edge schemas don't exist.
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Network · ${subject.label}`,
    description: `Typed relationships of ${subject.label} — ownership, employment, funding, membership, control. Each link sourced.`,
    numberOfItems: edges.length,
    itemListElement: edges.slice(0, 40).map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Role",
        name: e.edge_type,
        roleName: e.other_label,
        ...(e.valid_from ? { startDate: e.valid_from.slice(0, 10) } : {}),
        ...(e.valid_to ? { endDate: e.valid_to.slice(0, 10) } : {}),
      },
    })),
    about: { "@type": "Thing", name: subject.label },
    publisher: { "@id": "https://canopticon.com/#org" },
  }).replace(/<\/script/gi, "<\\/script");

  return renderArrangementStandalone({
    subject,
    arrangementLabel: "Network",
    arrangementKind: "network",
    inner,
    jsonLd,
    title: `Network · ${subject.label}`,
    description: `Typed relationships of ${subject.label} — ownership, employment, funding, membership, control.`,
  });
}

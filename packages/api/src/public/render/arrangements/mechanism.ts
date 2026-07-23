// Mechanism explainer — `/m/:slug`.
//
// Causal-edge chain involving the subject — "X caused Y caused Z" — laid
// out as a stepped sequence. Pure rendering. Data is causal edges from
// the typed graph (family='causal'), traced N hops from the subject.

import type { PublicEnv } from "../../data";
import {
  type SubjectContext,
  all,
  escapeAttr,
  escapeHtml,
  loadSubject,
  renderArrangementStandalone,
} from "./shared";

interface CausalEdge {
  src_label: string;
  src_slug: string | null;
  dst_label: string;
  dst_slug: string | null;
  edge_type: string;
  quote_id: string | null;
}

async function loadCausal(env: PublicEnv, subject: SubjectContext): Promise<CausalEdge[]> {
  return all<CausalEdge>(
    env.DB,
    `SELECT
       (SELECT label FROM nodes WHERE id = e.src_node_id) AS src_label,
       (SELECT p.slug FROM pages p WHERE p.subject_node_id = e.src_node_id LIMIT 1) AS src_slug,
       (SELECT label FROM nodes WHERE id = e.dst_node_id) AS dst_label,
       (SELECT p.slug FROM pages p WHERE p.subject_node_id = e.dst_node_id LIMIT 1) AS dst_slug,
       e.edge_type,
       (SELECT id FROM quotes WHERE node_id = e.src_node_id LIMIT 1) AS quote_id
     FROM edges e
     WHERE e.user_id = ?
       AND e.family = 'causal'
       AND (e.src_node_id = ? OR e.dst_node_id = ?
            OR EXISTS (SELECT 1 FROM edges ea WHERE ea.src_node_id = e.src_node_id AND ea.dst_node_id = ? AND ea.family = 'aboutness')
            OR EXISTS (SELECT 1 FROM edges eb WHERE eb.src_node_id = e.dst_node_id AND eb.dst_node_id = ? AND eb.family = 'aboutness'))
     LIMIT 20`,
    [subject.userId, subject.nodeId, subject.nodeId, subject.nodeId, subject.nodeId],
  ).catch(() => []);
}

export function renderMechanismBlock(edges: CausalEdge[]): string {
  if (edges.length === 0) {
    return `<section class="mech-empty">
  <p>No causal mechanism extracted yet for this subject. As the extractor surfaces caused/contributed edges, the chain renders here as a stepped sequence.</p>
</section>
<style>
  .mech-empty p { font-family: var(--serif); font-size: 15px; color: var(--ink-3); font-style: italic; max-width: 640px; margin: 0; }
</style>`;
  }
  const steps = edges
    .map((e, i) => {
      const src = e.src_slug
        ? `<a href="/s/${escapeAttr(e.src_slug)}">${escapeHtml(e.src_label)}</a>`
        : escapeHtml(e.src_label);
      const dst = e.dst_slug
        ? `<a href="/s/${escapeAttr(e.dst_slug)}">${escapeHtml(e.dst_label)}</a>`
        : escapeHtml(e.dst_label);
      const receipt = e.quote_id
        ? ` <a class="mech-receipt" href="/q/${escapeAttr(e.quote_id)}">receipt ↗</a>`
        : "";
      return `<li class="mech-step">
  <div class="mech-n">${i + 1}</div>
  <div class="mech-edge">
    <span class="mech-from">${src}</span>
    <span class="mech-arrow">→ <span class="mech-type">${escapeHtml(e.edge_type)}</span> →</span>
    <span class="mech-to">${dst}</span>
    ${receipt}
  </div>
</li>`;
    })
    .join("");
  return `<section data-schema="HowTo">
  <ol class="mech-list">${steps}</ol>
</section>
<style>
  .mech-list { list-style: none; padding: 0; margin: 0; }
  .mech-step {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: 16px;
    padding: 16px 0;
    border-top: 1px solid var(--rule);
  }
  .mech-step:first-child { border-top: none; }
  .mech-n {
    font-family: var(--serif);
    font-size: 22px; line-height: 1;
    color: var(--accent);
    font-weight: 600;
  }
  .mech-edge {
    font-family: var(--serif);
    font-size: 15.5px; line-height: 1.5;
    color: var(--ink);
    display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px;
  }
  .mech-from, .mech-to { font-weight: 600; }
  .mech-from a, .mech-to a { color: var(--ink); text-decoration: none; }
  .mech-from a:hover, .mech-to a:hover { color: var(--accent); }
  .mech-arrow { color: var(--ink-3); }
  .mech-type {
    font-family: var(--mono);
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: .04em;
    color: var(--ink-3);
  }
  .mech-receipt {
    font-size: 12px;
    color: var(--accent);
    text-decoration: none;
  }
  .mech-receipt:hover { text-decoration: underline; }
</style>`;
}

export async function renderMechanismPage(env: PublicEnv, slug: string): Promise<string | null> {
  const subject = await loadSubject(env, slug);
  if (!subject) return null;
  const edges = await loadCausal(env, subject);
  const inner = renderMechanismBlock(edges);
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `Mechanism · ${subject.label}`,
    description: `Causal chain involving ${subject.label} — how the documented effects propagate.`,
    step: edges.slice(0, 12).map((e, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: `${e.src_label} ${e.edge_type} ${e.dst_label}`,
    })),
    about: { "@type": "Thing", name: subject.label },
    publisher: { "@id": "https://canopticon.com/#org" },
  }).replace(/<\/script/gi, "<\\/script");
  return renderArrangementStandalone({
    subject,
    arrangementLabel: "Mechanism",
    arrangementKind: "mechanism",
    inner,
    jsonLd,
    title: `Mechanism · ${subject.label}`,
    description: `How ${subject.label} works in the documented causal chain.`,
  });
}

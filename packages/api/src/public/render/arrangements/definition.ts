// Definition arrangement — `/d/:slug`.
//
// The canonical short answer to "what is X". Pure rendering — the highest-
// balance neutral fact about the subject, framed as a definition.
// No LLM at render time.

import type { PublicEnv } from "../../data";
import { all, escapeAttr, escapeHtml, loadSubject, renderArrangementStandalone } from "./shared";

interface DefinitionFact {
  label: string;
  quote_id: string | null;
  piece_slug: string | null;
  piece_title: string | null;
}

async function loadDefinitionFacts(
  env: PublicEnv,
  subject: { userId: string; nodeId: string },
): Promise<DefinitionFact[]> {
  return all<DefinitionFact>(
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
      ORDER BY n.created_at ASC
      LIMIT 3`,
    [subject.nodeId, subject.userId],
  ).catch(() => []);
}

export function renderDefinitionBlock(subjectLabel: string, facts: DefinitionFact[]): string {
  if (facts.length === 0) {
    return `<section class="def-empty">
  <p>No definition extracted yet for ${escapeHtml(subjectLabel)}. The canonical statement of what this is surfaces from the first stable fact in the corpus.</p>
</section>
<style>
  .def-empty p { font-family: var(--serif); font-size: 15px; color: var(--ink-3); font-style: italic; max-width: 640px; margin: 0; }
</style>`;
  }
  const lead = facts[0];
  if (!lead) return "";
  const others = facts.slice(1);
  return `<section data-schema="DefinedTerm">
  <p class="def-lead"><b>${escapeHtml(subjectLabel)}</b> — ${escapeHtml(lead.label)}${lead.quote_id ? ` <a class="def-receipt" href="/q/${escapeAttr(lead.quote_id)}">↗</a>` : ""}</p>
  ${
    others.length
      ? `<div class="def-supporting">
    <div class="sec-k">Supporting facts</div>
    <ul>${others
      .map(
        (f) =>
          `<li>${escapeHtml(f.label)}${f.quote_id ? ` <a class="def-receipt" href="/q/${escapeAttr(f.quote_id)}">↗</a>` : ""}</li>`,
      )
      .join("")}</ul>
  </div>`
      : ""
  }
</section>
<style>
  .def-lead {
    font-family: var(--serif);
    font-size: 22px; line-height: 1.5;
    color: var(--ink);
    margin: 0 0 28px;
    max-width: 720px;
  }
  .def-lead b { color: var(--ink); font-weight: 600; }
  .def-supporting .sec-k { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3); font-weight: 600; margin-bottom: 12px; }
  .def-supporting ul { list-style: none; padding: 0; margin: 0; }
  .def-supporting li {
    font-family: var(--serif);
    font-size: 15.5px; line-height: 1.55;
    color: var(--ink-2);
    padding: 10px 0;
    border-top: 1px solid var(--rule);
  }
  .def-supporting li:first-child { border-top: none; }
  .def-receipt { color: var(--accent); text-decoration: none; font-size: 12px; }
  .def-receipt:hover { text-decoration: underline; }
</style>`;
}

export async function renderDefinitionPage(env: PublicEnv, slug: string): Promise<string | null> {
  const subject = await loadSubject(env, slug);
  if (!subject) return null;
  const facts = await loadDefinitionFacts(env, subject);
  const inner = renderDefinitionBlock(subject.label, facts);
  const lead = facts[0];
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: subject.label,
    description: lead?.label ?? `Definition of ${subject.label} — extracted from source documents.`,
    inDefinedTermSet: "https://canopticon.com/topics",
    publisher: { "@id": "https://canopticon.com/#org" },
  }).replace(/<\/script/gi, "<\\/script");
  return renderArrangementStandalone({
    subject,
    arrangementLabel: "Definition",
    arrangementKind: "definition",
    inner,
    jsonLd,
    title: `Definition · ${subject.label}`,
    description: lead?.label ?? `Definition of ${subject.label}.`,
  });
}

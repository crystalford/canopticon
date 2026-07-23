// Bibliography / body-of-work — `/b/:slug`.
//
// Works (books, articles, films, albums — entity_type "work", see
// digestion-typed.ts) authored by the subject, found via 'authored'
// relationship edges (src = creator, dst = the work). Pure rendering, same
// pattern as whos-who.ts. Depends on the extractor actually tagging
// "authored" edges (added alongside the "work" entity type) — older
// material read before that landed won't show up here until re-extracted,
// same as every other arrangement built on typed edges.

import type { PublicEnv } from "../../data";
import {
  type SubjectContext,
  all,
  escapeAttr,
  escapeHtml,
  loadSubject,
  renderArrangementStandalone,
} from "./shared";

interface WorkRow {
  label: string;
  slug: string | null;
  valid_from: string | null;
  quote_text: string | null;
  quote_id: string | null;
}

async function loadWorks(env: PublicEnv, subject: SubjectContext): Promise<WorkRow[]> {
  return all<WorkRow>(
    env.DB,
    `SELECT DISTINCT
       w.label,
       (SELECT p.slug FROM pages p WHERE p.subject_node_id = w.id LIMIT 1) AS slug,
       e.valid_from,
       (SELECT q.verbatim_text FROM quotes q WHERE q.node_id = w.id LIMIT 1) AS quote_text,
       (SELECT q.id FROM quotes q WHERE q.node_id = w.id LIMIT 1) AS quote_id
     FROM edges e
     JOIN nodes w ON w.id = e.dst_node_id
     WHERE e.user_id = ?
       AND e.src_node_id = ?
       AND e.family = 'relationship'
       AND e.edge_type = 'authored'
       AND w.kind = 'entity'
       AND json_extract(w.metadata, '$.entity_type') = 'work'
     ORDER BY COALESCE(e.valid_from, '9999') ASC, w.label ASC
     LIMIT 60`,
    [subject.userId, subject.nodeId],
  ).catch(() => []);
}

export function renderBibliographyBlock(subject: SubjectContext, works: WorkRow[]): string {
  if (works.length === 0) {
    return `<section class="bib-empty">
  <p>No works yet linked to ${escapeHtml(subject.label)} via a typed "authored" relationship. As the extractor tags named books, articles, films, or other works and their creator, this list fills in.</p>
</section>
<style>
  .bib-empty p { font-family: var(--serif); font-size: 15px; color: var(--ink-3); font-style: italic; max-width: 640px; margin: 0; }
</style>`;
  }
  const rows = works
    .map((w) => {
      const link = w.slug
        ? `<a href="/s/${escapeAttr(w.slug)}">${escapeHtml(w.label)}</a>`
        : escapeHtml(w.label);
      const when = w.valid_from
        ? `<span class="bib-when">${escapeHtml(w.valid_from.slice(0, 4))}</span>`
        : "";
      const receipt = w.quote_id
        ? ` <a class="bib-receipt" href="/q/${escapeAttr(w.quote_id)}">↗</a>`
        : "";
      const quote = w.quote_text
        ? `<p class="bib-quote">${escapeHtml(w.quote_text.slice(0, 180))}${w.quote_text.length > 180 ? "…" : ""}</p>`
        : "";
      return `<li>
  <div class="bib-row-head">
    ${when}
    <span class="bib-title">${link}${receipt}</span>
  </div>
  ${quote}
</li>`;
    })
    .join("");
  return `<section data-schema="ItemList" data-schema-item="CreativeWork">
  <ul class="bib-list">${rows}</ul>
</section>
<style>
  .bib-list { list-style: none; padding: 0; margin: 0; }
  .bib-list li {
    padding: 14px 0;
    border-top: 1px solid var(--rule);
  }
  .bib-list li:first-child { border-top: none; }
  .bib-row-head { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
  .bib-when {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--ink-3);
    min-width: 44px;
  }
  .bib-title { font-family: var(--serif); font-size: 16.5px; color: var(--ink); }
  .bib-title a { color: var(--accent); text-decoration: none; }
  .bib-title a:hover { text-decoration: underline; }
  .bib-receipt { color: var(--accent); text-decoration: none; font-size: 11px; }
  .bib-receipt:hover { text-decoration: underline; }
  .bib-quote {
    font-family: var(--serif);
    font-style: italic;
    font-size: 14px; line-height: 1.5;
    color: var(--ink-2);
    margin: 6px 0 0 58px;
  }
</style>`;
}

export async function renderBibliographyPage(env: PublicEnv, slug: string): Promise<string | null> {
  const subject = await loadSubject(env, slug);
  if (!subject) return null;
  const works = await loadWorks(env, subject);
  const inner = renderBibliographyBlock(subject, works);
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Bibliography · ${subject.label}`,
    description: `Works attributed to ${subject.label} — books, articles, films, and other named works, each traced to a verbatim source quote.`,
    numberOfItems: works.length,
    itemListElement: works.slice(0, 25).map((w, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: { "@type": "CreativeWork", name: w.label, datePublished: w.valid_from ?? undefined },
    })),
    about: { "@type": "Thing", name: subject.label },
    publisher: { "@id": "https://canopticon.com/#org" },
  }).replace(/<\/script/gi, "<\\/script");
  return renderArrangementStandalone({
    subject,
    arrangementLabel: "Bibliography",
    arrangementKind: "bibliography",
    inner,
    jsonLd,
    title: `Bibliography · ${subject.label}`,
    description: `Works attributed to ${subject.label}.`,
  });
}

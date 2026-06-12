// Who's-who roster — `/w/:slug`.
//
// People connected to the subject via relationship edges. Filtered to
// entities whose entity_type metadata is "person". Pure rendering.

import type { PublicEnv } from "../../data";
import {
  type SubjectContext,
  all,
  escapeAttr,
  escapeHtml,
  loadSubject,
  renderArrangementStandalone,
} from "./shared";

interface PersonRow {
  label: string;
  slug: string | null;
  role: string;
  valid_from: string | null;
  valid_to: string | null;
}

async function loadPeople(env: PublicEnv, subject: SubjectContext): Promise<PersonRow[]> {
  return all<PersonRow>(
    env.DB,
    `SELECT DISTINCT
       other.label,
       (SELECT p.slug FROM pages p WHERE p.subject_node_id = other.id LIMIT 1) AS slug,
       e.edge_type AS role,
       e.valid_from, e.valid_to
     FROM edges e
     JOIN nodes other ON other.id =
       CASE WHEN e.src_node_id = ? THEN e.dst_node_id ELSE e.src_node_id END
     WHERE e.user_id = ?
       AND (e.src_node_id = ? OR e.dst_node_id = ?)
       AND e.family = 'relationship'
       AND other.kind = 'entity'
       AND json_extract(other.metadata, '$.entity_type') = 'person'
     LIMIT 40`,
    [subject.nodeId, subject.userId, subject.nodeId, subject.nodeId],
  ).catch(() => []);
}

export function renderWhosWhoBlock(people: PersonRow[]): string {
  if (people.length === 0) {
    return `<section class="ww-empty">
  <p>No people yet linked to this subject via typed relationships. As the extractor surfaces employment, board, and membership edges, this roster fills in.</p>
</section>
<style>
  .ww-empty p { font-family: var(--serif); font-size: 15px; color: var(--ink-3); font-style: italic; max-width: 640px; margin: 0; }
</style>`;
  }
  const rows = people
    .map((p) => {
      const link = p.slug
        ? `<a href="/s/${escapeAttr(p.slug)}">${escapeHtml(p.label)}</a>`
        : escapeHtml(p.label);
      const when = p.valid_from
        ? ` <span class="ww-when">(${escapeHtml(p.valid_from.slice(0, 4))}${p.valid_to ? `–${escapeHtml(p.valid_to.slice(0, 4))}` : ""})</span>`
        : "";
      return `<li><span class="ww-role">${escapeHtml(p.role)}</span> <span class="ww-name">${link}</span>${when}</li>`;
    })
    .join("");
  return `<section data-schema="ItemList" data-schema-item="Person">
  <ul class="ww-list">${rows}</ul>
</section>
<style>
  .ww-list { list-style: none; padding: 0; margin: 0; }
  .ww-list li {
    display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;
    padding: 11px 0;
    border-top: 1px solid var(--rule);
  }
  .ww-list li:first-child { border-top: none; }
  .ww-role {
    font-family: var(--mono);
    font-size: 11.5px;
    color: var(--ink-3);
    text-transform: uppercase;
    letter-spacing: .04em;
    min-width: 130px;
  }
  .ww-name { font-family: var(--serif); font-size: 16px; color: var(--ink); flex: 1; }
  .ww-name a { color: var(--accent); text-decoration: none; }
  .ww-name a:hover { text-decoration: underline; }
  .ww-when { font-family: var(--mono); font-size: 11.5px; color: var(--ink-3); }
</style>`;
}

export async function renderWhosWhoPage(env: PublicEnv, slug: string): Promise<string | null> {
  const subject = await loadSubject(env, slug);
  if (!subject) return null;
  const people = await loadPeople(env, subject);
  const inner = renderWhosWhoBlock(people);
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Who's who · ${subject.label}`,
    description: `People connected to ${subject.label} via typed relationships — employment, board, membership, control.`,
    numberOfItems: people.length,
    itemListElement: people.slice(0, 25).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: { "@type": "Person", name: p.label, jobTitle: p.role },
    })),
    about: { "@type": "Thing", name: subject.label },
    publisher: { "@id": "https://canopticon.com/#org" },
  }).replace(/<\/script/gi, "<\\/script");
  return renderArrangementStandalone({
    subject,
    arrangementLabel: "Who's who",
    arrangementKind: "whos-who",
    inner,
    jsonLd,
    title: `Who's who · ${subject.label}`,
    description: `People connected to ${subject.label}.`,
  });
}

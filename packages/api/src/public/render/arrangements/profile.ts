// Entity profile arrangement — `/profile/:slug`.
//
// A subject's typed attributes + key relationships, laid out as a quick
// reference. Pure rendering — a couple of SQL queries against the typed
// graph + an HTML template. No LLM at render time.

import type { PublicEnv } from "../../data";
import {
  type SubjectContext,
  all,
  escapeAttr,
  escapeHtml,
  loadSubject,
  renderArrangementStandalone,
} from "./shared";

interface AttributeRow {
  key: string;
  value: string;
  quote_id: string | null;
}

interface RelationshipRow {
  other_label: string;
  other_slug: string | null;
  edge_type: string;
  valid_from: string | null;
  valid_to: string | null;
  quote_id: string | null;
}

interface FactRow {
  label: string;
  quote_id: string | null;
  piece_slug: string | null;
}

/** Load attributes (node_props on the subject) + relationship edges +
 *  top neutral facts about the subject. */
async function loadProfile(
  env: PublicEnv,
  subject: SubjectContext,
): Promise<{
  attributes: AttributeRow[];
  relationships: RelationshipRow[];
  facts: FactRow[];
  sourceCount: number;
}> {
  const [attributes, relationships, facts, sources] = await Promise.all([
    all<AttributeRow>(
      env.DB,
      `SELECT key, value,
              (SELECT id FROM quotes WHERE node_id = node_id LIMIT 1) AS quote_id
         FROM node_props WHERE node_id = ?
         ORDER BY key`,
      [subject.nodeId],
    ).catch(() => []),
    all<RelationshipRow>(
      env.DB,
      `SELECT
         (SELECT label FROM nodes WHERE id =
           CASE WHEN e.src_node_id = ? THEN e.dst_node_id ELSE e.src_node_id END) AS other_label,
         (SELECT p.slug FROM pages p
           WHERE p.subject_node_id =
             CASE WHEN e.src_node_id = ? THEN e.dst_node_id ELSE e.src_node_id END
           LIMIT 1) AS other_slug,
         e.edge_type, e.valid_from, e.valid_to,
         e.metadata AS quote_id
       FROM edges e
      WHERE e.user_id = ?
        AND (e.src_node_id = ? OR e.dst_node_id = ?)
        AND e.family = 'relationship'
      LIMIT 24`,
      [subject.nodeId, subject.nodeId, subject.userId, subject.nodeId, subject.nodeId],
    ).catch(() => []),
    all<FactRow>(
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
        LIMIT 8`,
      [subject.nodeId, subject.userId],
    ).catch(() => []),
    all<{ piece_id: string | null }>(
      env.DB,
      `SELECT DISTINCT n.piece_id
         FROM nodes n
        WHERE n.user_id = ? AND n.piece_id IS NOT NULL
          AND (n.id = ? OR EXISTS (
            SELECT 1 FROM edges e
            WHERE (e.src_node_id = n.id AND e.dst_node_id = ?)
               OR (e.dst_node_id = n.id AND e.src_node_id = ?)))`,
      [subject.userId, subject.nodeId, subject.nodeId, subject.nodeId],
    ).catch(() => []),
  ]);
  return { attributes, relationships, facts, sourceCount: sources.length };
}

/** Inner block — embedded in subject pages, also used by the standalone. */
export function renderProfileBlock(
  subject: SubjectContext,
  data: Awaited<ReturnType<typeof loadProfile>>,
): string {
  const { attributes, relationships, facts, sourceCount } = data;
  if (attributes.length === 0 && relationships.length === 0 && facts.length === 0) {
    return `<section class="profile-empty">
  <p>No structured attributes or relationships extracted yet for ${escapeHtml(subject.label)}. The profile fills in as documents in the Library are read — entity type, key dates, employment, ownership, and so on.</p>
</section>
<style>
  .profile-empty p { font-family: var(--serif); font-size: 15px; color: var(--ink-3); font-style: italic; max-width: 640px; margin: 0; }
</style>`;
  }

  const attrRows = attributes.length
    ? `<section class="profile-attrs" data-schema="${schemaTypeFor(subject.kind)}">
  <div class="sec-k">Attributes</div>
  <dl class="profile-dl">
    ${attributes
      .map(
        (a) => `<dt>${escapeHtml(humaniseKey(a.key))}</dt>
<dd>${escapeHtml(a.value)}${a.quote_id ? ` <a class="profile-receipt" href="/q/${escapeAttr(a.quote_id)}">↗</a>` : ""}</dd>`,
      )
      .join("")}
  </dl>
</section>`
    : "";

  const relRows = relationships.length
    ? `<section class="profile-rels" data-schema="ItemList">
  <div class="sec-k">Relationships</div>
  <div class="profile-rels-list">
    ${relationships
      .map(
        (r) => `<div class="profile-rel">
  <span class="profile-rel-type">${escapeHtml(r.edge_type)}</span>
  <span class="profile-rel-target">${r.other_slug ? `<a href="/s/${escapeAttr(r.other_slug)}">${escapeHtml(r.other_label)}</a>` : escapeHtml(r.other_label)}</span>
  ${r.valid_from ? `<span class="profile-rel-when">${escapeHtml(r.valid_from.slice(0, 4))}${r.valid_to ? `–${escapeHtml(r.valid_to.slice(0, 4))}` : ""}</span>` : ""}
</div>`,
      )
      .join("")}
  </div>
</section>`
    : "";

  const factRows = facts.length
    ? `<section class="profile-facts" data-schema="ItemList">
  <div class="sec-k">Established facts</div>
  <ul class="profile-facts-list">
    ${facts
      .map(
        (f) =>
          `<li>${escapeHtml(f.label)}${f.quote_id ? ` <a class="profile-receipt" href="/q/${escapeAttr(f.quote_id)}">↗</a>` : ""}${f.piece_slug ? ` <span class="profile-fact-src">· <a href="/library/${escapeAttr(f.piece_slug)}">source</a></span>` : ""}</li>`,
      )
      .join("")}
  </ul>
</section>`
    : "";

  const provLine =
    sourceCount > 0
      ? `<div class="profile-prov">Drawn from ${sourceCount} source document${sourceCount === 1 ? "" : "s"} in the Library. Every attribute and relationship above traces back to a verbatim quote.</div>`
      : "";

  return `<div class="profile-block">
  ${attrRows}
  ${relRows}
  ${factRows}
  ${provLine}
</div>
<style>
  .profile-block { margin: 0; }
  .profile-block .sec-k {
    font-size: 11px; letter-spacing: .14em;
    text-transform: uppercase;
    color: var(--ink-3); font-weight: 600;
    margin: 28px 0 14px;
  }
  .profile-block section:first-of-type .sec-k { margin-top: 0; }
  .profile-dl {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 10px 24px;
    margin: 0;
  }
  .profile-dl dt {
    font-family: var(--mono);
    font-size: 12.5px;
    color: var(--ink-3);
    letter-spacing: .04em;
    text-transform: uppercase;
    padding-top: 3px;
  }
  .profile-dl dd {
    font-family: var(--serif);
    font-size: 16px; line-height: 1.5;
    color: var(--ink);
    margin: 0;
  }
  .profile-receipt { color: var(--accent); text-decoration: none; font-size: 11px; }
  .profile-receipt:hover { text-decoration: underline; }
  .profile-rels-list { display: flex; flex-direction: column; }
  .profile-rel {
    display: flex; align-items: baseline; gap: 14px;
    padding: 10px 0;
    border-top: 1px solid var(--rule);
  }
  .profile-rel:first-child { border-top: none; }
  .profile-rel-type {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--ink-3);
    text-transform: uppercase;
    letter-spacing: .03em;
    min-width: 110px;
  }
  .profile-rel-target {
    font-family: var(--serif);
    font-size: 15.5px;
    color: var(--ink);
    flex: 1;
  }
  .profile-rel-target a { color: var(--accent); text-decoration: none; }
  .profile-rel-target a:hover { text-decoration: underline; }
  .profile-rel-when {
    font-family: var(--mono);
    font-size: 11.5px;
    color: var(--ink-3);
  }
  .profile-facts-list { list-style: none; padding: 0; margin: 0; }
  .profile-facts-list li {
    font-family: var(--serif);
    font-size: 15.5px; line-height: 1.5;
    color: var(--ink-2);
    padding: 10px 0;
    border-top: 1px solid var(--rule);
  }
  .profile-facts-list li:first-child { border-top: none; }
  .profile-fact-src { color: var(--ink-3); font-size: 13px; }
  .profile-fact-src a { color: var(--accent); text-decoration: none; }
  .profile-prov {
    margin-top: 24px;
    padding: 12px 16px;
    background: var(--paper-2, #f4f1ea);
    border: 1px solid var(--rule);
    border-radius: 7px;
    font-size: 13px;
    color: var(--ink-3);
  }
</style>`;
}

function schemaTypeFor(kind: string): string {
  if (kind === "entity") return "Person";
  if (kind === "event") return "Event";
  if (kind === "theme") return "CreativeWork";
  return "Thing";
}

function humaniseKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Standalone `/profile/:slug` page. */
export async function renderProfilePage(env: PublicEnv, slug: string): Promise<string | null> {
  const subject = await loadSubject(env, slug);
  if (!subject) return null;
  const data = await loadProfile(env, subject);
  const inner = renderProfileBlock(subject, data);

  // schema.org @type follows the subject kind. Person for entities;
  // CreativeWork for themes; Thing as fallback.
  const schemaType =
    subject.kind === "entity"
      ? "Person"
      : subject.kind === "event"
        ? "Event"
        : subject.kind === "theme"
          ? "CreativeWork"
          : "Thing";

  const description = data.attributes.length
    ? data.attributes
        .slice(0, 3)
        .map((a) => `${humaniseKey(a.key)}: ${a.value}`)
        .join(". ")
    : `Profile of ${subject.label}, drawn from extracted source documents.`;

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": schemaType,
    name: subject.label,
    description: description.slice(0, 400),
    url: `https://canopticon.com/profile/${subject.slug}`,
    sameAs:
      subject.signed_status === "published"
        ? [`https://canopticon.com/s/${subject.slug}?mode=signed`]
        : undefined,
    publisher: { "@id": "https://canopticon.com/#org" },
  }).replace(/<\/script/gi, "<\\/script");

  return renderArrangementStandalone({
    subject,
    arrangementLabel: "Profile",
    arrangementKind: "profile",
    inner,
    jsonLd,
    title: `Profile · ${subject.label}`,
    description: description.slice(0, 200),
  });
}

export { loadProfile };

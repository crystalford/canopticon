// The Record — the entity page (/record/:slug). The reference layer:
// bio, role, and the pieces that mention them ("appears in" footprint).
// The index of all entities lives at /topics, not here.

import { renderMarkdown } from "../../cms/lib/render-post";
import {
  type PublicEnv,
  getEntityBySlug,
  piecesMentioningEntity,
  resolveOperatorId,
} from "../data";
import { escapeHtml, renderPage } from "../layout";
import { emptyState, entityKindLabel, pieceCard, sectionHeader } from "./components";

export async function renderEntityPage(env: PublicEnv, slug: string): Promise<string | null> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return null;
  const entity = await getEntityBySlug(env.DB, userId, slug);
  if (!entity) return null;

  const pieces = await piecesMentioningEntity(env.DB, userId, entity.id);
  const bioHtml = entity.bio_html ?? (entity.bio_md ? renderMarkdown(entity.bio_md) : "");
  const kindText = entityKindLabel(entity.kind ?? entity.entity_type);

  const appearsIn = pieces.length
    ? `<section style="margin-bottom:36px">
        ${sectionHeader(`Appears in (${pieces.length})`)}
        <div class="cards-row">${pieces.map((p) => pieceCard(p)).join("")}</div>
      </section>`
    : `<section style="margin-bottom:36px">${sectionHeader("Appears in")}${emptyState("No published pieces mention this entity yet.")}</section>`;

  const body = `
<section style="margin-bottom:28px">
  <p class="kicker" style="margin-bottom:14px">${escapeHtml(kindText)}</p>
  <h1 style="font-family:var(--serif);font-size:42px;line-height:1.1;letter-spacing:-0.018em;margin:0 0 8px;color:var(--ink)">${escapeHtml(entity.canonical_name)}</h1>
  ${entity.current_role ? `<p style="font-family:var(--serif);font-size:19px;font-style:italic;color:var(--ink-3);margin:0 0 16px">${escapeHtml(entity.current_role)}</p>` : ""}
  ${bioHtml ? `<div class="prose" style="max-width:680px">${bioHtml}</div>` : entity.description ? `<p style="font-family:var(--serif);font-size:16px;line-height:1.6;color:var(--ink-2);max-width:680px">${escapeHtml(entity.description)}</p>` : ""}
</section>
${appearsIn}
`;
  return renderPage({
    title: entity.canonical_name,
    description: entity.current_role ?? entity.description ?? `${entity.canonical_name}`,
    body,
    activeNav: "/record",
    zone: "record",
  });
}

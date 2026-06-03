// The Record — entity index (grouped by kind) + the entity page.
// The entity page is the reference layer: bio, role, and the pieces
// that mention them ("appears in" footprint). Claims + relations +
// patterns wire in across Phase 2/4.

import { renderMarkdown } from "../../cms/lib/render-post";
import {
  type EntitySummary,
  type PublicEnv,
  getEntityBySlug,
  listEntities,
  piecesMentioningEntity,
  resolveOperatorId,
} from "../data";
import { escapeHtml, renderPage } from "../layout";
import { emptyState, entityCard, entityKindLabel, pieceCard, sectionHeader } from "./components";

export async function renderRecordIndex(env: PublicEnv): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const entities = userId ? await listEntities(env.DB, userId) : [];

  // Group by the broad kind buckets the design uses.
  const groups = new Map<string, EntitySummary[]>();
  for (const e of entities) {
    const bucket = entityKindLabel(e.kind ?? e.entity_type);
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket)?.push(e);
  }

  const sections = entities.length
    ? [...groups.entries()]
        .map(
          ([bucket, list]) => `<section style="margin-bottom:36px">
  ${sectionHeader(`${bucket} (${list.length})`)}
  <div class="cards-row">${list.map((e) => entityCard(e)).join("")}</div>
</section>`,
        )
        .join("")
    : emptyState(
        "The record is empty. Entities populate as the seed corpus and ingestion fill the substrate.",
      );

  const body = `
<section style="margin-bottom:24px">
  <div class="kicker" style="margin-bottom:16px"><span class="live"></span> Reference · the standing record</div>
  <h1 style="font-family:var(--serif);font-size:40px;line-height:1.12;letter-spacing:-0.015em;margin:0 0 12px;color:var(--ink)">The Record</h1>
  <p style="font-family:var(--serif);font-size:18px;line-height:1.55;color:var(--ink-2);max-width:680px">
    People, organizations, and concepts. Look up an entity and see every claim,
    source, and pattern that touches them — and, honestly, where coverage is thin.
  </p>
</section>
${sections}
`;
  return renderPage({
    title: "The Record",
    description: "The standing reference — people and organizations in the Canadian power record.",
    body,
    activeNav: "/record",
    zone: "record",
  });
}

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
  <p class="kicker" style="margin-bottom:14px">${escapeHtml(kindText)} · the record</p>
  <h1 style="font-family:var(--serif);font-size:42px;line-height:1.1;letter-spacing:-0.018em;margin:0 0 8px;color:var(--ink)">${escapeHtml(entity.canonical_name)}</h1>
  ${entity.current_role ? `<p style="font-family:var(--serif);font-size:19px;font-style:italic;color:var(--ink-3);margin:0 0 16px">${escapeHtml(entity.current_role)}</p>` : ""}
  ${bioHtml ? `<div class="prose" style="max-width:680px">${bioHtml}</div>` : entity.description ? `<p style="font-family:var(--serif);font-size:16px;line-height:1.6;color:var(--ink-2);max-width:680px">${escapeHtml(entity.description)}</p>` : ""}
</section>
${appearsIn}
`;
  return renderPage({
    title: entity.canonical_name,
    description:
      entity.current_role ?? entity.description ?? `${entity.canonical_name} — the record.`,
    body,
    activeNav: "/record",
    zone: "record",
  });
}

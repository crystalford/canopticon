// Topics — the index + individual hub. The highest-value surface per
// the audit: a hub is a signed overview + ALL relevant pieces (no cap)
// + key entities + (Phase 4) the relevant pattern and gap.

import { renderMarkdown } from "../../cms/lib/render-post";
import {
  type PublicEnv,
  entitiesForTopic,
  getTopic,
  listTopics,
  piecesForTopic,
  resolveOperatorId,
} from "../data";
import { escapeHtml, renderPage } from "../layout";
import { emptyState, entityCard, pieceCard, sectionHeader } from "./components";

export async function renderTopicsIndex(env: PublicEnv): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const topics = userId ? await listTopics(env.DB, userId) : [];

  const cards = topics.length
    ? `<div class="cards-3">${topics
        .map(
          (t) => `<a class="cardlink" href="/topics/${escapeHtml(t.slug)}">
  <div class="card-type t-topic">Topic</div>
  <div class="card-title">${escapeHtml(t.label)}</div>
  <div class="card-dek">${escapeHtml(firstLine(t.overview_md))}</div>
</a>`,
        )
        .join("")}</div>`
    : emptyState(
        "No topics yet. The seed corpus (and its six subject hubs) imports in a later phase.",
      );

  const body = `
<section style="margin-bottom:24px">
  <div class="kicker" style="margin-bottom:16px"><span class="live"></span> Browse by subject</div>
  <h1 style="font-family:var(--serif);font-size:40px;line-height:1.12;letter-spacing:-0.015em;margin:0 0 12px;color:var(--ink)">Topics</h1>
  <p style="font-family:var(--serif);font-size:18px;line-height:1.55;color:var(--ink-2);max-width:680px">
    Each topic is a pillar: a signed overview, every relevant investigation and report,
    the people and organizations involved, and what the corpus reveals across them.
  </p>
</section>
<section>${cards}</section>
`;
  return renderPage({
    title: "Topics",
    description:
      "Subject pillars — explore Canadian power by what's happening, not who's running it.",
    body,
    activeNav: "/topics",
    zone: "topics",
  });
}

export async function renderTopicHub(env: PublicEnv, slug: string): Promise<string | null> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return null;
  const topic = await getTopic(env.DB, userId, slug);
  if (!topic) return null;

  const [pieces, entities] = await Promise.all([
    piecesForTopic(env.DB, userId, topic.id),
    entitiesForTopic(env.DB, userId, topic.id),
  ]);

  const overviewHtml =
    topic.overview_html ?? (topic.overview_md ? renderMarkdown(topic.overview_md) : "");

  const piecesSection = pieces.length
    ? `<section style="margin-bottom:40px">
        ${sectionHeader(`Investigations & reports (${pieces.length})`)}
        <div class="cards-row">${pieces.map((p) => pieceCard(p)).join("")}</div>
      </section>`
    : `<section style="margin-bottom:40px">${sectionHeader("Investigations & reports")}${emptyState("No published pieces filed under this topic yet.")}</section>`;

  const entitiesSection = entities.length
    ? `<section style="margin-bottom:40px">
        ${sectionHeader("Key people & organizations")}
        <div class="cards-row">${entities.map((e) => entityCard(e)).join("")}</div>
      </section>`
    : "";

  const body = `
<section style="margin-bottom:28px">
  <div class="kicker" style="margin-bottom:16px"><span class="live"></span> Topic</div>
  <h1 style="font-family:var(--serif);font-size:42px;line-height:1.1;letter-spacing:-0.018em;margin:0 0 16px;color:var(--ink)">${escapeHtml(topic.label)}</h1>
  ${overviewHtml ? `<div class="prose" style="max-width:680px">${overviewHtml}</div>` : ""}
  ${topic.signed_by ? `<p class="coord" style="margin-top:14px"><span>Signed · ${escapeHtml(topic.signed_by)}</span></p>` : ""}
</section>
${piecesSection}
${entitiesSection}
`;
  return renderPage({
    title: topic.label,
    description: firstLine(topic.overview_md) || `${topic.label} — a Canopticon topic hub.`,
    body,
    activeNav: "/topics",
    zone: "topics",
  });
}

function firstLine(md: string): string {
  const line = md.split("\n").find((l) => l.trim().length > 0) ?? "";
  const clean = line.replace(/[#*_`>]/g, "").trim();
  return clean.length > 200 ? `${clean.slice(0, 197)}…` : clean;
}

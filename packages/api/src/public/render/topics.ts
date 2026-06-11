// Topics — the index + individual hub. The highest-value surface per
// the audit: a hub is a signed overview + ALL relevant pieces (no cap)
// + key entities + (Phase 4) the relevant pattern and gap.

import { renderMarkdown } from "../../cms/lib/render-post";
import {
  type PublicEnv,
  entitiesForTopic,
  getTopic,
  piecesForTopic,
  resolveOperatorId,
} from "../data";
import { escapeHtml, renderPage } from "../layout";
import { emptyState, entityCard, pieceCard, sectionHeader } from "./components";

export async function renderTopicsIndex(env: PublicEnv): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) {
    return renderPage({
      title: "Topics",
      description: "Browse subjects in the knowledge graph.",
      body: emptyState("No operator yet."),
      activeNav: "/topics",
      zone: "topics",
    });
  }

  // Subject pages from the fabric — entities, events, themes — grouped by kind.
  // Each subject is a page that grew from extraction; nobody wrote them.
  const { all } = await import("../../lib/d1");
  const subjects = await all<{
    slug: string;
    label: string;
    kind: string;
    signed_status: string;
    source_count: number;
  }>(
    env.DB,
    `SELECT p.slug, n.label, n.kind, p.signed_status,
            (SELECT COUNT(DISTINCT piece_id) FROM nodes
              WHERE user_id = ? AND lower(label) = lower(n.label) AND piece_id IS NOT NULL) AS source_count
       FROM pages p
       JOIN nodes n ON n.id = p.subject_node_id
      WHERE p.user_id = ?
      ORDER BY n.kind, source_count DESC, n.label
      LIMIT 300`,
    [userId, userId],
  ).catch(() => []);

  if (subjects.length === 0) {
    return renderPage({
      title: "Topics",
      description: "Browse subjects in the knowledge graph.",
      body: emptyState(
        "No subjects yet. Drop research reports in the Library — pages grow as documents are read.",
      ),
      activeNav: "/topics",
      zone: "topics",
    });
  }

  const themes = subjects.filter((s) => s.kind === "theme");
  const entities = subjects.filter((s) => s.kind === "entity");
  const events = subjects.filter((s) => s.kind === "event");

  const subjectCard = (s: (typeof subjects)[number], kindLabel: string): string => {
    const isSigned = s.signed_status === "signed" || s.signed_status === "published";
    return `<a class="cardlink" href="/s/${escapeHtml(s.slug)}">
  <div class="card-type t-${escapeHtml(s.kind)}">${escapeHtml(kindLabel)}${isSigned ? " · signed" : ""}</div>
  <div class="card-title">${escapeHtml(s.label)}</div>
  <div class="card-dek">${s.source_count} source${s.source_count === 1 ? "" : "s"}</div>
</a>`;
  };

  // Section helper. When a section is empty, render the heading + one line
  // explaining what fills it — so the reader sees the SHAPE of the index even
  // before themes or events surface (the Feels Like Brief: empty states say
  // what goes here, never look like a shell).
  const section = (
    heading: string,
    kicker: string,
    list: typeof subjects,
    kindLabel: string,
    emptyExplainer: string,
  ): string => {
    const cards = list.length
      ? `<div class="cards-3">${list
          .slice(0, 60)
          .map((s) => subjectCard(s, kindLabel))
          .join("")}</div>`
      : `<p style="font-family:var(--serif);font-size:15px;line-height:1.55;color:var(--ink-3);max-width:640px;font-style:italic">${escapeHtml(emptyExplainer)}</p>`;
    return `<section style="margin-bottom:36px">
  <div class="kicker" style="margin-bottom:10px">${escapeHtml(kicker)}</div>
  <h2 style="font-family:var(--serif);font-size:24px;margin-bottom:14px;color:var(--ink)">${escapeHtml(heading)}</h2>
  ${cards}
</section>`;
  };

  const body = `
<section style="margin-bottom:24px">
  <div class="kicker" style="margin-bottom:16px"><span class="live"></span> The fabric</div>
  <h1 style="font-family:var(--serif);font-size:40px;line-height:1.12;letter-spacing:-0.015em;margin:0 0 12px;color:var(--ink)">Topics</h1>
  <p style="font-family:var(--serif);font-size:18px;line-height:1.55;color:var(--ink-2);max-width:680px">
    Subjects in the knowledge graph — entities, events, and the received accounts the corpus engages with.
    Nobody wrote these pages; they grew as documents were read. Each page carries its receipts.
  </p>
</section>
${section(
  "Themes",
  "What the corpus is engaging with",
  themes,
  "Theme",
  "A theme is a received account the corpus pushes back on — surfaced automatically when three or more documents converge on contradicting the same proposition. None have crossed the threshold yet.",
)}
${section(
  "Entities",
  "People, organizations, places",
  entities,
  "Entity",
  "Entities the corpus has recognised but hasn't yet seeded into pages.",
)}
${section(
  "Events",
  "Dated occurrences",
  events,
  "Event",
  "Dated occurrences — extracted with their source quotes. No event pages yet.",
)}
`;

  return renderPage({
    title: "Topics",
    description:
      "Browse the knowledge graph — entities, events, and themes the corpus engages with.",
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

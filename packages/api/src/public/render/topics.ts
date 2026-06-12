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

  // Themes get hero treatment — fetch the received_account text so each card
  // can carry the *thing* the corpus is pushing back on, not just a label.
  // Themes are the most novel concept here; without the quote a theme card
  // is just an opaque title.
  const themeRows = themes.length
    ? await all<{
        slug: string;
        label: string;
        received_account: string;
        convergence_count: number;
        signed_status: string;
      }>(
        env.DB,
        `SELECT p.slug, n.label, t.received_account, t.convergence_count, p.signed_status
           FROM pages p
           JOIN nodes n ON n.id = p.subject_node_id
           JOIN themes t ON t.node_id = n.id
          WHERE p.user_id = ? AND n.kind = 'theme'
          ORDER BY t.convergence_count DESC, p.updated_at DESC`,
        [userId],
      ).catch(() => [])
    : [];

  const subjectCard = (s: (typeof subjects)[number], kindLabel: string): string => {
    const isSigned = s.signed_status === "signed" || s.signed_status === "published";
    return `<a class="cardlink" href="/s/${escapeHtml(s.slug)}">
  <div class="card-type t-${escapeHtml(s.kind)}">${escapeHtml(kindLabel)}${isSigned ? " · signed" : ""}</div>
  <div class="card-title">${escapeHtml(s.label)}</div>
  <div class="card-dek">${s.source_count} source${s.source_count === 1 ? "" : "s"}</div>
</a>`;
  };

  // Theme cards: hero treatment when themes exist. The received-account quote
  // is the editorial payload — italic, restrained, the thing the corpus is
  // engaging with. Convergence count is the proof-of-weight ("3 documents
  // push back on this") so readers know it's not someone's hunch.
  const themeCard = (t: (typeof themeRows)[number]): string => {
    const signed = t.signed_status === "signed" || t.signed_status === "published";
    return `<a class="theme-card" href="/s/${escapeHtml(t.slug)}${signed ? "?mode=signed" : ""}">
  <div class="theme-kicker">Theme${signed ? " · the operator's reading" : ""}</div>
  <h3 class="theme-label">${escapeHtml(t.label)}</h3>
  <p class="theme-quote">"${escapeHtml(t.received_account)}"</p>
  <div class="theme-meta">${t.convergence_count} document${t.convergence_count === 1 ? "" : "s"} push back on this account</div>
</a>`;
  };

  // The themes section — leads the page when any theme has surfaced. Empty
  // state explains what themes ARE so a first-time reader understands what
  // they'd see here once the threshold's met.
  const themesSection =
    themeRows.length > 0
      ? `<section class="topics-themes">
  <div class="topics-section-kicker">What the corpus is engaging with</div>
  <h2 class="topics-section-h">Themes</h2>
  <p class="topics-section-lede">Received accounts the corpus pushes back on. Surfaced automatically when three or more documents converge on contradicting the same proposition.</p>
  <div class="theme-grid">${themeRows.map((t) => themeCard(t)).join("")}</div>
</section>`
      : `<section class="topics-themes topics-themes-empty">
  <div class="topics-section-kicker">What the corpus is engaging with</div>
  <h2 class="topics-section-h">Themes</h2>
  <p class="topics-section-lede">A theme is a received account the corpus pushes back on — surfaced automatically when three or more documents converge on contradicting the same proposition. None have crossed the threshold yet.</p>
</section>`;

  // Entities + events render as plain card grids below — they're the
  // backbone, not the editorial spine. Themes lead.
  const plainSection = (
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
      : `<p class="topics-empty-line">${escapeHtml(emptyExplainer)}</p>`;
    return `<section class="topics-section">
  <div class="topics-section-kicker">${escapeHtml(kicker)}</div>
  <h2 class="topics-section-h">${escapeHtml(heading)}</h2>
  ${cards}
</section>`;
  };

  const body = `
<section class="topics-masthead">
  <div class="kicker"><span class="live"></span> The fabric</div>
  <h1 class="topics-hero">Topics</h1>
  <p class="topics-lede">
    Subjects in the knowledge graph — themes the corpus engages with, entities, and events.
    Nobody wrote these pages; they grew as documents were read. Each page carries its receipts.
  </p>
</section>
${themesSection}
${plainSection("Entities", "People, organizations, places", entities, "Entity", "Entities the corpus has recognised but hasn't yet seeded into pages.")}
${plainSection("Events", "Dated occurrences", events, "Event", "Dated occurrences — extracted with their source quotes. No event pages yet.")}

<style>
  .topics-masthead { margin-bottom: 32px; }
  .topics-masthead .kicker { margin-bottom: 16px; }
  .topics-hero {
    font-family: var(--serif);
    font-size: 40px; line-height: 1.12;
    letter-spacing: -0.015em;
    margin: 0 0 12px;
    color: var(--ink);
  }
  .topics-lede {
    font-family: var(--serif);
    font-size: 18px; line-height: 1.55;
    color: var(--ink-2);
    max-width: 680px;
  }
  .topics-themes { margin-bottom: 40px; padding-bottom: 36px; border-bottom: 1px solid var(--rule); }
  .topics-themes-empty { padding-bottom: 28px; }
  .topics-section { margin-bottom: 36px; }
  .topics-section-kicker {
    font-size: 12px;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: var(--ink-3);
    font-weight: 600;
    margin-bottom: 8px;
  }
  .topics-section-h {
    font-family: var(--serif);
    font-size: 28px; line-height: 1.15;
    margin: 0 0 14px;
    color: var(--ink);
  }
  .topics-section-lede {
    font-family: var(--serif);
    font-size: 15px; line-height: 1.55;
    color: var(--ink-3);
    max-width: 640px;
    margin: 0 0 18px;
  }
  .topics-empty-line {
    font-family: var(--serif);
    font-size: 15px; line-height: 1.55;
    color: var(--ink-3);
    max-width: 640px;
    font-style: italic;
  }
  .theme-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .theme-card {
    display: block;
    text-decoration: none;
    padding: 24px 26px;
    border: 1px solid var(--rule);
    border-radius: 12px;
    background: var(--surface, #fff);
    transition: border-color .12s;
  }
  .theme-card:hover { border-color: #c9bfa9; }
  .theme-kicker {
    font-size: 11.5px;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: var(--ink-3);
    margin-bottom: 10px;
  }
  .theme-label {
    font-family: var(--serif);
    font-size: 22px;
    line-height: 1.22;
    color: var(--ink);
    margin: 0 0 12px;
  }
  .theme-quote {
    font-family: var(--serif);
    font-size: 16px;
    line-height: 1.5;
    font-style: italic;
    color: var(--ink-2);
    margin: 0 0 14px;
    padding-left: 14px;
    border-left: 2px solid var(--accent);
  }
  .theme-meta {
    font-size: 12.5px;
    color: var(--ink-3);
    letter-spacing: .03em;
  }
  @media (max-width: 720px) {
    .theme-grid { grid-template-columns: 1fr; }
    .topics-hero { font-size: 32px; }
  }
</style>
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

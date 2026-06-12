// Timeline arrangement — `/t/:slug`.
//
// Events involving a subject, ordered by date. Pure rendering: a SQL
// query + a vertical-rail HTML template. No LLM at render time.
// Renders the same inner-block whether embedded inside a subject page
// or as a standalone page.

import type { PublicEnv } from "../../data";
import {
  type SubjectContext,
  all,
  escapeAttr,
  escapeHtml,
  loadSubject,
  renderArrangementStandalone,
} from "./shared";

interface EventRow {
  id: string;
  label: string;
  event_date: string | null;
  piece_slug: string | null;
  quote_id: string | null;
}

/** Load events about a subject, sorted by date ascending. Exported so the
 *  subject page can embed the timeline arrangement's inner block using the
 *  same data shape that the standalone /t/:slug uses. (Spec v2.6 Part 6 —
 *  one renderer, two contexts.) */
export async function loadEvents(env: PublicEnv, subject: SubjectContext): Promise<EventRow[]> {
  return all<EventRow>(
    env.DB,
    `SELECT n.id, n.label,
            json_extract(n.metadata, '$.event_date') AS event_date,
            (SELECT slug FROM pieces WHERE id = n.piece_id) AS piece_slug,
            (SELECT id FROM quotes WHERE node_id = n.id LIMIT 1) AS quote_id
       FROM nodes n
      WHERE n.user_id = ? AND n.kind = 'event'
        AND (EXISTS (SELECT 1 FROM edges e WHERE e.src_node_id = n.id AND e.dst_node_id = ?)
             OR EXISTS (SELECT 1 FROM edges e WHERE e.dst_node_id = n.id AND e.src_node_id = ?))
      ORDER BY json_extract(n.metadata, '$.event_date') ASC
      LIMIT 100`,
    [subject.userId, subject.nodeId, subject.nodeId],
  ).catch(() => []);
}

/** Render the inner block — used both standalone (with chrome) and embedded
 *  inside a subject page's "Timeline" section. Pure HTML; no JS required. */
export function renderTimelineBlock(events: EventRow[]): string {
  if (events.length === 0) {
    return `<section class="tl-empty" data-schema="ItemList">
  <p>No dated events extracted yet for this subject. Events surface from the documents in the Library; this section grows automatically as extraction reads them.</p>
</section>
<style>
  .tl-empty p { font-family: var(--serif); font-size: 15px; color: var(--ink-3); font-style: italic; max-width: 640px; margin: 0; }
</style>`;
  }
  const rows = events
    .map((e) => {
      const when = e.event_date?.slice(0, 7) ?? "—";
      const receipt = e.quote_id
        ? `<a class="tl-receipt" href="/q/${escapeAttr(e.quote_id)}">receipt ↗</a>`
        : "";
      const source = e.piece_slug
        ? `<a class="tl-src" href="/library/${escapeAttr(e.piece_slug)}">source ↗</a>`
        : "";
      return `<div class="tl-item">
  <div class="tl-when">${escapeHtml(when)}</div>
  <div class="tl-body">
    <div class="tl-label">${escapeHtml(e.label)}</div>
    <div class="tl-meta">${receipt}${receipt && source ? " · " : ""}${source}</div>
  </div>
</div>`;
    })
    .join("");
  return `<section data-schema="ItemList" data-schema-item="Event">
  <div class="tl-rail">${rows}</div>
</section>
<style>
  .tl-rail {
    position: relative;
    padding-left: 14px;
    margin-top: 4px;
  }
  .tl-rail::before {
    content: '';
    position: absolute;
    left: 6px; top: 8px; bottom: 8px;
    width: 2px;
    background: var(--rule);
  }
  .tl-item {
    display: grid;
    grid-template-columns: 92px 1fr;
    gap: 18px;
    padding: 14px 0;
    position: relative;
  }
  .tl-item::before {
    content: '';
    position: absolute;
    left: -14px; top: 22px;
    width: 12px; height: 12px;
    border-radius: 50%;
    background: var(--paper, #fff);
    border: 2px solid #b8a878;
  }
  .tl-item:first-child::before { background: var(--accent); border-color: var(--accent); }
  .tl-when {
    font-family: var(--mono);
    font-size: 12.5px;
    color: var(--ink-3);
    letter-spacing: .03em;
    padding-top: 2px;
  }
  .tl-label {
    font-family: var(--serif);
    font-size: 15.5px;
    line-height: 1.45;
    color: var(--ink);
  }
  .tl-meta {
    margin-top: 6px;
    font-size: 12px;
    color: var(--ink-3);
    letter-spacing: .03em;
  }
  .tl-receipt, .tl-src {
    color: var(--accent);
    text-decoration: none;
  }
  .tl-receipt:hover, .tl-src:hover { text-decoration: underline; }
  @media (max-width: 560px) {
    .tl-item { grid-template-columns: 1fr; gap: 4px; }
    .tl-when { padding-top: 0; }
  }
</style>`;
}

/** The standalone `/t/:slug` page. Wraps the inner-block in the arrangement
 *  chrome and emits ItemList + Event JSON-LD. */
export async function renderTimelinePage(env: PublicEnv, slug: string): Promise<string | null> {
  const subject = await loadSubject(env, slug);
  if (!subject) return null;
  const events = await loadEvents(env, subject);
  const inner = renderTimelineBlock(events);

  // ItemList of Event — the spec's standard for a chronology page. AI
  // engines lift this directly when asked about "Mark Carney's timeline".
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Timeline · ${subject.label}`,
    description: `Dated events involving ${subject.label}, extracted from stored source documents with verbatim citations.`,
    numberOfItems: events.length,
    itemListElement: events.slice(0, 30).map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Event",
        name: e.label,
        ...(e.event_date ? { startDate: e.event_date } : {}),
      },
    })),
    about: { "@type": "Thing", name: subject.label },
    publisher: { "@id": "https://canopticon.com/#org" },
  }).replace(/<\/script/gi, "<\\/script");

  return renderArrangementStandalone({
    subject,
    arrangementLabel: "Timeline",
    arrangementKind: "timeline",
    inner,
    jsonLd,
    title: `Timeline · ${subject.label}`,
    description: `Dated events involving ${subject.label}, extracted from stored source documents with verbatim citations.`,
  });
}

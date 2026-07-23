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
      ORDER BY CASE WHEN json_extract(n.metadata, '$.event_date') IS NULL
                      OR json_extract(n.metadata, '$.event_date') = '' THEN 1 ELSE 0 END,
               json_extract(n.metadata, '$.event_date') ASC
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
  const renderItem = (e: EventRow) => {
    const when = formatEventWhen(e.event_date);
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
  };

  // Group into year buckets (undated events fall into one "Undated" bucket
  // at the end, matching the load order above). A flat rail of 30+ events
  // reads as noise; a year heading gives the reader a scanning anchor a
  // bare date column doesn't. Groups stay intact across the visible/
  // collapsed boundary below — never split a year's events across the
  // "show more" fold, which read as arbitrary truncation.
  const groups: Array<{ year: string; items: EventRow[] }> = [];
  for (const e of events) {
    const year = eventYear(e.event_date);
    const last = groups[groups.length - 1];
    if (last && last.year === year) {
      last.items.push(e);
    } else {
      groups.push({ year, items: [e] });
    }
  }

  const renderGroupRows = (g: { year: string; items: EventRow[] }) =>
    `<div class="tl-year">${escapeHtml(g.year)}</div>${g.items.map(renderItem).join("")}`;

  // Cap by total EVENT count (not group count) so one busy year doesn't
  // blow the budget, but only ever fold whole groups — see comment above.
  const VISIBLE_CAP = 15;
  const visibleGroups: Array<{ year: string; items: EventRow[] }> = [];
  const collapsedGroups: Array<{ year: string; items: EventRow[] }> = [];
  let shown = 0;
  for (const g of groups) {
    if (shown < VISIBLE_CAP || visibleGroups.length === 0) {
      visibleGroups.push(g);
      shown += g.items.length;
    } else {
      collapsedGroups.push(g);
    }
  }
  const collapsedCount = collapsedGroups.reduce((n, g) => n + g.items.length, 0);

  // One continuous .tl-rail (and its vertical line) across every visible
  // group — year headers are rows inside it, not separate containers, so
  // the line doesn't break at each year boundary. The collapsed tail gets
  // its own rail inside <details> since it's a visually separate reveal.
  const rows = visibleGroups.map(renderGroupRows).join("");
  const restBlock = collapsedCount
    ? `<details class="tl-more">
  <summary>Show ${collapsedCount} more event${collapsedCount === 1 ? "" : "s"}</summary>
  <div class="tl-rail">${collapsedGroups.map(renderGroupRows).join("")}</div>
</details>`
    : "";
  return `<section data-schema="ItemList" data-schema-item="Event">
  <div class="tl-rail">${rows}</div>
  ${restBlock}
</section>
<style>
  .tl-year {
    font-family: var(--mono);
    font-size: 11px; letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--ink-3);
    padding: 14px 0 0;
    margin-left: -14px;
  }
  .tl-rail > .tl-year:first-child { padding-top: 8px; }
  .tl-more { margin-top: 6px; }
  .tl-more summary {
    cursor: pointer; font-family: var(--mono); font-size: 12px;
    color: var(--accent); padding: 8px 0; list-style: none;
  }
  .tl-more summary::-webkit-details-marker { display: none; }
  .tl-more summary::before { content: '+ '; }
  .tl-more[open] summary::before { content: '– '; }
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
    grid-template-columns: 120px 1fr;
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
    background: var(--paper);
    border: 2px solid var(--rule-bright);
  }
  .tl-rail > .tl-year:first-child + .tl-item::before { background: var(--accent); border-color: var(--accent); }
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

/** event_date isn't reliably ISO — extraction sometimes stores a natural-
 *  language date ("November 15, 2025") instead of "2025-11-15", or a year
 *  range ("1974-1975"). Blindly slicing to 7 chars (the old code) mangled
 *  natural-language dates into "Novembe", "Septemb", "Dec 31," — the
 *  truncation bug found live. A second, subtler bug found live after that:
 *  matching /^(\d{4})-(\d{2})/ against "1974-1975" reads the first TWO
 *  digits of the second year as if they were a month, producing "1974-19"
 *  — garbled, and not even a real month. The month group is now validated
 *  as 01-12 before being treated as YYYY-MM; anything else (including a
 *  year range) falls through to the whole-value or year-range handling. */
function formatEventWhen(raw: string | null): string {
  if (!raw) return "—";
  const iso = raw.match(/^(\d{4})-(\d{2})(?:-\d{2})?/);
  if (iso && Number(iso[2]) >= 1 && Number(iso[2]) <= 12) return `${iso[1]}-${iso[2]}`;
  const range = raw.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
  if (range) return `${range[1]}–${range[2]}`;
  const yearOnly = raw.match(/^\d{4}$/);
  if (yearOnly) return raw;
  return raw.length > 24 ? `${raw.slice(0, 23)}…` : raw;
}

/** The year a date sorts under for grouping — the first 4-digit run found,
 *  or "Undated" so those events cluster in their own trailing bucket
 *  instead of scattering wherever a null happened to sort. */
function eventYear(raw: string | null): string {
  const y = raw?.match(/\d{4}/);
  return y ? y[0] : "Undated";
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

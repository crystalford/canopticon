// READINGS IN THE MARGIN — the operator's note beside the passage it is about.
//
// A reading (lib/readings.ts, docs/the-record.md §5c) used to render as one
// block after the document, which separated the note from its passage by the
// length of the page — the same wrong place inline receipts were rescued from
// (receipts.ts). Now each reading is emitted as an <aside> immediately after
// the rendered block (paragraph, list item, blockquote, heading, table) that
// contains its passage. On a wide screen the stylesheet sets it in the right
// margin beside that block; on a phone it is inline under it. No script.
//
// HOW THE PASSAGE IS FOUND
//
// Two passes, because the body is markdown when the passage can be located
// and HTML by the time a block exists to attach to:
//
//   1. markReadingPassages — locateVerbatim(body_md, verbatim_text), the same
//      firewall every receipt goes through (never quotes.byte_offset, which is
//      not a document position — see receipts.ts). A private-use marker is
//      written into the markdown at the END of the passage. It survives the
//      markdown renderer as text: escapeHtml leaves it alone and no inline
//      rule matches it.
//   2. placeReadings — finds each marker in the rendered HTML, walks the tags
//      to the block that contains it, removes the marker and emits the aside.
//
// A reading whose passage cannot be located in the current text gets no
// marker and is reported back so the page can say so (rule 6) instead of
// pinning the note to the wrong paragraph or dropping it.

import { locateVerbatim } from "../../graph/lib/digestion-typed";

/** Private-use code points: never in a document, never touched by the renderer. */
const MARK_OPEN = "";
const MARK_CLOSE = "";
const MARK_RE = /([^]*)/g;

export interface MarkedReading {
  id: string;
  verbatim_text: string;
}

export interface MarkResult {
  /** body_md with a marker after each located passage. */
  markdown: string;
  /** The reading ids whose passage was located. */
  located: Set<string>;
}

/** The marker written after a reading's passage. Exported for tests. */
export function readingMark(id: string): string {
  return `${MARK_OPEN}${id}${MARK_CLOSE}`;
}

/**
 * Write a marker after every reading passage that is verbatim in `bodyMd`.
 *
 * A passage whose end falls on a heading line is treated as not placeable:
 * the marker would land inside the heading's anchor slug and the aside
 * would fight the heading's own link. The reading then takes the fallback
 * block, honestly labelled.
 */
export function markReadingPassages(bodyMd: string, readings: MarkedReading[]): MarkResult {
  const located = new Set<string>();
  if (!bodyMd || !readings.length) return { markdown: bodyMd, located };

  const ends: Array<{ at: number; id: string }> = [];
  for (const r of readings) {
    if (!r.id || !r.verbatim_text) continue;
    const found = locateVerbatim(bodyMd, r.verbatim_text);
    if (!found) continue;
    const at = found.offset + found.text.length;
    if (endsInHeading(bodyMd, at)) continue;
    ends.push({ at, id: r.id });
    located.add(r.id);
  }
  if (!ends.length) return { markdown: bodyMd, located };

  // Right to left so earlier offsets stay valid.
  ends.sort((a, b) => b.at - a.at);
  let out = bodyMd;
  for (const e of ends) out = `${out.slice(0, e.at)}${readingMark(e.id)}${out.slice(e.at)}`;
  return { markdown: out, located };
}

function endsInHeading(md: string, at: number): boolean {
  const lineStart = md.lastIndexOf("\n", Math.max(0, at - 1)) + 1;
  return /^\s*#{1,6}\s/.test(md.slice(lineStart, at));
}

export interface PlaceResult {
  html: string;
  /** The reading ids whose aside landed beside a block. */
  placed: Set<string>;
}

/** Elements that count as a block for the purpose of "the block containing it". */
const BLOCK_TAGS = new Set([
  "p",
  "li",
  "ul",
  "ol",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "pre",
  "td",
  "th",
  "tr",
  "thead",
  "tbody",
  "table",
  "div",
  "section",
  "details",
  "summary",
  "aside",
]);

const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;

interface Tag {
  name: string;
  closing: boolean;
  start: number;
  end: number;
}

function tagsIn(html: string, from: number, to: number): Tag[] {
  const out: Tag[] = [];
  TAG_RE.lastIndex = from;
  let m: RegExpExecArray | null = TAG_RE.exec(html);
  while (m && m.index < to) {
    const raw = m[0];
    if (!raw.endsWith("/>")) {
      out.push({
        name: (m[1] as string).toLowerCase(),
        closing: raw.startsWith("</"),
        start: m.index,
        end: m.index + raw.length,
      });
    }
    m = TAG_RE.exec(html);
  }
  return out;
}

/** The closing tag of the block that contains position `pos`, or null. */
function containingClose(html: string, pos: number): Tag | null {
  let depth = 0;
  for (const t of tagsIn(html, pos, html.length)) {
    if (!BLOCK_TAGS.has(t.name)) continue;
    if (t.closing) {
      if (depth === 0) return t;
      depth--;
    } else {
      depth++;
    }
  }
  return null;
}

/** The opening tag matching the closing tag `close`, searching backwards. */
function matchingOpen(html: string, close: Tag): Tag | null {
  const tags = tagsIn(html, 0, close.start).filter((t) => t.name === close.name);
  let depth = 0;
  for (let i = tags.length - 1; i >= 0; i--) {
    const t = tags[i] as Tag;
    if (t.closing) depth++;
    else if (depth === 0) return t;
    else depth--;
  }
  return null;
}

/**
 * Attach each marked reading's aside to the block that contains its marker.
 *
 * `render(id)` produces the aside's HTML; it is called only for readings
 * that land. Markers whose block cannot be resolved are stripped and the
 * reading is reported as not placed, so the caller can give it the fallback
 * block rather than lose it.
 *
 * Where the aside goes, by block:
 *   · <p>, heading, <pre>, a whole <blockquote>: the block and its asides are
 *     wrapped in <div class="annotated"> so the stylesheet can set the note
 *     beside the block with a grid, and the row is as tall as the taller of
 *     the two — two notes on consecutive paragraphs never overlap.
 *   · <li>: the item's own text (up to any nested list) is wrapped the same
 *     way, INSIDE the item, so the list keeps its markers and the aside is
 *     valid flow content. The text gets a .annotated-text element of its own
 *     first: inline runs dropped straight into a grid each become an item.
 *   · a table cell: after the whole table (its .table-wrap when present) —
 *     a cell is no place for a paragraph of note.
 */
export function placeReadings(
  html: string,
  readings: MarkedReading[],
  render: (id: string) => string,
): PlaceResult {
  const placed = new Set<string>();
  const known = new Set(readings.map((r) => r.id));
  let out = html;

  // Order readings by their first marker position so asides come out in
  // document order within a block.
  for (let guard = 0; guard < 200; guard++) {
    MARK_RE.lastIndex = 0;
    const m = MARK_RE.exec(out);
    if (!m) break;
    const markStart = m.index;
    const markId = m[1] as string;
    if (!known.has(markId)) {
      out = `${out.slice(0, markStart)}${out.slice(markStart + m[0].length)}`;
      continue;
    }

    const close = containingClose(out, markStart);
    const target = close ? blockRange(out, close) : null;
    if (!target) {
      // No block to attach to: drop the marker, report the reading unplaced.
      out = `${out.slice(0, markStart)}${out.slice(markStart + m[0].length)}`;
      continue;
    }

    // Every marker inside the block's range belongs to this block.
    const inner = out.slice(target.start, target.end);
    const ids: string[] = [];
    const stripped = inner.replace(MARK_RE, (_all, id: string) => {
      if (known.has(id) && !ids.includes(id)) ids.push(id);
      return "";
    });
    const asides = ids.map((id) => {
      placed.add(id);
      return render(id);
    });
    // A list item's text is inline runs, and a grid would make each run its
    // own item — so it gets one element of its own first.
    const block = target.wrapInner ? `<div class="annotated-text">${stripped}</div>` : stripped;
    const replacement = target.wrap
      ? `<div class="annotated">${block}${asides.join("")}</div>`
      : `${block}${asides.join("")}`;
    out = `${out.slice(0, target.start)}${replacement}${out.slice(target.end)}`;
  }

  // Anything left is a marker for a reading the page does not know about.
  out = out.replace(MARK_RE, "");
  return { html: out, placed };
}

/**
 * The range of HTML to treat as "the block", from the block's closing tag.
 * `wrap` says whether to put the range and the asides in a grid wrapper.
 */
function blockRange(
  html: string,
  close: Tag,
): { start: number; end: number; wrap: boolean; wrapInner?: boolean } | null {
  const name = close.name;

  if (name === "li") {
    const open = matchingOpen(html, close);
    if (!open) return null;
    // The item's own text runs to the first nested list at this depth, or to
    // the item's end.
    let depth = 0;
    let textEnd = close.start;
    for (const t of tagsIn(html, open.end, close.start)) {
      if (!BLOCK_TAGS.has(t.name)) continue;
      if (t.closing) depth--;
      else {
        if (depth === 0 && (t.name === "ul" || t.name === "ol")) {
          textEnd = t.start;
          break;
        }
        depth++;
      }
    }
    return { start: open.end, end: textEnd, wrap: true, wrapInner: true };
  }

  if (name === "td" || name === "th" || name === "tr" || name === "thead" || name === "tbody") {
    // Up and out to the table, then past its wrapper if it has one.
    const tableClose = tagsIn(html, close.end, html.length).find(
      (t) => t.closing && t.name === "table",
    );
    if (!tableClose) return null;
    let end = tableClose.end;
    const after = html.slice(end, end + 6);
    if (after === "</div>") end += 6;
    // Range starts at the table's own open (or its wrapper's) so the marker
    // inside the cell is stripped with the rest.
    const tableOpen = matchingOpen(html, tableClose);
    if (!tableOpen) return null;
    let start = tableOpen.start;
    const before = html.slice(Math.max(0, start - 24), start);
    const wrapIdx = before.lastIndexOf('<div class="table-wrap">');
    if (wrapIdx >= 0) start = start - (before.length - wrapIdx);
    return { start, end, wrap: false };
  }

  if (name === "table" || name === "ul" || name === "ol" || name === "div" || name === "section") {
    // A marker directly inside a container, outside any leaf block: attach
    // after the container without wrapping it.
    const open = matchingOpen(html, close);
    if (!open) return null;
    return { start: open.start, end: close.end, wrap: false };
  }

  const open = matchingOpen(html, close);
  if (!open) return null;
  return { start: open.start, end: close.end, wrap: true };
}

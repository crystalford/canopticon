// What a research document already says about itself.
//
// The complaint, raised three times: "just a wall of text. absolutely insane
// to try to comb through if you aren't a machine."
//
// True, and the fix is not to write a summary. A deep-research document
// ALREADY contains its own structure — the live PASS 7 dossier has nine
// sections, a sixteen-row table of hardened facts, and a section it calls
// DOCUMENTARY GAPS REMAINING. All of that was buried mid-scroll behind a
// thousand words of sourcing. Nothing needed inventing; it needed finding and
// putting first.
//
// So this module INVENTS NOTHING. It locates three things the document wrote
// itself and hands them back:
//
//   · contents  — its headings, so a reader can orient and jump
//   · lead table — its own summary/facts table, whichever it wrote
//   · gaps      — the section where it says what it could not establish
//
// WHY THE LEAD TABLE IS MOVED AND NOT COPIED
//
// Standing rule 3: nothing is written twice. Showing the table at the top
// while the body still contains it puts the same sixteen rows on one page
// twice. So `remainder` is the body WITHOUT the promoted block, and the page
// renders promoted-then-remainder — the same document, reordered, with
// nothing added and nothing dropped.
//
// "Kept whole and published as itself" still holds where it does the most
// work: the `.md` twin and the raw download are byte-exact and untouched. The
// HTML page is a reading of the document; the twin is the document.

export interface DocumentSection {
  level: number;
  text: string;
  /** Slug anchor, matching what render/markdown.ts emits for the same text. */
  anchor: string;
}

export interface DocumentStructure {
  /** Headings, in document order. Empty when the document has no sections. */
  contents: DocumentSection[];
  /** The document's own summary table, as markdown, or null. */
  leadTable: string | null;
  /** The heading that introduced the lead table, if it had one. */
  leadTableHeading: string | null;
  /** The document's own statement of what it could not establish. */
  gaps: string | null;
  gapsHeading: string | null;
  /** The body with any promoted block removed. */
  remainder: string;
}

/** Headings whose section is the document saying what it could NOT show. */
const GAPS_RE = /\b(gaps?|missing|unresolved|unknowns?|limitations?|caveats?|not establish)/i;
/** Headings that introduce a document's own distillation. */
const SUMMARY_RE = /\b(summary|key facts|hardened|findings|at a glance|headline)/i;

export function documentStructure(bodyMd: string): DocumentStructure {
  const empty: DocumentStructure = {
    contents: [],
    leadTable: null,
    leadTableHeading: null,
    gaps: null,
    gapsHeading: null,
    remainder: bodyMd ?? "",
  };
  if (!bodyMd?.trim()) return empty;

  const lines = bodyMd.split("\n");
  const contents: DocumentSection[] = [];
  const seen = new Set<string>();

  // Blocks: each heading owns the lines until the next heading of the same or
  // higher level. Tracked as index ranges so a promoted block can be cut out
  // of the original text without re-serialising it.
  const blocks: Array<{ start: number; end: number; level: number; text: string }> = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (!m) continue;
    const level = (m[1] as string).length;
    const text = (m[2] as string).trim().replace(/\s*#+\s*$/, "");
    let anchor = slug(text);
    if (seen.has(anchor)) {
      let n = 2;
      while (seen.has(`${anchor}-${n}`)) n++;
      anchor = `${anchor}-${n}`;
    }
    seen.add(anchor);
    contents.push({ level, text, anchor });
    if (blocks.length) {
      const prev = blocks[blocks.length - 1] as (typeof blocks)[number];
      prev.end = i;
    }
    blocks.push({ start: i, end: lines.length, level, text });
  }

  // The document's own summary table: a table inside a summary-ish section,
  // or failing that the first table in the document at all.
  let leadTable: string | null = null;
  let leadTableHeading: string | null = null;
  let cut: { start: number; end: number } | null = null;

  for (const b of blocks) {
    if (!SUMMARY_RE.test(b.text)) continue;
    const table = findTable(lines, b.start + 1, b.end);
    if (table) {
      leadTable = lines.slice(table.start, table.end).join("\n");
      leadTableHeading = b.text;
      cut = { start: b.start, end: b.end };
      break;
    }
  }
  if (!leadTable) {
    const table = findTable(lines, 0, lines.length);
    if (table) {
      leadTable = lines.slice(table.start, table.end).join("\n");
      cut = { start: table.start, end: table.end };
    }
  }

  // What the document says it could not establish. The single most valuable
  // block on a page whose argument is provenance, and it sits at the bottom of
  // a 3.3k-word scroll where nobody reaches it.
  //
  // MOVED, not copied — same as the table, and for the same reason. The first
  // build of this left it in place too, on the theory that a short block costs
  // nothing to repeat. Rendered, it was plainly the same two bullets twice on
  // one page, which is exactly what rule 3 exists to stop.
  let gaps: string | null = null;
  let gapsHeading: string | null = null;
  let gapsCut: { start: number; end: number } | null = null;
  for (const b of blocks) {
    if (!GAPS_RE.test(b.text)) continue;
    const body = lines
      .slice(b.start + 1, b.end)
      .join("\n")
      .trim();
    if (body) {
      gaps = body;
      gapsHeading = b.text;
      gapsCut = { start: b.start, end: b.end };
    }
    break;
  }

  // Both cuts applied at once, highest index first so the earlier range's
  // offsets stay valid.
  const cuts = [cut, gapsCut].filter((c): c is { start: number; end: number } => c !== null);
  cuts.sort((a, b) => b.start - a.start);
  let kept = lines;
  for (const c of cuts) kept = [...kept.slice(0, c.start), ...kept.slice(c.end)];
  const remainder = cuts.length ? kept.join("\n").trim() : bodyMd;

  // A rail entry for a section that has been moved to the top would jump to
  // an anchor the body no longer has.
  const promoted = new Set([leadTableHeading, gapsHeading].filter(Boolean) as string[]);
  return {
    contents: contents.filter((c) => !promoted.has(c.text)),
    leadTable,
    leadTableHeading,
    gaps,
    gapsHeading,
    remainder,
  };
}

/** The first pipe table between two line indices, as a [start, end) range. */
function findTable(
  lines: string[],
  from: number,
  to: number,
): { start: number; end: number } | null {
  for (let i = from; i < to - 1; i++) {
    const head = lines[i] ?? "";
    const delim = lines[i + 1] ?? "";
    if (!head.includes("|")) continue;
    if (!/^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(delim)) continue;
    let end = i + 2;
    while (end < to && (lines[end] ?? "").includes("|") && (lines[end] ?? "").trim()) end++;
    // One header and one delimiter is not a table worth promoting.
    if (end - i < 3) continue;
    return { start: i, end };
  }
  return null;
}

/** Must match render/markdown.ts's headingSlug, or the contents rail misses. */
function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[`*_~[\]()]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "section"
  );
}

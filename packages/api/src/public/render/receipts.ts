// INLINE RECEIPTS — put the proof in the passage that makes the claim.
//
// A verified quote used to be reachable only from a block under the document.
// That is the wrong place for two reasons. For a reader, the claim and its
// proof are separated by the length of the page. For a retriever, they are
// separated by a chunk boundary: retrieval is passage-level, so a claim in one
// chunk with its proof in another gets lifted WITHOUT the proof, which is
// exactly the thing this publication exists to prevent.
//
// So the span goes back into the sentence it came from, as a link to its own
// receipt. Nothing here is composed or paraphrased — the text rendered is the
// document's own text, located inside the document, and the only change is
// that it becomes clickable.
//
// WHY THIS MATCHES AT RENDER TIME RATHER THAN USING THE STORED OFFSET
//
// quotes.byte_offset cannot be used for this, and it is worth writing down
// why so nobody reaches for it again:
//
//   · digestion-typed.ts computes it against a ~3000-char chunk and the chunk
//     index is never stored. That is the majority of the corpus's quotes.
//   · chunkText() re-joins blocks with "\n\n" and carries an 800-char overlap
//     into the next chunk, so a chunk is not even a contiguous slice of the
//     document — the offset can be wrong in principle, not merely shifted.
//   · aeo-extract.ts has the same problem above 24KB.
//   · Only lede.ts measures against a true prefix of body_md.
//   · They are not byte offsets either: locateVerbatim uses indexOf/slice, so
//     they are UTF-16 code-unit indices.
//
// locateVerbatim is the right tool instead, and reusing it is the point: it is
// the same firewall the extractor trusts, it returns THE DOCUMENT'S substring
// rather than the model's, and it is whitespace-tolerant — which is required
// here, because a quote routinely spans a hard wrap in body_md.

import { locateVerbatim } from "../../graph/lib/digestion-typed";

export interface ReceiptSpan {
  quote_id: string;
  verbatim_text: string;
}

export interface SpliceResult {
  /** The body with receipts placed. Unchanged when nothing could be placed. */
  markdown: string;
  /**
   * The quote ids that actually landed in the prose.
   *
   * Callers need this, not just the markdown. The findings block links "in
   * context" to `#q-<id>`, and that anchor only exists if the span was
   * placed — so without this the block renders a dead link for every quote
   * that has gone missing from the body. On a site whose argument is
   * provenance, a link that goes nowhere is worse than no link.
   */
  placed: Set<string>;
}

interface Splice {
  start: number;
  end: number;
  text: string;
  quoteId: string;
}

/**
 * Rewrite each span's occurrence in `bodyMd` as a markdown link to its receipt.
 *
 * Markdown, not HTML: the renderer escapes body text on purpose (an uploaded
 * file is content, not markup), so a spliced <a> would be shown rather than
 * followed. Its link rule already permits same-site hrefs, so "[span](/q/id)"
 * survives the escape pass intact.
 *
 * Returns `bodyMd` unchanged when nothing can be placed. A miss is normal, not
 * a fault: body_md can be rewritten after extraction with no re-verification
 * (admin/ingest-library.ts, cms/tools/pieces.ts), so a quote that no longer
 * appears in the document simply stays unlinked. Silence is the correct
 * behaviour — the alternative is linking text that is no longer there.
 */
export function spliceReceipts(bodyMd: string, spans: ReceiptSpan[]): SpliceResult {
  if (!bodyMd || !spans.length) return { markdown: bodyMd, placed: new Set() };

  const protectedRanges = proseExclusions(bodyMd);
  const taken: Splice[] = [];

  // Longest first: a long span is the more specific claim, and placing it
  // first stops a short one inside it from winning the position.
  const ordered = [...spans].sort((a, b) => b.verbatim_text.length - a.verbatim_text.length);

  for (const span of ordered) {
    if (!span.quote_id || !span.verbatim_text) continue;
    const found = locateVerbatim(bodyMd, span.verbatim_text);
    if (!found) continue;

    const start = found.offset;
    const end = start + found.text.length;

    // A "]" would close the link text early and leave the URL visible in the
    // middle of a sentence.
    if (found.text.includes("]")) continue;
    // A span crossing a blank line crosses a paragraph boundary, and a link
    // cannot straddle two paragraphs.
    if (/\n[ \t]*\n/.test(found.text)) continue;
    // Headings, table rows and code are not prose. A link inside a heading
    // fights its anchor; a pipe inside a table cell breaks the row.
    if (protectedRanges.some((r) => start < r.end && end > r.start)) continue;
    // One receipt per stretch of text.
    if (taken.some((t) => start < t.end && end > t.start)) continue;

    taken.push({ start, end, text: found.text, quoteId: span.quote_id });
  }

  if (!taken.length) return { markdown: bodyMd, placed: new Set() };

  // Right to left, so earlier offsets stay valid as we rewrite.
  taken.sort((a, b) => b.start - a.start);
  let out = bodyMd;
  for (const t of taken) {
    out = `${out.slice(0, t.start)}[${t.text}](/q/${t.quoteId})${out.slice(t.end)}`;
  }
  return { markdown: out, placed: new Set(taken.map((t) => t.quoteId)) };
}

/**
 * Character ranges that are not prose and must not be spliced into: fenced
 * code, heading lines, and table rows.
 */
function proseExclusions(md: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let pos = 0;
  let inFence = false;
  for (const line of md.split("\n")) {
    const start = pos;
    const end = pos + line.length;
    pos = end + 1; // the newline

    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      ranges.push({ start, end });
      continue;
    }
    if (inFence || /^\s*#{1,6}\s/.test(line) || line.includes("|")) {
      ranges.push({ start, end });
    }
  }
  return ranges;
}

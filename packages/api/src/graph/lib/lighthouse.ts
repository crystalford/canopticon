// Lighthouse — counting and weighting for the synthesis layer.
// Implements the v3.5 §6.5 corrections so recurring-actor surfaces
// reflect structure, not the operator's research attention:
//   1. count distinct INVESTIGATIONS (chains collapse), not documents
//   2. compute over evidence-bearing pieces only (research-report,
//      documented-record, synthesis; not essays)
//   3. surface distinctiveness/keyness + caveat + date range, not a
//      bare tally
//
// Pure helpers (no DB writes). Renderers call them at render time.

import type { PieceSummary } from "../../public/data";

export interface ChainCollapsedCount {
  investigations: number;
  documents: number;
  chains: number;
}

/** Collapse a set of pieces by chain_id: each chain counts as one
 *  investigation regardless of how many passes it contains. Pieces
 *  without a chain_id count individually. */
export function collapseByChain(
  pieces: Array<Pick<PieceSummary, "id"> & { chain_id?: string | null }>,
): ChainCollapsedCount {
  const documents = pieces.length;
  const chainsSeen = new Set<string>();
  let standalone = 0;
  for (const p of pieces) {
    if (p.chain_id) chainsSeen.add(p.chain_id);
    else standalone += 1;
  }
  return {
    investigations: standalone + chainsSeen.size,
    documents,
    chains: chainsSeen.size,
  };
}

/** Filter to evidence-bearing kinds only. Operator essays are written
 *  about subjects but don't independently corroborate them — they
 *  shouldn't pump up a "this person appears in N reports" tally. */
export function filterEvidenceBearing<T extends { kind: string }>(pieces: T[]): T[] {
  return pieces.filter(
    (p) => p.kind === "research-report" || p.kind === "documented-record" || p.kind === "synthesis",
  );
}

/** Render the honest counting label per the spec: lead with the
 *  investigation count, demote documents, show the date range. */
export function recurringActorLabel(
  evidenceCount: ChainCollapsedCount,
  dateRange?: { from?: string | null; to?: string | null },
): string {
  const docsPart =
    evidenceCount.documents === evidenceCount.investigations
      ? ""
      : ` (${evidenceCount.documents} documents${evidenceCount.chains > 0 ? `; ${evidenceCount.chains} chain${evidenceCount.chains > 1 ? "s" : ""}` : ""})`;
  const datePart = dateRange?.from
    ? ` · research dates ${dateRange.from.slice(0, 7)}${dateRange.to ? ` to ${dateRange.to.slice(0, 7)}` : ""}`
    : "";
  return `appears in ${evidenceCount.investigations} investigation${evidenceCount.investigations === 1 ? "" : "s"}${docsPart}${datePart}`;
}

/** Distinctiveness signal — a rough IDF-style "is this entity more
 *  characteristic of our corpus than baseline?" check. With one
 *  operator and one corpus we don't have a real baseline yet, so
 *  Phase 4 ships the structural collapse only; baseline lands later
 *  if/when we wire an external comparison set. */
export function distinctivenessBlurb(count: number, corpusSize: number): string {
  if (corpusSize === 0) return "";
  const share = count / corpusSize;
  if (share > 0.5)
    return "Heavily clustered in the current corpus — partly reflects research focus.";
  if (share > 0.25) return "Notably present in the corpus.";
  return "";
}

/** Format a date range pair for surface display. */
export function dateRangeLabel(from?: string | null, to?: string | null): string {
  if (!from && !to) return "";
  if (from && to && from.slice(0, 7) === to.slice(0, 7)) return from.slice(0, 7);
  return `${from?.slice(0, 7) ?? "—"} to ${to?.slice(0, 7) ?? "—"}`;
}

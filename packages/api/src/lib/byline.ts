// Who is responsible for what this publication says.
//
// One module because two surfaces need the same answer and must not drift:
// the rendered byline a reader sees, and the JSON-LD `author` a crawler reads.
// They disagreed once already — the visible byline was repaired to a real
// name while the structured data kept emitting the stored placeholder, which
// is the half a machine actually parses.

/**
 * The person who holds editorial responsibility for everything published here.
 *
 * Named on purpose, for two independent reasons:
 *
 * 1. CITABILITY. Across 366,087 citations from 12 AI search models, named
 *    authors carry a 1.40 citation odds ratio against 1.12 overall — a
 *    bylined piece is roughly 25% likelier to be cited than anonymous
 *    content. An earlier pass SUPPRESSED the byline because the stored value
 *    read as placeholder text; that removed a signal rather than repairing it.
 * 2. DISCLOSURE. From August 2026, EU transparency rules require AI-drafted
 *    text on matters of public interest to be disclosed UNLESS it had
 *    substantive human review and a NAMED PERSON holds editorial
 *    responsibility. Canadian political economy is public-interest material
 *    and the operator does review, so naming them is what makes the exemption
 *    true rather than merely asserted.
 */
export const EDITOR = "Chris Telford";

/**
 * Stored bylines that are placeholders rather than people.
 *
 * They resolve to the editor's name instead of being hidden. The rows were
 * written before there was a name to use, and rewriting them in the database
 * would be a migration to fix a display problem.
 */
const PLACEHOLDER_BYLINES = new Set([
  "the operator",
  "operator",
  "canopticon",
  "canopticon research agent",
  "research agent",
]);

/** The name to publish for a stored byline. Never empty. */
export function resolveByline(stored: string | null | undefined): string {
  const t = (stored ?? "").trim();
  if (!t || PLACEHOLDER_BYLINES.has(t.toLowerCase())) return EDITOR;
  return t;
}

/**
 * Whether an update is worth showing a reader.
 *
 * Freshness is a real ranking input — one analysis puts it at 40% of
 * Perplexity's signal, with content older than 30 days deprioritised — and
 * "author + date + update-date visibility" is named directly in the citation
 * trust-signal research. But a page that says "Updated" on its publication
 * day is noise, and a record that cries update over a whitespace change is
 * worse than one that says nothing. So: a full day apart, or it isn't news.
 */
export function showsUpdate(publishedAt?: string | null, updatedAt?: string | null): boolean {
  if (!publishedAt || !updatedAt) return false;
  const p = Date.parse(publishedAt);
  const u = Date.parse(updatedAt);
  if (!Number.isFinite(p) || !Number.isFinite(u)) return false;
  return u - p >= 24 * 60 * 60 * 1000;
}

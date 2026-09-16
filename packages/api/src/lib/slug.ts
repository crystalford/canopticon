// What a document's URL is called.
//
// Every one of the 50 documents published before this shipped under a slug
// like `compass-artifact-wf-facec16e-8872-4a9f-a905-feabce4b8aa9-text-markdown`
// — a Claude export filename with a UUID in it, derived from the upload's
// filename because that is all the ingest path had.
//
// For a publication whose entire purpose is being cited, that is the worst
// available state. The URL is the part a person copies into a footnote and the
// part a machine keys on, and that one carries no signal and reads as broken.
//
// Renaming is cheapest now and gets more expensive with every inbound link, so
// this exists to do it once, safely: old slugs become aliases (migration 0052)
// and keep resolving, because a citation that 404s is worse than an ugly one.

/** A UUID anywhere, or the export-filename shape the uploads arrived with. */
const MACHINE_SLUG_RE =
  /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}|^compass-artifact|-text-markdown$|^untitled)/i;

/** A slug that is a filename rather than a name. */
export function looksLikeMachineSlug(slug: string): boolean {
  if (!slug) return true;
  return MACHINE_SLUG_RE.test(slug);
}

/** Words that carry no meaning in a URL and cost length that matters. */
const STOP = new Set([
  "a",
  "an",
  "the",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "and",
  "or",
  "is",
  "are",
  "was",
  "were",
]);

/** Slugs longer than this get trimmed at a word boundary. */
const MAX_LEN = 72;

/**
 * A readable slug from a human title.
 *
 * Stopwords come out, but only when the slug would otherwise be long — a
 * short title stays intact, because "the-carney-performance" reads better
 * than "carney-performance" and the length saving is worth nothing there.
 * Numbers and years are always kept: they are frequently the most specific
 * part of a research title ("1994-2026", "bill-c-22").
 */
export function pieceSlug(title: string): string {
  const words = title
    .toLowerCase()
    // Apostrophes and quote marks are DELETED rather than turned into
    // separators, so "Canada's" becomes "canadas" and not "canada-s".
    .replace(/['\u2018\u2019"\u201c\u201d]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  const full = words.join("-");
  if (!full) return "";
  if (full.length <= MAX_LEN) return full;

  const trimmed = words.filter((w) => !STOP.has(w) || /\d/.test(w));
  const base = (trimmed.length ? trimmed : words).join("-");
  if (base.length <= MAX_LEN) return base;

  // Cut at a word boundary, never mid-word: a slug ending in "administrat"
  // is worse than a shorter one that ends on a real word.
  const cut = base.slice(0, MAX_LEN);
  const lastDash = cut.lastIndexOf("-");
  return (lastDash > 20 ? cut.slice(0, lastDash) : cut).replace(/-+$/, "");
}

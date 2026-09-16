// What a document is called in public.
//
// An uploaded file's title is derived by the extractor from its first heading,
// but that fails for files whose text has no heading — and then the title is
// whatever the file was called, e.g.
// `compass_artifact_wf-c96cfa7c-3f5d-44e9-b01e-2aea6ad75f33_text_markdown.md`.
//
// The operator's library view already hid those behind "Untitled research
// document", but that guard lived there and only there. Every public surface —
// the piece page, the indexes, the sitemap, llms.txt, the feed, the JSON-LD
// headline — rendered the stored title raw, so a document could publish,
// syndicate and get indexed under a UUID filename.
//
// This is the one place that decides, so all of those agree.

const MACHINE_FILENAME_RE =
  /(\.(md|txt|pdf|html?|docx?|csv|json)$|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4})/i;

export const UNTITLED = "Untitled research document";

/**
 * Headings that name a SECTION rather than the document.
 *
 * The extractor takes a document's first heading as its title, which is right
 * most of the time and wrong in a specific way: a document that opens with
 * "## Introduction" or "## Title and Executive Summary" gets that as its
 * public name. Measured in the live corpus — "Profile", "Title and Executive
 * Summary", "Introduction: The Pattern in Brief".
 *
 * This matters more than it looks. The title is the page's H1, its citation
 * name, its JSON-LD headline, and now the source of its URL — so one generic
 * heading propagates into every surface at once, and `/p/profile` is a slug
 * nobody can un-mint.
 */
const GENERIC_HEADS = new Set([
  "abstract",
  "background",
  "conclusion",
  "contents",
  "executive summary",
  "findings",
  "introduction",
  "methodology",
  "notes",
  "overview",
  "preface",
  "profile",
  "references",
  "report",
  "research",
  "summary",
  "title",
  "title and executive summary",
]);

/**
 * A title that names a section instead of the work.
 *
 * Deliberately conservative — it only fires on a heading that is ENTIRELY
 * generic. "Introduction: The Pattern in Brief" is not generic, because the
 * part after the colon is a real subject; `displayTitle` takes that part
 * rather than rejecting the whole thing.
 */
export function looksLikeGenericTitle(title: string): boolean {
  const t = title
    .replace(/^#+\s*/, "")
    .trim()
    .replace(/[.:—–-]+$/, "")
    .trim()
    .toLowerCase();
  if (!t) return true;
  return GENERIC_HEADS.has(t);
}

/** Strip Markdown heading marks the extractor left on a stored title. */
function stripHeadingMarks(title: string): string {
  return title.replace(/^#+\s*/, "").trim();
}

/** A stored title that is really a filename, not something a person wrote. */
/**
 * Signals decisive enough to override the whitespace heuristic below: a full
 * UUID, or a filename extension at the end.
 *
 * The live corpus contains `compass_artifact_wf-<uuid>_text_markdown (1).md`.
 * The " (1)" a downloader added is whitespace, so the "anything with a space
 * was written by a person" rule called it human and let it publish as a page
 * title. Strong signals are checked first for exactly that reason.
 */
const STRONG_FILENAME_RE =
  /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\.(md|txt|pdf|html?|docx?|csv|json)$)/i;

export function looksLikeMachineFilename(title: string): boolean {
  if (!title) return true;
  // The length floor comes FIRST and beats every other signal. "notes.md" is
  // a filename by shape but too short to be worth acting on, and renaming a
  // real title is worse than letting an odd one through.
  if (title.length < 20) return false;
  // A UUID or an extension beats the whitespace rule below, but not the floor.
  if (STRONG_FILENAME_RE.test(title)) return true;
  // Otherwise whitespace means someone wrote it; filenames don't have spaces.
  if (/\s/.test(title)) return false;
  return MACHINE_FILENAME_RE.test(title);
}

/**
 * The title to show a reader. Falls back the same way
 * `/v1/admin/backfill-library` repairs stored titles, so a piece reads the
 * same whether or not that backfill has been run against it.
 *
 * `bodyStart` only needs the opening of the document — index queries select
 * `substr(body_md, 1, 400)` rather than dragging every row's full text across
 * for a title.
 */
export function displayTitle(title: string, bodyStart?: string | null): string {
  const clean = stripHeadingMarks(title);
  if (clean && !looksLikeMachineFilename(clean) && !looksLikeGenericTitle(clean)) {
    // "Introduction: The Pattern in Brief" — the section word is noise, the
    // part after it is the actual subject. Only when what follows can stand
    // on its own; "Notes: 3" would be worse than leaving it alone.
    const [head, ...rest] = clean.split(":");
    const tail = rest.join(":").trim();
    if (head && looksLikeGenericTitle(head) && tail.length >= 12) return tail.slice(0, 200);
    return clean;
  }

  const body = bodyStart ?? "";
  // Every heading, not just the first: a document whose first heading is
  // "Introduction" usually has a real one further down, and taking the first
  // unconditionally is what produced the generic titles in the corpus.
  for (const m of body.matchAll(/^#{1,3}\s+(.+)$/gm)) {
    const heading = stripHeadingMarks(m[1]?.trim() ?? "");
    if (heading && !looksLikeGenericTitle(heading)) return heading.slice(0, 200);
  }
  const firstLine = body
    .split("\n")
    .map((l) => stripHeadingMarks(l.trim()))
    .find((l) => l.length > 0 && !looksLikeGenericTitle(l));
  if (firstLine && firstLine.length <= 200) return firstLine;
  return UNTITLED;
}

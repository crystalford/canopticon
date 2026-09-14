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

/** A stored title that is really a filename, not something a person wrote. */
export function looksLikeMachineFilename(title: string): boolean {
  if (!title) return true;
  // Any whitespace means someone wrote it; filenames don't have spaces.
  if (/\s/.test(title)) return false;
  if (title.length < 20) return false;
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
  if (!looksLikeMachineFilename(title)) return title;
  const body = bodyStart ?? "";
  const heading = body.match(/^#{1,2}\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading.slice(0, 200);
  const firstLine = body
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (firstLine && firstLine.length <= 200) return firstLine;
  return UNTITLED;
}

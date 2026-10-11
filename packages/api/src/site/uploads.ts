// Published Admin uploads, as library rows — the D1 half of the public list.
//
// The content store is the record as the handoff delivered it; everything
// published from Admin since lives in D1 (`pieces`, own uploads only, via
// OWN_UPLOADS_SQL). This reads those rows into the same LibraryItem shape and
// hands them to the store (setUploadedRows), at most once a minute per
// isolate, so a page view does not cost a query and a fresh publish shows up
// within the minute — or at once in the isolate that published it, which
// calls invalidateUploads().

import { OWN_UPLOADS_SQL } from "../admin/runtime";
import type { Env } from "../env";
import { all } from "../lib/d1";
import { resolveOperatorId } from "../public/data";
import { type LibraryItem, setUploadedRows } from "./content/store";
import { plain } from "./md";
import { shortDate } from "./theme";

const TTL_MS = 60_000;
let fetchedAt = 0;
let inflight: Promise<void> | null = null;

export function invalidateUploads(): void {
  fetchedAt = 0;
}

const KIND: Record<string, LibraryItem["kind"]> = {
  research: "Research",
  paper: "Paper",
  article: "Article",
};

/** The first prose paragraph, for the row's dek. */
function firstParagraph(md: string): string {
  for (const block of md.split(/\n\s*\n/)) {
    const b = block.trim();
    if (!b || /^(#|\||>|-{3,}|\*\*\*)/.test(b)) continue;
    const t = plain(b);
    if (t.length > 40) return t.length > 240 ? `${t.slice(0, 239).trimEnd()}…` : t;
  }
  return "";
}

export async function refreshUploads(env: Env): Promise<void> {
  if (Date.now() - fetchedAt < TTL_MS) return;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const userId = await resolveOperatorId(env.DB);
      if (!userId) return;
      const rows = await all<{
        slug: string;
        title: string;
        body_md: string | null;
        published_at: string | null;
        metadata: string | null;
      }>(
        env.DB,
        `SELECT slug, title, substr(body_md, 1, 4000) AS body_md, published_at, metadata, length(body_md) AS chars
           FROM pieces
          WHERE user_id = ? AND publication_status IN ('published', 'canonical') AND ${OWN_UPLOADS_SQL}
          ORDER BY published_at DESC LIMIT 500`,
        [userId],
      );
      setUploadedRows(
        rows.map((r) => {
          let meta: { sorted_as?: string; library_topic?: string; topic?: string } = {};
          try {
            meta = JSON.parse(r.metadata ?? "{}");
          } catch {
            // Unreadable metadata files the row as research under Other.
          }
          const date = (r.published_at ?? "").slice(0, 10);
          const chars = (r as unknown as { chars?: number }).chars ?? (r.body_md ?? "").length;
          return {
            route: `/p/${r.slug}`,
            doc: r.slug,
            kind: KIND[meta.sorted_as ?? ""] ?? "Research",
            topic: meta.library_topic ?? "Other",
            date,
            dateLabel: date ? shortDate(date) : "",
            title: r.title,
            dek: firstParagraph(r.body_md ?? ""),
            stat: `${Math.max(1, Math.round(chars / 1000))}k characters`,
            min: Math.max(1, Math.round(chars / 1500)),
          };
        }),
      );
      fetchedAt = Date.now();
    } catch {
      // A failed read leaves the last good list in place; the page still serves.
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

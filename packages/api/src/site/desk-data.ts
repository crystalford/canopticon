// What the desk shows: the operator's uploads that are waiting for a
// decision, the ones that could not be read, the ones kept private, and
// what was published from here recently. Own uploads only (OWN_UPLOADS_SQL).

import { OWN_UPLOADS_SQL } from "../admin/runtime";
import type { Env } from "../env";
import { all } from "../lib/d1";
import { type SortedAs, isSortedAs, sortUpload } from "../lib/sort-upload";

export interface DeskPiece {
  id: string;
  slug: string;
  title: string;
  status: string;
  chars: number;
  head: string;
  createdAt: string;
  publishedAt: string | null;
  desk: string;
  sortedAs: SortedAs;
  sortedWhy: string;
  topic: string;
  filename: string;
}

interface Row {
  id: string;
  slug: string;
  title: string;
  publication_status: string;
  chars: number | null;
  head: string | null;
  created_at: string;
  published_at: string | null;
  metadata: string | null;
}

function toPiece(r: Row): DeskPiece {
  let m: Record<string, unknown> = {};
  try {
    m = JSON.parse(r.metadata ?? "{}");
  } catch {
    // An unreadable metadata blob still shows as a card, sorted afresh.
  }
  const sorted = isSortedAs(m.sorted_as) ? m.sorted_as : sortUpload(r.head ?? "").as;
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    status: r.publication_status,
    chars: r.chars ?? 0,
    head: r.head ?? "",
    createdAt: r.created_at,
    publishedAt: r.published_at,
    desk: typeof m.desk === "string" ? m.desk : "",
    sortedAs: sorted,
    sortedWhy: typeof m.sorted_why === "string" ? m.sorted_why : sortUpload(r.head ?? "").why,
    topic: typeof m.library_topic === "string" ? m.library_topic : "",
    filename: typeof m.original_filename === "string" ? m.original_filename : r.title,
  };
}

const COLS = `id, slug, title, publication_status, length(body_md) AS chars,
  substr(body_md, 1, 3000) AS head, created_at, published_at, metadata`;

export interface DeskModel {
  waiting: DeskPiece[];
  failed: DeskPiece[];
  kept: DeskPiece[];
  published: DeskPiece[];
}

export async function deskModel(env: Env, userId: string): Promise<DeskModel> {
  const rows = await all<Row>(
    env.DB,
    `SELECT ${COLS} FROM pieces
      WHERE user_id = ? AND ${OWN_UPLOADS_SQL}
        AND json_extract(metadata, '$.desk') IS NOT NULL
      ORDER BY created_at DESC LIMIT 200`,
    [userId],
  ).catch(() => [] as Row[]);
  // Anything that was read as nothing — a PDF without a text layer — needs a
  // text version, whether it came through the desk or before it.
  const empty = await all<Row>(
    env.DB,
    `SELECT ${COLS} FROM pieces
      WHERE user_id = ? AND ${OWN_UPLOADS_SQL}
        AND (body_md IS NULL OR length(trim(body_md)) < 40)
        AND COALESCE(json_extract(metadata, '$.desk'), '') <> 'removed'
      ORDER BY created_at DESC LIMIT 50`,
    [userId],
  ).catch(() => [] as Row[]);
  const pieces = rows.map(toPiece);
  const failed = empty.map(toPiece);
  const failedIds = new Set(failed.map((p) => p.id));
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  return {
    waiting: pieces.filter((p) => p.desk === "waiting" && !failedIds.has(p.id)),
    failed,
    kept: pieces.filter((p) => p.desk === "private"),
    published: pieces.filter(
      (p) => p.desk === "published" && p.status === "published" && (p.publishedAt ?? "") > weekAgo,
    ),
  };
}

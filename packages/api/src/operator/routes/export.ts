// The research archive download, in parts. A module in the by-concern split:
// read-only, and sharing nothing with the upload, research or leads handlers.

import { MAX_DOCS_PER_ZIP, archiveParts, buildArchive } from "../../lib/research-archive";
import { resolveOperatorId } from "../../public/data";
import { renderExportPage } from "../../public/render/library/export";
import { operatorApp } from "./app";

const app = operatorApp();

/**
 * Every own upload, oldest first.
 *
 * Own uploads only (OWN_UPLOADS_SQL), the guard every query over one
 * population of `pieces` uses, so an archive can never carry the research
 * pipeline's drafts or the third-party text the corpus-split notes warn about.
 * Read-only: nothing here publishes, deletes or changes a row.
 *
 * Oldest first and stable, so part N is the same documents on every request
 * until the corpus changes. (Upload something between two downloads and the
 * later parts shift by one; download again from the top if that happens.)
 */
async function ownUploads(db: D1Database, userId: string) {
  const { OWN_UPLOADS_SQL } = await import("../../admin/runtime");
  const { all } = await import("../../lib/d1");
  return all<{
    slug: string;
    title: string;
    body_md: string | null;
    published_at: string | null;
    publication_status: string;
  }>(
    db,
    `SELECT slug, title, body_md, published_at, publication_status
       FROM pieces
      WHERE user_id = ? AND ${OWN_UPLOADS_SQL}
      ORDER BY COALESCE(published_at, created_at) ASC, slug ASC`,
    [userId],
  ).catch(() => []);
}

// GET /op/export — the list of downloads.
app.get("/export", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/desk");
  const { parts, skipped } = archiveParts(await ownUploads(c.env.DB, userId));
  let first = 1;
  const summaries = parts.map((docs, i) => {
    const s = { part: i + 1, count: docs.length, first, titles: docs.map((d) => d.title) };
    first += docs.length;
    return s;
  });
  return c.html(
    renderExportPage({
      parts: summaries,
      total: summaries.reduce((n, p) => n + p.count, 0),
      skipped,
      max: MAX_DOCS_PER_ZIP,
    }),
  );
});

// GET /op/export/research.zip?part=N — one part of the archive.
//
// Mounted at /export/..., NOT /library/export.zip: the /library/:slug redirect
// in routes/session.ts is registered first and would answer "export.zip" as a
// document slug. Inside /op, so it sits behind Cloudflare Access like every
// other operator route — a part hands out a slice of the whole corpus.
//
// No part, or one that does not exist, goes to the list rather than to an
// error: a bookmark from before the archive was split lands on the page that
// explains the parts, and a part number is only ever wrong because the corpus
// shrank.
app.get("/export/research.zip", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/desk");

  const wanted = Number.parseInt(c.req.query("part") ?? "", 10);
  const { parts, skipped } = archiveParts(await ownUploads(c.env.DB, userId));
  if (!Number.isInteger(wanted) || wanted < 1 || wanted > parts.length) {
    return c.redirect("/op/export");
  }

  const docs = parts[wanted - 1] ?? [];
  const first = parts.slice(0, wanted - 1).reduce((n, p) => n + p.length, 0) + 1;
  const total = parts.reduce((n, p) => n + p.length, 0);
  const { bytes, included } = buildArchive(docs, {
    part: wanted,
    parts: parts.length,
    first,
    total,
  });

  const day = new Date().toISOString().slice(0, 10);
  return new Response(bytes, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="canopticon-research-part-${wanted}-of-${parts.length}-${day}.zip"`,
      // Counts ride along so a download can be checked without opening it.
      "x-archive-part": String(wanted),
      "x-archive-parts": String(parts.length),
      "x-archive-included": String(included),
      "x-archive-skipped": String(skipped),
      "cache-control": "no-store",
    },
  });
});

export default app;

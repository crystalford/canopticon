// The research archive download. A new module in the by-concern split: it is
// read-only and shares nothing with the upload, research or leads handlers.

import { resolveOperatorId } from "../../public/data";
import { operatorApp } from "./app";

const app = operatorApp();

// GET /op/export/research.zip — every uploaded report, as markdown, in one zip.
//
// The reports exist only in the live D1, so without this the only way out is
// one request per document. One .md per report plus an INDEX.md; each file is
// the document's own body untouched under a small front-matter block (see
// lib/research-archive.ts for why the body is never rewritten).
//
// Mounted at /export/..., NOT /library/export.zip: the /library/:slug redirect
// in routes/session.ts is registered first and would answer "export.zip" as a
// document slug. Inside /op, so it sits behind Cloudflare Access like every
// other operator route — this hands out the whole corpus in one request.
//
// Own uploads only (OWN_UPLOADS_SQL), the guard every query over one
// population of `pieces` uses, so the archive can never carry the research
// pipeline's drafts or third-party text the corpus-split notes warn about.
// Read-only: nothing here publishes, deletes or changes a row.
app.get("/export/research.zip", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/library");
  const { OWN_UPLOADS_SQL } = await import("../../admin/runtime");
  const { all } = await import("../../lib/d1");
  const { buildArchive } = await import("../../lib/research-archive");

  const pieces = await all<{
    slug: string;
    title: string;
    body_md: string | null;
    published_at: string | null;
    publication_status: string;
  }>(
    c.env.DB,
    `SELECT slug, title, body_md, published_at, publication_status
       FROM pieces
      WHERE user_id = ? AND ${OWN_UPLOADS_SQL}
      ORDER BY COALESCE(published_at, created_at) ASC`,
    [userId],
  ).catch(() => []);

  const { bytes, included, skipped } = buildArchive(pieces);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(bytes, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="canopticon-research-${day}.zip"`,
      // Counts ride along so the download can be checked against the library
      // without opening the archive.
      "x-archive-included": String(included),
      "x-archive-skipped": String(skipped),
      "cache-control": "no-store",
    },
  });
});

export default app;

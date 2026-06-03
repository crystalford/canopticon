// Library ingestion — POST /v1/admin/ingest-library
//
// Bulk imports the 65-report seed corpus from the design build's
// canopticon-library.zip. The reports come in as working-material
// pieces (chain interior / raw research; no public page per spec §2.6),
// so the anti-orphan rule doesn't apply — they don't need topic
// mapping.
//
// The operator builds the payload locally with
// `pnpm tsx scripts/build-library-payload.ts <path-to-library.zip>`
// and POSTs the resulting JSON. Idempotent upsert by slug.

import { Hono } from "hono";
import { z } from "zod";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { insertOne, one, run } from "../lib/d1.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

const reportSchema = z.object({
  id: z.string().min(1).optional(),
  slug: z.string().min(1).max(120),
  title: z.string().min(1),
  kind: z
    .enum(["essay", "research-report", "documented-record", "thesis", "synthesis", "brief", "note"])
    .default("research-report"),
  body_md: z.string().min(1),
  detected_entities: z.array(z.string()).optional(),
  word_count: z.number().optional(),
});

const payloadSchema = z.object({
  reports: z.array(reportSchema).min(1).max(200),
  force: z.boolean().optional(),
});

interface IngestReport {
  pieces_inserted: number;
  pieces_skipped: number;
  pieces_failed: Array<{ slug: string; reason: string }>;
}

app.post("/ingest-library", async (c) => {
  const userId = c.get("user_id");
  const parsed = payloadSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: { code: "bad_request", message: "invalid payload", issues: parsed.error.issues } },
      400,
    );
  }
  const { reports, force = false } = parsed.data;
  const report: IngestReport = {
    pieces_inserted: 0,
    pieces_skipped: 0,
    pieces_failed: [],
  };

  for (const r of reports) {
    try {
      const existing = await one<{ id: string }>(
        c.env.DB,
        "SELECT id FROM pieces WHERE user_id = ? AND slug = ?",
        [userId, r.slug],
      );
      if (existing && !force) {
        report.pieces_skipped += 1;
        continue;
      }
      // Title scrub: the design's manifest leaves a leading "# " on a
      // few entries (the markdown heading mark). Strip it cleanly.
      const title = r.title.replace(/^#+\s*/, "").trim();
      if (existing && force) {
        await run(
          c.env.DB,
          `UPDATE pieces SET title = ?, kind = ?, body_md = ?,
                  metadata = ?, updated_at = ?
             WHERE id = ?`,
          [
            title,
            r.kind,
            r.body_md,
            JSON.stringify({
              source_id: r.id ?? null,
              detected_entities: r.detected_entities ?? [],
              word_count: r.word_count ?? null,
              ingested_from: "library-bulk",
            }),
            new Date().toISOString(),
            existing.id,
          ],
        );
        report.pieces_inserted += 1;
        continue;
      }
      await insertOne(c.env.DB, "pieces", {
        user_id: userId,
        slug: r.slug,
        title,
        kind: r.kind,
        publication_status: "working-material",
        body_md: r.body_md,
        byline: "the operator",
        tags: JSON.stringify([]),
        metadata: {
          source_id: r.id ?? null,
          detected_entities: r.detected_entities ?? [],
          word_count: r.word_count ?? null,
          ingested_from: "library-bulk",
        },
      });
      report.pieces_inserted += 1;
    } catch (err) {
      report.pieces_failed.push({
        slug: r.slug,
        reason: (err as Error).message,
      });
    }
  }

  return c.json({ ok: true, report });
});

export default app;

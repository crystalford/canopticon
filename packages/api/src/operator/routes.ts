// Operator console routes. Mounted at /op in the Worker root.
// Cloudflare Access gates this whole subtree (configured at the edge),
// so no auth middleware is needed here — every request that reaches us
// is the authenticated operator.
//
// Server-rendered screens; the chat screen attaches a small client
// module for the SSE stream.

import { unzipSync } from "fflate";
import { Hono } from "hono";
import { SEED_ENTITIES, SEED_PIECES, SEED_TOPICS, SEED_TOPIC_ENTITIES } from "../admin/seed-data";
import { renderMarkdown } from "../cms/lib/render-post";
import type { Env } from "../env";
import { insertOne, one, run } from "../lib/d1";
import { resolveOperatorId } from "../public/data";
import { CHAT_CLIENT_JS } from "./client/chat-js";
import { opHtml } from "./layout";
import { renderChatScreen } from "./screens/chat";
import { renderConsole } from "./screens/console";
import { renderIngestScreen } from "./screens/ingest";
import { renderOpSkeleton } from "./screens/skeleton";

const app = new Hono<{ Bindings: Env }>();

// Console (home).
app.get("/", async (c) => opHtml(await renderConsole(c.env)));

// Chat — list + active conversation. Client JS handles the live stream.
app.get("/chat", async (c) => opHtml(await renderChatScreen(c.env)));
app.get("/chat/:id", async (c) => opHtml(await renderChatScreen(c.env, c.req.param("id"))));

// Chat client module. Long cache; content changes rarely.
app.get("/chat.js", () => {
  return new Response(CHAT_CLIENT_JS, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
});

// Skeleton screens — full build lands in later phases.
app.get("/workbench", () =>
  opHtml(
    renderOpSkeleton({
      title: "Workbench",
      activeNav: "/op/workbench",
      coord: "entity-by-entity",
      whatsHere:
        "The workbench opens any entity's working surface — its claims (with CL-IDs and confidence), sources, relations, and open leads. Parameterized routing and the claim editor land in a later phase.",
    }),
  ),
);

app.get("/workbench/:entity", (c) =>
  opHtml(
    renderOpSkeleton({
      title: "Workbench",
      activeNav: "/op/workbench",
      coord: c.req.param("entity"),
      whatsHere: "Per-entity workbench surface — lands in a later phase.",
    }),
  ),
);

app.get("/ingest", async (c) => {
  const result = c.req.query("result");
  const error = c.req.query("error");
  return opHtml(await renderIngestScreen(c.env, { result, error }));
});

app.post("/ingest/seed", async (c) => {
  try {
    const form = await c.req.formData();
    const force = form.get("force") === "1";
    const userId = await resolveOperatorId(c.env.DB);
    if (!userId) throw new Error("No operator user found — run the deploy workflow first.");

    const report = {
      topics_inserted: 0,
      topics_skipped: 0,
      entities_inserted: 0,
      entities_skipped: 0,
      pieces_inserted: 0,
      pieces_skipped: 0,
      joins_inserted: 0,
    };

    const topicIdBySlug = new Map<string, string>();
    for (const t of SEED_TOPICS) {
      const existing = await one<{ id: string }>(
        c.env.DB,
        "SELECT id FROM topics WHERE user_id = ? AND slug = ?",
        [userId, t.slug],
      );
      if (existing && !force) {
        topicIdBySlug.set(t.slug, existing.id);
        report.topics_skipped++;
        continue;
      }
      if (existing && force) {
        await run(
          c.env.DB,
          "UPDATE topics SET label = ?, overview_md = ?, overview_html = ?, sort_order = ? WHERE id = ?",
          [t.label, t.overview_md, renderMarkdown(t.overview_md), t.sort_order, existing.id],
        );
        topicIdBySlug.set(t.slug, existing.id);
        report.topics_inserted++;
        continue;
      }
      const id = await insertOne(c.env.DB, "topics", {
        user_id: userId,
        slug: t.slug,
        label: t.label,
        overview_md: t.overview_md,
        overview_html: renderMarkdown(t.overview_md),
        sort_order: t.sort_order,
      });
      topicIdBySlug.set(t.slug, id);
      report.topics_inserted++;
    }

    const entityIdBySlug = new Map<string, string>();
    for (const e of SEED_ENTITIES) {
      const existing = await one<{ id: string }>(
        c.env.DB,
        "SELECT id FROM entities WHERE user_id = ? AND public_slug = ?",
        [userId, e.slug],
      );
      if (existing && !force) {
        entityIdBySlug.set(e.slug, existing.id);
        report.entities_skipped++;
        continue;
      }
      if (existing && force) {
        await run(
          c.env.DB,
          "UPDATE entities SET canonical_name = ?, kind = ?, entity_type = ?, current_role = ?, bio_md = ?, bio_html = ? WHERE id = ?",
          [
            e.canonical_name,
            e.kind,
            e.entity_type,
            e.current_role,
            e.bio_md,
            renderMarkdown(e.bio_md),
            existing.id,
          ],
        );
        entityIdBySlug.set(e.slug, existing.id);
        report.entities_inserted++;
        continue;
      }
      const id = await insertOne(c.env.DB, "entities", {
        user_id: userId,
        public_slug: e.slug,
        canonical_name: e.canonical_name,
        kind: e.kind,
        entity_type: e.entity_type,
        current_role: e.current_role,
        bio_md: e.bio_md,
        bio_html: renderMarkdown(e.bio_md),
      });
      entityIdBySlug.set(e.slug, id);
      report.entities_inserted++;
    }

    const pieceIdBySlug = new Map<string, string>();
    const now = new Date().toISOString();
    for (const p of SEED_PIECES) {
      const existing = await one<{ id: string }>(
        c.env.DB,
        "SELECT id FROM pieces WHERE user_id = ? AND slug = ?",
        [userId, p.slug],
      );
      if (existing && !force) {
        pieceIdBySlug.set(p.slug, existing.id);
        report.pieces_skipped++;
        continue;
      }
      if (existing && force) {
        await run(
          c.env.DB,
          "UPDATE pieces SET title = ?, subtitle = ?, kind = ?, publication_status = ?, body_md = ?, body_html = ?, byline = ? WHERE id = ?",
          [
            p.title,
            p.subtitle,
            p.kind,
            p.publication_status,
            p.body_md,
            renderMarkdown(p.body_md),
            p.byline,
            existing.id,
          ],
        );
        pieceIdBySlug.set(p.slug, existing.id);
        report.pieces_inserted++;
        continue;
      }
      const id = await insertOne(c.env.DB, "pieces", {
        user_id: userId,
        slug: p.slug,
        title: p.title,
        subtitle: p.subtitle,
        kind: p.kind,
        publication_status: p.publication_status,
        body_md: p.body_md,
        body_html: renderMarkdown(p.body_md),
        byline: p.byline,
        published_at: now,
      });
      pieceIdBySlug.set(p.slug, id);
      report.pieces_inserted++;
    }

    for (const p of SEED_PIECES) {
      const pieceId = pieceIdBySlug.get(p.slug);
      if (!pieceId) continue;
      for (const topicSlug of p.topics) {
        const topicId = topicIdBySlug.get(topicSlug);
        if (!topicId) continue;
        const exists = await one(
          c.env.DB,
          "SELECT 1 AS one FROM topic_pieces WHERE topic_id = ? AND piece_id = ?",
          [topicId, pieceId],
        );
        if (!exists) {
          await insertOne(c.env.DB, "topic_pieces", {
            topic_id: topicId,
            piece_id: pieceId,
            user_id: userId,
          });
          report.joins_inserted++;
        }
      }
    }
    for (const [topicSlug, entitySlugs] of Object.entries(SEED_TOPIC_ENTITIES)) {
      const topicId = topicIdBySlug.get(topicSlug);
      if (!topicId) continue;
      for (const entitySlug of entitySlugs) {
        const entityId = entityIdBySlug.get(entitySlug);
        if (!entityId) continue;
        const exists = await one(
          c.env.DB,
          "SELECT 1 AS one FROM topic_entities WHERE topic_id = ? AND entity_id = ?",
          [topicId, entityId],
        );
        if (!exists) {
          await insertOne(c.env.DB, "topic_entities", {
            topic_id: topicId,
            entity_id: entityId,
            user_id: userId,
          });
          report.joins_inserted++;
        }
      }
    }

    const lines = [
      "✓ Seed complete",
      `  Topics:   ${report.topics_inserted} inserted, ${report.topics_skipped} skipped`,
      `  Entities: ${report.entities_inserted} inserted, ${report.entities_skipped} skipped`,
      `  Pieces:   ${report.pieces_inserted} inserted, ${report.pieces_skipped} skipped`,
      `  Joins:    ${report.joins_inserted} inserted`,
    ];
    return c.redirect(`/op/ingest?result=${encodeURIComponent(lines.join("\n"))}`);
  } catch (err) {
    return c.redirect(`/op/ingest?error=${encodeURIComponent((err as Error).message)}`);
  }
});

app.post("/ingest/library", async (c) => {
  try {
    const form = await c.req.formData();
    const force = form.get("force") === "1";
    const zipFile = form.get("zip");
    if (!zipFile || typeof zipFile === "string") {
      return c.redirect("/op/ingest?error=No+zip+file+provided");
    }
    const userId = await resolveOperatorId(c.env.DB);
    if (!userId) throw new Error("No operator user found — run the deploy workflow first.");

    const zipBytes = new Uint8Array(await (zipFile as File).arrayBuffer());
    const unzipped = unzipSync(zipBytes);
    const dec = new TextDecoder();

    // Find manifest — try with and without top-level folder.
    const manifestKey = Object.keys(unzipped).find((k) => k.endsWith("library-manifest.json"));
    if (!manifestKey) throw new Error("library-manifest.json not found in zip");
    const manifest = JSON.parse(dec.decode(unzipped[manifestKey])) as {
      reports: Array<{
        id?: string;
        slug: string;
        title: string;
        kind?: string;
        source_file: string;
        word_count?: number;
        detected_entities?: string[];
      }>;
    };
    const prefix = manifestKey.replace("library-manifest.json", "");

    const report = {
      inserted: 0,
      skipped: 0,
      failed: [] as Array<{ slug: string; reason: string }>,
    };
    for (const r of manifest.reports) {
      try {
        const mdBytes = unzipped[`${prefix}${r.source_file}`];
        if (!mdBytes) {
          report.failed.push({ slug: r.slug, reason: "source file not found in zip" });
          continue;
        }
        const body_md = dec.decode(mdBytes);
        const title = r.title.replace(/^#+\s*/, "").trim();
        const kind = (r.kind ?? "research-report") as string;
        const existing = await one<{ id: string }>(
          c.env.DB,
          "SELECT id FROM pieces WHERE user_id = ? AND slug = ?",
          [userId, r.slug],
        );
        if (existing && !force) {
          report.skipped++;
          continue;
        }
        if (existing && force) {
          await run(
            c.env.DB,
            "UPDATE pieces SET title = ?, kind = ?, body_md = ?, metadata = ?, updated_at = ? WHERE id = ?",
            [
              title,
              kind,
              body_md,
              JSON.stringify({
                source_id: r.id ?? null,
                detected_entities: r.detected_entities ?? [],
                word_count: r.word_count ?? null,
                ingested_from: "library-zip",
              }),
              new Date().toISOString(),
              existing.id,
            ],
          );
          report.inserted++;
          continue;
        }
        await insertOne(c.env.DB, "pieces", {
          user_id: userId,
          slug: r.slug,
          title,
          kind,
          publication_status: "working-material",
          body_md,
          byline: "the operator",
          tags: JSON.stringify([]),
          metadata: JSON.stringify({
            source_id: r.id ?? null,
            detected_entities: r.detected_entities ?? [],
            word_count: r.word_count ?? null,
            ingested_from: "library-zip",
          }),
        });
        report.inserted++;
      } catch (err) {
        report.failed.push({ slug: r.slug, reason: (err as Error).message });
      }
    }

    const lines = [
      "✓ Library import complete",
      `  Inserted: ${report.inserted}`,
      `  Skipped:  ${report.skipped}`,
      ...(report.failed.length
        ? [
            `  Failed (${report.failed.length}):`,
            ...report.failed.map((f) => `    • ${f.slug}: ${f.reason}`),
          ]
        : []),
    ];
    return c.redirect(`/op/ingest?result=${encodeURIComponent(lines.join("\n"))}`);
  } catch (err) {
    return c.redirect(`/op/ingest?error=${encodeURIComponent((err as Error).message)}`);
  }
});

app.get("/editorial", () =>
  opHtml(
    renderOpSkeleton({
      title: "Editorial",
      activeNav: "/op/editorial",
      whatsHere:
        "The writing interface for signed pieces — structured editor producing the investigation shape (body, argument for/against/verdict, the claims it rests on, the source log). Lands in a later phase; drafting works through the chat today.",
    }),
  ),
);

app.get("/leads", () =>
  opHtml(
    renderOpSkeleton({
      title: "Leads",
      activeNav: "/op/leads",
      whatsHere:
        "The triage queue: candidate patterns and pending proposals surfaced as leads. Each card shows the pattern type, constituent documents, confidence, disconfirming evidence, and actions (Sign · Dismiss · Chase). Lands in the lighthouse phase.",
    }),
  ),
);

app.get("/patterns", () =>
  opHtml(
    renderOpSkeleton({
      title: "Patterns",
      activeNav: "/op/patterns",
      whatsHere:
        "The operator-side pattern review: sign a candidate to publish it, dismiss with a reason, or chase it in the workbench. Lands in the lighthouse phase.",
    }),
  ),
);

app.get("/publish", () =>
  opHtml(
    renderOpSkeleton({
      title: "Publish",
      activeNav: "/op/publish",
      whatsHere:
        "Move pieces through working-material → published → canonical, run the forensic publish-prep gates, and manage chain canonicals. Lands alongside the editorial screen.",
    }),
  ),
);

app.get("/studio", () =>
  opHtml(
    renderOpSkeleton({
      title: "Studio",
      activeNav: "/op/studio",
      coord: "audio production",
      whatsHere:
        "Audio production — script ideator, recording overlay, stitch. The Studio compartment is gated on STUDIO_ENABLED; the existing studio API powers it.",
    }),
  ),
);

export default app;

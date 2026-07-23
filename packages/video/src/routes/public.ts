// Public (unauthenticated) routes — everything the operator has
// explicitly published, and nothing else. No requireOperator() gate
// anywhere in this file; the gate here is "is this specific segment
// published", checked per-request against D1, never inferred from the
// caller being logged in.
//
// GET /public/segments      — JSON list, read by packages/api's /videos
//                              section across the Worker boundary.
// GET /public/watch/:key    — streams the MP4 for one published segment.

import { Hono } from "hono";
import type { Env } from "../env";
import { isKeyPublished, listPublishedSegments } from "../storage/d1";

const app = new Hono<{ Bindings: Env }>();

app.get("/segments", async (c) => {
  const rows = await listPublishedSegments(c.env.DB, 50).catch(() => []);
  return c.json({
    ok: true,
    segments: rows.map((r) => ({
      id: r.id,
      title: r.title,
      source_kind: r.source_kind,
      subject_slug: r.subject_slug,
      template: r.template,
      published_at: r.published_at,
      length_s: r.length_s,
      variant: r.variant,
      watch_url: r.r2_key
        ? `${c.env.VIDEO_BASE}/public/watch/${encodeURIComponent(r.r2_key)}`
        : null,
    })),
  });
});

app.get("/watch/:key", async (c) => {
  const key = decodeURIComponent(c.req.param("key"));
  const published = await isKeyPublished(c.env.DB, key).catch(() => false);
  if (!published) return new Response("not found", { status: 404 });
  const obj = await c.env.ASSETS.get(key);
  if (!obj) return new Response("not found", { status: 404 });
  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType ?? "video/mp4",
      "cache-control": "public, max-age=3600",
    },
  });
});

export default app;

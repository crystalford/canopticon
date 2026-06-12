// Studio Stage A — the Produce flow for static formats (spec v2.6 Part 27).
//
// Each face on a signed reading carries a Produce → affordance (visible
// to the operator only). Clicking it lands here, on a focused production
// interface that shows the face preview alongside the platform-specific
// "Download PNG" buttons. The button POSTs to /produce, which calls
// Cloudflare Browser Rendering's /screenshot endpoint and streams the
// PNG back as a file download.
//
// Stage A scope (this file):
//   - card  → X 1200×630 + IG 1080×1080
//   - thread→ 4 × X 1200×675 (one per post)
// Stage B+ (audio, video) lives in separate routes added later.

import { Hono } from "hono";
import type { AuthContext } from "../../auth/middleware";
import { one } from "../../lib/d1";
import { renderCardFace } from "../render/faces/card";
import { renderThreadFace } from "../render/faces/thread";
import { CARD_TARGETS, THREAD_POST_TARGET, wrapFaceForProduce } from "./produce";
import { renderHtmlToPng } from "./render-png";

const app = new Hono<AuthContext>();

interface PageRow {
  id: string;
  slug: string;
  thesis: string | null;
  signed_by: string | null;
  signed_status: string | null;
}

type FaceKind = "card" | "thread";
const SUPPORTED: ReadonlySet<string> = new Set(["card", "thread"]);

async function loadPage(db: D1Database, slug: string): Promise<PageRow | null> {
  return one<PageRow>(
    db,
    `SELECT id, slug, thesis, signed_by, signed_status
       FROM pages WHERE slug = ? LIMIT 1`,
    [slug],
  );
}

async function loadPageById(db: D1Database, id: string): Promise<PageRow | null> {
  return one<PageRow>(
    db,
    `SELECT id, slug, thesis, signed_by, signed_status
       FROM pages WHERE id = ? LIMIT 1`,
    [id],
  );
}

// Pure helper so tests can assert the produce-page shell without spinning
// up an env. Returns the full HTML for the operator's Studio production
// page for one (page, faceKind) pair.
export function renderStudioShell(args: {
  page: PageRow;
  faceKind: FaceKind;
  facePreviewHtml: string;
  message?: string;
}): string {
  const { page, faceKind, facePreviewHtml, message } = args;
  const title = faceKind === "card" ? "Produce — Card" : "Produce — Thread";
  const targets = faceKind === "card" ? CARD_TARGETS : [THREAD_POST_TARGET];
  const buttons = targets
    .map(
      (t) =>
        `<form method="POST" action="/studio/${encodeURIComponent(page.id)}/${faceKind}/produce" class="produce-form">
  <input type="hidden" name="target" value="${t.key}">
  <button class="produce-go" type="submit">Download PNG — ${t.label}</button>
</form>`,
    )
    .join("\n");
  const msg = message ? `<div class="produce-msg">${message}</div>` : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title} · canopticon</title>
  <link rel="stylesheet" href="/styles.css">
  <style>
    body { background: var(--paper, #faf6ef); }
    .studio-shell { max-width: 980px; margin: 24px auto; padding: 0 24px 80px; }
    .studio-head { display:flex; align-items:baseline; justify-content:space-between; padding-bottom:16px; border-bottom:1px solid #e7e2d6; }
    .studio-h1 { font-family: var(--serif); font-size: 26px; margin: 0; }
    .studio-back { font-family: var(--mono); font-size: 12px; color: var(--ink-3, #8a867c); text-decoration: none; }
    .studio-back:hover { color: var(--ink, #0c0d10); }
    .studio-sub { font-family: var(--mono); font-size: 11px; color: var(--ink-3, #8a867c); margin: 4px 0 22px; letter-spacing: .03em; }
    .studio-preview { padding: 24px; background: #fff; border: 1px solid #e7e2d6; border-radius: 12px; margin-bottom: 22px; }
    .produce-buttons { display:flex; gap:12px; flex-wrap:wrap; margin-top: 14px; }
    .produce-go {
      font-family: var(--mono);
      font-size: 13px;
      padding: 10px 16px;
      background: var(--ink, #0c0d10);
      color: var(--paper, #faf6ef);
      border: none;
      border-radius: 8px;
      cursor: pointer;
    }
    .produce-go:hover { background: #1a1c20; }
    .produce-msg { padding: 12px 14px; background: #fff5e6; border: 1px solid #e3c89a; border-radius: 8px; font-family: var(--mono); font-size: 12px; margin-bottom: 16px; color: #5c4413; }
  </style>
</head>
<body>
<div class="studio-shell">
  <div class="studio-head">
    <h1 class="studio-h1">${title}</h1>
    <a class="studio-back" href="/s/${encodeURIComponent(page.slug)}?mode=signed">← back to the signed reading</a>
  </div>
  <div class="studio-sub">production pipeline · static format · v2.6 Part 27 Stage A</div>
  ${msg}
  <div class="studio-preview">${facePreviewHtml}</div>
  <div class="produce-buttons">${buttons}</div>
</div>
</body>
</html>`;
}

// GET /studio/:slug/:kind — the operator's preview-and-produce page. We
// look up by slug (the same URL the operator sees on the signed reading)
// rather than by id so the URL is shareable + memorable.
app.get("/:slug/:kind", async (c) => {
  if (!c.var.is_operator) return c.redirect("/");
  const kind = c.req.param("kind");
  if (!SUPPORTED.has(kind))
    return new Response(`Studio doesn't produce "${kind}" yet (Stage A: card, thread).`, {
      status: 404,
    });
  const page = await loadPage(c.env.DB, c.req.param("slug"));
  if (!page || !page.thesis) return c.redirect("/");
  const faceKind = kind as FaceKind;
  const facePreview =
    faceKind === "card"
      ? await renderCardFace(c.env.DB, page)
      : await renderThreadFace(c.env.DB, page);
  const message = c.req.query("err");
  const shell = renderStudioShell({
    page,
    faceKind,
    facePreviewHtml: facePreview,
    ...(message ? { message } : {}),
  });
  return new Response(shell, { headers: { "content-type": "text/html; charset=utf-8" } });
});

// POST /studio/:pageId/:kind/produce — render the face as a PNG and stream
// it back as a download. Uses pageId (not slug) so the form submission
// shape stays compact; we look up by id and trust the operator gate.
app.post("/:pageId/:kind/produce", async (c) => {
  if (!c.var.is_operator) return c.redirect("/");
  const kind = c.req.param("kind");
  if (!SUPPORTED.has(kind)) return new Response("unsupported face kind", { status: 404 });
  const page = await loadPageById(c.env.DB, c.req.param("pageId"));
  if (!page || !page.thesis) return new Response("page not found", { status: 404 });
  const form = await c.req.formData();
  const targetKey = String(form.get("target") ?? "");
  const faceKind = kind as FaceKind;
  const targets = faceKind === "card" ? CARD_TARGETS : [THREAD_POST_TARGET];
  const target = targets.find((t) => t.key === targetKey) ?? targets[0];
  if (!target) return new Response("no target", { status: 400 });
  const faceHtml =
    faceKind === "card"
      ? await renderCardFace(c.env.DB, page)
      : await renderThreadFace(c.env.DB, page);
  const doc = wrapFaceForProduce(faceHtml);
  const result = await renderHtmlToPng(c.env, doc, target.viewport);
  if (!result.ok || !result.png) {
    const reason = result.unconfigured
      ? "browser-rendering-not-configured"
      : (result.error ?? "unknown");
    return c.redirect(
      `/studio/${encodeURIComponent(page.slug)}/${faceKind}?err=${encodeURIComponent(reason)}`,
    );
  }
  const filename = `${page.slug}-${faceKind}${target.filenameSuffix}.png`;
  return new Response(result.png, {
    headers: {
      "content-type": "image/png",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
});

export default app;

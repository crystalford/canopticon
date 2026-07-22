// Studio Stage A — the Produce flow for static formats (spec v2.6 Part 27).
//
// Each signed reading has Stage A produce flows for:
//   - card     → X 1200×630 + IG 1080×1080 PNG
//   - thread   → 1200×675 X post PNG
//   - carousel → 1080×1350 PNG per slide
//   - newsletter → email-safe HTML download + plain-text
//   - long-form  → Markdown download (with optional chapter outline)
//
// Routes:
//   GET  /studio/:slug             — index: list every produce flow for this page
//   GET  /studio/:slug/:kind       — focused preview + download UI per kind
//   POST /studio/:pageId/:kind/produce — render the asset and stream it back

import { Hono } from "hono";
import type { AuthContext } from "../../auth/middleware";
import { all, one } from "../../lib/d1";
import { renderCardFace } from "../render/faces/card";
import { renderCarouselFace, renderCarouselSlide } from "../render/faces/carousel";
import { renderThreadFace } from "../render/faces/thread";
import {
  CARD_TARGETS,
  CAROUSEL_SLIDE_VIEWPORT,
  type PaperReference,
  type PaperSection,
  THREAD_POST_TARGET,
  renderLongFormMarkdown,
  renderNewsletterHtml,
  renderNewsletterPlainText,
  renderPaperMarkdown,
  wrapCarouselSlideForProduce,
  wrapFaceForProduce,
} from "./produce";
import { renderHtmlToPng } from "./render-png";

const app = new Hono<AuthContext>();

interface PageRow {
  id: string;
  slug: string;
  thesis: string | null;
  body_md: string | null;
  body_html: string | null;
  signed_by: string | null;
  signed_at: string | null;
  signed_status: string | null;
}

type FaceKind = "card" | "thread" | "carousel" | "newsletter" | "long-form";
const SUPPORTED: ReadonlySet<string> = new Set([
  "card",
  "thread",
  "carousel",
  "newsletter",
  "long-form",
]);

const KIND_LABELS: Record<FaceKind, string> = {
  card: "Card",
  thread: "Thread",
  carousel: "Carousel",
  newsletter: "Newsletter",
  "long-form": "Long-form",
};

const KIND_HINTS: Record<FaceKind, string> = {
  card: "Single image, thesis + most damning fact.",
  thread: "Four-post sequence for X.",
  carousel: "Six-slide swipe-through for Instagram / LinkedIn.",
  newsletter: "Email-safe HTML + plain text for mailing list.",
  "long-form": "Markdown export with optional chapter outline.",
};

async function loadPage(db: D1Database, slug: string): Promise<PageRow | null> {
  return one<PageRow>(
    db,
    `SELECT id, slug, thesis, body_md, body_html, signed_by, signed_at, signed_status
       FROM pages WHERE slug = ? LIMIT 1`,
    [slug],
  );
}

async function loadPageById(db: D1Database, id: string): Promise<PageRow | null> {
  return one<PageRow>(
    db,
    `SELECT id, slug, thesis, body_md, body_html, signed_by, signed_at, signed_status
       FROM pages WHERE id = ? LIMIT 1`,
    [id],
  );
}

async function loadChapterFaceMd(db: D1Database, pageId: string): Promise<string | null> {
  const row = await one<{ body_md: string | null }>(
    db,
    `SELECT body_md FROM page_faces WHERE page_id = ? AND kind = 'chapter' AND status = 'ready' LIMIT 1`,
    [pageId],
  );
  return row?.body_md ?? null;
}

function shellWrap(args: { title: string; slug: string; inner: string; message?: string }): string {
  const { title, slug, inner, message } = args;
  const msg = message ? `<div class="produce-msg">${escapeAttr(message)}</div>` : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeAttr(title)} · canopticon</title>
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
      font-family: var(--mono); font-size: 13px; padding: 10px 16px;
      background: var(--ink, #0c0d10); color: var(--paper, #faf6ef);
      border: none; border-radius: 8px; cursor: pointer; text-decoration: none;
    }
    .produce-go:hover { background: #1a1c20; }
    .produce-form { display: inline; }
    .produce-msg { padding: 12px 14px; background: #fff5e6; border: 1px solid #e3c89a; border-radius: 8px; font-family: var(--mono); font-size: 12px; margin-bottom: 16px; color: #5c4413; }
    .studio-index { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .studio-card { padding: 18px 20px; background: #fff; border: 1px solid #e7e2d6; border-radius: 10px; }
    .studio-card a { font-family: var(--serif); font-size: 18px; color: var(--ink); text-decoration: none; border-bottom: 1px solid var(--ink-3, #8a867c); }
    .studio-card a:hover { border-bottom-color: var(--ink, #0c0d10); }
    .studio-card-hint { font-family: var(--mono); font-size: 11px; color: var(--ink-3, #8a867c); margin-top: 8px; letter-spacing: .03em; }
    @media (max-width: 720px) { .studio-index { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
<div class="studio-shell">
  <div class="studio-head">
    <h1 class="studio-h1">${escapeAttr(title)}</h1>
    <a class="studio-back" href="/s/${encodeURIComponent(slug)}?mode=signed">← back to the signed reading</a>
  </div>
  <div class="studio-sub">production pipeline · static format · v2.6 Part 27 Stage A</div>
  ${msg}
  ${inner}
</div>
</body>
</html>`;
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Pure helper used by tests and the routes. Renders the focused
// preview-and-download page for one (page, kind) pair.
export function renderStudioShell(args: {
  page: PageRow;
  faceKind: FaceKind;
  facePreviewHtml: string;
  message?: string;
}): string {
  const { page, faceKind, facePreviewHtml, message } = args;
  const title = `Produce — ${KIND_LABELS[faceKind]}`;
  let buttons = "";
  if (faceKind === "card") {
    buttons = CARD_TARGETS.map(
      (t) =>
        `<form method="POST" action="/studio/${encodeURIComponent(page.id)}/card/produce" class="produce-form">
  <input type="hidden" name="target" value="${t.key}">
  <button class="produce-go" type="submit">Download PNG — ${t.label}</button>
</form>`,
    ).join("\n");
  } else if (faceKind === "thread") {
    buttons = `<form method="POST" action="/studio/${encodeURIComponent(page.id)}/thread/produce" class="produce-form">
  <input type="hidden" name="target" value="post">
  <button class="produce-go" type="submit">Download PNG — X post (1200×675)</button>
</form>`;
  } else if (faceKind === "carousel") {
    // One download button per slide (count derived from the rendered
    // preview HTML; the carousel face produces 2 + N facts slides).
    const slideCount = (facePreviewHtml.match(/carousel-slide(?!-)/g) ?? []).length || 6;
    buttons = Array.from({ length: slideCount }, (_, i) => i)
      .map(
        (i) =>
          `<form method="POST" action="/studio/${encodeURIComponent(page.id)}/carousel/produce" class="produce-form">
  <input type="hidden" name="target" value="${i}">
  <button class="produce-go" type="submit">Slide ${i + 1} PNG</button>
</form>`,
      )
      .join("\n");
  } else if (faceKind === "newsletter") {
    buttons = `<form method="POST" action="/studio/${encodeURIComponent(page.id)}/newsletter/produce" class="produce-form">
  <input type="hidden" name="target" value="html">
  <button class="produce-go" type="submit">Download email HTML</button>
</form>
<form method="POST" action="/studio/${encodeURIComponent(page.id)}/newsletter/produce" class="produce-form">
  <input type="hidden" name="target" value="text">
  <button class="produce-go" type="submit">Download plain text</button>
</form>`;
  } else if (faceKind === "long-form") {
    buttons = `<form method="POST" action="/studio/${encodeURIComponent(page.id)}/long-form/produce" class="produce-form">
  <input type="hidden" name="target" value="md">
  <button class="produce-go" type="submit">Download Markdown</button>
</form>`;
  }
  const inner = `<div class="studio-preview">${facePreviewHtml}</div>
<div class="produce-buttons">${buttons}</div>`;
  return shellWrap({
    title,
    slug: page.slug,
    inner,
    ...(message ? { message } : {}),
  });
}

// GET /studio/:slug — operator's index: a card per producible format.
app.get("/:slug", async (c) => {
  if (!c.var.is_operator) return c.redirect("/");
  const page = await loadPage(c.env.DB, c.req.param("slug"));
  if (!page || !page.thesis) return c.redirect("/");
  const cards = (Object.keys(KIND_LABELS) as FaceKind[])
    .map(
      (k) =>
        `<div class="studio-card">
  <a href="/studio/${encodeURIComponent(page.slug)}/${k}">${escapeAttr(KIND_LABELS[k])} →</a>
  <div class="studio-card-hint">${escapeAttr(KIND_HINTS[k])}</div>
</div>`,
    )
    .join("\n");
  return new Response(
    shellWrap({
      title: "Studio — Produce",
      slug: page.slug,
      inner: `<div class="studio-index">${cards}</div>
<p style="margin-top:20px"><a class="studio-back" href="/studio/paper">Compose a long-form paper from multiple signed subjects →</a></p>`,
    }),
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
});

interface PaperPickerRow {
  id: string;
  slug: string;
  label: string;
  thesis: string | null;
  signed_at: string | null;
}

async function loadPublishedPagesForPaper(
  db: D1Database,
  userId: string,
): Promise<PaperPickerRow[]> {
  return all<PaperPickerRow>(
    db,
    `SELECT p.id, p.slug, n.label, p.thesis, p.signed_at
       FROM pages p JOIN nodes n ON n.id = p.subject_node_id
      WHERE p.user_id = ? AND p.signed_status = 'published'
      ORDER BY p.signed_at DESC`,
    [userId],
  ).catch(() => []);
}

function renderPaperPicker(pages: PaperPickerRow[], message?: string): string {
  const msg = message ? `<div class="produce-msg">${escapeAttr(message)}</div>` : "";
  const rows = pages
    .map(
      (p) => `<label class="paper-row">
  <input type="checkbox" name="page_ids" value="${escapeAttr(p.id)}">
  <span class="paper-row-label">${escapeAttr(p.label)}</span>
  <span class="paper-row-thesis">${escapeAttr(p.thesis ?? "")}</span>
</label>`,
    )
    .join("\n");
  const inner = pages.length
    ? `<form method="POST" action="/studio/paper/produce">
  <input type="text" name="title" placeholder="Paper title" class="paper-title-input" required>
  <div class="paper-picker">${rows}</div>
  <button class="produce-go" type="submit" style="margin-top:14px">Compose paper</button>
</form>`
    : "<p>No signed subjects published yet — sign a reading first, then come back here to compose a paper across several of them.</p>";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Studio — Compose a paper · canopticon</title>
  <link rel="stylesheet" href="/styles.css">
  <style>
    body { background: var(--paper, #faf6ef); }
    .studio-shell { max-width: 820px; margin: 24px auto; padding: 0 24px 80px; }
    .studio-head { display:flex; align-items:baseline; justify-content:space-between; padding-bottom:16px; border-bottom:1px solid #e7e2d6; }
    .studio-h1 { font-family: var(--serif); font-size: 26px; margin: 0; }
    .studio-back { font-family: var(--mono); font-size: 12px; color: var(--ink-3, #8a867c); text-decoration: none; }
    .studio-back:hover { color: var(--ink, #0c0d10); }
    .produce-msg { padding: 12px 14px; background: #fff5e6; border: 1px solid #e3c89a; border-radius: 8px; font-family: var(--mono); font-size: 12px; margin: 16px 0; color: #5c4413; }
    .paper-title-input { width: 100%; box-sizing: border-box; font-family: var(--serif); font-size: 18px; padding: 12px 14px; border: 1px solid #e7e2d6; border-radius: 8px; margin: 18px 0; }
    .paper-picker { display: flex; flex-direction: column; gap: 10px; }
    .paper-row { display: flex; align-items: baseline; gap: 10px; padding: 12px 14px; background: #fff; border: 1px solid #e7e2d6; border-radius: 8px; cursor: pointer; }
    .paper-row-label { font-family: var(--serif); font-size: 15px; color: var(--ink, #0c0d10); flex-shrink: 0; }
    .paper-row-thesis { font-family: var(--mono); font-size: 11.5px; color: var(--ink-3, #8a867c); }
    .produce-go { font-family: var(--mono); font-size: 13px; padding: 10px 16px; background: var(--ink, #0c0d10); color: var(--paper, #faf6ef); border: none; border-radius: 8px; cursor: pointer; }
    .produce-go:hover { background: #1a1c20; }
  </style>
</head>
<body>
<div class="studio-shell">
  <div class="studio-head">
    <h1 class="studio-h1">Compose a paper</h1>
    <a class="studio-back" href="/investigations">← investigations</a>
  </div>
  ${msg}
  <p style="font-family:var(--mono);font-size:11.5px;color:var(--ink-3,#8a867c);margin:8px 0 20px;">
    Pick two or more signed subjects. Nothing is drafted here — each section is the exact thesis + body you already signed, sequenced under one title with a compiled source list.
  </p>
  ${inner}
</div>
</body>
</html>`;
}

// GET /studio/paper — picker: choose signed subjects to compose into one document.
app.get("/paper", async (c) => {
  if (!c.var.is_operator) return c.redirect("/");
  const userId = c.get("user_id");
  const pages = await loadPublishedPagesForPaper(c.env.DB, userId);
  const message = c.req.query("err");
  return new Response(renderPaperPicker(pages, message), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
});

// POST /studio/paper/produce — compose the selected pages' already-signed
// content into one long-form document and stream it back as Markdown.
// Mechanical recomposition only: theses and bodies are reused verbatim,
// the bibliography is compiled from each page's page_claims — nothing is
// regenerated or reworded, keeping this inside "the operator approves,
// never authors."
app.post("/paper/produce", async (c) => {
  if (!c.var.is_operator) return c.redirect("/");
  const userId = c.get("user_id");
  const form = await c.req.formData();
  const pageIds = form
    .getAll("page_ids")
    .map((v) => String(v))
    .filter(Boolean);
  const title = String(form.get("title") ?? "").trim() || "Untitled paper";
  if (pageIds.length === 0) {
    return c.redirect(
      `/studio/paper?err=${encodeURIComponent("Pick at least one signed subject")}`,
    );
  }

  const sections: PaperSection[] = [];
  const references: PaperReference[] = [];
  const seenPieces = new Set<string>();

  for (const id of pageIds) {
    const row = await one<{
      id: string;
      slug: string;
      label: string;
      thesis: string | null;
      body_md: string | null;
      signed_by: string | null;
      signed_at: string | null;
    }>(
      c.env.DB,
      `SELECT p.id, p.slug, n.label, p.thesis, p.body_md, p.signed_by, p.signed_at
         FROM pages p JOIN nodes n ON n.id = p.subject_node_id
        WHERE p.id = ? AND p.user_id = ? AND p.signed_status = 'published'`,
      [id, userId],
    );
    if (!row || !row.thesis || !row.body_md) continue;
    sections.push({
      label: row.label,
      slug: row.slug,
      thesis: row.thesis,
      bodyMd: row.body_md,
      signedBy: row.signed_by,
      signedAt: row.signed_at,
    });
    const claims = await all<{ piece_slug: string | null; piece_title: string | null }>(
      c.env.DB,
      `SELECT DISTINCT p.slug AS piece_slug, p.title AS piece_title
         FROM page_claims c
         JOIN quotes q ON q.id = c.quote_id
         LEFT JOIN nodes src ON src.id = q.source_id
         LEFT JOIN pieces p ON p.id = src.piece_id
        WHERE c.page_id = ? AND c.user_id = ?`,
      [row.id, userId],
    ).catch(() => []);
    for (const claim of claims) {
      const key = claim.piece_slug ?? claim.piece_title ?? "";
      if (!key || seenPieces.has(key)) continue;
      seenPieces.add(key);
      references.push({
        index: references.length + 1,
        pieceTitle: claim.piece_title ?? "stored source",
        pieceSlug: claim.piece_slug,
      });
    }
  }

  if (sections.length === 0) {
    return c.redirect(
      `/studio/paper?err=${encodeURIComponent("None of the selected subjects are publishable")}`,
    );
  }

  const md = renderPaperMarkdown({ title, sections, references });
  const filename = `${slugifyTitle(title)}.md`;
  return new Response(md, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
});

function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "paper";
}

// GET /studio/:slug/:kind — focused preview + download buttons.
app.get("/:slug/:kind", async (c) => {
  if (!c.var.is_operator) return c.redirect("/");
  const kind = c.req.param("kind");
  if (!SUPPORTED.has(kind))
    return new Response(`Studio doesn't produce "${kind}" yet (Stage A).`, { status: 404 });
  const page = await loadPage(c.env.DB, c.req.param("slug"));
  if (!page || !page.thesis) return c.redirect("/");
  const faceKind = kind as FaceKind;
  const preview = await renderPreview(c.env.DB, page, faceKind);
  const message = c.req.query("err");
  const shell = renderStudioShell({
    page,
    faceKind,
    facePreviewHtml: preview,
    ...(message ? { message } : {}),
  });
  return new Response(shell, { headers: { "content-type": "text/html; charset=utf-8" } });
});

async function renderPreview(db: D1Database, page: PageRow, faceKind: FaceKind): Promise<string> {
  if (faceKind === "card") return renderCardFace(db, page);
  if (faceKind === "thread") return renderThreadFace(db, page);
  if (faceKind === "carousel") return renderCarouselFace(db, page);
  if (faceKind === "newsletter") {
    return `<div style="background:#fff;border:1px solid #e7e2d6;border-radius:8px;padding:24px;max-height:420px;overflow:auto;">
      <h2 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px;">${escapeAttr(page.thesis ?? "")}</h2>
      <div style="font-family:Georgia,serif;font-size:14px;line-height:1.65;color:#2a2c30;">${page.body_html ?? ""}</div>
    </div>`;
  }
  // long-form
  const chapterMd = await loadChapterFaceMd(db, page.id);
  const md = renderLongFormMarkdown({
    slug: page.slug,
    thesis: page.thesis ?? "",
    bodyMd: page.body_md ?? "",
    signedBy: page.signed_by,
    signedAt: page.signed_at,
    chapterMd,
  });
  return `<pre style="font-family:ui-monospace,Menlo,monospace;font-size:12px;background:#f6f3ec;border:1px solid #e7e2d6;border-radius:6px;padding:14px;max-height:420px;overflow:auto;white-space:pre-wrap;">${escapeAttr(md)}</pre>`;
}

// POST /studio/:pageId/:kind/produce — render the asset and stream it back.
app.post("/:pageId/:kind/produce", async (c) => {
  if (!c.var.is_operator) return c.redirect("/");
  const kind = c.req.param("kind");
  if (!SUPPORTED.has(kind)) return new Response("unsupported face kind", { status: 404 });
  const page = await loadPageById(c.env.DB, c.req.param("pageId"));
  if (!page || !page.thesis) return new Response("page not found", { status: 404 });
  const form = await c.req.formData();
  const targetKey = String(form.get("target") ?? "");
  const faceKind = kind as FaceKind;

  if (faceKind === "newsletter") {
    const isText = targetKey === "text";
    if (isText) {
      const text = renderNewsletterPlainText({
        slug: page.slug,
        thesis: page.thesis,
        bodyMd: page.body_md ?? "",
        signedBy: page.signed_by,
        signedAt: page.signed_at,
      });
      return new Response(text, {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "content-disposition": `attachment; filename="${page.slug}-newsletter.txt"`,
        },
      });
    }
    const html = renderNewsletterHtml({
      slug: page.slug,
      thesis: page.thesis,
      bodyMd: page.body_md ?? "",
      bodyHtml: page.body_html ?? "",
      signedBy: page.signed_by,
      signedAt: page.signed_at,
    });
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-disposition": `attachment; filename="${page.slug}-newsletter.html"`,
      },
    });
  }

  if (faceKind === "long-form") {
    const chapterMd = await loadChapterFaceMd(c.env.DB, page.id);
    const md = renderLongFormMarkdown({
      slug: page.slug,
      thesis: page.thesis,
      bodyMd: page.body_md ?? "",
      signedBy: page.signed_by,
      signedAt: page.signed_at,
      chapterMd,
    });
    return new Response(md, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="${page.slug}.md"`,
      },
    });
  }

  // PNG paths: card / thread / carousel
  let doc: string;
  let viewport: import("./render-png").Viewport;
  let filenameSuffix: string;
  if (faceKind === "card") {
    const target = CARD_TARGETS.find((t) => t.key === targetKey) ?? CARD_TARGETS[0];
    if (!target) return new Response("no target", { status: 400 });
    const face = await renderCardFace(c.env.DB, page);
    doc = wrapFaceForProduce(face);
    viewport = target.viewport;
    filenameSuffix = target.filenameSuffix;
  } else if (faceKind === "thread") {
    const face = await renderThreadFace(c.env.DB, page);
    doc = wrapFaceForProduce(face);
    viewport = THREAD_POST_TARGET.viewport;
    filenameSuffix = THREAD_POST_TARGET.filenameSuffix;
  } else {
    // carousel: targetKey is the slide index
    const slideIdx = Number.parseInt(targetKey, 10);
    if (!Number.isFinite(slideIdx) || slideIdx < 0) {
      return new Response("invalid slide index", { status: 400 });
    }
    const slideHtml = await renderCarouselSlideByIndex(c.env.DB, page, slideIdx);
    if (!slideHtml) return new Response("slide not found", { status: 404 });
    doc = wrapCarouselSlideForProduce(slideHtml);
    viewport = CAROUSEL_SLIDE_VIEWPORT;
    filenameSuffix = `-slide-${slideIdx + 1}`;
  }

  const result = await renderHtmlToPng(c.env, doc, viewport);
  if (!result.ok || !result.png) {
    const reason = result.unconfigured
      ? "browser-rendering-not-configured"
      : (result.error ?? "unknown");
    return c.redirect(
      `/studio/${encodeURIComponent(page.slug)}/${faceKind}?err=${encodeURIComponent(reason)}`,
    );
  }
  const filename = `${page.slug}-${faceKind}${filenameSuffix}.png`;
  return new Response(result.png, {
    headers: {
      "content-type": "image/png",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
});

// Render one carousel slide by index. Reuses the same loader the carousel
// face uses so the slide content is identical to the preview.
async function renderCarouselSlideByIndex(
  db: D1Database,
  page: PageRow,
  slideIdx: number,
): Promise<string | null> {
  const FACT_COUNT = 4;
  const { all } = await import("../../lib/d1");
  const facts = await all<{
    claim_text: string;
    quote_id: string | null;
    piece_title: string | null;
  }>(
    db,
    `SELECT pc.claim_text, pc.quote_id,
            (SELECT p.title FROM quotes q
               JOIN nodes ns ON ns.id = q.source_id
               JOIN pieces p ON p.id = ns.piece_id
              WHERE q.id = pc.quote_id LIMIT 1) AS piece_title
       FROM page_claims pc
      WHERE pc.page_id = ? AND pc.judge_pass = 1 AND pc.kind = 'fact'
      ORDER BY pc.sort_order ASC
      LIMIT ?`,
    [page.id, FACT_COUNT],
  ).catch(() => []);
  const total = 2 + facts.length;
  if (slideIdx >= total) return null;
  // Wrap whatever this slide is in the carousel CSS the face provides.
  // Easiest: render the full face HTML and pluck the slide. But the face
  // string is a single chunk; building the slide directly is cleaner.
  const cssBlock = `<style>${getCarouselSlideCss()}</style>`;
  if (slideIdx === 0) {
    return (
      cssBlock +
      renderCarouselSlide({
        index: 0,
        total,
        kind: "thesis",
        body: page.thesis ?? "",
      })
    );
  }
  if (slideIdx === total - 1) {
    return (
      cssBlock +
      renderCarouselSlide({
        index: total - 1,
        total,
        kind: "closer",
        body: "Read the full reading + every receipt.",
        slug: page.slug,
      })
    );
  }
  const fact = facts[slideIdx - 1];
  if (!fact) return null;
  return (
    cssBlock +
    renderCarouselSlide({
      index: slideIdx,
      total,
      kind: "fact",
      body: fact.claim_text,
      ...(fact.quote_id ? { receiptHref: `/q/${fact.quote_id}` } : {}),
      ...(fact.piece_title ? { pieceTitle: fact.piece_title } : {}),
    })
  );
}

function getCarouselSlideCss(): string {
  return `
  .carousel-slide {
    padding: 70px 60px;
    background: #faf6ef;
    color: #0c0d10;
    width: 1080px; height: 1350px;
    box-sizing: border-box;
    display: flex; flex-direction: column;
    justify-content: center; align-items: flex-start;
    position: relative;
    font-family: ui-serif, Georgia, serif;
  }
  .carousel-counter {
    position: absolute; top: 36px; right: 44px;
    font-family: ui-monospace, Menlo, monospace; font-size: 18px;
    color: #8a867c; letter-spacing: .08em;
  }
  .carousel-body {
    font-size: 56px; line-height: 1.25; font-weight: 600; color: #0c0d10;
  }
  .carousel-slide-fact .carousel-body { font-weight: 400; font-style: italic; font-size: 44px; }
  .carousel-slide-closer .carousel-body { font-weight: 400; font-size: 38px; color: #8a867c; }
  .carousel-receipt, .carousel-canonical {
    position: absolute; bottom: 44px; left: 60px; right: 60px;
    font-family: ui-monospace, Menlo, monospace; font-size: 18px;
    color: #8a867c; letter-spacing: .03em;
  }
  .carousel-receipt a { color: #0c0d10; text-decoration: none; border-bottom: 1px solid #8a867c; }
  `;
}

export default app;

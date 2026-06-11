// Public site routes. Server-rendered HTML, no JS required to read.
// Mounted at `/` in the Worker root (packages/api/src/index.ts).
//
// Phase 2: the five primary destinations read live from D1. Detail
// pages (topic hub, piece, entity) fall through to the styled 404 when
// the slug doesn't resolve. Empty D1 renders graceful empty states —
// the surfaces work before the seed corpus lands.

import { Hono } from "hono";
import type { Env } from "../env";
import { getPieceBySlug, resolveOperatorId } from "./data";
import { htmlResponse } from "./layout";
import { renderAbout } from "./render/about";
import { renderBriefPage } from "./render/brief";
import { renderHome } from "./render/home";
import { renderInvestigationsIndex, renderLibraryIndex } from "./render/investigations";
import { renderMethodology } from "./render/methodology";
import { renderPiece } from "./render/piece-template";
import { renderNotFound, renderPlaceholder } from "./render/placeholder";
import { renderEntityPage } from "./render/record";
import { renderTopicHub, renderTopicsIndex } from "./render/topics";
import { STYLES_CSS, stylesHash } from "./styles";

const app = new Hono<{ Bindings: Env }>();

// ---- citation tracker (spec Part 14 #10) ----------------------------------
// AI crawlers fetching public pages = the leading indicator of citation.
// Best-effort fire-and-forget logging; never blocks or fails a render.
const AI_BOTS: Array<[RegExp, string]> = [
  [/GPTBot/i, "gptbot"],
  [/OAI-SearchBot/i, "oai-search"],
  [/ChatGPT-User/i, "chatgpt-user"],
  [/ClaudeBot|Claude-Web|anthropic-ai/i, "claudebot"],
  [/PerplexityBot/i, "perplexity"],
  [/Google-Extended/i, "google-extended"],
  [/Bytespider/i, "bytespider"],
  [/CCBot/i, "ccbot"],
  [/Amazonbot/i, "amazonbot"],
  [/cohere-ai/i, "cohere"],
];

app.use("*", async (c, next) => {
  await next();
  try {
    const ua = c.req.header("user-agent") ?? "";
    if (!ua) return;
    const hit = AI_BOTS.find(([re]) => re.test(ua));
    if (!hit) return;
    const path = new URL(c.req.url).pathname;
    if (path === "/styles.css" || path.startsWith("/favicon")) return;
    c.executionCtx.waitUntil(
      c.env.DB.prepare("INSERT INTO citation_hits (id, path, bot, user_agent) VALUES (?, ?, ?, ?)")
        .bind(crypto.randomUUID(), path, hit[1], ua.slice(0, 300))
        .run()
        .then(() => {}),
    );
  } catch {
    // tracking must never affect a public response
  }
});

// Favicon — a tight monogram in the amber accent. The "canopticon." brand
// is the wordmark + a dot in --amber; we lean on the dot. Served as SVG
// (vector, recolors well in dark/light) with an .ico fallback that the
// browser resolves to the same SVG via the alternate icon hint.
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#0c0d10"/>
  <text x="16" y="22" font-family="Geist,system-ui,sans-serif" font-weight="700" font-size="20" letter-spacing="-1.2" text-anchor="middle" fill="#eceef2">c</text>
  <circle cx="24.5" cy="22" r="1.9" fill="#e09a3a"/>
</svg>`;

app.get("/favicon.svg", () => {
  return new Response(FAVICON_SVG, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=86400",
    },
  });
});

app.get("/favicon.ico", () => {
  return new Response(FAVICON_SVG, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=86400",
    },
  });
});

// Styles. Long cache; the hash query string busts on content change.
app.get("/styles.css", () => {
  return new Response(STYLES_CSS, {
    headers: {
      "content-type": "text/css; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
      "x-styles-hash": stylesHash(),
    },
  });
});

app.get("/", () => htmlResponse(renderHome()));

// ---- Topics ---------------------------------------------------------------

app.get("/topics", async (c) => htmlResponse(await renderTopicsIndex(c.env)));

app.get("/topics/:slug", async (c) => {
  const html = await renderTopicHub(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// ---- Investigations -------------------------------------------------------

app.get("/investigations", async (c) =>
  htmlResponse(await renderInvestigationsIndex(c.env, c.req.query("intent"))),
);

app.get("/investigations/:slug", async (c) => {
  const html = await renderPiece(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// Universal piece page — any kind, as long as it's published or canonical.
// Editor and Publish screens link here; treat as the canonical short URL
// for a piece. Working-material stays private.
//
// IMPORTANT: this route ALSO tries to resolve the slug as a SUBJECT PAGE
// (entity / event / theme — the unified fabric). The reader doesn't know
// which they're clicking into; the renderer figures it out. Pieces win on
// slug collision (they were the original /p/ tenant); subject pages fall
// back to a /s/ alias below for unambiguous links.
app.get("/p/:slug", async (c) => {
  const slug = c.req.param("slug");
  // Try the piece renderer first (original semantics).
  const html = await renderPiece(c.env, slug);
  if (html) return htmlResponse(html);
  // Fall through to subject pages. mode=signed reveals the operator's reading.
  const { renderSubjectPage } = await import("./render/subject-page");
  const mode = c.req.query("mode") === "signed" ? "signed" : "neutral";
  const subject = await renderSubjectPage(c.env, slug, mode);
  if (subject) return htmlResponse(subject);
  return htmlResponse(renderNotFound(c.req.path), { status: 404 });
});

// /s/:slug — unambiguous subject-page alias (entity / event / theme). Used in
// internal links where we know the target is a subject, not a piece.
app.get("/s/:slug", async (c) => {
  const { renderSubjectPage } = await import("./render/subject-page");
  const mode = c.req.query("mode") === "signed" ? "signed" : "neutral";
  const html = await renderSubjectPage(c.env, c.req.param("slug"), mode);
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// Clean-markdown download — the "source of record" button on every
// piece page links here. Returns the raw body_md with a Content-Disposition
// that triggers a download in browsers.
app.get("/p/:slug.md", async (c) => {
  const slug = (c.req.param("slug") ?? "").replace(/\.md$/, "");
  if (!slug) return c.notFound();
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.notFound();
  const piece = await getPieceBySlug(c.env.DB, userId, slug);
  if (!piece || piece.publication_status === "working-material") return c.notFound();
  return new Response(piece.body_md ?? "", {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${slug}.md"`,
      "cache-control": "public, max-age=300",
    },
  });
});

// Library piece page — same renderer.
app.get("/library/:slug", async (c) => {
  const html = await renderPiece(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// ---- The Record -----------------------------------------------------------

// Part 18: "The Record" dissolves as a destination — the index redirects to
// Topics (the one browsable doorway). Entity DETAIL pages stay addressable
// below as unmarked factual substrate.
app.get("/record", (c) => c.redirect("/topics", 301));

app.get("/record/:slug", async (c) => {
  const html = await renderEntityPage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// ---- Patterns / gaps / timeline (the lighthouse) -------------------------

// Part 18: "Patterns" dissolves as a destination — pattern pieces surface
// inside Investigations (intent badges). Detail pages stay addressable.
app.get("/patterns", (c) => c.redirect("/investigations", 301));

app.get("/patterns/:slug", async (c) => {
  const { renderPatternDetail } = await import("./render/pattern-detail");
  const html = await renderPatternDetail(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

app.get("/gaps", async (c) => {
  const { renderGapsIndex } = await import("./render/gaps");
  return htmlResponse(await renderGapsIndex(c.env));
});

app.get("/timeline", async (c) => {
  const { renderTimelineIndex } = await import("./render/timeline");
  return htmlResponse(await renderTimelineIndex(c.env));
});

// ---- Library --------------------------------------------------------------

app.get("/library", async (c) => htmlResponse(await renderLibraryIndex(c.env)));

// ---- Briefs (the third projection) -------------------------------------
//
// A published Brief renders here as a server-rendered citable page.
// The trust boundary is mechanical (verbatim-substring + independent
// judge) not "the operator vouched for it". See briefs/pipeline.ts.
app.get("/briefs/:slug", async (c) => {
  const html = await renderBriefPage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// ---- Utility pages (still placeholders until trailing Phase 2) -----------

app.get("/about", () => htmlResponse(renderAbout()));

app.get("/methodology", () => htmlResponse(renderMethodology()));

app.get("/sources", () =>
  htmlResponse(
    renderPlaceholder({
      title: "Sources",
      description: "Every external document the claims rest on.",
      activeNav: "/sources",
      whatsHere: "Sources index lands alongside the record's claim footprints.",
    }),
  ),
);

app.get("/search", () =>
  htmlResponse(
    renderPlaceholder({
      title: "Search",
      description: "Find a claim, entity, or piece.",
      activeNav: "/search",
      whatsHere: "Search lands after the core surfaces are real.",
    }),
  ),
);

// 404 handling lives at the parent (Worker) level so /v1/* misses can
// return JSON while /* misses get the styled HTML page. See index.ts.

export default app;
export { renderNotFound };

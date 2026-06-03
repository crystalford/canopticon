// Public site routes. Server-rendered HTML, no JS required to read.
// Mounted at `/` in the Worker root (packages/api/src/index.ts).
//
// Phase 2: the five primary destinations read live from D1. Detail
// pages (topic hub, piece, entity) fall through to the styled 404 when
// the slug doesn't resolve. Empty D1 renders graceful empty states —
// the surfaces work before the seed corpus lands.

import { Hono } from "hono";
import type { Env } from "../env";
import { htmlResponse } from "./layout";
import { renderAbout } from "./render/about";
import { renderHome } from "./render/home";
import {
  renderInvestigationsIndex,
  renderLibraryIndex,
  renderPiecePage,
} from "./render/investigations";
import { renderMethodology } from "./render/methodology";
import { renderPatternsIndex } from "./render/patterns";
import { renderNotFound, renderPlaceholder } from "./render/placeholder";
import { renderEntityPage, renderRecordIndex } from "./render/record";
import { renderTopicHub, renderTopicsIndex } from "./render/topics";
import { STYLES_CSS, stylesHash } from "./styles";

const app = new Hono<{ Bindings: Env }>();

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

app.get("/investigations", async (c) => htmlResponse(await renderInvestigationsIndex(c.env)));

app.get("/investigations/:slug", async (c) => {
  const html = await renderPiecePage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// Universal piece page — any kind, as long as it's published or canonical.
// Editor and Publish screens link here; treat as the canonical short URL
// for a piece. Working-material stays private (renderPiecePage returns null).
app.get("/p/:slug", async (c) => {
  const html = await renderPiecePage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// Library piece page — same renderer; lives at /library/:slug for the
// raw-research kinds (notes, etc.) that come in through bulk ingest.
app.get("/library/:slug", async (c) => {
  const html = await renderPiecePage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// ---- The Record -----------------------------------------------------------

app.get("/record", async (c) => htmlResponse(await renderRecordIndex(c.env)));

app.get("/record/:slug", async (c) => {
  const html = await renderEntityPage(c.env, c.req.param("slug"));
  if (!html) return htmlResponse(renderNotFound(c.req.path), { status: 404 });
  return htmlResponse(html);
});

// ---- Patterns / gaps / timeline (the lighthouse) -------------------------

app.get("/patterns", async (c) => htmlResponse(await renderPatternsIndex(c.env)));

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

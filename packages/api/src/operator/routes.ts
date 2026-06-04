// Operator console routes. Mounted at /op in the Worker root.
// Cloudflare Access gates this whole subtree at the edge — every request
// that reaches us is the authenticated operator. No auth middleware here.
//
// Six surfaces per the operator-claude-code-handoff:
//   /op           Feed     — drop documents · digest into the graph
//   /op/chat      Chat     — single never-resetting NL stream
//   /op/synthesis Synthesis — read-only finding cards (Pattern / Contradiction / …)
//   /op/library   Library  — full document archive
//   /op/briefs    Briefs   — proposal-only citable-page builder
//   /op/studio    Studio   — Script → Audio → Video → Export
//
// 301 redirects keep old screen paths from breaking bookmarks. The old
// screen modules (console, workbench, editorial, leads, patterns, publish,
// build, ingest) were deleted in this commit — their functionality folds
// into the six new surfaces over phases P1–P5.

import { Hono } from "hono";
import type { Env } from "../env";
import { CHAT_CLIENT_JS } from "./client/chat-js";
import { opHtml } from "./layout";
import { renderBriefsScreen } from "./screens/briefs";
import { renderChatScreen } from "./screens/chat";
import { renderFeedScreen } from "./screens/feed";
import { renderLibraryScreen } from "./screens/library";
import { renderStudioScreen } from "./screens/studio";
import { renderSynthesisScreen } from "./screens/synthesis";

const app = new Hono<{ Bindings: Env }>();

// ---- six surfaces -------------------------------------------------------

// Feed is the home — drop the doc, watch the digestion theater.
app.get("/", async (c) => opHtml(await renderFeedScreen(c.env)));

// Chat — the conversation stream. P0 stub; P3 reskins to the new design.
app.get("/chat", async (c) => opHtml(await renderChatScreen(c.env)));
app.get("/chat/:id", async (c) => opHtml(await renderChatScreen(c.env, c.req.param("id"))));

// Chat client module (kept for when P3 wires the new design up to it).
app.get("/chat.js", () => {
  return new Response(CHAT_CLIENT_JS, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
});

app.get("/synthesis", async (c) => {
  const view = c.req.query("view") === "corpus" ? "corpus" : "findings";
  return opHtml(await renderSynthesisScreen(c.env, view));
});

app.get("/library", async (c) => opHtml(await renderLibraryScreen(c.env)));

app.get("/briefs", async (c) => opHtml(await renderBriefsScreen(c.env)));

app.get("/studio", async (c) => opHtml(await renderStudioScreen(c.env)));

// ---- 301 redirects from old screen paths -------------------------------
// Bookmarks and chat-history references keep working. Each pre-P0 screen
// maps to the new surface that absorbed its functionality.

const redirects: Record<string, string> = {
  // home
  "/console": "/op",
  "/ingest": "/op",
  // oversight
  "/workbench": "/op/synthesis",
  "/leads": "/op/synthesis",
  "/patterns": "/op/synthesis",
  // authoring
  "/editorial": "/op/studio",
  "/build": "/op/briefs",
  // publishing
  "/publish": "/op/briefs",
};

for (const [from, to] of Object.entries(redirects)) {
  app.get(from, (c) => c.redirect(to, 301));
  app.get(`${from}/:rest{.*}`, (c) => c.redirect(to, 301));
}

export default app;

// Operator console routes. Mounted at /op in the Worker root.
// Cloudflare Access gates this whole subtree (configured at the edge),
// so no auth middleware is needed here — every request that reaches us
// is the authenticated operator.
//
// Server-rendered screens; the chat screen attaches a small client
// module for the SSE stream.

import { Hono } from "hono";
import type { Env } from "../env";
import { CHAT_CLIENT_JS } from "./client/chat-js";
import { opHtml } from "./layout";
import { renderChatScreen } from "./screens/chat";
import { renderConsole } from "./screens/console";
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

app.get("/ingest", () =>
  opHtml(
    renderOpSkeleton({
      title: "Ingest",
      activeNav: "/op/ingest",
      whatsHere:
        "Drop a document, see a diff of what's new (claims, entities, sources), review the near-duplicate detector ('this looks like a new pass of [chain] — link it?'), set publication_status + chain, confirm. For now, ingestion runs through the chat — drop a file and say 'save this as a piece.'",
    }),
  ),
);

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

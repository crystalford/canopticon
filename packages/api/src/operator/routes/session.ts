// Operator session, sign-in and the small status/redirect endpoints.
// Split out of operator/routes.ts on 2026-09-24; every handler is unchanged.

import { jobStatusForPiece } from "../../graph/lib/digest-jobs";
import { resolveOperatorId } from "../../public/data";
import { CHAT_CLIENT_JS } from "../client/chat-js";
import { operatorApp } from "./app";

const app = operatorApp();

// /op/library/:slug → /library/:slug (preserve the slug)
app.get("/library/:slug", (c) => c.redirect(`/library/${c.req.param("slug")}`, 302));

// Lightweight status endpoint for the Feed processing banner to poll. Returns
// the piece's digestion state from orchestrator_events without renderering HTML.
app.get("/feed/status", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.json({ ok: false, error: "no operator" }, 401);
  const pieceId = c.req.query("piece") ?? "";
  if (!pieceId) return c.json({ ok: false, error: "missing piece" }, 400);
  const view = await jobStatusForPiece(c.env, userId, pieceId);
  if (!view) {
    return c.json({ ok: true, state: "queued", step: "queued", claims: 0, attempts: 0 });
  }
  return c.json({
    ok: true,
    state: view.state,
    step: view.stale ? "retrying" : view.step,
    claims: view.claims,
    attempts: view.attempts,
    error: view.error,
  });
});

// Chat — removed from the rail (operator directive: streamline to the
// functions actually in use). The screen + SSE backend stay in the tree;
// the surface redirects to Library until/unless Chat earns its place back.
app.get("/chat", (c) => c.redirect("/op/library", 301));
app.get("/chat/:id", (c) => c.redirect("/op/library", 301));

// Chat client module — handles SSE consumption with the new design's
// chat-msg / chat-q / chat-r-text classes.
app.get("/chat.js", () => {
  return new Response(CHAT_CLIENT_JS, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
});

// SIGN IN, FROM INSIDE THE PREFIX ACCESS ACTUALLY PROTECTS.
//
// The same handler as /auth/login, mounted here on purpose. Minting a session
// requires Cloudflare Access to have verified the visitor and injected their
// email, and Access is scoped to a path — this site's application covers
// /op/* and the admin API, and CANNOT cover /* because the publication is
// meant to be publicly readable. So /auth/login sat outside the gate it
// depends on, no header ever arrived, and signing in was impossible. The
// operator reported being unable to reach the upload form four times.
//
// This mount needs no Cloudflare change. It still fails closed: no verified
// email, no cookie — so it adds a route that works, never a way in.
app.get("/login", async (c) => {
  const { handleLogin } = await import("../../auth/routes");
  return handleLogin(c as never);
});

export default app;

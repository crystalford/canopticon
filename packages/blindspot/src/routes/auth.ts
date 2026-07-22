// GET /auth/login — 302 to the publication's auth flow with the
// requested path as `next`. Cloudflare Access challenges on the apex,
// mints the cookie with `Domain=.canopticon.com`, and 302s back here.
// The instrument does not own a login flow — the publication is the
// trust anchor (same pattern as the video Worker).

import { Hono } from "hono";
import type { Env } from "../env.ts";

const app = new Hono<{ Bindings: Env }>();

app.get("/login", (c) => {
  const next = c.req.query("next") ?? c.env.BLINDSPOT_BASE;
  return c.redirect(`${c.env.PUBLIC_BASE}/auth/login?next=${encodeURIComponent(next)}`, 302);
});

app.get("/logout", (c) => {
  return c.redirect(`${c.env.PUBLIC_BASE}/auth/logout`, 302);
});

export default app;

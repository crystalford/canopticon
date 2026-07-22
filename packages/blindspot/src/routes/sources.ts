// GET /sources — the source catalog (sources/registry.ts rendered by
// pages/sources.ts).

import { Hono } from "hono";
import { type AuthState, readAuthState } from "../auth.ts";
import type { Env } from "../env.ts";
import { htmlResponse } from "../pages/shell.ts";
import { renderSourcesPage } from "../pages/sources.ts";

const app = new Hono<{ Bindings: Env; Variables: AuthState }>();

app.get("/", async (c) => {
  const auth = await readAuthState(c.req.raw, c.env);
  return htmlResponse(renderSourcesPage(auth.is_operator));
});

export default app;

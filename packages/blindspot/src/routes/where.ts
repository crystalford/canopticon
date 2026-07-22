// GET /where — the Where You Stand calculator (pages/where.ts). The one
// page on the instrument with client-side JS.

import { Hono } from "hono";
import { type AuthState, readAuthState } from "../auth.ts";
import type { Env } from "../env.ts";
import { htmlResponse } from "../pages/shell.ts";
import { renderWherePage } from "../pages/where.ts";

const app = new Hono<{ Bindings: Env; Variables: AuthState }>();

app.get("/", async (c) => {
  const auth = await readAuthState(c.req.raw, c.env);
  return htmlResponse(renderWherePage(auth.is_operator));
});

export default app;

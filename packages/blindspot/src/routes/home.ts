// GET / — the instrument landing (four movements), composed from live
// D1 data by pages/landing.ts.

import { Hono } from "hono";
import { type AuthState, readAuthState } from "../auth.ts";
import type { Env } from "../env.ts";
import { renderLandingPage } from "../pages/landing.ts";
import { htmlResponse } from "../pages/shell.ts";

const app = new Hono<{ Bindings: Env; Variables: AuthState }>();

app.get("/", async (c) => {
  const auth = await readAuthState(c.req.raw, c.env);
  return htmlResponse(await renderLandingPage(c.env, auth.is_operator));
});

export default app;

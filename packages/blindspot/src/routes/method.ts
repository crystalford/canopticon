// GET /method — the long-form method paper (content/method-paper.ts
// rendered by pages/method.ts).

import { Hono } from "hono";
import { type AuthState, readAuthState } from "../auth.ts";
import type { Env } from "../env.ts";
import { renderMethodPage } from "../pages/method.ts";
import { htmlResponse } from "../pages/shell.ts";

const app = new Hono<{ Bindings: Env; Variables: AuthState }>();

app.get("/", async (c) => {
  const auth = await readAuthState(c.req.raw, c.env);
  return htmlResponse(renderMethodPage(auth.is_operator));
});

export default app;

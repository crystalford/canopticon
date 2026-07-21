// GET /sources — the source catalog. Every statistic the instrument
// stands on, with last-fetched timestamp and a link to the exact
// snapshot. Commit 2 ships a shell placeholder; Commit 3 replaces this
// with the full catalog (sources/registry.ts → pages/sources.ts).

import { Hono } from "hono";
import { type AuthState, readAuthState } from "../auth.ts";
import type { Env } from "../env.ts";
import { htmlResponse, renderShell } from "../pages/shell.ts";

const app = new Hono<{ Bindings: Env; Variables: AuthState }>();

app.get("/", async (c) => {
  const auth = await readAuthState(c.req.raw, c.env);
  const body = `
<div class="bs-wrap" style="padding-top:clamp(40px,6vw,72px)">
  <div class="bs-label" style="margin-bottom:12px">Sources</div>
  <h1 style="font-family:var(--serif);font-weight:500;font-size:clamp(32px,5vw,46px);letter-spacing:-0.02em;line-height:1.05;margin-bottom:18px;max-width:20ch">Every number here is the government's, and traceable</h1>
  <p class="bs-prose" style="max-width:var(--reading)">The source catalog is being assembled — each official series with its publisher, cadence, last-fetched timestamp, and a link to the stored snapshot it was read from.</p>
</div>`;
  return htmlResponse(
    renderShell({
      title: "Sources",
      description:
        "Every official statistic The Blind Spot stands on — publisher, cadence, last-fetched timestamp, and a link to the stored snapshot.",
      activeNav: "/sources",
      isOperator: auth.is_operator,
      canonical: "https://blindspot.canopticon.com/sources",
      body,
    }),
  );
});

export default app;

// GET /method — the long-form method paper. Commit 2 ships a shell
// placeholder; Commit 3 replaces this with the full rendered paper
// (content/method-paper.ts → pages/method.ts).

import { Hono } from "hono";
import { type AuthState, readAuthState } from "../auth.ts";
import type { Env } from "../env.ts";
import { htmlResponse, renderShell } from "../pages/shell.ts";

const app = new Hono<{ Bindings: Env; Variables: AuthState }>();

app.get("/", async (c) => {
  const auth = await readAuthState(c.req.raw, c.env);
  const body = `
<div class="bs-read" style="padding-top:clamp(40px,6vw,72px)">
  <div class="bs-label" style="margin-bottom:12px">Method paper</div>
  <h1 style="font-family:var(--serif);font-weight:500;font-size:clamp(32px,5vw,46px);letter-spacing:-0.02em;line-height:1.05;margin-bottom:18px">How the instrument measures the failure of measurement</h1>
  <p class="bs-prose">The full method paper is being typeset. It proves the proposition, walks the three methods and why they structurally disagree, defines the Invisibility Index and the recovery ratio, and is explicit about every assumption it makes.</p>
</div>`;
  return htmlResponse(
    renderShell({
      title: "Method",
      description:
        "The method paper behind The Blind Spot: the proposition, the three methods, the Invisibility Index, and every stated assumption.",
      activeNav: "/method",
      isOperator: auth.is_operator,
      canonical: "https://blindspot.canopticon.com/method",
      body,
    }),
  );
});

export default app;

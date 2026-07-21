// GET /where — the Where You Stand calculator. The only page on the
// instrument that runs client-side JavaScript: a single inline <script>
// with no fetch, no localStorage, no PII. Commit 2 ships a shell
// placeholder; Commit 5 builds the calculator + percentile axis.

import { Hono } from "hono";
import { type AuthState, readAuthState } from "../auth.ts";
import type { Env } from "../env.ts";
import { htmlResponse, renderShell } from "../pages/shell.ts";

const app = new Hono<{ Bindings: Env; Variables: AuthState }>();

app.get("/", async (c) => {
  const auth = await readAuthState(c.req.raw, c.env);
  const body = `
<div class="bs-read" style="padding-top:clamp(40px,6vw,72px)">
  <div class="bs-label" style="margin-bottom:12px">Where you stand</div>
  <h1 style="font-family:var(--serif);font-weight:500;font-size:clamp(32px,5vw,46px);letter-spacing:-0.02em;line-height:1.05;margin-bottom:18px">Place a net-worth figure against the official distribution</h1>
  <p class="bs-prose">The calculator is being wired. It will place any net-worth figure on the official Canadian distribution and show, in the instrument's own disagreement-zone colour, where that distribution stops being able to see. Nothing you enter will leave your browser.</p>
</div>`;
  return htmlResponse(
    renderShell({
      title: "Where you stand",
      description:
        "Place any net-worth figure against the official Canadian wealth distribution — and see where that distribution stops being able to see. The calculation never leaves your browser.",
      activeNav: "/where",
      isOperator: auth.is_operator,
      canonical: "https://blindspot.canopticon.com/where",
      body,
    }),
  );
});

export default app;

// GET / — the instrument landing. Composes the four movements:
//   1. The Spread            — three official methods, the zone between
//   2. The Invisibility Index — the headline number + decomposition
//   3. The Behavior Strip     — the saving-glut → indebted-demand circuit
//   4. Where You Stand        — the percentile teaser
//
// Commit 2 ships the landing chrome with "no data yet" slots so the
// page reads finished before any statistics land. Commit 5 replaces the
// placeholder slots with the inline-SVG charts.

import { Hono } from "hono";
import { type AuthState, readAuthState } from "../auth.ts";
import type { Env } from "../env.ts";
import { escapeHtml, htmlResponse, renderShell } from "../pages/shell.ts";

const app = new Hono<{ Bindings: Env; Variables: AuthState }>();

app.get("/", async (c) => {
  const auth = await readAuthState(c.req.raw, c.env);

  const body = `
<section class="bs-hero bs-wrap">
  <div class="bs-label">Instrument · Canadian top-tail wealth</div>
  <h1 class="bs-hero-h1">The Blind Spot</h1>
  <p class="bs-hero-dek">
    Canada measures the wealth of its richest households three different
    official ways — and they disagree most precisely where it matters
    most: at the very top. This instrument makes the disagreement itself
    the subject, and quantifies it as one number.
  </p>
  <div class="bs-hero-meta">
    <a class="bs-hero-link" href="/method">Read the method →</a>
    <a class="bs-hero-link" href="/sources">See the sources →</a>
  </div>
</section>

${movementSlot("01", "The Spread", "The three methods, drawn together — and the zone between them that official statistics cannot resolve.")}
${movementSlot("02", "The Invisibility Index", "The size of the disagreement at the top, as a single number, decomposed into where the missing wealth hides.")}
${movementSlot("03", "The Behavior Strip", "The supporting circuit: a savings glut at the top financing indebted demand below.")}
${whereTeaser()}
`;

  const extraCss = `
.bs-hero { padding: clamp(48px, 8vw, 96px) clamp(18px, 5vw, 48px) clamp(36px, 5vw, 56px); max-width: 1120px; }
.bs-hero-h1 { font-family: var(--serif); font-weight: 500; font-size: clamp(44px, 9vw, 92px); letter-spacing: -0.035em; line-height: 0.98; margin: 14px 0 22px; }
.bs-hero-dek { font-family: var(--serif); font-size: clamp(18px, 2.4vw, 22px); line-height: 1.5; color: var(--ink-3); max-width: 42ch; }
.bs-hero-meta { display: flex; gap: 22px; flex-wrap: wrap; margin-top: 26px; }
.bs-hero-link { font-family: var(--mono); font-size: 13px; }
.bs-movement { max-width: 1120px; margin: 0 auto; padding: clamp(28px, 5vw, 52px) clamp(18px, 5vw, 48px); border-top: 1px solid var(--rule); }
.bs-movement-head { display: flex; align-items: baseline; gap: 16px; margin-bottom: 20px; }
.bs-movement-num { font-family: var(--mono); font-size: 13px; color: var(--accent); font-weight: 500; }
.bs-movement-h2 { font-family: var(--serif); font-weight: 500; font-size: clamp(26px, 4vw, 38px); letter-spacing: -0.02em; line-height: 1.08; }
.bs-movement-dek { font-family: var(--serif); font-size: 16.5px; line-height: 1.5; color: var(--ink-3); max-width: 60ch; margin-bottom: 24px; }
.bs-where-teaser { max-width: 1120px; margin: 0 auto; padding: clamp(36px, 5vw, 56px) clamp(18px, 5vw, 48px); }
.bs-where-card { background: var(--accent-bg); border: 1px solid var(--accent-bd); border-radius: var(--r-lg); padding: clamp(28px, 5vw, 48px); text-align: center; }
.bs-where-card h2 { font-family: var(--serif); font-weight: 500; font-size: clamp(26px, 4vw, 36px); letter-spacing: -0.02em; margin-bottom: 12px; }
.bs-where-card p { font-family: var(--serif); font-size: 17px; color: var(--ink-3); max-width: 48ch; margin: 0 auto 22px; }
.bs-where-cta { display: inline-block; font-family: var(--mono); font-size: 13px; font-weight: 500; color: #fff; background: var(--accent-2); padding: 12px 22px; border-radius: var(--r); }
.bs-where-cta:hover { background: var(--ink); text-decoration: none; }
`;

  return htmlResponse(
    renderShell({
      title: "The Blind Spot",
      description:
        "Canada's three official methods of measuring top-tail wealth disagree most at the very top. The Blind Spot renders the disagreement as the subject and quantifies it as the Invisibility Index.",
      activeNav: "/",
      isOperator: auth.is_operator,
      canonical: "https://blindspot.canopticon.com/",
      extraCss,
      body,
    }),
  );
});

function movementSlot(num: string, title: string, dek: string): string {
  return `<section class="bs-movement">
  <div class="bs-movement-head">
    <span class="bs-movement-num">${escapeHtml(num)}</span>
    <h2 class="bs-movement-h2">${escapeHtml(title)}</h2>
  </div>
  <p class="bs-movement-dek">${escapeHtml(dek)}</p>
  <div class="bs-empty">No data yet — the operator refreshes the sources to paint this chart.</div>
</section>`;
}

function whereTeaser(): string {
  return `<section class="bs-where-teaser">
  <div class="bs-where-card">
    <div class="bs-label" style="margin-bottom:12px">Movement 04</div>
    <h2>Where do you stand?</h2>
    <p>Put in a net-worth figure and see where it places against the official Canadian distribution — and where the official distribution stops being able to see.</p>
    <a class="bs-where-cta" href="/where">Place a number →</a>
    <p style="font-family:var(--mono);font-size:11px;color:var(--ink-mute);margin-top:18px;max-width:none">This calculation never leaves your browser.</p>
  </div>
</section>`;
}

export default app;

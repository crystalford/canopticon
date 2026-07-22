// The outer HTML shell for every Blind Spot page. Pure string
// concatenation; no JSX, no templating library. No JavaScript is
// required to read any page (the sole exception is the /where
// calculator, which injects its own inline <script>).
//
// The design tokens are lifted from the publication's design system
// (packages/api/src/public/styles.ts :root block) so the instrument
// reads as the same publication — warm paper, ink-blue accent, the
// Geist / Newsreader / Geist Mono three-voice type stack. Embedded as a
// template literal so the Worker bundles it with no loader plugin.

const GOOGLE_FONTS =
  "https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&display=swap";

// The disagreement-zone fill colour — the instrument's signature. Used
// on the spread chart, the index hero, and the /where extrapolation.
export const ZONE_FILL = "rgba(58,99,160,0.09)";

const NAV: Array<{ href: string; label: string }> = [
  { href: "/", label: "instrument" },
  { href: "/method", label: "method" },
  { href: "/sources", label: "sources" },
  { href: "/where", label: "where you stand" },
];

export interface ShellArgs {
  title: string;
  description: string;
  /** The nav href to mark active, e.g. "/method". */
  activeNav: string;
  /** Rendered page body HTML. */
  body: string;
  /** Reveals the operator-only refresh strip when true. */
  isOperator: boolean;
  /** Canonical URL for this page. */
  canonical?: string;
  /** Optional page-specific CSS appended after the base stylesheet. */
  extraCss?: string;
  /** Optional extra <head> markup (e.g. JSON-LD). */
  extraHead?: string;
}

export function renderShell(args: ShellArgs): string {
  const nav = NAV.map((item) => {
    const active = item.href === args.activeNav;
    return active
      ? `<a class="active" href="${item.href}">${item.label}</a>`
      : `<a href="${item.href}">${item.label}</a>`;
  }).join("");

  return `<!doctype html>
<html lang="en" data-mode="public">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(args.title)} — The Blind Spot · CANOPTICON</title>
<meta name="description" content="${escapeAttr(args.description)}" />
${args.canonical ? `<link rel="canonical" href="${escapeAttr(args.canonical)}" />` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${GOOGLE_FONTS}" />
<style>${BLINDSPOT_CSS}${args.extraCss ?? ""}</style>
${args.extraHead ?? ""}
</head>
<body>
<div class="bs-topbar">
  <a class="bs-brand" href="/">canopticon<span class="bs-dot">·</span><span class="bs-brand-sub">the blind spot</span></a>
  <nav class="bs-nav">${nav}</nav>
</div>
${args.isOperator ? operatorStrip() : ""}
<main class="bs-main">
${args.body}
</main>
${trustStrip()}
<footer class="bs-footer">
  <div class="bs-footer-inner">
    <div class="bs-footer-brand">
      <span class="bs-brand-mono">canopticon · the blind spot</span>
      <p>An instrument that measures the failure of measurement. One of a growing set of CANOPTICON instruments — standalone tools that make visible what the official statistics structurally cannot.</p>
    </div>
    <div class="bs-footer-links">
      <a href="/method">Method paper</a>
      <a href="/sources">Sources</a>
      <a href="/where">Where you stand</a>
      <a href="https://canopticon.com/instruments">All instruments →</a>
    </div>
  </div>
</footer>
</body>
</html>`;
}

function operatorStrip(): string {
  return `<div class="bs-op-strip">
  <span class="bs-op-note">operator · push-button mode · cron disabled</span>
  <form method="post" action="/refresh" class="bs-op-form">
    <button type="submit" class="bs-op-btn">⟳ Refresh sources</button>
  </form>
</div>`;
}

function trustStrip(): string {
  return `<aside class="bs-trust" aria-label="How this instrument verifies">
  <span class="bs-trust-mark" aria-hidden="true">✓</span>
  <p>Every figure on this instrument is drawn from <strong>publicly released government statistics</strong>, snapshotted at the moment we read it and stored with a content hash. Every number links back to the exact source and the exact snapshot. The interpretation is ours and labelled as such; the data is the government's and traceable. <a href="/method">How the method works →</a></p>
</aside>`;
}

export function escapeHtml(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeAttr(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function htmlResponse(html: string, init: ResponseInit = {}): Response {
  return new Response(html, {
    ...init,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers ?? {}),
    },
  });
}

// ---------------------------------------------------------------------------
// The stylesheet. Token block lifted from the publication's :root; the
// rest is the instrument's own chrome + the reusable content primitives
// (honesty box, prose, section, cite chip, movement, chart frame) that
// the method paper and the four movements build on.
// ---------------------------------------------------------------------------
const BLINDSPOT_CSS = `
:root {
  --paper:    #ecebe9;
  --paper-2:  #e3e1de;
  --paper-3:  #d4d1cc;
  --surface:  #f8f7f5;
  --ink:      #171614;
  --ink-2:    #2d2b28;
  --ink-3:    #56524e;
  --ink-mute: #837e78;
  --ink-faint:#aea9a2;
  --rule:     #d9d6d1;
  --rule-soft:#e7e4df;
  --accent:   #3a63a0;
  --accent-2: #2c4d7e;
  --accent-3: #7ea6d8;
  --accent-bg:#e8ecf3;
  --accent-bd:#c4d1e3;
  --rose:     #b25f80;
  --confirmed:#2f7d52;
  --warn:     #b0402c;

  --sans:  'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --serif: 'Newsreader', Georgia, 'Times New Roman', serif;
  --mono:  'Geist Mono', ui-monospace, 'SF Mono', monospace;

  --r-sm: 4px;
  --r:    7px;
  --r-lg: 12px;
  --shadow-sm: 0 1px 2px rgba(28,24,19,0.05);
  --shadow:    0 2px 5px rgba(28,24,19,0.06), 0 1px 2px rgba(28,24,19,0.04);
  --shadow-lg: 0 12px 40px rgba(28,24,19,0.13);
  --reading: 680px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
html, body {
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
a { color: var(--accent-2); text-decoration: none; }
a:hover { text-decoration: underline; }
strong { font-weight: 600; }

/* ---- top bar + nav ---- */
.bs-topbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 20px; flex-wrap: wrap;
  padding: 16px clamp(18px, 5vw, 48px);
  border-bottom: 1px solid var(--rule);
  background: color-mix(in srgb, var(--paper) 88%, transparent);
  position: sticky; top: 0; z-index: 20;
  backdrop-filter: saturate(1.4) blur(8px);
}
.bs-brand {
  font-family: var(--mono); font-size: 14px; font-weight: 500;
  letter-spacing: -0.01em; color: var(--ink); display: inline-flex;
  align-items: baseline; gap: 6px;
}
.bs-brand:hover { text-decoration: none; }
.bs-dot { color: var(--accent); font-weight: 700; }
.bs-brand-sub { color: var(--ink-mute); }
.bs-nav { display: flex; gap: 4px; flex-wrap: wrap; }
.bs-nav a {
  font-family: var(--mono); font-size: 12.5px; color: var(--ink-3);
  padding: 6px 11px; border-radius: var(--r-sm); letter-spacing: -0.01em;
}
.bs-nav a:hover { background: var(--paper-2); color: var(--ink); text-decoration: none; }
.bs-nav a.active { background: var(--accent-bg); color: var(--accent-2); font-weight: 500; }

/* ---- operator strip ---- */
.bs-op-strip {
  display: flex; align-items: center; justify-content: space-between;
  gap: 14px; flex-wrap: wrap;
  padding: 9px clamp(18px, 5vw, 48px);
  background: var(--accent-bg); border-bottom: 1px solid var(--accent-bd);
}
.bs-op-note { font-family: var(--mono); font-size: 11.5px; color: var(--accent-2); }
.bs-op-btn {
  font-family: var(--mono); font-size: 12px; font-weight: 500;
  color: #fff; background: var(--accent-2); border: 0;
  padding: 7px 14px; border-radius: var(--r-sm); cursor: pointer;
}
.bs-op-btn:hover { background: var(--ink); }

/* ---- main ---- */
.bs-main { display: block; }
.bs-wrap { max-width: 1120px; margin: 0 auto; padding: 0 clamp(18px, 5vw, 48px); }
.bs-read { max-width: var(--reading); margin: 0 auto; padding: 0 clamp(18px, 5vw, 32px); }

/* ---- eyebrow / labels ---- */
.bs-label {
  font-family: var(--mono); font-size: 11px; font-weight: 500;
  letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-mute);
}

/* ---- prose ---- */
.bs-prose { font-family: var(--serif); font-size: 19px; line-height: 1.62; color: var(--ink-2); }
.bs-prose p { margin: 0 0 1.05em; text-wrap: pretty; }
.bs-prose h2 {
  font-family: var(--serif); font-weight: 600; font-size: 26px;
  letter-spacing: -0.02em; line-height: 1.15; color: var(--ink);
  margin: 1.9em 0 0.5em;
}
.bs-prose h3 {
  font-family: var(--sans); font-weight: 600; font-size: 17px;
  letter-spacing: -0.01em; color: var(--ink); margin: 1.6em 0 0.4em;
}
.bs-prose ul, .bs-prose ol { margin: 0 0 1.05em 1.2em; }
.bs-prose li { margin: 0 0 0.4em; }
.bs-prose a { border-bottom: 1px solid var(--accent-bd); }
.bs-prose sup a { border: 0; font-family: var(--mono); font-size: 0.7em; padding: 0 1px; }
.bs-prose code { font-family: var(--mono); font-size: 0.82em; background: var(--paper-2); padding: 1px 5px; border-radius: 3px; }

/* ---- the honesty box — the firewall made legible ---- */
.bs-honesty {
  font-family: var(--serif); font-style: italic; font-size: 17px;
  line-height: 1.55; color: var(--ink-2);
  border-left: 2px solid var(--accent);
  background: var(--accent-bg); padding: 18px 22px;
  margin: 1.4em 0; border-radius: 0 var(--r) var(--r) 0;
}
.bs-honesty strong { font-style: normal; }
.bs-honesty .bs-honesty-tag {
  display: block; font-family: var(--mono); font-style: normal;
  font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--accent-2); margin-bottom: 6px;
}

/* ---- cite chip — the receipt ---- */
.bs-cites { display: flex; flex-wrap: wrap; gap: 8px; }
.bs-cite {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--mono); font-size: 11px; color: var(--ink-3);
  background: var(--surface); border: 1px solid var(--rule);
  padding: 5px 10px; border-radius: 999px;
}
.bs-cite .bs-cite-method { color: var(--accent-2); font-weight: 500; }
.bs-cite .bs-cite-sha { color: var(--ink-faint); }

/* ---- trust strip ---- */
.bs-trust {
  display: flex; gap: 14px; align-items: flex-start;
  max-width: 1120px; margin: 48px auto 0;
  padding: 22px clamp(18px, 5vw, 48px);
  border-top: 1px solid var(--rule);
}
.bs-trust-mark {
  flex: none; width: 22px; height: 22px; border-radius: 50%;
  background: var(--accent-bg); color: var(--accent-2);
  display: grid; place-items: center; font-size: 12px; margin-top: 2px;
}
.bs-trust p { font-family: var(--serif); font-size: 15px; line-height: 1.55; color: var(--ink-3); max-width: 74ch; }

/* ---- footer ---- */
.bs-footer { border-top: 1px solid var(--rule); background: var(--paper-2); margin-top: 20px; }
.bs-footer-inner {
  max-width: 1120px; margin: 0 auto; padding: 40px clamp(18px, 5vw, 48px);
  display: flex; gap: 40px; flex-wrap: wrap; justify-content: space-between;
}
.bs-footer-brand { max-width: 460px; }
.bs-brand-mono { font-family: var(--mono); font-size: 12.5px; color: var(--ink-2); }
.bs-footer-brand p { font-family: var(--serif); font-size: 13.5px; line-height: 1.55; color: var(--ink-mute); margin-top: 10px; }
.bs-footer-links { display: flex; flex-direction: column; gap: 9px; }
.bs-footer-links a { font-family: var(--mono); font-size: 12.5px; color: var(--ink-3); }

/* ---- generic card ---- */
.bs-card {
  background: var(--surface); border: 1px solid var(--rule);
  border-radius: var(--r-lg); padding: 22px 24px;
}
.bs-card.soft { background: var(--paper-2); border-color: transparent; }

/* ---- placeholder (no data yet) ---- */
.bs-empty {
  border: 1px dashed var(--rule); border-radius: var(--r-lg);
  padding: 40px 24px; text-align: center;
  font-family: var(--serif); font-size: 15.5px; color: var(--ink-mute);
  background: var(--surface);
}

/* ---- responsive chart frame ---- */
.bs-figure { margin: 0; }
.bs-figure svg { width: 100%; height: auto; display: block; }
.bs-figcaption { font-family: var(--serif); font-size: 15px; line-height: 1.55; color: var(--ink-3); margin-top: 14px; max-width: 68ch; }

@media (max-width: 620px) {
  .bs-prose { font-size: 17.5px; }
  .bs-nav { width: 100%; }
}
`;

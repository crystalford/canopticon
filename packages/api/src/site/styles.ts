// THE BLACK BOX STYLESHEET — the redesigned public record, served at /site.css.
//
// docs/blackbox/README.md is the spec and the pages in its prototype are the
// tie-breaker ("when a page and this README disagree, the page wins"). The
// prototypes carry every style inline; this is those inline styles collected
// into one sheet, named by what they are for. Values are copied, not
// approximated: if a number here looks arbitrary, it is the prototype's.
//
// Rules this sheet keeps (pinned by tests/site-styles.test.ts):
//   - colours are tokens on :root; the only literals outside :root are the
//     per-topic pill pairs, which are data and ride inline on the element;
//   - no box-shadow anywhere — depth is hairlines, hover tints, nothing lifts;
//   - no backtick inside this template literal (it ends the string early);
//   - the reading column is 720px and nothing inside it sets its own measure.

export const SITE_CSS = `
:root {
  --paper: #f6f3ec;
  --card: #fffdf8;
  --tint: #efebe1;
  --tint-2: #f3eee2;
  --tint-3: #f6f2e8;
  --ink: #15171c;
  --body: #2e313a;
  --ink-2: #4a4d57;
  --muted: #5a5e6b;
  --hint: #7a7e8a;
  --rule: #d8d2c4;
  --rule-2: #b8b3a7;
  --hair: #e8e3d8;
  --hair-2: #efeae0;
  --cobalt: #2f55c4;
  --cobalt-soft: #e6ecfa;
  --cobalt-ink: #1f4e8c;
  --cobalt-line: #c9d3f0;
  --cobalt-hover: #d6dff5;
  --switch: #8c877b;
  --brick: #b0402c;
  --green: #2f7d52;
  --green-bg: #e3f0e6;
  --green-ink: #1f5e36;
  --green-hover: #d3e8d8;
  --green-wash: #eef6f0;
  --mark: rgba(47, 125, 82, .14);
  --clay-bg: #fbe9df;
  --clay-ink: #8a3a1f;
  --clay-wash: #fbf1ea;
  --clay-line: #e0b9a6;
  --green-line: #cfe3d5;
  --amber: #b8862f;
  --amber-ink: #6b4e14;
  --violet-bg: #efe6f6;
  --violet-ink: #5a2d82;
  --sans: Geist, system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, monospace;
  --frame: 1240px;
  --read: 720px;
  --rail: 280px;
  /* A soft focus halo for fields: an outline, never a shadow. */
  --halo: 3px solid var(--cobalt-soft);
  /* One type scale: eight fixed steps for interface and reading text, four
     fluid ones for headings. Every font-size below is one of these. */
  --t-xs: 12px;
  --t-sm: 13px;
  --t-ui: 14px;
  --t-md: 15px;
  --t-body: 17px;
  --t-read: 18px;
  --t-lg: 20px;
  --t-xl: 22px;
  --t-lede: clamp(18px, 1.8vw, 22px);
  --t-quote: clamp(20px, 2.2vw, 26px);
  --t-h2: clamp(26px, 2.6vw, 32px);
  --t-h1: clamp(28px, 3.2vw, 40px);
  --t-display: clamp(32px, 3.8vw, 48px);
}

*, *::before, *::after { box-sizing: border-box; }
html { background: var(--paper); scroll-padding-top: 80px; overflow-x: clip; }
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
body {
  margin: 0; background: var(--paper); color: var(--ink); font-family: var(--sans);
  -webkit-font-smoothing: antialiased; text-wrap: pretty; overflow-x: clip; max-width: 100%;
}
h1, h2, h3 { text-wrap: balance; }
a { color: inherit; text-decoration: none; }
a, button { transition: color .15s, border-color .15s, background-color .15s, opacity .15s, filter .15s; }
a:hover { color: var(--cobalt); border-color: var(--cobalt); }
a:focus-visible, button:focus-visible, summary:focus-visible { outline: 2px solid var(--cobalt); outline-offset: 3px; border-radius: 2px; }
::selection { background: var(--cobalt-soft); color: var(--ink); }
mark { background: var(--mark); color: inherit; padding: 1px 0; border-radius: 3px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
input[type="search"] { -webkit-appearance: none; appearance: none; }
.vh { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.tnum { font-variant-numeric: tabular-nums; }

/* ---- chrome ---------------------------------------------------------- */

.skip { position: absolute; left: -9999px; top: 10px; z-index: 40; background: var(--ink); color: var(--paper); padding: 8px 12px; font-size: var(--t-xs); font-weight: 500; }
.skip:focus { left: 16px; }
.skip:hover { opacity: .85; color: var(--paper); }
.hd { position: sticky; top: 0; z-index: 30; background: rgba(246, 243, 236, .86); backdrop-filter: saturate(1.4) blur(10px); -webkit-backdrop-filter: saturate(1.4) blur(10px); }
.hd-in { max-width: var(--frame); margin: 0 auto; padding: 8px 32px; min-height: 60px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 28px; border-bottom: 1px solid var(--hair); line-height: 1; }
/* Working pages (Admin's desk, a conversation): the header spans the window
   like the desk under it, and on a wide screen the page fills the window
   with its own scrolling panes — the composer never sits over a list. */
.hd.wide .hd-in { max-width: none; padding: 8px 20px; }
@media (min-width: 861px) {
  body.app { height: 100dvh; display: flex; flex-direction: column; overflow: hidden; }
  body.app .hd { flex: none; position: static; }
  body.app .main { flex: 1; min-height: 0; width: 100%; display: flex; flex-direction: column; }
  body.app .desk, body.app .ws { flex: 1; min-height: 0; }
  body.app .desk-side { min-height: 0; }
  body.app .desk-scroll { min-height: 0; overflow-y: auto; }
  body.app .desk-pane { overflow-y: auto; }
  body.app .ws-panes { height: auto; min-height: 0; }
}
.wm { font-weight: 700; font-size: var(--t-read); letter-spacing: -.03em; white-space: nowrap; color: var(--ink); }
.nav { display: flex; gap: 22px; font-size: var(--t-ui); font-weight: 500; color: var(--muted); white-space: nowrap; }
.nav a { padding: 6px 0; }
.nav a:hover { color: var(--ink); }
.nav a[aria-current="page"] { color: var(--ink); font-weight: 600; text-decoration: underline; text-decoration-color: var(--cobalt); text-decoration-thickness: 2px; text-underline-offset: 9px; }
/* Search looks like what it opens: a quiet field with a magnifier. */
.hd-search { display: inline-flex; align-items: center; gap: 8px; margin-left: auto; height: 34px; min-width: 180px; padding: 0 12px 0 10px; border: 1px solid var(--hair); border-radius: 10px; background: var(--card); font-size: var(--t-ui); font-weight: 500; color: var(--muted); white-space: nowrap; }
.hd-search::before { content: ""; flex: none; width: 15px; height: 15px; background: currentColor; -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.7' stroke-linecap='round'%3E%3Ccircle cx='7' cy='7' r='5'/%3E%3Cpath d='m11 11 3.5 3.5'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.7' stroke-linecap='round'%3E%3Ccircle cx='7' cy='7' r='5'/%3E%3Cpath d='m11 11 3.5 3.5'/%3E%3C/svg%3E") center / contain no-repeat; }
.hd-search:hover { border-color: var(--rule); color: var(--ink); }
.hd-search[aria-current="page"] { border-color: var(--cobalt-line); color: var(--ink); font-weight: 600; }
.admin { display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 12px; background: var(--card); color: var(--ink); border: 1px solid var(--rule); font-size: var(--t-sm); font-weight: 600; white-space: nowrap; border-radius: 10px; }
.admin:hover { background: var(--paper); border-color: var(--rule-2); color: var(--ink); }
.admin-n { font-size: var(--t-xs); font-weight: 600; line-height: 1; padding: 3px 7px; border-radius: 999px; background: var(--clay-bg); color: var(--clay-ink); font-variant-numeric: tabular-nums; }
.rp { height: 2px; background: transparent; }
#read-progress { height: 2px; width: 0; background: var(--cobalt); transition: width .1s linear; }

.ft { border-top: 1px solid var(--hair); background: var(--tint); }
.ft-in { max-width: var(--frame); margin: 0 auto; padding: 36px 32px 48px; display: flex; flex-wrap: wrap; gap: 16px 40px; align-items: flex-start; }
.ft-wm { flex: none; font-weight: 700; font-size: var(--t-md); letter-spacing: -.02em; }
.ft-line { flex: 1 1 320px; font-size: var(--t-sm); line-height: 1.6; color: var(--ink-2); max-width: 56ch; }
.ft-line a { color: var(--ink); border-bottom: 1px solid var(--green); }
.ft-nav { margin-left: auto; display: grid; grid-template-columns: repeat(2, max-content); gap: 8px 32px; font-size: var(--t-sm); color: var(--ink-2); }
.ft-nav a:hover { color: var(--ink); }

/* ---- the grid (docs/blackbox/LAYOUT.md) ------------------------------- */

.main { max-width: var(--frame); margin: 0 auto; padding: 20px 32px 80px; }
.main.long { padding-bottom: 120px; }
.rr { display: flex; flex-wrap: wrap; gap: 48px 72px; align-items: flex-start; max-width: calc(var(--read) + 72px + var(--rail)); }
.col { flex: 999 1 480px; min-width: 0; max-width: var(--read); }
.rail { flex: 1 1 var(--rail); min-width: 0; max-width: var(--rail); display: flex; flex-direction: column; gap: 28px; align-self: stretch; }
.rail-sticky { position: sticky; top: 84px; }
.rail.tight { gap: 16px; position: sticky; top: 84px; align-self: flex-start; }

/* ---- pills ------------------------------------------------------------ */

.pill { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: var(--t-xs); line-height: 1.45; font-weight: 500; white-space: nowrap; background: var(--tint); color: var(--ink); }
.pill.lg { padding: 3px 10px; font-size: var(--t-sm); }
a.pill:hover, a.tpill:hover { filter: brightness(.96); }
.chip { display: inline-block; padding: 3px 10px; border-radius: 999px; background: var(--tint); color: var(--ink); font-size: var(--t-sm); font-weight: 500; white-space: nowrap; }
.tpill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; font-size: var(--t-ui); font-weight: 500; }
.tpill .n { opacity: .7; font-size: var(--t-xs); font-variant-numeric: tabular-nums; }
.pills { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }

/* ---- buttons and fields ------------------------------------------------ */

/* ---- controls: one system (design handoff v3, SINCE-V2 §2) ----------------
   Every clickable thing is a visible control; text links are for navigation
   inside running text only. .btn is Secondary; .primary is tonal blue; .sm is
   Small; .warn is the fix button inside a warning bar; .ghost is a link that
   looks like a control. .d-btn is the same control under Admin's old name. */
.btn, .d-btn { appearance: none; margin: 0; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 9px; background: var(--card); color: var(--ink); border: 1px solid var(--rule); font: inherit; font-size: var(--t-ui); font-weight: 500; line-height: 1; white-space: nowrap; text-decoration: none; }
.btn:hover, .d-btn:hover { background: var(--tint); border-color: var(--rule); color: var(--ink); }
.btn.primary, .d-btn.primary { height: 34px; padding: 0 14px; background: var(--cobalt-soft); border-color: var(--cobalt-line); color: var(--cobalt-ink); font-weight: 600; }
.btn.primary:hover, .d-btn.primary:hover { background: var(--cobalt-hover); border-color: var(--cobalt-line); color: var(--cobalt-ink); }
.btn.sm, .d-btn.sm { height: 28px; padding: 0 10px; border-radius: 8px; font-size: var(--t-sm); }
.btn.tall { height: 40px; padding: 0 16px; }
.btn.quiet, .d-btn.quiet { color: var(--ink-2); }
.btn.warn, .d-btn.warn { height: 26px; padding: 0 9px; border-radius: 8px; border-color: var(--clay-line); color: var(--clay-ink); font-size: var(--t-sm); font-weight: 600; }
.btn.warn:hover, .d-btn.warn:hover, .btn.stop:hover { background: var(--clay-wash); border-color: var(--clay-line); color: var(--clay-ink); }
.btn.ghost, .d-btn.ghost { border-color: transparent; background: transparent; color: var(--cobalt-ink); }
.btn.ghost:hover, .d-btn.ghost:hover { background: var(--cobalt-soft); border-color: transparent; color: var(--cobalt-ink); }
.btn.file, .d-btn.file { position: relative; overflow: hidden; }
.btn.file input, .d-btn.file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.btn .g, .d-btn .g, .toggle .g { font-weight: 400; }
.g-dl { display: inline-block; line-height: 1; padding-bottom: 1px; border-bottom: 1.5px solid currentColor; }
.g-stop { display: inline-block; width: 8px; height: 8px; border-radius: 1px; background: currentColor; }
.btn .sub { color: var(--muted); font-weight: 400; }
.chipb { appearance: none; margin: 0; font: inherit; cursor: pointer; display: inline-flex; align-items: center; height: 24px; padding: 0 9px; border-radius: 999px; border: 1px solid var(--rule); background: var(--card); color: var(--ink); font-size: var(--t-sm); font-weight: 500; white-space: nowrap; }
.chipb[hidden] { display: none; }
.chipb:hover, .chipb[aria-pressed="true"] { background: var(--cobalt-soft); border-color: var(--cobalt-line); color: var(--cobalt-ink); }
.attach { position: relative; display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px 0 6px; border-radius: 999px; background: var(--paper); border: 1px solid var(--hair); color: var(--ink); font-size: var(--t-ui); font-weight: 500; cursor: pointer; white-space: nowrap; }
.attach:hover { background: var(--tint); }
.attach .plus { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 999px; background: var(--cobalt-soft); color: var(--cobalt-ink); font-size: var(--t-ui); line-height: 1; }
.attach:focus-within { outline: 2px solid var(--cobalt); outline-offset: 3px; }
.toggle { appearance: none; margin: 0; font: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 8px 0 10px; border-radius: 999px; border: 1px solid var(--rule); background: var(--card); color: var(--ink); font-size: var(--t-ui); font-weight: 500; white-space: nowrap; }
.toggle .sw { position: relative; flex: none; width: 26px; height: 16px; border-radius: 999px; background: var(--switch); }
.toggle .sw::after { content: ""; position: absolute; top: 3px; left: 3px; width: 10px; height: 10px; border-radius: 999px; background: var(--card); transition: left .15s; }
.toggle .n { padding: 1px 7px; border-radius: 999px; background: var(--tint); color: var(--ink-2); font-size: var(--t-xs); font-weight: 600; }
.toggle[aria-pressed="true"] { background: var(--cobalt-soft); border-color: var(--cobalt-line); color: var(--cobalt-ink); }
.toggle[aria-pressed="true"] .sw { background: var(--cobalt); }
.toggle[aria-pressed="true"] .sw::after { left: 13px; }
.toggle[aria-pressed="true"] .n { background: var(--card); color: var(--cobalt-ink); }
.more { position: relative; }
.more > summary { list-style: none; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 1px solid var(--rule); border-radius: 9px; background: var(--card); color: var(--ink); cursor: pointer; font-weight: 700; letter-spacing: 1px; }
.more > summary::-webkit-details-marker { display: none; }
.more > summary:hover, .more[open] > summary { background: var(--tint); }
.more-menu { position: absolute; right: 0; top: 38px; z-index: 6; min-width: 180px; display: flex; flex-direction: column; padding: 6px; border: 1px solid var(--rule); border-radius: 10px; background: var(--card); }
.more-menu button, .more-menu a { appearance: none; margin: 0; border: 0; background: none; font: inherit; font-size: var(--t-ui); text-align: left; padding: 8px 10px; border-radius: 7px; color: var(--ink); cursor: pointer; white-space: nowrap; }
.more-menu button:hover, .more-menu a:hover { background: var(--tint); color: var(--ink); }
.more-menu .danger, .more-menu .danger:hover { color: var(--clay-ink); }
.field { flex: 1 1 220px; min-width: 0; height: 42px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--rule); background: var(--card); font: inherit; font-size: var(--t-md); color: var(--ink); outline: none; }
.field:focus { border-color: var(--cobalt); outline: var(--halo); }
.field::placeholder, .sbox input::placeholder, .lib-search input::placeholder, .cmp textarea::placeholder, .ws-form textarea::placeholder, .q-url input::placeholder { color: var(--muted); opacity: 1; }
.ulink { color: var(--ink); border-bottom: 1px solid var(--rule); }
.glink { color: var(--ink); border-bottom: 1px solid var(--green); }

/* ---- cards and lists --------------------------------------------------- */

.card { background: var(--card); border: 1px solid var(--hair); border-radius: 14px; }
a.card { display: flex; flex-direction: column; gap: 8px; padding: 20px 22px; border-radius: 14px; background: var(--card); border: 1px solid var(--hair); min-width: 0; }
a.card:hover { background: var(--tint-3); border-color: var(--rule); color: var(--ink); }
.tile-t { font-size: var(--t-lg); line-height: 1.3; font-weight: 500; letter-spacing: -.015em; color: var(--ink); }
a.card:hover .tile-t { color: var(--cobalt); }
.tile-d { font-size: var(--t-ui); line-height: 1.5; color: var(--ink-2); }
.tile-d.clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.grid3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 12px; }
.grid3.wide { grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); }
.sec { margin-top: 72px; }
.sec-h { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
.sec-h h2 { font-size: var(--t-xl); font-weight: 600; letter-spacing: -.02em; margin: 0 6px 0 0; color: var(--ink); }
.ruled-h { display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--rule); padding-bottom: 10px; margin-bottom: 16px; }
.ruled-h h2 { font-size: var(--t-xl); font-weight: 600; letter-spacing: -.02em; margin: 0; }
.rows { background: var(--card); border: 1px solid var(--hair); border-radius: 16px; padding: 8px 24px; }
.rows.slim { padding: 4px 20px; }
a.row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 20px; padding: 14px 12px; margin: 0 -12px; border-radius: 9px; border-bottom: 1px solid var(--hair); align-items: baseline; }
a.row:last-child, a.row.last { border-bottom: 0; }
a.row:hover, a.lrow:hover { background: var(--tint-3); color: var(--ink); }
.row-t { display: block; font-size: var(--t-lg); line-height: 1.28; font-weight: 500; letter-spacing: -.015em; color: var(--ink); }
a.row:hover .row-t, a.lrow:hover .lrow-t { color: var(--cobalt); }
.row-d { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: var(--t-ui); line-height: 1.5; color: var(--ink-2); margin-top: 3px; }
.row-r { display: flex; flex-direction: column; align-items: flex-end; text-align: right; }
.row-date { font-size: var(--t-lg); font-weight: 500; letter-spacing: -.02em; font-variant-numeric: tabular-nums; color: var(--ink); line-height: 1.1; }
.row-more { display: flex; align-items: center; padding: 14px 12px; margin: 0 -12px; border-radius: 9px; border-top: 1px solid var(--hair); font-size: var(--t-md); font-weight: 500; color: var(--ink); }
.row-more:hover { background: var(--tint-3); color: var(--ink); }
.row-more::after { content: "\\2192"; margin-left: auto; color: var(--muted); }
.row-more:hover::after { color: var(--cobalt); }
.stack { display: flex; flex-direction: column; gap: 1px; background: var(--hair); border: 1px solid var(--hair); border-radius: 14px; overflow: hidden; }
.stack > a { display: flex; flex-direction: column; gap: 6px; padding: 16px 22px; background: var(--card); min-width: 0; }
.stack > a:hover { background: var(--tint-3); color: var(--ink); }
.stack-t { font-size: var(--t-body); line-height: 1.35; font-weight: 500; letter-spacing: -.01em; color: var(--ink); }
.stack-d { font-size: var(--t-ui); line-height: 1.5; color: var(--ink-2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
a.lrow { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 24px; padding: 14px 12px; margin: 0 -12px; border-radius: 10px; border-bottom: 1px solid var(--hair); align-items: baseline; }
.lrow-t { font-size: var(--t-read); line-height: 1.3; font-weight: 500; letter-spacing: -.01em; color: var(--ink); }
.lrow-k { font-size: var(--t-xs); color: var(--muted); white-space: nowrap; }

/* ---- metadata panels --------------------------------------------------- */

.meta { background: var(--card); border: 1px solid var(--hair); border-radius: 14px; padding: 6px 18px 8px; }
.meta-r { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 10px 0; border-top: 1px solid var(--hair); font-size: var(--t-sm); }
.meta-r:first-child { border-top: 0; }
.meta-r > span:first-child { color: var(--muted); }
.meta-r > span:last-child { color: var(--ink); text-align: right; }
.meta-r.stack-v { flex-direction: column; align-items: stretch; gap: 6px; }
.meta-link { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; padding: 5px 12px 5px 6px; border-radius: 999px; background: var(--card); border: 1px solid var(--hair); color: var(--ink); font-size: var(--t-sm); }
.meta-link .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta-link:hover { background: var(--tint-3); color: var(--ink); }
.statbox { display: flex; flex-direction: column; gap: 12px; padding: 16px; border: 1px solid var(--hair); border-radius: 14px; background: var(--card); }
.statbox-p { display: flex; flex-wrap: wrap; gap: 6px; }
.statbox .tpill { align-self: flex-start; padding: 4px 12px; }
.stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.stat { padding: 12px 14px; border-radius: 12px; background: #f6f2e8; min-width: 0; }
.stat-v { font-size: var(--t-xl); font-weight: 600; letter-spacing: -.01em; line-height: 1.2; color: var(--ink); font-variant-numeric: tabular-nums; }
.stat-k { font-size: var(--t-ui); color: var(--muted); margin-top: 4px; }
.citebox { background: var(--card); border: 1px solid var(--hair); border-radius: 14px; padding: 14px 18px; }
.citebox-h { font-size: var(--t-sm); font-weight: 600; color: var(--ink); margin-bottom: 8px; }
.citebox-t { font-size: var(--t-sm); line-height: 1.6; color: var(--body); overflow-wrap: anywhere; }

/* ---- table of contents (rail) ------------------------------------------ */

.toc-h { font-size: var(--t-md); font-weight: 600; color: var(--ink); margin-bottom: 10px; }
.toc { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; font-size: var(--t-ui); line-height: 1.4; color: var(--body); }
.toc li a { display: flex; gap: 10px; align-items: baseline; padding: 6px 8px; margin: 0 -8px; border-radius: 8px; }
.toc li a:hover { background: var(--tint-3); color: var(--ink); }
.toc .n { font-size: var(--t-xs); font-weight: 600; color: var(--hint); width: 16px; flex: 0 0 auto; text-align: right; font-variant-numeric: tabular-nums; }
.toc li.on a { background: var(--cobalt-soft); color: var(--cobalt-ink); font-weight: 600; }
.toc li.on .n { color: var(--cobalt-ink); }

/* ---- reading-page header ----------------------------------------------- */

.kicker { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; font-size: var(--t-xs); color: var(--muted); font-weight: 500; font-variant-numeric: tabular-nums; }
.h-display { font-size: var(--t-display); line-height: 1.08; font-weight: 500; letter-spacing: -.025em; margin: 14px 0 18px; max-width: 24ch; }
.h-page { font-size: var(--t-h2); line-height: 1.15; font-weight: 500; letter-spacing: -.02em; margin: 0; max-width: 900px; }
.lede { font-size: var(--t-md); line-height: 1.5; color: var(--ink-2); margin: 10px 0 0; max-width: 80ch; }
.dek { font-size: var(--t-lede); line-height: 1.45; font-weight: 400; color: var(--body); letter-spacing: -.005em; margin: 0 0 26px; }
.byline { font-size: var(--t-sm); color: var(--muted); display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.byline .who { color: var(--ink); font-weight: 600; font-size: var(--t-ui); margin-right: 6px; }
.based { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 16px; }
.based-l { flex-basis: 100%; font-size: var(--t-sm); font-weight: 600; color: var(--muted); }
.based > span:not(.based-l) { font-size: var(--t-ui); color: var(--body); }
.based a, .src-pill { display: inline-flex; align-items: baseline; gap: 8px; padding: 6px 12px; border-radius: 10px; background: var(--green-bg); color: var(--green-ink); font-size: var(--t-ui); font-weight: 500; line-height: 1.4; max-width: 100%; }
.based a:hover, .src-pill:hover { background: var(--green-hover); color: var(--green-ink); }
.pair-note { margin: 0 0 18px; padding: 10px 14px; border-radius: 10px; background: var(--violet-bg); font-size: var(--t-sm); line-height: 1.5; color: var(--violet-ink); }
.pair-note a { color: var(--violet-ink); border-bottom: 1px solid var(--violet-ink); }
.aside-box { margin: 0 0 24px; padding: 14px 18px; border-radius: 12px; background: var(--tint-2); font-size: var(--t-md); line-height: 1.6; color: var(--body); }
.aside-box strong { font-weight: 600; color: var(--ink); }
.aside-box.thesis { border-radius: 10px; margin-bottom: 32px; }
.thread { margin-top: 40px; padding: 22px 26px 10px; border-radius: 14px; background: var(--card); border: 1px solid var(--hair); font-family: var(--sans); color: var(--body); }
.thread h2 { font-family: var(--sans); font-size: var(--t-body); font-weight: 600; letter-spacing: -.01em; margin: 0 0 6px; color: var(--ink); }
.thread > p { margin: 0 0 12px; font-size: var(--t-ui); line-height: 1.55; }
.thread-r { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 10px 16px; padding: 14px 0; border-top: 1px solid var(--hair); }
.thread-b { flex: 1 1 320px; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.thread-h { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.thread-t { font-size: var(--t-md); font-weight: 600; color: var(--ink); line-height: 1.4; }
.thread-d { font-size: var(--t-ui); line-height: 1.55; }
.thread-p summary { cursor: pointer; font-size: var(--t-sm); color: var(--cobalt); }
.thread-p pre { white-space: pre-wrap; font-size: var(--t-sm); line-height: 1.5; margin: 8px 0 0; padding: 12px; border-radius: 8px; background: var(--paper); }
.thread-none { flex: none; font-size: var(--t-sm); color: var(--muted); }
.withdrawn { margin: 0 0 18px; padding: 10px 14px; border-radius: 10px; background: #f3e9d4; font-family: var(--sans); font-size: var(--t-sm); line-height: 1.5; color: #6b4e14; }
.withdrawn strong { font-weight: 600; }

/* ---- the article body --------------------------------------------------- */

.prose { font-size: var(--t-read); line-height: 1.7; color: var(--ink); }
.prose p { margin: 0 0 20px; }
.prose p.open { margin: 0 0 28px; font-size: var(--t-lg); line-height: 1.6; }
.prose h2 { font-size: var(--t-xl); font-weight: 600; letter-spacing: -.018em; line-height: 1.25; margin: 48px 0 14px; scroll-margin-top: 80px; }
.prose h2:first-child { margin-top: 0; }
.prose h2 .num { color: var(--brick); margin-right: 10px; font-variant-numeric: tabular-nums; }
.prose h3 { font-size: var(--t-body); font-weight: 600; margin: 26px 0 8px; }
.prose ul, .prose ol { margin: 0 0 20px; padding-left: 22px; }
.prose li { margin: 0 0 8px; }
.prose a.doc { color: var(--ink); border-bottom: 1px solid var(--rule); }
.prose strong { font-weight: 600; }
/* The author's own words carry a faint brick dotted line and the quoted words
   a green wash: still told apart at a glance, no longer the loudest thing on
   the page. The receipt after a quote is a small outlined tag. */
.own { text-decoration: underline dotted rgba(176, 64, 44, .45); text-decoration-thickness: 1px; text-underline-offset: 5px; }
mark.q { background: rgba(47, 125, 82, .11); color: inherit; padding: 1px 2px; margin: 0 -2px; border-radius: 4px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
mark.q.bad { background: #fbe0dc; text-decoration: underline wavy #c0392b; text-underline-offset: 3px; }
a.rc { display: inline-flex; align-items: center; margin-left: 4px; padding: 0 6px; border-radius: 6px; border: 1px solid var(--green-line); background: var(--card); color: var(--green-ink); font-size: var(--t-xs); font-weight: 500; line-height: 16px; vertical-align: 2px; white-space: nowrap; }
a.rc:hover { background: var(--green-bg); border-color: var(--green-line); color: var(--green-ink); }
.objection { margin: 10px 0 22px; padding: 16px 20px; border-radius: 12px; background: var(--clay-wash); }
.objection-h { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; }
.objection-h .pill { background: #f6dccd; color: var(--clay-ink); }
.objection-h strong { font-size: var(--t-md); font-weight: 600; color: var(--ink); }
.objection-b { font-size: var(--t-body); line-height: 1.6; color: var(--body); }
.objection-b p { margin: 0 0 10px; }
.objection-b p:last-child { margin: 0; }
.tbl { margin: 6px 0 24px; }
.tbl-wrap { overflow-x: auto; border: 1px solid var(--hair); border-radius: 12px; background: var(--card); }
.tbl table { width: 100%; border-collapse: collapse; font-size: var(--t-ui); line-height: 1.5; }
.tbl th { text-align: left; font-weight: 600; padding: 10px 14px; border-bottom: 1px solid var(--rule); color: var(--ink); background: var(--tint-2); }
.tbl td { padding: 9px 14px; border-bottom: 1px solid var(--hair-2); vertical-align: top; color: var(--body); }
.tbl tr:last-child td { border-bottom: 0; }
.tbl figcaption { margin-top: 8px; font-size: var(--t-ui); line-height: 1.5; color: var(--ink-2); }
.chart { margin: 14px 0 26px; padding: 20px 22px; border-radius: 14px; background: var(--card); border: 1px solid var(--hair); }
.chart figcaption { font-size: var(--t-md); font-weight: 600; color: var(--ink); margin-bottom: 14px; }
.bars { display: flex; flex-direction: column; gap: 12px; }
.bar { display: grid; grid-template-columns: minmax(110px, 190px) minmax(0, 1fr) auto; gap: 6px 12px; align-items: center; font-size: var(--t-ui); }
.bar-l { color: var(--body); }
.bar-t { height: 12px; border-radius: 999px; background: var(--tint); overflow: hidden; }
.bar-t span { display: block; height: 100%; border-radius: 999px; }
.bar-v { font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; min-width: 44px; text-align: right; }
.chart-note { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-top: 14px; font-size: var(--t-xs); color: var(--hint); }
.chart-note a.rc { margin-left: 0; line-height: 20px; vertical-align: 0; padding: 0 8px; }
.names { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 12px; margin: 0 0 28px; }
.name-card { background: var(--card); border: 1px solid var(--hair); border-radius: 14px; padding: 16px 20px; }
.names.green { margin-bottom: 32px; }
.names.green .name-card { background: #eef6f0; border-color: transparent; padding: 16px 18px; }
.name-l { font-family: var(--sans); font-size: var(--t-xs); font-weight: 500; color: var(--muted); margin-bottom: 6px; }
.names.green .name-l { color: #1f5e36; font-weight: 600; }
.name-n { font-size: var(--t-lg); font-weight: 500; letter-spacing: -.015em; margin-bottom: 8px; color: var(--ink); }
.name-d { font-size: var(--t-body); line-height: 1.55; }
.name-f { font-family: var(--sans); font-size: var(--t-sm); color: var(--muted); margin-top: 8px; }
.pull { margin: 36px 0 8px; padding: 26px 30px; border-radius: 14px; background: var(--cobalt-soft); }
.pull blockquote { margin: 0; font-size: var(--t-quote); line-height: 1.35; letter-spacing: -.015em; font-weight: 500; color: var(--ink); }
.pull figcaption { margin-top: 12px; font-size: var(--t-sm); color: var(--cobalt); }
.pull figcaption a.rc { margin-left: 0; }

/* ---- papers ------------------------------------------------------------- */

.inshort { margin: 0 0 36px; padding: 20px 24px; border-radius: 14px; background: #eef3fb; font-size: var(--t-read); line-height: 1.6; color: var(--ink); scroll-margin-top: 80px; }
.inshort-h { font-size: var(--t-sm); font-weight: 600; color: var(--cobalt-ink); margin-bottom: 8px; }
.inshort p { margin: 0 0 12px; }
.inshort p:last-child { margin: 0; }
.pbody h2 { font-size: var(--t-xl); font-weight: 600; letter-spacing: -.018em; line-height: 1.25; margin: 48px 0 14px; padding-top: 28px; border-top: 1px solid var(--hair); scroll-margin-top: 80px; display: flex; align-items: baseline; gap: 12px; }
.pbody h2 .badge { color: var(--brick); font-variant-numeric: tabular-nums; }
.pbody h3 { font-size: var(--t-body); font-weight: 600; letter-spacing: -.01em; margin: 28px 0 8px; }
.pbody blockquote { margin: 6px 0 20px; padding: 12px 18px; border-radius: 12px; background: var(--tint-2); }
.pbody a { border-bottom: 1px solid var(--green); }
.pbody .tbl th { background: var(--tint); border-bottom: 1px solid var(--hair); vertical-align: bottom; }
.pbody .tbl td { border-bottom: 1px solid var(--hair); }
.series { min-width: 0; background: var(--card); border: 1px solid var(--hair); border-radius: 14px; padding: 14px 16px; }
.series-h { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.series-h > span:first-child { font-size: var(--t-md); font-weight: 600; color: var(--ink); }
.series ol { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; font-size: var(--t-md); line-height: 1.35; }
.series li > a, .series li.on { display: block; padding: 8px 10px; margin: 0 -10px; border-radius: 10px; color: var(--ink); }
.series li > a:hover { background: var(--tint-3); color: var(--ink); }
.series .t { display: block; font-weight: 500; }
.series .s { display: block; font-size: var(--t-ui); color: var(--muted); margin-top: 2px; }
.series li.on { background: var(--violet-bg); }
.series li.on .t { color: var(--violet-ink); font-weight: 600; }
.series li.on .s { color: var(--violet-ink); opacity: .8; }

/* ---- after the body ------------------------------------------------------ */

.panel { margin-top: 40px; padding: 22px 26px; border-radius: 14px; background: var(--card); border: 1px solid var(--hair); color: var(--body); }
.panel h2 { margin: 0; font-size: var(--t-read); font-weight: 600; letter-spacing: -.01em; color: var(--ink); }
.panel p { margin: 6px 0 14px; font-size: var(--t-md); line-height: 1.55; color: var(--ink-2); }
.panel.cols { padding: 24px 26px; display: flex; flex-direction: column; gap: 24px; }
.panel h3 { font-size: var(--t-body); font-weight: 600; letter-spacing: -.01em; margin: 0 0 10px; color: var(--ink); }
.src-name { padding: 4px 11px; border-radius: 999px; background: var(--tint); color: var(--ink); font-size: var(--t-ui); line-height: 1.4; }
.src-list { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.src-list .src-pill { padding: 8px 14px; font-size: var(--t-md); }
.cite-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border-radius: 10px; background: var(--tint-2); }
.cite-t { flex: 1 1 0%; min-width: 0; font-size: var(--t-md); line-height: 1.55; color: var(--ink); overflow-wrap: anywhere; }
.form-row { margin: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.form-links { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: var(--t-ui); }

/* ---- the front page --------------------------------------------------------- */

.ser { margin-top: 8px; border-radius: 16px; background: var(--card); border: 1px solid var(--hair); overflow: hidden; }
.ser-head { padding: 30px 28px 26px; background: #f6f0fa; border-bottom: 1px solid #e8dff0; }
.ser-h { font-size: var(--t-h1); line-height: 1.12; font-weight: 500; letter-spacing: -.02em; margin: 0; max-width: 30ch; color: var(--ink); }
.ser-p { font-size: var(--t-body); line-height: 1.55; color: var(--body); margin: 12px 0 0; max-width: 66ch; }
a.ser-row { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; gap: 4px 18px; padding: 16px 28px; border-top: 1px solid var(--hair-2); align-items: baseline; }
a.ser-row.first { border-top: 0; }
a.ser-row:hover { background: #faf6fc; color: var(--ink); }
.ser-n { font-size: var(--t-lg); font-weight: 500; letter-spacing: -.02em; color: #7a52a8; font-variant-numeric: tabular-nums; }
.ser-t { display: block; font-size: var(--t-lg); line-height: 1.25; font-weight: 500; letter-spacing: -.014em; color: var(--ink); }
.ser-d { display: block; margin-top: 3px; font-size: var(--t-ui); line-height: 1.5; color: var(--ink-2); }
.ser-r { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.ser-m { font-size: var(--t-sm); color: var(--ink-2); white-space: nowrap; font-variant-numeric: tabular-nums; }
.ser-foot { margin: 0; padding: 14px 28px 16px; border-top: 1px solid var(--hair-2); font-size: var(--t-sm); line-height: 1.5; color: var(--ink-2); }
a.row.rrow { grid-template-columns: 56px minmax(0, 1fr); gap: 4px 16px; }
.rrow-d { font-size: var(--t-md); font-weight: 500; color: var(--ink); white-space: nowrap; }
.rrow-t { display: block; font-size: var(--t-body); line-height: 1.3; font-weight: 500; letter-spacing: -.012em; color: var(--ink); }
.checkable { padding: 28px 32px; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 24px 48px; align-items: center; }
.checkable-l { font-size: var(--t-md); line-height: 1.6; color: var(--body); max-width: 60ch; }
.checkable-l strong { display: block; font-size: var(--t-body); font-weight: 600; color: var(--ink); margin-bottom: 8px; }
.checkable-r { display: flex; flex-direction: column; gap: 10px; min-width: 0; justify-self: stretch; }

/* ---- topic pages ------------------------------------------------------------ */

.h-topic { font-size: var(--t-display); line-height: 1.08; font-weight: 500; letter-spacing: -.025em; margin: 14px 0 16px; }
.topic-note { font-size: var(--t-lede); line-height: 1.5; color: var(--body); margin: 0 0 18px; max-width: 62ch; }
.tsec { margin-bottom: 48px; scroll-margin-top: 80px; }
.works-p { font-size: var(--t-ui); line-height: 1.5; color: var(--ink-2); margin: 0 0 14px; max-width: 62ch; }
.work { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 4px 16px; padding: 14px 22px; background: var(--card); align-items: baseline; }
.work-y { font-size: var(--t-body); font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
.work-b { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.work-t { font-size: var(--t-body); line-height: 1.4; color: var(--ink); }
.work-t span { color: var(--ink-2); }
.work-doc { display: inline-block; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 3px 10px; border-radius: 999px; background: var(--tint); color: var(--ink); font-size: var(--t-sm); font-weight: 500; }
.work-doc:hover { background: #e6e0d2; color: var(--ink); }
.facts { display: flex; flex-direction: column; padding: 4px 18px; border: 1px solid var(--hair); border-radius: 14px; background: var(--card); }
.facts > a, .facts > div { display: flex; justify-content: space-between; gap: 16px; padding: 11px 0; border-bottom: 1px solid var(--hair-2); align-items: baseline; font-size: var(--t-ui); }
.facts > :last-child { border-bottom: 0; }
.facts > * > span:first-child { color: var(--ink-2); }
.facts .v { color: var(--ink); font-weight: 500; font-variant-numeric: tabular-nums; }
.facts > a:hover span:first-child { color: var(--cobalt); }

/* ---- concepts and open problems ------------------------------------------------ */

.idea-wrap { display: flex; flex-wrap: wrap; gap: 40px 56px; align-items: flex-start; }
.idea-col { flex: 999 1 520px; min-width: 0; max-width: 760px; }
.idea-def { border-radius: 14px; padding: 24px 28px 22px; }
.idea-def.concept { background: var(--green-wash); }
.idea-def.problem { background: var(--clay-wash); }
.idea-def-h { font-size: var(--t-sm); font-weight: 600; margin-bottom: 10px; }
.idea-def.concept .idea-def-h { color: var(--green-ink); }
.idea-def.problem .idea-def-h { color: var(--clay-ink); }
.idea-def p { font-size: var(--t-quote); line-height: 1.45; margin: 0; letter-spacing: -.01em; color: var(--ink); }
.idea-more { margin-top: 48px; font-size: var(--t-lg); font-weight: 600; letter-spacing: -.015em; color: var(--ink); border-bottom: 1px solid var(--rule); padding-bottom: 10px; }

/* ---- ideas ------------------------------------------------------------------ */

.ilist { display: flex; flex-direction: column; background: var(--card); border: 1px solid var(--hair); border-radius: 14px; padding: 0 24px; margin-top: 16px; }
a.irow { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; padding: 18px 14px; margin: 0 -14px; border-radius: 10px; border-bottom: 1px solid var(--hair); }
a.irow.last { border-bottom: 0; }
a.irow:hover { background: var(--tint); color: var(--ink); }
.irow-t { font-size: var(--t-lg); line-height: 1.25; font-weight: 500; letter-spacing: -.015em; color: var(--ink); }
.irow-d { font-size: var(--t-md); line-height: 1.5; color: var(--body); max-width: 68ch; }
.irow-m { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 4px; font-size: var(--t-xs); color: var(--hint); }

/* ---- search ------------------------------------------------------------------ */

.s-wrap { display: flex; flex-wrap: wrap; gap: 40px 56px; align-items: flex-start; max-width: 1120px; padding-top: 8px; }
.s-col { flex: 999 1 480px; min-width: 0; max-width: 760px; }
.s-rail { flex: 1 1 260px; min-width: 0; display: flex; flex-direction: column; gap: 20px; position: sticky; top: 76px; align-self: flex-start; }
.h-search { font-size: var(--t-h2); line-height: 1.1; font-weight: 500; letter-spacing: -.025em; margin: 0 0 18px; }
.sbox { display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 18px; border: 1px solid var(--rule); border-radius: 14px; background: var(--card); }
.sbox:focus-within { border-color: var(--cobalt); outline: var(--halo); }
.sbox input { flex: 1 1 0%; min-width: 0; border: 0; background: transparent; font: inherit; font-size: var(--t-lg); color: var(--ink); outline: none; }
.s-note { margin: 10px 0 0; font-size: var(--t-ui); line-height: 1.5; color: var(--ink-2); }
.seg.s-tabs { margin-top: 22px; }
.seg.s-tabs a { height: 32px; padding: 0 13px; color: var(--ink); }
.seg.s-tabs a[aria-current="true"] { outline: 0; }
.seg.s-tabs a .n { padding: 1px 7px; background: var(--cobalt-soft); color: var(--cobalt); font-weight: 600; }
.s-t { font-size: var(--t-body); line-height: 1.45; font-weight: 500; color: var(--ink); overflow-wrap: anywhere; }
.s-p { font-size: var(--t-body); line-height: 1.45; font-weight: 400; color: var(--ink); overflow-wrap: anywhere; }
.s-pill { max-width: 100%; overflow: hidden; text-overflow: ellipsis; padding: 2px 8px; }
a.facet { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; border: 1px solid; font-size: var(--t-sm); font-weight: 500; }
a.facet span { font-size: var(--t-xs); opacity: .8; }
a.facet:hover { filter: brightness(.96); }

/* ---- follow ------------------------------------------------------------------ */

.f-wrap { display: flex; flex-wrap: wrap; gap: 40px 56px; margin-top: 8px; align-items: flex-start; }
.f-col { flex: 999 1 520px; min-width: 0; max-width: 740px; }
.f-lede { font-size: var(--t-body); line-height: 1.6; color: var(--body); margin: 14px 0 26px; max-width: 58ch; }
.f-form { margin: 0; }
.f-label { display: block; font-size: var(--t-ui); font-weight: 600; color: var(--ink); margin-bottom: 8px; }
.f-field { flex: 1 1 240px; height: 46px; padding: 0 16px; font-size: var(--t-body); }
.f-btn { height: 46px; padding: 0 18px; font-size: var(--t-md); }
.f-consent { margin: 12px 0 0; font-size: var(--t-ui); line-height: 1.55; color: var(--ink-2); max-width: 60ch; }
.f-error { margin: 0 0 12px; padding: 10px 14px; border-radius: 10px; background: var(--clay-bg); color: var(--clay-ink); font-size: var(--t-ui); }
.f-sent { display: flex; align-items: flex-start; gap: 12px; max-width: 560px; padding: 14px 16px; border-radius: 12px; background: var(--green-bg); color: var(--green-ink); font-size: var(--t-md); line-height: 1.5; }
.f-sent span { flex: 1; min-width: 0; }
.f-change { font-size: var(--t-ui); color: var(--green-ink); border-bottom: 1px solid var(--green-ink); white-space: nowrap; }
.f-h2 { font-size: var(--t-read); font-weight: 600; letter-spacing: -.01em; margin: 44px 0 10px; }
.f-h2 span { font-weight: 400; color: var(--ink-2); }
.f-sub { margin: -6px 0 12px; font-size: var(--t-ui); line-height: 1.55; color: var(--ink-2); }
.f-preview, .f-topics { background: var(--card); border: 1px solid var(--hair); border-radius: 14px; overflow: hidden; }
.f-preview a { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 16px; padding: 14px 18px; align-items: baseline; }
.f-preview a.b { border-top: 1px solid var(--hair-2); }
.f-preview a:hover { background: var(--tint-3); color: var(--ink); }
.f-pv { min-width: 0; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.f-pt { font-size: var(--t-body); line-height: 1.3; font-weight: 500; letter-spacing: -.01em; color: var(--ink); }
.f-pd { font-size: var(--t-ui); color: var(--ink-2); white-space: nowrap; font-variant-numeric: tabular-nums; }
.f-topic { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; gap: 16px; align-items: center; padding: 14px 18px; border-top: 1px solid var(--hair-2); cursor: pointer; position: relative; }
.f-topics > .f-topic:first-child { border-top: 0; }
.f-topic input { position: absolute; opacity: 0; width: 1px; height: 1px; margin: 0; }
.f-box { width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid var(--rule); background: var(--card); display: inline-flex; align-items: center; justify-content: center; color: var(--card); font-size: var(--t-sm); font-weight: 700; transition: background-color .15s, border-color .15s; }
.f-topic input:checked + .f-box, .f-topics:has([data-everything]:checked) .f-box { background: var(--fill, var(--ink)); border-color: var(--fill, var(--ink)); }
.f-topic input:checked + .f-box::after, .f-topics:has([data-everything]:checked) .f-box::after { content: "\\2713"; }
.f-topic input:focus-visible + .f-box { outline: 2px solid var(--cobalt); outline-offset: 3px; }
.f-tb { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.f-ts { font-size: var(--t-ui); line-height: 1.45; color: var(--ink-2); }
.f-rss { padding: 3px 10px; border-radius: 999px; background: #f3e9d4; color: #6b4e14; font-size: var(--t-xs); font-weight: 500; white-space: nowrap; }
.f-rss:hover { filter: brightness(.96); color: #6b4e14; }
.f-or { padding: 12px 18px 6px; border-top: 1px solid var(--hair); font-size: var(--t-sm); font-weight: 600; color: var(--ink); background: #f8f5ee; }
.f-rail { flex: 1 1 300px; min-width: 0; display: flex; flex-direction: column; gap: 14px; position: sticky; top: 72px; align-self: flex-start; }
.f-card { padding: 22px 24px; }
.f-card h2 { margin: 0; font-size: var(--t-body); font-weight: 600; color: var(--ink); }
.f-card p { margin: 6px 0 12px; font-size: var(--t-ui); line-height: 1.55; color: var(--ink-2); }
.f-code { font-family: var(--mono); font-size: var(--t-sm); }

/* ---- admin ------------------------------------------------------------------ */

/* ---- the workspace (/admin/write) -------------------------------------- */

.main.ws-main { max-width: none; padding: 0; }
.ws { display: flex; flex-direction: column; min-height: calc(100vh - 56px); }
.ws-panes { flex: 1; display: flex; align-items: stretch; min-height: 0; height: calc(100vh - 124px); min-height: 520px; }
.ws-top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; padding: 12px 20px; border-bottom: 1px solid var(--hair); background: var(--paper); }
.ws-back { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; color: var(--ink-2); font-size: var(--t-lg); line-height: 1; }
.ws-back:hover { background: var(--tint); color: var(--ink); }
.ws-titles { flex: 1 1 320px; min-width: 0; }
.ws-line { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; margin-top: 2px; font-size: var(--t-sm); color: var(--muted); }
.ws-line strong { color: var(--ink); font-weight: 600; }
.ws-warn { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; padding: 8px 20px; background: var(--clay-wash); border-bottom: 1px solid var(--clay-line); color: var(--clay-ink); font-size: var(--t-ui); line-height: 1.45; }
.ws-warn strong { font-weight: 600; }
.ws-warn-t { min-width: 0; overflow-wrap: anywhere; }
.ws-warn-more summary { cursor: pointer; font-size: var(--t-sm); font-weight: 600; }
.ws-warn-more ul { margin: 4px 0 2px; padding-left: 18px; }
.ws-note { padding: 7px 20px; border-bottom: 1px solid var(--hair); background: var(--tint-3); font-size: var(--t-sm); color: var(--ink-2); }
.ws-note summary { cursor: pointer; font-weight: 600; color: var(--ink); }
.ws-note ul { margin: 6px 0 2px; padding-left: 18px; line-height: 1.5; }
.ws-chat { flex: 0 0 400px; display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; border-right: 1px solid var(--hair); background: var(--paper); }
.ws-title { font-size: var(--t-body); font-weight: 600; letter-spacing: -.01em; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-log { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 20px 20px 14px 24px; display: flex; flex-direction: column; gap: 12px; }
.ws-hello { color: var(--muted); font-size: var(--t-ui); line-height: 1.55; }
.ws-msg { white-space: pre-line; font-size: var(--t-ui); line-height: 1.55; padding: 10px 12px; border-radius: 12px; max-width: 100%; overflow-wrap: anywhere; }
.ws-msg.you { align-self: flex-end; background: var(--cobalt-soft); color: var(--ink); max-width: 88%; border-radius: 14px 14px 4px 14px; padding: 10px 14px; }
.ws-msg.claude { padding: 0 2px; background: transparent; color: var(--body); }
.ws-act { font-size: var(--t-sm); color: var(--muted); padding-left: 2px; overflow-wrap: anywhere; }
.ws-act.live { color: var(--cobalt); }
.ws-act.bad { color: var(--brick); }
.ws-form { margin: 0 12px 12px 16px; padding: 10px 12px 10px 14px; border: 1px solid var(--rule); border-radius: 14px; background: var(--card); display: flex; flex-direction: column; gap: 8px; }
.ws-form:focus-within { border-color: var(--cobalt-line); outline: var(--halo); }
.ws-form textarea { width: 100%; resize: none; min-height: 64px; font: inherit; font-size: var(--t-md); line-height: 1.5; padding: 4px 0; border: 0; background: transparent; color: var(--ink); box-sizing: border-box; }
.ws-form textarea:focus-visible { outline: none; }
.ws-prog { margin: 0 12px 8px 16px; padding: 10px 12px; border: 1px solid var(--cobalt-line); border-radius: 12px; background: var(--cobalt-soft); display: flex; flex-direction: column; gap: 8px; font-size: var(--t-sm); color: var(--cobalt-ink); }
.ws-prog[hidden], .ws-stages[hidden] { display: none; }
.ws-stages { display: flex; flex-wrap: wrap; gap: 4px; margin: 0; padding: 0; list-style: none; }
.ws-stages li { padding: 2px 8px; border-radius: 999px; background: var(--card); color: var(--muted); font-size: var(--t-xs); font-weight: 500; }
.ws-stages li.done { color: var(--green-ink); }
.ws-stages li.done::before { content: "✓ "; }
.ws-stages li.now { background: var(--cobalt); color: var(--card); font-weight: 600; }
.ws-prog-l { line-height: 1.45; color: var(--ink); font-variant-numeric: tabular-nums; }
.ws-prog-f { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
.ws-clock { font-family: var(--mono); font-size: var(--t-sm); font-weight: 500; }
.ws-typ { color: var(--muted); }
.ws-prog-f .stop { margin-left: auto; }
.ws-prog-f [hidden] { display: none; }
.ws-steps { font-size: var(--t-sm); color: var(--muted); }
.ws-steps > summary { list-style: none; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; cursor: pointer; padding-left: 2px; }
.ws-steps > summary::-webkit-details-marker { display: none; }
.ws-steps-p { display: inline-flex; align-items: center; height: 20px; padding: 0 7px; border-radius: 999px; border: 1px solid var(--rule); background: var(--card); color: var(--ink-2); font-size: var(--t-xs); font-weight: 500; }
.ws-steps[open] .ws-steps-p, .ws-steps > summary:hover .ws-steps-p { background: var(--cobalt-soft); border-color: var(--cobalt-line); color: var(--cobalt-ink); }
.ws-steps-l { display: flex; flex-direction: column; gap: 4px; margin: 6px 0 2px 6px; padding-left: 10px; border-left: 2px solid var(--hair); }
.ws-done { padding: 12px 14px; border: 1px solid var(--green-line); border-radius: 12px; background: var(--green-wash); display: flex; flex-direction: column; gap: 6px; }
.ws-done.partial { border-color: var(--rule); background: var(--tint-3); }
.ws-done-h { font-size: var(--t-ui); font-weight: 600; color: var(--green-ink); }
.ws-done.partial .ws-done-h { color: var(--ink); }
.ws-done-n { font-size: var(--t-sm); line-height: 1.5; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.ws-done-a { display: flex; flex-wrap: wrap; gap: 6px; }
.ws-done-a:empty { display: none; }
.ws-done-a form { margin: 0; }
.ws-tips { display: flex; flex-direction: column; gap: 2px; padding-bottom: 6px; border-bottom: 1px solid var(--hair); }
.ws-tips[hidden] { display: none; }
.ws-tip { appearance: none; margin: 0; border: 0; background: none; padding: 3px 4px; border-radius: 6px; font: inherit; font-size: var(--t-sm); text-align: left; color: var(--ink-2); cursor: pointer; }
.ws-tip:hover { background: var(--tint); color: var(--ink); }
.ws-actions { display: flex; align-items: center; gap: 8px; }
.ws-actions .btn.primary { margin-left: auto; }
.ws-cost { font-size: var(--t-sm); color: var(--muted); font-variant-numeric: tabular-nums; }
.ws-flag { display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; border-radius: 10px; background: var(--cobalt-soft); font-size: var(--t-sm); line-height: 1.45; }
.ws-flag[hidden] { display: none; }
.ws-flag-l { font-weight: 600; color: var(--cobalt-ink); flex: none; }
.ws-flag-t { flex: 1; color: var(--body); }
.ws-flag-x { appearance: none; border: 0; background: none; cursor: pointer; font-size: var(--t-body); line-height: 1; color: var(--muted); padding: 0 2px; }
.ws-page { flex: 1; display: flex; flex-direction: column; min-width: 0; padding: 10px 16px 16px; background: var(--tint); }
.ws-path { display: flex; align-items: center; gap: 4px 10px; min-height: 34px; padding: 0 4px 10px; font-size: var(--t-sm); color: var(--muted); }
.ws-path > span:not(.ws-path-r) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 0 1 auto; min-width: 0; }
.ws-path code { flex: 0 1 auto; min-width: 60px; padding: 3px 8px; border-radius: 7px; background: var(--card); border: 1px solid var(--hair); font-family: var(--mono); font-size: var(--t-xs); color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ws-path-r { flex: none; margin-left: auto; white-space: nowrap; }
.ws-path-r:not(:has(a)) { padding: 3px 9px; border-radius: 999px; background: var(--tint-2); color: var(--ink-2); font-size: var(--t-xs); font-weight: 500; }
.ws-sheet { flex: 1; display: flex; min-height: 0; border: 1px solid var(--hair); border-radius: 16px; overflow: hidden; background: var(--paper); }
.ws-check { color: var(--muted); }
.ws-check.ok { color: var(--green-ink); }
.ws-check.bad { color: var(--brick); font-weight: 600; }
.ws-route { font-size: var(--t-sm); color: var(--muted); }
.ws-new { display: flex; flex-wrap: wrap; align-items: end; gap: 10px; margin: 20px 0 6px; }
.ws-new form { margin: 0; }
.ws-eng { display: flex; flex-direction: column; gap: 4px; font-size: var(--t-sm); color: var(--muted); flex: 1 1 320px; min-width: 0; }
.ws-eng select { font: inherit; font-size: var(--t-ui); color: var(--ink); padding: 9px 10px; border: 1px solid var(--hair); border-radius: 8px; background: var(--card); max-width: 100%; }
.ws-eng-note { margin: 0 0 24px; font-size: var(--t-sm); color: var(--muted); }
.ws-files { display: flex; flex-wrap: wrap; gap: 6px; }
.ws-files[hidden] { display: none; }
.ws-file { padding: 3px 10px; border-radius: 999px; background: var(--green-bg); color: var(--green-ink); font-size: var(--t-sm); }
.ws-file.bad { background: var(--clay-bg); color: var(--clay-ink); }
.ws-chat.drop { outline: 2px dashed var(--cobalt); outline-offset: -6px; }
.ws-prop { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 12px; border: 1px solid var(--green-bg); background: var(--green-wash); margin: 0; }
.ws-prop-h { display: flex; align-items: center; gap: 8px; font-size: var(--t-sm); color: var(--muted); }
.ws-prop-t { font: inherit; font-size: var(--t-md); font-weight: 600; padding: 6px 8px; border: 1px solid var(--rule); border-radius: 8px; background: var(--card); color: var(--ink); }
.ws-prop-b { font: inherit; font-size: var(--t-ui); line-height: 1.5; padding: 8px; border: 1px solid var(--rule); border-radius: 8px; background: var(--card); color: var(--body); resize: vertical; }
.ws-prop-q { margin: 0; padding: 6px 10px; border-left: 3px solid var(--green); font-size: var(--t-sm); line-height: 1.5; color: var(--body); background: var(--card); border-radius: 0 6px 6px 0; }
.ws-prop-fig { font-size: var(--t-md); }
.ws-prop-a { display: flex; gap: 8px; }
.ws-prop-done { font-size: var(--t-sm); color: var(--green-ink); }
.ws-prop.dismissed { background: var(--tint-3); border-color: var(--hair); }
.ws-prop.dismissed .ws-prop-done { color: var(--muted); }
.ws-pub { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; font-size: var(--t-sm); }
.ws-pubform { margin: 0; }
.btn[disabled], .d-btn[disabled], .chipb[disabled] { opacity: .45; cursor: not-allowed; }
.ws-upd { padding: 2px 0 2px 10px; border-left: 2px solid var(--hair); font-size: var(--t-sm); line-height: 1.5; color: var(--ink-2); font-style: italic; }
.cl { max-width: 760px; }
.cl-status { margin: 0 0 16px; padding: 12px 16px; border-radius: 12px; font-size: var(--t-md); background: var(--clay-wash); color: var(--clay-ink); }
.cl-status.on { background: var(--green-wash); color: var(--green-ink); }
.cl-result { margin: 0 0 16px; padding: 12px 16px; border-radius: 12px; font-size: var(--t-ui); line-height: 1.5; overflow-wrap: anywhere; }
.cl-result.ok { background: var(--green-bg); color: var(--green-ink); }
.cl-result.bad { background: var(--clay-bg); color: var(--clay-ink); }
.cl-test { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 0 0 28px; }
.cl-note { font-size: var(--t-sm); color: var(--muted); }
.cl-h { margin: 28px 0 10px; font-size: var(--t-body); font-weight: 600; }
.cl-list { list-style: none; margin: 0; padding: 0; }
.cl-row { display: flex; gap: 12px; padding: 10px 0; border-top: 1px solid var(--hair); font-size: var(--t-ui); line-height: 1.45; }
.cl-mark { flex: 0 0 22px; height: 22px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: var(--tint); color: var(--muted); font-weight: 700; }
.cl-mark.on { background: var(--green-bg); color: var(--green-ink); }
.cl-state { font-size: var(--t-sm); color: var(--muted); margin-left: 6px; }
.cl-what { display: block; font-size: var(--t-sm); color: var(--ink-2); }
.cl-key { margin: 0 0 24px; padding: 18px 20px; border: 1px solid var(--hair); border-radius: 14px; background: var(--card); }
.cl-key .cl-h { margin-top: 0; }
.cl-p { margin: 0 0 12px; font-size: var(--t-ui); line-height: 1.55; color: var(--body); }
.cl-keyform { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 10px; }
.cl-keyform input { flex: 1 1 260px; min-width: 0; font: inherit; font-size: var(--t-md); padding: 9px 12px; border: 1px solid var(--rule); border-radius: 10px; background: var(--paper); color: var(--ink); }
.cl-keyform input:focus { outline: 2px solid var(--cobalt); outline-offset: 1px; }
.cl-steps { margin: 0; padding-left: 20px; font-size: var(--t-ui); line-height: 1.6; color: var(--body); }
.cl-steps li { margin-bottom: 6px; }
.dread { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin: 22px 0 0; padding-top: 18px; border-top: 1px solid var(--hair); font-size: var(--t-sm); color: var(--muted); line-height: 1.45; }
.rd-body { background: var(--paper); }
.rd-main { max-width: var(--read); margin: 0 auto; padding: 32px 24px 80px; }
.rd-head { margin-bottom: 26px; }
.rd-kicker { font-size: var(--t-xs); font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.rd-head h1 { margin: 6px 0 10px; font-size: var(--t-h2); line-height: 1.2; letter-spacing: -.01em; }
.rd-receipt { font-size: var(--t-sm); color: var(--ink-2); margin-bottom: 12px; }
.rd-dropped { color: var(--brick); font-weight: 600; }
.rd-group { margin: 0 0 26px; }
.rd-group h2 { display: flex; align-items: baseline; gap: 8px; margin: 0 0 10px; font-size: var(--t-md); font-weight: 600; }
.rd-n { font-size: var(--t-sm); font-weight: 400; color: var(--muted); font-variant-numeric: tabular-nums; }
.rd-card { display: flex; flex-direction: column; gap: 8px; margin: 0 0 10px; padding: 14px 16px; border-radius: 12px; border: 1px solid var(--hair); background: var(--card); }
.rd-card.kept { border-color: var(--green-bg); background: var(--green-wash); }
.rd-h { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: var(--t-sm); color: var(--muted); }
.rd-role { padding: 1px 7px; border-radius: 999px; background: var(--tint); color: var(--ink-2); }
.rd-role.recommendation, .rd-role.premise { background: var(--clay-bg); color: var(--clay-ink); }
.rd-role.finding { background: var(--green-bg); color: var(--green-ink); }
.rd-t { font-size: var(--t-md); font-weight: 600; line-height: 1.4; color: var(--ink); }
.rd-fig { font-size: var(--t-md); line-height: 1.45; color: var(--body); }
.rd-fig strong { color: var(--ink); }
.rd-rejected { color: var(--brick); }
.rd-q { margin: 0; padding: 6px 12px; border-left: 3px solid var(--green); font-size: var(--t-ui); line-height: 1.55; color: var(--body); background: var(--paper); border-radius: 0 6px 6px 0; }
.rd-src { display: block; margin-top: 4px; font-size: var(--t-xs); color: var(--muted); }
.rd-note { font-size: var(--t-sm); color: var(--muted); }
.rd-proof { font-size: var(--t-sm); color: var(--green-ink); font-weight: 500; }
.rd-proof.thin { color: var(--clay-ink); }
.rd-more summary { cursor: pointer; font-size: var(--t-sm); color: var(--cobalt); }
.rd-more .rd-q { margin-top: 6px; }
.rd-act { display: flex; align-items: center; gap: 8px; margin: 0; }
.rd-status { font-size: var(--t-sm); color: var(--green-ink); }
.rd-status.dismissed { color: var(--muted); }
.rd-empty { color: var(--muted); font-size: var(--t-ui); }
.rd-shown { margin: 0 0 12px; padding: 8px 12px; border-radius: 8px; font-size: var(--t-sm); line-height: 1.5; background: var(--green-wash); color: var(--green-ink); }
.rd-shown.off { background: var(--tint-3); color: var(--ink-2); }
.rd-write { font-size: var(--t-sm); font-weight: 600; color: var(--cobalt); }
.rd-idea summary { cursor: pointer; font-size: var(--t-sm); font-weight: 600; color: var(--cobalt); }
.rd-idea-f { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
.rd-idea-f label { display: flex; flex-direction: column; gap: 4px; font-size: var(--t-sm); color: var(--muted); }
.rd-idea-f input, .rd-idea-f textarea, .rd-idea-f select { font: inherit; font-size: var(--t-ui); padding: 7px 9px; border: 1px solid var(--rule); border-radius: 8px; background: var(--card); color: var(--ink); }
.rd-flash { margin: 0 0 12px; padding: 8px 12px; border-radius: 8px; font-size: var(--t-sm); background: var(--green-wash); color: var(--green-ink); }
.rd-flash.bad { background: var(--clay-wash); color: var(--clay-ink); }
.shares-n { display: block; font-size: var(--t-xs); color: var(--muted); }
.shares-more { font-size: var(--t-sm); color: var(--muted); }
a.xl { color: inherit; border-bottom: 1px dotted var(--cobalt); text-decoration: none; }
a.xl:hover { color: var(--cobalt); border-bottom-style: solid; }
a.xl.concept { border-bottom-color: var(--brick); }
.ew-note { margin: -6px 0 16px; font-size: var(--t-sm); color: var(--muted); }
.ew-why { display: block; margin-top: 4px; font-size: var(--t-xs); color: var(--muted); }
.ew-m { font-weight: 400; color: var(--ink-2); }
.idea-uses { margin-bottom: 8px; }
.ev { margin-top: 44px; }
.ev-sec { margin: 0 0 36px; }
.ev-h { margin: 0 0 14px; padding-top: 16px; border-top: 1px solid var(--hair); font-size: var(--t-lg); font-weight: 600; letter-spacing: -.01em; }
.ev-item { margin: 0 0 18px; }
.ev-item > a { font-size: var(--t-sm); color: var(--green-ink); }
.ev-item > a:hover { color: var(--ink); }
.ev-t { font-size: var(--t-body); font-weight: 600; line-height: 1.4; color: var(--ink); margin-bottom: 6px; }
.ev-l { font-size: var(--t-sm); color: var(--muted); margin-bottom: 6px; }
.ev-q { margin: 0 0 4px; padding: 4px 0 4px 14px; border-left: 3px solid var(--green); font-size: var(--t-body); line-height: 1.6; color: var(--body); }
.ev-standing { display: inline-block; margin-left: 6px; padding: 0 7px; border-radius: 999px; background: var(--tint); color: var(--ink-2); font-size: var(--t-xs); font-weight: 500; vertical-align: 1px; }
.ev-l .ev-standing { margin-left: 0; }
.ev-by { color: var(--muted); }
.ev-strip { margin: 0 0 32px; font-size: var(--t-sm); line-height: 1.5; color: var(--ink-2); }
.figs + .ev-strip { margin-top: -22px; }
.ev-check { color: var(--green); font-weight: 700; }
.ev-strip a { color: var(--green-ink); }
.ws-live { color: var(--green-ink); font-weight: 600; }
.ws-uptodate { color: var(--muted); }
.ws-state { flex: none; }
.ws-flash { padding: 8px 20px; border-bottom: 1px solid var(--hair); font-size: var(--t-sm); }
.ws-flash.ok { background: var(--green-wash); color: var(--green-ink); }
.ws-flash.bad { background: var(--clay-wash); color: var(--clay-ink); }
.ws-frame { flex: 1; width: 100%; border: 0; background: var(--paper); }
.ws-nokey { margin: 12px 16px 0; padding: 10px 12px; border-radius: 10px; background: var(--clay-wash); color: var(--clay-ink); font-size: var(--t-sm); line-height: 1.5; }
.ws-list { display: flex; flex-direction: column; border-top: 1px solid var(--hair); }
.ws-row { display: flex; flex-direction: column; gap: 4px; padding: 14px 0; border-bottom: 1px solid var(--hair); color: var(--ink); }
.ws-row:hover .ws-row-t { color: var(--cobalt); }
.ws-row-t { font-size: var(--t-read); font-weight: 500; }
.ws-row-d { font-size: var(--t-ui); color: var(--body); line-height: 1.5; }
.ws-row-m { font-size: var(--t-sm); color: var(--muted); }
.ws-tabs { display: none; }
@media (max-width: 860px) {
  .ws-panes { flex-direction: column; height: auto; min-height: 0; }
  .ws-chat { flex: none; height: 70vh; border-right: 0; }
  .ws-page { height: 80vh; flex: none; padding: 8px; }
  .ws-top, .ws-warn, .ws-note, .ws-flash { padding-left: 12px; padding-right: 12px; }
  .ws-log { padding: 14px 14px 10px; }
  .ws-form { margin: 0 8px 8px; }
  /* With the page's script: two tabs, each the full height of the screen. */
  .ws.tabbed .ws-tabs { display: flex; gap: 4px; margin: 8px 12px 0; padding: 4px; border-radius: 12px; background: var(--tint); }
  .ws-tabs button { flex: 1; appearance: none; border: 0; border-radius: 9px; padding: 9px 10px; background: transparent; font: inherit; font-size: var(--t-ui); font-weight: 500; color: var(--ink-2); cursor: pointer; position: relative; }
  .ws-tabs button[aria-selected="true"] { background: var(--card); color: var(--ink); }
  .ws-tabs button.fresh::after { content: ""; position: absolute; top: 8px; right: 12px; width: 7px; height: 7px; border-radius: 999px; background: var(--cobalt); }
  .ws.tabbed .ws-chat, .ws.tabbed .ws-page { height: calc(100dvh - 190px); min-height: 420px; }
  .ws.tabbed[data-view="chat"] .ws-page, .ws.tabbed[data-view="page"] .ws-chat { display: none; }
}

.d-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.d-h1 { font-size: var(--t-h2); line-height: 1.1; font-weight: 500; letter-spacing: -.02em; margin: 0; }
.d-links { margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; font-size: var(--t-sm); }
.d-flash { margin: 16px 0 0; padding: 10px 14px; border-radius: 10px; background: var(--green-bg); color: var(--green-ink); font-size: var(--t-ui); }
.d-flash.bad { background: var(--clay-bg); color: var(--clay-ink); }

/* ---- Admin: the desk (design handoff v3) ---------------------------------
   A left column — what is in progress, the projects, and one composer — and
   the queue on the right: "Waiting for you", one card per decision, each
   with one primary action and a ⋯ menu. */
.main.desk-main { max-width: none; padding: 0; }
.desk-top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 12px 20px; border-bottom: 1px solid var(--hair); }
.desk-top h1 { margin: 0; font-size: var(--t-body); line-height: 1.2; font-weight: 600; letter-spacing: -.01em; }
.desk-line { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; margin-top: 2px; font-size: var(--t-sm); color: var(--muted); }
.desk-line strong { color: var(--ink); font-weight: 600; }
.desk-line a { color: inherit; }
.desk-line a:hover { color: var(--cobalt); }
.desk-line .on { color: var(--green-ink); }
.desk-line .off { color: var(--clay-ink); }
.desk-tools { margin-left: auto; display: flex; flex-wrap: wrap; gap: 8px; }
.desk { display: flex; align-items: stretch; min-height: calc(100vh - 124px); }
.desk-side { flex: 0 0 380px; min-width: 0; display: flex; flex-direction: column; border-right: 1px solid var(--hair); }
.desk-scroll { flex: 1; padding: 22px 20px 16px 24px; }
.desk-help { margin: 0 0 22px; font-size: var(--t-ui); line-height: 1.55; color: var(--ink-2); }
.desk-help strong { color: var(--ink); font-weight: 600; }
.desk-group { margin: 0 0 22px; }
.desk-gh { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; font-size: var(--t-xs); font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.desk-gh .btn { margin-left: auto; letter-spacing: 0; text-transform: none; }
.desk-row { display: grid; grid-template-columns: 7px minmax(0, 1fr); column-gap: 10px; padding: 7px 8px; margin: 0 -8px; border-radius: 9px; color: inherit; text-decoration: none; }
.desk-row:hover { background: var(--tint); }
.desk-row .dot { width: 7px; height: 7px; border-radius: 999px; margin-top: 7px; background: var(--cobalt); }
.desk-row .dot.bad { background: var(--brick); }
.desk-row .dot.done { background: var(--green); }
.desk-row .dot.proj { background: var(--amber); }
.desk-row-t { font-size: var(--t-ui); line-height: 1.4; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.desk-row:hover .desk-row-t { color: var(--cobalt); }
.desk-row-s { grid-column: 2; font-size: var(--t-sm); line-height: 1.4; color: var(--cobalt-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.desk-row-s.bad { color: var(--brick); }
.desk-row-s.done { color: var(--green-ink); }
.desk-row-s.proj { color: var(--amber-ink); }
.desk-none { font-size: var(--t-ui); color: var(--muted); }
/* Processing: a row carries its own actions under the status line. */
.proc-row { align-items: start; }
.proc-row:hover { background: transparent; }
.proc-row .desk-row-t:hover { color: var(--cobalt); }
.proc-act { grid-column: 2; display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.proc-act form { margin: 0; }
.proc-note { margin: -2px 0 6px; font-size: var(--t-sm); color: var(--cobalt-ink); }

/* A theory: the claim in a card, then numbered propositions with their grade. */
.theory-card { margin: 0 0 32px; padding: 18px 20px; border: 1px solid var(--rule); border-left: 3px solid var(--ink); border-radius: 12px; background: var(--card); display: grid; gap: 12px; }
.tc-row { display: grid; grid-template-columns: 92px 1fr; gap: 12px; align-items: baseline; }
.tc-l { font-family: var(--sans); font-size: var(--t-xs); font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
.tc-row p { margin: 0; font-size: var(--t-read); line-height: 1.55; }
.props { margin: 0 0 40px; }
.props h2 { font-family: var(--sans); font-size: var(--t-xl); font-weight: 600; letter-spacing: -.018em; margin: 0 0 12px; scroll-margin-top: 80px; }
.prop-list, .prose .prop-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--hair); }
.prop, .prose .prop { margin: 0; display: grid; grid-template-columns: 40px 1fr auto; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--hair); scroll-margin-top: 80px; }
.prop-n { font-family: var(--sans); font-size: var(--t-sm); font-weight: 600; color: var(--muted); font-variant-numeric: tabular-nums; padding-top: 3px; }
.prose .prop-s, .prop-s { margin: 0 0 4px; font-size: var(--t-read); line-height: 1.5; font-weight: 500; }
.prose .prop-basis, .prop-basis { margin: 0; font-family: var(--sans); font-size: var(--t-sm); line-height: 1.55; color: var(--ink-2); }
.prop-g { padding-top: 2px; }
.prop-key { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 12px; font-family: var(--sans); font-size: var(--t-xs); color: var(--muted); }
.prop-key-h { flex-basis: 100%; font-weight: 600; color: var(--ink-2); }
.prose .prop-refs, .prop-refs { margin: 6px 0 0; font-family: var(--sans); font-size: var(--t-xs); color: var(--muted); }
.prop-refs a, .ref-n { color: var(--cobalt); text-decoration: none; font-family: var(--sans); font-size: .85em; }
.prop-refs a:hover, .ref-n:hover { text-decoration: underline; }
/* A theory's loop, drawn on the server. */
.cycle { margin: 28px 0; padding: 16px; border: 1px solid var(--hair); border-radius: 14px; background: var(--card); }
.cycle svg { display: block; width: 100%; height: auto; font-family: var(--sans); }
.cycle .cy-s rect { fill: var(--paper); stroke: var(--rule); stroke-width: 1.2; }
.cycle .cy-h { font-size: 15px; font-weight: 600; fill: var(--ink); text-anchor: middle; }
.cycle .cy-d { font-size: 12.5px; fill: var(--muted); text-anchor: middle; }
.cycle .cy-a { stroke: var(--switch); stroke-width: 1.6; fill: none; }
.cycle marker path { fill: var(--switch); }
.cycle .cy-cut circle { fill: var(--card); stroke: var(--brick); stroke-width: 1.6; }
.cycle .cy-cut path { stroke: var(--brick); stroke-width: 2; }
.cycle .cy-x text { font-size: 14px; fill: var(--brick); text-anchor: middle; }
.cycle .cy-x .cy-xl { font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
.cycle-list, .cycle-exit { display: none; }
@media (max-width: 560px) {
  .cycle svg { display: none; }
  .prose .cycle-list, .cycle-list { display: block; margin: 0; padding: 0; list-style: none; font-family: var(--sans); font-size: var(--t-ui); }
  .cycle-list li { position: relative; margin: 0 0 18px; padding: 8px 12px; border: 1px solid var(--rule); border-radius: 10px; background: var(--paper); }
  .cycle-list li::after { content: "↓"; position: absolute; left: 50%; bottom: -18px; color: var(--switch); }
  .cycle-list li.cut::before { content: "✕"; position: absolute; right: 10px; top: -15px; color: var(--brick); font-weight: 600; }
  .cycle-list li span { display: block; color: var(--muted); font-size: var(--t-xs); }
  .cycle-list li.back { border-style: dashed; color: var(--muted); }
  .cycle-list li.back::after { content: none; }
  .prose .cycle-exit, .cycle-exit { display: block; margin: 12px 0 0; font-family: var(--sans); font-size: var(--t-sm); color: var(--brick); }
}
.cycle figcaption { margin-top: 8px; font-family: var(--sans); font-size: var(--t-sm); color: var(--muted); }
/* A theory's primary references. */
.refs { margin-top: 40px; }
.prose .refs-note, .refs-note { font-family: var(--sans); font-size: var(--t-sm); color: var(--muted); }
.prose .ref-list, .ref-list { margin: 12px 0 0; padding-left: 28px; font-family: var(--sans); font-size: var(--t-sm); line-height: 1.55; color: var(--ink-2); }
.ref-list li { margin: 0 0 10px; scroll-margin-top: 80px; }
.ref-list li:target { background: var(--cobalt-soft); outline: 4px solid var(--cobalt-soft); border-radius: 4px; }
.ref-u { color: var(--cobalt); }
.ref-u.none { color: var(--hint); }
.ref-by { color: var(--hint); }
.ref-read { color: var(--hint); }
.ref-read.full { color: var(--green-ink); }
.ref-by a { color: var(--hint); }
@media (max-width: 520px) {
  .tc-row { grid-template-columns: 1fr; gap: 2px; }
  .prop { grid-template-columns: 32px 1fr; }
  .prop-g { grid-column: 2; }
}

/* An earlier version of a paper, kept whole: one quiet line saying so. */
.version-note { margin: 0 0 32px; padding: 12px 16px; border: 1px solid var(--green-line); border-radius: 12px; background: var(--green-wash); font-family: var(--sans); font-size: var(--t-sm); line-height: 1.55; color: var(--ink-2); }
.version-note strong { color: var(--green-ink); font-weight: 600; }
.version-note a { color: var(--ink); border-bottom: 1px solid var(--green); }

/* What changed: a paper's versions compared word by word, like a review.
   Removed words struck through on brick, added words on green. */
.chg { max-width: var(--read); margin: 0 auto; padding: 40px 0 64px; }
.chg-kick { font-family: var(--sans); font-size: var(--t-sm); font-weight: 500; color: var(--muted); margin: 0 0 10px; }
.chg-kick a { color: var(--ink); border-bottom: 1px solid var(--green); }
.chg h1 { font-size: var(--t-h1); font-weight: 500; letter-spacing: -.02em; line-height: 1.12; margin: 0 0 14px; }
.chg-sum { font-size: var(--t-md); line-height: 1.55; color: var(--ink-2); margin: 0 0 8px; }
.chg-n { display: inline-block; padding: 0 8px; border-radius: 999px; font-family: var(--sans); font-size: var(--t-xs); font-weight: 600; line-height: 20px; font-variant-numeric: tabular-nums; }
.chg-n.del { background: #f6e4df; color: #8a2f1f; }
.chg-n.ins { background: var(--green-bg); color: var(--green-ink); }
.chg-links { font-family: var(--sans); font-size: var(--t-sm); color: var(--muted); margin: 0 0 28px; }
.chg-links a { color: var(--ink); border-bottom: 1px solid var(--green); }
.chg-body { font-size: var(--t-body); line-height: 1.65; }
.chg-body p { margin: 0 0 14px; }
.chg-h { font-family: var(--sans); font-size: var(--t-md); font-weight: 600; letter-spacing: -.01em; margin: 18px 0 8px; }
.chg-ctx { color: var(--muted); }
.chg-fold { margin: 6px 0 14px; }
.chg-fold > summary { cursor: pointer; list-style: none; font-family: var(--sans); font-size: var(--t-sm); font-weight: 500; color: var(--muted); padding: 8px 12px; border: 1px dashed var(--rule); border-radius: 10px; background: var(--tint); }
.chg-fold > summary::-webkit-details-marker { display: none; }
.chg-fold > summary:hover { color: var(--ink); border-color: var(--rule-2); }
.chg-fold[open] > summary { margin-bottom: 14px; }
.chg-hunk { border-left: 3px solid var(--rule-2); padding: 4px 0 2px 18px; margin: 0 0 18px; }
.chg-hunk del { background: #f6e4df; color: #8a2f1f; text-decoration-color: rgba(138,47,31,.6); }
.chg-hunk ins { background: var(--green-bg); color: var(--green-ink); text-decoration: none; }
@media (max-width: 520px) { .chg { padding: 24px 16px 48px; } }

/* Spoken: a paper decanted into cards of about a minute, to be read aloud.
   Plain type, no ornament; the source and the caveat sit under each card. */
.spoken { margin: 48px 0 8px; padding-top: 28px; border-top: 1px solid var(--hair); }
.spoken h2 { font-family: var(--sans); font-size: var(--t-xl); font-weight: 600; letter-spacing: -.018em; line-height: 1.25; margin: 0 0 8px; scroll-margin-top: 80px; }
.spoken-intro { font-size: var(--t-md); line-height: 1.55; color: var(--ink-2); margin: 0 0 20px; max-width: 60ch; }
.spoken-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
.spoken-card { border: 1px solid var(--hair); border-radius: 12px; background: var(--card); padding: 20px 22px 16px; scroll-margin-top: 80px; }
.spoken-meta { display: flex; justify-content: space-between; gap: 12px; font-family: var(--sans); font-size: var(--t-xs); font-weight: 500; color: var(--muted); font-variant-numeric: tabular-nums; }
.spoken-card h3 { font-family: var(--sans); font-size: var(--t-lg); font-weight: 600; letter-spacing: -.012em; line-height: 1.3; margin: 8px 0 10px; }
.spoken-card p { font-size: var(--t-read); line-height: 1.62; margin: 0 0 12px; }
.spoken-src { margin: 14px 0 0; padding-top: 12px; border-top: 1px solid var(--hair-2); display: grid; gap: 6px; font-family: var(--sans); font-size: var(--t-sm); line-height: 1.5; }
.spoken-src div { display: grid; grid-template-columns: 88px 1fr; gap: 10px; }
.spoken-src dt { color: var(--muted); font-weight: 500; }
.spoken-src dd { margin: 0; color: var(--ink-2); }
.spoken-src a { color: var(--ink); border-bottom: 1px solid var(--cobalt-line); }
.spoken-src a:hover { border-bottom-color: var(--cobalt); }
@media (max-width: 520px) {
  .spoken-card { padding: 16px 16px 14px; }
  .spoken-src div { grid-template-columns: 1fr; gap: 0; }
}
.desk-more { margin-top: 8px; }
.desk-more > summary { display: inline-flex; align-items: center; gap: 4px; padding: 4px 0; font-size: var(--t-sm); font-weight: 500; color: var(--ink-2); cursor: pointer; list-style: none; }
.desk-more > summary::-webkit-details-marker { display: none; }
.desk-more > summary::after { content: "▾"; font-size: var(--t-xs); color: var(--muted); }
.desk-more[open] > summary::after { content: "▴"; }
.desk-more > summary:hover { color: var(--cobalt); }
.cmp { flex: none; margin: 0 12px 12px 16px; padding: 12px 12px 10px 16px; border: 1px solid var(--rule); border-radius: 14px; background: var(--card); display: flex; flex-direction: column; gap: 8px; }
.cmp:focus-within { border-color: var(--cobalt-line); outline: var(--halo); }
.cmp textarea { display: block; width: 100%; min-height: 64px; resize: none; border: 0; padding: 4px 0; background: transparent; font: inherit; font-size: var(--t-md); line-height: 1.5; color: var(--ink); }
.cmp textarea:focus-visible { outline: none; }
.cmp-guess { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; padding-bottom: 8px; border-bottom: 1px solid var(--hair); font-size: var(--t-sm); line-height: 1.45; color: var(--ink-2); }
.cmp-guess[hidden] { display: none; }
.cmp-kind { padding: 2px 9px; border-radius: 999px; background: var(--cobalt-soft); color: var(--cobalt-ink); font-weight: 600; }
.cmp-alt { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; color: var(--muted); }
.cmp-files { display: flex; flex-wrap: wrap; gap: 6px; }
.cmp-files[hidden] { display: none; }
.cmp-file { padding: 2px 9px; border-radius: 999px; background: var(--green-bg); color: var(--green-ink); font-size: var(--t-sm); }
.cmp-bar { display: flex; align-items: center; gap: 8px; min-width: 0; }
.cmp-bar .attach, .cmp-bar .btn { flex: none; }
.cmp-eng { position: relative; display: inline-flex; flex: 0 1 auto; min-width: 0; }
.cmp-eng select { appearance: none; height: 32px; width: 100%; max-width: 170px; padding: 0 24px 0 12px; border-radius: 999px; border: 1px solid var(--hair); background: var(--paper); font: inherit; font-size: var(--t-sm); font-weight: 500; color: var(--ink-2); text-overflow: ellipsis; cursor: pointer; }
.cmp-eng select:hover { background: var(--tint); }
.cmp-eng::after { content: "▾"; position: absolute; right: 10px; top: 8px; font-size: var(--t-xs); color: var(--muted); pointer-events: none; }
.cmp-bar .btn.primary { margin-left: auto; }
.desk-pane { flex: 1; min-width: 0; display: flex; flex-direction: column; padding: 12px 16px 16px; background: var(--tint); }
.desk-path { padding: 4px 4px 10px; font-size: var(--t-sm); color: var(--muted); }
.desk-path code { margin-right: 8px; font-family: var(--mono); font-size: var(--t-xs); color: var(--ink-2); }
.desk-sheet { flex: 1; background: var(--card); border: 1px solid var(--hair); border-radius: 16px; padding: 40px 28px 64px; }
.desk-inner { max-width: 796px; margin: 0 auto; }
.q-head { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 12px 16px; }
.q-h1 { display: flex; align-items: center; gap: 12px; margin: 0; font-size: var(--t-h2); line-height: 1.15; font-weight: 500; letter-spacing: -.02em; }
.q-count { padding: 2px 9px; border-radius: 999px; background: var(--clay-bg); color: var(--clay-ink); font-size: var(--t-sm); font-weight: 600; letter-spacing: 0; }
.q-count.clear { background: var(--green-bg); color: var(--green-ink); }
.q-sub { margin: 6px 0 0; font-size: var(--t-md); color: var(--ink-2); }
.q-tools { margin-left: auto; display: flex; flex-wrap: wrap; gap: 8px; }
.q-tools form { margin: 0; }
.q-add { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 22px 0 16px; padding: 5px 6px 5px 14px; border: 1.5px dashed var(--rule); border-radius: 12px; background: var(--tint-3); }
.q-add.over, .q-add:focus-within { border-color: var(--cobalt-line); background: var(--card); }
.q-add.over { background: var(--cobalt-soft); }
.q-add form { margin: 0; }
.q-url { flex: 1 1 260px; min-width: 0; display: flex; align-items: center; gap: 10px; }
.q-url .plus { color: var(--muted); }
.q-url input { flex: 1; min-width: 0; padding: 6px 0; border: 0; background: transparent; font: inherit; font-size: var(--t-md); color: var(--ink); }
.q-url input:focus-visible { outline: none; }
.q-list { display: flex; flex-direction: column; gap: 12px; }
.d-card { background: var(--card); border: 1px solid var(--hair); border-radius: 14px; padding: 18px 20px; transition: border-color .15s; }
.d-card:hover { border-color: var(--rule); }
.d-card.muted { background: var(--tint-3); }
.d-top { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.d-chip { padding: 2px 9px; border-radius: 999px; font-size: var(--t-sm); font-weight: 500; white-space: nowrap; }
.d-when { margin-left: 4px; font-size: var(--t-sm); color: var(--ink-2); }
.d-main { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 10px 12px; margin-top: 8px; }
.d-title { flex: 1 1 300px; min-width: 0; font-size: var(--t-read); line-height: 1.35; font-weight: 500; letter-spacing: -.01em; color: var(--ink); overflow-wrap: anywhere; }
.d-act { display: flex; align-items: center; gap: 8px; flex: none; }
.d-note { font-size: var(--t-ui); line-height: 1.55; color: var(--ink-2); margin-top: 4px; }
.d-note code { font-family: var(--mono); font-size: var(--t-xs); background: var(--tint); padding: 1px 4px; border-radius: 4px; }
.d-form { margin: 0; }
.d-change { margin-top: 8px; font-size: var(--t-sm); color: var(--ink-2); }
.d-change > summary { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; color: var(--cobalt-ink); font-weight: 500; list-style: none; }
.d-change > summary::-webkit-details-marker { display: none; }
.d-change > summary::after { content: "▾"; font-size: var(--t-xs); }
.d-change[open] > summary::after { content: "▴"; }
.d-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; font-size: var(--t-sm); color: var(--ink-2); }
.d-lab { margin-right: 2px; }
.d-kind input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.d-kind span { display: inline-flex; align-items: center; height: 24px; padding: 0 9px; border-radius: 999px; border: 1px solid var(--rule); background: var(--card); color: var(--ink); font-size: var(--t-sm); font-weight: 500; cursor: pointer; }
.d-kind span:hover { background: var(--cobalt-soft); border-color: var(--cobalt-line); }
.d-kind input:checked + span { background: var(--cobalt-soft); border-color: var(--cobalt-line); color: var(--cobalt-ink); }
.d-kind input:focus-visible + span { outline: 2px solid var(--cobalt); outline-offset: 2px; }
.d-select { height: 30px; padding: 0 8px; border-radius: 8px; border: 1px solid var(--rule); background: var(--card); font: inherit; font-size: var(--t-sm); color: var(--ink); }
.d-clear { padding: 16px 20px; border-radius: 14px; background: var(--green-wash); color: var(--green-ink); font-size: var(--t-ui); }
@media (max-width: 1100px) { .desk-side { flex-basis: 320px; } }
@media (max-width: 760px) {
  .desk { flex-direction: column; min-height: 0; }
  .desk-side { flex: none; border-right: 0; border-bottom: 1px solid var(--hair); }
  .desk-scroll { padding: 18px 16px 8px; }
  .cmp { position: static; margin: 0 16px 16px; }
  .desk-pane { padding: 12px 8px 16px; }
  .desk-sheet { padding: 22px 16px 32px; }
  .q-h1 { font-size: var(--t-h2); }
  .q-tools { margin-left: 0; }
  .desk-tabs:not([hidden]) { display: flex; gap: 4px; margin: 10px 12px 0; padding: 4px; border-radius: 12px; background: var(--tint); }
  .desk-tabs button { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; appearance: none; border: 0; border-radius: 9px; padding: 9px 10px; background: transparent; font: inherit; font-size: var(--t-ui); font-weight: 500; color: var(--ink-2); cursor: pointer; }
  .desk-tabs button[aria-selected="true"] { background: var(--card); color: var(--ink); }
  .desk.tabbed[data-view="side"] .desk-pane, .desk.tabbed[data-view="queue"] .desk-side { display: none; }
  .desk.tabbed .desk-side { border-bottom: 0; }
}
.desk-tabs { display: none; }

/* ---- the document page --------------------------------------------------- */

.dwrap { display: flex; flex-wrap: wrap; gap: 40px 72px; align-items: flex-start; max-width: calc(var(--read) + 72px + var(--rail)); }
.dcol { flex: 1 1 480px; min-width: 0; max-width: var(--read); }
.crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: var(--t-sm); color: var(--ink-2); }
.crumbs a { color: var(--ink-2); }
.crumbs a:hover { color: var(--ink); }
.crumbs .sep { color: var(--rule-2); }
.h-doc { font-size: var(--t-h1); line-height: 1.12; font-weight: 500; letter-spacing: -.025em; margin: 14px 0 20px; color: var(--ink); }
.summary { margin: 0 0 32px; padding: 18px 22px; border-radius: 14px; background: var(--green-wash); }
.summary-h { font-size: var(--t-sm); font-weight: 600; color: var(--green-ink); margin-bottom: 8px; }
.summary-b { font-size: var(--t-body); line-height: 1.6; color: var(--body); }
.summary-b p { margin: 0 0 18px; }
.summary-b p:last-child { margin-bottom: 0; }
.inv-note { margin: 0 0 24px; padding: 12px 16px; border-radius: 12px; background: var(--tint-2); font-size: var(--t-ui); line-height: 1.55; color: var(--body); }
.inv-note strong { font-weight: 600; color: var(--ink); }
.figs { margin: 0 0 36px; border: 1px solid var(--hair); border-radius: 14px; background: var(--card); padding: 4px 18px; }
.figs-h { font-size: var(--t-sm); font-weight: 600; color: var(--ink); padding: 12px 0 6px; }
.fig { display: flex; gap: 14px; align-items: baseline; padding: 12px 0; border-top: 1px solid var(--hair-2); }
.fig-t { flex: 1 1 auto; min-width: 0; font-size: var(--t-md); line-height: 1.55; color: var(--body); }
.fig-t strong { font-weight: 600; color: var(--ink); background: var(--green-wash); padding: 0 3px; border-radius: 4px; }
.fig a { flex: 0 0 auto; font-size: var(--t-xs); color: var(--green-ink); white-space: nowrap; }
.fig a:hover { color: var(--ink); }
.dbody { font-size: var(--t-body); line-height: 1.72; color: var(--body); }
.dbody p { margin: 0 0 20px; }
.dbody strong { font-weight: 600; color: var(--ink); }
.dbody h2 { font-size: var(--t-xl); font-weight: 600; letter-spacing: -.018em; line-height: 1.3; margin: 52px 0 14px; padding-top: 28px; border-top: 1px solid var(--hair); color: var(--ink); scroll-margin-top: 80px; }
.dbody > h2:first-child { margin-top: 0; padding-top: 0; border-top: 0; }
.dbody h2 .badge { display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 26px; padding: 0 7px; margin-right: 10px; border-radius: 999px; background: var(--tint); color: var(--ink); font-size: var(--t-sm); font-weight: 600; vertical-align: 3px; }
.dbody h3 { font-size: var(--t-body); font-weight: 600; margin: 26px 0 8px; color: var(--ink); }
.dbody ul, .dbody ol { margin: 0 0 20px; padding-left: 22px; }
.dbody li { margin: 0 0 8px; }
.dbody blockquote { margin: 6px 0 20px; padding: 12px 18px; border-radius: 12px; background: var(--tint-2); color: var(--ink); }
.dbody a { color: var(--ink); border-bottom: 1px solid var(--rule); }
.dbody a:hover { color: var(--cobalt); border-color: var(--cobalt); }
.dbody code, .prose code { font-family: var(--mono); font-size: .88em; background: var(--tint); padding: 1px 5px; border-radius: 4px; }
.dbody .tbl-wrap { margin: 8px 0 24px; }
.dbody .tbl table { font-size: var(--t-sm); }
.dbody mark.hit, .prose mark.hit { background: rgba(47, 125, 82, .2); color: inherit; padding: 1px 0; border-radius: 3px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
.dcite { margin-top: 40px; padding: 20px 24px; border-radius: 14px; background: var(--card); border: 1px solid var(--hair); font-size: var(--t-ui); line-height: 1.55; color: var(--body); overflow-wrap: anywhere; }
.dcite-h { font-size: var(--t-sm); font-weight: 600; color: var(--ink); margin-bottom: 8px; }
.drail { flex: 1 1 var(--rail); min-width: 220px; max-width: var(--rail); position: sticky; top: 84px; align-self: flex-start; display: flex; flex-direction: column; gap: 24px; }
.drail-h { font-size: var(--t-sm); font-weight: 600; color: var(--ink); margin-bottom: 10px; }
.dtoc { margin: 0; padding: 0 0 0 12px; list-style: none; display: flex; flex-direction: column; gap: 9px; font-size: var(--t-sm); line-height: 1.4; color: var(--body); border-left: 1px solid var(--hair); }
.dtoc li { display: flex; gap: 8px; align-items: baseline; margin-left: -13px; padding-left: 13px; border-left: 1px solid transparent; }
.dtoc li.on { border-left-color: var(--cobalt); }
.dtoc li.on a { color: var(--cobalt-ink); }
.dtoc .n { font-size: var(--t-sm); color: var(--ink-2); width: 22px; flex: 0 0 auto; font-variant-numeric: tabular-nums; }
.dtoc a { color: var(--body); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.dtoc a:hover { color: var(--ink); }
.dmeta { display: flex; flex-direction: column; font-size: var(--t-sm); padding: 4px 16px; border: 1px solid var(--hair); border-radius: 14px; background: var(--card); }
.dmeta > div { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid var(--hair-2); }
.dmeta > div:last-child { border-bottom: 0; }
.dmeta span:first-child { color: var(--ink-2); }
.dmeta span:last-child { color: var(--ink); text-align: right; }
.citedby a { display: block; padding: 8px 0; border-top: 1px solid var(--hair); font-size: var(--t-sm); line-height: 1.4; color: var(--ink); }
.citedby a:first-of-type { border-top: 0; }
.citedby .pill { margin-right: 6px; vertical-align: 1px; }

/* ---- the library --------------------------------------------------------- */

.lib-search { display: flex; align-items: center; gap: 10px; max-width: 520px; height: 42px; padding: 0 14px; border: 1px solid var(--rule); border-radius: 12px; background: var(--card); }
.lib-search span { color: var(--ink-2); font-size: var(--t-md); }
.lib-search input { flex: 1; min-width: 0; border: 0; background: transparent; font: inherit; font-size: var(--t-md); color: var(--ink); outline: none; padding: 0; }
.lib-search:focus-within { border-color: var(--cobalt); outline: var(--halo); }
.seg { margin-top: 18px; display: inline-flex; flex-wrap: wrap; gap: 2px; padding: 4px; border-radius: 12px; background: var(--tint); }
.seg a { display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 14px; border-radius: 9px; color: var(--ink-2); font-size: var(--t-ui); font-weight: 500; white-space: nowrap; }
.seg a:hover { color: var(--ink); }
.seg a .n { padding: 0 7px; border-radius: 999px; background: rgba(21, 23, 28, .06); color: var(--ink-2); font-size: var(--t-xs); font-weight: 500; line-height: 18px; }
.seg a[aria-current="true"] { background: var(--card); outline: 1px solid var(--rule); color: var(--ink); font-weight: 600; }
.seg a[aria-current="true"] .n { background: var(--cobalt-soft); color: var(--cobalt); }
.tchips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
.tchips a { display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 11px; border-radius: 999px; color: var(--ink-2); font-size: var(--t-sm); font-weight: 500; white-space: nowrap; }
.tchips a:hover { background: rgba(21, 23, 28, .05); color: var(--ink); }
.tchips a .n { padding: 0 6px; border-radius: 999px; font-size: var(--t-xs); font-weight: 500; line-height: 17px; font-variant-numeric: tabular-nums; }
.tchips a[aria-current="true"] { font-weight: 600; }
.tchips a[aria-current="true"] .n { background: rgba(255, 255, 255, .55); }
.tchips a.more { text-decoration: underline; text-decoration-color: var(--rule); text-underline-offset: 3px; }
.mchips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; }
.mchips a { display: inline-flex; align-items: center; gap: 7px; height: 28px; padding: 0 12px; border-radius: 999px; font-size: var(--t-xs); font-weight: 500; white-space: nowrap; }
.mchips a:hover { filter: brightness(.96); }
.mchips a .n { opacity: .7; font-variant-numeric: tabular-nums; }
.mchips .l { font-size: var(--t-sm); color: var(--ink-2); margin-right: 4px; }
.mchips a.sub { background: var(--tint); color: var(--ink); padding: 0 11px; }
.mchips a.sub[aria-current="true"] { background: var(--rule); }
.hub-link { display: inline-flex; align-items: center; gap: 8px; margin-top: 12px; }
.sortbar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 16px; }
.sortbar .l { font-size: var(--t-sm); color: var(--ink-2); margin-right: 4px; }
.sortbar a { display: inline-flex; align-items: center; height: 30px; padding: 0 11px; border-radius: 8px; font-size: var(--t-sm); font-weight: 500; color: var(--ink-2); }
.sortbar a:hover { color: var(--ink); background: rgba(21, 23, 28, .05); }
.sortbar a[aria-current="true"] { color: var(--ink); background: var(--card); outline: 1px solid var(--rule); }
.lib { display: flex; flex-direction: column; background: var(--card); border: 1px solid var(--hair); border-radius: 14px; padding: 0 24px; margin-top: 16px; }
.lib-head { display: flex; justify-content: space-between; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--rule); font-size: var(--t-xs); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); font-variant-numeric: tabular-nums; font-weight: 600; }
.lib-note { margin: 14px 0; padding: 12px 16px; border-radius: 12px; background: var(--tint-2); font-size: var(--t-ui); line-height: 1.55; color: var(--body); }
.lib-note strong { font-weight: 600; color: var(--ink); }
.lib-empty { padding: 20px 0; font-size: var(--t-md); color: var(--ink-2); }
.lib-row { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; gap: 4px 20px; padding: 18px 0; border-bottom: 1px solid var(--hair); align-items: baseline; }
.lib-row:last-child { border-bottom: 0; }
.lib-rank { font-size: var(--t-sm); color: var(--ink-2); white-space: nowrap; font-variant-numeric: tabular-nums; }
.lib-t { font-size: var(--t-lg); line-height: 1.28; font-weight: 500; letter-spacing: -.015em; color: var(--ink); }
.lib-row:hover .lib-t { color: var(--cobalt); }
.lib-d { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: var(--t-ui); line-height: 1.5; color: var(--ink-2); margin-top: 4px; max-width: 68ch; }
.lib-m { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: var(--t-sm); color: var(--ink-2); margin-top: 8px; }
.lib-m .pill.kind { font-weight: 600; padding: 2px 9px 2px 7px; }
.lib-m .pill.sub { background: var(--card); border: 1px solid var(--hair); color: var(--ink-2); font-size: var(--t-sm); }
.lib-m .st { font-size: var(--t-xs); font-variant-numeric: tabular-nums; }
.lib-r { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; text-align: right; min-width: 92px; }
.lib-metric { font-size: var(--t-xl); font-weight: 500; letter-spacing: -.02em; font-variant-numeric: tabular-nums; color: var(--ink); line-height: 1.1; }
.lib-ml { font-size: var(--t-sm); color: var(--ink-2); white-space: nowrap; }
.useful { appearance: none; background: none; border: 0; padding: 0; margin: 6px 0 0; font: inherit; cursor: pointer; font-size: var(--t-xs); color: var(--ink-2); white-space: nowrap; }
.useful:hover { color: var(--cobalt); }
.useful[aria-pressed="true"] { color: var(--ink); }
.pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 0; border-top: 1px solid var(--hair); font-size: var(--t-sm); color: var(--ink-2); }
.pager .pages { display: flex; gap: 4px; flex-wrap: wrap; }
.pager .pages a, .pager .pages span { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 30px; padding: 0 8px; border-radius: 8px; font-variant-numeric: tabular-nums; }
.pager .pages a:hover { background: var(--tint-3); }
.pager .pages span[aria-current="page"] { background: var(--ink); color: var(--paper); font-weight: 600; }

.static-toc li.on > a, .static-toc li.on { color: var(--ink); font-weight: 600; }
.paper-toc li.on { background: var(--cobalt-soft); border-radius: 8px; }
.paper-toc li.on, .paper-toc li.on a, .paper-toc li.on span { color: var(--cobalt-ink); }

/* ---- hovercards ----------------------------------------------------------- */

.hcard { position: absolute; z-index: 50; max-width: 340px; padding: 14px 16px; border-radius: 12px; background: var(--card); border: 1px solid var(--rule); display: flex; flex-direction: column; align-items: flex-start; gap: 6px; pointer-events: none; }
.hcard-t { font-size: var(--t-md); line-height: 1.3; font-weight: 600; letter-spacing: -.01em; color: var(--ink); }
.hcard-d { font-size: var(--t-sm); line-height: 1.5; color: var(--ink-2); display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.hcard-m { font-size: var(--t-xs); color: var(--hint); font-variant-numeric: tabular-nums; }

/* ---- responsive ----------------------------------------------------------- */

@media (max-width: 960px) {
  .rail, .drail { position: static; max-width: none; }
  .rail-sticky { position: static; }
}
@media (max-width: 640px) {
  a.ser-row { grid-template-columns: 32px minmax(0, 1fr); padding: 14px 18px; }
  .ser-r { grid-column: 2; flex-direction: row; align-items: center; }
  .ser-head { padding: 22px 18px; }
  .checkable { padding: 22px 18px; }
  .hd-in { padding: 8px 16px; gap: 8px 18px; }
  .main { padding: 16px 16px 64px; }
  .ft-in { padding: 24px 16px 36px; }
  .ft-nav { margin-left: 0; }
  .rows { padding: 6px 16px; }
  .lib { padding: 0 16px; }
  .lib-row { grid-template-columns: minmax(0, 1fr) auto; }
  .lib-rank { display: none; }
  .bar { grid-template-columns: minmax(0, 1fr) auto; }
  .bar-t { grid-column: 1 / -1; grid-row: 2; }
  .panel { padding: 20px 18px; }
  /* A list row's date and topic go under the title, not beside it: the title
     gets the whole width instead of a third of it. */
  a.row { grid-template-columns: minmax(0, 1fr); padding: 16px 12px; }
  .row-r { order: -1; flex-direction: row; align-items: center; gap: 8px; text-align: left; }
  .row-r > span { margin-top: 0 !important; }
  .row-date { font-size: var(--t-sm); font-weight: 500; letter-spacing: 0; color: var(--ink-2); }
  .row-t { font-size: var(--t-read); }
  .lib-row { grid-template-columns: minmax(0, 1fr); padding: 16px 0; }
  .lib-r { flex-direction: row; align-items: baseline; gap: 8px; min-width: 0; order: -1; text-align: left; }
  .lib-metric { font-size: var(--t-sm); font-weight: 500; letter-spacing: 0; color: var(--ink-2); }
  .lib-t { font-size: var(--t-read); }
  /* The kind tabs scroll sideways rather than wrapping into a block. */
  .seg { display: flex; flex-wrap: nowrap; max-width: 100%; overflow-x: auto; scrollbar-width: none; }
  .seg::-webkit-scrollbar { display: none; }
  .ft-nav { grid-template-columns: repeat(3, max-content); gap: 8px 24px; }
}
/* A phone header holds the wordmark, the two links, a search icon and (signed
   in) the Admin pill on one line. The word "Search" stays for screen readers. */
@media (max-width: 520px) {
  .hd-in { flex-wrap: nowrap; gap: 14px; padding: 8px 14px; }
  .nav { gap: 14px; }
  .hd-search { min-width: 0; width: 34px; padding: 0; justify-content: center; font-size: 0; gap: 0; }
  .admin { padding: 0 9px; }
}
@media (max-width: 360px) {
  .nav a[href="/about"] { display: none; }
}
@media print {
  .hd, .ft, .rail, .drail, .panel.email { display: none !important; }
  .main { padding-top: 24px; }
}
`;

let hash = "";
/** Content hash for cache-busting /site.css?v=. */
export function siteStylesHash(): string {
  if (hash) return hash;
  let h = 5381;
  for (let i = 0; i < SITE_CSS.length; i++) h = ((h << 5) + h + SITE_CSS.charCodeAt(i)) | 0;
  hash = (h >>> 0).toString(36);
  return hash;
}

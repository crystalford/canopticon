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
  --violet-bg: #efe6f6;
  --violet-ink: #5a2d82;
  --sans: Geist, system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, monospace;
  --frame: 1240px;
  --read: 720px;
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
input[type="search"] { -webkit-appearance: none; appearance: none; }
.vh { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.tnum { font-variant-numeric: tabular-nums; }

/* ---- chrome ---------------------------------------------------------- */

.skip { position: absolute; left: -9999px; top: 10px; z-index: 40; background: var(--ink); color: var(--paper); padding: 8px 12px; font-size: 12px; font-weight: 500; }
.skip:focus { left: 16px; }
.skip:hover { opacity: .85; color: var(--paper); }
.hd { position: sticky; top: 0; z-index: 30; background: rgba(246, 243, 236, .86); backdrop-filter: saturate(1.4) blur(10px); -webkit-backdrop-filter: saturate(1.4) blur(10px); }
.hd-in { max-width: var(--frame); margin: 0 auto; padding: 8px 32px; min-height: 56px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 28px; border-bottom: 1px solid var(--hair); line-height: 1; }
.wm { font-weight: 700; font-size: 18px; letter-spacing: -.03em; white-space: nowrap; color: var(--ink); }
.nav { display: flex; gap: 20px; font-size: 14px; font-weight: 500; color: var(--muted); white-space: nowrap; }
.nav a[aria-current="page"] { color: var(--ink); font-weight: 600; }
.hd-search { display: inline-flex; align-items: center; gap: 8px; margin-left: auto; font-size: 14px; font-weight: 500; color: var(--muted); white-space: nowrap; }
.kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; border: 1px solid var(--rule); border-radius: 4px; font-size: 11px; letter-spacing: 0; color: var(--cobalt); background: var(--card); font-variant-numeric: tabular-nums; }
.admin { display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 12px; background: var(--card); color: var(--ink); border: 1px solid var(--rule); font-size: 13px; font-weight: 600; white-space: nowrap; border-radius: 10px; }
.admin:hover { background: var(--paper); border-color: var(--rule-2); color: var(--ink); }
.admin-n { font-size: 11px; font-weight: 600; line-height: 1; padding: 3px 7px; border-radius: 999px; background: var(--clay-bg); color: var(--clay-ink); font-variant-numeric: tabular-nums; }
.rp { height: 2px; background: transparent; }
#read-progress { height: 2px; width: 0; background: var(--cobalt); transition: width .1s linear; }

.ft { border-top: 1px solid var(--hair); background: var(--tint); }
.ft-in { max-width: var(--frame); margin: 0 auto; padding: 28px 32px 44px; display: flex; flex-wrap: wrap; gap: 12px 32px; align-items: baseline; }
.ft-wm { font-weight: 700; font-size: 14px; letter-spacing: -.02em; }
.ft-line { font-size: 13px; line-height: 1.55; color: var(--muted); max-width: 60ch; }
.ft-line a { color: var(--ink); border-bottom: 1px solid var(--green); }
.ft-nav { margin-left: auto; display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px; color: var(--muted); }

/* ---- the grid (docs/blackbox/LAYOUT.md) ------------------------------- */

.main { max-width: var(--frame); margin: 0 auto; padding: 20px 32px 80px; }
.main.long { padding-bottom: 120px; }
.rr { display: flex; flex-wrap: wrap; gap: 48px 64px; align-items: flex-start; max-width: 1064px; }
.col { flex: 999 1 480px; min-width: 0; max-width: var(--read); }
.rail { flex: 1 1 280px; min-width: 0; display: flex; flex-direction: column; gap: 28px; align-self: stretch; }
.rail-sticky { position: sticky; top: 72px; }
.rail.tight { gap: 16px; position: sticky; top: 72px; align-self: flex-start; }

/* ---- pills ------------------------------------------------------------ */

.pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 500; white-space: nowrap; background: var(--tint); color: var(--ink); }
.pill.lg { padding: 2px 9px; font-size: 12px; }
a.pill:hover, a.tpill:hover { filter: brightness(.96); }
.chip { display: inline-block; padding: 3px 10px; border-radius: 999px; background: var(--tint); color: var(--ink); font-size: 13px; font-weight: 500; white-space: nowrap; }
.tpill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; font-size: 14px; font-weight: 500; }
.tpill .n { opacity: .7; font-size: 12px; font-variant-numeric: tabular-nums; }
.pills { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }

/* ---- buttons and fields ------------------------------------------------ */

.btn { appearance: none; margin: 0; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 10px; background: var(--card); color: var(--ink); border: 1px solid var(--rule); font: inherit; font-size: 14px; font-weight: 500; white-space: nowrap; }
.btn:hover { background: var(--paper); border-color: var(--rule-2); color: var(--ink); }
.btn.sm { height: 32px; padding: 0 12px; border-radius: 8px; font-size: 13px; line-height: 1; }
.btn.tall { height: 42px; padding: 0 16px; }
.field { flex: 1 1 220px; min-width: 0; height: 42px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--rule); background: var(--card); font: inherit; font-size: 15px; color: var(--ink); outline: none; }
.field:focus { border-color: var(--cobalt); }
.ulink { color: var(--ink); border-bottom: 1px solid var(--rule); }
.glink { color: var(--ink); border-bottom: 1px solid var(--green); }

/* ---- cards and lists --------------------------------------------------- */

.card { background: var(--card); border: 1px solid var(--hair); border-radius: 14px; }
a.card, a.tile { display: flex; flex-direction: column; gap: 8px; padding: 18px 20px; border-radius: 14px; background: var(--card); border: 1px solid var(--hair); min-width: 0; }
a.card:hover, a.tile:hover { background: var(--tint-3); color: var(--ink); }
.tile-t { font-size: 18px; line-height: 1.3; font-weight: 500; letter-spacing: -.01em; color: var(--ink); }
.tile-d { font-size: 14px; line-height: 1.5; color: var(--ink-2); }
.tile-d.clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.grid3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 12px; }
.grid3.wide { grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); }
.sec { margin-top: 64px; }
.sec-h { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
.sec-h h2 { font-size: 20px; font-weight: 600; letter-spacing: -.015em; margin: 0 6px 0 0; color: var(--ink); }
.ruled-h { display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--rule); padding-bottom: 10px; margin-bottom: 16px; }
.ruled-h h2 { font-size: 20px; font-weight: 600; letter-spacing: -.015em; margin: 0; }
.rows { background: var(--card); border: 1px solid var(--hair); border-radius: 14px; padding: 6px 24px; }
.rows.slim { padding: 4px 20px; }
a.row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 20px; padding: 14px 12px; margin: 0 -12px; border-radius: 9px; border-bottom: 1px solid var(--hair); align-items: baseline; }
a.row:last-child, a.row.last { border-bottom: 0; }
a.row:hover, a.lrow:hover { background: var(--tint-3); color: var(--ink); }
.row-t { display: block; font-size: 19px; line-height: 1.25; font-weight: 500; letter-spacing: -.015em; color: var(--ink); }
.row-d { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 14px; line-height: 1.5; color: var(--ink-2); margin-top: 3px; }
.row-r { display: flex; flex-direction: column; align-items: flex-end; text-align: right; }
.row-date { font-size: 20px; font-weight: 500; letter-spacing: -.02em; font-variant-numeric: tabular-nums; color: var(--ink); line-height: 1.1; }
.row-more { display: flex; align-items: center; padding: 14px 12px; margin: 0 -12px; border-radius: 9px; border-top: 1px solid var(--hair); font-size: 15px; font-weight: 500; color: var(--ink); }
.row-more:hover { background: var(--tint-3); color: var(--ink); }
.stack { display: flex; flex-direction: column; gap: 1px; background: var(--hair); border: 1px solid var(--hair); border-radius: 14px; overflow: hidden; }
.stack > a { display: flex; flex-direction: column; gap: 6px; padding: 16px 22px; background: var(--card); min-width: 0; }
.stack > a:hover { background: var(--tint-3); color: var(--ink); }
.stack-t { font-size: 17px; line-height: 1.35; font-weight: 500; letter-spacing: -.01em; color: var(--ink); }
.stack-d { font-size: 14px; line-height: 1.5; color: var(--ink-2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
a.lrow { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 24px; padding: 14px 12px; margin: 0 -12px; border-radius: 10px; border-bottom: 1px solid var(--hair); align-items: baseline; }
.lrow-t { font-size: 18px; line-height: 1.3; font-weight: 500; letter-spacing: -.01em; color: var(--ink); }
.lrow-k { font-size: 12px; color: var(--muted); white-space: nowrap; }

/* ---- metadata panels --------------------------------------------------- */

.meta { background: var(--card); border: 1px solid var(--hair); border-radius: 14px; padding: 6px 18px 8px; }
.meta-r { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 10px 0; border-top: 1px solid var(--hair); font-size: 13px; }
.meta-r:first-child { border-top: 0; }
.meta-r > span:first-child { color: var(--muted); }
.meta-r > span:last-child { color: var(--ink); text-align: right; }
.meta-r.stack-v { flex-direction: column; align-items: stretch; gap: 6px; }
.meta-link { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; padding: 5px 12px 5px 6px; border-radius: 999px; background: var(--card); border: 1px solid var(--hair); color: var(--ink); font-size: 13px; }
.meta-link .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta-link:hover { background: var(--tint-3); color: var(--ink); }
.statbox { display: flex; flex-direction: column; gap: 12px; padding: 16px; border: 1px solid var(--hair); border-radius: 14px; background: var(--card); }
.statbox .tpill { align-self: flex-start; padding: 4px 12px; }
.stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.stat { padding: 12px 14px; border-radius: 12px; background: #f6f2e8; min-width: 0; }
.stat-v { font-size: 22px; font-weight: 600; letter-spacing: -.01em; line-height: 1.2; color: var(--ink); font-variant-numeric: tabular-nums; }
.stat-k { font-size: 14px; color: var(--muted); margin-top: 4px; }
.citebox { background: var(--card); border: 1px solid var(--hair); border-radius: 14px; padding: 14px 18px; }
.citebox-h { font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 8px; }
.citebox-t { font-size: 13px; line-height: 1.6; color: var(--body); overflow-wrap: anywhere; }

/* ---- table of contents (rail) ------------------------------------------ */

.toc-h { font-size: 15px; font-weight: 600; color: var(--ink); margin-bottom: 10px; }
.toc { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; font-size: 14px; line-height: 1.4; color: var(--body); }
.toc li a { display: flex; gap: 10px; align-items: baseline; padding: 6px 8px; margin: 0 -8px; border-radius: 8px; }
.toc li a:hover { background: var(--tint-3); color: var(--ink); }
.toc .n { font-size: 12px; font-weight: 600; color: var(--hint); width: 16px; flex: 0 0 auto; text-align: right; font-variant-numeric: tabular-nums; }
.toc li.on a { background: var(--cobalt-soft); color: var(--cobalt-ink); font-weight: 600; }
.toc li.on .n { color: var(--cobalt-ink); }

/* ---- reading-page header ----------------------------------------------- */

.kicker { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; font-size: 12px; color: var(--muted); font-weight: 500; font-variant-numeric: tabular-nums; }
.h-display { font-size: clamp(32px, 3.8vw, 48px); line-height: 1.08; font-weight: 500; letter-spacing: -.025em; margin: 14px 0 18px; max-width: 24ch; }
.h-page { font-size: clamp(26px, 2.6vw, 32px); line-height: 1.15; font-weight: 500; letter-spacing: -.02em; margin: 0; max-width: 900px; }
.lede { font-size: 15px; line-height: 1.5; color: var(--ink-2); margin: 10px 0 0; max-width: 80ch; }
.dek { font-size: clamp(18px, 1.8vw, 22px); line-height: 1.45; font-weight: 400; color: var(--body); letter-spacing: -.005em; margin: 0 0 26px; }
.byline { font-size: 13px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.byline .who { color: var(--ink); font-weight: 600; font-size: 14px; margin-right: 6px; }
.based { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 16px; }
.based-l { flex-basis: 100%; font-size: 13px; font-weight: 600; color: var(--muted); }
.based a, .src-pill { display: inline-flex; align-items: baseline; gap: 8px; padding: 6px 12px; border-radius: 10px; background: var(--green-bg); color: var(--green-ink); font-size: 14px; font-weight: 500; line-height: 1.4; max-width: 100%; }
.based a:hover, .src-pill:hover { background: var(--green-hover); color: var(--green-ink); }
.pair-note { margin: 0 0 18px; padding: 10px 14px; border-radius: 10px; background: var(--violet-bg); font-size: 13px; line-height: 1.5; color: var(--violet-ink); }
.pair-note a { color: var(--violet-ink); border-bottom: 1px solid var(--violet-ink); }
.aside-box { margin: 0 0 24px; padding: 14px 18px; border-radius: 12px; background: var(--tint-2); font-size: 15px; line-height: 1.6; color: var(--body); }
.aside-box strong { font-weight: 600; color: var(--ink); }
.aside-box.thesis { border-radius: 10px; margin-bottom: 32px; }

/* ---- the article body --------------------------------------------------- */

.prose { font-size: 18px; line-height: 1.66; color: var(--ink); }
.prose p { margin: 0 0 18px; }
.prose p.open { margin: 0 0 24px; line-height: 1.55; }
.prose h2 { font-size: 20px; font-weight: 600; letter-spacing: -.015em; line-height: 1.25; margin: 36px 0 12px; scroll-margin-top: 24px; }
.prose h2:first-child { margin-top: 0; }
.prose h2 .num { color: var(--brick); margin-right: 10px; font-variant-numeric: tabular-nums; }
.prose h3 { font-size: 17px; font-weight: 600; margin: 26px 0 8px; }
.prose ul, .prose ol { margin: 0 0 20px; padding-left: 22px; }
.prose li { margin: 0 0 8px; }
.prose a.doc { color: var(--ink); border-bottom: 1px solid var(--rule); }
.prose strong { font-weight: 600; }
.own { border-bottom: 1px dotted var(--brick); }
mark.q { background: var(--mark); color: inherit; padding: 1px 0; border-radius: 3px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
a.rc { display: inline-flex; align-items: center; margin-left: 5px; padding: 0 7px; border-radius: 999px; background: var(--green-bg); color: var(--green-ink); font-size: 11px; font-weight: 500; line-height: 18px; vertical-align: 2px; white-space: nowrap; }
a.rc:hover { background: var(--green-hover); color: var(--green-ink); }
.objection { margin: 10px 0 22px; padding: 16px 20px; border-radius: 12px; background: var(--clay-wash); }
.objection-h { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; }
.objection-h .pill { background: #f6dccd; color: var(--clay-ink); }
.objection-h strong { font-size: 15px; font-weight: 600; color: var(--ink); }
.objection-b { font-size: 16px; line-height: 1.6; color: var(--body); }
.objection-b p { margin: 0 0 10px; }
.objection-b p:last-child { margin: 0; }
.tbl { margin: 6px 0 24px; }
.tbl-wrap { overflow-x: auto; border: 1px solid var(--hair); border-radius: 12px; background: var(--card); }
.tbl table { width: 100%; border-collapse: collapse; font-size: 14px; line-height: 1.5; }
.tbl th { text-align: left; font-weight: 600; padding: 10px 14px; border-bottom: 1px solid var(--rule); color: var(--ink); background: var(--tint-2); }
.tbl td { padding: 9px 14px; border-bottom: 1px solid var(--hair-2); vertical-align: top; color: var(--body); }
.tbl tr:last-child td { border-bottom: 0; }
.tbl figcaption { margin-top: 8px; font-size: 14px; line-height: 1.5; color: var(--ink-2); }
.chart { margin: 14px 0 26px; padding: 20px 22px; border-radius: 14px; background: var(--card); border: 1px solid var(--hair); }
.chart figcaption { font-size: 15px; font-weight: 600; color: var(--ink); margin-bottom: 14px; }
.bars { display: flex; flex-direction: column; gap: 12px; }
.bar { display: grid; grid-template-columns: minmax(110px, 190px) minmax(0, 1fr) auto; gap: 6px 12px; align-items: center; font-size: 14px; }
.bar-l { color: var(--body); }
.bar-t { height: 12px; border-radius: 999px; background: var(--tint); overflow: hidden; }
.bar-t span { display: block; height: 100%; border-radius: 999px; }
.bar-v { font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; min-width: 44px; text-align: right; }
.chart-note { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-top: 14px; font-size: 12px; color: var(--hint); }
.chart-note a.rc { margin-left: 0; line-height: 20px; vertical-align: 0; padding: 0 8px; }
.pull { margin: 36px 0 8px; padding: 26px 30px; border-radius: 14px; background: var(--cobalt-soft); }
.pull blockquote { margin: 0; font-size: clamp(22px, 2.4vw, 28px); line-height: 1.35; letter-spacing: -.015em; font-weight: 500; color: var(--ink); }
.pull figcaption { margin-top: 12px; font-size: 13px; color: var(--cobalt); }
.pull figcaption a.rc { margin-left: 0; }

/* ---- papers ------------------------------------------------------------- */

.inshort { margin: 0 0 36px; padding: 20px 24px; border-radius: 14px; background: #eef3fb; font-size: 18px; line-height: 1.6; color: var(--ink); scroll-margin-top: 80px; }
.inshort-h { font-size: 13px; font-weight: 600; color: var(--cobalt-ink); margin-bottom: 8px; }
.inshort p { margin: 0 0 12px; }
.inshort p:last-child { margin: 0; }
.pbody h2 { font-size: 22px; font-weight: 600; letter-spacing: -.018em; line-height: 1.25; margin: 48px 0 14px; padding-top: 28px; border-top: 1px solid var(--hair); scroll-margin-top: 80px; display: flex; align-items: baseline; gap: 12px; }
.pbody h2 .badge { color: var(--brick); font-variant-numeric: tabular-nums; }
.pbody h3 { font-size: 17px; font-weight: 600; letter-spacing: -.01em; margin: 28px 0 8px; }
.pbody blockquote { margin: 6px 0 20px; padding: 12px 18px; border-radius: 12px; background: var(--tint-2); }
.pbody a { border-bottom: 1px solid var(--green); }
.pbody .tbl th { background: var(--tint); border-bottom: 1px solid var(--hair); vertical-align: bottom; }
.pbody .tbl td { border-bottom: 1px solid var(--hair); }
.series { min-width: 0; background: var(--card); border: 1px solid var(--hair); border-radius: 14px; padding: 14px 16px; }
.series-h { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.series-h > span:first-child { font-size: 15px; font-weight: 600; color: var(--ink); }
.series ol { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; font-size: 15px; line-height: 1.35; }
.series li > a, .series li.on { display: block; padding: 8px 10px; margin: 0 -10px; border-radius: 10px; color: var(--ink); }
.series li > a:hover { background: var(--tint-3); color: var(--ink); }
.series .t { display: block; font-weight: 500; }
.series .s { display: block; font-size: 14px; color: var(--muted); margin-top: 2px; }
.series li.on { background: var(--violet-bg); }
.series li.on .t { color: var(--violet-ink); font-weight: 600; }
.series li.on .s { color: var(--violet-ink); opacity: .8; }

/* ---- after the body ------------------------------------------------------ */

.panel { margin-top: 40px; padding: 22px 26px; border-radius: 14px; background: var(--card); border: 1px solid var(--hair); color: var(--body); }
.panel h2 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -.01em; color: var(--ink); }
.panel p { margin: 6px 0 14px; font-size: 15px; line-height: 1.55; color: var(--ink-2); }
.panel.cols { padding: 24px 26px; display: flex; flex-direction: column; gap: 24px; }
.panel h3 { font-size: 16px; font-weight: 600; letter-spacing: -.01em; margin: 0 0 10px; color: var(--ink); }
.src-list { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.src-list .src-pill { padding: 8px 14px; font-size: 15px; }
.cite-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border-radius: 10px; background: var(--tint-2); }
.cite-t { flex: 1 1 0%; min-width: 0; font-size: 15px; line-height: 1.55; color: var(--ink); overflow-wrap: anywhere; }
.form-row { margin: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.form-links { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 14px; }

/* ---- the front page --------------------------------------------------------- */

.ser { margin-top: 8px; border-radius: 16px; background: var(--card); border: 1px solid var(--hair); overflow: hidden; }
.ser-head { padding: 30px 28px 26px; background: #f6f0fa; border-bottom: 1px solid #e8dff0; }
.ser-h { font-size: clamp(26px, 2.8vw, 36px); line-height: 1.12; font-weight: 500; letter-spacing: -.02em; margin: 0; max-width: 30ch; color: var(--ink); }
.ser-p { font-size: 16px; line-height: 1.55; color: var(--body); margin: 12px 0 0; max-width: 66ch; }
a.ser-row { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; gap: 4px 18px; padding: 16px 28px; border-top: 1px solid var(--hair-2); align-items: baseline; }
a.ser-row.first { border-top: 0; }
a.ser-row:hover { background: #faf6fc; color: var(--ink); }
.ser-n { font-size: 20px; font-weight: 500; letter-spacing: -.02em; color: #7a52a8; font-variant-numeric: tabular-nums; }
.ser-t { display: block; font-size: 19px; line-height: 1.25; font-weight: 500; letter-spacing: -.014em; color: var(--ink); }
.ser-d { display: block; margin-top: 3px; font-size: 14px; line-height: 1.5; color: var(--ink-2); }
.ser-r { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.ser-m { font-size: 13px; color: var(--ink-2); white-space: nowrap; font-variant-numeric: tabular-nums; }
.ser-foot { margin: 0; padding: 14px 28px 16px; border-top: 1px solid var(--hair-2); font-size: 13px; line-height: 1.5; color: var(--ink-2); }
a.row.rrow { grid-template-columns: 56px minmax(0, 1fr); gap: 4px 16px; }
.rrow-d { font-size: 15px; font-weight: 500; color: var(--ink); white-space: nowrap; }
.rrow-t { display: block; font-size: 17px; line-height: 1.3; font-weight: 500; letter-spacing: -.012em; color: var(--ink); }
.checkable { padding: 28px 32px; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 24px 48px; align-items: center; }
.checkable-l { font-size: 15px; line-height: 1.6; color: var(--body); max-width: 60ch; }
.checkable-l strong { display: block; font-size: 17px; font-weight: 600; color: var(--ink); margin-bottom: 8px; }
.checkable-r { display: flex; flex-direction: column; gap: 10px; min-width: 0; justify-self: stretch; }

/* ---- topic pages ------------------------------------------------------------ */

.h-topic { font-size: clamp(32px, 3.6vw, 46px); line-height: 1.08; font-weight: 500; letter-spacing: -.025em; margin: 14px 0 16px; }
.topic-note { font-size: clamp(18px, 1.7vw, 20px); line-height: 1.5; color: var(--body); margin: 0 0 18px; max-width: 62ch; }
.tsec { margin-bottom: 48px; scroll-margin-top: 80px; }
.works-p { font-size: 14px; line-height: 1.5; color: var(--ink-2); margin: 0 0 14px; max-width: 62ch; }
.work { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 4px 16px; padding: 14px 22px; background: var(--card); align-items: baseline; }
.work-y { font-size: 17px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
.work-b { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.work-t { font-size: 17px; line-height: 1.4; color: var(--ink); }
.work-t span { color: var(--ink-2); }
.work-doc { display: inline-block; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 3px 10px; border-radius: 999px; background: var(--tint); color: var(--ink); font-size: 13px; font-weight: 500; }
.work-doc:hover { background: #e6e0d2; color: var(--ink); }
.facts { display: flex; flex-direction: column; padding: 4px 18px; border: 1px solid var(--hair); border-radius: 14px; background: var(--card); }
.facts > a, .facts > div { display: flex; justify-content: space-between; gap: 16px; padding: 11px 0; border-bottom: 1px solid var(--hair-2); align-items: baseline; font-size: 14px; }
.facts > :last-child { border-bottom: 0; }
.facts > * > span:first-child { color: var(--ink-2); }
.facts .v { color: var(--ink); font-weight: 500; font-variant-numeric: tabular-nums; }
.facts > a:hover span:first-child { color: var(--cobalt); }

/* ---- the document page --------------------------------------------------- */

.dwrap { display: flex; flex-wrap: wrap; gap: 40px 36px; align-items: flex-start; }
.dcol { flex: 1 1 480px; min-width: 0; max-width: var(--read); }
.crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 13px; color: var(--ink-2); }
.crumbs a { color: var(--ink-2); }
.crumbs a:hover { color: var(--ink); }
.crumbs .sep { color: var(--rule-2); }
.h-doc { font-size: clamp(28px, 3.4vw, 42px); line-height: 1.12; font-weight: 500; letter-spacing: -.025em; margin: 14px 0 20px; color: var(--ink); }
.summary { margin: 0 0 32px; padding: 18px 22px; border-radius: 14px; background: var(--green-wash); }
.summary-h { font-size: 13px; font-weight: 600; color: var(--green-ink); margin-bottom: 8px; }
.summary-b { font-size: 16px; line-height: 1.6; color: var(--body); }
.summary-b p { margin: 0 0 18px; }
.summary-b p:last-child { margin-bottom: 0; }
.inv-note { margin: 0 0 24px; padding: 12px 16px; border-radius: 12px; background: var(--tint-2); font-size: 14px; line-height: 1.55; color: var(--body); }
.inv-note strong { font-weight: 600; color: var(--ink); }
.figs { margin: 0 0 36px; border: 1px solid var(--hair); border-radius: 14px; background: var(--card); padding: 4px 18px; }
.figs-h { font-size: 13px; font-weight: 600; color: var(--ink); padding: 12px 0 6px; }
.fig { display: flex; gap: 14px; align-items: baseline; padding: 12px 0; border-top: 1px solid var(--hair-2); }
.fig-t { flex: 1 1 auto; min-width: 0; font-size: 15px; line-height: 1.55; color: var(--body); }
.fig-t strong { font-weight: 600; color: var(--ink); background: var(--green-wash); padding: 0 3px; border-radius: 4px; }
.fig a { flex: 0 0 auto; font-size: 12px; color: var(--green-ink); white-space: nowrap; }
.fig a:hover { color: var(--ink); }
.dbody { font-size: 17px; line-height: 1.7; color: var(--body); }
.dbody p { margin: 0 0 18px; }
.dbody strong { font-weight: 600; color: var(--ink); }
.dbody h2 { font-size: 21px; font-weight: 600; letter-spacing: -.015em; line-height: 1.3; margin: 40px 0 12px; color: var(--ink); scroll-margin-top: 90px; }
.dbody h2 .badge { display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 26px; padding: 0 7px; margin-right: 10px; border-radius: 999px; background: var(--tint); color: var(--ink); font-size: 13px; font-weight: 600; vertical-align: 3px; }
.dbody h3 { font-size: 17px; font-weight: 600; margin: 26px 0 8px; color: var(--ink); }
.dbody ul, .dbody ol { margin: 0 0 20px; padding-left: 22px; }
.dbody li { margin: 0 0 8px; }
.dbody blockquote { margin: 6px 0 20px; padding: 12px 18px; border-radius: 12px; background: var(--tint-2); color: var(--ink); }
.dbody a { color: var(--ink); border-bottom: 1px solid var(--rule); }
.dbody a:hover { color: var(--cobalt); border-color: var(--cobalt); }
.dbody code, .prose code { font-family: var(--mono); font-size: .88em; background: var(--tint); padding: 1px 5px; border-radius: 4px; }
.dbody .tbl-wrap { margin: 8px 0 24px; }
.dbody .tbl table { font-size: 13px; }
.dbody mark.hit, .prose mark.hit { background: rgba(47, 125, 82, .2); color: inherit; padding: 1px 0; border-radius: 3px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
.dcite { margin-top: 40px; padding: 20px 24px; border-radius: 14px; background: var(--card); border: 1px solid var(--hair); font-size: 14px; line-height: 1.55; color: var(--body); overflow-wrap: anywhere; }
.dcite-h { font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 8px; }
.drail { flex: 0 1 240px; min-width: 200px; position: sticky; top: 80px; align-self: flex-start; display: flex; flex-direction: column; gap: 20px; }
.drail-h { font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 10px; }
.dtoc { margin: 0; padding: 0 0 0 12px; list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: var(--body); border-left: 1px solid var(--hair); }
.dtoc li { display: flex; gap: 8px; align-items: baseline; margin-left: -13px; padding-left: 13px; border-left: 1px solid transparent; }
.dtoc li.on { border-left-color: var(--cobalt); }
.dtoc li.on a { color: var(--cobalt-ink); }
.dtoc .n { font-size: 13px; color: var(--ink-2); width: 22px; flex: 0 0 auto; font-variant-numeric: tabular-nums; }
.dtoc a { color: var(--body); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.dtoc a:hover { color: var(--ink); }
.dmeta { display: flex; flex-direction: column; font-size: 12px; padding: 6px 16px; border: 1px solid var(--hair); border-radius: 14px; background: var(--card); }
.dmeta > div { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; border-bottom: 1px solid var(--hair); }
.dmeta > div:last-child { border-bottom: 0; }
.dmeta span:first-child { color: var(--ink-2); }
.dmeta span:last-child { color: var(--ink); text-align: right; }
.citedby a { display: block; padding: 8px 0; border-top: 1px solid var(--hair); font-size: 13px; line-height: 1.4; color: var(--ink); }
.citedby a:first-of-type { border-top: 0; }
.citedby .pill { margin-right: 6px; vertical-align: 1px; }

/* ---- the library --------------------------------------------------------- */

.lib-search { display: flex; align-items: center; gap: 10px; max-width: 520px; height: 42px; padding: 0 14px; border: 1px solid var(--rule); border-radius: 12px; background: var(--card); }
.lib-search span { color: var(--ink-2); font-size: 15px; }
.lib-search input { flex: 1; min-width: 0; border: 0; background: transparent; font: inherit; font-size: 15px; color: var(--ink); outline: none; padding: 0; }
.lib-search:focus-within { border-color: var(--cobalt); }
.seg { margin-top: 18px; display: inline-flex; flex-wrap: wrap; gap: 2px; padding: 4px; border-radius: 12px; background: var(--tint); }
.seg a { display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 14px; border-radius: 9px; color: var(--ink-2); font-size: 14px; font-weight: 500; white-space: nowrap; }
.seg a:hover { color: var(--ink); }
.seg a .n { padding: 0 7px; border-radius: 999px; background: rgba(21, 23, 28, .06); color: var(--ink-2); font-size: 12px; font-weight: 500; line-height: 18px; }
.seg a[aria-current="true"] { background: var(--card); outline: 1px solid var(--rule); color: var(--ink); font-weight: 600; }
.seg a[aria-current="true"] .n { background: var(--cobalt-soft); color: var(--cobalt); }
.tchips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
.tchips a { display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 11px; border-radius: 999px; color: var(--ink-2); font-size: 13px; font-weight: 500; white-space: nowrap; }
.tchips a:hover { background: rgba(21, 23, 28, .05); color: var(--ink); }
.tchips a .n { padding: 0 6px; border-radius: 999px; font-size: 11px; font-weight: 500; line-height: 17px; font-variant-numeric: tabular-nums; }
.tchips a[aria-current="true"] { font-weight: 600; }
.tchips a[aria-current="true"] .n { background: rgba(255, 255, 255, .55); }
.tchips a.more { text-decoration: underline; text-decoration-color: var(--rule); text-underline-offset: 3px; }
.mchips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; }
.mchips a { display: inline-flex; align-items: center; gap: 7px; height: 28px; padding: 0 12px; border-radius: 999px; font-size: 12px; font-weight: 500; white-space: nowrap; }
.mchips a:hover { filter: brightness(.96); }
.mchips a .n { opacity: .7; font-variant-numeric: tabular-nums; }
.mchips .l { font-size: 13px; color: var(--ink-2); margin-right: 4px; }
.mchips a.sub { background: var(--tint); color: var(--ink); padding: 0 11px; }
.mchips a.sub[aria-current="true"] { background: var(--rule); }
.hub-link { display: inline-flex; align-items: center; gap: 8px; margin-top: 12px; }
.sortbar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 16px; }
.sortbar .l { font-size: 13px; color: var(--ink-2); margin-right: 4px; }
.sortbar a { display: inline-flex; align-items: center; height: 30px; padding: 0 11px; border-radius: 8px; font-size: 13px; font-weight: 500; color: var(--ink-2); }
.sortbar a:hover { color: var(--ink); background: rgba(21, 23, 28, .05); }
.sortbar a[aria-current="true"] { color: var(--ink); background: var(--card); outline: 1px solid var(--rule); }
.lib { display: flex; flex-direction: column; background: var(--card); border: 1px solid var(--hair); border-radius: 14px; padding: 0 24px; margin-top: 16px; }
.lib-head { display: flex; justify-content: space-between; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--hair); font-size: 13px; color: var(--ink-2); font-variant-numeric: tabular-nums; font-weight: 500; }
.lib-note { margin: 14px 0; padding: 12px 16px; border-radius: 12px; background: var(--tint-2); font-size: 14px; line-height: 1.55; color: var(--body); }
.lib-note strong { font-weight: 600; color: var(--ink); }
.lib-empty { padding: 20px 0; font-size: 15px; color: var(--ink-2); }
.lib-row { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; gap: 4px 20px; padding: 14px 0; border-bottom: 1px solid var(--hair); align-items: baseline; }
.lib-row:last-child { border-bottom: 0; }
.lib-rank { font-size: 13px; color: var(--ink-2); white-space: nowrap; font-variant-numeric: tabular-nums; }
.lib-t { font-size: 20px; line-height: 1.25; font-weight: 500; letter-spacing: -.015em; color: var(--ink); }
.lib-d { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 14px; line-height: 1.5; color: var(--ink-2); margin-top: 4px; max-width: 68ch; }
.lib-m { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: 13px; color: var(--ink-2); margin-top: 8px; }
.lib-m .pill.kind { font-weight: 600; padding: 2px 9px 2px 7px; }
.lib-m .pill.sub { background: var(--card); border: 1px solid var(--hair); color: var(--ink-2); font-size: 13px; }
.lib-m .st { font-size: 12px; font-variant-numeric: tabular-nums; }
.lib-r { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; text-align: right; min-width: 92px; }
.lib-metric { font-size: 22px; font-weight: 500; letter-spacing: -.02em; font-variant-numeric: tabular-nums; color: var(--ink); line-height: 1.1; }
.lib-ml { font-size: 13px; color: var(--ink-2); white-space: nowrap; }
.useful { appearance: none; background: none; border: 0; padding: 0; margin: 6px 0 0; font: inherit; cursor: pointer; font-size: 12px; color: var(--ink-2); white-space: nowrap; }
.useful:hover { color: var(--cobalt); }
.useful[aria-pressed="true"] { color: var(--ink); }
.pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 0; border-top: 1px solid var(--hair); font-size: 13px; color: var(--ink-2); }
.pager .pages { display: flex; gap: 4px; flex-wrap: wrap; }
.pager .pages a, .pager .pages span { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 30px; padding: 0 8px; border-radius: 8px; font-variant-numeric: tabular-nums; }
.pager .pages a:hover { background: var(--tint-3); }
.pager .pages span[aria-current="page"] { background: var(--ink); color: var(--paper); font-weight: 600; }

/* ---- hovercards ----------------------------------------------------------- */

.hcard { position: absolute; z-index: 50; max-width: 340px; padding: 14px 16px; border-radius: 12px; background: var(--card); border: 1px solid var(--rule); display: flex; flex-direction: column; align-items: flex-start; gap: 6px; pointer-events: none; }
.hcard-t { font-size: 15px; line-height: 1.3; font-weight: 600; letter-spacing: -.01em; color: var(--ink); }
.hcard-d { font-size: 13px; line-height: 1.5; color: var(--ink-2); display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.hcard-m { font-size: 12px; color: var(--hint); font-variant-numeric: tabular-nums; }

/* ---- responsive ----------------------------------------------------------- */

@media (max-width: 960px) {
  .rail, .drail { position: static; }
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

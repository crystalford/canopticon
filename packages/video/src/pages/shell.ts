// Server-rendered HTML shell — same string-concatenation discipline as
// the publication's packages/api/src/public/layout.ts. No JS for
// rendering; the status page uses a `<meta http-equiv="refresh">` poll
// for in-flight renders.

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
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface PageArgs {
  title: string;
  body: string;
  refreshSeconds?: number;
}

const STYLE = `
  :root {
    --ink: #0c0d10;
    --ink-2: #2a2c30;
    --ink-3: #8a867c;
    --paper: #faf6ef;
    --rule: #e7e2d6;
    --amber: #e09a3a;
    --serif: ui-serif, Georgia, "Iowan Old Style", "Apple Garamond", serif;
    --mono: ui-monospace, "JetBrains Mono", Menlo, monospace;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--paper); color: var(--ink); }
  body { font-family: var(--serif); font-size: 15px; line-height: 1.55; }
  .shell { max-width: 980px; margin: 24px auto 80px; padding: 0 24px; }
  .head { display: flex; align-items: baseline; justify-content: space-between; padding-bottom: 16px; border-bottom: 1px solid var(--rule); }
  .brand { font-family: var(--mono); font-size: 13px; color: var(--ink-3); letter-spacing: .06em; }
  .brand .dot { color: var(--amber); }
  .brand a { color: inherit; text-decoration: none; }
  .h1 { font-family: var(--serif); font-size: 26px; margin: 18px 0 4px; }
  .sub { font-family: var(--mono); font-size: 11px; color: var(--ink-3); letter-spacing: .04em; margin-bottom: 22px; }
  .card { padding: 18px 22px; background: #fff; border: 1px solid var(--rule); border-radius: 10px; margin-bottom: 16px; }
  .row { display: flex; gap: 18px; flex-wrap: wrap; }
  .k { font-family: var(--mono); font-size: 11px; color: var(--ink-3); letter-spacing: .03em; }
  .v { font-family: var(--serif); font-size: 22px; }
  .v.num { font-variant-numeric: tabular-nums; }
  .btn {
    font-family: var(--mono); font-size: 13px; padding: 10px 18px;
    background: var(--ink); color: var(--paper); border: none; border-radius: 8px; cursor: pointer; text-decoration: none;
    display: inline-block;
  }
  .btn:hover { background: #1a1c20; }
  .btn-warn { background: var(--amber); color: var(--ink); }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 4px; font-family: var(--mono); font-size: 11px; letter-spacing: .04em; }
  .pill.queued { background: rgba(0,0,0,.06); color: var(--ink-3); }
  .pill.running { background: #fff5e6; color: #5c4413; }
  .pill.succeeded { background: #e7f0e6; color: #2f7d52; }
  .pill.failed { background: #f6e4df; color: #b0402c; }
  video { width: 100%; max-width: 540px; border-radius: 10px; background: #000; }
  .empty { font-style: italic; color: var(--ink-3); }
  pre.err { font-family: var(--mono); font-size: 12px; padding: 12px; background: #f6e4df; color: #b0402c; border-radius: 8px; overflow: auto; }
`;

export function htmlPage(args: PageArgs): Response {
  const refresh = args.refreshSeconds
    ? `<meta http-equiv="refresh" content="${args.refreshSeconds}">`
    : "";
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeAttr(args.title)} · canopticon video</title>
  ${refresh}
  <style>${STYLE}</style>
</head>
<body>
<div class="shell">
  <div class="head">
    <div class="brand"><a href="/">canopticon<span class="dot">.</span> video</a></div>
    <div class="brand"><a href="https://canopticon.com">← publication</a></div>
  </div>
  ${args.body}
</div>
</body>
</html>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

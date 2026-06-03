// Operator console shell. Dark-instrument theme (data-mode="operator").
// Reuses the design build's op-shell / op-side / op-brand / op-nav /
// op-main / op-content / op-header classes from styles.css. The design
// used <button> elements for nav (React SPA); we use <a> links (server-
// routed) styled identically via a small inline rule block.
//
// Cloudflare Access gates every /op/* route, so these screens are only
// reachable by the operator. No auth UI needed here.

import { escapeAttr, escapeHtml } from "../public/layout";
import { stylesHash } from "../public/styles";

export interface OpNavItem {
  href: string;
  label: string;
}

// The screen taxonomy from the PROBE handoff + the existing console.
export const OP_NAV: OpNavItem[] = [
  { href: "/op", label: "Console" },
  { href: "/op/chat", label: "Chat" },
  { href: "/op/workbench", label: "Workbench" },
  { href: "/op/ingest", label: "Ingest" },
  { href: "/op/editorial", label: "Editorial" },
  { href: "/op/leads", label: "Leads" },
  { href: "/op/patterns", label: "Patterns" },
  { href: "/op/publish", label: "Publish" },
  { href: "/op/studio", label: "Studio" },
];

// Small supplementary rules: anchor-flavored nav links (the design used
// buttons) + the chat/editorial layout primitives. Kept inline so the
// operator console is self-contained without editing the shared CSS.
const OP_INLINE_CSS = `
.op-nav a.op-nav-link{display:flex;align-items:center;justify-content:space-between;width:100%;text-align:left;padding:8px 10px;font-size:13.5px;letter-spacing:-0.01em;color:var(--ink-mute);text-decoration:none;border-radius:var(--r-sm);font-weight:500;transition:background .1s,color .1s;gap:8px}
.op-nav a.op-nav-link:hover{color:var(--ink);background:var(--paper-2)}
.op-nav a.op-nav-link.is-active{color:var(--ink);background:var(--paper-2)}
.op-header-actions{display:flex;gap:8px;align-items:center}
.op-chat-wrap{display:grid;grid-template-columns:240px 1fr;min-height:calc(100vh - 27px)}
.op-chat-list{border-right:1px solid var(--rule);padding:14px 10px;overflow-y:auto}
.op-chat-list a{display:block;padding:8px 10px;border-radius:var(--r-sm);color:var(--ink-2);text-decoration:none;font-size:13px;line-height:1.4}
.op-chat-list a:hover{background:var(--paper-2)}
.op-chat-list a.is-active{background:var(--paper-2);color:var(--ink)}
.op-chat-main{display:flex;flex-direction:column;min-height:calc(100vh - 27px)}
.op-chat-scroll{flex:1;overflow-y:auto;padding:24px 28px}
.op-msg{margin-bottom:20px;max-width:760px}
.op-msg.user{margin-left:auto}
.op-msg .bubble{padding:12px 16px;border-radius:var(--r-lg);font-size:14.5px;line-height:1.55}
.op-msg.user .bubble{background:var(--accent-bg);border:1px solid var(--accent-bd);color:var(--ink)}
.op-msg.assistant .bubble{background:var(--surface);border:1px solid var(--rule);color:var(--ink-2)}
.op-toolchip{display:inline-flex;align-items:center;gap:7px;padding:6px 11px;margin:4px 0;border:1px solid var(--rule);border-radius:var(--r);background:var(--paper-2);font-family:var(--mono);font-size:12px;color:var(--ink-3)}
.op-toolchip .dot{width:6px;height:6px;border-radius:50%;background:var(--accent)}
.op-toolchip.ok .dot{background:var(--confirmed)}
.op-toolchip.err .dot{background:var(--correction)}
.op-composer{border-top:1px solid var(--rule);padding:16px 28px;background:var(--paper)}
.op-composer textarea{width:100%;min-height:64px;resize:vertical;background:var(--surface);border:1px solid var(--rule);border-radius:var(--r);padding:12px 14px;color:var(--ink);font-family:var(--sans);font-size:14.5px;line-height:1.5}
.op-composer .row{display:flex;justify-content:space-between;align-items:center;margin-top:10px}
`;

export interface OpPageArgs {
  title: string;
  body: string;
  activeNav?: string;
  /** Optional client-JS module source attached at the end of body */
  clientScript?: string;
  /** Optional JSON bootstrap embedded as a <script type=application/json> */
  bootstrap?: { id: string; data: unknown };
  /** When true, the body is the full shell content (chat uses a custom
   *  two-column layout that replaces op-content). */
  fullBleed?: boolean;
}

export function renderOpPage(args: OpPageArgs): string {
  const cssHref = `/styles.css?v=${stylesHash()}`;
  const nav = renderOpNav(args.activeNav);
  const bootstrap = args.bootstrap
    ? `<script type="application/json" id="${escapeAttr(args.bootstrap.id)}">${jsonForScript(args.bootstrap.data)}</script>`
    : "";
  const clientScript = args.clientScript
    ? `<script type="module" src="${escapeAttr(args.clientScript)}"></script>`
    : "";
  const mainInner = args.fullBleed ? args.body : `<div class="op-content">${args.body}</div>`;
  return `<!doctype html>
<html lang="en" data-mode="operator" data-zone="op">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(args.title)} · Operator · Canopticon</title>
<meta name="robots" content="noindex" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400;1,6..72,500&display=swap" />
<link rel="stylesheet" href="${cssHref}" />
<style>${OP_INLINE_CSS}</style>
</head>
<body>
<div class="op-shell">
  ${nav}
  <div class="op-main">${mainInner}</div>
</div>
${bootstrap}
${clientScript}
</body>
</html>`;
}

function renderOpNav(activeHref?: string): string {
  const items = OP_NAV.map((item) => {
    const isActive =
      activeHref === item.href ||
      (item.href !== "/op" && activeHref ? activeHref.startsWith(item.href) : false);
    return `<a href="${escapeAttr(item.href)}" class="op-nav-link${isActive ? " is-active" : ""}">
  <span>${escapeHtml(item.label)}</span>
</a>`;
  }).join("");
  return `<aside class="op-side">
  <div class="op-brand">
    <a href="/op" class="wordmark" style="font-size:20px">canopticon<span class="dot">.</span></a>
    <div class="mono" style="font-size:10.5px;color:var(--ink-mute);margin-top:3px;text-transform:uppercase;letter-spacing:0.08em">operator console</div>
  </div>
  <nav class="op-nav">${items}</nav>
  <div class="op-side-foot">
    <a href="/" class="op-link">public site →</a>
  </div>
</aside>`;
}

// op-header strip used by content screens (chat manages its own).
export function opHeader(title: string, coord = "", actions = ""): string {
  return `<div class="op-header">
  <div>
    <div class="op-header-title">${escapeHtml(title)}</div>
    ${coord ? `<div class="op-header-coord">${escapeHtml(coord)}</div>` : ""}
  </div>
  ${actions ? `<div class="op-header-actions">${actions}</div>` : ""}
</div>`;
}

function jsonForScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function opHtml(html: string, init: ResponseInit = {}): Response {
  return new Response(html, {
    ...init,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers ?? {}),
    },
  });
}

// Operator console shell. Dark-instrument theme (data-mode="operator").
// Reuses the design build's op-shell / op-side / op-brand / op-nav /
// op-main / op-content / op-header classes from styles.css.
//
// The design used React + onClick handlers on <button>s; we use <a>
// links styled to match. Icons ported from the design's ICONS map
// (op-app.jsx) — inlined SVG, currentColor-stroked.
//
// Cloudflare Access gates every /op/* route, so these screens are only
// reachable by the operator. No auth UI needed here.

import { escapeAttr, escapeHtml } from "../public/layout";
import { stylesHash } from "../public/styles";

// Icon paths ported verbatim from the design build (op-app.jsx ICONS).
const ICONS: Record<string, string> = {
  doc: "M6 2h8l4 4v16H6zM14 2v4h4",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
  plus: "M12 5v14M5 12h14",
  arrowUR: "M7 17 17 7M9 7h8v8",
  edit: "M4 20h4L18 10l-4-4L4 16zM14 6l4 4",
  play: "M7 5l12 7-12 7z",
  spark: "M12 2l2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5z",
  check: "M5 12l4 4 10-10",
  chevron: "M9 6l6 6-6 6",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  dot: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  chat: "M3 5h18v12H7l-4 4z",
};

export function icon(name: string, size = 15, color?: string): string {
  const d = ICONS[name] ?? "";
  const filled = name === "dot";
  const colorAttr = color ? ` style="color:${color}"` : "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${filled ? "currentColor" : "none"}" stroke="${filled ? "none" : "currentColor"}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"${colorAttr}><path d="${d}"/></svg>`;
}

export interface OpNavItem {
  href: string;
  label: string;
  icon: string;
}
export interface OpNavGroup {
  group: string;
  items: OpNavItem[];
}

// Screen taxonomy from the PROBE handoff. Groups + ordering mirror
// the design build's NAV constant.
export const OP_NAV: OpNavGroup[] = [
  {
    group: "Work",
    items: [
      { href: "/op", label: "Console", icon: "doc" },
      { href: "/op/chat", label: "Chat", icon: "chat" },
      { href: "/op/workbench", label: "Workbench", icon: "layers" },
    ],
  },
  {
    group: "Intake",
    items: [
      { href: "/op/build", label: "Build", icon: "plus" },
      { href: "/op/ingest", label: "Ingest", icon: "arrowUR" },
    ],
  },
  {
    group: "Author",
    items: [
      { href: "/op/editorial", label: "Editorial", icon: "edit" },
      { href: "/op/studio", label: "Studio", icon: "play" },
    ],
  },
  {
    group: "Surface",
    items: [
      { href: "/op/leads", label: "Leads", icon: "spark" },
      { href: "/op/patterns", label: "Patterns", icon: "grid" },
      { href: "/op/publish", label: "Publish", icon: "check" },
    ],
  },
];

// Inline rules for nav-link anchors (design used <button>s) + chat/editorial
// layout primitives + command bar.
const OP_INLINE_CSS = `
.op-shell{min-height:100vh}
.op-header{padding-top:20px;padding-bottom:18px;position:relative;top:0}
.op-header-title{font-size:22px !important;letter-spacing:-0.02em !important}
.op-header-coord{font-size:12px !important;margin-top:2px}
.op-content{padding-top:32px !important}
.op-content > .card.soft, .op-content > section > .card.soft{padding:24px 26px}
.op-nav a.op-nav-link{display:flex;align-items:center;justify-content:space-between;width:100%;text-align:left;padding:8px 10px;font-size:13.5px;letter-spacing:-0.01em;color:var(--ink-mute);text-decoration:none;border-radius:var(--r-sm);font-weight:500;transition:background .1s,color .1s;gap:8px}
.op-nav a.op-nav-link:hover{color:var(--ink);background:var(--paper-2)}
.op-nav a.op-nav-link.is-active{color:var(--ink);background:var(--paper-2)}
.op-nav a.op-nav-link .nav-icon{color:var(--ink-mute);display:inline-flex;flex-shrink:0}
.op-nav a.op-nav-link.is-active .nav-icon{color:var(--accent)}
.op-nav a.op-nav-link .nav-label{flex:1;display:inline-flex;align-items:center;gap:10px}
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
.cmdbar{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--surface);border:1px solid var(--rule);border-radius:var(--r-lg);transition:border-color .12s}
.cmdbar:focus-within{border-color:var(--accent-bd)}
.cmdbar .prompt{font-family:var(--mono);color:var(--accent);font-size:14px;flex-shrink:0}
.cmdbar input{flex:1;background:transparent;border:none;outline:none;color:var(--ink);font-family:var(--sans);font-size:14px}
.cmdbar input::placeholder{color:var(--ink-faint)}
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
  const groups = OP_NAV.map((g) => {
    const links = g.items
      .map((item) => {
        const isActive =
          activeHref === item.href ||
          (item.href !== "/op" && activeHref ? activeHref.startsWith(item.href) : false);
        return `<a href="${escapeAttr(item.href)}" class="op-nav-link${isActive ? " is-active" : ""}">
  <span class="nav-label"><span class="nav-icon">${icon(item.icon, 15)}</span>${escapeHtml(item.label)}</span>
</a>`;
      })
      .join("");
    return `<div class="grp">${escapeHtml(g.group)}</div>${links}`;
  }).join("");

  return `<aside class="op-side">
  <div class="op-brand">
    <a href="/op" class="wordmark" style="font-size:20px;text-decoration:none">canopticon<span class="dot">.</span></a>
    <div class="mono" style="font-size:10.5px;color:var(--ink-mute);margin-top:3px;text-transform:uppercase;letter-spacing:0.08em">operator console</div>
  </div>
  <nav class="op-nav">${groups}</nav>
  <div class="op-side-foot">
    <a href="/" style="color:var(--ink-mute);text-decoration:none">public site →</a>
    <span>graph · 1 operator · D1 + Vectorize</span>
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

// Command bar (design's top-of-screen agent prompt). Submits to /op/chat
// with ?q= so the chat screen picks up the first message.
export function commandBar(placeholder?: string): string {
  const ph =
    placeholder ??
    "Command the record — draft a piece, ingest a document, ask what contradicts this…";
  return `<form class="cmdbar" action="/op/chat" method="GET" style="margin-bottom:22px">
  <span class="prompt">›</span>
  <input name="q" placeholder="${escapeAttr(ph)}" autocomplete="off" />
  <span class="chip">chat</span>
</form>`;
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

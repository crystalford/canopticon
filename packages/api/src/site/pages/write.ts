// /admin/write — the workspace. A chat with Claude on the left; on the right,
// the article as it will be published, drawn by the same renderer as the
// public page. Failing quotations show in red; clicking a paragraph flags it
// into the chat. For the author only.

import type { ChatItem } from "../../write/agent";
import type { CheckResult } from "../../write/check";
import type { Draft, DraftKind } from "../../write/drafts";
import { type Entry, entryRoute } from "../../write/entries";
import type { LiveVersion } from "../../write/publish";
import { esc, shell } from "../layout";

const SHORT_DATE = new Intl.DateTimeFormat("en-CA", { day: "numeric", month: "short" });
const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : SHORT_DATE.format(d);
};
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const NO_KEY = `<div class="ws-nokey"><strong>Claude is not connected yet.</strong> Either route works: Cloudflare's AI Gateway with Unified Billing (the repository secrets AI_GATEWAY_ID and CF_AIG_TOKEN), or an Anthropic key (the secret ANTHROPIC_API_KEY). The next deploy hands them to the site. <a href="/admin/claude" class="ulink">See what is set, step by step</a>.</div>`;

const ROUTE_LABEL = {
  gateway: "Claude Opus 5.5 · via Cloudflare AI Gateway",
  anthropic: "Claude Opus 5.5 · via the Anthropic API",
};

export function renderWriteList(
  drafts: Draft[],
  opts: { hasKey: boolean; route?: "gateway" | "anthropic" | null },
): string {
  const rows = drafts.length
    ? drafts
        .map(
          (d) =>
            `<a class="ws-row" href="/admin/write/${esc(d.id)}"><span class="ws-row-t">${d.kind === "research" ? '<span class="pill">Research</span> ' : d.kind === "read" ? '<span class="pill">Read</span> ' : ""}${esc(d.meta.title || (d.kind === "research" ? "Untitled research" : "Untitled draft"))}</span>${d.meta.dek ? `<span class="ws-row-d">${esc(d.meta.dek)}</span>` : ""}<span class="ws-row-m">${esc(when(d.updatedAt))} · ${esc(dollars(d.usage.cents))}</span></a>`,
        )
        .join("")
    : '<div class="d-clear">No drafts yet.</div>';
  return shell({
    title: "Write and research",
    description: "Write an article with Claude, from the record.",
    path: "/admin/write",
    signedIn: true,
    noindex: true,
    body: `<div class="d-head"><h1 class="d-h1">Write and research</h1>${opts.route ? `<span class="ws-route">${ROUTE_LABEL[opts.route]}</span>` : ""}<span class="d-links"><a href="/admin" class="ulink">Back to Admin</a></span></div>${opts.hasKey ? "" : NO_KEY}<div class="ws-new"><form method="post" action="/op/write/new"><button type="submit" class="btn tall">New article</button></form><form method="post" action="/op/write/new"><input type="hidden" name="kind" value="research"><button type="submit" class="btn tall">New research</button></form></div><div class="ws-list">${rows}</div>`,
  });
}

export function checkLine(c: CheckResult): string {
  if (!c.total) return '<span class="ws-check">No quotations yet</span>';
  return c.failed.length
    ? `<span class="ws-check bad">${c.total} quotations · ${c.failed.length} not word for word</span>`
    : `<span class="ws-check ok">${c.total} quotations · all word for word</span>`;
}

const KIND_LABEL: Record<Entry["kind"], string> = {
  concept: "Concept",
  open_problem: "Open problem",
  figure: "Key figure",
};

/** A proposal in the chat: Claude's paragraph, editable, with the passage it
 *  stands on; Add puts it in the record, Dismiss sets it aside. */
export function proposalCard(e: Entry, draftId: string, docTitle?: string): string {
  const head = `<div class="ws-prop-h"><span class="pill">${esc(KIND_LABEL[e.kind])}</span><span>from ${esc(docTitle ?? e.data.doc)}</span></div>`;
  const quote = `<blockquote class="ws-prop-q">${esc(e.data.quote)}</blockquote>`;
  if (e.status === "added") {
    const route = entryRoute(e);
    return `<div class="ws-prop added" id="entry-${esc(e.id)}">${head}<div class="ws-prop-done">Added: <a href="${esc(route)}" target="_blank" rel="noopener">${esc(e.kind === "figure" ? e.data.body : e.data.title)}</a>${e.data.edited ? " (rewritten by you)" : ""}</div></div>`;
  }
  if (e.status === "dismissed") {
    return `<div class="ws-prop dismissed" id="entry-${esc(e.id)}">${head}<div class="ws-prop-done">Dismissed: ${esc(e.kind === "figure" ? e.data.body : e.data.title)}</div></div>`;
  }
  const base = `/op/write/${esc(draftId)}/entries/${esc(e.id)}`;
  const fields =
    e.kind === "figure"
      ? `<div class="ws-prop-fig"><strong>${esc(e.data.body)}</strong></div>`
      : `<label class="vh" for="t-${esc(e.id)}">Title</label><input id="t-${esc(e.id)}" class="ws-prop-t" name="title" value="${esc(e.data.title)}"><label class="vh" for="b-${esc(e.id)}">${e.kind === "concept" ? "Definition" : "The problem"}</label><textarea id="b-${esc(e.id)}" class="ws-prop-b" name="body" rows="4">${esc(e.data.body)}</textarea>`;
  return `<form class="ws-prop" id="entry-${esc(e.id)}" method="post" action="${base}/add">${head}${fields}${quote}<div class="ws-prop-a"><button type="submit" class="btn sm primary">Add to the record</button><button type="submit" class="btn sm" formaction="${base}/dismiss">Dismiss</button></div></form>`;
}

function item(i: ChatItem, cards?: Map<string, string>): string {
  if (i.who === "proposal")
    return (i.toolUseId && cards?.get(i.toolUseId)) || `<div class="ws-act">${esc(i.text)}</div>`;
  if (i.who === "activity") return `<div class="ws-act">${esc(i.text)}</div>`;
  if (i.who === "update") return `<div class="ws-upd">${esc(i.text)}</div>`;
  return `<div class="ws-msg ${i.who === "you" ? "you" : "claude"}">${esc(i.text)}</div>`;
}

export function renderWorkspace(
  d: Draft,
  items: ChatItem[],
  check: CheckResult,
  opts: {
    hasKey: boolean;
    route?: "gateway" | "anthropic" | null;
    publish?: { problems: string[]; live: LiveVersion | null; changed: boolean };
    /** A research draft: what keeps it from Admin, pages read, where it went. */
    research?: { problems: string[]; pages: number; savedAs?: string | undefined };
    /** A read: its receipt line (HTML), the document, and whether what was
     *  kept is on the document's page. */
    read?: { receipt: string; docId: string; readId: string; shown: boolean };
    /** The first message, sent once on arrival (Read it, Write this). */
    autostart?: string | undefined;
    /** Proposal cards by the tool call that made them. */
    cards?: Map<string, string>;
    flash?: {
      published?: string | undefined;
      error?: string | undefined;
      done?: string | undefined;
    };
  },
): string {
  const research = d.kind === "research";
  const read = d.kind === "read" ? opts.read : undefined;
  const pub = research
    ? {
        problems: opts.research?.problems ?? ["Nothing is written yet."],
        live: null,
        changed: true,
      }
    : (opts.publish ?? { problems: ["Nothing is written yet."], live: null, changed: true });
  const isLive = d.status === "published" && !!pub.live;
  const ready = !pub.problems.length;
  const why = pub.problems.length
    ? `<details class="ws-why"><summary>${research ? "Not ready for Admin" : "Not ready to publish"}</summary><ul>${pub.problems.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></details>`
    : "";
  const action = (label: string, path: string, cls = "btn sm", disabled = false) =>
    `<form method="post" action="/op/write/${esc(d.id)}/${path}" class="ws-pubform"><button type="submit" class="${cls}"${disabled ? " disabled" : ""}>${label}</button></form>`;
  const rs = opts.research;
  const savebar = `<span class="ws-uptodate">${rs?.pages ?? 0} ${rs?.pages === 1 ? "page" : "pages"} read</span>${
    rs?.savedAs
      ? '<a class="ws-live" href="/admin" target="_blank" rel="noopener">In Admin</a>'
      : ""
  }${action(rs?.savedAs ? "Save again" : "Save to Admin", "save", "btn sm primary", !ready)}`;
  const readAction = (label: string, act: string, cls = "btn sm") =>
    `<form method="post" action="/op/read/${esc(read?.readId ?? "")}/${act}" class="ws-pubform"><button type="submit" class="${cls}">${label}</button></form>`;
  const pubbar = read
    ? `<a class="ws-live" href="/p/${esc(read.docId)}${read.shown ? "?fresh=1" : ""}" target="_blank" rel="noopener">${read.shown ? "On the page" : "The document"}</a>${
        read.shown
          ? readAction("Take it off", "hide")
          : readAction("Show on the page", "show", "btn sm primary")
      }`
    : research
      ? savebar
      : isLive && pub.live
        ? `<a class="ws-live" href="/articles/${esc(pub.live.slug)}" target="_blank" rel="noopener">Live · version ${pub.live.version}</a>${
            pub.changed
              ? action("Update the live article", "publish", "btn sm primary", !ready)
              : '<span class="ws-uptodate">Up to date</span>'
          }${action("Take down", "unpublish")}`
        : `${pub.live ? '<span class="ws-uptodate">Taken down</span>' : ""}${action(pub.live ? "Publish again" : "Publish", "publish", "btn sm primary", !ready)}`;
  const f = opts.flash ?? {};
  const flash = f.published
    ? `<div class="ws-flash ok">Published at <a href="/articles/${esc(f.published)}?fresh=1" target="_blank" rel="noopener">/articles/${esc(f.published)}</a>. Search engines have been told.</div>`
    : f.error
      ? `<div class="ws-flash bad"><strong>${read ? "Not done." : research ? "Not saved." : "Not published."}</strong> ${esc(f.error)}</div>`
      : f.done
        ? `<div class="ws-flash ok">${esc(f.done)}</div>`
        : "";
  const log = items.length
    ? items.map((i) => item(i, opts.cards)).join("")
    : read
      ? `<div class="ws-hello">Claude reads the whole document once and lays out what is in it on the right: figures, findings, questions, possible articles. Every card is checked word for word against the document; what fails is dropped and counted. Keep or dismiss each one. You can ask about the document here after.</div>`
      : research
        ? `<div class="ws-hello">Ask a question about the world, and say why you are asking and what you have already decided. Claude checks the record, searches the web, reads the sources in full, and writes the report on the right. Every quotation is checked against the pages it read. When it is right, Save to Admin, and publish it there.</div>`
        : `<div class="ws-hello">Say what you want to write: a question, a document to start from, or an idea. Drop research reports here to add them. Claude reads the record, writes the article, and it appears on the right. Click any paragraph there to flag it.</div>`;
  const body = `<div class="ws" data-ws="${esc(d.id)}" data-ws-kind="${esc(d.kind)}"${opts.autostart ? ` data-ws-autostart="${esc(opts.autostart)}"` : ""}>
<div class="ws-tabs" role="tablist" aria-label="Show" data-ws-tabs hidden><button type="button" role="tab" data-ws-tab="chat" aria-selected="true">Chat</button><button type="button" role="tab" data-ws-tab="page" aria-selected="false">${read ? "What it found" : "The page"}</button></div>
<section class="ws-chat" aria-label="Conversation">
<div class="ws-head"><a href="/admin/write" class="ulink">Drafts</a><span class="ws-title">${esc(d.meta.title || (research ? "Untitled research" : "Untitled draft"))}</span></div>
${opts.hasKey ? "" : NO_KEY}
<div class="ws-log" data-ws-log>${log}</div>
<form class="ws-form" method="post" action="/op/write/${esc(d.id)}/turn" data-ws-form>
<div class="ws-flag" data-ws-flag hidden><span class="ws-flag-l">Flagged</span><span class="ws-flag-t" data-ws-flag-text></span><button type="button" class="ws-flag-x" data-ws-flag-clear aria-label="Remove the flag">×</button></div>
<div class="ws-files" data-ws-files hidden></div>
<label for="ws-text" class="vh">Message</label>
<textarea id="ws-text" name="text" rows="3" placeholder="${read ? "Ask about the document, or what Claude found" : research ? "What should Claude find out, or change?" : "What should Claude write or change?"}"${opts.hasKey ? "" : " disabled"}></textarea>
<div class="ws-actions"><span class="ws-left"><label class="ws-attach">Add files<input type="file" multiple accept=".md,.txt,.pdf,.docx" data-ws-file hidden></label><span class="ws-cost" data-ws-cost title="${opts.route ? esc(ROUTE_LABEL[opts.route]) : ""} · estimated, at Anthropic's list price">${esc(dollars(d.usage.cents))} so far</span></span><button type="submit" class="btn"${opts.hasKey ? "" : " disabled"}>Send</button></div>
</form>
</section>
<section class="ws-page" aria-label="The page">
<div class="ws-bar"><span data-ws-check>${read ? `<span class="ws-check">${read.receipt}</span>` : checkLine(check)}</span><span class="ws-pub">${read ? "" : `<a class="ulink" href="/admin/write/${esc(d.id)}/article.md">Download .md</a>`}${pubbar}</span></div>${read ? "" : why}${flash}
<iframe class="ws-frame" src="/admin/write/${esc(d.id)}/preview" title="The article as it will be published" data-ws-preview></iframe>
</section>
</div>`;
  return shell({
    title: d.meta.title ? (read ? d.meta.title : `Write: ${d.meta.title}`) : "Write",
    description: "The workspace.",
    path: `/admin/write/${d.id}`,
    signedIn: true,
    noindex: true,
    mainClass: "ws-main",
    body,
  });
}

/** Injected into the preview only: open links outside the frame, and flag a
 *  paragraph into the chat on click. */
export const PREVIEW_FLAG = `<style>
article p, article li, article h2, article h3, article blockquote, article figure, article td { cursor: pointer; }
.ws-flagged { outline: 2px solid var(--cobalt); outline-offset: 4px; border-radius: 4px; }
.hd, .ft { display: none; }
</style>
<script>
(function () {
  document.querySelectorAll("a[href]").forEach(function (a) { a.target = "_blank"; a.rel = "noopener"; });
  document.addEventListener("click", function (e) {
    if (e.target.closest("a, button")) return;
    var el = e.target.closest("article p, article li, article h2, article h3, article blockquote, article figure, article td");
    if (!el) return;
    document.querySelectorAll(".ws-flagged").forEach(function (x) { x.classList.remove("ws-flagged"); });
    el.classList.add("ws-flagged");
    // The passage as written, without the receipt chips' labels.
    var copy = el.cloneNode(true);
    copy.querySelectorAll(".rc").forEach(function (x) { x.remove(); });
    var text = (copy.textContent || "").replace(/\\s+/g, " ").trim();
    parent.postMessage({ type: "canopticon-flag", text: text.slice(0, 1200) }, location.origin);
  });
})();
</script>`;

export function renderEmptyPreview(kind: DraftKind = "article"): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><link rel="stylesheet" href="/site.css"></head><body><main style="max-width:720px;margin:80px auto;padding:0 24px;color:var(--muted);font-size:17px">The ${kind === "research" ? "report" : "article"} appears here as Claude writes it.</main></body></html>`;
}

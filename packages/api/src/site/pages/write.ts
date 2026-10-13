// /admin/write — the workspace. A chat with Claude on the left; on the right,
// the article as it will be published, drawn by the same renderer as the
// public page. Failing quotations show in red; clicking a paragraph flags it
// into the chat. For the author only.

import type { ChatItem } from "../../write/agent";
import type { CheckResult } from "../../write/check";
import type { Draft } from "../../write/drafts";
import { esc, shell } from "../layout";

const SHORT_DATE = new Intl.DateTimeFormat("en-CA", { day: "numeric", month: "short" });
const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : SHORT_DATE.format(d);
};
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const NO_KEY = `<div class="ws-nokey"><strong>Claude is not connected yet.</strong> The workspace needs an Anthropic API key: add it as the <code>ANTHROPIC_API_KEY</code> secret in the repository's GitHub settings, and the next deploy hands it to the site.</div>`;

export function renderWriteList(drafts: Draft[], opts: { hasKey: boolean }): string {
  const rows = drafts.length
    ? drafts
        .map(
          (d) =>
            `<a class="ws-row" href="/admin/write/${esc(d.id)}"><span class="ws-row-t">${esc(d.meta.title || "Untitled draft")}</span>${d.meta.dek ? `<span class="ws-row-d">${esc(d.meta.dek)}</span>` : ""}<span class="ws-row-m">${esc(when(d.updatedAt))} · ${esc(dollars(d.usage.cents))}</span></a>`,
        )
        .join("")
    : '<div class="d-clear">No drafts yet.</div>';
  return shell({
    title: "Write",
    description: "Write an article with Claude, from the record.",
    path: "/admin/write",
    signedIn: true,
    noindex: true,
    body: `<div class="d-head"><h1 class="d-h1">Write</h1><span class="d-links"><a href="/admin" class="ulink">Back to Admin</a></span></div>${opts.hasKey ? "" : NO_KEY}<form method="post" action="/op/write/new" style="margin:20px 0 28px"><button type="submit" class="btn tall">New article</button></form><div class="ws-list">${rows}</div>`,
  });
}

export function checkLine(c: CheckResult): string {
  if (!c.total) return '<span class="ws-check">No quotations yet</span>';
  return c.failed.length
    ? `<span class="ws-check bad">${c.total} quotations · ${c.failed.length} not word for word</span>`
    : `<span class="ws-check ok">${c.total} quotations · all word for word</span>`;
}

function item(i: ChatItem): string {
  if (i.who === "activity") return `<div class="ws-act">${esc(i.text)}</div>`;
  return `<div class="ws-msg ${i.who === "you" ? "you" : "claude"}">${esc(i.text)}</div>`;
}

export function renderWorkspace(
  d: Draft,
  items: ChatItem[],
  check: CheckResult,
  opts: { hasKey: boolean },
): string {
  const log = items.length
    ? items.map(item).join("")
    : `<div class="ws-hello">Say what you want to write: a question, a document to start from, or an idea. Claude reads the record, writes the article, and it appears on the right. Click any paragraph there to flag it.</div>`;
  const body = `<div class="ws" data-ws="${esc(d.id)}">
<section class="ws-chat" aria-label="Conversation">
<div class="ws-head"><a href="/admin/write" class="ulink">Drafts</a><span class="ws-title">${esc(d.meta.title || "Untitled draft")}</span></div>
${opts.hasKey ? "" : NO_KEY}
<div class="ws-log" data-ws-log>${log}</div>
<form class="ws-form" method="post" action="/op/write/${esc(d.id)}/turn" data-ws-form>
<div class="ws-flag" data-ws-flag hidden><span class="ws-flag-l">Flagged</span><span class="ws-flag-t" data-ws-flag-text></span><button type="button" class="ws-flag-x" data-ws-flag-clear aria-label="Remove the flag">×</button></div>
<label for="ws-text" class="vh">Message</label>
<textarea id="ws-text" name="text" rows="3" placeholder="What should Claude write or change?"${opts.hasKey ? "" : " disabled"}></textarea>
<div class="ws-actions"><span class="ws-cost" data-ws-cost title="Estimated, at list price">${esc(dollars(d.usage.cents))} so far</span><button type="submit" class="btn"${opts.hasKey ? "" : " disabled"}>Send</button></div>
</form>
</section>
<section class="ws-page" aria-label="The page">
<div class="ws-bar"><span data-ws-check>${checkLine(check)}</span><a class="ulink" href="/admin/write/${esc(d.id)}/article.md">Download .md</a></div>
<iframe class="ws-frame" src="/admin/write/${esc(d.id)}/preview" title="The article as it will be published" data-ws-preview></iframe>
</section>
</div>`;
  return shell({
    title: d.meta.title ? `Write: ${d.meta.title}` : "Write",
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

export function renderEmptyPreview(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><link rel="stylesheet" href="/site.css"></head><body><main style="max-width:720px;margin:80px auto;padding:0 24px;color:var(--muted);font-size:17px">The article appears here as Claude writes it.</main></body></html>`;
}

// /admin/write — the workspace. A chat with Claude on the left; on the right,
// the article as it will be published, drawn by the same renderer as the
// public page. Failing quotations show in red; clicking a paragraph flags it
// into the chat. For the author only.

import type { ChatItem } from "../../write/agent";
import { slugify } from "../../write/article";
import type { CheckResult } from "../../write/check";
import type { Draft, DraftKind } from "../../write/drafts";
import { CLAUDE, ENGINES, type EngineId, engine, isWorkersAi } from "../../write/engines";
import { type Entry, entryRoute } from "../../write/entries";
import type { LiveVersion } from "../../write/publish";
import { KIND_WORDS } from "../../write/team";
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
  opts: { hasKey: boolean; route?: "gateway" | "anthropic" | null; engine?: EngineId },
): string {
  const chosen = opts.engine ?? CLAUDE;
  const choice = `<label class="ws-eng"><span>Runs on</span><select name="engine">${ENGINES.map(
    (e) =>
      `<option value="${esc(e.id)}"${e.id === chosen ? " selected" : ""}>${esc(`${e.label} — ${e.note}`)}</option>`,
  ).join("")}</select></label>`;
  const rows = drafts.length
    ? drafts
        .map(
          (d) =>
            `<a class="ws-row" href="/admin/write/${esc(d.id)}"><span class="ws-row-t">${d.kind === "research" ? `<span class="pill">${d.meta.mode === "thesis" ? "Thesis" : "Research"}</span> ` : d.kind === "read" ? '<span class="pill">Read</span> ' : ""}${esc(d.meta.title || (d.kind === "research" ? (d.meta.mode === "thesis" ? "Untitled thesis test" : "Untitled research") : "Untitled draft"))}</span>${d.meta.dek ? `<span class="ws-row-d">${esc(d.meta.dek)}</span>` : ""}<span class="ws-row-m">${esc(when(d.updatedAt))} · ${esc(engine(d.meta.engine ?? CLAUDE).label)} · ${esc(dollars(d.usage.cents))}</span></a>`,
        )
        .join("")
    : '<div class="d-clear">No drafts yet.</div>';
  return shell({
    title: "Write and research",
    description: "Write an article with Claude, from the record.",
    path: "/admin/write",
    signedIn: true,
    noindex: true,
    body: `<div class="d-head"><h1 class="d-h1">Write and research</h1>${opts.route ? `<span class="ws-route">${ROUTE_LABEL[opts.route]}</span>` : ""}<span class="d-links"><a href="/admin" class="btn sm"><span class="g" aria-hidden="true">‹</span> Back to Admin</a></span></div>${opts.hasKey || isWorkersAi(chosen) ? "" : NO_KEY}<form method="post" action="/op/write/new" class="ws-new">${choice}<button type="submit" name="kind" value="article" class="btn tall">New article</button><button type="submit" name="kind" value="research" class="btn tall">New research</button><button type="submit" name="kind" value="thesis" class="btn tall" title="Give a claim: the case for, the case against, the crux, and a verdict">Test a thesis</button></form><p class="ws-eng-note">The choice stays with each conversation. Claude reads and writes best; the Workers AI models run the same checks for much less.</p><div class="ws-list">${rows}</div>`,
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
    /** The engine this conversation runs on. */
    engine?: EngineId;
    publish?: { problems: string[]; live: LiveVersion | null; changed: boolean };
    /** A research draft: what keeps it from Admin, pages read, where it went. */
    research?: {
      problems: string[];
      pages: number;
      savedAs?: string | undefined;
      /** Saved before under this title: saving updates that copy. */
      update?: boolean | undefined;
    };
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
  const thesis = research && d.meta.mode === "thesis";
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
  // The reviewers' flags (team.ts): private, with whether each sentence has
  // changed since — the writer's fix, or Chris's.
  const flat = (x: string) => x.replace(/\s+/g, " ").trim();
  const flags = research ? (d.meta.review ?? []) : [];
  const changed = (s: string) => !flat(d.body).includes(flat(s));
  const reviewed = d.meta.review
    ? `<details class="ws-note"${flags.some((f) => !changed(f.sentence)) ? " open" : ""}><summary>Reviewers: ${
        flags.length
          ? `${flags.length} flagged · ${flags.filter((f) => changed(f.sentence)).length} changed since`
          : "nothing flagged"
      }</summary>${
        flags.length
          ? `<ul>${flags
              .map(
                (f) =>
                  `<li><strong>§${f.section} ${esc(KIND_WORDS[f.kind as keyof typeof KIND_WORDS] ?? f.kind)}</strong> “${esc(f.sentence.slice(0, 240))}” — ${esc(f.why)}${
                    f.url
                      ? ` <a class="ulink" href="${esc(f.url)}" target="_blank" rel="noopener">source</a>`
                      : ""
                  } <span class="ws-uptodate">${changed(f.sentence) ? "changed" : "not changed"}</span></li>`,
              )
              .join("")}</ul>`
          : ""
      }</details>`
    : "";
  // Independence (independence.ts): which cited sources are really one.
  const src = research ? d.meta.sources : undefined;
  const independence = src?.echoes.length
    ? `<details class="ws-note"><summary>Sources: ${src.cited} cited · about ${src.independent} independent</summary><ul>${src.echoes
        .map(
          (g) =>
            `<li>${g.sources.map((k) => `[${k}]`).join(" ")} — ${
              g.why === "publisher"
                ? `all from ${esc(g.sample)}`
                : `share ${g.runs} long passages word for word: “${esc(g.sample)}”`
            }</li>`,
        )
        .join("")}</ul></details>`
    : "";
  // Why it cannot go to Admin or publish: the first reason in the bar, the
  // rest behind "more", and one button that asks Claude to fix them. A new
  // conversation with nothing written yet gets no bar.
  const fixable = pub.problems.filter((p) => p !== "Nothing is written yet.");
  const why = fixable.length
    ? `<div class="ws-warn" role="status"><strong>${research ? "Not ready for Admin:" : "Not ready to publish:"}</strong> <span class="ws-warn-t">${esc(fixable[0] ?? "")}</span>${
        fixable.length > 1
          ? `<details class="ws-warn-more"><summary>${fixable.length - 1} more</summary><ul>${fixable
              .slice(1)
              .map((p) => `<li>${esc(p)}</li>`)
              .join("")}</ul></details>`
          : ""
      }<form method="post" action="/op/write/${esc(d.id)}/turn" class="ws-pubform" data-ws-ask><input type="hidden" name="text" value="${esc(`Fix what keeps this from ${research ? "Admin" : "publishing"}:\n${fixable.map((p) => `- ${p}`).join("\n")}`)}"><button type="submit" class="btn warn">Ask Claude to fix it</button></form></div>`
    : pub.problems.length
      ? `<span class="vh">${research ? "Not ready for Admin" : "Not ready to publish"}: nothing is written yet.</span>`
      : "";
  const action = (label: string, path: string, cls = "btn sm", disabled = false) =>
    `<form method="post" action="/op/write/${esc(d.id)}/${path}" class="ws-pubform"><button type="submit" class="${cls}"${disabled ? " disabled" : ""}>${label}</button></form>`;
  const rs = opts.research;
  const savebar = `<span class="ws-uptodate">${rs?.pages ?? 0} ${rs?.pages === 1 ? "page" : "pages"} read</span>${
    rs?.savedAs ? '<a class="btn sm" href="/admin">In Admin</a>' : ""
  }${action(rs?.update ? "Update in Admin" : "Save to Admin", "save", "btn sm primary", !ready)}${
    rs?.savedAs ? action("Write an article from this", "article") : ""
  }${
    // Deepen: a second pass at the loose ends, free or with Claude.
    d.body.trim().length >= 400
      ? `${action("Deepen (free)", "deepen?with=free")}${action("Deepen with Claude", "deepen?with=claude")}`
      : ""
  }`;
  const readAction = (label: string, act: string, cls = "btn sm") =>
    `<form method="post" action="/op/read/${esc(read?.readId ?? "")}/${act}" class="ws-pubform"><button type="submit" class="${cls}">${label}</button></form>`;
  const pubbar = read
    ? `<a class="btn sm" href="/p/${esc(read.docId)}${read.shown ? "?fresh=1" : ""}" target="_blank" rel="noopener">${read.shown ? "On the page" : "The document"}</a>${
        read.shown
          ? readAction("Take it off", "hide")
          : readAction("Show on the page", "show", "btn sm primary")
      }`
    : research
      ? savebar
      : isLive && pub.live
        ? `<span class="ws-live">Live · version ${pub.live.version}</span>${
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
      : research && d.meta.mode === "deepen"
        ? `<div class="ws-hello">A second pass over a finished report: its notes and every page it read are here. It pulls at the loose ends listed in the first message — open questions, flagged sentences, findings resting on one source — and revises the report in place.</div>`
        : thesis
          ? `<div class="ws-hello">State a claim you want tested — yours, or one you have read. The research team builds the strongest case for it and the strongest case against, finds the crux the disagreement turns on, says what would change the conclusion, and gives a verdict with how sure it is. Every quotation is checked against the pages it read, and reviewers check both sides.</div>`
          : research
            ? `<div class="ws-hello">Ask a question about the world, and say why you are asking and what you have already decided. Claude checks the record, searches the web, reads the sources in full, and writes the report on the right. Every quotation is checked against the pages it read. When it is right, Save to Admin, and publish it there.</div>`
            : `<div class="ws-hello">Say what you want to write: a question, a document to start from, or an idea. Drop research reports here to add them. Claude reads the record, writes the article, and it appears on the right. Click any paragraph there to flag it.</div>`;
  const kindWord = read
    ? "Read"
    : thesis
      ? "Thesis"
      : research && d.meta.mode === "deepen"
        ? "Deepen"
        : research
          ? "Research"
          : "Article";
  const eng = engine(opts.engine ?? CLAUDE);
  const title =
    d.meta.title ||
    (thesis ? "Untitled thesis test" : research ? "Untitled research" : "Untitled draft");
  // Where it will live: the address bar over the page.
  const address = read
    ? `/p/${read.docId}`
    : research
      ? `/p/${slugify(d.meta.title || "untitled-research")}`
      : `/articles/${isLive && pub.live ? pub.live.slug : slugify(d.meta.title || "untitled")}`;
  const onSite = read ? read.shown : isLive;
  const pathBar = `<div class="ws-path"><code>${esc(address)}</code><span>${
    read
      ? "what Claude found — kept cards go on the page"
      : research
        ? "as the document page it will become"
        : "as the article will read"
  }</span><span class="ws-path-r">${
    onSite
      ? `<a class="btn sm" href="${esc(address)}?fresh=1" target="_blank" rel="noopener">Open on the site <span class="g" aria-hidden="true">↗</span></a>`
      : "not on the site yet"
  }</span></div>`;
  const download = read
    ? ""
    : `<a class="btn sm" href="/admin/write/${esc(d.id)}/article.md"><span class="g g-dl" aria-hidden="true">↓</span>Download .md</a>`;
  const top = `<div class="ws-state" data-ws-state><div class="ws-top"><a href="/admin" class="ws-back" aria-label="Back to Admin" title="Back to Admin">‹</a><div class="ws-titles"><div class="ws-title" data-ws-title>${esc(read ? title.replace(/^Read: /, "") : title)}</div><div class="ws-line"><strong>${kindWord}</strong><span aria-hidden="true">·</span><span data-ws-check>${read ? `<span class="ws-check">${read.receipt}</span>` : checkLine(check)}</span><span aria-hidden="true">·</span><span title="${esc(eng.note)}">${esc(eng.label)}</span>${read ? "" : `<span aria-hidden="true">·</span><span>${esc(dollars(d.usage.cents))}</span>`}</div></div><div class="ws-pub">${download}${pubbar}</div></div>${read ? "" : why}${reviewed}${independence}</div>`;
  const tips = read
    ? ["Which figures does the argument rest on?", "What does it say against its own case?"]
    : thesis
      ? ["What would change the verdict?", "Find the strongest study against the claim"]
      : research
        ? ["Add the strongest counter-evidence", "Look for figures published since"]
        : ["Quote the record more where the argument rests", "Tighten the opening"];
  const suggest = `<div class="ws-tips" data-ws-tips hidden>${tips
    .map(
      (t) =>
        `<button type="button" class="ws-tip" data-ws-tip><span aria-hidden="true">↳</span> ${esc(t)}</button>`,
    )
    .join("")}</div>`;
  const body = `<div class="ws" data-ws="${esc(d.id)}" data-ws-kind="${esc(d.kind)}"${opts.autostart ? ` data-ws-autostart="${esc(opts.autostart)}"` : ""}>
${top}${flash}
<div class="ws-tabs" role="tablist" aria-label="Show" data-ws-tabs hidden><button type="button" role="tab" data-ws-tab="chat" aria-selected="true">Chat</button><button type="button" role="tab" data-ws-tab="page" aria-selected="false">${read ? "What it found" : "The page"}</button></div>
<div class="ws-panes">
<section class="ws-chat" aria-label="Conversation">
${opts.hasKey ? "" : NO_KEY}
<div class="ws-log" data-ws-log>${log}</div>
<form class="ws-form" method="post" action="/op/write/${esc(d.id)}/turn" data-ws-form>
${suggest}
<div class="ws-flag" data-ws-flag hidden><span class="ws-flag-l">Flagged</span><span class="ws-flag-t" data-ws-flag-text></span><button type="button" class="ws-flag-x" data-ws-flag-clear aria-label="Remove the flag">×</button></div>
<div class="ws-files" data-ws-files hidden></div>
<label for="ws-text" class="vh">Message</label>
<textarea id="ws-text" name="text" rows="3" placeholder="${read ? "Ask about the document, or what Claude found" : thesis ? "The claim to test, e.g. “Banning short-term rentals lowers rents”" : research ? "What should Claude find out, or change?" : "What should Claude write or change?"}"${opts.hasKey ? "" : " disabled"}></textarea>
<div class="ws-actions"><label class="attach"><span class="plus" aria-hidden="true">+</span>Add files<input type="file" multiple accept=".md,.txt,.pdf,.docx" data-ws-file hidden></label><span class="ws-cost" data-ws-cost title="${isWorkersAi(opts.engine) ? "Workers AI, billed to Cloudflare" : opts.route ? esc(ROUTE_LABEL[opts.route]) : ""} · estimated, at the list price">${esc(dollars(d.usage.cents))} so far</span><button type="submit" class="btn primary"${opts.hasKey ? "" : " disabled"}>Send</button></div>
</form>
</section>
<section class="ws-page" aria-label="The page">
${pathBar}
<div class="ws-sheet"><iframe class="ws-frame" src="/admin/write/${esc(d.id)}/preview" title="The article as it will be published" data-ws-preview></iframe></div>
</section>
</div>
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

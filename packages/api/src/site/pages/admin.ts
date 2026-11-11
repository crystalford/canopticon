// /admin — the operator's desk (design handoff v3, docs/blackbox/README.md
// §Desk). On the left, what is in progress, the projects, and one composer
// that starts anything — an article, research, a claim to test or a document
// to read (write/kind.ts guesses which, and says so before it starts). On the
// right, "Waiting for you": one card per decision, each with one primary
// action and a ⋯ menu; decided cards come back with Show decided.
//
// "Nothing publishes without Publish." An upload is read and sorted by its
// shape (lib/sort-upload.ts) and waits here as working-material. Every
// button is a plain form POST to /op/admin/* (operator/routes/admin.ts), so
// the page works without script; /site.js adds drag-and-drop and the
// composer's guess as you type.

import { SORT_LABELS, type SortedAs } from "../../lib/sort-upload";
import type { Draft } from "../../write/drafts";
import { DEFAULT_ENGINE, ENGINES, type EngineId } from "../../write/engines";
import { KIND_NAME, KIND_WHAT, START_KINDS, kindRulesJson } from "../../write/kind";
import type { ReadBadge } from "../../write/read";
import type { AdminModel, AdminPiece } from "../admin-data";
import { heldResearch, terms } from "../content/store";
import { hubTopics } from "../data";
import { esc, shell } from "../layout";
import { kindColours, shortDate } from "../theme";

const KIND_PAIR: Record<string, readonly [string, string]> = {
  research: kindColours("Research"),
  article: kindColours("Article"),
  paper: kindColours("Paper"),
  personal: kindColours("Personal"),
  concept: kindColours("Concept"),
  failed: ["#fbe9df", "#8a3a1f"],
};

const STATUS_PAIR = {
  ready: ["#e3f0e6", "#1f5e36"],
  held: ["#f3e9d4", "#6b4e14"],
  needs: ["#fbe9df", "#8a3a1f"],
  done: ["#efebe1", "#15171c"],
} as const;

function chip(label: string, pair: readonly [string, string]): string {
  return `<span class="d-chip" style="background:${pair[0]};color:${pair[1]}">${esc(label)}</span>`;
}

/** The ⋯ menu: secondary actions, each a real button or link. */
function more(items: string[]): string {
  const list = items.filter(Boolean);
  return list.length
    ? `<details class="more"><summary aria-label="More actions" title="More">⋯</summary><div class="more-menu">${list.join("")}</div></details>`
    : "";
}

function card(args: {
  kind: string;
  kindLabel: string;
  status: string;
  statusPair: readonly [string, string];
  when: string;
  title: string;
  note: string;
  /** The one primary action, then the ⋯ menu. */
  act?: string;
  /** Below the note (a disclosure, a list). */
  after?: string;
  /** The form the card's buttons belong to, as an opening tag. */
  form?: string;
  muted?: boolean;
}): string {
  const inner = `<div class="d-top">${chip(args.kindLabel, KIND_PAIR[args.kind] ?? KIND_PAIR.research ?? ["#efebe1", "#15171c"])}${chip(args.status, args.statusPair)}${args.when ? `<span class="d-when">${esc(args.when)}</span>` : ""}</div><div class="d-main"><div class="d-title">${esc(args.title)}</div>${args.act ? `<div class="d-act">${args.act}</div>` : ""}</div><div class="d-note">${args.note}</div>${args.after ?? ""}`;
  return `<div class="d-card${args.muted ? " muted" : ""}">${args.form ? `${args.form}${inner}</form>` : inner}</div>`;
}

/** Read it, or the read there is, as a menu item. */
function readItem(p: AdminPiece, r: ReadBadge | undefined): string {
  return r?.draftId
    ? `<a href="/admin/write/${esc(r.draftId)}">Its read</a>`
    : `<button type="submit" formaction="/op/read/${esc(p.slug)}" formnovalidate>Read it</button>`;
}
function readNote(r: ReadBadge | undefined): string {
  if (!r) return "";
  const bits = [
    r.status === "reading" ? "Read it started" : `Read ${shortDate(r.startedAt.slice(0, 10))}`,
    `${r.kept} kept`,
    ...(r.dropped ? [`<span style="color:var(--brick)">${r.dropped} dropped</span>`] : []),
    ...(r.status === "shown" ? ["on its page"] : []),
  ];
  return ` · ${bits.join(" · ")}`;
}

const SORT_WHY =
  "A report with a TL;DR, key findings and numbered sources is read as research; a piece with an abstract and references is a paper; a first-person argument is an article; a file that names you or your health is held as personal.";

function waitingCard(p: AdminPiece, topics: string[], r?: ReadBadge): string {
  const personal = p.sortedAs === "personal";
  const kinds = (Object.keys(SORT_LABELS) as SortedAs[])
    .map(
      (k) =>
        `<label class="d-kind"><input type="radio" name="sorted_as" value="${k}"${k === p.sortedAs ? " checked" : ""} /><span>${SORT_LABELS[k]}</span></label>`,
    )
    .join("");
  const topicOpts = ["", ...topics]
    .map(
      (t) =>
        `<option value="${esc(t)}"${t === p.topic ? " selected" : ""}>${t ? esc(t) : "Choose a topic…"}</option>`,
    )
    .join("");
  const change = `<details class="d-change"><summary>Change how it is read${p.topic ? "" : " · topic"}</summary><div class="d-row"><span class="d-lab">Read as</span>${kinds}</div><div class="d-row"><label class="d-lab" for="t-${esc(p.id)}">Topic</label><select id="t-${esc(p.id)}" name="topic" class="d-select">${topicOpts}</select></div><div class="d-row">${SORT_WHY}</div></details>`;
  const note = personal
    ? `Read as <strong>personal</strong> because it ${esc(p.sortedWhy)}. It stays private unless you publish it anyway.`
    : `Read as ${esc(SORT_LABELS[p.sortedAs].toLowerCase())} because it ${esc(p.sortedWhy)} · ${Math.max(1, Math.round(p.chars / 1000))}k characters${readNote(r)}`;
  return card({
    kind: p.sortedAs,
    kindLabel: SORT_LABELS[p.sortedAs],
    status: personal ? "Held private" : "Ready to publish",
    statusPair: personal ? STATUS_PAIR.held : STATUS_PAIR.ready,
    when: shortDate(p.createdAt.slice(0, 10)),
    title: p.title,
    note,
    form: `<form method="post" action="/op/admin/${esc(p.id)}/publish" class="d-form">`,
    act: `<button type="submit" class="btn${personal ? "" : " primary"}">${personal ? "Publish anyway" : "Publish"}</button>${more(
      [
        `<a href="/admin/review/${esc(p.id)}">Review</a>`,
        personal ? "" : readItem(p, r),
        `<button type="submit" formaction="/op/admin/${esc(p.id)}/private">Keep private</button>`,
        `<button type="submit" formaction="/op/admin/${esc(p.id)}/remove" class="danger">Remove</button>`,
      ],
    )}`,
    after: change,
  });
}

function failedCard(p: AdminPiece): string {
  return card({
    kind: "failed",
    kindLabel: "Failed read",
    status: "Needs a text version",
    statusPair: STATUS_PAIR.needs,
    when: shortDate(p.createdAt.slice(0, 10)),
    title: p.filename,
    note: "No text layer — usually a scanned PDF. Upload a text export, or remove it.",
    form: `<form method="post" action="/op/library/${esc(p.id)}/replace" enctype="multipart/form-data" class="d-form">`,
    act: `<label class="btn file">Upload text<input type="file" name="file" accept=".md,.txt,.pdf,.docx" required data-autosubmit /></label><noscript><button type="submit" class="btn">Send</button></noscript>${more(
      [
        `<button type="submit" formaction="/op/admin/${esc(p.id)}/remove" formenctype="application/x-www-form-urlencoded" formnovalidate class="danger">Remove</button>`,
      ],
    )}`,
  });
}

function doneCard(p: AdminPiece, label: string, undo: string, r?: ReadBadge): string {
  return card({
    kind: p.sortedAs,
    kindLabel: SORT_LABELS[p.sortedAs],
    status: label,
    statusPair: STATUS_PAIR.done,
    when: shortDate((p.publishedAt ?? p.createdAt).slice(0, 10)),
    title: p.title,
    note:
      p.status === "published"
        ? `Live at <a href="/p/${esc(p.slug)}" class="ulink">/p/${esc(p.slug)}</a>${readNote(r)}`
        : "Stored, read, and not public.",
    muted: true,
    form: `<form method="post" action="${esc(undo)}" class="d-form">`,
    act: `<button type="submit" class="btn sm"><span class="g" aria-hidden="true">↶</span> Undo</button>${
      p.status === "published" ? more([readItem(p, r)]) : ""
    }`,
  });
}

function heldCard(): string {
  const held = heldResearch();
  if (!held.length) return "";
  return card({
    kind: "personal",
    kindLabel: "Personal",
    status: "Held private",
    statusPair: STATUS_PAIR.held,
    when: "",
    title: `${held.length} documents held private`,
    note: `Stored with the record and never served: ${held
      .map((d) => `<a href="/admin/review/${esc(d.id)}" class="ulink">${esc(d.title)}</a>`)
      .join(
        ", ",
      )}. To publish one, move its file from <code>content/research-held/</code> to <code>content/research/</code>.`,
  });
}

function namesCard(): string {
  const pending = terms().filter((t) => /pending/.test(t.foot ?? ""));
  if (!pending.length) return "";
  return card({
    kind: "concept",
    kindLabel: "Concept",
    status: "Name check",
    statusPair: STATUS_PAIR.held,
    when: "",
    title: `${pending.length} ${pending.length === 1 ? "name needs" : "new names need"} a scholarly check`,
    note: `${pending.map((t) => esc(t.title)).join(", ")} passed a web search; none has been searched in Google Scholar yet. The register is <code>docs/blackbox/TERMS.md</code>.`,
    act: `<a href="/ideas" class="btn">See them</a>`,
  });
}

export interface AdminFlash {
  uploaded?: string | undefined;
  ingested?: string | undefined;
  dupes?: string | undefined;
  dedup?: string | undefined;
  error?: string | undefined;
  done?: string | undefined;
  /** Whether Claude is connected (claudeRoute), for the head's line. */
  claude?: boolean;
}

function flash(f: AdminFlash): string {
  if (f.error) return `<p class="d-flash bad">${esc(f.error)}</p>`;
  if (f.dedup)
    return `<p class="d-flash">That file is already in the record — nothing new was added.</p>`;
  if (f.ingested) {
    const dupes = Number(f.dupes ?? 0);
    return `<p class="d-flash">Read ${esc(f.ingested)} files from the zip${dupes ? `, ${dupes} already in the record` : ""}. Each waits below until you publish it.</p>`;
  }
  if (f.uploaded)
    return `<p class="d-flash">Read and sorted. It waits below until you publish it.</p>`;
  if (f.done) return `<p class="d-flash">${esc(f.done)}</p>`;
  return "";
}

/** The desk's left column: conversations, reads, projects, and the engine. */
export interface DeskModel {
  drafts: Draft[];
  /** The engine the composer starts on (the remembered default). */
  engine?: EngineId;
  /** Spent on conversations started this month, at list prices, in cents. */
  monthCents?: number;
  /** Show decided is on. */
  decided?: boolean;
}

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

interface Row {
  href: string;
  title: string;
  status: string;
  tone: "" | "bad" | "done" | "proj";
}

/** One conversation as a row: its kind, what state it is in, and when. Only
 *  what the drafts list already carries (it never reads a draft's text). */
export function draftRow(d: Draft, read?: ReadBadge): Row & { finished: boolean } {
  const kind =
    d.kind === "read"
      ? "Read"
      : d.kind === "research"
        ? d.meta.mode === "thesis"
          ? "Thesis"
          : d.meta.mode === "deepen"
            ? "Deepen"
            : "Research"
        : "Article";
  const bits: string[] = [];
  let tone: Row["tone"] = "";
  let finished = false;
  if (d.kind === "read") {
    if (read) {
      bits.push(`${read.kept} kept`);
      if (read.proposed) bits.push(`${read.proposed} need you`);
      if (read.status === "shown") {
        bits.push("on its page");
        finished = !read.proposed;
        if (finished) tone = "done";
      }
      if (read.dropped) {
        bits.push(`${read.dropped} dropped`);
      }
    } else bits.push("not started");
  } else if (d.kind === "research") {
    const flags = d.meta.review?.length ?? 0;
    if (d.meta.savedAs) {
      bits.push("saved to Admin");
      tone = "done";
      finished = true;
    } else if (!d.usage.cents) bits.push("not started");
    else if (d.meta.review) bits.push(flags ? `reviewed · ${flags} flagged` : "reviewed");
    else bits.push("in progress");
  } else if (d.status === "published") {
    bits.push("live");
    tone = "done";
    finished = true;
  } else bits.push(d.usage.cents ? "draft" : "not started");
  const fallback =
    d.kind === "research"
      ? d.meta.mode === "thesis"
        ? "Untitled thesis test"
        : "Untitled research"
      : "Untitled draft";
  return {
    href: `/admin/write/${d.id}`,
    title: (d.meta.title || fallback).replace(/^Read: /, ""),
    status: [kind, ...bits, shortDate(d.updatedAt.slice(0, 10))].join(" · "),
    tone,
    finished,
  };
}

function rowHtml(r: Row): string {
  return `<a class="desk-row" href="${esc(r.href)}"><span class="dot${r.tone ? ` ${r.tone}` : ""}" aria-hidden="true"></span><span class="desk-row-t">${esc(r.title)}</span><span class="desk-row-s${r.tone ? ` ${r.tone}` : ""}">${esc(r.status)}</span></a>`;
}

const SHOWN = 8;

function side(desk: DeskModel, reads: Map<string, ReadBadge>): string {
  const byDraft = new Map(
    [...reads.values()].filter((r) => r.draftId).map((r) => [r.draftId as string, r]),
  );
  // One list: what Claude has worked on, newest first. A conversation
  // opened and never used is not shown at all (it leads nowhere); what is
  // finished folds into "Done" below, in place — no second page.
  const rows = [...desk.drafts]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .filter((d) => d.usage.cents > 0 || (byDraft.get(d.id)?.kept ?? 0) > 0)
    .map((d) => draftRow(d, byDraft.get(d.id)));
  const open = rows.filter((r) => !r.finished);
  const done = rows.filter((r) => r.finished);
  const fold = (label: string, list: Row[]) =>
    list.length
      ? `<details class="desk-more"><summary>${esc(label)}</summary>${list.map(rowHtml).join("")}</details>`
      : "";
  const work = `<section class="desk-group" aria-label="Your work"><h2 class="desk-gh">Your work <span>${open.length}</span></h2>${
    open.length
      ? open.slice(0, SHOWN).map(rowHtml).join("")
      : '<div class="desk-none">Nothing under way. Type below to start.</div>'
  }${fold(`${open.length - SHOWN} older`, open.slice(SHOWN))}${fold(`Done · ${done.length}`, done)}</section>`;
  const chosen = desk.engine ?? DEFAULT_ENGINE;
  const engines = ENGINES.map(
    (e) =>
      `<option value="${esc(e.id)}"${e.id === chosen ? " selected" : ""} title="${esc(e.note)}">${esc(e.label)}</option>`,
  ).join("");
  const others = START_KINDS.map(
    (k) =>
      `<button type="button" class="chipb" data-cmp-make="${k}" data-name="${esc(KIND_NAME[k])}" data-what="${esc(KIND_WHAT[k])}">${esc(KIND_NAME[k])}</button>`,
  ).join("");
  const composer = `<form class="cmp" method="post" action="/op/admin/start" enctype="multipart/form-data" data-cmp data-kinds="${esc(kindRulesJson())}"><div class="cmp-guess" data-cmp-guess hidden aria-live="polite"><span class="cmp-kind" data-cmp-kind></span><span data-cmp-what></span><span class="cmp-alt">make it ${others}</span></div><input type="hidden" name="kind" value="" data-cmp-kind-input><div class="cmp-files" data-cmp-files hidden></div><label for="cmp-text" class="vh">What to start</label><textarea id="cmp-text" name="text" rows="3" placeholder="Write about…, a question to research, or a document to read" data-cmp-text></textarea><div class="cmp-bar"><label class="attach"><span class="plus" aria-hidden="true">+</span>Add files<input type="file" name="file" multiple accept=".md,.txt,.pdf,.docx" hidden data-cmp-file></label><label class="cmp-eng" title="Which models do the work. Only a Cloudflare engine is remembered."><span class="vh">Runs on</span><select name="engine">${engines}</select></label><button type="submit" class="btn primary">Send</button></div></form>`;
  return `<aside class="desk-side" aria-label="Your work"><div class="desk-scroll"><p class="desk-help">Type below. Claude works out whether it is an <strong>article</strong>, a <strong>research question</strong>, a <strong>claim to test</strong> or <strong>a document to read</strong>, and says which before it starts.</p>${work}</div>${composer}</aside>`;
}

export function renderAdmin(
  model: AdminModel,
  f: AdminFlash = {},
  reads: Map<string, ReadBadge> = new Map(),
  desk: DeskModel = { drafts: [] },
): string {
  const topics = hubTopics().map((t) => t.name);
  const cards = [
    ...model.waiting.map((p) => waitingCard(p, topics, reads.get(p.slug))),
    ...model.failed.map(failedCard),
    namesCard(),
    heldCard(),
  ].filter(Boolean);
  const open = model.waiting.length + model.failed.length;
  const decided = [
    ...model.published.map((p) =>
      doneCard(p, "Published", `/op/admin/${p.id}/unpublish`, reads.get(p.slug)),
    ),
    ...model.kept.map((p) => doneCard(p, "Kept private", `/op/admin/${p.id}/undo`)),
  ];
  const on = !!desk.decided;

  const top = `<div class="desk-top"><div><h1>Admin</h1><div class="desk-line"><strong>${open ? `${open} waiting` : "All clear"}</strong><span aria-hidden="true">·</span><a href="/admin/claude" class="${f.claude ? "on" : "off"}">${f.claude ? "Claude connected" : "Claude not connected"}</a>${
    desk.monthCents !== undefined
      ? `<span aria-hidden="true">·</span><span title="Conversations started this month, estimated at list prices">${dollars(desk.monthCents)} in conversations this month</span>`
      : ""
  }</div></div><div class="desk-tools"><a href="/admin/workbench" class="btn sm" title="Processing, leads and the old research">Workbench</a></div></div>`;

  const tools = `<div class="q-tools"><form method="get" action="/admin"><button type="submit" class="toggle" name="decided" value="${on ? "0" : "1"}" aria-pressed="${on}"><span class="sw" aria-hidden="true"></span>Show decided<span class="n">${decided.length}</span></button></form><a href="/op/export" class="btn" title="Every document, article and paper, as Markdown in a few zips"><span class="g g-dl" aria-hidden="true">↓</span>Download the record <span class="sub">.zip</span></a></div>`;

  const add = `<div class="q-add" data-drop><form method="post" action="/op/admin/link" class="q-url"><span class="plus" aria-hidden="true">+</span><label for="q-url" class="vh">Paste a link</label><input id="q-url" type="url" name="url" placeholder="Paste a link or drop a file" required /><button type="submit" class="btn sm">Add</button></form><form method="post" action="/op/feed/upload" enctype="multipart/form-data" data-upload-form><label class="btn ghost file">Choose files<input type="file" name="file" multiple accept=".md,.markdown,.txt,.html,.pdf,.docx,.zip" data-autosubmit /></label><noscript><button type="submit" class="btn">Upload</button></noscript></form></div>`;

  const queue = `<div class="q-list">${cards.join("")}${open ? "" : '<div class="d-clear">Nothing waiting. Add something above.</div>'}</div>${
    on && decided.length
      ? `<h3 class="desk-gh" style="margin:28px 0 10px">Decided this week <span>${decided.length}</span></h3><div class="q-list">${decided.join("")}</div>`
      : ""
  }`;

  const pane = `<section class="desk-pane" aria-label="Waiting for you"><div class="desk-path"><code>/admin</code>waiting for you</div><div class="desk-sheet"><div class="desk-inner"><div class="q-head"><div><h2 class="q-h1">Waiting for you <span class="q-count${open ? "" : " clear"}">${open}</span></h2><p class="q-sub">Nothing here is on the site until you publish it.</p></div>${tools}</div>${flash(f)}${add}${queue}</div></div></section>`;

  return shell({
    title: "Admin",
    description: "Admin: what is in progress, and what is waiting for a decision.",
    path: "/admin",
    noindex: true,
    signedIn: true,
    waiting: open,
    mainClass: "desk-main",
    app: true,
    // On a phone, the two halves are tabs (the page's script); without it
    // they stack.
    body: `${top}<div class="desk-tabs" role="tablist" aria-label="Show" data-desk-tabs hidden><button type="button" role="tab" data-desk-tab="side" aria-selected="true">Your work</button><button type="button" role="tab" data-desk-tab="queue" aria-selected="false">Waiting <span class="q-count${open ? "" : " clear"}">${open}</span></button></div><div class="desk" data-desk>${side(desk, reads)}${pane}</div>`,
  });
}

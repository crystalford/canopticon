// /admin — the operator's page. docs/blackbox/README.md §Desk;
// pages/Canopticon Admin.dc.html. "Add something" (drop, choose, or paste a
// link) and "Waiting for you": one card per decision, each with a kind, a
// status, one primary action and one secondary, and Undo once decided.
//
// "Nothing publishes without Publish." An upload is read and sorted by its
// shape (lib/sort-upload.ts) and waits here as working-material. Every
// button is a plain form POST to /op/admin/* (operator/routes/admin.ts), so
// the page works without script; /site.js only adds drag-and-drop.

import { SORT_LABELS, type SortedAs } from "../../lib/sort-upload";
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

function card(args: {
  kind: string;
  kindLabel: string;
  status: string;
  statusPair: readonly [string, string];
  when: string;
  title: string;
  note: string;
  body?: string;
  muted?: boolean;
}): string {
  return `<div class="d-card${args.muted ? " muted" : ""}"><div class="d-top">${chip(args.kindLabel, KIND_PAIR[args.kind] ?? KIND_PAIR.research ?? ["#efebe1", "#15171c"])}${chip(args.status, args.statusPair)}<span class="d-when">${esc(args.when)}</span></div><div class="d-title">${esc(args.title)}</div><div class="d-note">${args.note}</div>${args.body ?? ""}</div>`;
}

function waitingCard(p: AdminPiece, topics: string[]): string {
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
  const form = `<form method="post" action="/op/admin/${esc(p.id)}/publish" class="d-form"><div class="d-row"><span class="d-lab">Read as</span>${kinds}</div><div class="d-row"><label class="d-lab" for="t-${esc(p.id)}">Topic</label><select id="t-${esc(p.id)}" name="topic" class="d-select">${topicOpts}</select></div><div class="d-actions"><a href="/admin/review/${esc(p.id)}" class="d-btn link">Review</a>${personal ? "" : `<button type="submit" class="d-btn" formaction="/op/read/${esc(p.slug)}">Read it</button>`}<button type="submit" class="d-btn">${personal ? "Publish anyway" : "Publish"}</button><button type="submit" class="d-btn" formaction="/op/admin/${esc(p.id)}/private">Keep private</button><button type="submit" class="d-btn quiet" formaction="/op/admin/${esc(p.id)}/remove">Remove</button></div></form>`;
  const note = personal
    ? `Read as <strong>personal</strong> because it ${esc(p.sortedWhy)}. It stays private unless you change how it is read, or publish it anyway.`
    : `Read as ${esc(SORT_LABELS[p.sortedAs].toLowerCase())} because it ${esc(p.sortedWhy)}. ${Math.max(1, Math.round(p.chars / 1000))}k characters.`;
  return card({
    kind: p.sortedAs,
    kindLabel: SORT_LABELS[p.sortedAs],
    status: personal ? "Held private" : "Ready to publish",
    statusPair: personal ? STATUS_PAIR.held : STATUS_PAIR.ready,
    when: shortDate(p.createdAt.slice(0, 10)),
    title: p.title,
    note,
    body: form,
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
    note: "There was no text to read in this file — usually a PDF without a text layer. Upload a text export, or remove it.",
    body: `<form method="post" action="/op/library/${esc(p.id)}/replace" enctype="multipart/form-data" class="d-actions"><label class="d-btn file">Upload text<input type="file" name="file" accept=".md,.txt,.pdf,.docx" required data-autosubmit /></label><noscript><button type="submit" class="d-btn">Send</button></noscript><button type="submit" class="d-btn quiet" formaction="/op/admin/${esc(p.id)}/remove" formenctype="application/x-www-form-urlencoded" formnovalidate>Remove</button></form>`,
  });
}

function doneCard(p: AdminPiece, label: string, undo: string): string {
  return card({
    kind: p.sortedAs,
    kindLabel: SORT_LABELS[p.sortedAs],
    status: label,
    statusPair: STATUS_PAIR.done,
    when: shortDate((p.publishedAt ?? p.createdAt).slice(0, 10)),
    title: p.title,
    note:
      p.status === "published"
        ? `Live at <a href="/p/${esc(p.slug)}" class="ulink">/p/${esc(p.slug)}</a>.`
        : "Stored, read, and not public.",
    muted: true,
    body: `<form method="post" action="${esc(undo)}" class="d-actions">${
      p.status === "published"
        ? `<button type="submit" class="d-btn" formaction="/op/read/${esc(p.slug)}">Read it</button>`
        : ""
    }<button type="submit" class="d-btn quiet">Undo</button></form>`,
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
    body: `<div class="d-actions"><a href="/ideas" class="d-btn link">See them</a></div>`,
  });
}

export interface AdminFlash {
  uploaded?: string | undefined;
  ingested?: string | undefined;
  dupes?: string | undefined;
  dedup?: string | undefined;
  error?: string | undefined;
  done?: string | undefined;
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

export function renderAdmin(model: AdminModel, f: AdminFlash = {}): string {
  const topics = hubTopics().map((t) => t.name);
  const cards = [
    ...model.waiting.map((p) => waitingCard(p, topics)),
    ...model.failed.map(failedCard),
    namesCard(),
    heldCard(),
  ].filter(Boolean);
  const open = model.waiting.length + model.failed.length;
  const decided = [
    ...model.published.map((p) => doneCard(p, "Published", `/op/admin/${p.id}/unpublish`)),
    ...model.kept.map((p) => doneCard(p, "Kept private", `/op/admin/${p.id}/undo`)),
  ];
  const count = open
    ? `<span class="d-count" style="background:#fbe9df;color:#8a3a1f">${open} waiting</span>`
    : `<span class="d-count" style="background:#e3f0e6;color:#1f5e36">All clear</span>`;

  const add = `<section aria-label="Add" class="d-add" data-drop><div class="d-add-h">Add something</div><div class="d-add-p">Drop a file, choose one, or paste a link. It is read and sorted first — research, article or paper — and waits below until you publish it.</div><div class="d-add-row"><form method="post" action="/op/admin/link" class="d-url"><input type="url" name="url" placeholder="Paste a link — a report, a doc, a PDF" required /><button type="submit" class="d-btn">Add</button></form><form method="post" action="/op/feed/upload" enctype="multipart/form-data" class="d-files" data-upload-form><label class="d-btn file">Choose files<input type="file" name="file" multiple accept=".md,.markdown,.txt,.pdf,.docx,.zip" data-autosubmit /></label><noscript><button type="submit" class="d-btn">Upload</button></noscript></form></div></section>`;

  const body = `<div class="d-head"><h1 class="d-h1">Admin</h1>${count}<span class="d-links"><a href="/admin/write" class="ulink">Write and research with Claude</a><a href="/admin/workbench" class="ulink">Workbench — processing, leads, research</a><a href="/op/export" class="ulink">Download as .zip</a></span></div>${flash(f)}${add}<section style="margin-top:32px"><div class="ruled-h" style="margin-bottom:0"><h2>Waiting for you</h2><span class="d-count" style="background:var(--tint);color:var(--ink)">${open}</span></div><div class="d-grid">${cards.length ? cards.join("") : ""}${open ? "" : '<div class="d-clear">Nothing waiting. Add something above.</div>'}</div></section>${
    decided.length
      ? `<section style="margin-top:32px"><div class="ruled-h" style="margin-bottom:0"><h2>Decided this week</h2></div><div class="d-grid">${decided.join("")}</div></section>`
      : ""
  }<section class="d-how"><strong>How a file is sorted. </strong>A report with a TL;DR, key findings and numbered sources is read as <strong>research</strong>. A piece with an abstract and a reference list is a <strong>paper</strong>. A first-person argument with no findings block is an <strong>article</strong>. A file that names you or your health is held as <strong>personal</strong>. You can change any of these before it publishes.</section>`;

  return shell({
    title: "Admin",
    description: "Admin: what is waiting for a decision.",
    path: "/admin",
    noindex: true,
    signedIn: true,
    waiting: open,
    body,
  });
}

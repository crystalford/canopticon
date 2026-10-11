// /library — every record in one list. docs/blackbox/README.md §Library;
// pages/Canopticon Library.dc.html. The prototype filters in the browser;
// here every tab, topic, kind and sort is a link with a query string, so the
// page is whole without JavaScript, every view has a URL, and a crawler sees
// what a reader sees. Lists are finite: fifty rows a page, with an end.

import type { DerivedRow, LibraryItem } from "../content/store";
import { keyFigures, libraryItems, questions } from "../content/store";
import { esc, shell } from "../layout";
import { kindColours, topicColours, topicSlug } from "../theme";

type Row = (LibraryItem | DerivedRow) & { v?: string; sub?: string; shelf?: string };

interface Group {
  id: string;
  label: string;
  kinds: string[] | null;
  members?: Array<[string, string]>;
  signedIn?: boolean;
}

const GROUPS: Group[] = [
  { id: "all", label: "All", kinds: null },
  {
    id: "Writing",
    label: "Writing",
    kinds: ["Article", "Paper"],
    members: [
      ["Article", "Articles"],
      ["Paper", "Papers"],
    ],
  },
  { id: "Research", label: "Research", kinds: ["Research"] },
  {
    id: "Ideas",
    label: "Ideas",
    kinds: ["Concept", "Open problem", "Question"],
    members: [
      ["Concept", "Concepts"],
      ["Open problem", "Open problems"],
      ["Question", "Questions"],
    ],
  },
  { id: "Figure", label: "Key figures", kinds: ["Figure"] },
  { id: "Project", label: "Projects", kinds: ["Project"], signedIn: true },
  { id: "Investigation", label: "Investigations", kinds: null },
];

/** ?kind= accepts a group or a member, as the prototype's ?k= did. */
const KIND_PARAM: Record<string, [string, string]> = {
  Article: ["Writing", "Article"],
  Paper: ["Writing", "Paper"],
  Writing: ["Writing", "all"],
  Concept: ["Ideas", "Concept"],
  "Open problem": ["Ideas", "Open problem"],
  Question: ["Ideas", "Question"],
  Ideas: ["Ideas", "all"],
  Research: ["Research", "all"],
  Figure: ["Figure", "all"],
  Project: ["Project", "all"],
  Investigation: ["Investigation", "all"],
};

const SORTS: Array<{
  id: string;
  label: string;
  writing?: boolean;
  cmp: (a: Row, b: Row) => number;
}> = [
  { id: "newest", label: "Newest", cmp: (a, b) => b.date.localeCompare(a.date) },
  { id: "az", label: "A–Z", cmp: (a, b) => a.title.localeCompare(b.title) },
  {
    id: "short",
    label: "Shortest read",
    cmp: (a, b) => ((a as LibraryItem).min || 999) - ((b as LibraryItem).min || 999),
  },
  {
    id: "evidence",
    label: "Most evidence",
    writing: true,
    cmp: (a, b) =>
      ((b as LibraryItem).quotes || 0) / ((b as LibraryItem).min || 1) -
      ((a as LibraryItem).quotes || 0) / ((a as LibraryItem).min || 1),
  },
  {
    id: "coined",
    label: "Names coined",
    writing: true,
    cmp: (a, b) =>
      ((b as LibraryItem).coined || 0) - ((a as LibraryItem).coined || 0) ||
      b.date.localeCompare(a.date),
  },
];

const DERIVED = new Set(["Question", "Figure"]);
const PAGE = 50;
const TOPICS_SHOWN = 6;

const subName = (d: Row) => {
  const k = d.sub || "Research";
  return k === "Research" ? "Other report" : /^Evidence only/.test(k) ? "Evidence only" : k;
};

function inGroup(d: Row, id: string): boolean {
  if (id === "Investigation") return d.shelf === "investigation";
  if (d.shelf === "investigation") return false;
  if (id === "all") return !DERIVED.has(d.kind);
  const g = GROUPS.find((x) => x.id === id);
  return !!g?.kinds && g.kinds.includes(d.kind);
}

export interface LibraryQuery {
  kind?: string | undefined;
  topic?: string | undefined;
  sub?: string | undefined;
  sort?: string | undefined;
  q?: string | undefined;
  page?: string | undefined;
  topics?: string | undefined;
}

/** The investigations shelf is the same list, fixed to one shelf, at its
 *  own address (README §Investigations: "the same list shape"). */
export interface Shelf {
  base: string;
  title: string;
  lede: string;
  searchLabel: string;
}

export const INVESTIGATIONS: Shelf = {
  base: "/investigations",
  title: "Investigations",
  lede: 'Dossiers, fact-checks and stress tests on Canadian politics, finance and media. These are working files: open lines of inquiry, sourced but not conclusions, and kept apart from the main record. <a href="/library" class="ulink">← Back to the Library</a>',
  searchLabel: "Filter investigations by title, summary or topic",
};

export function renderLibrary(
  query: LibraryQuery,
  opts: { signedIn?: boolean; shelf?: Shelf } = {},
): string {
  const signedIn = opts.signedIn ?? false;
  const shelf = opts.shelf;
  const [group0, member0] = shelf
    ? ["Investigation", "all"]
    : (KIND_PARAM[query.kind ?? ""] ?? ["all", "all"]);
  const groupId = !signedIn && group0 === "Project" ? "all" : group0;
  const member = groupId === group0 ? member0 : "all";
  const group = GROUPS.find((g) => g.id === groupId) ?? GROUPS[0];

  const all: Row[] = [...libraryItems({ signedIn }), ...questions(), ...keyFigures()] as Row[];
  // Topic arrives as a slug or as the name itself.
  const topicNames = new Map(all.map((d) => [topicSlug(d.topic), d.topic]));
  const topic = query.topic ? (topicNames.get(topicSlug(query.topic)) ?? "all") : "all";
  const sort =
    SORTS.find(
      (s) => s.id === query.sort && (!s.writing || groupId === "Writing" || groupId === "all"),
    ) ?? SORTS[0];
  const q = (query.q ?? "").trim().toLowerCase().slice(0, 200);
  const sub = query.sub ?? "all";

  const state = {
    kind: query.kind,
    topic: topic === "all" ? undefined : topicSlug(topic),
    sub,
    sort: sort?.id,
    q: query.q,
    topics: query.topics,
  };
  const href = (o: Partial<typeof state> & { page?: number }) => {
    const s = { ...state, ...o };
    const sp = new URLSearchParams();
    if (s.kind) sp.set("kind", s.kind);
    if (s.topic) sp.set("topic", s.topic);
    if (s.sub && s.sub !== "all") sp.set("sub", s.sub);
    if (s.sort && s.sort !== "newest") sp.set("sort", s.sort);
    if (s.q) sp.set("q", s.q);
    if (s.topics) sp.set("topics", s.topics);
    if (o.page && o.page > 1) sp.set("page", String(o.page));
    const str = sp.toString();
    return `${shelf?.base ?? "/library"}${str ? `?${str}` : ""}`;
  };

  // The kind tabs, counted within the chosen topic.
  const byTopic = all.filter((d) => topic === "all" || d.topic === topic);
  const tabs = GROUPS.filter((g) => (shelf ? g.id === groupId : !g.signedIn || signedIn))
    .map((g) => {
      const on = g.id === groupId;
      const n = byTopic.filter((d) => inGroup(d, g.id)).length;
      const label = shelf ? `All ${shelf.title.toLowerCase()}` : g.label;
      return `<a href="${esc(href({ kind: shelf || g.id === "all" ? undefined : g.id, sub: "all", topics: undefined }))}" role="tab" aria-current="${on}"${on ? ' aria-selected="true"' : ""}>${esc(label)}<span class="n">${n}</span></a>`;
    })
    .join("");

  const byKind = all.filter((d) => inGroup(d, groupId));

  // Member chips: Articles / Papers, Concepts / Open problems / Questions.
  const memberSrc = byKind.filter((d) => topic === "all" || d.topic === topic);
  const members = (group?.members ?? [])
    .map(([id, label]) => {
      const on = member === id;
      const [bg, fg] = kindColours(id);
      const sand = fg === "#15171c";
      const style = on
        ? sand
          ? "background:var(--rule);color:var(--ink)"
          : `background:${fg};color:${bg}`
        : `background:${bg};color:${fg}`;
      return `<a href="${esc(href({ kind: on ? group?.id : id }))}" aria-current="${on}" style="${style}">${esc(label)}<span class="n">${memberSrc.filter((d) => d.kind === id).length}</span></a>`;
    })
    .join("");

  // Topic chips, the six biggest first, the rest behind "+N more topics".
  const tCount = new Map<string, number>();
  for (const d of byKind) tCount.set(d.topic, (tCount.get(d.topic) ?? 0) + 1);
  const names = [...tCount.keys()]
    .filter((n) => n && n !== "Other")
    .sort((a, b) => (tCount.get(b) ?? 0) - (tCount.get(a) ?? 0));
  const expanded = query.topics === "all";
  const hidden = Math.max(0, names.length - TOPICS_SHOWN);
  let shown = expanded || hidden === 0 ? names : names.slice(0, TOPICS_SHOWN);
  if (topic !== "all" && !shown.includes(topic)) shown = [...shown, topic];
  const chip = (id: string, label: string, count: number) => {
    const on = topic === id;
    const [bg, fg] = id === "all" ? ["#e6ecfa", "#2f55c4"] : topicColours(id);
    return `<a href="${esc(href({ topic: id === "all" ? undefined : topicSlug(id), sub: "all" }))}" aria-current="${on}"${on ? ` style="background:${bg};color:${fg}"` : ""}>${esc(label)}<span class="n"${on ? ` style="color:${fg}"` : ""}>${count}</span></a>`;
  };
  const topicChips = [
    chip("all", "All topics", byKind.length),
    ...shown.map((n) => chip(n, n, tCount.get(n) ?? 0)),
    hidden
      ? `<a class="more" href="${esc(href({ topics: expanded ? undefined : "all" }))}">${expanded ? "Fewer topics" : `+${hidden} more topics`}</a>`
      : "",
  ].join("");

  // Research: "Kind of document".
  const subCount = new Map<string, number>();
  if (groupId === "Research" || groupId === "Investigation") {
    for (const d of byKind) {
      if (d.kind !== "Research" || (topic !== "all" && d.topic !== topic)) continue;
      subCount.set(subName(d), (subCount.get(subName(d)) ?? 0) + 1);
    }
  }
  const subs = subCount.size
    ? `<div class="mchips"><span class="l">Kind of document</span>${[
        ["all", "All kinds", [...subCount.values()].reduce((a, b) => a + b, 0)] as const,
        ...[...subCount]
          .sort(
            (a, b) =>
              Number(a[0] === "Other report") - Number(b[0] === "Other report") || b[1] - a[1],
          )
          .map(([k, n]) => [k, k, n] as const),
      ]
        .map(
          ([id, label, n]) =>
            `<a class="sub" href="${esc(href({ sub: id }))}" aria-current="${sub === id}">${esc(label)}<span class="n">${n}</span></a>`,
        )
        .join("")}</div>`
    : "";

  const list = byKind
    .filter(
      (d) =>
        (member === "all" || d.kind === member) &&
        (topic === "all" || d.topic === topic) &&
        ((groupId !== "Research" && groupId !== "Investigation") ||
          sub === "all" ||
          subName(d) === sub) &&
        (!q || `${d.title} ${d.dek ?? ""} ${d.topic}`.toLowerCase().includes(q)),
    )
    .slice()
    .sort(sort?.cmp ?? (() => 0));

  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  const slice = list.slice((page - 1) * PAGE, page * PAGE);

  const hubTopic =
    topic !== "all" &&
    libraryItems().some(
      (d) => d.topic === topic && d.kind !== "Project" && d.shelf !== "investigation",
    );

  const rows = slice
    .map((d, i) => {
      const [kbg, kfg] = kindColours(d.kind);
      const [tbg, tfg] = topicColours(d.topic);
      const stat = d.kind === "Concept" || d.kind === "Open problem" ? "" : (d.stat ?? "");
      const status =
        d.kind === "Concept"
          ? /pending/.test(d.stat ?? "")
            ? ["Name check pending", "#f3e9d4", "#6b4e14"]
            : /approved/.test(d.stat ?? "")
              ? ["Approved", "#e3f0e6", "#1f5e36"]
              : ["No prior use found", "#e3f0e6", "#1f5e36"]
          : d.kind === "Open problem"
            ? ["Open", "#fbe9df", "#8a3a1f"]
            : null;
      const subLabel = d.kind === "Research" && d.sub && d.sub !== "Research" ? subName(d) : "";
      const dek = d.kind === "Research" && d.dek === d.sub ? "" : d.dek;
      const metric = d.kind === "Figure" ? (d.v ?? "") : (d.dateLabel ?? "");
      return `<div class="lib-row"><span class="lib-rank">${String((page - 1) * PAGE + i + 1).padStart(2, "0")}</span><span style="min-width:0"><a href="${esc(d.route)}" class="lib-t">${esc(d.title)}</a>${dek ? `<span class="lib-d">${esc(dek)}</span>` : ""}<span class="lib-m"><span class="pill kind" style="background:${kbg};color:${kfg}">${esc(d.kind)}</span>${subLabel ? `<span class="pill sub">${esc(subLabel)}</span>` : ""}<span class="pill" style="background:${tbg};color:${tfg}">${esc(d.topic)}</span>${status ? `<span class="pill" style="background:${status[1]};color:${status[2]}">${esc(status[0] ?? "")}</span>` : ""}${stat ? `<span class="st">${esc(stat)}</span>` : ""}</span></span><span class="lib-r"><span class="lib-metric">${esc(metric)}</span>${d.kind === "Figure" ? `<span class="lib-ml">${esc(d.dateLabel ?? "")}</span>` : ""}${signedIn ? `<button type="button" class="useful" data-useful="${esc(d.route)}" aria-pressed="false" hidden>☆ Mark useful</button>` : ""}</span></div>`;
    })
    .join("");

  const note =
    groupId === "Investigation" && !shelf
      ? `<div class="lib-note"><strong>Working files. </strong>Dossiers, fact-checks and stress tests on Canadian politics, finance and media — open lines of inquiry, sourced but not conclusions. They are kept out of "All" and the main topics.</div>`
      : member === "Question"
        ? `<div class="lib-note"><strong>Questions the research set out to answer. </strong>Each one is a question a document asks in its own words. Open the document to see the answer it reached and what it could not settle.</div>`
        : groupId === "Figure"
          ? `<div class="lib-note"><strong>Every number the research reported. </strong>Figures taken from the summaries and findings of the documents, with the sentence each one came in. The document it links to carries the source.</div>`
          : "";

  const sortOpts = SORTS.filter((s) => !s.writing || groupId === "Writing" || groupId === "all");
  const sortBar = `<div class="sortbar"><span class="l">Sort</span>${sortOpts
    .map(
      (s) =>
        `<a href="${esc(href({ sort: s.id }))}" aria-current="${s.id === sort?.id}">${esc(s.label)}</a>`,
    )
    .join("")}</div>`;

  const pager =
    pages > 1
      ? `<nav class="pager" aria-label="Pages"><span>Showing ${(page - 1) * PAGE + 1}–${Math.min(page * PAGE, list.length)} of ${list.length}</span><span class="pages">${Array.from(
          { length: pages },
          (_, i) =>
            i + 1 === page
              ? `<span aria-current="page">${i + 1}</span>`
              : `<a href="${esc(href({ page: i + 1 }))}">${i + 1}</a>`,
        ).join("")}</span></nav>`
      : "";

  const hidden2 = Object.entries({
    kind: query.kind,
    topic: state.topic,
    sub: sub === "all" ? undefined : sub,
    sort: sort?.id === "newest" ? undefined : sort?.id,
  })
    .filter(([, v]) => v)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v ?? "")}" />`)
    .join("");

  const body = `<div><h1 class="h-page">${esc(shelf?.title ?? "Library")}</h1></div><p class="lede">${shelf?.lede ?? "Everything in one place. Articles argue from the research; papers are longer original work; research documents are kept whole; concepts and open problems are what the research turned up."}</p><section style="margin-top:28px"><form class="lib-search" role="search" method="get" action="${shelf?.base ?? "/library"}"><span aria-hidden="true">⌕</span>${hidden2}<input type="search" name="q" value="${esc(query.q ?? "")}" placeholder="${esc(shelf?.searchLabel ?? "Filter the library by title, summary or topic")}" aria-label="${esc(shelf ? `Filter ${shelf.title.toLowerCase()}` : "Filter the library")}" data-search-input /></form><div role="tablist" aria-label="Kind" class="seg">${tabs}</div><div class="tchips">${topicChips}</div>${members ? `<div class="mchips">${members}</div>` : ""}${subs}${hubTopic ? `<a href="/topics/${esc(topicSlug(topic))}" class="btn hub-link">Open the ${esc(topic)} topic page</a>` : ""}${sortBar}<div class="lib"><div class="lib-head"><span>${list.length} ${list.length === 1 ? "item" : "items"}</span><span>${groupId === "Figure" ? "Figure" : "Added"}</span></div>${note}${list.length ? rows : `<div class="lib-empty">Nothing matches. Try another topic or clear the filter.</div>`}${pager}</div></section>`;

  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Canopticon library",
    description:
      "Articles, papers, research documents, concepts and open problems by Chris Telford.",
    author: { "@type": "Person", name: "Chris Telford", url: "https://canopticon.com/about" },
  };
  return shell({
    title: shelf?.title ?? "Library",
    description:
      "Articles, papers, research documents, concepts and open problems by Chris Telford.",
    path: shelf?.base ?? "/library",
    nav: "library",
    signedIn,
    noindex: !!query.q,
    head: `<script type="application/ld+json">${JSON.stringify(ld)}</script>`,
    body,
  });
}

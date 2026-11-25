// /library — every record in one list. docs/blackbox/README.md §Library;
// pages/Canopticon Library.dc.html. The prototype filters in the browser;
// here every tab, topic, kind and sort is a link with a query string, so the
// page is whole without JavaScript, every view has a URL, and a crawler sees
// what a reader sees. Lists are finite: fifty rows a page, with an end.

import { AUTHOR } from "../author";
import type { DerivedRow, LibraryItem } from "../content/store";
import { keyFigures, libraryItems, questions } from "../content/store";
import { esc, pageHead, shell } from "../layout";
import { kindColours, kindLabel, topicColours, topicSlug } from "../theme";

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
  { id: "Theory", label: "Theories", kinds: ["Theory"] },
  {
    id: "Writing",
    label: "Writing",
    kinds: ["Essay", "Paper", "Article"],
    members: [
      ["Essay", "Essays"],
      ["Paper", "Papers"],
    ],
  },
  {
    id: "Research",
    label: "Research",
    kinds: ["Research", "Brief"],
    members: [
      ["Report", "Reports"],
      ["Brief", "Briefs"],
      ["Investigation", "Investigations"],
    ],
  },
  { id: "Terms", label: "Terms", kinds: ["Concept"] },
  {
    id: "Open",
    label: "Open questions",
    kinds: ["Open problem", "Question"],
    members: [
      ["Open problem", "Open questions"],
      ["Question", "Asked by the research"],
    ],
  },
  { id: "Figure", label: "Key figures", kinds: ["Figure"] },
  { id: "Project", label: "Projects", kinds: ["Project"], signedIn: true },
];

/** ?kind= accepts a group or a member, as the prototype's ?k= did. Old
 *  names still land: Article → Writing, Ideas → Terms, Concept → Terms. */
const KIND_PARAM: Record<string, [string, string]> = {
  Theory: ["Theory", "all"],
  Paper: ["Writing", "Paper"],
  Writing: ["Writing", "all"],
  Article: ["Writing", "all"],
  Essay: ["Writing", "Essay"],
  Brief: ["Research", "Brief"],
  Research: ["Research", "all"],
  Report: ["Research", "Report"],
  Investigation: ["Research", "Investigation"],
  Terms: ["Terms", "all"],
  Concept: ["Terms", "all"],
  Ideas: ["Terms", "all"],
  Open: ["Open", "all"],
  "Open problem": ["Open", "Open problem"],
  Question: ["Open", "Question"],
  Figure: ["Figure", "all"],
  Project: ["Project", "all"],
};

/** A member chip's test: most are a kind; Research splits by shelf. */
function isMember(d: Row, id: string): boolean {
  if (id === "Investigation") return d.shelf === "investigation";
  if (id === "Report") return d.kind === "Research" && d.shelf !== "investigation";
  if (id === "Essay") return d.kind === "Essay" || d.kind === "Article";
  return d.kind === id;
}

const SORTS: Array<{
  id: string;
  label: string;
  writing?: boolean;
  /** Only for the signed-in author, who is the only one who can mark. */
  author?: boolean;
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
  // The marks live in this browser (site.js), so the server sends the whole
  // list newest-first on one page and the script lifts the marked rows to
  // the top. Without the script it is simply Newest.
  {
    id: "useful",
    label: "Marked useful",
    author: true,
    cmp: (a, b) => b.date.localeCompare(a.date),
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
  // Investigations are research, shown under Research; they stay out of
  // "All" and the topics because they are working files, not conclusions.
  if (id === "Research") return d.kind === "Research" || d.kind === "Brief";
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

/** A shelf is one group of the same list at its own address, with its own
 *  heading and lede: Writing, Research and Open questions. */
export interface Shelf {
  base: string;
  title: string;
  group: string;
  /** The member shown when the address names none. */
  member?: string;
  /** The section it belongs to, and a label after it in the header. */
  section?: "theories" | "writing" | "research" | "lexicon";
  label?: string;
  lede: string;
  searchLabel: string;
}

export const WRITING: Shelf = {
  base: "/writing",
  title: "Writing",
  group: "Writing",
  section: "writing",
  lede: 'The author\u2019s own arguments, short and long. An <strong>essay</strong> argues one idea in a few minutes\u2019 reading; a <strong>paper</strong> works an idea through the published research with numbered references. Seven of the papers are <a href="/papers">a series on McLuhan and the senses</a>.',
  searchLabel: "Filter essays and papers by title, summary or topic",
};

export const RESEARCH: Shelf = {
  base: "/research",
  title: "Research",
  group: "Research",
  section: "research",
  lede: "The evidence. <strong>Reports</strong> are the research documents, each kept whole and published as it was written. <strong>Briefs</strong> are short answers to one question, written from those reports, with every quotation checked word for word against the one it comes from. <strong>Investigations</strong> are the working files on Canadian politics, finance and media: sourced, but open lines of inquiry rather than conclusions.",
  searchLabel: "Filter the research by title, summary or topic",
};

export const OPEN: Shelf = {
  base: "/open",
  title: "Open questions",
  group: "Open",
  section: "lexicon",
  label: "Beside the Lexicon",
  member: "Open problem",
  lede: "Questions the research raised and could not settle, each with what is known, what is missing and where it came from. <strong>Asked by the research</strong> lists the questions the research documents set out to answer, each linking to the passage that answers it.",
  searchLabel: "Filter open questions by title or topic",
};

export function renderLibrary(
  query: LibraryQuery,
  opts: { signedIn?: boolean; shelf?: Shelf } = {},
): string {
  const signedIn = opts.signedIn ?? false;
  const shelf = opts.shelf;
  const asked = KIND_PARAM[query.kind ?? ""];
  const [group0, member0] = shelf
    ? [shelf.group, asked && asked[0] === shelf.group ? asked[1] : (shelf.member ?? "all")]
    : (asked ?? ["all", "all"]);
  const groupId = !signedIn && group0 === "Project" ? "all" : group0;
  const member = groupId === group0 ? member0 : "all";
  const group = GROUPS.find((g) => g.id === groupId) ?? GROUPS[0];

  const all: Row[] = [...libraryItems({ signedIn }), ...questions(), ...keyFigures()] as Row[];
  // Topic arrives as a slug or as the name itself.
  const topicNames = new Map(all.map((d) => [topicSlug(d.topic), d.topic]));
  const topic = query.topic ? (topicNames.get(topicSlug(query.topic)) ?? "all") : "all";
  const offered = (s: (typeof SORTS)[number]) =>
    (!s.writing || groupId === "Writing" || groupId === "all") && (!s.author || signedIn);
  const sort = SORTS.find((s) => s.id === query.sort && offered(s)) ?? SORTS[0];
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
  const tabs = GROUPS.filter((g) => !shelf && (!g.signedIn || signedIn))
    .map((g) => {
      const on = g.id === groupId;
      const n = byTopic.filter((d) => inGroup(d, g.id)).length;
      const label = g.label;
      return `<a href="${esc(href({ kind: g.id === "all" ? undefined : g.id, sub: "all", topics: undefined }))}" role="tab" aria-current="${on}"${on ? ' aria-selected="true"' : ""}>${esc(label)}<span class="n">${n}</span></a>`;
    })
    .join("");

  const byKind = all.filter((d) => inGroup(d, groupId));

  // Member chips: Articles / Papers, Concepts / Open problems / Questions.
  const memberSrc = byKind.filter((d) => topic === "all" || d.topic === topic);
  // One segmented control: All, then each member (2026-11-24). On the
  // Library it sits under the group tabs; on a shelf it is the only one.
  const allKind = shelf ? (shelf.member ? shelf.group : undefined) : group?.id;
  const members = group?.members?.length
    ? [
        `<a href="${esc(href({ kind: allKind, sub: "all" }))}" aria-current="${member === "all"}">All<span class="n">${memberSrc.length}</span></a>`,
        ...group.members.map(
          ([id, label]) =>
            `<a href="${esc(href({ kind: id, sub: "all" }))}" aria-current="${member === id}">${esc(label)}<span class="n">${memberSrc.filter((d) => isMember(d, id)).length}</span></a>`,
        ),
      ].join("")
    : "";

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
    return `<a href="${esc(href({ topic: id === "all" ? undefined : topicSlug(id), sub: "all" }))}" aria-current="${on}">${esc(label)}<span class="n">${count}</span></a>`;
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
  if (groupId === "Research") {
    for (const d of byKind) {
      if (!isMember(d, "Report") || (topic !== "all" && d.topic !== topic)) continue;
      subCount.set(subName(d), (subCount.get(subName(d)) ?? 0) + 1);
    }
  }
  // Kind of document only means something for reports, and is folded away
  // until asked for: one line saying what is chosen.
  const subs =
    subCount.size > 1 && member === "Report"
      ? `<details class="fsub"${sub !== "all" ? " open" : ""}><summary><span class="frow-l">Kind</span><span class="fsub-v">${esc(sub === "all" ? "All kinds of report" : sub)}</span><span class="fsub-c" aria-hidden="true">\u25be</span></summary><div class="tchips">${[
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
              `<a href="${esc(href({ sub: id }))}" aria-current="${sub === id}">${esc(label)}<span class="n">${n}</span></a>`,
          )
          .join("")}</div></details>`
      : "";

  const list = byKind
    .filter(
      (d) =>
        (member === "all" || isMember(d, member)) &&
        (topic === "all" || d.topic === topic) &&
        (groupId !== "Research" || member !== "Report" || sub === "all" || subName(d) === sub) &&
        (!q || `${d.title} ${d.dek ?? ""} ${d.topic}`.toLowerCase().includes(q)),
    )
    .slice()
    .sort(sort?.cmp ?? (() => 0));

  const perPage = sort?.id === "useful" ? Math.max(1, list.length) : PAGE;
  const pages = Math.max(1, Math.ceil(list.length / perPage));
  const page = Math.min(pages, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  const slice = list.slice((page - 1) * perPage, page * perPage);

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
              ? null
              : ["No prior use found", "#e3f0e6", "#1f5e36"]
          : null;
      const subLabel = d.kind === "Research" && d.sub && d.sub !== "Research" ? subName(d) : "";
      const dek = d.kind === "Research" && d.dek === d.sub ? "" : d.dek;
      const metric = d.kind === "Figure" ? (d.v ?? "") : (d.dateLabel ?? "");
      return `<div class="lib-row"><span class="lib-rank">${String((page - 1) * perPage + i + 1).padStart(2, "0")}</span><span style="min-width:0"><a href="${esc(d.route)}" class="lib-t">${esc(d.title)}</a>${dek ? `<span class="lib-d">${esc(dek)}</span>` : ""}<span class="lib-m"><span class="pill kind" style="background:${kbg};color:${kfg}">${esc(kindLabel(d.kind))}</span>${subLabel ? `<span class="pill sub">${esc(subLabel)}</span>` : ""}<span class="pill" style="background:${tbg};color:${tfg}">${esc(d.topic)}</span>${status ? `<span class="pill" style="background:${status[1]};color:${status[2]}">${esc(status[0] ?? "")}</span>` : ""}${stat ? `<span class="st">${esc(stat)}</span>` : ""}</span></span><span class="lib-r"><span class="lib-metric">${esc(metric)}</span>${d.kind === "Figure" ? `<span class="lib-ml">${esc(d.dateLabel ?? "")}</span>` : ""}${signedIn ? `<button type="button" class="useful" data-useful="${esc(d.route)}" aria-pressed="false" hidden>☆ Mark useful</button>` : ""}</span></div>`;
    })
    .join("");

  const note =
    member === "Investigation"
      ? `<div class="lib-note"><strong>Working files. </strong>Dossiers, fact-checks and stress tests on Canadian politics, finance and media — open lines of inquiry, sourced but not conclusions. They are kept out of "All" and the main topics.</div>`
      : member === "Question"
        ? `<div class="lib-note"><strong>Questions the research set out to answer. </strong>Each one is a question a document asks in its own words. Open the document to see the answer it reached and what it could not settle.</div>`
        : groupId === "Figure"
          ? `<div class="lib-note"><strong>Every number the research reported. </strong>Figures taken from the summaries and findings of the documents, with the sentence each one came in. The document it links to carries the source.</div>`
          : "";

  const sortOpts = SORTS.filter(offered);
  const sortBar = `<span class="lib-sort"><span class="l">Sort</span>${sortOpts
    .map(
      (s) =>
        `<a href="${esc(href({ sort: s.id }))}" aria-current="${s.id === sort?.id}">${esc(s.label)}</a>`,
    )
    .join("")}</span>`;

  const pager =
    pages > 1
      ? `<nav class="pager" aria-label="Pages"><span>Showing ${(page - 1) * perPage + 1}–${Math.min(page * perPage, list.length)} of ${list.length}</span><span class="pages">${Array.from(
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

  const body = `${pageHead({
    title: shelf?.title ?? "Library",
    ...(shelf?.section ? { section: shelf.section } : {}),
    label: shelf ? (shelf.label ?? "") : "Everything",
    dek:
      shelf?.lede ??
      "Everything on the site in one list: the theories, the essays and papers that argue them, the research they stand on, and the terms and open questions the work turned up.",
  })}<section><form class="lib-search" role="search" method="get" action="${shelf?.base ?? "/library"}"><span aria-hidden="true">⌕</span>${hidden2}<input type="search" name="q" value="${esc(query.q ?? "")}" placeholder="${esc(shelf?.searchLabel ?? "Filter the library by title, summary or topic")}" aria-label="${esc(shelf ? `Filter ${shelf.title.toLowerCase()}` : "Filter the library")}" data-search-input /></form><div class="filters">${tabs ? `<div class="frow"><span class="frow-l">Show</span><div role="tablist" aria-label="Kind" class="seg">${tabs}</div></div>` : ""}${members ? `<div class="frow"><span class="frow-l">${tabs ? "Within" : "Show"}</span><div role="tablist" aria-label="Show" class="seg">${members}</div></div>` : ""}<div class="frow"><span class="frow-l">Topic</span><div class="tchips">${topicChips}</div></div>${subs}</div>${hubTopic ? `<a href="/topics/${esc(topicSlug(topic))}" class="btn sm hub-link">Open the ${esc(topic)} topic page</a>` : ""}<div class="lib"${sort?.id === "useful" ? " data-useful-sort" : ""}><div class="lib-head"><span>${list.length} ${list.length === 1 ? "item" : "items"}</span>${sortBar}</div>${note}${list.length ? rows : `<div class="lib-empty">Nothing matches. Try another topic or clear the filter.</div>`}${pager}</div></section>`;

  // A shelf describes itself: its lede up to the first link, as plain text.
  const description = shelf
    ? shelf.lede
        .split("<a")[0]
        ?.replace(/<[^>]+>/g, "")
        .trim() || shelf.title
    : "Articles, papers, research documents, concepts and open problems by Chris Telford.";
  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: shelf ? `Canopticon ${shelf.title.toLowerCase()}` : "Canopticon library",
    description,
    author: AUTHOR,
  };
  return shell({
    title: shelf?.title ?? "Library",
    description,
    path: shelf?.base ?? "/library",
    nav: shelf ? (shelf.base.slice(1) as "writing" | "research" | "open") : "library",
    signedIn,
    noindex: !!query.q,
    head: `<script type="application/ld+json">${JSON.stringify(ld)}</script>`,
    body,
  });
}

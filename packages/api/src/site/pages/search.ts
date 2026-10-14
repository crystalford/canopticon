// /search?q= — titles, deks, key figures, questions and the full text of every
// public document. docs/blackbox/README.md §Search; pages/Canopticon
// Search.dc.html, whose logic is ported here to the server: AND-match, quoted
// phrases exact, at most three sentences per document, and every hit links
// to its passage. Tabs and topic narrowing are links, so a result page is a
// URL and works without script. No model, no index service: the passages are
// split once per isolate from the content store and searched in memory.

import type { DerivedRow, LibraryItem } from "../content/store";
import { keyFigures, libraryItems, publicResearch, questions } from "../content/store";
import { esc, shell } from "../layout";
import { passageHref, plain } from "../md";
import { type Pair, kindColours, topicColours, topicSlug } from "../theme";

interface Passage {
  doc: { id: string; title: string; topic: string };
  head: string;
  text: string;
  lc: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

let PASSAGES: Passage[] | null = null;
/** Every sentence of 30+ characters in every public, listed document. */
function passages(): Passage[] {
  if (PASSAGES) return PASSAGES;
  const listed = new Map<string, LibraryItem>();
  for (const r of libraryItems()) if (r.doc) listed.set(r.doc, r);
  const out: Passage[] = [];
  for (const d of publicResearch()) {
    const row = listed.get(d.id);
    if (!row) continue;
    const doc = { id: d.id, title: row.title, topic: row.topic };
    let head = "";
    for (const ln of d.body.replace(/^---[\s\S]*?---\s*/, "").split("\n")) {
      const h = /^#{1,4}\s+(.+)/.exec(ln);
      if (h) {
        head = plain(h[1] ?? "").replace(/^\d+[.)]\s*/, "");
        continue;
      }
      if (/^\s*\|/.test(ln) || /^-{3,}/.test(ln)) continue;
      const t = plain(ln.replace(/^\s*([-*+>]|\d+[.)])\s+/, ""));
      if (t.length < 30) continue;
      for (const s of t.split(/(?<=[.!?])\s+(?=[A-Z“"(])/)) {
        if (s.length >= 30) out.push({ doc, head, text: s, lc: norm(s) });
      }
    }
  }
  PASSAGES = out;
  return out;
}

/** Terms: quoted phrases kept whole, everything else split on spaces. */
export function searchTerms(q: string): string[] {
  const terms: string[] = [];
  norm(q).replace(/"([^"]+)"|(\S+)/g, (m, a?: string, b?: string) => {
    const t = (a ?? b ?? "").trim();
    if (t) terms.push(t);
    return m;
  });
  return terms;
}

interface Hit {
  topic: string;
  href: string;
  text: string;
  big: boolean;
  sub: string;
  pills: Array<{ t: string; pair: Pair }>;
}

const TRIES = [
  "allostasis",
  "naloxone",
  "last-click",
  "streak",
  "short-term rental",
  "orality",
  "83.2%",
];

export interface SearchQuery {
  q?: string | undefined;
  tab?: string | undefined;
  topic?: string | undefined;
  more?: string | undefined;
}

// A term matches at the start of a word: "rent" finds "rents" and "rental",
// not "differently" or "current".
const ESCAPE = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const WORD_START = new Map<string, RegExp>();
function atWordStart(l: string, t: string): boolean {
  let rx = WORD_START.get(t);
  if (!rx) {
    rx = new RegExp(`(?<![\\p{L}\\p{N}])${ESCAPE(t)}`, "u");
    WORD_START.set(t, rx);
  }
  return rx.test(l);
}

export function renderSearch(query: SearchQuery, opts: { signedIn?: boolean } = {}): string {
  const q = (query.q ?? "").slice(0, 200);
  const qt = q.trim();
  const terms = searchTerms(qt);
  const has = (s: string) => {
    const l = norm(s);
    return terms.every((t) => atWordStart(l, t));
  };
  const rx = terms.length
    ? new RegExp(
        `((?<![\\p{L}\\p{N}])(?:${terms
          .map(ESCAPE)
          .sort((a, b) => b.length - a.length)
          .join("|")}))`,
        "giu",
      )
    : null;
  const marked = (s: string) =>
    rx
      ? s
          .split(rx)
          .map((part) => (terms.includes(norm(part)) ? `<mark>${esc(part)}</mark>` : esc(part)))
          .join("")
      : esc(s);
  const clip = (s: string, n: number) => {
    if (s.length <= n) return s;
    const l = norm(s);
    const first = Math.min(...terms.map((t) => (l.indexOf(t) < 0 ? 1e9 : l.indexOf(t))));
    const at = Math.max(0, first - 80);
    return `${at > 0 ? "…" : ""}${s.slice(at, at + n).trim()}${at + n < s.length ? "…" : ""}`;
  };
  const deep = (route: string, text: string) => {
    const m = /^\/p\/([^#?]+)/.exec(route);
    return m ? passageHref(m[1] ?? "", text.split(/\s+/).slice(0, 14).join(" ")) : route;
  };
  const sand = kindColours("Research");

  const topicsHtml = () => {
    const names = [
      ...new Set(
        libraryItems()
          .filter((d) => d.shelf !== "investigation")
          .map((d) => d.topic),
      ),
    ].filter((t) => t && t !== "Other");
    return `<div class="card" style="padding:16px 18px"><h2 style="font-size:15px;font-weight:600;margin:0 0 12px">Browse a topic</h2><div class="pills">${names
      .map(
        (t) =>
          `<a href="/topics/${esc(topicSlug(t))}" class="tpill" style="background:${topicColours(t)[0]};color:${topicColours(t)[1]};font-size:13px;padding:4px 10px">${esc(t)}</a>`,
      )
      .join("")}</div></div>`;
  };

  const box = `<form class="sbox" role="search" method="get" action="/search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5a5e6b" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg><input id="search-input" type="search" name="q" value="${esc(q)}" placeholder="A phrase, a figure, a name" aria-label="Search everything on the site" data-search-input${qt ? "" : " autofocus"} />${qt ? '<a href="/search" class="btn sm" style="height:30px;padding:0 10px">Clear</a>' : ""}</form><p class="s-note">Searches articles, papers, research documents, concepts, open problems, key figures and the full text of every document. Put a phrase in quotes to match it exactly.</p>`;

  if (!qt) {
    const body = `<div class="s-wrap"><div class="s-col"><h1 class="h-search">Search</h1>${box}<section style="margin-top:32px"><h2 style="font-size:15px;font-weight:600;margin:0 0 10px">Try</h2><div class="pills" style="gap:8px">${TRIES.map(
      (t) =>
        `<a href="/search?q=${esc(encodeURIComponent(t))}" class="btn sm" style="height:34px;font-size:14px">${esc(t)}</a>`,
    ).join("")}</div></section></div><aside class="s-rail">${topicsHtml()}</aside></div>`;
    return shell({
      title: "Search",
      description:
        "Search every article, paper, research document, concept, open problem and key figure.",
      path: "/search",
      nav: "search",
      signedIn: opts.signedIn ?? false,
      body,
    });
  }

  const pub = libraryItems();
  const pages: Hit[] = pub
    .filter((d) => has(`${d.title} ${d.dek ?? ""} ${d.topic}`))
    .sort(
      (a, b) =>
        Number(has(b.title)) - Number(has(a.title)) || (b.date || "").localeCompare(a.date || ""),
    )
    .map((d) => ({
      topic: d.topic,
      href: d.route,
      text: marked(d.title),
      big: true,
      sub: d.dek ?? "",
      pills: [
        d.shelf === "investigation"
          ? { t: "Investigation", pair: sand }
          : {
              t: d.kind === "Research" ? (d.sub ?? "Research") : d.kind,
              pair: kindColours(d.kind),
            },
        { t: d.topic, pair: topicColours(d.topic) },
        ...(d.dateLabel ? [{ t: d.dateLabel, pair: sand }] : []),
      ],
    }));
  const derived = (rows: DerivedRow[], figure: boolean): Hit[] =>
    rows
      .filter((d) => has(`${d.title} ${figure ? (d.v ?? "") : ""}`))
      .map((d) => ({
        topic: d.topic,
        href: deep(d.route, d.title),
        text: marked(figure ? clip(d.title, 260) : d.title),
        big: !figure,
        sub: "",
        pills: [
          figure
            ? { t: d.v ?? "Figure", pair: ["#e3f0e6", "#1f5e36"] as Pair }
            : { t: "Question", pair: kindColours("Question") },
          { t: d.dek ?? "", pair: sand },
          { t: d.topic, pair: topicColours(d.topic) },
        ],
      }));
  const per = new Map<string, number>();
  const pas: Hit[] = [];
  for (const p of passages()) {
    if (!terms.every((t) => atWordStart(p.lc, t))) continue;
    const n = (per.get(p.doc.id) ?? 0) + 1;
    per.set(p.doc.id, n);
    if (n > 3) continue;
    pas.push({
      topic: p.doc.topic,
      href: deep(`/p/${p.doc.id}`, p.text),
      text: marked(clip(p.text, 320)),
      big: false,
      sub: "",
      pills: [
        { t: p.doc.title, pair: sand },
        ...(p.head ? [{ t: p.head, pair: ["#f3eee2", "#4a4d57"] as Pair }] : []),
        { t: p.doc.topic, pair: topicColours(p.doc.topic) },
      ],
    });
  }

  let groups = [
    { id: "pages", title: "Pages", rows: pages, cap: 8 },
    { id: "passages", title: "Passages in documents", rows: pas, cap: 10 },
    { id: "figures", title: "Key figures", rows: derived(keyFigures(), true), cap: 6 },
    { id: "questions", title: "Questions", rows: derived(questions(), false), cap: 6 },
  ];
  const facetCount = new Map<string, number>();
  for (const g of groups)
    for (const r of g.rows) facetCount.set(r.topic, (facetCount.get(r.topic) ?? 0) + 1);
  const topic = query.topic && facetCount.has(query.topic) ? query.topic : "";
  if (topic) groups = groups.map((g) => ({ ...g, rows: g.rows.filter((r) => r.topic === topic) }));
  const tab = groups.some((g) => g.id === query.tab) ? (query.tab ?? "all") : "all";
  const more = new Set((query.more ?? "").split(",").filter(Boolean));

  const link = (o: { tab?: string; topic?: string; more?: string }) => {
    const sp = new URLSearchParams({ q: qt });
    const t = o.tab ?? tab;
    const tp = o.topic ?? topic;
    const m = o.more ?? [...more].join(",");
    if (t !== "all") sp.set("tab", t);
    if (tp) sp.set("topic", tp);
    if (m) sp.set("more", m);
    return `/search?${sp.toString()}`;
  };

  const total = groups.reduce((a, g) => a + g.rows.length, 0);
  const tabs = [
    { id: "all", label: "All", n: total },
    ...groups.map((g) => ({
      id: g.id,
      label: g.id === "passages" ? "Passages" : g.title,
      n: g.rows.length,
    })),
  ]
    .filter((t) => t.id === "all" || t.n)
    .map(
      (t) =>
        `<a href="${esc(link({ tab: t.id, more: "" }))}" role="tab" aria-current="${t.id === tab}">${esc(t.label)}<span class="n">${t.n}</span></a>`,
    )
    .join("");

  const shown = groups.filter((g) => g.rows.length && (tab === "all" || tab === g.id));
  const groupsHtml = shown
    .map((g) => {
      const open = tab === g.id || more.has(g.id);
      const cap = open ? 200 : g.cap;
      return `<section style="margin-top:32px"><div class="ruled-h" style="margin-bottom:14px"><h2 style="font-size:18px;letter-spacing:-.01em">${esc(g.title)}</h2>${`<span class="pill lg" style="background:var(--tint)">${g.rows.length}</span>`}</div><div class="stack">${g.rows
        .slice(0, cap)
        .map(
          (r) =>
            `<a href="${esc(r.href)}" style="gap:7px"><span class="${r.big ? "s-t" : "s-p"}">${r.text}</span>${r.sub ? `<span class="stack-d">${esc(r.sub)}</span>` : ""}<span class="pills">${r.pills
              .filter((p) => p.t)
              .map(
                (p) =>
                  `<span class="pill lg s-pill" style="background:${p.pair[0]};color:${p.pair[1]}">${esc(p.t)}</span>`,
              )
              .join("")}</span></a>`,
        )
        .join(
          "",
        )}</div>${g.rows.length > cap ? `<a href="${esc(link({ more: [...more, g.id].join(",") }))}" class="btn sm" style="height:34px;margin-top:12px">Show all ${g.rows.length}</a>` : ""}</section>`;
    })
    .join("");

  const facets = [...facetCount].sort((a, b) => b[1] - a[1]);
  const facetHtml =
    facets.length > 1 || topic
      ? `<div class="card" style="padding:16px 18px"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:12px"><h2 style="font-size:15px;font-weight:600;margin:0">Narrow by topic</h2>${topic ? `<a href="${esc(link({ topic: "", more: "" }))}" class="ulink" style="font-size:13px">All topics</a>` : ""}</div><div class="pills">${facets
          .map(([t, n]) => {
            const [bg, fg] = topicColours(t);
            const on = t === topic;
            return `<a href="${esc(link({ topic: on ? "" : t, more: "" }))}" aria-pressed="${on}" class="facet" style="background:${on ? fg : bg};color:${on ? "#fffdf8" : fg};border-color:${on ? fg : bg}">${esc(t)}<span>${n}</span></a>`;
          })
          .join("")}</div></div>`
      : "";

  const body = `<div class="s-wrap"><div class="s-col"><h1 class="h-search">Search</h1>${box}<div role="tablist" aria-label="Show" class="seg s-tabs">${tabs}</div>${
    total
      ? groupsHtml
      : `<div class="lib-empty" style="padding:28px 0">Nothing on the site matches “${esc(qt)}”. Try fewer words, or a single name or number.</div>`
  }</div><aside class="s-rail" style="margin-top:62px">${facetHtml}</aside></div>`;

  return shell({
    title: `${qt} · Search`,
    description: `Search results for ${qt}.`,
    path: "/search",
    nav: "search",
    noindex: true,
    signedIn: opts.signedIn ?? false,
    body,
  });
}

// /topics/<slug> — everything on one subject, built at request time from the
// same rows the Library reads. docs/blackbox/README.md §Topic;
// pages/Canopticon Topic.dc.html. Sections in order: writing, concepts, open
// problems, research, questions, key figures, and — only when the research
// cites at least four dated works — the works it cites, by year.

import type { DerivedRow, LibraryItem } from "../content/store";
import { keyFigures, libraryItems, questions, researchDoc, timeline } from "../content/store";
import { esc, pill, shell } from "../layout";
import { passageHref } from "../md";
import { kindColours, topicSlug } from "../theme";

/** A note appears only where the author wrote one. */
const NOTES: Record<string, string> = {
  "McLuhan & media theory":
    "The record's largest line of work: a seven-paper series that takes McLuhan's \"sense ratios\" literally, the research documents that test it, and the concepts it named. They share one question: whether the balance of the senses is a physiological fact that media, drugs and illness each re-temper.",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A question's or figure's link goes to the passage it came from. */
function deep(route: string, text: string): string {
  const m = /^\/p\/([^#?]+)/.exec(route);
  if (!m || !text) return route;
  return passageHref(m[1] ?? "", text.split(/\s+/).slice(0, 14).join(" "));
}

interface TopicRow {
  href: string;
  title: string;
  dek: string;
  kind: string;
  kindPair: readonly [string, string];
  date: string;
  stat: string;
}

function rowFor(d: LibraryItem): TopicRow {
  return {
    href: d.route,
    title: d.title,
    dek: d.dek ?? "",
    kind: d.kind === "Research" ? (d.sub ?? "Research") : d.kind,
    kindPair: kindColours(d.kind),
    date: d.dateLabel ?? "",
    stat: d.kind === "Open problem" || d.kind === "Concept" ? "" : (d.stat ?? ""),
  };
}

function derivedRow(d: DerivedRow, figure: boolean): TopicRow {
  return {
    href: deep(d.route, d.title),
    title: d.title,
    dek: d.dek ?? "",
    kind: figure ? (d.v ?? "Figure") : "Question",
    kindPair: figure ? ["#e3f0e6", "#1f5e36"] : kindColours("Question"),
    date: "",
    stat: "",
  };
}

function section(
  id: string,
  title: string,
  countPair: readonly [string, string],
  rows: TopicRow[],
  cap: number,
  moreHref: string,
): string {
  if (!rows.length) return "";
  const shown = rows.slice(0, cap);
  return `<section id="${id}" class="tsec"><div class="ruled-h"><h2>${esc(title)}</h2>${pill(String(rows.length), countPair, "pill lg")}</div><div class="stack">${shown
    .map(
      (r) =>
        `<a href="${esc(r.href)}"><span class="stack-t">${esc(r.title)}</span>${r.dek ? `<span class="stack-d">${esc(r.dek)}</span>` : ""}<span class="pills" style="margin-top:2px">${pill(r.kind, r.kindPair, "pill lg")}${r.date ? pill(r.date, kindColours("Research"), "pill lg") : ""}${r.stat ? pill(r.stat, kindColours("Research"), "pill lg") : ""}</span></a>`,
    )
    .join(
      "",
    )}</div>${rows.length > cap ? `<a href="${esc(moreHref)}" class="btn sm" style="height:34px;margin-top:12px">All ${rows.length} in the Library</a>` : ""}</section>`;
}

export function renderTopic(topic: string, opts: { signedIn?: boolean } = {}): string {
  const slug = topicSlug(topic);
  const items = libraryItems()
    .filter((d) => d.topic === topic && d.kind !== "Project" && d.shelf !== "investigation")
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const of = (ks: string[]) => items.filter((d) => ks.includes(d.kind));
  const lib = `/library?topic=${slug}`;

  const qs = questions()
    .filter((d) => d.topic === topic)
    .map((d) => derivedRow(d, false));
  const fs = keyFigures()
    .filter((d) => d.topic === topic)
    .map((d) => derivedRow(d, true));

  const parts: Array<[string, string, string, TopicRow[], number, string]> = [
    ["writing", "Writing", "Article", of(["Article", "Paper"]).map(rowFor), 99, lib],
    ["concepts", "Concepts named here", "Concept", of(["Concept"]).map(rowFor), 99, lib],
    ["open", "Open problems", "Open problem", of(["Open problem"]).map(rowFor), 99, lib],
    ["research", "Research", "Research", of(["Research"]).map(rowFor), 12, `${lib}&kind=Research`],
    ["questions", "Questions it raises", "Question", qs, 8, `${lib}&kind=Question`],
    ["figures", "Key figures", "Figure", fs, 8, `${lib}&kind=Figure`],
  ];
  const sections = parts
    .map(([id, title, kind, rows, cap, more]) =>
      section(id, title, kindColours(kind), rows, cap, more),
    )
    .join("");

  // Works the research cites — only from documents a reader can open, and
  // only when there are enough of them to be a timeline rather than a list.
  const works = timeline(topic)
    .map((w) => ({
      ...w,
      docs: w.docs.flatMap((x) => {
        const d = researchDoc(x.id);
        return d ? [{ title: d.title, href: passageHref(d.id, x.q) }] : [];
      }),
    }))
    .filter((w) => w.docs.length);
  const worksHtml =
    works.length >= 4
      ? `<section id="works" class="tsec" style="margin-bottom:24px"><div class="ruled-h" style="margin-bottom:6px"><h2>Works the research cites</h2>${pill(String(works.length), kindColours("Research"), "pill lg")}</div><p class="works-p">Books and other dated works named in this topic's research documents, by year. Each document pill opens the passage that cites it.</p><div class="stack">${works
          .map(
            (w) =>
              `<div class="work"><span class="work-y">${w.year}</span><div class="work-b"><span class="work-t"><em>${esc(w.title)}</em>${w.author ? `<span> · ${esc(w.author)}</span>` : ""}</span><div class="pills">${w.docs
                .map(
                  (d) =>
                    `<a href="${esc(d.href)}" title="${esc(d.title)}" class="work-doc">${esc(d.title)}</a>`,
                )
                .join("")}</div></div></div>`,
          )
          .join("")}</div></section>`
      : "";

  const n = (k: string) => of([k]).length;
  const countPills = (
    [
      ["Article", "article", "articles"],
      ["Paper", "paper", "papers"],
      ["Research", "research document", "research documents"],
      ["Concept", "concept", "concepts"],
      ["Open problem", "open problem", "open problems"],
    ] as const
  )
    .filter(([k]) => n(k))
    .map(([k, one, many]) => pill(`${n(k)} ${n(k) === 1 ? one : many}`, kindColours(k), "pill lg"))
    .join("");

  const facts = [
    ...parts
      .filter(([, , , rows]) => rows.length)
      .map(([id, title, , rows]) => ({ label: title, value: String(rows.length), href: `#${id}` })),
    ...(works.length >= 4
      ? [{ label: "Works cited", value: String(works.length), href: "#works" }]
      : []),
  ];
  const latest = items[0]?.date ?? "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(latest);
  const latestLabel = m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : "—";

  const note = NOTES[topic];
  const head = `<div style="margin-bottom:44px"><div class="pills">${pill("Topic", kindColours("Topic"), "pill lg")}${countPills}</div><h1 class="h-topic">${esc(topic)}</h1>${note ? `<p class="topic-note">${esc(note)}</p>` : ""}<div class="pills" style="gap:8px"><a href="/follow?topic=${esc(encodeURIComponent(topic))}" class="btn">Follow this topic</a><a href="${esc(lib)}" class="btn">Browse it in the Library</a></div></div>`;

  const body = items.length
    ? sections + worksHtml
    : `<p style="font-size:16px;line-height:1.5;color:var(--body)">Nothing is filed under this topic yet. <a href="/library" class="ulink">See every topic in the Library</a>.</p>`;

  const rail = `<aside class="rail tight" style="flex-basis:260px;gap:20px"><div class="facts">${facts
    .map(
      (f) =>
        `<a href="${esc(f.href)}"><span>${esc(f.label)}</span><span class="v">${esc(f.value)}</span></a>`,
    )
    .join(
      "",
    )}<div><span>Latest</span><span class="v">${esc(latestLabel)}</span></div></div></aside>`;

  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${topic} · Canopticon`,
    url: `https://canopticon.com/topics/${slug}`,
    about: topic,
    author: { "@type": "Person", name: "Chris Telford", url: "https://canopticon.com/about" },
  };
  return shell({
    title: topic,
    description:
      note ??
      `Everything Canopticon has on ${topic}: writing, research documents, concepts, open problems and key figures.`,
    path: `/topics/${slug}`,
    signedIn: opts.signedIn ?? false,
    head: `<link rel="alternate" type="application/rss+xml" title="${esc(topic)} · Canopticon" href="/feeds/${slug}.xml" />\n<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
    body: `<div class="rr"><div class="col">${head}${body}</div>${rail}</div>`,
  });
}

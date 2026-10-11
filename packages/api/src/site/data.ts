// Views over the content store — the shapes the pages render from.
//
// Everything public goes through here, so the rules hold in one place:
// held documents and private projects never reach a public list, counts are
// computed rather than typed, and "Cited by" is derived from the articles'
// own <q> tokens rather than kept as a second list that could drift.

import {
  type Article,
  type LibraryItem,
  type Paper,
  type ResearchDoc,
  allArticles,
  allPapers,
  libraryItems,
  publicResearch,
  researchDoc,
} from "./content/store";
import { articleQuotes } from "./md";
import type { DocView } from "./pages/document";
import { shortDate, topicSlug } from "./theme";

export const articleRoute = (slug: string) => `/articles/${slug}`;

let byDoc: Map<string, LibraryItem> | null = null;
/** The library row for a research document, when it has one. */
export function libraryRowForDoc(id: string): LibraryItem | undefined {
  if (!byDoc) {
    byDoc = new Map();
    for (const r of libraryItems({ signedIn: true })) if (r.doc) byDoc.set(r.doc, r);
  }
  return byDoc.get(id);
}

let byRoute: Map<string, LibraryItem> | null = null;
export function libraryRowForRoute(route: string): LibraryItem | undefined {
  if (!byRoute) {
    byRoute = new Map();
    for (const r of libraryItems({ signedIn: true })) byRoute.set(r.route, r);
  }
  return byRoute.get(route);
}

type Citation = { route: string; title: string; kind: string; quotes: number };
let citations: Map<string, Citation[]> | null = null;
/** Which articles quote a document, and how often. */
export function citedBy(docId: string): Citation[] {
  if (!citations) {
    citations = new Map();
    for (const a of allArticles()) {
      if (a.withdrawn) continue;
      const counts = new Map<string, number>();
      for (const q of articleQuotes(a.body)) counts.set(q.doc, (counts.get(q.doc) ?? 0) + 1);
      for (const [doc, n] of counts) {
        const list = citations.get(doc) ?? [];
        list.push({ route: articleRoute(a.slug), title: a.title, kind: "Article", quotes: n });
        citations.set(doc, list);
      }
    }
    for (const list of citations.values()) list.sort((x, y) => y.quotes - x.quotes);
  }
  return citations.get(docId) ?? [];
}

/** A month-only date ("2026-09-01" labelled "Sep") stays month-only. */
function dateLabelFor(doc: ResearchDoc): string {
  return libraryRowForDoc(doc.id)?.dateLabel ?? shortDate(doc.date);
}

export function docViewFromStore(id: string): DocView | null {
  const d = researchDoc(id);
  if (!d) return null;
  const row = libraryRowForDoc(id);
  return {
    id: d.id,
    title: d.title,
    kind: d.kind,
    topic: d.topic,
    date: d.date,
    dateLabel: dateLabelFor(d),
    shelf: row?.shelf ?? d.shelf,
    body: d.body,
    citedBy: citedBy(id),
  };
}

/** Title of a public document, or null — receipts to a held or missing
 *  document render as nothing rather than a link that 404s. */
export function docTitle(id: string): string | null {
  return researchDoc(id)?.title ?? null;
}

// ---- writing --------------------------------------------------------------

export interface Writing {
  slug: string;
  route: string;
  kind: "Article" | "Paper";
  title: string;
  dek: string;
  topic: string;
  date: string;
  minutes: number;
  quotes: number;
}

const words = (s: string) => (s.match(/\S+/g) ?? []).length;

export function articleMinutes(a: Article): number {
  return Math.max(1, Math.round((a.words ?? words(a.body)) / 200));
}

export function paperMinutes(p: Paper): number {
  return (
    SERIES.find((s) => s.slug === p.slug)?.minutes ?? Math.max(1, Math.round(words(p.body) / 230))
  );
}

/** Articles listed in the library (Ground Pattern is stored but unlisted). */
export function listedArticles(): Article[] {
  return allArticles()
    .filter((a) => libraryRowForRoute(articleRoute(a.slug))?.kind === "Article")
    .sort((x, y) => y.date.localeCompare(x.date));
}

/** An article's topic: its own front matter, or its library row's when the
 *  front matter left it empty (several did). */
export function topicOf(a: Article | Paper): string {
  return a.topic || libraryRowForRoute(articleRoute(a.slug))?.topic || "McLuhan & media theory";
}

export function writingFor(a: Article | Paper): Writing {
  if (a.kind === "Article") {
    return {
      slug: a.slug,
      route: articleRoute(a.slug),
      kind: "Article",
      title: a.title,
      dek: a.dek,
      topic: topicOf(a),
      date: a.date,
      minutes: articleMinutes(a),
      quotes: a.quotes ?? articleQuotes(a.body).length,
    };
  }
  return {
    slug: a.slug,
    route: articleRoute(a.slug),
    kind: "Paper",
    title: a.title,
    dek: a.dek ?? "",
    topic: topicOf(a),
    date: a.date,
    minutes: paperMinutes(a),
    quotes: 0,
  };
}

// ---- the McLuhan paper series (curated; pages/Canopticon Front.dc.html) ----

export interface SeriesItem {
  slug: string;
  tag: string;
  tagPair: readonly [string, string];
  blurb: string;
  short: string;
  minutes: number;
}

export const SERIES_NAME = "McLuhan and the senses";

export const SERIES: SeriesItem[] = [
  {
    slug: "krasis",
    tag: "Synthesis",
    tagPair: ["#efe6f6", "#5a2d82"],
    blurb:
      "The synthesis of the series: one configuration that media, drugs and illness all re-temper.",
    short: "the synthesis",
    minutes: 12,
  },
  {
    slug: "syncrasis",
    tag: "The senses",
    tagPair: ["#efe6f6", "#5a2d82"],
    blurb: 'McLuhan meant his "sense ratios" literally.',
    short: "sense ratios, literally",
    minutes: 20,
  },
  {
    slug: "heterocrasis",
    tag: "ADHD",
    tagPair: ["#e4ecf7", "#1f4e8c"],
    blurb: "ADHD as a different starting balance of the senses.",
    short: "ADHD as a starting balance",
    minutes: 16,
  },
  {
    slug: "typomora",
    tag: "Voice & typing",
    tagPair: ["#e3f0e6", "#1f5e36"],
    blurb: "McLuhan said electric media would bring back the voice.",
    short: "the keyboard's delay",
    minutes: 22,
  },
  {
    slug: "exocrasis",
    tag: "Computing",
    tagPair: ["#f3e9d4", "#6b4e14"],
    blurb:
      "The computing environment, not the screen, is the medium: keyboard, memory, search and network move part of the configuration of the senses and of memory outside the body.",
    short: "the computing environment",
    minutes: 16,
  },
  {
    slug: "pharmakrasis",
    tag: "Drugs",
    tagPair: ["#fbe9df", "#8a3a1f"],
    blurb:
      "Each class of drug sets its own balance of the senses — and the evidence for that is better than for any medium.",
    short: "drugs and the senses",
    minutes: 18,
  },
  {
    slug: "narcocrasis",
    tag: "Addiction",
    tagPair: ["#fbe9df", "#8a3a1f"],
    blurb:
      "In dependence, what goes unseen is not the drug but the shifted baseline: the allostatic state is the medium, the drug its content.",
    short: "the baseline as medium",
    minutes: 28,
  },
];

export function seriesPapers(): Array<{ item: SeriesItem; paper: Paper }> {
  const papers = new Map(allPapers().map((p) => [p.slug, p]));
  return SERIES.flatMap((item) => {
    const paper = papers.get(item.slug);
    return paper ? [{ item, paper }] : [];
  });
}

// ---- topics ---------------------------------------------------------------

export interface TopicSummary {
  name: string;
  slug: string;
  count: number;
}

/** Topics with their public research count (investigations excluded: they
 *  have their own shelf and stay out of the topic hubs). */
export function researchTopics(): TopicSummary[] {
  const counts = new Map<string, number>();
  for (const r of libraryItems()) {
    if (r.kind !== "Research" || r.shelf === "investigation") continue;
    counts.set(r.topic, (counts.get(r.topic) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => ({ name, slug: topicSlug(name), count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Every topic that has a hub: anything listed outside the investigations
 *  shelf and the private projects. */
export function hubTopics(): TopicSummary[] {
  const counts = new Map<string, number>();
  for (const r of libraryItems()) {
    if (r.shelf === "investigation" || !r.topic || r.topic === "Other") continue;
    counts.set(r.topic, (counts.get(r.topic) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => ({ name, slug: topicSlug(name), count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function topicBySlug(slug: string): string | null {
  return hubTopics().find((t) => t.slug === slug)?.name ?? null;
}

/** Latest public research documents, newest first. */
export function latestResearch(n: number): LibraryItem[] {
  return libraryItems()
    .filter((r) => r.kind === "Research" && r.shelf !== "investigation")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n);
}

export function publicResearchCount(): number {
  return libraryItems().filter((r) => r.kind === "Research" && r.shelf !== "investigation").length;
}

export { publicResearch };

// The content store — the record as the Black Box handoff delivered it.
//
// content/ holds the files (docs/blackbox/README.md §Content);
// scripts/build-content.mjs compiles them into store.gen.json and refuses to
// build if any quote is not verbatim. This module is the only reader of that
// JSON. Every public surface goes through the accessors below, and the
// accessors are where "held" is enforced: a held document is stored and can
// be read by Admin, but nothing here hands it to a public caller.

import type { ShownRead } from "../../write/read";
import { sharedTerms } from "../links";
import { passageHref } from "../md";
import raw from "./store.gen.json";

export interface LibraryItem {
  href?: string;
  route: string;
  kind: string;
  topic: string;
  date: string;
  dateLabel?: string;
  title: string;
  dek: string;
  stat: string;
  doc?: string;
  sub?: string;
  src?: string;
  min?: number;
  quotes?: number;
  sources?: number;
  own?: number;
  coined?: number;
  shelf?: string;
}

/** A question or a key figure: a derived row that links to its passage. */
export interface DerivedRow {
  route: string;
  kind: "Question" | "Figure";
  topic: string;
  date: string;
  dateLabel?: string;
  title: string;
  dek: string;
  stat?: string;
  /** Key figures only: the figure itself. */
  v?: string;
}

export interface Idea {
  id: string;
  kick?: string;
  title: string;
  body: string;
  foot?: string;
  from?: string;
  route: string;
  artRoute?: string;
  artTitle?: string;
  artKind?: string;
  docRoute?: string;
}

export interface TimelineWork {
  year: number;
  title: string;
  author: string;
  n: number;
  docs: Array<{ id: string; q: string }>;
}

export interface ResearchDoc {
  id: string;
  title: string;
  kind: string;
  topic: string;
  date: string;
  shelf: string;
  listed: boolean;
  visibility: "public" | "held";
  body: string;
}

export interface BasedOn {
  id: string;
  label: string;
}

export interface Article {
  slug: string;
  kind: "Article";
  topic: string;
  title: string;
  dek: string;
  date: string;
  /** A withdrawn draft: still at its URL, says so at the top, linked from
   *  nowhere and kept out of search engines. */
  withdrawn?: string;
  why?: string;
  thesis?: string;
  based_on?: BasedOn[];
  quotes?: number;
  words?: number;
  cite?: string;
  body: string;
}

export interface Paper {
  slug: string;
  kind: "Paper";
  topic?: string;
  title: string;
  dek?: string;
  date: string;
  series?: string;
  body: string;
}

export interface StaticPage {
  route: string;
  /** Long pages (the papers) carry the reading-progress bar. */
  progress?: boolean;
  /** An Admin-only page (the projects). Never returned by staticPage(). */
  private?: boolean;
  title: string;
  description: string;
  ld: unknown[];
  body: string;
}

export interface ArticleExtras {
  toc?: string[];
  pair?: { before: string; label: string; route: string; after: string };
  /** Named sources; may carry <em> and nothing else. */
  sources?: string[];
  readNext?: Array<{ route: string; kind: string; min: string; title: string; dek: string }>;
  /** The open problem the article leaves, linked beside its topic. */
  openProblem?: string;
  /** "This thread is still open": the next research questions, each with
   *  the name of its prompt in content/prompts/ (absent until written). */
  thread?: { intro: string; items: Array<{ title: string; desc: string; prompt?: string }> };
}

interface Store {
  library: LibraryItem[];
  questions: DerivedRow[];
  figures: DerivedRow[];
  terms: Idea[];
  problems: Idea[];
  timeline: Record<string, TimelineWork[]>;
  research: Record<string, ResearchDoc>;
  articles: Record<string, Article>;
  papers: Record<string, Paper>;
  pages: Record<string, StaticPage>;
  articleExtras: Record<string, ArticleExtras>;
  /** content/prompts/<name>.md: the research prompts an article offers. */
  prompts: Record<string, string>;
  /** docs/blackbox/ESSAY-CONTRACT.md, whole: the workspace's instructions. */
  contract: string;
  verified: { quotes: number };
}

const STORE = raw as unknown as Store;

const isPublic = (d: ResearchDoc | undefined): d is ResearchDoc => !!d && d.visibility === "public";

/** A public research document, or nothing. Held documents never come back. */
export function researchDoc(id: string): ResearchDoc | null {
  const d = STORE.research[id];
  return isPublic(d) ? d : null;
}

/** Every public research document. */
export function publicResearch(): ResearchDoc[] {
  return Object.values(STORE.research).filter(isPublic);
}

/** Held documents. Admin's read only — never call from a public route. */
export function heldResearch(): ResearchDoc[] {
  return Object.values(STORE.research).filter((d) => d.visibility === "held");
}

/** Admin's read: held documents included. Never call from a public route. */
export function anyResearchDoc(id: string): ResearchDoc | null {
  return STORE.research[id] ?? null;
}

export function article(slug: string): Article | null {
  return STORE.articles[slug] ?? PUBLISHED[slug] ?? null;
}

export function paper(slug: string): Paper | null {
  return STORE.papers[slug] ?? null;
}

export function allArticles(): Article[] {
  const own = Object.values(STORE.articles);
  return PUBLISHED_ROWS.length ? [...own, ...Object.values(PUBLISHED)] : own;
}

export function allPapers(): Paper[] {
  return Object.values(STORE.papers);
}

/** Projects are private (README §Rules): they route to Admin and never
 *  appear in a public list. Everything else in library.json is public. */
export function libraryItems(opts: { signedIn?: boolean } = {}): LibraryItem[] {
  const own = STORE.library.filter((r) => opts.signedIn || r.kind !== "Project");
  return UPLOADED.length || PUBLISHED_ROWS.length || ENTRIES.rows.length
    ? [...PUBLISHED_ROWS, ...ENTRIES.rows, ...UPLOADED, ...own]
    : own;
}

/**
 * Documents published from Admin after the handoff live only in D1. They
 * join every list through here, so the Library, topics, feeds, llms.txt and
 * the sitemap stay one list (standing rule 3). Set by the site's middleware
 * (site/uploads.ts) from a short-lived cache; a row the store already holds
 * is never listed twice.
 */
let UPLOADED: LibraryItem[] = [];
export function setUploadedRows(rows: LibraryItem[]): void {
  const known = new Set(STORE.library.map((r) => r.route));
  const next = rows.filter((r) => !known.has(r.route) && !STORE.research[r.doc ?? ""]);
  if (JSON.stringify(next) !== JSON.stringify(UPLOADED)) VERSION++;
  UPLOADED = next;
}

/**
 * Documents that cite the same page (docs/read-it.md, "Links": a query, never
 * a judgement). Built from the URLs each public document cites — the store's
 * research and the published uploads (their URLs set with the overlay) — and
 * rebuilt when the overlays change. Two documents sharing sources may be one
 * upstream page echoing twice; saying so is the point.
 */
export function citedUrls(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(/https?:\/\/[^\s)\]>"'<]+/g))
    out.add(
      m[0]
        .replace(/[.,;:!?*_]+$/, "")
        .replace(/^https?:\/\/(www\.)?/i, "")
        .replace(/#.*$/, "")
        .replace(/\/$/, "")
        .toLowerCase(),
    );
  return [...out];
}
let UPLOAD_URLS = new Map<string, string[]>();
export function setUploadedSources(next: Map<string, string[]>): void {
  UPLOAD_URLS = next;
  SOURCE_INDEX = null;
}
let SOURCE_INDEX: {
  version: number;
  byUrl: Map<string, string[]>;
  byDoc: Map<string, string[]>;
} | null = null;
function sourceIndex() {
  if (SOURCE_INDEX && SOURCE_INDEX.version === VERSION) return SOURCE_INDEX;
  const byDoc = new Map<string, string[]>();
  for (const d of publicResearch()) byDoc.set(d.id, citedUrls(d.body));
  for (const r of UPLOADED)
    if (r.doc && UPLOAD_URLS.has(r.doc)) byDoc.set(r.doc, UPLOAD_URLS.get(r.doc) ?? []);
  const byUrl = new Map<string, string[]>();
  for (const [doc, urls] of byDoc)
    for (const u of urls) {
      const list = byUrl.get(u) ?? [];
      list.push(doc);
      byUrl.set(u, list);
    }
  SOURCE_INDEX = { version: VERSION, byUrl, byDoc };
  return SOURCE_INDEX;
}

/**
 * Subjects shared with other documents, from the typed graph (graph/lib/
 * crosslinks.ts allCrossLinks — no model, never a person or organisation),
 * loaded with the uploads. The destinations are checked here, at the moment
 * of use: only a document that renders publicly, never a held one.
 */
let GRAPH_LINKS = new Map<string, Array<{ label: string; slug: string }>>();
export function setGraphLinks(next: Map<string, Array<{ label: string; slug: string }>>): void {
  GRAPH_LINKS = next;
}
export interface SubjectLink {
  label: string;
  route: string;
  title: string;
}
export function subjectLinks(docId: string): SubjectLink[] {
  const out: SubjectLink[] = [];
  for (const l of GRAPH_LINKS.get(docId) ?? []) {
    const d = researchDoc(l.slug);
    const up = d ? null : UPLOADED.find((r) => r.doc === l.slug);
    if (!d && !up) continue;
    out.push({
      label: l.label,
      route: `/p/${l.slug}`,
      title: (d?.title ?? up?.title ?? l.slug).replace(/^#\s*/, ""),
    });
  }
  return out;
}

/**
 * The record's concepts named in a text: each concept whose name appears as
 * a whole phrase. Used both ways — a document links the concepts it names,
 * and a concept's page lists the documents that name it.
 */
const nameRe = (name: string) =>
  new RegExp(
    `(^|[^\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{N}])`,
    "iu",
  );
export function conceptsNamedIn(text: string): Idea[] {
  return terms().filter((t) => t.title.length >= 5 && nameRe(t.title).test(text));
}
let UPLOAD_CONCEPTS = new Map<string, string[]>();
export function setUploadedConcepts(next: Map<string, string[]>): void {
  UPLOAD_CONCEPTS = next;
}
/** Every public document that names a concept, newest first. */
export function conceptUses(termId: string): Array<{ route: string; title: string; date: string }> {
  const t = terms().find((x) => x.id === termId);
  if (!t) return [];
  const re = nameRe(t.title);
  const out: Array<{ route: string; title: string; date: string }> = [];
  for (const d of publicResearch())
    if (re.test(d.body))
      out.push({ route: `/p/${d.id}`, title: d.title.replace(/^#\s*/, ""), date: d.date });
  for (const r of UPLOADED)
    if (r.doc && (UPLOAD_CONCEPTS.get(r.doc) ?? []).includes(termId))
      out.push({ route: r.route, title: r.title, date: r.date });
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * A question one document leaves open that another answers, and a figure
 * one document gives that another gives for the same measure — matched by
 * the terms they share (site/links.ts sharedTerms: at least two, at least
 * 60% of the shorter), never by a model's opinion that they agree. The open
 * questions are the store's own (the questions each document raises) and
 * those kept from shown reads; the answers are documents' question headings
 * with the paragraph under them, and answers kept from shown reads; figures
 * come from shown reads only, since only a read says what a figure measures.
 */
export interface AnsweredElsewhere {
  question: string;
  answer: string;
  route: string;
  title: string;
  terms: string[];
}
export interface MeasuredElsewhere {
  figure: string;
  measures: string;
  other: string;
  otherMeasures: string;
  route: string;
  title: string;
  terms: string[];
}

let RELATED_CACHE: {
  version: number;
  shown: number;
  answers: Array<{ doc: string; q: string; a: string }>;
} | null = null;
function answerPool() {
  if (RELATED_CACHE && RELATED_CACHE.version === VERSION && RELATED_CACHE.shown === SHOWN.size)
    return RELATED_CACHE.answers;
  const answers: Array<{ doc: string; q: string; a: string }> = [];
  for (const d of publicResearch()) {
    const lines = d.body.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const h = /^#{2,4}\s+(.+\?)\s*$/.exec(lines[i] ?? "");
      if (!h) continue;
      let j = i + 1;
      while (j < lines.length && !(lines[j] ?? "").trim()) j++;
      const a = (lines[j] ?? "").trim();
      if (a && !/^(#|\||[-*+]\s|\d+[.)]\s)/.test(a))
        answers.push({ doc: d.id, q: (h[1] ?? "").replace(/[*_`]/g, ""), a });
    }
  }
  for (const { read, cards } of SHOWN.values())
    for (const c of cards)
      if (
        c.kind === "question_answered" &&
        c.status === "kept" &&
        typeof c.data.question === "string"
      )
        answers.push({
          doc: read.docId,
          q: c.data.question,
          a: typeof c.data.answer === "string" ? c.data.answer : c.span,
        });
  RELATED_CACHE = { version: VERSION, shown: SHOWN.size, answers };
  return answers;
}

const publicTitle = (id: string): string | null => {
  const d = researchDoc(id);
  if (d) return d.title.replace(/^#\s*/, "");
  const up = UPLOADED.find((r) => r.doc === id);
  return up ? up.title : null;
};

export function answeredElsewhere(docId: string): AnsweredElsewhere[] {
  const open = [
    ...STORE.questions.filter((q) => q.route === `/p/${docId}`).map((q) => q.title),
    ...[...(SHOWN.get(docId)?.cards ?? [])]
      .filter((c) => c.kind === "question_open" && c.status === "kept")
      .map((c) => (typeof c.data.question === "string" ? c.data.question : c.span)),
  ];
  const out: AnsweredElsewhere[] = [];
  const seen = new Set<string>();
  for (const q of open)
    for (const a of answerPool()) {
      if (a.doc === docId) continue;
      const terms = sharedTerms(q, a.q);
      const title = terms ? publicTitle(a.doc) : null;
      if (!terms || !title || seen.has(`${q}\u0000${a.doc}`)) continue;
      seen.add(`${q}\u0000${a.doc}`);
      out.push({
        question: q,
        answer: a.a,
        route: passageHref(a.doc, a.a.replace(/[*_`]/g, "")),
        title,
        terms,
      });
    }
  return out;
}

export function measuredElsewhere(docId: string): MeasuredElsewhere[] {
  const mine = (SHOWN.get(docId)?.cards ?? []).filter(
    (c) => c.kind === "figure" && c.status === "kept" && !c.data.rejected,
  );
  const out: MeasuredElsewhere[] = [];
  for (const f of mine)
    for (const { read, cards } of SHOWN.values()) {
      if (read.docId === docId) continue;
      const title = publicTitle(read.docId);
      if (!title) continue;
      for (const g of cards) {
        if (g.kind !== "figure" || g.status !== "kept" || g.data.rejected) continue;
        const terms = sharedTerms(String(f.data.measures ?? ""), String(g.data.measures ?? ""));
        if (!terms) continue;
        out.push({
          figure: String(f.data.figure ?? ""),
          measures: String(f.data.measures ?? ""),
          other: String(g.data.figure ?? ""),
          otherMeasures: String(g.data.measures ?? ""),
          route: passageHref(read.docId, g.span.replace(/\*\*|__/g, "")),
          title,
          terms,
        });
      }
    }
  return out;
}

export interface SharedSources {
  route: string;
  title: string;
  date: string;
  common: number;
}

/** Other public documents citing pages this one cites, newest first (a list
 *  order, never a ranking by how many). */
export function sharedSources(docId: string): SharedSources[] {
  const ix = sourceIndex();
  const counts = new Map<string, number>();
  for (const u of ix.byDoc.get(docId) ?? [])
    for (const other of ix.byUrl.get(u) ?? [])
      if (other !== docId) counts.set(other, (counts.get(other) ?? 0) + 1);
  const out: SharedSources[] = [];
  for (const [id, common] of counts) {
    const d = researchDoc(id);
    const up = d ? null : UPLOADED.find((r) => r.doc === id);
    if (!d && !up) continue;
    out.push({
      route: `/p/${id}`,
      title: (d?.title ?? up?.title ?? id).replace(/^#\s*/, ""),
      date: d?.date ?? up?.date ?? "",
      common,
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Articles published from the workspace (/admin/write) live in D1 and join
 * the store the same way: the article page, the Library, topics, feeds,
 * llms.txt and the sitemap all read them through article(), allArticles()
 * and libraryItems(). An article the store already holds is never shadowed.
 */
let PUBLISHED: Record<string, Article> = {};
let PUBLISHED_ROWS: LibraryItem[] = [];
export function setPublishedArticles(list: Array<{ article: Article; row: LibraryItem }>): void {
  const keep = list.filter((x) => !STORE.articles[x.article.slug] && !STORE.papers[x.article.slug]);
  const next = Object.fromEntries(keep.map((x) => [x.article.slug, x.article]));
  if (JSON.stringify(next) !== JSON.stringify(PUBLISHED)) VERSION++;
  PUBLISHED = next;
  PUBLISHED_ROWS = keep.map((x) => x.row);
}

/** Bumped whenever the D1 overlays change, so derived lookups rebuild. */
let VERSION = 0;
export const storeVersion = (): number => VERSION;

export const questions = (): DerivedRow[] =>
  READ_ROWS.questions.length ? [...READ_ROWS.questions, ...STORE.questions] : STORE.questions;
export const keyFigures = (): DerivedRow[] =>
  ENTRIES.figures.length || READ_ROWS.figures.length
    ? [...ENTRIES.figures, ...READ_ROWS.figures, ...STORE.figures]
    : STORE.figures;
export const terms = (): Idea[] =>
  ENTRIES.terms.length ? [...STORE.terms, ...ENTRIES.terms] : STORE.terms;
export const problems = (): Idea[] =>
  ENTRIES.problems.length ? [...STORE.problems, ...ENTRIES.problems] : STORE.problems;
export const term = (id: string): Idea | null => terms().find((t) => t.id === id) ?? null;
export const problem = (id: string): Idea | null => problems().find((t) => t.id === id) ?? null;

/**
 * Concepts, open problems and key figures added from the workspace live in
 * D1 (record_entries) and join the store's lists here, with their Library
 * rows, the same way published articles do.
 */
export interface EntryOverlay {
  terms: Idea[];
  problems: Idea[];
  figures: DerivedRow[];
  rows: LibraryItem[];
}
let ENTRIES: EntryOverlay = { terms: [], problems: [], figures: [], rows: [] };
export function setRecordEntries(next: EntryOverlay): void {
  const known = new Set([...STORE.terms, ...STORE.problems].map((i) => i.route));
  const keep: EntryOverlay = {
    terms: next.terms.filter((i) => !known.has(i.route)),
    problems: next.problems.filter((i) => !known.has(i.route)),
    figures: next.figures,
    rows: next.rows.filter((r) => !known.has(r.route)),
  };
  if (JSON.stringify(keep) !== JSON.stringify(ENTRIES)) VERSION++;
  ENTRIES = keep;
}
/**
 * What a read found and the author put on the page (docs/read-it.md): per
 * document, the kept cards of its shown read, from D1 (reads, derivations).
 * Never for a held document: this accessor is where that is enforced.
 */
let SHOWN = new Map<string, ShownRead>();
let READ_ROWS: { figures: DerivedRow[]; questions: DerivedRow[] } = { figures: [], questions: [] };
export function setShownReads(list: ShownRead[]): void {
  SHOWN = new Map(list.map((s) => [s.read.docId, s]));
  const next = readRows();
  if (JSON.stringify(next) !== JSON.stringify(READ_ROWS)) VERSION++;
  READ_ROWS = next;
}

/** A shown read's kept figures and unanswered questions, as the Library,
 *  search and topic rows the store's own derived lists use — each linking to
 *  its passage. Only for a document that is itself public. */
function readRows(): { figures: DerivedRow[]; questions: DerivedRow[] } {
  const figures: DerivedRow[] = [];
  const questions: DerivedRow[] = [];
  const plain = (t: string) =>
    t
      .replace(/\*\*|__/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const seen = new Set(
    [...STORE.figures, ...STORE.questions].map((r) => plain(r.title).toLowerCase()),
  );
  for (const { read, cards } of SHOWN.values()) {
    const doc = researchDoc(read.docId);
    const up = doc ? null : UPLOADED.find((r) => r.doc === read.docId);
    if (!doc && !up) continue;
    const base = {
      topic: doc?.topic ?? up?.topic ?? "",
      date: doc?.date ?? up?.date ?? "",
      dek: (doc?.title ?? up?.title ?? "").replace(/^#\s*/, ""),
      stat: "",
    };
    for (const c of cards) {
      if (c.status !== "kept" || c.origin === "shape") continue;
      const title = plain(
        c.kind === "question_open" && typeof c.data.question === "string"
          ? c.data.question
          : c.span,
      );
      if (seen.has(title.toLowerCase())) continue;
      const route = passageHref(read.docId, title);
      if (c.kind === "figure" && !c.data.rejected && typeof c.data.figure === "string") {
        seen.add(title.toLowerCase());
        figures.push({ ...base, route, kind: "Figure", title, v: c.data.figure });
      } else if (c.kind === "question_open") {
        seen.add(title.toLowerCase());
        questions.push({
          ...base,
          route: passageHref(read.docId, plain(c.span)),
          kind: "Question",
          title,
        });
      }
    }
  }
  return { figures, questions };
}
export const shownRead = (docId: string): ShownRead | null =>
  anyResearchDoc(docId) && !researchDoc(docId) ? null : (SHOWN.get(docId) ?? null);

export const timeline = (topic: string): TimelineWork[] => STORE.timeline[topic] ?? [];
export const verifiedQuoteCount = (): number => STORE.verified.quotes;

/** A hand-built page by its route ("/about", "/concepts/cpai"…). */
export const staticPage = (route: string): StaticPage | null => {
  const p = STORE.pages[route];
  return p && !p.private ? p : null;
};

/** Projects are private (README §Rules): their pages are for Admin only, and
 *  this is the one accessor that returns them. */
export const privatePage = (route: string): StaticPage | null => {
  const p = STORE.pages[route];
  return p?.private ? p : null;
};

export const articleExtras = (slug: string): ArticleExtras => STORE.articleExtras[slug] ?? {};

/** A research prompt's text — the fenced block of content/prompts/<name>.md. */
export const essayContract = (): string => STORE.contract ?? "";

export const researchPrompt = (name: string): string | null => STORE.prompts?.[name] ?? null;

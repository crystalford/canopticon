// The content store — the record as the Black Box handoff delivered it.
//
// content/ holds the files (docs/blackbox/README.md §Content);
// scripts/build-content.mjs compiles them into store.gen.json and refuses to
// build if any quote is not verbatim. This module is the only reader of that
// JSON. Every public surface goes through the accessors below, and the
// accessors are where "held" is enforced: a held document is stored and can
// be read by Admin, but nothing here hands it to a public caller.

import type { ShownRead } from "../../write/read";
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

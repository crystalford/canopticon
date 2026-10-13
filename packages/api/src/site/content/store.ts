// The content store — the record as the Black Box handoff delivered it.
//
// content/ holds the files (docs/blackbox/README.md §Content);
// scripts/build-content.mjs compiles them into store.gen.json and refuses to
// build if any quote is not verbatim. This module is the only reader of that
// JSON. Every public surface goes through the accessors below, and the
// accessors are where "held" is enforced: a held document is stored and can
// be read by Admin, but nothing here hands it to a public caller.

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
  return STORE.articles[slug] ?? null;
}

export function paper(slug: string): Paper | null {
  return STORE.papers[slug] ?? null;
}

export function allArticles(): Article[] {
  return Object.values(STORE.articles);
}

export function allPapers(): Paper[] {
  return Object.values(STORE.papers);
}

/** Projects are private (README §Rules): they route to Admin and never
 *  appear in a public list. Everything else in library.json is public. */
export function libraryItems(opts: { signedIn?: boolean } = {}): LibraryItem[] {
  const own = STORE.library.filter((r) => opts.signedIn || r.kind !== "Project");
  return UPLOADED.length ? [...UPLOADED, ...own] : own;
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
  UPLOADED = rows.filter((r) => !known.has(r.route) && !STORE.research[r.doc ?? ""]);
}

export const questions = (): DerivedRow[] => STORE.questions;
export const keyFigures = (): DerivedRow[] => STORE.figures;
export const terms = (): Idea[] => STORE.terms;
export const problems = (): Idea[] => STORE.problems;
export const term = (id: string): Idea | null => STORE.terms.find((t) => t.id === id) ?? null;
export const problem = (id: string): Idea | null => STORE.problems.find((t) => t.id === id) ?? null;
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

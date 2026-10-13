// A draft as an article: the object the public article renderer draws (so the
// preview is the page), and the Markdown file the content store reads (so a
// finished draft can be added to content/articles/ as it is).

import type { Article } from "../site/content/store";
import { articleQuotes } from "../site/md";
import type { Draft } from "./drafts";

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .split("-")
      .slice(0, 10)
      .join("-") || "untitled"
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const words = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

export function draftArticle(d: Draft, titles: Map<string, string>): Article {
  const title = d.meta.title || "Untitled draft";
  return {
    slug: slugify(title),
    kind: "Article",
    topic: d.meta.topic || "Draft",
    title,
    dek: d.meta.dek ?? "",
    date: today(),
    ...(d.meta.why ? { why: d.meta.why } : {}),
    ...(d.meta.thesis ? { thesis: d.meta.thesis } : {}),
    based_on: (d.meta.based_on ?? []).map((id) => ({ id, label: titles.get(id) ?? id })),
    quotes: articleQuotes(d.body).length,
    words: words(d.body),
    body: d.body,
  };
}

const q = (s: string) => JSON.stringify(s);

/** The draft as content/articles/<slug>.md, front matter in the store's form. */
export function draftMarkdown(d: Draft, titles: Map<string, string>): string {
  const a = draftArticle(d, titles);
  const lines = [
    "---",
    `slug: ${q(a.slug)}`,
    `kind: "Article"`,
    `topic: ${q(a.topic)}`,
    `title: ${q(a.title)}`,
    `dek: ${q(a.dek)}`,
    `date: ${q(a.date)}`,
    ...(a.why ? [`why: ${q(a.why)}`] : []),
    ...(a.thesis ? [`thesis: ${q(a.thesis)}`] : []),
    "based_on: ",
    ...(a.based_on ?? []).flatMap((b) => [`  - id: ${b.id}`, `    label: ${q(b.label)}`]),
    `quotes: ${a.quotes}`,
    `words: ${a.words}`,
    `cite: ${q(`Telford, C. (${a.date.slice(0, 4)}). ${a.title}. Canopticon. canopticon.com/articles/${a.slug}`)}`,
    "---",
  ];
  return `${lines.join("\n")}\n${d.body.trim()}\n`;
}

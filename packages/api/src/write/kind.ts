// What a message typed into Admin's composer is asking for. Claude does not
// decide this: a few plain rules do, and the guess is shown above the box
// before anything starts, with the other kinds one click away (design
// handoff v3, "Claude guesses the kind"). The rules live here once: the
// server guesses with them when the page ran no script, and the page is
// handed the same patterns (`KIND_RULES`) to guess as you type.

import type { Source } from "./sources";

export type StartKind = "research" | "article" | "read" | "thesis";

export const START_KINDS: StartKind[] = ["research", "article", "read", "thesis"];

export const KIND_NAME: Record<StartKind, string> = {
  research: "Research",
  article: "Article",
  read: "Read",
  thesis: "Thesis",
};

/** What happens next, said before it starts. */
export const KIND_WHAT: Record<StartKind, string> = {
  research: "searches, reads the sources in full and writes a report.",
  article: "reads the record and writes an article from it.",
  read: "reads one document whole and lays out what is in it.",
  thesis: "builds the case for and against, finds the crux and gives a verdict.",
};

/** In order: the first that matches wins; nothing matching is research. */
export const KIND_RULES: Array<[StartKind, RegExp]> = [
  // "Test whether…", "Is it true that…", "Claim: …"
  ["thesis", /^\s*(test\b|is it true\b|claim:|thesis:)/i],
  // "Read…", "Lay out…", "Go through…", a file named, or one quoted title.
  ["read", /^\s*(read|lay out|go through)\b/i],
  ["read", /\.(md|pdf|txt|docx)\b/i],
  ["read", /^\s*["“‘'][^"”’']{3,200}["”’']\s*$/],
  // "Write…", "Draft…", "Turn … into…", "Make an article|piece|essay…"
  ["article", /^\s*(write\b|draft\b|turn\b.+\binto\b|make (an?|the) (article|piece|essay)\b)/i],
];

export function guessKind(text: string, fileNames: string[] = []): StartKind {
  for (const [kind, re] of KIND_RULES) if (re.test(text)) return kind;
  // Files and nothing said: read them.
  if (!text.trim() && fileNames.length) return "read";
  return "research";
}

/** The rules as the page needs them: [kind, source, flags]. */
export const kindRulesJson = (): string =>
  JSON.stringify(KIND_RULES.map(([k, re]) => [k, re.source, re.flags]));

export function isStartKind(x: unknown): x is StartKind {
  return typeof x === "string" && (START_KINDS as string[]).includes(x);
}

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

/** The document a "read …" message names, by its title: an exact title
 *  first, then the one title holding most of the words asked for (at least
 *  three in four of them, and clearly ahead of the next). Null when it is
 *  not clear which — the composer then asks for the file or the exact title. */
export function matchTitle(text: string, sources: Source[]): Source | null {
  const asked = text
    .replace(/^\s*(read|lay out|go through)\b\s*(it|the document|the report)?\s*:?\s*/i, "")
    .replace(/^\s*["“‘']|["”’']\s*$/g, "")
    .replace(/\s+in full\.?\s*$/i, "")
    .trim();
  if (!asked) return null;
  const flat = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const exact = sources.find((s) => flat(s.title) === flat(asked));
  if (exact) return exact;
  const want = [...new Set(words(asked))];
  if (!want.length) return null;
  const scored = sources
    .map((s) => {
      const have = new Set(words(s.title));
      return { s, n: want.filter((w) => have.has(w)).length };
    })
    .sort((a, b) => b.n - a.n);
  const [best, next] = scored;
  if (!best || best.n / want.length < 0.75) return null;
  if (next && next.n === best.n) return null;
  return best.s;
}

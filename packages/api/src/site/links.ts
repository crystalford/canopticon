// Links inside a document's text — the record linking itself, the way a
// Wikipedia page does, with no model involved (graph/lib/crosslinks.ts says
// why). Two kinds are placed here:
//
//   - a subject the document shares with another document (from the typed
//     graph, never a person or organisation): the phrase links to that
//     document;
//   - a concept the record named: its name links to the concept's page.
//
// A link is placed only where its phrase is in the text, word for word
// (case aside), in prose — never inside a heading, an existing link, code,
// or a quotation receipt. Each phrase once, each destination once, at most
// MAX_INLINE in a document: density, not reach, is what hurts reading.

import { esc } from "./layout";

export const MAX_INLINE = 12;

export interface InlineLink {
  /** The phrase as the record holds it. */
  label: string;
  href: string;
  /** What the link says on hover: where it goes. */
  title: string;
  kind: "subject" | "concept";
}

const SKIP = /^(a|h[1-6]|code|pre|script|style|button|label|summary)$/i;
const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);

/**
 * Place links in rendered HTML. Walks the markup, tracking whether the text
 * is inside an element links must not enter, and wraps the first prose
 * occurrence of each label. Returns the HTML and the links it placed.
 */
export function spliceLinks(
  html: string,
  links: InlineLink[],
  max = MAX_INLINE,
): { html: string; placed: InlineLink[] } {
  const parts = html.split(/(<[^>]+>)/);
  const placed: InlineLink[] = [];
  /** The text each placed link wraps, as the document writes it. */
  const found: string[] = [];
  const usedTargets = new Set<string>();
  const usedLabels = new Set<string>();
  // Longest phrase first, so "short-term rental registry" wins over "rental".
  const queue = [...links].sort((a, b) => b.label.length - a.label.length);
  const stack: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] ?? "";
    if (part.startsWith("<")) {
      const m = /^<\/?\s*([a-z0-9]+)/i.exec(part);
      const tag = m?.[1]?.toLowerCase() ?? "";
      if (!tag || /\/>$/.test(part) || /^(br|hr|img|input|meta|link|wbr)$/.test(tag)) continue;
      if (part.startsWith("</")) {
        const at = stack.lastIndexOf(tag);
        if (at >= 0) stack.length = at;
      } else stack.push(tag);
      continue;
    }
    if (!part.trim() || stack.some((t) => SKIP.test(t)) || placed.length >= max) continue;
    let text = part;
    for (const l of queue) {
      if (placed.length >= max) break;
      const key = l.label.toLowerCase();
      if (usedLabels.has(key) || usedTargets.has(l.href)) continue;
      const needle = esc(l.label).toLowerCase();
      const hay = text.toLowerCase();
      let at = hay.indexOf(needle);
      // A whole phrase only: "rental" must not link inside "rentals".
      while (at >= 0 && (isWordChar(text[at - 1]) || isWordChar(text[at + needle.length])))
        at = hay.indexOf(needle, at + 1);
      if (at < 0) continue;
      found.push(text.slice(at, at + needle.length));
      // The placeholder keeps later labels from matching inside this link.
      const slot = `\u0000${placed.length}\u0000`;
      text = `${text.slice(0, at)}${slot}${text.slice(at + needle.length)}`;
      placed.push(l);
      usedLabels.add(key);
      usedTargets.add(l.href);
    }
    parts[i] = text.replace(/\u0000(\d+)\u0000/g, (_, n: string) => {
      const l = placed[Number(n)] as InlineLink;
      return `<a class="xl ${l.kind}" href="${esc(l.href)}" title="${esc(l.title)}">${found[Number(n)] ?? esc(l.label)}</a>`;
    });
  }
  return { html: parts.join(""), placed };
}

// ---- matching across documents by shared terms ------------------------------------

const STOP = new Set(
  "the a an and or of to in on for with by is are was were be been being it its this that these those what which who whom how why when where do does did can could should would will may might than then there their they them as at from into about over under between not no yes your you our we he she his her more most less much many any all some such just only also very per".split(
    " ",
  ),
);

/** The content words of a phrase, lightly stemmed, for matching questions
 *  and measures across documents. */
export function contentTerms(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .split(/[\s-]+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map((w) =>
        w
          .replace(/ies$/, "y")
          .replace(/(?<!s)s$/, "")
          // "delisted", "delisting" and "delist" are one word here.
          .replace(/(?<=\p{L}{4})(ing|ed)$/u, ""),
      ),
  );
}

/** The terms two phrases share, when they share enough to be about the same
 *  thing: at least two, and at least 60% of the shorter one. Otherwise null.
 *  The shared terms are shown with the link, so the reader sees why. */
export function sharedTerms(a: string, b: string): string[] | null {
  const ta = contentTerms(a);
  const tb = contentTerms(b);
  const shared = [...ta].filter((w) => tb.has(w));
  const smaller = Math.min(ta.size, tb.size);
  if (shared.length < 2 || !smaller || shared.length / smaller < 0.6) return null;
  return shared;
}

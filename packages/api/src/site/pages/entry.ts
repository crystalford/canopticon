// The one way an entry is shown in a list or on a card, across the site:
// its title, one complete line saying what it is (the piece's own short
// version where it has one, never a cut-off summary), and one quiet line of
// facts. The kind is a word in the meta line, coloured, where a list mixes
// kinds; a list of one kind does not repeat it.

import { article, paper, theory } from "../content/store";
import { esc } from "../layout";
import { kindColours, kindLabel, longDate } from "../theme";

/** The darker of a kind's two colours: the one that reads as text on paper. */
function inkOf(pair: readonly [string, string]): string {
  const lum = (hex: string) => {
    const n = Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
    if (Number.isNaN(n)) return 1;
    return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  };
  return lum(pair[0]) < lum(pair[1]) ? pair[0] : pair[1];
}

/** A kind as a word, in its colour. */
export function kindWord(kind: string, label = kindLabel(kind)): string {
  return `<span class="e-kind" style="color:${inkOf(kindColours(kind))}">${esc(label)}</span>`;
}

/** The facts under an entry, joined as a sentence-case phrase with commas.
 *  `lead` is already HTML (the kind word); the rest are plain text. */
export function metaLine(parts: Array<string | undefined | false>, lead = ""): string {
  // A part may itself be a list of facts ("9 sources · 6 min"): one separator.
  const rest = parts
    .filter((p): p is string => Boolean(p))
    .map((p) => esc(p.replace(/\s+·\s+/g, ", ")));
  if (!lead && !rest.length) return "";
  const body = lead ? [lead, ...rest].join(", ") : rest.join(", ");
  return `<span class="e-meta">${body}</span>`;
}

/** The first sentence of a summary, whole. */
export function firstSentence(s: string): string {
  const text = s.trim();
  const m = text.match(/^.+?[.?!](?=\s+[A-Z“"(]|$)/);
  return (m ? m[0] : text).trim();
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** One complete sentence saying what the thing at `route` is: a piece's own
 *  one-sentence short version (`glance_sentence`), else the first sentence of
 *  its summary. Never a summary cut off mid-sentence. */
export function handleOf(route: string, dek = ""): string {
  const [, section, slug] = route.split("/");
  const own =
    section === "articles"
      ? article(slug ?? "")?.glance_sentence
      : section === "papers"
        ? paper(slug ?? "")?.glance_sentence
        : section === "theories"
          ? theory(slug ?? "")?.glance_sentence
          : undefined;
  if (own) return cap(own.trim());
  return dek ? firstSentence(dek) : "";
}

/** A short version's formula, drawn: each line its own row, the arrows in
 *  the author's colour. */
export function formulaHtml(formula: string, max = 4): string {
  const lines = formula
    .split(/\s*\|\|\s*/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, max);
  if (!lines.length) return "";
  const line = (l: string) =>
    `<span class="fx-l">${l
      .split(/\s*→\s*/)
      .map((part) => `<span class="fx-p">${esc(part)}</span>`)
      .join(
        '<span class="fx-a" aria-hidden="true">→</span><span class="vh"> leads to </span>',
      )}</span>`;
  return `<span class="fx">${lines.map(line).join("")}</span>`;
}

/** A term's card, in the Lexicon and on the front page: the word (with how to
 *  say it, for a coined word), its plain-English handle, the sentence that
 *  defines it, and where it was first stated. */
export function termCard(e: {
  name: string;
  route: string;
  definition: string;
  say?: string | undefined;
  plain?: string | undefined;
  first?: string | undefined;
  date?: string | undefined;
  id?: string | undefined;
}): string {
  const say = e.say ? `<span class="ec-say">${esc(e.say)}</span>` : "";
  const plain = e.plain ? `<span class="ec-h">${esc(cap(e.plain))}</span>` : "";
  const first = e.first
    ? `First stated in ${e.first}${e.date ? `, ${longDate(e.date)}` : ""}`
    : e.date
      ? `Stated ${longDate(e.date)}`
      : undefined;
  return `<a href="${esc(e.route)}" class="card ec"${e.id ? ` id="${esc(e.id)}"` : ""}><span class="ec-t">${esc(e.name)}${say}</span>${plain}<span class="ec-b">${esc(e.definition)}</span>${metaLine([first])}</a>`;
}

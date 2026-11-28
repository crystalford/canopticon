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

/** A term's card, set like a dictionary entry: the word large, how to say
 *  it (for a coined word), its plain-English handle, the sentence that
 *  defines it, and where the word comes from (or, without an etymology,
 *  where it was first stated). */
export function termCard(e: {
  name: string;
  route: string;
  definition: string;
  say?: string | undefined;
  plain?: string | undefined;
  etymology?: string | undefined;
  first?: string | undefined;
  date?: string | undefined;
  id?: string | undefined;
}): string {
  const say = e.say ? `<span class="tw-say">${esc(e.say)}</span>` : "";
  const plain = e.plain ? `<span class="tw-plain">${esc(cap(e.plain))}</span>` : "";
  const first = e.first
    ? `First stated in ${e.first}${e.date ? `, ${longDate(e.date)}` : ""}`
    : e.date
      ? `Stated ${longDate(e.date)}`
      : "";
  const foot = e.etymology
    ? `<span class="tw-et">${esc(e.etymology)}</span>`
    : first
      ? `<span class="tw-et plain">${esc(first)}</span>`
      : "";
  return `<a href="${esc(e.route)}" class="card tw"${e.id ? ` id="${esc(e.id)}"` : ""}><span class="tw-w">${esc(e.name)}</span>${say}${plain}<span class="tw-d">${esc(e.definition)}</span>${foot}</a>`;
}

const f1 = (v: number) => v.toFixed(1);

/** A loop drawn small for a card: its steps on an ellipse, each head beside
 *  its point, arrows round, and the arrow the way out cuts marked in brick.
 *  `id` keeps each card's arrowheads its own. */
export function ringFigure(id: string, steps: string[], cut?: number): string {
  const W = 400;
  const H = 220;
  const cx = W / 2;
  const cy = H / 2;
  const rx = W * 0.24;
  const ry = H * 0.3;
  const n = steps.length;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (a: number) => ({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  const heads = steps.map((s) => (s.split("|")[0] ?? "").trim());
  let arcs = "";
  for (let i = 0; i < n; i++) {
    const a0 = ang(i) + 0.17;
    const a1 = ang(i + 1) - 0.17;
    const pts: string[] = [];
    for (let k = 0; k <= 16; k++) {
      const p = pt(a0 + ((a1 - a0) * k) / 16);
      pts.push(`${f1(p.x)},${f1(p.y)}`);
    }
    const isCut = cut !== undefined && (i + 1) % n === cut - 1;
    arcs += `<polyline class="rg-a${isCut ? " cut" : ""}" points="${pts.join(" ")}" marker-end="url(#${id}-${isCut ? "c" : "h"})"/>`;
    if (isCut) {
      const m = pt((a0 + a1) / 2);
      arcs += `<path class="rg-x" d="M${f1(m.x - 5)} ${f1(m.y - 5)}l10 10M${f1(m.x + 5)} ${f1(m.y - 5)}l-10 10"/>`;
    }
  }
  // Each head's width, roughly (Geist 11.5px averages ~6.2px a character),
  // so the drawing's frame can widen to hold the longest label on each side.
  const widthOf = (t: string) => t.length * 6.2;
  let minX = 0;
  let maxX = W;
  const nodes = heads
    .map((head, i) => {
      const a = ang(i);
      const p = pt(a);
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const anchor = Math.abs(c) < 0.25 ? "middle" : c > 0 ? "start" : "end";
      const tx = p.x + c * 10 + (anchor === "start" ? 2 : anchor === "end" ? -2 : 0);
      const ty = p.y + sn * 12 + (Math.abs(c) < 0.25 ? (sn < 0 ? -2 : 10) : 4);
      const w = widthOf(head);
      const left = anchor === "start" ? tx : anchor === "end" ? tx - w : tx - w / 2;
      minX = Math.min(minX, left - 6);
      maxX = Math.max(maxX, left + w + 6);
      return `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="3.6"/><text x="${f1(tx)}" y="${f1(ty)}" text-anchor="${anchor}">${esc(head)}</text>`;
    })
    .join("");
  const mk = (m: string) =>
    `<marker id="${id}-${m}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1L9 5L0 9"/></marker>`;
  const label = `A loop: ${heads.join(", then ")}, and back to the start.${cut ? ` The way out cuts the step into ${heads[cut - 1] ?? ""}.` : ""}`;
  return `<svg class="rg" viewBox="${f1(minX)} 0 ${f1(maxX - minX)} ${H}" role="img" aria-label="${esc(label)}"><defs>${mk("h")}<g class="cut">${mk("c")}</g></defs>${arcs}<g class="rg-n">${nodes}</g></svg>`;
}

/** How a theory's propositions are graded, as a bar of one segment each:
 *  strong solid, moderate grey, proposed open. */
export function gradeBar(grades: string[], references: number): string {
  const order = ["Strong", "Moderate", "Proposed"];
  const sorted = [...grades].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const n = (g: string) => grades.filter((x) => x === g).length;
  const words = order
    .filter((g) => n(g))
    .map((g) => `${n(g)} ${g.toLowerCase()}`)
    .join(", ");
  return `<span class="gb"><span class="gb-bar" aria-hidden="true">${sorted
    .map((g) => `<span class="gb-${g.toLowerCase()}"></span>`)
    .join(
      "",
    )}</span><span class="gb-t">${grades.length} propositions: ${words}. ${references} references</span></span>`;
}

/** A method as a track: what it takes, one mark per step, what it gives. */
export function trackFigure(formula: string, steps: number): string {
  const toks = formula
    .split(/\s*\|\|\s*/)
    .join(" → ")
    .split(/\s*→\s*/);
  const from = toks[0] ?? "";
  const to = toks[toks.length - 1] ?? "";
  return `<span class="tk" role="img" aria-label="${esc(`From ${from} to ${to} in ${steps} steps`)}"><span class="tk-e">${esc(from)}</span><span class="tk-d" aria-hidden="true">${"<b></b>".repeat(steps)}</span><span class="tk-e out">${esc(to)}</span></span><span class="tk-l" aria-hidden="true">${steps} steps</span>`;
}

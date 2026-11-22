// THE SHARE CARD — the 1200×630 picture a link shows when it is pasted into
// X, Slack, iMessage or LinkedIn. One per page, drawn from what the record
// already holds (title, kind, topic, date, the quotation count), so nothing
// is written twice and no model is asked anything (standing rules 3 and 5).
//
// This file is pure: route → card data → SVG. render.ts turns the SVG into a
// PNG inside the Worker (resvg + the vendored Geist), and routes.ts serves
// it at /card/<page path>.png, cached in R2 under a hash of the SVG — a
// changed title draws a new card, an unchanged one is never drawn twice.
//
// resvg does not wrap text, so the card wraps its own lines with Geist's real
// advance widths (metrics.ts, generated from the font files).

import type { LibraryItem } from "../content/store";
import { kindColours, topicColours, topicSlug } from "../theme";
import {
  MEDIUM_CHARS,
  MEDIUM_WIDTHS,
  REGULAR_CHARS,
  REGULAR_WIDTHS,
  SEMIBOLD_CHARS,
  SEMIBOLD_WIDTHS,
} from "./metrics";

export const CARD_W = 1200;
export const CARD_H = 630;

export interface CardData {
  /** The pills, left to right: [label, background, text]. */
  pills: Array<[string, string, string]>;
  title: string;
  dek: string;
  /** Bottom left: who and when. */
  byline: string;
  /** Bottom right: the receipt — what the page carries that can be checked. */
  stat: string;
}

type Weight = "Regular" | "Medium" | "SemiBold";

function table(chars: string, widths: number[]): Map<string, number> {
  const m = new Map<string, number>();
  [...chars].forEach((ch, i) => m.set(ch, widths[i] ?? 600));
  return m;
}
const WIDTHS: Record<Weight, Map<string, number>> = {
  Regular: table(REGULAR_CHARS, REGULAR_WIDTHS),
  Medium: table(MEDIUM_CHARS, MEDIUM_WIDTHS),
  SemiBold: table(SEMIBOLD_CHARS, SEMIBOLD_WIDTHS),
};

/** How wide a line of text sets, in px. */
export function measure(text: string, size: number, weight: Weight, tracking = 0): number {
  const w = WIDTHS[weight];
  let units = 0;
  let n = 0;
  for (const ch of text) {
    units += w.get(ch) ?? 600;
    n++;
  }
  return (units / 1000) * size + tracking * Math.max(0, n - 1);
}

/** Greedy word wrap into at most `max` lines; the last line that does not fit
 *  ends in an ellipsis. A single word wider than the line is cut. */
export function wrap(
  text: string,
  size: number,
  weight: Weight,
  width: number,
  max: number,
  tracking = 0,
): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let i = 0;
  for (; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : (words[i] as string);
    if (measure(next, size, weight, tracking) <= width) {
      line = next;
      continue;
    }
    if (!line) {
      line = cut(words[i] as string, size, weight, width, tracking);
      continue;
    }
    lines.push(line);
    line = words[i] as string;
    if (lines.length === max) break;
  }
  if (lines.length < max && line) {
    lines.push(line);
    line = "";
    i = words.length;
  }
  if (i < words.length) {
    const last = lines.length - 1;
    lines[last] = ellipsis(lines[last] as string, size, weight, width, tracking);
  }
  return lines;
}

function cut(word: string, size: number, weight: Weight, width: number, tracking: number): string {
  let w = word;
  while (w.length > 1 && measure(`${w}…`, size, weight, tracking) > width) w = w.slice(0, -1);
  return `${w}…`;
}

function ellipsis(
  line: string,
  size: number,
  weight: Weight,
  width: number,
  tracking: number,
): string {
  let l = line.replace(/[\s,;:.—–-]+$/, "");
  while (l && measure(`${l}…`, size, weight, tracking) > width) {
    l = l.replace(/\s*\S+$/, "").replace(/[\s,;:.—–-]+$/, "");
  }
  return `${l}…`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PAD = 80;
const INNER = CARD_W - PAD * 2;
const INK = "#15171c";
const BODY = "#4a4d57";
const MUTED = "#5a5e6b";
const PAPER = "#f6f3ec";
const HAIR = "#e3ddcf";
const GREEN = "#1f5e36";

/** Narrow the measure as far as it goes without adding a line, so a title
 *  never ends on one stray word (the card's text-wrap: balance). */
function balanced(
  text: string,
  size: number,
  weight: Weight,
  width: number,
  max: number,
  tracking: number,
): string[] {
  const lines = wrap(text, size, weight, width, max, tracking);
  if (lines.length < 2 || lines[lines.length - 1]?.endsWith("…")) return lines;
  let lo = width * 0.5;
  let hi = width;
  let best = lines;
  while (hi - lo > 4) {
    const mid = (lo + hi) / 2;
    const tryLines = wrap(text, size, weight, mid, max, tracking);
    if (tryLines.length === lines.length && !tryLines[tryLines.length - 1]?.endsWith("…")) {
      best = tryLines;
      hi = mid;
    } else lo = mid;
  }
  return best;
}

/** The title's size steps down until it fits: three lines at the largest
 *  size, four below that, then cut with an ellipsis. */
function titleLines(title: string): { size: number; lines: string[] } {
  for (const size of [68, 60, 54]) {
    const track = -size * 0.022;
    const lines = wrap(title, size, "Medium", INNER, 9, track);
    if (lines.length <= (size === 68 ? 3 : 4))
      return { size, lines: balanced(title, size, "Medium", INNER, 4, track) };
  }
  return { size: 48, lines: wrap(title, 48, "Medium", INNER, 4, -1) };
}

const TOP = 150;
const FOOT = 530;

export function cardSvg(d: CardData): string {
  const parts: string[] = [];
  // The masthead: the wordmark, as the site sets it.
  parts.push(
    `<text x="${PAD}" y="96" font-family="Geist" font-weight="600" font-size="30" letter-spacing="-0.9" fill="${INK}">canopticon</text>`,
  );
  // The pills, right-aligned on the masthead line.
  let x = CARD_W - PAD;
  for (const [label, bg, fg] of [...d.pills].reverse()) {
    const w = Math.ceil(measure(label, 22, "Medium")) + 32;
    x -= w;
    parts.push(
      `<rect x="${x}" y="66" width="${w}" height="40" rx="20" fill="${bg}"/>`,
      `<text x="${x + 16}" y="93" font-family="Geist" font-weight="500" font-size="22" fill="${fg}">${esc(label)}</text>`,
    );
    x -= 10;
  }
  // The title, then the dek in whatever room the title leaves, the pair
  // centred between the masthead and the foot.
  const t = titleLines(d.title);
  const lead = Math.round(t.size * 1.12);
  const titleH = lead * (t.lines.length - 1) + t.size;
  const DEK = 29;
  const DEK_LEAD = 41;
  const GAP = 26;
  const space = FOOT - 40 - TOP;
  const dekRoom = Math.floor((space - titleH - GAP + DEK_LEAD - DEK) / DEK_LEAD);
  const dek = d.dek && dekRoom >= 1 ? wrap(d.dek, DEK, "Regular", INNER, Math.min(2, dekRoom)) : [];
  const blockH = titleH + (dek.length ? GAP + DEK_LEAD * (dek.length - 1) + DEK : 0);
  let y = TOP + Math.max(0, (space - blockH) / 2) + t.size * 0.8;
  for (const line of t.lines) {
    parts.push(
      `<text x="${PAD}" y="${Math.round(y)}" font-family="Geist" font-weight="500" font-size="${t.size}" letter-spacing="${(-t.size * 0.022).toFixed(2)}" fill="${INK}">${esc(line)}</text>`,
    );
    y += lead;
  }
  y += GAP - lead + t.size * 0.2 + DEK * 0.8;
  for (const line of dek) {
    parts.push(
      `<text x="${PAD}" y="${Math.round(y)}" font-family="Geist" font-size="${DEK}" fill="${BODY}">${esc(line)}</text>`,
    );
    y += DEK_LEAD;
  }
  // The foot: a hairline, who and when on the left, the receipt on the right.
  parts.push(`<rect x="${PAD}" y="${FOOT}" width="${INNER}" height="2" fill="${HAIR}"/>`);
  const statW = d.stat ? measure(d.stat, 24, "Medium") : 0;
  const byline = wrap(d.byline, 24, "Regular", INNER - statW - 40, 1)[0] ?? "";
  parts.push(
    `<text x="${PAD}" y="578" font-family="Geist" font-size="24" fill="${MUTED}">${esc(byline)}</text>`,
  );
  if (d.stat) {
    parts.push(
      `<text x="${CARD_W - PAD}" y="578" text-anchor="end" font-family="Geist" font-weight="500" font-size="24" fill="${GREEN}">${esc(d.stat)}</text>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}"><rect width="${CARD_W}" height="${CARD_H}" fill="${PAPER}"/>${parts.join("")}</svg>`;
}

const AUTHOR = "Chris Telford";

function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "";
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

/** What a library row says on its card. */
export function cardFromItem(i: LibraryItem): CardData {
  const kind = i.kind;
  const [kb, kf] = kindColours(kind);
  const pills: CardData["pills"] = [[kind, kb, kf]];
  if (i.topic && i.topic !== "Other") {
    const [tb, tf] = topicColours(i.topic);
    pills.push([i.topic, tb, tf]);
  }
  const date = longDate(i.date);
  const byline = [AUTHOR, date].filter(Boolean).join(" · ");
  let stat = "";
  if (kind === "Article" && i.quotes) stat = `${i.quotes} quotations checked word for word`;
  else if (kind === "Paper" && i.sources)
    stat = `${i.sources} references · ${i.min ?? ""} min`.replace(/ · $/, "");
  else if (kind === "Research")
    stat = i.min ? `Research document · ${i.min} min read` : "Research document, kept whole";
  else if (kind === "Theory") stat = i.stat ? `A theory · ${i.stat}` : "A theory, stated formally";
  else if (kind === "Concept") stat = "A name the research gave a pattern";
  else if (kind === "Open problem") stat = "An open problem";
  return { pills, title: i.title, dek: i.dek, byline, stat };
}

/** The card for a page with no row of its own: the record itself. */
export function siteCard(title?: string, dek?: string): CardData {
  return {
    pills: [],
    title: title || "A research record you can cite",
    dek:
      dek ||
      "Research, articles and papers by Chris Telford. Every quotation is checked word for word against the page it came from.",
    byline: "canopticon.com",
    stat: "",
  };
}

export function topicCard(topic: string, count: number): CardData {
  const [tb, tf] = topicColours(topic);
  return {
    pills: [
      ["Topic", "#efebe1", INK],
      [topic, tb, tf],
    ],
    title: topic,
    dek: `Everything the record holds on ${topic.toLowerCase()}: articles, research documents, open problems and the questions they raise.`,
    byline: `canopticon.com/topics/${topicSlug(topic)}`,
    stat: count ? `${count} in the record` : "",
  };
}

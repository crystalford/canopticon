// The Black Box palette as data: which colours a kind or a topic wears.
// docs/blackbox/README.md §Design tokens; the per-topic pairs are the ones the
// prototypes use (pages/Canopticon Library.dc.html, `TB`). A colour pair is
// [background, text].

export type Pair = readonly [string, string];

const SAND: Pair = ["#efebe1", "#15171c"];

export const KIND_COLOURS: Record<string, Pair> = {
  Article: ["#e4ecf7", "#1f4e8c"],
  Paper: ["#efe6f6", "#5a2d82"],
  Research: SAND,
  Concept: ["#e3f0e6", "#1f5e36"],
  "Open problem": ["#fbe9df", "#8a3a1f"],
  Project: ["#f3e9d4", "#6b4e14"],
  Personal: ["#f3e9d4", "#6b4e14"],
  Question: SAND,
  Figure: SAND,
  Topic: SAND,
};

export const TOPIC_COLOURS: Record<string, Pair> = {
  "McLuhan & media theory": ["#efe6f6", "#5a2d82"],
  "ADHD & attention": ["#e4ecf7", "#1f4e8c"],
  "Attention & feeds": ["#e4ecf7", "#1f4e8c"],
  "AI-directed development": ["#e4ecf7", "#1f4e8c"],
  "Habits & maintenance": ["#e3f0e6", "#1f5e36"],
  "Health & self-care": ["#e3f0e6", "#1f5e36"],
  "Attribution & credit": ["#fbe9df", "#8a3a1f"],
  "Prices & markets": ["#f3e9d4", "#6b4e14"],
  Economics: ["#f3e9d4", "#6b4e14"],
  "Video & design": SAND,
  "Canadian politics & power": ["#fbe9df", "#8a3a1f"],
  "Canadian economy & policy": ["#f3e9d4", "#6b4e14"],
  "Canadian media": ["#efe6f6", "#5a2d82"],
  Polling: ["#e4ecf7", "#1f4e8c"],
  Housing: ["#f3e9d4", "#6b4e14"],
  "Net-zero finance": ["#e3f0e6", "#1f5e36"],
  "Drugs & public health": ["#e3f0e6", "#1f5e36"],
  Other: SAND,
};

export const kindColours = (kind: string): Pair => KIND_COLOURS[kind] ?? SAND;
export const topicColours = (topic: string): Pair => TOPIC_COLOURS[topic] ?? SAND;

/** The slug rule (site-records.schema.json): lowercase, & → and,
 *  non-alphanumerics → -. "Prices & markets" → "prices-and-markets". */
export function topicSlug(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Inline style for a coloured pill. Colours are data (one per topic), so
 *  they ride on the element; everything else about a pill is the class. */
export function pairStyle([bg, fg]: Pair): string {
  return `background:${bg};color:${fg}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
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

/** "10 Oct" from "2026-10-10". */
export function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso || "—";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
}

/** "10 October 2026" from "2026-10-10". */
export function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso || "date unknown";
  return `${Number(m[3])} ${MONTHS_LONG[Number(m[2]) - 1]} ${m[1]}`;
}

/** "Oct 2026" from "2026-10-10". */
export function monthYear(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : "";
}

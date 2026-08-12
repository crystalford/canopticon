// Figures — the quantities in a sentence, lifted out mechanically.
//
// This exists because of what an institutional investigation actually is.
// Run the IHAP essay through the reader and 28% of its sentences carry a
// number: $750 million to $1.1 billion, $912.3M, $282,345.84, 7,000 people,
// 57,440 claims, and a chronology of 2017 → 2019 → 2024 → 2025 → 2026. The
// argument IS the arithmetic — "the endpoint is identical, the flow is
// rerouted" is a sankey diagram written in prose. Meanwhile the palette has
// twenty-four primitives that consume DATA and, until now, not one that
// produces it. The entire data half of the palette was unreachable.
//
// TWO RULES, and the first is not negotiable.
//
// 1. NO MODEL TOUCHES A FIGURE. Extraction here is a regex over the prose
//    and every figure carries the exact substring it came from, checked
//    against the sentence before it is returned. A language model asked to
//    report the numbers in this essay may hand back "roughly $282,000" and
//    be, in its own terms, helpful. On a financial investigation that is
//    the whole ballgame. The number in the film is the number in the essay
//    or there is no number.
//
// 2. Detection is conservative in the direction that costs least. A missed
//    figure means a scene falls back to its ordinary treatment. An invented
//    one means the film asserts something the essay does not.

/** A quantity found in the prose, with the span it was found in. */
export interface Figure {
  /** The literal substring from the sentence. Never reformatted, never
   *  rounded, never normalised for display. */
  text: string;
  /** Parsed magnitude, for scaling a chart. `text` remains authoritative
   *  for anything the viewer reads. */
  value: number;
  kind: "money" | "count" | "percent" | "year";
  /** Character offset into the sentence. The IR binds to prose by offset
   *  everywhere else; a figure is no different. */
  offset: number;
}

const PATTERNS: { kind: Figure["kind"]; re: RegExp }[] = [
  // Money first, so "$1.1 billion" is one figure rather than the count 1.1
  // plus a stray word. Order is load-bearing: later patterns skip spans
  // already claimed.
  {
    kind: "money",
    re: /\$\s?\d[\d,]*(?:\.\d+)?\s*(?:million|billion|trillion|M\b|B\b)?\+?/gi,
  },
  { kind: "percent", re: /\d+(?:\.\d+)?\s?(?:%|per cent|percent)/gi },
  // A year, but only 1900–2099 — a bare 2024 is a date in this register and
  // a bare 7000 is not.
  { kind: "year", re: /\b(?:19|20)\d{2}\b/g },
  // A count needs either thousands separators or a unit noun. Without that
  // bar every "one purpose" and "three years" becomes a data point and the
  // chart is noise.
  {
    kind: "count",
    re: /\b\d[\d,]*\s*(?:people|persons|claimants|claims|rooms|hotels|cases|beds|households|municipalities|years|months)\b/gi,
  },
];

const MULTIPLIER: Record<string, number> = {
  m: 1e6,
  million: 1e6,
  b: 1e9,
  billion: 1e9,
  trillion: 1e12,
};

/** Parse a figure's magnitude. Returns NaN rather than guessing — a figure
 *  whose value cannot be read is still a figure worth SETTING, it just
 *  cannot be plotted. */
export function figureValue(text: string): number {
  const cleaned = text.replace(/[$,+\s]/g, "");
  const num = Number.parseFloat(cleaned);
  if (Number.isNaN(num)) return Number.NaN;
  const suffix = /(million|billion|trillion|m|b)\s*\+?$/i.exec(text.trim());
  const mult = suffix?.[1] ? (MULTIPLIER[suffix[1].toLowerCase()] ?? 1) : 1;
  return num * mult;
}

/** Every figure in a sentence, in document order, non-overlapping.
 *
 *  Each returned `text` is asserted to be a literal substring at its own
 *  offset. That check is not decoration: it is the mechanical guarantee
 *  that nothing downstream — a chart label, a counter, a caption — can show
 *  a number the essay did not print. */
export function extractFigures(sentence: string): Figure[] {
  const claimed: [number, number][] = [];
  const out: Figure[] = [];

  for (const { kind, re } of PATTERNS) {
    re.lastIndex = 0;
    for (const m of sentence.matchAll(re)) {
      const start = m.index ?? -1;
      if (start < 0) continue;
      const text = m[0].trim();
      const end = start + m[0].length;
      // Money is matched first and wins the span. A year inside "$2024" is
      // not a year, and a count inside a money span is not a count.
      if (claimed.some(([s, e]) => start < e && end > s)) continue;
      claimed.push([start, end]);
      out.push({ text, value: figureValue(text), kind, offset: start });
    }
  }

  out.sort((a, b) => a.offset - b.offset);

  // The verbatim floor. If a figure is not literally present at the offset
  // it claims, it is dropped rather than shown — the same discipline the
  // Record applies to a published quote, for the same reason.
  return out.filter((f) => sentence.slice(f.offset, f.offset + f.text.length).trim() === f.text);
}

/** The stages a quantity is routed through, when the prose names them.
 *
 *  "Ottawa → IRCC → Hotel contracts → Asylum seekers housed" is not a
 *  stylistic flourish, it is the essay's claim, and the claim of a
 *  shell-game investigation is that two of these lines share an endpoint.
 *  Only arrow-separated forms count. Inferring a route from "through" or
 *  "via" would manufacture flows the essay never drew — which on this
 *  subject matter is precisely the error that matters. */
export function extractRoute(sentence: string): string[] {
  if (!/→|->|—>/.test(sentence)) return [];
  // Take the routed clause only: "IHAP Model (Post-Sept 2025): Ottawa → …"
  const after = sentence.includes(":") ? sentence.slice(sentence.indexOf(":") + 1) : sentence;
  const stops = after
    .split(/→|->|—>/)
    .map((s) => s.replace(/[.;]\s*$/, "").trim())
    .filter((s) => s.length > 0 && s.length <= 48);
  return stops.length >= 2 ? stops : [];
}

/** Which DATA primitive a set of figures actually wants.
 *
 *  This is an editorial call the figures themselves can make, and it is the
 *  difference between charting and decorating:
 *
 *    one figure           → a counter. A single sum has no shape; it has a
 *                           magnitude, and a counter is the honest reading.
 *    two or more years    → a timeline. A chronology is not a bar chart.
 *    a routed quantity    → a sankey. "Ottawa → IHAP → provinces → hotels"
 *                           is the essay's own claim about form, and the
 *                           sankey is the only chart that can be wrong
 *                           about it, which is what makes it worth drawing.
 *    otherwise            → cartesian. Comparable magnitudes side by side.
 */
export function chartFor(figures: Figure[], routed: boolean): string {
  // The route is checked FIRST, and that ordering is the rule, not a
  // detail: "Ottawa → IRCC → hotels → housed" carries no quantity at all,
  // and an empty-figures check ahead of it sent the essay's central claim
  // to a counter with nothing to count.
  if (routed) return "sankey_flow";
  if (figures.length === 0) return "counter";
  const years = figures.filter((f) => f.kind === "year");
  if (years.length >= 2) return "timeline_linear";
  if (figures.length === 1) return "counter";
  return "chart_cartesian";
}

/** Serialise figures into the `series` string parameter a DATA source
 *  carries. Parameters are scalars — that is what makes a node hashable —
 *  so the authored data travels as text, and the text is the verbatim
 *  spans joined, never re-rendered from the parsed values. */
export function serialiseFigures(figures: Figure[]): string {
  return figures.map((f) => `${f.text}@${f.kind}`).join("|");
}

/** The inverse, for the Lab. Kept next to the writer so the two can't
 *  drift into different formats. */
export function parseSeries(series: string): { text: string; kind: string; value: number }[] {
  if (series.trim() === "") return [];
  return series
    .split("|")
    .map((part) => {
      const at = part.lastIndexOf("@");
      const text = at < 0 ? part : part.slice(0, at);
      const kind = at < 0 ? "count" : part.slice(at + 1);
      return { text, kind, value: figureValue(text) };
    })
    .filter((f) => f.text !== "");
}

// Independence: which of a report's sources are really one source.
//
// The record's own warning (CLAUDE.md): "three documents agreeing may be one
// upstream page echoing three times". A wire story reprinted by four outlets,
// a press release copied into news coverage, a think-tank brief lifted into a
// blog: each counts as a separate citation and each adds nothing. No model is
// needed to see it — pages that share long runs of identical words are
// copying each other or a common origin. This finds those groups among the
// pages a report cites, so the writer weighs them once and Chris can see it.

import { verbatimNormal } from "./check";
import { voiceOf } from "./evidence";
import type { ResearchSource } from "./research";

/** Words in a run that counts as shared wording. Twelve identical words in
 *  a row almost never happen by chance outside quotations of a common text. */
const RUN = 12;
/** Shared runs that make two pages echoes of each other. */
const SHARED_RUNS = 6;
/** Characters of each page compared (the start of a page is where a copied
 *  story or release usually sits). */
const PAGE_CHARS = 120_000;

export interface EchoGroup {
  /** "wording": pages on different sites sharing long runs of identical
   *  words (copies, or one origin). "publisher": several pages from one
   *  site — not independent either, and their shared navigation and
   *  boilerplate would otherwise look like copying. */
  why: "wording" | "publisher";
  /** Source numbers in the group, smallest first. */
  sources: number[];
  /** Shared twelve-word runs between the most similar pair. */
  runs: number;
  /** One shared passage, for the reader to see. */
  sample: string;
}

/** The site a page is on, without "www.". An Internet Archive copy is the
 *  site it is a copy of: live, six archive copies of Wiley, U of T Press,
 *  SSRN and Government of Canada pages were counted as one publisher, and a
 *  report with about eight independent sources said four. */
export function siteOf(url: string): string {
  const copy = /^https?:\/\/web\.archive\.org\/web\/[^/]+\/(.+)$/i.exec(url);
  if (copy?.[1]) return siteOf(/^https?:\/\//i.test(copy[1]) ? copy[1] : `http://${copy[1]}`);
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function words(text: string): string[] {
  return verbatimNormal(text.slice(0, PAGE_CHARS))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** A cheap, stable 32-bit hash of a run of words. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Groups of cited sources that share long runs of wording. `numbers` maps
 *  a page's address to its source number; pages not cited are ignored. */
export function echoGroups(pages: ResearchSource[], numbers: Map<string, number>): EchoGroup[] {
  const cited = pages
    .map((p) => ({ k: numbers.get(p.url), site: siteOf(p.url), w: words(p.text) }))
    .filter(
      (x): x is { k: number; site: string; w: string[] } =>
        typeof x.k === "number" && x.w.length >= RUN,
    )
    // One entry per source number (a page read at two addresses keeps one).
    .filter((x, i, all) => all.findIndex((y) => y.k === x.k) === i);
  const runs = cited.map((x) => {
    const m = new Map<number, number>();
    for (let i = 0; i + RUN <= x.w.length; i++) m.set(hash(x.w.slice(i, i + RUN).join(" ")), i);
    return m;
  });
  // Union-find over the pairs that share enough runs.
  const parent = cited.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r] as number;
    return r;
  };
  const pairs: Array<{ a: number; b: number; n: number; at: number }> = [];
  for (let a = 0; a < cited.length; a++)
    for (let b = a + 1; b < cited.length; b++) {
      if (cited[a]?.site === cited[b]?.site) continue;
      const [small, large] =
        (runs[a]?.size ?? 0) <= (runs[b]?.size ?? 0) ? [runs[a], runs[b]] : [runs[b], runs[a]];
      let n = 0;
      let at = -1;
      for (const [h, i] of small ?? []) {
        if (large?.has(h)) {
          n++;
          if (at < 0) at = small === runs[a] ? i : (large.get(h) as number);
        }
      }
      if (n >= SHARED_RUNS) {
        pairs.push({ a, b, n, at });
        parent[find(b)] = find(a);
      }
    }
  const groups = new Map<number, number[]>();
  cited.forEach((_, i) => {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), i]);
  });
  const out: EchoGroup[] = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const best = pairs
      .filter((p) => members.includes(p.a) && members.includes(p.b))
      .sort((x, y) => y.n - x.n)[0];
    const w = cited[best?.a ?? (members[0] as number)]?.w ?? [];
    out.push({
      why: "wording",
      sources: members.map((i) => cited[i]?.k as number).sort((x, y) => x - y),
      runs: best?.n ?? 0,
      sample: best && best.at >= 0 ? w.slice(best.at, best.at + RUN + 8).join(" ") : "",
    });
  }
  // Several pages from one site — one voice. A paper's host is a platform,
  // not a voice (evidence.ts voiceOf): each paper counts for itself.
  const titles = new Map(pages.map((p) => [p.url, p.title]));
  const bySite = new Map<string, number[]>();
  for (const [url, k] of numbers) {
    const site = voiceOf(url, titles.get(url));
    if (!bySite.get(site)?.includes(k)) bySite.set(site, [...(bySite.get(site) ?? []), k]);
  }
  for (const [site, ks] of bySite)
    if (ks.length > 1)
      out.push({ why: "publisher", sources: ks.sort((x, y) => x - y), runs: 0, sample: site });
  return out.sort((x, y) => (x.sources[0] ?? 0) - (y.sources[0] ?? 0));
}

/** How many of the cited sources stand on their own: each group counts once. */
export function independentCount(groups: EchoGroup[], total: number): number {
  // A source in two groups (a copy that is also one of a site's pages) is
  // merged once: count the distinct groups a union of the groups makes.
  const parent = new Map<number, number>();
  const find = (k: number): number => {
    let r = k;
    while ((parent.get(r) ?? r) !== r) r = parent.get(r) as number;
    return r;
  };
  for (const g of groups)
    for (const k of g.sources.slice(1)) parent.set(find(k), find(g.sources[0] as number));
  const grouped = new Set(groups.flatMap((g) => g.sources));
  const roots = new Set([...grouped].map(find));
  return total - grouped.size + roots.size;
}

/** What the writer is told: which sources to count once. */
export function describeEchoes(groups: EchoGroup[], total: number): string {
  if (!groups.length) return "";
  return `\nINDEPENDENCE: of ${total} cited sources, about ${independentCount(groups, total)} are independent. Count each group below once when weighing evidence, and say so where the report leans on them together:\n${groups
    .map((g) =>
      g.why === "publisher"
        ? `- ${g.sources.map((k) => `[${k}]`).join(" ")}: all from ${g.sample}`
        : `- ${g.sources.map((k) => `[${k}]`).join(" ")}: share ${g.runs} long passages word for word (copies, or one origin), e.g. "${g.sample}"`,
    )
    .join("\n")}`;
}

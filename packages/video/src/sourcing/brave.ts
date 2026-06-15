// Brave Search as a sourcing radar — the faster complement to GDELT.
//
// GDELT TV transcribes broadcasts on a ~30min–24h lag, so "GDELT's
// last 24h" really means "what aired roughly 4 hours ago and earlier."
// Brave Search News API hits same-day fresh — anything that broke in
// the last 90 minutes is already indexed. Trade-off: no broadcast
// transcripts, just headlines + snippets + URLs.
//
// Cost: ~$3/1000 queries on the paid tier. Daily cron = 30 queries/mo
// peak. Negligible.
//
// Like the GDELT client, gracefully degrades to a stub list when the
// API key isn't configured.

import type { Candidate } from "./gdelt";

const BRAVE_NEWS_API = "https://api.search.brave.com/res/v1/news/search";

interface BraveApiArgs {
  query?: string;
  freshness?: "pd" | "pw" | "pm"; // past day / week / month
  apiKey?: string | undefined;
}

interface BraveResult {
  title?: string;
  url?: string;
  description?: string;
  age?: string;
  source?: { name?: string };
  meta_url?: { hostname?: string };
}

interface BraveResponse {
  results?: BraveResult[];
}

/** Fetch today's Canadian-politics candidates from Brave Search news.
 *  Falls back to an empty list on errors (GDELT covers the floor). */
export async function fetchBraveCandidates(args: BraveApiArgs = {}): Promise<Candidate[]> {
  if (!args.apiKey) return [];
  const query = args.query ?? "Canadian politics OR Canada parliament";
  const freshness = args.freshness ?? "pd";

  try {
    const url = new URL(BRAVE_NEWS_API);
    url.searchParams.set("q", query);
    url.searchParams.set("freshness", freshness);
    url.searchParams.set("count", "15");
    url.searchParams.set("country", "CA");
    const res = await fetch(url.toString(), {
      headers: {
        "X-Subscription-Token": args.apiKey,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as BraveResponse;
    return parseBrave(data.results ?? []);
  } catch {
    return [];
  }
}

function parseBrave(results: BraveResult[]): Candidate[] {
  return results
    .filter((r) => r.url && r.title)
    .map((r, i) => {
      const url = r.url ?? "";
      const captured = parseAge(r.age);
      return {
        id: idFromUrl(url, captured, i),
        network: (r.source?.name ?? r.meta_url?.hostname ?? "web").toUpperCase(),
        clip_url: url,
        captured_at: captured,
        headline: (r.title ?? "").slice(0, 220),
        excerpt: (r.description ?? "").slice(0, 600),
        entities: extractEntities(`${r.title ?? ""} ${r.description ?? ""}`),
        source: "brave" as const,
      };
    });
}

function parseAge(age: string | undefined): string {
  // Brave returns ages like "2 hours ago" / "12 minutes ago" / "3 days ago".
  // Normalise to an ISO timestamp.
  if (!age) return new Date().toISOString();
  const m = age.match(/(\d+)\s*(minute|hour|day|week)/i);
  if (!m) return new Date().toISOString();
  const n = Number(m[1]);
  const unit = (m[2] ?? "").toLowerCase();
  const msPerUnit = unit.startsWith("minute")
    ? 60_000
    : unit.startsWith("hour")
      ? 3_600_000
      : unit.startsWith("day")
        ? 86_400_000
        : 604_800_000;
  return new Date(Date.now() - n * msPerUnit).toISOString();
}

function idFromUrl(url: string, captured: string, index: number): string {
  const hash = Array.from(`${url}|${captured}|${index}`)
    .reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0)
    .toString(36)
    .replace(/-/g, "n");
  return `cand-brave-${captured.slice(0, 10)}-${hash}`;
}

function extractEntities(text: string): string[] {
  const found = new Set<string>();
  const re = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})\b/g;
  let m: RegExpExecArray | null = re.exec(text);
  while (m !== null) {
    if (m[1] && m[1].length > 3) found.add(m[1]);
    m = re.exec(text);
  }
  return Array.from(found).slice(0, 6);
}

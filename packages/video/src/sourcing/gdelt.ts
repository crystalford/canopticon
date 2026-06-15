// GDELT TV API client — the radar for "what's the live story today."
//
// Phase 1 hits the GDELT v3 TV API for Canadian-politics clips from
// the last 24 hours (the "freshest hook" axis of the rubric). The
// response is a flat list of candidate stories with broadcaster + clip
// URL + transcript excerpt + timestamp.
//
// Graceful degradation: when the API is unreachable or the key isn't
// configured, returns a small stubbed list so the operator can verify
// the rest of the pipeline end-to-end. Phase 0's seeded Carney segment
// is the canonical "what good looks like" reference.
//
// Spec ref: handoff Part III §2 / §4 (GDELT as selection signal +
// Internet Archive TV partnership for the actual clip pages).

const GDELT_TV_API = "https://api.gdeltproject.org/api/v2/tv/tv";
const FRESHNESS_HOURS = 24;

export interface Candidate {
  /** Unique id — derived from the clip URL hash + capture timestamp. */
  id: string;
  /** Broadcaster (CBC, CTV, Global, Bloomberg, etc.) */
  network: string;
  /** The clip page URL — IA TV News Archive landing or broadcaster page. */
  clip_url: string;
  /** Capture time in the GDELT system, ISO-8601. */
  captured_at: string;
  /** Headline / chyron / title — what the radar surfaced this as. */
  headline: string;
  /** A short transcript excerpt around the soundbite GDELT matched on. */
  excerpt: string;
  /** Detected entities — politicians, agencies, companies mentioned. */
  entities: string[];
  /** Where this came from — "gdelt" for live, "stub" when the API was
   *  unreachable. The operator sees this in the queue so they know
   *  whether to retry. */
  source: "gdelt" | "stub";
}

interface GdeltApiArgs {
  query?: string;
  hoursBack?: number;
  apiKey?: string | undefined;
}

/** Fetch today's Canadian-politics candidates. Falls back to a stubbed
 *  list when the API is unreachable so Phase 1's editorial pipeline
 *  can run end-to-end before live sourcing is wired. */
export async function fetchCandidates(args: GdeltApiArgs = {}): Promise<Candidate[]> {
  const query = args.query ?? defaultCanadianPoliticsQuery();
  const hoursBack = args.hoursBack ?? FRESHNESS_HOURS;

  try {
    const url = buildUrl(query, hoursBack, args.apiKey);
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return stubbedCandidates();
    }
    const data = (await res.json()) as GdeltResponse;
    const live = parseGdelt(data);
    return live.length > 0 ? live : stubbedCandidates();
  } catch {
    return stubbedCandidates();
  }
}

interface GdeltShow {
  date?: string;
  network?: string;
  show?: string;
  url?: string;
  snippet?: string;
}
interface GdeltResponse {
  status?: string;
  clips?: GdeltShow[];
}

function buildUrl(query: string, hoursBack: number, apiKey?: string): string {
  const params = new URLSearchParams({
    query,
    mode: "ClipGallery",
    format: "json",
    maxrecords: "20",
    timespan: `${hoursBack}h`,
  });
  if (apiKey) params.set("apikey", apiKey);
  return `${GDELT_TV_API}?${params.toString()}`;
}

function parseGdelt(data: GdeltResponse): Candidate[] {
  const clips = data.clips ?? [];
  return clips
    .filter((c) => c.url && c.snippet)
    .map((c, i) => {
      const url = c.url ?? "";
      const captured = normaliseDate(c.date) ?? new Date().toISOString();
      return {
        id: idFromUrl(url, captured, i),
        network: (c.network ?? "unknown").toUpperCase(),
        clip_url: url,
        captured_at: captured,
        headline: (c.show ?? c.snippet ?? "").slice(0, 220),
        excerpt: (c.snippet ?? "").slice(0, 600),
        entities: extractEntities(c.snippet ?? ""),
        source: "gdelt" as const,
      };
    });
}

function idFromUrl(url: string, captured: string, index: number): string {
  // Deterministic id — the same clip on the same day always gets the
  // same id so duplicate fetches don't insert twice.
  const hash = Array.from(`${url}|${captured}|${index}`)
    .reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0)
    .toString(36)
    .replace(/-/g, "n");
  return `cand-${captured.slice(0, 10)}-${hash}`;
}

function normaliseDate(d: string | undefined): string | null {
  if (!d) return null;
  // GDELT TV dates are YYYYMMDDHHMMSS — normalise to ISO.
  if (/^\d{14}$/.test(d)) {
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(8, 10)}:${d.slice(10, 12)}:${d.slice(12, 14)}Z`;
  }
  const parsed = Date.parse(d);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

// Small entity extractor — looks for capitalised multi-word phrases.
// Phase 2 will route this through Workers AI for real NER; this just
// gives the operator something to see in the queue page.
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

function defaultCanadianPoliticsQuery(): string {
  // GDELT's TV query DSL — match transcripts mentioning Canadian
  // political topics. Bounded to Canadian broadcasters so the radar
  // stays in-lane.
  return [
    "(Canada OR Canadian OR Ottawa OR Carney OR Poilievre OR Freeland OR Trudeau)",
    "marketCountry:CA",
  ].join(" AND ");
}

// Stubbed list used when the live API is unreachable. Gives the
// operator something to see in the queue so the rest of the pipeline
// can be exercised before GDELT_API_KEY is configured.
function stubbedCandidates(): Candidate[] {
  const now = new Date();
  const iso = (h: number): string => new Date(now.getTime() - h * 3600_000).toISOString();
  return [
    {
      id: `cand-stub-${iso(2).slice(0, 10)}-carney-evs`,
      network: "CBC",
      clip_url: "https://www.cbc.ca/news/politics/carney-china-ev-strategy-stub",
      captured_at: iso(2),
      headline: "Carney offers assurances to autoworkers after Chinese-EV deal goes live",
      excerpt:
        "Prime Minister Mark Carney said most of the vehicles arriving under the new trade arrangement will look like Teslas...",
      entities: ["Mark Carney", "Tesla", "Canada", "China"],
      source: "stub",
    },
    {
      id: `cand-stub-${iso(6).slice(0, 10)}-poilievre-housing`,
      network: "CTV",
      clip_url: "https://www.ctvnews.ca/politics/poilievre-housing-stub",
      captured_at: iso(6),
      headline: "Poilievre tables motion targeting CMHC mortgage rules",
      excerpt:
        "The opposition leader argued the regulator's tightened serviceability rules are pricing first-time buyers out...",
      entities: ["Pierre Poilievre", "CMHC", "Canada"],
      source: "stub",
    },
    {
      id: `cand-stub-${iso(14).slice(0, 10)}-freeland-budget`,
      network: "GLOBAL",
      clip_url: "https://globalnews.ca/news/budget-update-stub",
      captured_at: iso(14),
      headline: "Freeland defends fiscal update against revised deficit projections",
      excerpt:
        "The finance minister insisted the trajectory holds even as the parliamentary budget officer published a sharper revision...",
      entities: ["Chrystia Freeland", "PBO", "Canada"],
      source: "stub",
    },
  ];
}

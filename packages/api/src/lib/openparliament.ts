// Adapter for the openparliament.ca public REST API.
//
// Docs: https://api.openparliament.ca/
// Their API requires no key but asks every consumer to set a descriptive
// User-Agent so they can contact you if your client misbehaves. We pass
// env.OPENPARLIAMENT_USER_AGENT — set it to something like
// "canopticon-api (operator@example.com)".
//
// Endpoints used:
//   GET /debates/?format=json
//     Returns a paginated list of debate sitting days (newest first).
//   GET /debates/<date>/<number>/?format=json
//     Returns a single debate with metadata.
//   GET /debates/<date>/<number>/speeches/?format=json
//     Returns the speeches transcript for a debate.
//
// We model the network surface narrowly — only the fields we use are
// typed. The full response is preserved on `sources.metadata` so the
// substrate retains everything for later analysis.

const DEFAULT_BASE = "https://api.openparliament.ca";

export interface OpenParliamentClientOptions {
  baseUrl?: string;
  userAgent: string;
  fetch?: typeof fetch;
}

export interface DebateSummary {
  /** Canonical URL on openparliament.ca, e.g. "/debates/2024/jan/15/". */
  url: string;
  /** ISO date of the sitting day, e.g. "2024-01-15". */
  date: string;
  /** Sitting number within the parliamentary session. */
  number: string;
  /** Number of speeches in the debate. */
  speeches_count?: number;
  /** Most frequent non-stopword in the debate (a rough thematic hint). */
  most_frequent_word?: { en?: string; fr?: string };
}

export interface DebateDetail extends DebateSummary {
  /** URL of the speeches sub-resource. */
  speeches_url?: string;
}

export interface Speech {
  url?: string;
  /** Speaker's display name. */
  politician_membership?: { politician?: { name?: string } };
  /** ISO timestamp of the speech. */
  time?: string;
  /** Speech content (HTML or plain text depending on the API version). */
  content?: { en?: string; fr?: string };
}

export class OpenParliamentClient {
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly fetch: typeof fetch;

  constructor(options: OpenParliamentClientOptions) {
    if (!options.userAgent) {
      throw new Error("OpenParliamentClient: userAgent is required (their TOS asks for it)");
    }
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE;
    this.userAgent = options.userAgent;
    this.fetch = options.fetch ?? fetch;
  }

  /** List the most recent debates, newest first. */
  async listRecentDebates(limit = 10): Promise<DebateSummary[]> {
    const url = `${this.baseUrl}/debates/?format=json&limit=${limit}`;
    const data = (await this.get(url)) as { objects?: DebateSummary[] };
    return data.objects ?? [];
  }

  /** Fetch the full debate metadata for a sitting. */
  async getDebate(date: string, number: string): Promise<DebateDetail> {
    const url = `${this.baseUrl}/debates/${date}/${number}/?format=json`;
    return (await this.get(url)) as DebateDetail;
  }

  /** Fetch all speeches for a sitting, paginating until done. */
  async getDebateSpeeches(date: string, number: string): Promise<Speech[]> {
    const speeches: Speech[] = [];
    let next: string | null =
      `${this.baseUrl}/debates/${date}/${number}/speeches/?format=json&limit=50`;
    while (next) {
      const page = (await this.get(next)) as {
        objects?: Speech[];
        pagination?: { next_url?: string | null };
      };
      if (page.objects) speeches.push(...page.objects);
      next = page.pagination?.next_url ? `${this.baseUrl}${page.pagination.next_url}` : null;
    }
    return speeches;
  }

  private async get(url: string): Promise<unknown> {
    const res = await this.fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "user-agent": this.userAgent,
      },
    });
    if (!res.ok) {
      throw new Error(`openparliament: GET ${url} → ${res.status} ${res.statusText}`);
    }
    return await res.json();
  }
}

// Helpers for converting an openparliament debate into a CANOPTICON `sources`
// row. Kept here (not in the cron handler) so other ingestion paths — manual
// "import this debate" actions, backfill scripts, replays — share the same
// canonicalization.

export interface NormalizedHansardSource {
  source_type: "hansard";
  title: string;
  url: string;
  publication: "openparliament.ca";
  published_at: string;
  raw_text: string;
  admiralty_grade: "A";
  ingestion_mode: "automatic";
  ingestion_state: "pending_critic";
  metadata: Record<string, unknown>;
  slug: string;
}

export function normalizeDebate(
  debate: DebateDetail,
  speeches: Speech[],
  baseUrl = "https://openparliament.ca",
): NormalizedHansardSource {
  const title = `Hansard — Sitting ${debate.number}, ${formatDate(debate.date)}`;
  const url = debate.url.startsWith("http") ? debate.url : `${baseUrl}${debate.url}`;
  const slug = `hansard-${debate.date}-${debate.number}`;

  const raw_text = speeches
    .map((s) => {
      const speaker = s.politician_membership?.politician?.name ?? "Speaker";
      const body = stripHtml(s.content?.en ?? "");
      return body ? `${speaker}: ${body}` : "";
    })
    .filter((line) => line.length > 0)
    .join("\n\n");

  return {
    source_type: "hansard",
    title,
    url,
    publication: "openparliament.ca",
    published_at: `${debate.date}T00:00:00Z`,
    raw_text,
    admiralty_grade: "A",
    ingestion_mode: "automatic",
    ingestion_state: "pending_critic",
    metadata: {
      openparliament: {
        date: debate.date,
        number: debate.number,
        speeches_count: speeches.length,
        most_frequent_word: debate.most_frequent_word,
      },
    },
    slug,
  };
}

function stripHtml(input: string): string {
  // Very light strip: remove tags, decode the small set of named entities the
  // openparliament feed actually emits. Anything more than this belongs in a
  // proper HTML parser, but we want this code to run in Workers without a
  // DOM dependency.
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthName = months[Number(m) - 1] ?? m;
  return `${monthName} ${Number(d)}, ${y}`;
}

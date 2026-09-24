// Record-building on click (spec v2.6 Part 26).
//
// When the logged-in operator clicks a thin Record, the click IS the build
// signal. The system immediately:
//   1. Returns the page rendered from whatever exists (the renderer does this
//      independently — even a name + one citation lands).
//   2. Searches the web for the subject name via Brave Search.
//   3. Fetches each found page.
//   4. Banks the fetched content as a `sources` row (with content-hash
//      dedup). SOURCES ONLY — never a `pieces` row, and no digest job.
//
// Why fetched pages are sources and not pieces (docs/the-record.md §6):
// they used to be written to BOTH tables, so every third-party page the
// crawler touched — brainly.com answers, Cloudflare "Just a moment..."
// bot-challenge pages — showed up in /library beside the operator's own
// documents, and "Extract all" would have pulled quotes from them into the
// graph. A fetched page is raw material for the research writer to read
// (deep-research.ts reads it back from `sources`); it is not a document in
// the record, and it never gets a URL.
//
// Junk is refused at fetch time, before any write: bot-challenge and blocked
// pages, and bodies under MIN_TEXT_CHARS (see rejectFetchedPage). Each
// rejection is recorded in orchestrator_events with its reason so the
// research workspace can list "rejected: <url> — bot challenge".
//
// The architecture is jurisdiction-aware but global. Not Canada-hardcoded.
//
// State is observable via the orchestrator_events table so the research
// workspace and the expanding banner can surface progress.
//
// Modes:
//   - Live: BRAVE_SEARCH_API_KEY set → real searches, real fetches.
//   - Stub: key absent → emits an event saying the key isn't configured and
//     no-ops. The affordance is visible; the action is wired; the secret
//     is the missing piece.

import { approvePaidOperation } from "../../cost/approve";
import type { Env } from "../../env";
import { all, insertOne, one } from "../../lib/d1";
import { TIMEOUTS, fetchWithTimeout } from "../../lib/timeout";
import { BROWSER_RENDERING_PER_PAGE_CENTS, callBrowserRendering } from "../tools/web_research";

const BRAVE_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const MAX_SOURCES_PER_EXPAND = 6;
const SEARCH_POOL_SIZE = 15; // requested from Brave, before the low-yield filter below
export const MIN_TEXT_CHARS = 400; // reject pages that didn't yield real article text

// ---------------------------------------------------------------------------
// Junk detection — a pure function over what a fetch returned, applied BEFORE
// any write. Observed live in the library: "Just a moment..." (Cloudflare's
// bot challenge, which strips to a few hundred characters of "Enable
// JavaScript and cookies to continue" and a challenge-platform script
// reference) banked as a research report. Jina's reader proxy reports a
// blocked origin inline as text rather than as an HTTP error, so its warning
// line is a body match too.
// ---------------------------------------------------------------------------

const BLOCKED_TITLE_RE =
  /^(just a moment|attention required|access denied|verifying you are human|checking your browser)/i;

const BLOCKED_BODY_MARKERS = [
  "challenge-platform",
  "cf_chl",
  "Enable JavaScript and cookies to continue",
  "Warning: Target URL returned error 403",
];

/**
 * Why a fetched page must not be banked, or null when it is usable.
 *
 * Order matters only for the reason reported: a bot-challenge page is usually
 * also short, and "bot challenge" is the more useful thing to tell the
 * operator than "too short".
 */
export function rejectFetchedPage(title: string, text: string): string | null {
  if (BLOCKED_TITLE_RE.test(title.trim())) return "bot challenge";
  const body = text.slice(0, 20_000);
  for (const marker of BLOCKED_BODY_MARKERS) {
    if (body.includes(marker)) {
      return marker.startsWith("Warning:") ? "blocked (403 via reader)" : "bot challenge";
    }
  }
  if (text.length < MIN_TEXT_CHARS) return `too short (${text.length} chars)`;
  return null;
}

// Social/video platforms whose pages are either walled off from a plain
// HTTP fetch (login/JS-rendered) or return no real article text even when
// reachable. Confirmed live: for "World Economic Forum," Brave's top 6
// results were the org's own site (403, bot-blocked) plus YouTube,
// Instagram, X, and Facebook — none fetchable — so record-expand banked
// nothing at all for one of the most obvious subjects someone would search
// for. Filtering these out before spending a fetch attempt on them means
// the fetch budget goes to sources that can actually work.
const LOW_YIELD_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "instagram.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "linkedin.com",
  "pinterest.com",
];

function isLowYieldDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return LOW_YIELD_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export interface RejectedSource {
  url: string;
  reason: string;
}

export interface ExpandReport {
  subject: string;
  configured: boolean;
  sources_found: number;
  sources_fetched: number;
  sources_banked: number;
  sources_duplicate: number;
  sources_rejected: number;
  errors: string[];
  /** Pages refused at fetch time, each with why. Never written anywhere. */
  rejected: RejectedSource[];
  /** `sources.id` of every page banked by THIS expand (duplicates excluded). */
  banked_source_ids: string[];
}

/** The single entry point. Called from the /op/records/:slug/expand handler
 *  via c.executionCtx.waitUntil so the page render returns instantly, and
 *  from deep-research.ts as the banking step of a research run.
 *
 *  Search + fetch + bank ONLY. It does not extract: fetched pages are
 *  sources for a writer to read, not documents, so nothing is digested into
 *  the graph and no `pieces` row is ever created here. (It used to enqueue
 *  a digest job per page as well — that is how third-party text reached
 *  the typed graph and the library. See the file header.) */
export async function expandRecord(
  env: Env,
  userId: string,
  subjectLabel: string,
): Promise<ExpandReport> {
  const report: ExpandReport = {
    subject: subjectLabel,
    configured: !!env.BRAVE_SEARCH_API_KEY,
    sources_found: 0,
    sources_fetched: 0,
    sources_banked: 0,
    sources_duplicate: 0,
    sources_rejected: 0,
    errors: [],
    rejected: [],
    banked_source_ids: [],
  };

  await emit(env, userId, "record.expand.started", { subject: subjectLabel });

  if (!env.BRAVE_SEARCH_API_KEY) {
    await emit(env, userId, "record.expand.skipped", {
      subject: subjectLabel,
      reason: "BRAVE_SEARCH_API_KEY not configured",
    });
    return report;
  }

  let searchResults: BraveResult[];
  try {
    searchResults = await braveSearch(env.BRAVE_SEARCH_API_KEY, subjectLabel, SEARCH_POOL_SIZE);
  } catch (err) {
    report.errors.push(`search failed: ${(err as Error).message}`);
    await emit(env, userId, "record.expand.failed", {
      subject: subjectLabel,
      stage: "search",
      error: report.errors.at(-1),
    });
    return report;
  }
  report.sources_found = searchResults.length;
  // Skip domains already known to never yield fetchable article text —
  // spend the fetch budget on sources that can actually work.
  const results = searchResults
    .filter((r) => !isLowYieldDomain(r.url))
    .slice(0, MAX_SOURCES_PER_EXPAND);
  await emit(env, userId, "record.expand.search_done", {
    subject: subjectLabel,
    found: searchResults.length,
    usable: results.length,
  });

  // Process sources CONCURRENTLY, not one at a time. Each source is just an
  // HTTP GET + a couple of D1 writes, no LLM calls, and fully independent of
  // every other source in this batch — nothing here shares mutable state
  // across sources, so there was never a reason for them to wait on each
  // other. Sequential was the whole latency problem: up to 6 real network
  // fetches, back to back, each with its own timeout and a possible
  // Browser Rendering fallback (slower still) on top. Bounded by
  // MAX_SOURCES_PER_EXPAND (6) either way, so this doesn't need a separate
  // concurrency limiter — the cap already IS the limiter. Per-source
  // progress emits still fire; they just interleave across sources now
  // instead of running in a strict a-then-b-then-c order (the live banner
  // narrates off the latest event either way, so this reads fine).
  // allSettled, not all — one source rejecting must not cancel the rest.
  const outcomes = await Promise.allSettled(
    results.map(async (r) => {
      await emit(env, userId, "record.expand.source_fetching", {
        subject: subjectLabel,
        title: r.title,
        url: r.url,
      });
      const outcome = await fetchAndBank(env, userId, r.url, r.title || subjectLabel);
      if (outcome.kind === "rejected") {
        // Recorded with its reason and NOT written anywhere — the workspace
        // lists it as "rejected: <url> — <reason>" from this event.
        await emit(env, userId, "record.expand.source_rejected", {
          subject: subjectLabel,
          url: r.url,
          title: outcome.title || r.title || "",
          reason: outcome.reason,
        });
        return { url: r.url, kind: "rejected" as const, reason: outcome.reason };
      }
      if (outcome.duplicate) {
        await emit(env, userId, "record.expand.source_duplicate", {
          subject: subjectLabel,
          url: r.url,
        });
        return { url: r.url, kind: "duplicate" as const, sourceId: outcome.sourceId };
      }
      await emit(env, userId, "record.expand.source_banked", {
        subject: subjectLabel,
        url: r.url,
        title: outcome.title,
        chars: outcome.chars,
      });
      return { url: r.url, kind: "banked" as const, sourceId: outcome.sourceId };
    }),
  );

  for (const [i, outcome] of outcomes.entries()) {
    const url = results[i]?.url ?? "unknown";
    if (outcome.status === "rejected") {
      const message = (outcome.reason as Error)?.message ?? String(outcome.reason);
      report.errors.push(`fetch ${url}: ${message}`);
      await emit(env, userId, "record.expand.source_failed", {
        subject: subjectLabel,
        url,
        error: message,
      });
      continue;
    }
    const { kind } = outcome.value;
    if (kind === "rejected") {
      report.sources_rejected++;
      report.rejected.push({ url, reason: outcome.value.reason });
      continue;
    }
    report.sources_fetched++;
    if (kind === "banked") {
      report.sources_banked++;
      report.banked_source_ids.push(outcome.value.sourceId);
    } else if (kind === "duplicate") {
      report.sources_duplicate++;
    }
  }

  // "completed" means the search+fetch+bank phase is done, and that is all
  // there is: nothing is queued behind it. The ids are source ids.
  await emit(env, userId, "record.expand.completed", {
    subject: subjectLabel,
    found: report.sources_found,
    fetched: report.sources_fetched,
    banked: report.sources_banked,
    rejected: report.sources_rejected,
    banked_source_ids: report.banked_source_ids,
  });
  return report;
}

export interface ExpandStatus {
  /** True once nothing more will happen automatically — safe to stop polling. */
  terminal: boolean;
  /** True if the overall run ended cleanly (no per-source failures). */
  warn: boolean;
  /** Plain-text narration — the caller escapes/wraps as HTML. */
  line: string;
  /**
   * Always 0. Fetched pages are no longer digested into the graph, so an
   * expand adds no facts. Kept on the shape so the callers that summed it
   * (bulk-expand.ts) keep compiling; there is nothing to sum.
   */
  factsAdded: number;
}

interface ExpandEventRow {
  event_type: string;
  payload: string;
  created_at: string;
}

/** The single source of truth for "how is this record-expand run going,
 *  right now" — used by the research workspace (to know when to stop
 *  polling), the per-subject banner, and the bulk-expand result page. Reads
 *  orchestrator_events for the search/fetch/bank phase. "completed" IS the
 *  end: nothing is queued behind a bank any more. */
export async function getExpandStatus(
  env: { DB: D1Database },
  userId: string,
  subjectLabel: string,
): Promise<ExpandStatus | null> {
  const events = await all<ExpandEventRow>(
    env.DB,
    `SELECT event_type, payload, created_at
       FROM orchestrator_events
      WHERE user_id = ?
        AND event_type LIKE 'record.expand.%'
        AND json_extract(payload, '$.subject') = ?
        AND created_at > datetime('now','-15 minutes')
      ORDER BY created_at DESC
      LIMIT 50`,
    [userId, subjectLabel],
  ).catch(() => []);
  if (events.length === 0) return null;

  const latest = events[0] as ExpandEventRow;
  const completed = events.find((e) => e.event_type === "record.expand.completed");
  const failed = events.find((e) => e.event_type === "record.expand.failed");
  const skipped = events.find((e) => e.event_type === "record.expand.skipped");
  const sourceSeen = events.filter((e) => e.event_type === "record.expand.source_fetching").length;
  const sourceBanked = events.filter((e) => e.event_type === "record.expand.source_banked").length;
  const sourceRejected = events.filter(
    (e) => e.event_type === "record.expand.source_rejected",
  ).length;

  if (skipped) {
    const reason = field(skipped.payload, "reason") ?? "unconfigured";
    return {
      terminal: true,
      warn: true,
      line: `Expansion skipped — ${reason}. Set BRAVE_SEARCH_API_KEY to enable web record-building.`,
      factsAdded: 0,
    };
  }
  if (failed) {
    const error = field(failed.payload, "error") ?? "unknown";
    return { terminal: true, warn: true, line: `Expansion failed — ${error}`, factsAdded: 0 };
  }

  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

  if (!completed) {
    const stage = latest.event_type.replace("record.expand.", "");
    let line = "Working…";
    if (stage === "started") line = `Starting expansion for ${subjectLabel}…`;
    else if (stage === "search_done") line = "Search done — fetching sources…";
    else if (stage === "source_fetching") {
      line = `Fetching source ${sourceSeen} — ${field(latest.payload, "title") ?? ""}`;
    } else if (stage === "source_banked") {
      line = `Banked ${plural(sourceBanked, "source")}…`;
    } else if (stage === "source_rejected") {
      line = `Rejected ${field(latest.payload, "url") ?? "a page"} — ${
        field(latest.payload, "reason") ?? "unusable"
      }`;
    } else if (stage === "source_duplicate") line = "Already had that source · moving on…";
    return { terminal: false, warn: false, line, factsAdded: 0 };
  }

  const rejectedNote = sourceRejected > 0 ? ` · ${plural(sourceRejected, "page")} rejected` : "";
  if (sourceBanked === 0) {
    return {
      terminal: true,
      warn: false,
      line: `Searched and fetched, but nothing new to add — every source found was already on record or unusable${rejectedNote}.`,
      factsAdded: 0,
    };
  }

  return {
    terminal: true,
    warn: false,
    line: `Sources banked — ${plural(sourceBanked, "source")} ready for the writer${rejectedNote}.`,
    factsAdded: 0,
  };
}

function field(payload: string, key: string): string | null {
  try {
    const obj = JSON.parse(payload) as Record<string, unknown>;
    const v = obj[key];
    if (v == null) return null;
    return typeof v === "string" ? v : String(v);
  } catch {
    return null;
  }
}

interface BraveResult {
  title: string;
  url: string;
  description: string;
}

async function braveSearch(apiKey: string, query: string, count = 6): Promise<BraveResult[]> {
  const url = `${BRAVE_SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&count=${count}`;
  const res = await fetchWithTimeout(
    url,
    { headers: { Accept: "application/json", "X-Subscription-Token": apiKey } },
    TIMEOUTS.WEB_FETCH_MS,
    `brave-search[${query}]`,
  );
  if (!res.ok) throw new Error(`brave search ${res.status}`);
  const json = (await res.json()) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };
  const items = json.web?.results ?? [];
  return items
    .map((i) => ({ title: i.title ?? "", url: i.url ?? "", description: i.description ?? "" }))
    .filter((i) => i.url);
}

interface Fetched {
  title: string;
  text: string;
}

type BankOutcome =
  | { kind: "banked"; sourceId: string; title: string; chars: number; duplicate: boolean }
  | { kind: "rejected"; reason: string; title: string };

/** Jina AI Reader (r.jina.ai) — a free, keyless public fetch-and-render
 *  proxy: it executes JS and presents as a different client entirely, so
 *  it clears a lot of "the official site 403s a plain bot fetch" cases on
 *  its own, no account configuration required. Tried first in the
 *  fallback chain below because it costs nothing and needs no setup. */
async function fetchViaJinaReader(url: string): Promise<{ title: string; text: string } | null> {
  try {
    const res = await fetchWithTimeout(
      `https://r.jina.ai/${url}`,
      { headers: { Accept: "text/plain" } },
      TIMEOUTS.WEB_FETCH_MS,
      `jina-reader[${url}]`,
    );
    if (!res.ok) return null;
    const raw = (await res.text()).trim();
    const titleMatch = raw.match(/^Title:\s*(.+)$/m);
    const bodyMatch = raw.match(/Markdown Content:\s*([\s\S]*)$/);
    const text = (bodyMatch?.[1] ?? raw).trim();
    if (text.length < MIN_TEXT_CHARS) return null;
    return { title: titleMatch?.[1]?.trim() ?? "", text };
  } catch {
    return null;
  }
}

/** The Wayback Machine — free, keyless. If the live page is unreachable
 *  right now but was ever crawled, archive.org's public availability API
 *  points at the most recent snapshot, which is fetched and stripped the
 *  same way a live page would be. Tried second: still free, but a
 *  snapshot can be stale, so a live render (Jina) is preferred first. */
async function fetchViaWaybackMachine(
  url: string,
): Promise<{ title: string; text: string } | null> {
  try {
    const availRes = await fetchWithTimeout(
      `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
      {},
      TIMEOUTS.WEB_FETCH_MS,
      `wayback-check[${url}]`,
    );
    if (!availRes.ok) return null;
    const avail = (await availRes.json()) as {
      archived_snapshots?: { closest?: { available?: boolean; url?: string } };
    };
    const closest = avail.archived_snapshots?.closest;
    if (!closest?.available || !closest.url) return null;
    const pageRes = await fetchWithTimeout(
      closest.url,
      { headers: { "User-Agent": "CanopticonBot/1.0 (+https://canopticon.com)" } },
      TIMEOUTS.WEB_FETCH_MS,
      `wayback-fetch[${url}]`,
    );
    if (!pageRes.ok) return null;
    const html = await pageRes.text();
    const { title, text } = stripHtmlToText(html);
    if (text.length < MIN_TEXT_CHARS) return null;
    return { title, text };
  } catch {
    return null;
  }
}

/** Cloudflare Browser Rendering (a real headless browser under this
 *  account, executes JS) — the last resort in the fallback chain: the
 *  only option that costs money and needs CLOUDFLARE_ACCOUNT_ID /
 *  CLOUDFLARE_API_TOKEN configured, so it's only reached once the two
 *  free options above have both already failed. Gated by the cost
 *  ledger, not an operator confirm card — this runs unattended from a
 *  cron sweep, so the "browser_rendering.fetch" whitelist cap
 *  (lib/seed.ts) IS the approval; see cost/approve.ts. If the account
 *  isn't configured or the cap is hit, this just returns null and the
 *  caller's existing failure stands — never a hard error on its own. */
async function fetchViaRenderingFallback(
  env: Env,
  userId: string,
  url: string,
): Promise<{ title: string; text: string } | null> {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) return null;
  const decision = await approvePaidOperation(env.DB, {
    user_id: userId,
    operation_type: "browser_rendering.fetch",
    provider: "cloudflare_browser_rendering",
    estimated_cost_cents: BROWSER_RENDERING_PER_PAGE_CENTS,
    reason: `record-builder fetch-fallback: ${url}`,
    idempotency_key: undefined,
  }).catch(() => null);
  if (!decision || decision.decision !== "approved") return null;
  const r = await callBrowserRendering(env, "content", { url }).catch((err) => ({
    ok: false as const,
    error: (err as Error).message,
  }));
  if (!r.ok) return null;
  const html = String(r.data ?? "");
  const { title, text } = stripHtmlToText(html);
  if (text.length < MIN_TEXT_CHARS) return null;
  return { title, text };
}

/** The ordered fallback chain a plain fetch drops into on failure or too-
 *  little-text: free options first (no cost, no configuration needed),
 *  the paid Browser Rendering call last. */
async function fetchViaFallbacks(
  env: Env,
  userId: string,
  url: string,
): Promise<{ title: string; text: string } | null> {
  const viaJina = await fetchViaJinaReader(url);
  if (viaJina) return viaJina;
  const viaWayback = await fetchViaWaybackMachine(url);
  if (viaWayback) return viaWayback;
  return fetchViaRenderingFallback(env, userId, url);
}

/** Fetch a URL, strip the HTML to plain text, and bank it as a `sources`
 *  row — and ONLY a sources row (no piece, no digest job; see the file
 *  header). The full text is kept inline in content_text, as it always was
 *  for fetched pages; deep-research.ts reads it back through the same
 *  helper uploads use (readFullExtractedText), which honours an R2 overflow
 *  when one is recorded and takes the inline text otherwise.
 *
 *  Never writes junk: the page is checked by rejectFetchedPage() before the
 *  dedup lookup. A bot-challenge page from the plain fetch is handed to the
 *  fallback chain first (a reader proxy or a real browser often clears the
 *  challenge); only if what comes back is still unusable is it rejected.
 *
 *  Throws when nothing could be fetched at all (every fallback failed), so
 *  the caller can report a fetch error as distinct from a rejection. */
async function fetchAndBank(
  env: Env,
  userId: string,
  url: string,
  fallbackTitle: string,
): Promise<BankOutcome> {
  let page: Fetched;
  let viaFallback = false;
  try {
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          // Many sites block default user-agents. Identify ourselves honestly.
          "User-Agent":
            "CanopticonBot/1.0 (+https://canopticon.com; record-building on click; contact @canoptics)",
          Accept: "text/html,application/xhtml+xml",
        },
      },
      TIMEOUTS.WEB_FETCH_MS,
      `expand-fetch[${url}]`,
    );
    if (!res.ok) throw new Error(`http ${res.status}`);
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!ct.includes("html") && !ct.includes("text")) {
      throw new Error(`unsupported content-type ${ct}`);
    }
    const stripped = stripHtmlToText(await res.text());
    const reason = rejectFetchedPage(stripped.title, stripped.text);
    if (reason) {
      const rendered = await fetchViaFallbacks(env, userId, url);
      const renderedReason = rendered ? rejectFetchedPage(rendered.title, rendered.text) : null;
      if (!rendered || renderedReason) {
        return { kind: "rejected", reason: renderedReason ?? reason, title: stripped.title };
      }
      page = rendered;
      viaFallback = true;
    } else {
      page = stripped;
    }
  } catch (err) {
    const rendered = await fetchViaFallbacks(env, userId, url);
    if (!rendered) throw err;
    const reason = rejectFetchedPage(rendered.title, rendered.text);
    if (reason) return { kind: "rejected", reason, title: rendered.title };
    page = rendered;
    viaFallback = true;
  }
  const { title, text } = page;
  const sha256 = await sha256Hex(text);

  // Dedup by content hash — the same article surfacing for two different
  // subjects is banked once. The hash lives in sources.metadata now that a
  // fetched page has no piece to carry it.
  const existing = await one<{ id: string; title: string }>(
    env.DB,
    `SELECT id, title FROM sources
      WHERE user_id = ?
        AND json_extract(metadata, '$.content_sha256') = ?
      LIMIT 1`,
    [userId, sha256],
  );
  if (existing) {
    return {
      kind: "banked",
      sourceId: existing.id,
      title: existing.title,
      chars: text.length,
      duplicate: true,
    };
  }

  const finalTitle = (title || fallbackTitle || `web-${new URL(url).hostname}`).slice(0, 280);
  const sourceId = await insertOne(env.DB, "sources", {
    user_id: userId,
    source_type: "news",
    ingestion_state: "approved",
    title: finalTitle,
    url,
    authors: JSON.stringify([]),
    content_text: text,
    ingested_via: "record-expand",
    metadata: JSON.stringify({
      ingested_from: "record-expand",
      source_url: url,
      content_sha256: sha256,
      extracted_chars: text.length,
      fetched_at: new Date().toISOString(),
      via: viaFallback ? "fallback_chain" : "plain_fetch",
    }),
  });
  return { kind: "banked", sourceId, title: finalTitle, chars: text.length, duplicate: false };
}

/** Strip HTML to plain text. Pulls the title out of <title> or the first
 *  <h1>; removes scripts/styles/nav/header/footer; collapses remaining tags;
 *  decodes common entities; normalises whitespace. Good enough for most
 *  article pages. */
export function stripHtmlToText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = decodeEntities((titleMatch?.[1] ?? "").replace(/\s+/g, " ").trim()).slice(0, 280);

  // Drop noise blocks entirely.
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ");

  // Convert block-level tags to newlines so we keep paragraph boundaries.
  const lined = cleaned
    .replace(/<\/(p|div|section|article|h[1-6]|li|tr|br)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");

  // Strip remaining tags, decode entities, collapse whitespace.
  const text = decodeEntities(lined.replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { title, text };
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
  "&rsquo;": "'",
  "&lsquo;": "'",
  "&rdquo;": '"',
  "&ldquo;": '"',
};
function decodeEntities(s: string): string {
  let out = s;
  for (const [ent, ch] of Object.entries(ENTITIES)) {
    out = out.split(ent).join(ch);
  }
  // Numeric entities &#123; and &#xA0;
  out = out.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  out = out.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(Number.parseInt(h, 16)));
  return out;
}

async function sha256Hex(s: string): Promise<string> {
  const bytes = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function emit(
  env: Env,
  userId: string,
  event_type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await insertOne(env.DB, "orchestrator_events", {
    user_id: userId,
    event_type,
    subject_kind: "record",
    subject_id: null,
    payload,
  }).catch(() => {});
}

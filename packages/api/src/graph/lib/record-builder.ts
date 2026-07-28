// Record-building on click (spec v2.6 Part 26).
//
// When the logged-in operator clicks a thin Record, the click IS the build
// signal. The system immediately:
//   1. Returns the page rendered from whatever exists (the renderer does this
//      independently — even a name + one citation lands).
//   2. Searches the web for the subject name via Brave Search.
//   3. Fetches each found page.
//   4. Banks the fetched content as a source document (with content-hash
//      dedup) and enqueues a digest job — the same typed-extraction
//      pipeline used on uploaded research reports.
//   5. Queues the digest job for the same every-minute cron drain that
//      already processes uploads — NOT run inline. Chaining a full
//      typed-extraction pass (real LLM calls) onto the search+fetch+bank
//      loop for up to 6 sources, all in one execution context, silently
//      exceeded the platform's execution ceiling in practice (confirmed
//      live: digest_jobs rows stuck 'running' with no heartbeat, no
//      completion). getExpandStatus() below polls the drain's real
//      progress instead of assuming it happened synchronously.
//
// The architecture is jurisdiction-aware but global. Not Canada-hardcoded.
//
// State is observable via the orchestrator_events table so the public
// Record's expanding banner can surface progress.
//
// Modes:
//   - Live: BRAVE_SEARCH_API_KEY set → real searches, real fetches, real
//     extraction.
//   - Stub: key absent → emits an event saying the key isn't configured and
//     no-ops. The affordance is visible; the action is wired; the secret
//     is the missing piece.

import { approvePaidOperation } from "../../cost/approve";
import type { Env } from "../../env";
import { all, insertOne, one, run } from "../../lib/d1";
import { TIMEOUTS, fetchWithTimeout } from "../../lib/timeout";
import { BROWSER_RENDERING_PER_PAGE_CENTS, callBrowserRendering } from "../tools/web_research";
import { enqueueDigest } from "./digest-jobs";

const BRAVE_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const MAX_SOURCES_PER_EXPAND = 6;
const SEARCH_POOL_SIZE = 15; // requested from Brave, before the low-yield filter below
const MIN_TEXT_CHARS = 400; // skip pages that didn't yield real article text

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

export interface ExpandReport {
  subject: string;
  configured: boolean;
  sources_found: number;
  sources_fetched: number;
  sources_banked: number;
  sources_duplicate: number;
  errors: string[];
  banked_piece_ids: string[];
}

/** The single entry point. Called from the /op/records/:slug/expand handler
 *  via c.executionCtx.waitUntil so the page render returns instantly and the
 *  expansion completes in the background.
 *
 *  Search + fetch + bank ONLY — deliberately does NOT run extraction inline
 *  anymore. It used to call runDigestJob() directly for each banked source,
 *  chaining up to 6 sources' full typed-extraction (real LLM calls, chunked)
 *  into the same execution context as the fetches. That's the exact class of
 *  bug already found and fixed this session in entity-resolution.ts,
 *  surfacing.ts, and draft-reading.ts: real work that silently never gets a
 *  chance to finish. Confirmed live here too — digest_jobs rows stuck at
 *  status='running' with no heartbeat progress and no completion event.
 *  Extraction now goes through the SAME queued path uploads already use
 *  (enqueueDigest → the every-minute cron drain, 4 jobs/tick, stale-heartbeat
 *  retry) — a mechanism already proven reliable by every "completed" row in
 *  digest_jobs. getExpandStatus() below reports on it live. */
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
    errors: [],
    banked_piece_ids: [],
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
      const banked = await fetchAndBank(env, userId, r.url, r.title || subjectLabel);
      if (!banked) {
        return { url: r.url, kind: "empty" as const };
      }
      if (banked.duplicate) {
        await emit(env, userId, "record.expand.source_duplicate", {
          subject: subjectLabel,
          url: r.url,
        });
        return { url: r.url, kind: "duplicate" as const };
      }
      await emit(env, userId, "record.expand.source_banked", {
        subject: subjectLabel,
        url: r.url,
        title: banked.title,
        chars: banked.chars,
      });
      // Enqueue only — same idempotent-on-retry job the drain cron already
      // processes for uploads. Same firewall + verbatim checks apply either
      // way; only WHEN it runs changed.
      await enqueueDigest(env, {
        userId,
        pieceId: banked.pieceId,
        slug: banked.slug,
        title: banked.title,
        sourceId: banked.sourceId,
      });
      return { url: r.url, kind: "banked" as const, pieceId: banked.pieceId };
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
    if (kind === "empty") {
      report.errors.push(`empty or too short: ${url}`);
      continue;
    }
    report.sources_fetched++;
    if (kind === "banked") {
      report.sources_banked++;
      report.banked_piece_ids.push(outcome.value.pieceId);
    } else if (kind === "duplicate") {
      report.sources_duplicate++;
    }
  }

  // "completed" here means the search+fetch+bank phase is done — extraction
  // is queued, not finished. banked_piece_ids is what getExpandStatus below
  // polls against to know when the REAL work (facts landing) is done.
  await emit(env, userId, "record.expand.completed", {
    subject: subjectLabel,
    found: report.sources_found,
    fetched: report.sources_fetched,
    banked: report.sources_banked,
    banked_piece_ids: report.banked_piece_ids,
  });
  return report;
}

export interface ExpandStatus {
  /** True once nothing more will happen automatically — safe to stop polling. */
  terminal: boolean;
  /** True if the overall run ended cleanly (no per-source or extraction failures). */
  warn: boolean;
  /** Plain-text narration — the caller escapes/wraps as HTML. */
  line: string;
  /** Real fact count added, computed from the banked pieces once extraction
   *  has actually run — 0 while still pending. */
  factsAdded: number;
}

interface ExpandEventRow {
  event_type: string;
  payload: string;
  created_at: string;
}

/** The single source of truth for "how is this record-expand run going,
 *  right now" — used by the public search page (to know when to stop
 *  polling), the per-subject banner, and the bulk-expand result page. Reads
 *  orchestrator_events for the search/fetch/bank phase, then — once that
 *  phase's "completed" event names banked_piece_ids — cross-checks
 *  digest_jobs for those exact pieces, because "record.expand.completed"
 *  no longer means extraction is done (see expandRecord's comment above). */
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

  if (!completed) {
    const stage = latest.event_type.replace("record.expand.", "");
    let line = "Working…";
    if (stage === "started") line = `Starting expansion for ${subjectLabel}…`;
    else if (stage === "search_done") line = "Search done — fetching sources…";
    else if (stage === "source_fetching") {
      line = `Fetching source ${sourceSeen} — ${field(latest.payload, "title") ?? ""}`;
    } else if (stage === "source_banked") {
      line = `Banked ${sourceBanked} source${sourceBanked === 1 ? "" : "s"} · queuing for extraction…`;
    } else if (stage === "source_duplicate") line = "Already had that source · moving on…";
    return { terminal: false, warn: false, line, factsAdded: 0 };
  }

  // Search+fetch+bank phase is done. Check what actually banked.
  // NOTE: banked_piece_ids is an array — field() below stringifies every
  // value via String(), which turns an array into a comma-joined string
  // ("a,b", not '["a","b"]') that JSON.parse then throws on. Read it
  // directly off the parsed payload instead of through field().
  const pieceIds = fieldArray(completed.payload, "banked_piece_ids");
  if (pieceIds.length === 0) {
    return {
      terminal: true,
      warn: false,
      line: "Searched and fetched, but nothing new to add — every source found was already on record or too thin to use.",
      factsAdded: 0,
    };
  }

  const extraction = await checkExtraction(env, userId, pieceIds);
  if (extraction.pending > 0) {
    // A source can be genuinely large (a full Wikipedia article, chunked
    // 20-30+ ways) — each chunk is its own LLM call + D1 write, and this
    // account's shared D1 CPU budget means a chunk sometimes has to retry
    // (checkpointed, no lost progress, just slower). Without surfacing
    // WHICH chunk it's on, real incremental progress on a big source looks
    // identical to being stuck — confirmed live: an operator watching
    // "extracting (0/2 done)" sit still for several minutes had no way to
    // tell a 32-chunk article was actively resuming from chunk 12 after
    // each reset from one that's actually dead.
    const detail = extraction.pendingDetail ? ` · ${extraction.pendingDetail}` : "";
    return {
      terminal: false,
      warn: false,
      line: `Banked ${sourceBanked} source${sourceBanked === 1 ? "" : "s"} · extracting (${extraction.done + extraction.failed}/${pieceIds.length} done)${detail}…`,
      factsAdded: 0,
    };
  }

  if (extraction.failed > 0) {
    const reasons = extraction.failedReasons.slice(0, 3).join("; ");
    return {
      terminal: true,
      warn: true,
      line: `Banked ${sourceBanked} source${sourceBanked === 1 ? "" : "s"} but extraction failed for ${extraction.failed}: ${reasons}`,
      factsAdded: extraction.factsAdded,
    };
  }

  return {
    terminal: true,
    warn: false,
    line: `Record expanded — ${extraction.factsAdded} fact${extraction.factsAdded === 1 ? "" : "s"} added from ${extraction.done} source${extraction.done === 1 ? "" : "s"}.`,
    factsAdded: extraction.factsAdded,
  };
}

interface ExtractionCheck {
  done: number;
  failed: number;
  pending: number;
  factsAdded: number;
  failedReasons: string[];
  /** The chunk-level step of whichever pending job is furthest along (e.g.
   *  "chunk 12/32") — lets the caller show real, moving progress on a
   *  large source instead of a static "0/N done" that looks frozen. */
  pendingDetail: string | null;
}

async function checkExtraction(
  env: { DB: D1Database },
  userId: string,
  pieceIds: string[],
): Promise<ExtractionCheck> {
  const placeholders = pieceIds.map(() => "?").join(",");
  const jobs = await all<{
    piece_id: string;
    status: string;
    step: string | null;
    last_error: string | null;
  }>(
    env.DB,
    `SELECT piece_id, status, step, last_error FROM digest_jobs
      WHERE user_id = ? AND piece_id IN (${placeholders})
      ORDER BY created_at DESC`,
    [userId, ...pieceIds],
  ).catch(() => []);
  // Keep only the latest job per piece (there should be exactly one for a
  // record-expand-banked piece, but be defensive).
  const latestByPiece = new Map<
    string,
    { status: string; step: string | null; last_error: string | null }
  >();
  for (const j of jobs) {
    if (!latestByPiece.has(j.piece_id)) latestByPiece.set(j.piece_id, j);
  }

  let done = 0;
  let failed = 0;
  const failedReasons: string[] = [];
  const donePieceIds: string[] = [];
  let pendingDetail: string | null = null;
  for (const pieceId of pieceIds) {
    const job = latestByPiece.get(pieceId);
    if (!job || job.status === "queued" || job.status === "running") {
      if (job?.step?.startsWith("chunk ")) pendingDetail = job.step;
      continue;
    }
    if (job.status === "completed") {
      done++;
      donePieceIds.push(pieceId);
    } else if (job.status === "failed") {
      failed++;
      failedReasons.push(job.last_error ?? "unknown error");
    }
  }
  const pending = pieceIds.length - done - failed;

  let factsAdded = 0;
  if (donePieceIds.length > 0) {
    const factPlaceholders = donePieceIds.map(() => "?").join(",");
    const row = await one<{ n: number }>(
      env.DB,
      `SELECT COUNT(*) AS n FROM nodes
        WHERE user_id = ? AND piece_id IN (${factPlaceholders})
          AND kind IN ('neutral_fact','event','assertion')`,
      [userId, ...donePieceIds],
    ).catch(() => null);
    factsAdded = row?.n ?? 0;
  }

  return { done, failed, pending, factsAdded, failedReasons, pendingDetail };
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

function fieldArray(payload: string, key: string): string[] {
  try {
    const obj = JSON.parse(payload) as Record<string, unknown>;
    const v = obj[key];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
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

interface BankResult {
  pieceId: string;
  slug: string;
  title: string;
  sourceId: string;
  chars: number;
  duplicate: boolean;
}

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

/** Fetch a URL, strip the HTML to plain text, bank it as a source document
 *  + piece. Mirrors createAndExtract in operator/routes.ts but tuned for
 *  web-fetched content (no PDF extraction, no R2 byte store — the text
 *  itself is the artefact). Returns null when the page yielded too little
 *  text to be useful. */
async function fetchAndBank(
  env: Env,
  userId: string,
  url: string,
  fallbackTitle: string,
): Promise<BankResult | null> {
  let title: string;
  let text: string;
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
    const html = await res.text();
    const stripped = stripHtmlToText(html);
    if (stripped.text.length < MIN_TEXT_CHARS) {
      const rendered = await fetchViaFallbacks(env, userId, url);
      if (!rendered) return null;
      title = rendered.title;
      text = rendered.text;
      viaFallback = true;
    } else {
      title = stripped.title;
      text = stripped.text;
    }
  } catch (err) {
    const rendered = await fetchViaFallbacks(env, userId, url);
    if (!rendered) throw err;
    title = rendered.title;
    text = rendered.text;
    viaFallback = true;
  }
  const sha256 = await sha256Hex(text);

  // Dedup by content hash — if we've banked the same fetched text before
  // (the same article surfaced for two different subjects, say) return the
  // existing piece instead of re-storing.
  const existing = await one<{
    piece_id: string;
    piece_slug: string;
    piece_title: string;
    source_id: string;
  }>(
    env.DB,
    `SELECT p.id AS piece_id, p.slug AS piece_slug, p.title AS piece_title,
            json_extract(p.metadata, '$.source_id') AS source_id
       FROM pieces p
      WHERE p.user_id = ?
        AND json_extract(p.metadata, '$.content_sha256') = ?
      LIMIT 1`,
    [userId, sha256],
  );
  if (existing) {
    return {
      pieceId: existing.piece_id,
      slug: existing.piece_slug,
      title: existing.piece_title,
      sourceId: existing.source_id,
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
  });
  const slug = await ensureUniqueSlug(env.DB, userId, slugify(finalTitle));
  const pieceId = await insertOne(env.DB, "pieces", {
    user_id: userId,
    slug,
    title: finalTitle,
    kind: "research-report",
    publication_status: "working-material",
    body_md: text,
    byline: new URL(url).hostname,
    tags: JSON.stringify(["web-fetched"]),
    metadata: JSON.stringify({
      ingested_from: "record-expand",
      source_id: sourceId,
      source_url: url,
      content_sha256: sha256,
      fetched_at: new Date().toISOString(),
      via: viaFallback ? "browser_rendering" : "plain_fetch",
    }),
  });
  return { pieceId, slug, title: finalTitle, sourceId, chars: text.length, duplicate: false };
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

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

// Exact-match probing instead of a LIKE prefix scan — D1 threw
// "LIKE or GLOB pattern too complex" live on some fetched page titles even
// though the pattern was just `${slug}%` (slugify() only ever emits
// [a-z0-9-], so it isn't a malformed-pattern issue on our end; whatever the
// exact cause, exact-match sidesteps it entirely and is simpler besides).
async function ensureUniqueSlug(db: D1Database, userId: string, base: string): Promise<string> {
  const slug = base || `web-${Date.now()}`;
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? slug : `${slug}-${n + 1}`;
    const existing = await one<{ id: string }>(
      db,
      "SELECT id FROM pieces WHERE user_id = ? AND slug = ? LIMIT 1",
      [userId, candidate],
    );
    if (!existing) return candidate;
  }
  return `${slug}-${Date.now()}`;
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

// `run` re-exported to silence unused-import in case the helper becomes
// useful here later. (Currently we use insertOne + one only.)
export { run };

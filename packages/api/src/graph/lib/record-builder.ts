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
//   5. Runs the digest jobs inline (waitUntil) so facts land in the graph
//      against the same firewall and verbatim-verification rules.
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

import type { Env } from "../../env";
import { insertOne, one, run } from "../../lib/d1";
import { TIMEOUTS, fetchWithTimeout } from "../../lib/timeout";
import { enqueueDigest, runDigestJob } from "./digest-jobs";

const BRAVE_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const MAX_SOURCES_PER_EXPAND = 6;
const MIN_TEXT_CHARS = 400; // skip pages that didn't yield real article text

export interface ExpandReport {
  subject: string;
  configured: boolean;
  sources_found: number;
  sources_fetched: number;
  sources_banked: number;
  sources_extracted: number;
  facts_added: number;
  errors: string[];
}

/** The single entry point. Called from the /op/records/:slug/expand handler
 *  via c.executionCtx.waitUntil so the page render returns instantly and the
 *  expansion completes in the background. */
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
    sources_extracted: 0,
    facts_added: 0,
    errors: [],
  };

  await emit(env, userId, "record.expand.started", { subject: subjectLabel });

  if (!env.BRAVE_SEARCH_API_KEY) {
    await emit(env, userId, "record.expand.skipped", {
      subject: subjectLabel,
      reason: "BRAVE_SEARCH_API_KEY not configured",
    });
    return report;
  }

  let results: BraveResult[];
  try {
    results = await braveSearch(env.BRAVE_SEARCH_API_KEY, subjectLabel, MAX_SOURCES_PER_EXPAND);
  } catch (err) {
    report.errors.push(`search failed: ${(err as Error).message}`);
    await emit(env, userId, "record.expand.failed", {
      subject: subjectLabel,
      stage: "search",
      error: report.errors.at(-1),
    });
    return report;
  }
  report.sources_found = results.length;
  await emit(env, userId, "record.expand.search_done", {
    subject: subjectLabel,
    found: results.length,
  });

  // Count facts before the expansion so we can report the delta.
  const factsBefore = await countSubjectFacts(env, userId, subjectLabel);

  // Process sources sequentially (a few seconds each; total ~30-60s fits
  // comfortably in waitUntil). Per-source progress emits so the live banner
  // can narrate. Errors are per-source — one bad fetch doesn't sink the rest.
  for (const r of results) {
    await emit(env, userId, "record.expand.source_fetching", {
      subject: subjectLabel,
      title: r.title,
      url: r.url,
    });
    try {
      const banked = await fetchAndBank(env, userId, r.url, r.title || subjectLabel);
      if (!banked) {
        report.errors.push(`empty or too short: ${r.url}`);
        continue;
      }
      report.sources_fetched++;
      if (banked.duplicate) {
        await emit(env, userId, "record.expand.source_duplicate", {
          subject: subjectLabel,
          url: r.url,
        });
        continue;
      }
      report.sources_banked++;
      await emit(env, userId, "record.expand.source_banked", {
        subject: subjectLabel,
        url: r.url,
        title: banked.title,
        chars: banked.chars,
      });

      // Enqueue + run the digest job inline. The job is idempotent on retry
      // and reads from R2 / pieces. Runs the same typed-extraction pipeline
      // as an uploaded research report — so the same firewall + verbatim
      // checks apply.
      const jobId = await enqueueDigest(env, {
        userId,
        pieceId: banked.pieceId,
        slug: banked.slug,
        title: banked.title,
        sourceId: banked.sourceId,
      });
      try {
        await runDigestJob(env, jobId);
        report.sources_extracted++;
        await emit(env, userId, "record.expand.source_extracted", {
          subject: subjectLabel,
          url: r.url,
        });
      } catch (jobErr) {
        report.errors.push(`extract ${r.url}: ${(jobErr as Error).message}`);
      }
    } catch (err) {
      report.errors.push(`fetch ${r.url}: ${(err as Error).message}`);
      await emit(env, userId, "record.expand.source_failed", {
        subject: subjectLabel,
        url: r.url,
        error: (err as Error).message,
      });
    }
  }

  const factsAfter = await countSubjectFacts(env, userId, subjectLabel);
  report.facts_added = Math.max(0, factsAfter - factsBefore);

  await emit(env, userId, "record.expand.completed", {
    subject: subjectLabel,
    found: report.sources_found,
    fetched: report.sources_fetched,
    banked: report.sources_banked,
    extracted: report.sources_extracted,
    facts_added: report.facts_added,
  });
  return report;
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
  const { title, text } = stripHtmlToText(html);
  if (text.length < MIN_TEXT_CHARS) return null;
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

async function ensureUniqueSlug(db: D1Database, userId: string, base: string): Promise<string> {
  const slug = base || `web-${Date.now()}`;
  const existing = await one<{ slug: string }>(
    db,
    "SELECT slug FROM pieces WHERE user_id = ? AND slug LIKE ? ORDER BY slug DESC LIMIT 1",
    [userId, `${slug}%`],
  );
  if (!existing) return slug;
  const m = existing.slug.match(
    new RegExp(`^${slug.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}(?:-(\\d+))?$`),
  );
  const next = m?.[1] ? Number(m[1]) + 1 : 2;
  return `${slug}-${next}`;
}

async function countSubjectFacts(env: Env, userId: string, subjectLabel: string): Promise<number> {
  const row = await one<{ n: number }>(
    env.DB,
    `SELECT COUNT(*) AS n FROM nodes
      WHERE user_id = ? AND kind IN ('neutral_fact','event','assertion')
        AND EXISTS (SELECT 1 FROM nodes subj
                     WHERE subj.user_id = ? AND lower(subj.label) = lower(?)
                       AND EXISTS (
                         SELECT 1 FROM edges e
                          WHERE e.user_id = ?
                            AND e.family = 'aboutness'
                            AND e.src_node_id = nodes.id
                            AND e.dst_node_id = subj.id))`,
    [userId, userId, subjectLabel, userId],
  ).catch(() => null);
  return row?.n ?? 0;
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

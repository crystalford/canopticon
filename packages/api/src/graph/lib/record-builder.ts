// Record-building on click (spec v2.5 Part 23).
//
// When the logged-in operator clicks a thin Record, the click IS the build
// signal. The system immediately:
//   1. Returns the page rendered from whatever exists (the renderer does this
//      independently — even a name + one citation lands).
//   2. Searches the web for the subject name via Brave Search.
//   3. Fetches each found page.
//   4. Runs the same typed-extraction pipeline used on uploaded research
//      reports, so facts/events/assertions land in the graph against the
//      same firewall and verbatim-verification rules.
//
// The architecture is jurisdiction-aware but global (handoff doc note): use
// language/country parameters where the operator's subject has clear locale;
// fall back to web-wide search otherwise. Not Canada-hardcoded.
//
// State is observable via the orchestrator_events table so the OUT stream
// and the public Record can surface progress (count of sources found,
// fetched, extracted, facts added).
//
// Modes:
//   - Live: BRAVE_SEARCH_API_KEY set → real searches, real fetches, real
//     extraction.
//   - Stub: key absent → emits an event saying the key isn't configured and
//     no-ops. The affordance is visible; the action is wired; the secret
//     is the missing piece.

import type { Env } from "../../env";
import { insertOne } from "../../lib/d1";
import { TIMEOUTS, fetchWithTimeout } from "../../lib/timeout";

const BRAVE_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

export interface ExpandReport {
  subject: string;
  configured: boolean;
  sources_found: number;
  sources_fetched: number;
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
    results = await braveSearch(env.BRAVE_SEARCH_API_KEY, subjectLabel, 8);
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

  // Fetch + extract: the heavy work is deferred to a single-doc ingest path,
  // which already knows how to bank a doc into the Vault and run the typed
  // extraction pipeline. PR 1 of Part 23 (the click + the search) is real;
  // PR 2 wires this into createAndExtract on the operator side. For now we
  // record the discovered sources as orchestrator_events so the operator
  // can see what would have been fetched and decide. (This stub mirrors how
  // the proposer works pre-LLM-upgrade.)
  for (const r of results.slice(0, 8)) {
    await emit(env, userId, "record.expand.source_seen", {
      subject: subjectLabel,
      title: r.title,
      url: r.url,
    });
  }

  await emit(env, userId, "record.expand.completed", {
    subject: subjectLabel,
    found: report.sources_found,
    fetched: report.sources_fetched,
    facts_added: report.facts_added,
  });
  return report;
}

interface BraveResult {
  title: string;
  url: string;
  description: string;
}

// Hit the Brave Search REST API. Country/language unspecified by default so
// it's global; callers can pass an explicit locale once the renderer knows
// the subject's jurisdiction.
async function braveSearch(apiKey: string, query: string, count = 8): Promise<BraveResult[]> {
  const url = `${BRAVE_SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&count=${count}`;
  const res = await fetchWithTimeout(
    url,
    {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    },
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

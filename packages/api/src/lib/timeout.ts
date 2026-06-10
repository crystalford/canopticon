// Single bounded-call contract for every external boundary.
//
// Every fetch / env.AI.run / env.EMBEDDINGS.* / R2 call should go through
// withTimeout. The reason: a Cloudflare Worker has a wall-clock budget under
// waitUntil (~30s of CPU). An unbounded await that hangs blows past it, the
// Worker is killed, in-flight D1 writes can roll back, and the only signal
// to the caller is "D1_ERROR: object reset". The fix is mechanical — every
// await against an outside service must throw if it exceeds a known ceiling
// SHORTER than the platform wall-clock, so our error path runs, the failure
// breadcrumb writes, and the cron drain doesn't retry the same wedge.
//
// Defaults are conservative:
//   - LLM single-call:        25s  (must be < Worker wall-clock ~30s)
//   - Embedding round-trip:   10s
//   - Vectorize upsert/query: 10s
//   - External web fetch:     15s  (URL ingestion, brief source retrieval)
//
// Callers pass `label` so the thrown error names the exceeded boundary.

export const TIMEOUTS = {
  LLM_CALL_MS: 25_000,
  EMBED_MS: 10_000,
  VECTORIZE_MS: 10_000,
  WEB_FETCH_MS: 15_000,
} as const;

export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/** Convenience: fetch() with a hard ceiling. Uses AbortController so the
 *  underlying connection is actually torn down, not just the awaited promise. */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  ms: number = TIMEOUTS.WEB_FETCH_MS,
  label = "fetch",
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(`${label} exceeded ${ms}ms`), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// IndexNow — one POST per publish, telling Bing, DuckDuckGo, Yandex (and
// whoever else honours the protocol) that a URL changed. Google does not
// take it; the sitemap covers Google.
//
// Inert by design when `INDEXNOW_KEY` is unset: the call returns a stated
// reason and sends nothing, so an unconfigured deploy is quiet rather than
// half-working. The key is proved by serving it at `/<key>.txt` — see
// public/routes.ts — which is why `keyLocation` points there.

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_HOST = "canopticon.com";

export interface IndexNowEnv {
  INDEXNOW_KEY?: string;
}

export interface IndexNowBody {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

export type IndexNowResult =
  | { sent: true; status: number; urls: string[] }
  | { sent: false; reason: string };

/** The key, or null when the deploy has none configured. */
export function indexNowKey(env: unknown): string | null {
  const key = (env as IndexNowEnv | null | undefined)?.INDEXNOW_KEY?.trim();
  // IndexNow keys are 8–128 hex/alnum characters; a malformed value would be
  // served at /<key>.txt and rejected upstream, so treat it as unset.
  return key && /^[A-Za-z0-9-]{8,128}$/.test(key) ? key : null;
}

export function indexNowKeyLocation(key: string): string {
  return `https://${INDEXNOW_HOST}/${key}.txt`;
}

/** The request body, absolute URLs only. Exported so a test can check it
 *  without sending anything. */
export function indexNowBody(key: string, urls: string[]): IndexNowBody {
  const urlList = [...new Set(urls)]
    .map((u) =>
      u.startsWith("http") ? u : `https://${INDEXNOW_HOST}${u.startsWith("/") ? "" : "/"}${u}`,
    )
    .filter((u) => u.startsWith(`https://${INDEXNOW_HOST}/`));
  return { host: INDEXNOW_HOST, key, keyLocation: indexNowKeyLocation(key), urlList };
}

/**
 * Ping IndexNow with the given URLs. Never throws: a failed ping is a lost
 * hint to a search engine, not a failed publish.
 */
export async function pingIndexNow(
  env: unknown,
  urls: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<IndexNowResult> {
  const key = indexNowKey(env);
  if (!key) {
    console.log("indexnow: INDEXNOW_KEY not set; nothing sent");
    return { sent: false, reason: "INDEXNOW_KEY not set" };
  }
  const body = indexNowBody(key, urls);
  if (!body.urlList.length) return { sent: false, reason: "no urls" };
  try {
    const res = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    if (res.status >= 400) console.log(`indexnow: ${res.status} for ${body.urlList.join(", ")}`);
    return { sent: true, status: res.status, urls: body.urlList };
  } catch (err) {
    console.log(`indexnow: ${(err as Error).message}`);
    return { sent: false, reason: (err as Error).message };
  }
}

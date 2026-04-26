// Public API helper — no auth, server-side fetch only.
//
// The public site renders is_public theses, articles, predictions, and
// contradictions. None of those endpoints require a JWT; the API
// service-client filters by is_public on our behalf. Calls run in
// server components so we can use Next.js's incremental cache.

interface Envelope<T> {
  data?: T;
  error?: { code: string; message: string };
}

export class PublicApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PublicApiError";
  }
}

function baseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");
  return url.replace(/\/$/, "");
}

export async function publicGet<T>(path: string, revalidate = 60): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    next: { revalidate },
    headers: { accept: "application/json" },
  });
  const json = (await res.json()) as Envelope<T>;
  if (!res.ok || json.error) {
    const code = json.error?.code ?? "unknown";
    const msg = json.error?.message ?? `Request failed: ${res.status}`;
    throw new PublicApiError(res.status, code, msg);
  }
  if (json.data === undefined) {
    throw new PublicApiError(res.status, "no_data", "Response envelope missing data");
  }
  return json.data;
}

// Typed API client for the operator-app Worker (Hono router).
//
// Auth is handled by Cloudflare Access. The browser carries an Access
// session cookie; the Access edge injects the email/JWT headers when the
// request hits the Worker. We don't need to manage tokens in JS.
//
// Requests are made with `credentials: "include"` so the Access cookie
// is forwarded cross-origin to the API domain.

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function apiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");
  return url.replace(/\/$/, "");
}

interface ErrorBody {
  error?: { code: string; message: string; details?: unknown };
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    credentials: "include",
  });
  return unwrap<T>(res);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const init: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(`${apiBaseUrl()}${path}`, init);
  return unwrap<T>(res);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  return unwrap<T>(res);
}

async function unwrap<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    if (!res.ok) {
      throw new ApiError(res.status, "non_json_response", `${res.status} ${res.statusText}`);
    }
    return undefined as T;
  }
  const json = (await res.json()) as ErrorBody & Record<string, unknown>;
  if (!res.ok || json.error) {
    const err = json.error ?? { code: "unknown_error", message: `${res.status}` };
    throw new ApiError(res.status, err.code, err.message, err.details);
  }
  return json as T;
}

// --- SSE -----------------------------------------------------------

export interface SseEvent {
  id?: string;
  event?: string;
  data?: unknown;
}

export interface OpenSseOptions {
  path: string;
  lastEventId?: string;
  signal?: AbortSignal;
  onEvent: (e: SseEvent) => void;
  onOpen?: () => void;
  onClose?: (reason: "stream_end" | "abort" | "error", err?: Error) => void;
}

export async function openSse(options: OpenSseOptions): Promise<void> {
  const headers: Record<string, string> = { accept: "text/event-stream" };
  if (options.lastEventId) headers["last-event-id"] = options.lastEventId;

  const url = new URL(`${apiBaseUrl()}${options.path}`);
  if (options.lastEventId) url.searchParams.set("since", options.lastEventId);

  const init: RequestInit = { headers, credentials: "include" };
  if (options.signal) init.signal = options.signal;

  let res: Response;
  try {
    res = await fetch(url.toString(), init);
  } catch (err) {
    options.onClose?.("error", err as Error);
    return;
  }
  if (!res.ok || !res.body) {
    options.onClose?.("error", new Error(`SSE connection failed: ${res.status} ${res.statusText}`));
    return;
  }
  options.onOpen?.();

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        options.onClose?.("stream_end");
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      let sepIndex = buffer.indexOf("\n\n");
      while (sepIndex >= 0) {
        const block = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        const event = parseSseBlock(block);
        if (event) options.onEvent(event);
        sepIndex = buffer.indexOf("\n\n");
      }
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") options.onClose?.("abort");
    else options.onClose?.("error", err as Error);
  }
}

function parseSseBlock(block: string): SseEvent | null {
  const lines = block.split("\n");
  const event: SseEvent = {};
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith(":")) continue;
    if (line.startsWith("id:")) event.id = line.slice(3).trim();
    else if (line.startsWith("event:")) event.event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0 && !event.id && !event.event) return null;
  if (dataLines.length > 0) {
    const raw = dataLines.join("\n");
    try {
      event.data = JSON.parse(raw);
    } catch {
      event.data = raw;
    }
  }
  return event;
}

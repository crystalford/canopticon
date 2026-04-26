// Typed API client for the operator-app Worker (Hono router).
//
// The client is auth-aware: every call auto-attaches the current Supabase
// JWT from the browser session. Request bodies are JSON; responses are
// envelope-wrapped per canopticon-api-v1.0.md (`{ data: ... }` on
// success; `{ error: { code, message, details? } }` on failure).
//
// Generic helpers (apiGet, apiPost) return `data` directly and throw
// ApiError on non-2xx. Streaming helpers (sseConnect) return an
// EventSource configured against the Worker base URL.

import { browserClient } from "./supabase";

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

async function authHeader(): Promise<Record<string, string>> {
  const supabase = browserClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

interface Envelope<T> {
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

export async function apiGet<T>(path: string): Promise<T> {
  const headers = await authHeader();
  const res = await fetch(`${apiBaseUrl()}${path}`, { headers });
  return unwrap<T>(res);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const headers = await authHeader();
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify(body),
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
  const json = (await res.json()) as Envelope<T>;
  if (!res.ok || json.error) {
    const err = json.error ?? { code: "unknown_error", message: `${res.status}` };
    throw new ApiError(res.status, err.code, err.message, err.details);
  }
  return json.data as T;
}

// --- SSE via fetch streaming -----------------------------------------------
//
// Browsers' native EventSource can't send custom headers, so we'd have to
// put the JWT in the query string — which leaks via referer headers and
// proxy logs. Instead we open the SSE endpoint with fetch + Authorization
// header and parse the SSE wire format off the response body's
// ReadableStream. Same pattern as @microsoft/fetch-event-source; no
// dependency on a third-party lib because we're not using request
// retries (the SSE endpoint already exposes Last-Event-ID resume).

export interface SseEvent {
  /** The `id:` field — used to resume after reconnect. */
  id?: string;
  /** The `event:` field — discriminator (e.g. 'research.iteration_completed'). */
  event?: string;
  /** The `data:` field, JSON-decoded. May be undefined for keep-alive comments. */
  data?: unknown;
}

export interface OpenSseOptions {
  /** Path relative to the API base, e.g. '/v1/orchestrator/events'. */
  path: string;
  /** Last event id for resume — sent as Last-Event-ID header AND `since` query param. */
  lastEventId?: string;
  /** AbortSignal to terminate the connection. */
  signal?: AbortSignal;
  /** Called for every parsed event. */
  onEvent: (e: SseEvent) => void;
  /** Called once on connection open. */
  onOpen?: () => void;
  /** Called when the connection closes (cleanly or with error). */
  onClose?: (reason: "stream_end" | "abort" | "error", err?: Error) => void;
}

export async function openSse(options: OpenSseOptions): Promise<void> {
  const headers: Record<string, string> = {
    accept: "text/event-stream",
    ...(await authHeader()),
  };
  if (options.lastEventId) headers["last-event-id"] = options.lastEventId;

  const url = new URL(`${apiBaseUrl()}${options.path}`);
  if (options.lastEventId) url.searchParams.set("since", options.lastEventId);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers,
      signal: options.signal ?? null,
    });
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

      // Events are separated by a blank line ("\n\n"). Process every
      // complete event in the buffer; keep the trailing partial block.
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
    if ((err as Error).name === "AbortError") {
      options.onClose?.("abort");
    } else {
      options.onClose?.("error", err as Error);
    }
  }
}

function parseSseBlock(block: string): SseEvent | null {
  const lines = block.split("\n");
  const event: SseEvent = {};
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith(":")) continue; // comment (keep-alive)
    if (line.startsWith("id:")) {
      event.id = line.slice(3).trim();
    } else if (line.startsWith("event:")) {
      event.event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
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

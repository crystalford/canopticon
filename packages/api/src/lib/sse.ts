// Helpers for emitting Server-Sent Events from a Worker.
//
// The SSE endpoint at GET /v1/orchestrator/events tails the
// orchestrator_events table and writes each row to the client as a
// `data:` event. We poll instead of subscribing to Supabase Realtime
// because Realtime adds a separate WebSocket connection and a per-table
// channel-config dance; polling against an indexed cursor is fine at the
// volumes we're seeing (events per cascade run < 200).
//
// Format an event as the SSE wire format:
//
//   id: <event_id>\n
//   event: <event_type>\n
//   data: <json payload>\n
//   \n
//
// The `id:` line lets clients reconnect with `Last-Event-ID` to resume
// from where they were.

export interface SseEventInput {
  /** Unique id for the event — used in the `id:` line for reconnect resume. */
  id: string;
  /** Event type — used in the `event:` line. Clients can dispatch by type. */
  event: string;
  /** Payload — JSON-encoded into the `data:` line. */
  data: unknown;
}

export function formatSseEvent(input: SseEventInput): string {
  return `id: ${input.id}\nevent: ${input.event}\ndata: ${JSON.stringify(input.data)}\n\n`;
}

export function formatSseComment(comment: string): string {
  // Comments are useful as a keep-alive ping every N seconds.
  return `: ${comment}\n\n`;
}

export const SSE_HEADERS: HeadersInit = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
  "x-accel-buffering": "no",
};

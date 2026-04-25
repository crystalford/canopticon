// Orchestrator routes — see canopticon-api-v1.0.md §11.
//
//   GET  /v1/orchestrator/events           SSE stream of orchestrator_events
//                                          for the authenticated user
//   POST /v1/orchestrator/approve-cost     Operator's response to a cost-gate
//                                          pause (lands when the modal flow
//                                          is wired)
//
// The SSE handler streams every row in `orchestrator_events` for the
// authenticated user, tail-style. It accepts a `Last-Event-ID` header (or
// `?since=<event_id>` query param) to resume from a known cursor — clients
// reconnect with the last id they saw and don't miss events.
//
// Each connection runs for at most STREAM_DURATION_MS, after which the
// client is expected to reconnect. Workers can run beyond their
// request-CPU budget with `ctx.waitUntil`, but we cap the stream length
// to keep memory usage bounded and to play nicely with Cloudflare's
// per-request limits.

import { Hono } from "hono";
import type { AuthContext } from "../auth/middleware.ts";
import { requireAuth } from "../auth/middleware.ts";
import { SSE_HEADERS, formatSseComment, formatSseEvent } from "../lib/sse.ts";
import { userClient } from "../lib/supabase.ts";

const orchestrator = new Hono<AuthContext>();
orchestrator.use("*", requireAuth());

const STREAM_DURATION_MS = 50_000; // 50s per connection; client reconnects.
const POLL_INTERVAL_MS = 750;
const KEEPALIVE_MS = 15_000;
const PAGE_SIZE = 100;

orchestrator.get("/events", (c) => {
  const lastEventId = c.req.header("last-event-id") ?? c.req.query("since") ?? null;
  const userId = c.get("user_id");
  const jwt = c.get("jwt");
  const env = c.env;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const client = userClient(env, jwt);
      const startedAt = Date.now();
      let cursor: { id: string; created_at: string } | null = null;

      // If the client supplied a Last-Event-ID, resolve its created_at
      // timestamp once so the polling query can use a stable cursor.
      if (lastEventId) {
        const { data } = await client
          .from("orchestrator_events")
          .select("id, created_at")
          .eq("id", lastEventId)
          .maybeSingle();
        if (data) cursor = { id: data.id as string, created_at: data.created_at as string };
      }

      let lastKeepalive = Date.now();

      try {
        while (Date.now() - startedAt < STREAM_DURATION_MS) {
          let q = client
            .from("orchestrator_events")
            .select("id, event_type, entity_id, entity_type_str, payload, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .limit(PAGE_SIZE);
          if (cursor) {
            // (created_at, id) tuple cursor — protects against ties on
            // created_at when many events arrive in the same millisecond.
            q = q.gt("created_at", cursor.created_at);
          }

          const { data, error } = await q;
          if (error) {
            controller.enqueue(
              encoder.encode(
                formatSseEvent({
                  id: "error",
                  event: "stream.error",
                  data: { message: error.message },
                }),
              ),
            );
            break;
          }

          if (data && data.length > 0) {
            for (const row of data) {
              const event = formatSseEvent({
                id: row.id as string,
                event: row.event_type as string,
                data: {
                  id: row.id,
                  event_type: row.event_type,
                  entity_id: row.entity_id,
                  entity_type: row.entity_type_str,
                  payload: row.payload,
                  created_at: row.created_at,
                },
              });
              controller.enqueue(encoder.encode(event));
              cursor = { id: row.id as string, created_at: row.created_at as string };
            }
            lastKeepalive = Date.now();
          } else if (Date.now() - lastKeepalive > KEEPALIVE_MS) {
            // No new events for a while — emit a comment to keep the
            // connection warm against intermediate proxies.
            controller.enqueue(encoder.encode(formatSseComment("keepalive")));
            lastKeepalive = Date.now();
          }

          await sleep(POLL_INTERVAL_MS);
        }

        // Polite end-of-stream marker so the client knows to reconnect.
        controller.enqueue(
          encoder.encode(
            formatSseEvent({
              id: cursor?.id ?? "end",
              event: "stream.end",
              data: {
                reason: "duration_elapsed",
                reconnect_with_last_event_id: cursor?.id ?? null,
              },
            }),
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { status: 200, headers: SSE_HEADERS });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default orchestrator;

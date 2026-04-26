// Orchestrator events: SSE stream for the operator UI.
// Polls orchestrator_events table; emits each new row as an SSE frame.

import { Hono } from "hono";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { SSE_HEADERS, formatSseComment, formatSseEvent } from "../lib/sse.ts";
import { userClient } from "../lib/supabase.ts";
import { getPublicUserId } from "../lib/user.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/events", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const lastId = c.req.header("last-event-id") ?? c.req.query("last_id") ?? null;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const cursor = lastId
        ? (
            await client
              .from("orchestrator_events")
              .select("created_at")
              .eq("id", lastId)
              .maybeSingle()
          ).data
        : null;
      let cursorAt =
        (cursor as { created_at: string } | null)?.created_at ??
        new Date(Date.now() - 60_000).toISOString();

      let alive = true;
      const tick = async () => {
        const { data } = await client
          .from("orchestrator_events")
          .select("id, event_type, payload, created_at")
          .eq("user_id", userId)
          .gt("created_at", cursorAt)
          .order("created_at")
          .limit(100);
        for (const row of (data ?? []) as Array<{
          id: string;
          event_type: string;
          payload: unknown;
          created_at: string;
        }>) {
          controller.enqueue(
            enc.encode(formatSseEvent({ id: row.id, event: row.event_type, data: row.payload })),
          );
          cursorAt = row.created_at;
        }
        controller.enqueue(enc.encode(formatSseComment("ping")));
      };

      const interval = setInterval(() => {
        if (!alive) return;
        tick().catch((err) => console.error("orchestrator tick failed", err));
      }, 2000);

      const cleanup = () => {
        alive = false;
        clearInterval(interval);
        controller.close();
      };

      c.req.raw.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
});

export default app;

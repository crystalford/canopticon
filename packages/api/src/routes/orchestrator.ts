// Orchestrator events SSE stream.

import { Hono } from "hono";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { all, one } from "../lib/d1.ts";
import { SSE_HEADERS, formatSseComment, formatSseEvent } from "../lib/sse.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/events", async (c) => {
  const userId = c.get("user_id");
  const db = c.env.DB;
  const lastId = c.req.header("last-event-id") ?? c.req.query("last_id") ?? null;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const cursor = lastId
        ? await one<{ created_at: string }>(
            db,
            "SELECT created_at FROM orchestrator_events WHERE id = ?",
            [lastId],
          )
        : null;
      let cursorAt = cursor?.created_at ?? new Date(Date.now() - 60_000).toISOString();

      let alive = true;
      const tick = async () => {
        const rows = await all<{
          id: string;
          event_type: string;
          payload: string;
          created_at: string;
        }>(
          db,
          "SELECT id, event_type, payload, created_at FROM orchestrator_events WHERE user_id = ? AND created_at > ? ORDER BY created_at LIMIT 100",
          [userId, cursorAt],
        );
        for (const row of rows) {
          controller.enqueue(
            enc.encode(
              formatSseEvent({
                id: row.id,
                event: row.event_type,
                data: JSON.parse(row.payload || "{}"),
              }),
            ),
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

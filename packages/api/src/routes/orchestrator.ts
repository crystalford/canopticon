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
import { z } from "zod";
import type { AuthContext } from "../auth/middleware.ts";
import { requireAuth } from "../auth/middleware.ts";
import { badRequest, notFound } from "../lib/errors.ts";
import { SSE_HEADERS, formatSseComment, formatSseEvent } from "../lib/sse.ts";
import { serviceClient, userClient } from "../lib/supabase.ts";
import { emitEvent } from "../orchestrator/events.ts";

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

// ---------------------------------------------------------------------------
// Cost-approval endpoints.
//
// Lifecycle:
//   1. Cost gate creates a cost_approvals row with status='pending' and
//      emits cost.operation_proposed.
//   2. Web app's cost-approval modal sees the event, surfaces the proposal,
//      operator decides.
//   3. POST /v1/orchestrator/approve-cost flips status to 'approved' or
//      'denied'; emits cost.operation_approved or cost.operation_denied.
//   4. The original caller (research loop, individual role invocation, etc.)
//      re-runs the cost gate with the proposal_id; the gate consumes the
//      approval and proceeds.

const approveSchema = z.object({
  proposal_id: z.string().uuid(),
  decision: z.enum(["approve", "deny"]),
  note: z.string().max(500).optional(),
});

orchestrator.post("/approve-cost", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = approveSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid approval payload", { issues: parsed.error.issues });
  }
  const { proposal_id, decision, note } = parsed.data;

  const userId = c.get("user_id");
  // Use the user-scoped client to confirm the row belongs to this user
  // (RLS makes other users' approvals invisible, but reading first gives a
  // 404 instead of a silent no-op on the update).
  const userScoped = userClient(c.env, c.get("jwt"));
  const { data: row, error: lookupErr } = await userScoped
    .from("cost_approvals")
    .select("id, status, expires_at, estimate_cents, operation_type, provider, model_or_sku")
    .eq("proposal_id", proposal_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (lookupErr) throw new Error(`approve-cost: ${lookupErr.message}`);
  if (!row) throw notFound("Approval not found");

  if (row.status !== "pending") {
    throw badRequest(`Approval is already ${row.status}; cannot change decision.`);
  }
  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    // Mark expired so it doesn't sit at status='pending' forever.
    await userScoped
      .from("cost_approvals")
      .update({ status: "expired", responded_at: new Date().toISOString() })
      .eq("id", row.id);
    throw badRequest("Approval expired before decision.");
  }

  const newStatus = decision === "approve" ? "approved" : "denied";
  const { error: updateErr } = await userScoped
    .from("cost_approvals")
    .update({
      status: newStatus,
      responded_at: new Date().toISOString(),
      decision_note: note ?? null,
    })
    .eq("id", row.id);
  if (updateErr) throw new Error(`approve-cost: ${updateErr.message}`);

  // Emit the corresponding event. Service-role client because emitting
  // events is a backend operation, not a user action — keeps the audit
  // trail consistent.
  const service = serviceClient(c.env);
  await emitEvent(service, {
    user_id: userId,
    event_type: decision === "approve" ? "cost.operation_approved" : "cost.operation_denied",
    entity_type: "cost_approval",
    payload: {
      proposal_id,
      operation_type: row.operation_type,
      estimate_cents: row.estimate_cents,
      ...(note ? { note } : {}),
    },
  });

  return c.json({ data: { proposal_id, status: newStatus } });
});

orchestrator.get("/approvals/pending", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const { data, error } = await client
    .from("cost_approvals")
    .select(
      "id, proposal_id, operation_type, estimate_cents, provider, model_or_sku, context, status, expires_at, created_at",
    )
    .eq("user_id", c.get("user_id"))
    .eq("status", "pending")
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw new Error(`approvals.pending: ${error.message}`);
  return c.json({ data });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default orchestrator;

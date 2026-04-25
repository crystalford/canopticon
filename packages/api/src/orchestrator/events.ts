// Orchestrator event emission.
//
// Every workflow that mutates substrate or wants to surface progress to the
// operator writes here. The SSE endpoint at GET /v1/orchestrator/events
// tails this table and streams to the connected operator.
//
// Two design choices worth noting:
//
//   1. We use orchestrator_events as the single event bus. The cascade,
//      research loop, and webhook handlers all emit through emitEvent().
//      Subscribers don't need to know which workflow produced the event —
//      they filter by user_id (RLS) and event_type prefix.
//
//   2. The function is fire-and-forget on the happy path: events are an
//      observability surface, not a correctness mechanism. If an emission
//      fails, the operator misses a tick of progress; the underlying
//      substrate write is unaffected. We log the failure but don't throw.

import type { EventType } from "@canopticon/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface EmitEventInput {
  user_id: string;
  event_type: EventType | string;
  /** ID of the row this event is about (claim_id, source_id, research_run_id, etc.). */
  entity_id?: string | null;
  /** Type of the entity ('source', 'claim', 'research_run', etc.). */
  entity_type?: string | null;
  /** Free-form payload for subscribers. Keep it small — references over snapshots. */
  payload?: Record<string, unknown>;
}

export async function emitEvent(client: SupabaseClient, input: EmitEventInput): Promise<void> {
  const { error } = await client.from("orchestrator_events").insert({
    user_id: input.user_id,
    event_type: input.event_type,
    entity_id: input.entity_id ?? null,
    entity_type_str: input.entity_type ?? null,
    payload: input.payload ?? {},
  });
  if (error) {
    // Observability surface, not a correctness mechanism — log and swallow.
    console.warn("emitEvent failed", {
      event_type: input.event_type,
      entity_id: input.entity_id,
      message: error.message,
    });
  }
}

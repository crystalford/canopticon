"use client";

import { type SseEvent, openSse } from "@/lib/api-client";
import { useEffect, useRef, useState } from "react";

export interface OrchestratorEvent {
  id: string;
  event_type: string;
  entity_id: string | null;
  entity_type: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface UseOrchestratorEventsOptions {
  /** Only events of these types are surfaced to the consumer; null = all. */
  filter?: string[] | null;
  /** Cap the in-memory event buffer. Older events are dropped FIFO. */
  bufferSize?: number;
  /** Set to false to pause the stream — useful when the page is hidden. */
  enabled?: boolean;
}

export interface UseOrchestratorEventsResult {
  events: OrchestratorEvent[];
  status: "idle" | "connecting" | "open" | "closed" | "error";
  errorMessage: string | null;
  /** Clear the in-memory buffer (does not affect the server). */
  clear: () => void;
}

const DEFAULT_BUFFER = 200;

export function useOrchestratorEvents(
  options: UseOrchestratorEventsOptions = {},
): UseOrchestratorEventsResult {
  const { filter, bufferSize = DEFAULT_BUFFER, enabled = true } = options;
  const [events, setEvents] = useState<OrchestratorEvent[]>([]);
  const [status, setStatus] = useState<UseOrchestratorEventsResult["status"]>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Use the joined filter as the resubscribe key so a fresh array reference
  // with the same contents doesn't reopen the SSE connection. The actual
  // filter array is read through a ref so its identity isn't a dep.
  const filterKey = filter ? filter.join(",") : "";
  const filterRef = useRef(filter);
  filterRef.current = filter;

  useEffect(() => {
    if (!enabled) return;
    // Reference filterKey so the dep array's role is visible to lint.
    void filterKey;

    const controller = new AbortController();
    let cancelled = false;
    let lastEventId: string | undefined;

    const filterSet = filterRef.current ? new Set(filterRef.current) : null;

    async function loop() {
      while (!cancelled) {
        setStatus("connecting");
        await openSse({
          path: "/v1/orchestrator/events",
          ...(lastEventId ? { lastEventId } : {}),
          signal: controller.signal,
          onOpen: () => {
            if (!cancelled) setStatus("open");
          },
          onEvent: (e: SseEvent) => {
            if (cancelled) return;
            if (e.id) lastEventId = e.id;
            // The stream.end / stream.error envelope events use these
            // synthetic event names; they're not user-relevant.
            if (e.event === "stream.end" || e.event === "stream.error") return;
            if (filterSet && e.event && !filterSet.has(e.event)) return;
            if (!e.data || typeof e.data !== "object") return;
            const event = e.data as OrchestratorEvent;
            setEvents((prev) => {
              const next = [...prev, event];
              return next.length > bufferSize ? next.slice(next.length - bufferSize) : next;
            });
          },
          onClose: (reason, err) => {
            if (cancelled) return;
            if (reason === "abort") {
              setStatus("closed");
              return;
            }
            if (reason === "error") {
              setStatus("error");
              setErrorMessage(err?.message ?? "stream error");
              return;
            }
            // stream_end → loop reconnects with lastEventId
            setStatus("closed");
          },
        });
        if (cancelled) break;
        // Brief backoff before reconnect; the server's stream_end is the
        // intended polite-close signal so this is normal flow.
        await sleep(500);
      }
    }

    void loop();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, bufferSize, filterKey]);

  return {
    events,
    status,
    errorMessage,
    clear: () => setEvents([]),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

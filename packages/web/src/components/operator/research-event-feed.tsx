"use client";

import type { OrchestratorEvent } from "@/hooks/use-orchestrator-events";

const RESEARCH_EVENT_LABELS: Record<string, string> = {
  "research.started": "started",
  "research.iteration_started": "iteration",
  "research.tool_called": "tool call",
  "research.source_registered": "source registered",
  "research.iteration_completed": "iteration done",
  "research.completed": "done",
  "research.failed": "failed",
};

export function ResearchEventFeed({
  events,
  emptyMessage = "no events yet",
}: {
  events: OrchestratorEvent[];
  emptyMessage?: string;
}) {
  if (events.length === 0) {
    return (
      <p className="text-cream-faint font-mono text-xs uppercase tracking-widest">{emptyMessage}</p>
    );
  }

  return (
    <ol className="space-y-2 font-mono text-xs">
      {events
        .slice()
        .reverse()
        .map((event) => (
          <li key={event.id} className="border-l-2 border-amber-dim pl-3 py-1 text-cream-dim">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-amber uppercase tracking-widest">
                {RESEARCH_EVENT_LABELS[event.event_type] ?? event.event_type}
              </span>
              <time className="text-cream-faint shrink-0">
                {new Date(event.created_at).toLocaleTimeString()}
              </time>
            </div>
            <EventDetails event={event} />
          </li>
        ))}
    </ol>
  );
}

function EventDetails({ event }: { event: OrchestratorEvent }) {
  if (event.event_type === "research.started") {
    return (
      <p className="text-cream mt-1">
        topic: <span className="text-amber">{String(event.payload.topic ?? "?")}</span>
      </p>
    );
  }
  if (event.event_type === "research.tool_called") {
    return (
      <p className="text-cream mt-1">
        <span className="text-amber">{String(event.payload.tool ?? "?")}</span>
        {event.payload.iteration ? (
          <span className="text-cream-faint"> · iter {String(event.payload.iteration)}</span>
        ) : null}
      </p>
    );
  }
  if (event.event_type === "research.source_registered") {
    return (
      <p className="text-cream mt-1">
        source{" "}
        <span className="text-signal-sage">{String(event.entity_id ?? "?").slice(0, 8)}</span>{" "}
        registered
      </p>
    );
  }
  if (event.event_type === "research.iteration_completed") {
    const cost = event.payload.turn_cost_cents;
    const total = event.payload.total_cost_cents;
    return (
      <p className="text-cream-dim mt-1">
        {String(event.payload.tool_count ?? 0)} tool calls · turn{" "}
        <span className="text-cream">{cost ? `${String(cost)}¢` : "—"}</span> · total{" "}
        <span className="text-amber">{total ? `${String(total)}¢` : "—"}</span>
      </p>
    );
  }
  if (event.event_type === "research.completed" || event.event_type === "research.failed") {
    return (
      <p className="text-cream mt-1">
        {String(event.payload.summary ?? "")}
        <span className="text-cream-faint">
          {" · "}
          {String(event.payload.sources_registered ?? 0)} sources ·{" "}
          {String(event.payload.total_cost_cents ?? 0)}¢
        </span>
      </p>
    );
  }
  return null;
}

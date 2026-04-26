"use client";

import { ResearchEventFeed } from "@/components/operator/research-event-feed";
import { type ResearchRunSummary, TopicForm } from "@/components/operator/topic-form";
import { Badge, Card, ScreenHeader } from "@/components/primitives";
import { useOrchestratorEvents } from "@/hooks/use-orchestrator-events";
import { apiGet } from "@/lib/api-client";
import { useEffect, useState } from "react";

interface RecentRun {
  id: string;
  topic: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  iterations: number;
  sources_registered: number;
  total_cost_cents: number;
  budget_cents: number;
  output_summary: string | null;
}

const RESEARCH_FILTER = [
  "research.started",
  "research.iteration_started",
  "research.tool_called",
  "research.source_registered",
  "research.iteration_completed",
  "research.completed",
  "research.failed",
];

export default function ResearchPage() {
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [latestRun, setLatestRun] = useState<ResearchRunSummary | null>(null);
  const { events, status, errorMessage } = useOrchestratorEvents({
    filter: RESEARCH_FILTER,
  });

  useEffect(() => {
    let cancelled = false;
    apiGet<RecentRun[]>("/v1/research/runs?limit=10")
      .then((data) => {
        if (!cancelled) setRecentRuns(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const last = events[events.length - 1];
    if (!last) return;
    if (last.event_type !== "research.completed" && last.event_type !== "research.failed") return;
    apiGet<RecentRun[]>("/v1/research/runs?limit=10")
      .then(setRecentRuns)
      .catch(() => {
        /* swallow — list will refresh on next mount */
      });
  }, [events]);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto grid gap-8 lg:grid-cols-[2fr_3fr]">
      <section>
        <ScreenHeader title="Research" subtitle="AI-driven graph growth" />
        <TopicForm onSubmitted={(run) => setLatestRun(run)} />

        {latestRun && (
          <Card tone="amber" className="mt-6 text-text">
            <p className="font-mono text-xs uppercase tracking-widest text-amber mb-2">
              run completed
            </p>
            <p className="leading-relaxed">{latestRun.done_summary ?? "no summary"}</p>
            <p className="text-text-faint font-mono text-xs mt-3">
              {latestRun.iterations} iter · {latestRun.sources_registered} sources ·{" "}
              {latestRun.total_cost_cents}¢
            </p>
          </Card>
        )}

        <RecentRunsList runs={recentRuns} loadError={loadError} />
      </section>

      <section className="border-l border-border-soft lg:pl-8">
        <header className="flex items-baseline justify-between mb-4">
          <h2 className="font-serif text-xl text-cream">Live</h2>
          <StreamStatus status={status} message={errorMessage} />
        </header>
        <ResearchEventFeed
          events={events}
          emptyMessage="connect a research run to populate this feed"
        />
      </section>
    </div>
  );
}

function RecentRunsList({
  runs,
  loadError,
}: {
  runs: RecentRun[];
  loadError: string | null;
}) {
  if (loadError) {
    return (
      <p className="mt-8 text-signal font-mono text-xs">could not load recent runs: {loadError}</p>
    );
  }
  if (runs.length === 0) {
    return (
      <p className="mt-8 text-text-faint font-mono text-xs uppercase tracking-widest">
        no runs yet
      </p>
    );
  }
  return (
    <div className="mt-8">
      <h3 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-3">
        recent runs
      </h3>
      <ol className="space-y-3">
        {runs.map((run) => (
          <li key={run.id} className="border-b border-border-soft pb-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-cream font-serif">{run.topic}</span>
              <RunStatusBadge status={run.status} />
            </div>
            <p className="text-text-faint font-mono text-xs mt-1">
              {run.iterations} iter · {run.sources_registered} sources · {run.total_cost_cents}¢ /{" "}
              {run.budget_cents}¢
              <span className="ml-2">{new Date(run.started_at).toLocaleString()}</span>
            </p>
            {run.output_summary && (
              <p className="text-text-dim text-sm mt-2 leading-relaxed">{run.output_summary}</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const tone =
    status === "completed"
      ? "sage"
      : status === "failed"
        ? "signal"
        : status === "running"
          ? "amber"
          : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}

function StreamStatus({
  status,
  message,
}: {
  status: ReturnType<typeof useOrchestratorEvents>["status"];
  message: string | null;
}) {
  const dotColor =
    status === "open"
      ? "bg-sage"
      : status === "connecting"
        ? "bg-amber"
        : status === "error"
          ? "bg-signal"
          : "bg-text-faint";
  return (
    <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-text-faint">
      <span className={`w-2 h-2 rounded-full ${dotColor}`} aria-hidden />
      {status}
      {message && <span className="ml-2 text-signal normal-case">{message}</span>}
    </span>
  );
}

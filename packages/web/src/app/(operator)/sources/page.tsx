"use client";

import { Badge, ScreenHeader } from "@/components/primitives";
import { useOrchestratorEvents } from "@/hooks/use-orchestrator-events";
import { ApiError, apiGet } from "@/lib/api-client";
import Link from "next/link";
import { useEffect, useState } from "react";

interface SourceRow {
  id: string;
  source_type: string;
  title: string;
  url: string | null;
  publication: string | null;
  author: string | null;
  published_at: string | null;
  retrieved_at: string;
  admiralty_grade: string;
  ingestion_mode: string;
  ingestion_state: string;
  slug: string | null;
  created_at: string;
}

const STATE_FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "all" },
  { key: "pending_critic", label: "pending" },
  { key: "critic_completed", label: "graded" },
  { key: "approved", label: "approved" },
  { key: "deferred", label: "deferred" },
  { key: "rejected", label: "rejected" },
];

export default function SourcesPage() {
  const [filter, setFilter] = useState<string>("pending_critic");
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { events } = useOrchestratorEvents({
    filter: ["source.created", "source.updated"],
    bufferSize: 50,
  });
  // Re-fetch when filter changes or new source events arrive.
  const eventsTick = events.length;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void eventsTick; // referenced as a refetch trigger; biome wants it visible
    const path =
      filter === "all"
        ? "/v1/sources?limit=100"
        : `/v1/sources?ingestion_state=${filter}&limit=100`;
    apiGet<SourceRow[]>(path)
      .then((data) => {
        if (!cancelled) {
          setSources(data);
          setLoadError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : (err as Error).message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, eventsTick]);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <ScreenHeader title="Sources" subtitle="ingestion queue · grading · approvals" />

      <div className="flex gap-1 mb-6 border-b border-border-soft">
        {STATE_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`px-3 py-2 font-mono text-xs uppercase tracking-widest border-b-2 -mb-px ${
              filter === f.key
                ? "border-amber text-amber"
                : "border-transparent text-text-dim hover:text-cream"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loadError && (
        <p className="text-signal font-mono text-xs mb-4">could not load: {loadError}</p>
      )}

      {loading ? (
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">loading...</p>
      ) : sources.length === 0 ? (
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
          no sources at this state
        </p>
      ) : (
        <ol className="divide-y divide-border-soft">
          {sources.map((source) => (
            <li key={source.id} className="py-4">
              <SourceRow source={source} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SourceRow({ source }: { source: SourceRow }) {
  return (
    <Link
      href={`/sources/${source.id}` as never}
      className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-baseline hover:bg-bg-subtle -mx-2 px-2 py-1"
    >
      <GradeBadge grade={source.admiralty_grade} />
      <div>
        <p className="text-cream font-serif">{source.title}</p>
        <p className="text-text-faint font-mono text-xs mt-1">
          {source.source_type}
          {source.publication ? ` · ${source.publication}` : ""}
          {source.author ? ` · ${source.author}` : ""}
          {source.published_at ? ` · ${new Date(source.published_at).toLocaleDateString()}` : ""}
        </p>
      </div>
      <StateBadge state={source.ingestion_state} />
    </Link>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const tone = grade === "A" ? "amber" : grade === "B" ? "tan" : "neutral";
  return (
    <Badge tone={tone} variant="solid" className="w-7 justify-center">
      {grade}
    </Badge>
  );
}

function StateBadge({ state }: { state: string }) {
  const tone =
    state === "approved"
      ? "sage"
      : state === "rejected"
        ? "signal"
        : state === "deferred"
          ? "tan"
          : state === "critic_completed"
            ? "blue"
            : "amber";
  return <Badge tone={tone}>{state.replace(/_/g, " ")}</Badge>;
}

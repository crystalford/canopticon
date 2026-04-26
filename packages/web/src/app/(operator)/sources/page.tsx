"use client";

import { Card, FilterChips, GradeChip, MetadataStrip, StatusChip } from "@/components/primitives";
import { apiGet, apiPost } from "@/lib/api-client";
import { useEffect, useState } from "react";

type SourceState = "" | "pending_critic" | "approved" | "deferred" | "rejected";

interface Source {
  id: string;
  title: string;
  url: string | null;
  source_type: string;
  ingestion_state: string;
  admiralty_grade: string | null;
  bias_profile: string | null;
  ingested_at: string;
  published_at: string | null;
}

export default function SourcesPage() {
  const [filter, setFilter] = useState<SourceState>("pending_critic");
  const [sources, setSources] = useState<Source[]>([]);

  async function load() {
    const path = filter ? `/v1/sources/?state=${filter}` : "/v1/sources/";
    const res = await apiGet<{ sources: Source[] }>(path);
    setSources(res.sources);
  }
  useEffect(() => {
    void load();
  }, [filter]);

  async function decide(id: string, action: "approve" | "defer" | "reject") {
    await apiPost(`/v1/sources/${id}/action`, { action });
    await load();
  }

  return (
    <main className="px-4 py-3">
      <header className="mb-3">
        <MetadataStrip>Sources · ingestion queue</MetadataStrip>
        <h1 className="font-serif text-2xl text-cream-bright">Sources</h1>
      </header>

      <FilterChips
        chips={[
          { value: "pending_critic", label: "Pending" },
          { value: "approved", label: "Approved" },
          { value: "deferred", label: "Deferred" },
          { value: "rejected", label: "Rejected" },
          { value: "", label: "All" },
        ]}
        active={filter}
        onChange={setFilter}
      />

      <section className="mt-4 space-y-2">
        {sources.map((s) => (
          <Card key={s.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <MetadataStrip>{`${s.source_type.toUpperCase()} · ${new Date(s.ingested_at).toLocaleDateString()}`}</MetadataStrip>
                <h3 className="mt-1 font-serif text-base text-cream-bright">{s.title}</h3>
                {s.bias_profile && (
                  <p className="mt-1 font-serif text-sm italic text-text-dim">{s.bias_profile}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                {s.admiralty_grade && <GradeChip grade={s.admiralty_grade} />}
                <StatusChip>{s.ingestion_state}</StatusChip>
              </div>
            </div>
            {s.ingestion_state === "pending_critic" && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => decide(s.id, "approve")}
                  className="flex-1 border border-cream-dim py-1 font-mono text-[10.5px] uppercase tracking-wider text-cream-bright hover:bg-cream-glow"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => decide(s.id, "defer")}
                  className="flex-1 border border-border py-1 font-mono text-[10.5px] uppercase tracking-wider text-text-dim hover:border-cream-dim"
                >
                  Defer
                </button>
                <button
                  type="button"
                  onClick={() => decide(s.id, "reject")}
                  className="flex-1 border border-signal-dim py-1 font-mono text-[10.5px] uppercase tracking-wider text-signal hover:bg-signal-glow"
                >
                  Reject
                </button>
              </div>
            )}
          </Card>
        ))}
        {sources.length === 0 && (
          <p className="py-12 text-center font-serif italic text-text-dim">
            No sources match this filter.
          </p>
        )}
      </section>
    </main>
  );
}

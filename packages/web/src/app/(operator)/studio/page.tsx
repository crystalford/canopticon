"use client";

import {
  Card,
  FilterChips,
  MetadataStrip,
  PipelineProgress,
  type StageState,
} from "@/components/primitives";
import { apiGet, apiPatch } from "@/lib/api-client";
import { useEffect, useState } from "react";

type StudioTab = "ready" | "recording" | "producing" | "publish" | "perf" | "archive";

interface Production {
  id: string;
  format: string;
  title: string;
  description: string | null;
  state: string;
  estimated_runtime_seconds: number | null;
  estimated_word_count: number | null;
  pipeline_stage: string;
  pipeline_progress: number;
  thesis_id: string | null;
  updated_at: string;
}

const PIPELINE: { stage: string; label: string }[] = [
  { stage: "script", label: "Script" },
  { stage: "coherence", label: "Cohere" },
  { stage: "record", label: "Record" },
  { stage: "edit", label: "Edit" },
  { stage: "publish", label: "Publish" },
];

function pipelineFor(stage: string): { label: string; state: StageState }[] {
  const order = PIPELINE.map((p) => p.stage);
  const cur = order.indexOf(stage);
  return PIPELINE.map((p, idx) => ({
    label: p.label,
    state: idx < cur ? "done" : idx === cur ? "current" : "pending",
  }));
}

export default function StudioPage() {
  const [tab, setTab] = useState<StudioTab>("ready");
  const [productions, setProductions] = useState<Production[]>([]);

  async function load() {
    const res = await apiGet<{ productions: Production[] }>(`/v1/productions/?state=${tab}`);
    setProductions(res.productions);
  }
  useEffect(() => {
    void load();
  }, [tab]);

  async function advance(id: string, next: string) {
    await apiPatch(`/v1/productions/${id}/state`, { state: next });
    await load();
  }

  return (
    <main>
      <header className="mb-6">
        <MetadataStrip>Studio · production</MetadataStrip>
        <h1 className="font-sans text-3xl font-extrabold uppercase tracking-tight text-cream-bright md:text-4xl">
          Studio
        </h1>
      </header>

      <FilterChips
        chips={[
          { value: "ready", label: "Ready" },
          { value: "recording", label: "Recording" },
          { value: "producing", label: "Producing" },
          { value: "publish", label: "Publish" },
          { value: "perf", label: "Perf" },
          { value: "archive", label: "Archive" },
        ]}
        active={tab}
        onChange={setTab}
      />

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {productions.map((p) => (
          <Card key={p.id}>
            <MetadataStrip>{`${p.format.toUpperCase()} · ${new Date(p.updated_at).toLocaleDateString()}`}</MetadataStrip>
            <h3 className="mt-1 font-serif text-base text-cream-bright">{p.title}</h3>
            {p.description && (
              <p className="mt-1 font-serif text-sm italic text-text-dim">{p.description}</p>
            )}
            <div className="mt-3">
              <PipelineProgress stages={pipelineFor(p.pipeline_stage)} />
            </div>
            {tab === "ready" && (
              <div className="mt-3 flex gap-2">
                <a
                  href={`/studio/recording?id=${p.id}`}
                  className="flex-1 border border-cream-dim py-1 text-center font-mono text-[10.5px] uppercase tracking-wider text-cream-bright hover:bg-cream-glow"
                >
                  Start Recording
                </a>
                <button
                  type="button"
                  onClick={() => advance(p.id, "archive")}
                  className="flex-1 border border-border py-1 font-mono text-[10.5px] uppercase tracking-wider text-text-dim"
                >
                  Defer
                </button>
              </div>
            )}
          </Card>
        ))}
        {productions.length === 0 && (
          <p className="col-span-full py-12 text-center font-serif italic text-text-dim">
            No productions in this state.
          </p>
        )}
      </section>
    </main>
  );
}

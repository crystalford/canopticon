"use client";

// Live screen: activity feed + summary stats. Polls /v1/live/ every
// 30 seconds (Realtime subscription replaces polling later).

import { Card, type ChipTone, MetadataStrip, StatusChip } from "@/components/primitives";
import { apiGet, apiPost } from "@/lib/api-client";
import Link from "next/link";
import { useEffect, useState } from "react";

interface FeedItem {
  kind: string;
  id: string;
  ts: string;
  payload: Record<string, unknown>;
}

interface FeedResponse {
  feed: FeedItem[];
  stats: {
    claims: number;
    contradictions: number;
    questions: number;
    predictions_resolved: number;
    productions: number;
    sources_pending: number;
  };
}

const railByKind: Record<string, ChipTone> = {
  claim: "sage",
  contradiction: "signal",
  question: "blue",
  prediction: "amber",
  production: "cream",
  source: "tan",
  event: "default",
};

export default function LivePage() {
  const [data, setData] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      const res = await apiGet<FeedResponse>("/v1/live/");
      setData(res);
    } catch (err) {
      console.error("failed to load live feed", err);
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  async function runCascade() {
    setLoading(true);
    try {
      await apiPost("/v1/cascade/run", {});
      await load();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <MetadataStrip>Cascade · live feed</MetadataStrip>
          <h1 className="font-sans text-3xl font-extrabold uppercase tracking-tight text-cream-bright md:text-4xl">
            What changed
          </h1>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={runCascade}
          className="border border-cream-dim px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-cream-bright hover:bg-cream-glow disabled:opacity-50"
        >
          {loading ? "Running cascade…" : "Run Cascade"}
        </button>
      </header>

      <section className="mb-6 grid grid-cols-3 gap-2 border border-border-soft bg-bg-card p-4 md:grid-cols-6 md:gap-4">
        <Stat label="Claims" value={data?.stats.claims ?? 0} />
        <Stat label="Questions" value={data?.stats.questions ?? 0} />
        <Stat label="Contradictions" value={data?.stats.contradictions ?? 0} />
        <Stat label="Resolved" value={data?.stats.predictions_resolved ?? 0} />
        <Stat label="Production" value={data?.stats.productions ?? 0} />
        <Stat label="Pending sources" value={data?.stats.sources_pending ?? 0} />
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {(data?.feed ?? []).map((item) => (
          <Card key={`${item.kind}-${item.id}`} rail={railByKind[item.kind] ?? "default"}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <MetadataStrip>{`${item.kind.toUpperCase()} · ${formatTs(item.ts)}`}</MetadataStrip>
                <p className="mt-1 truncate font-serif text-base text-cream">{summarize(item)}</p>
              </div>
              <StatusChip tone={railByKind[item.kind] ?? "default"}>{item.kind}</StatusChip>
            </div>
          </Card>
        ))}
        {data && data.feed.length === 0 && (
          <div className="col-span-full mx-auto max-w-md py-8 text-center">
            <p className="font-serif italic text-text-dim">No activity in the last 24 hours.</p>
            <Link
              href="/chat?prompt=Please%20seed%20example%20content%20so%20I%20can%20see%20what%20the%20app%20looks%20like%20with%20real%20data."
              className="mt-3 inline-block border border-amber bg-amber/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-amber hover:bg-amber/20"
            >
              Open Chat → seed content
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-mono text-2xl text-cream-bright">{value}</div>
      <div className="font-mono text-[9px] uppercase tracking-wider text-text-faint">{label}</div>
    </div>
  );
}

function formatTs(ts: string): string {
  const date = new Date(ts);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return date.toISOString().slice(0, 10);
}

function summarize(item: FeedItem): string {
  const p = item.payload;
  if (item.kind === "claim") return `New ${(p.layer as string) ?? ""} claim`;
  if (item.kind === "contradiction") return `Contradiction (${(p.posture as string) ?? "open"})`;
  if (item.kind === "question") return (p.question_text as string) ?? "New question";
  if (item.kind === "prediction") return (p.statement as string) ?? "Prediction updated";
  if (item.kind === "production")
    return `${(p.title as string) ?? "Production"} → ${(p.state as string) ?? ""}`;
  if (item.kind === "source") return (p.title as string) ?? "Source";
  if (item.kind === "event") return (p.event_type as string) ?? "event";
  return JSON.stringify(p).slice(0, 80);
}

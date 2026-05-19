"use client";

// Monitors: the apex of the pyramid. Curated, agent-judged watchers
// over high-signal sources (BIS, FSB, etc.). Scheduled runs fire from
// the Worker's cron trigger; this page also offers a manual "Run now".

import { Card, MetadataStrip, StatusChip } from "@/components/primitives";
import { apiGet, apiPost } from "@/lib/api-client";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Monitor {
  id: string;
  name: string;
  tier: number;
  source_url: string;
  cadence_cron: string;
  enabled: number;
  last_run_at: string | null;
  last_status: string | null;
  last_finding: string | null;
  last_source_id: string | null;
}

const TIER_LABELS: Record<number, string> = {
  1: "Apex",
  2: "Investigation wires",
  3: "Adjacent",
};

export default function MonitorsPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);

  async function load() {
    const res = await apiGet<{ monitors: Monitor[] }>("/v1/monitors/");
    setMonitors(res.monitors);
  }
  useEffect(() => {
    void load();
  }, []);

  async function runNow(id: string) {
    setRunningId(id);
    try {
      await apiPost(`/v1/monitors/${id}/run`);
      // Poll-ish: give the watcher a moment then refresh.
      setTimeout(() => {
        void load();
        setRunningId(null);
      }, 4000);
    } catch {
      setRunningId(null);
    }
  }

  const byTier = new Map<number, Monitor[]>();
  for (const m of monitors) {
    const list = byTier.get(m.tier) ?? [];
    list.push(m);
    byTier.set(m.tier, list);
  }
  const tiers = [...byTier.keys()].sort((a, b) => a - b);

  return (
    <main>
      <header className="mb-6">
        <MetadataStrip>Monitors · the architecture</MetadataStrip>
        <h1 className="font-sans text-3xl font-extrabold uppercase tracking-tight text-cream-bright md:text-4xl">
          Monitors
        </h1>
        <p className="mt-2 max-w-2xl font-serif text-sm text-text-dim">
          Agent-judged watchers over the bodies at the top of the pyramid. Each one runs on a
          schedule, reads the watched page, and only ingests genuinely new and significant material.
          Language shifts between readouts surface on the Live feed.
        </p>
      </header>

      {tiers.length === 0 && (
        <p className="py-12 text-center font-serif italic text-text-dim">No monitors configured.</p>
      )}

      {tiers.map((tier) => (
        <section key={tier} className="mb-8">
          <MetadataStrip>{`Tier ${tier} · ${TIER_LABELS[tier] ?? "Other"}`}</MetadataStrip>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {(byTier.get(tier) ?? []).map((m) => (
              <Card key={m.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-sans text-base font-bold uppercase tracking-tight text-cream-bright">
                      {m.name}
                    </h3>
                    <a
                      href={m.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate font-mono text-[10.5px] uppercase tracking-wider text-text-dim hover:text-cream-dim"
                      title={m.source_url}
                    >
                      {m.source_url}
                    </a>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-faint">
                      {humanCadence(m.cadence_cron)}
                    </p>
                  </div>
                  <StatusChip>{m.last_status ?? "idle"}</StatusChip>
                </div>

                <div className="mt-3 border-t border-border-soft pt-3">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-text-faint">
                    Last run · {m.last_run_at ? new Date(m.last_run_at).toLocaleString() : "never"}
                  </p>
                  {m.last_finding && (
                    <p className="mt-2 font-serif text-sm italic text-text-dim">{m.last_finding}</p>
                  )}
                  {m.last_source_id && (
                    <Link
                      href={`/sources?focus=${m.last_source_id}`}
                      className="mt-2 inline-block font-mono text-[10px] uppercase tracking-wider text-cream-dim hover:text-cream-bright"
                    >
                      Last source →
                    </Link>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void runNow(m.id)}
                    disabled={runningId === m.id}
                    className="flex-1 border border-cream-dim py-1 font-mono text-[10.5px] uppercase tracking-wider text-cream-bright hover:bg-cream-glow disabled:opacity-40"
                  >
                    {runningId === m.id ? "Running…" : "Run now"}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

function humanCadence(cron: string): string {
  // Very small cron prettifier — only needs to handle the patterns we use.
  const map: Record<string, string> = {
    "0 12 * * 1": "Weekly · Mon 12:00 UTC",
    "0 12 * * *": "Daily · 12:00 UTC",
    "0 12 1 * *": "Monthly · 1st 12:00 UTC",
  };
  return map[cron] ?? cron;
}

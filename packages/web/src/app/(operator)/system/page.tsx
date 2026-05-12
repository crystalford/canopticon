"use client";

// System screen: ops cockpit. Cost panel, cascade status, role health,
// settings.

import { Card, MetadataStrip, Toggle } from "@/components/primitives";
import { apiGet, apiPatch } from "@/lib/api-client";
import { useEffect, useState } from "react";

interface SystemData {
  cost: {
    monthly_spend_cents: number;
    monthly_ceiling_cents: number;
    by_operation: Record<string, number>;
  };
  cascade: {
    last_runs: Array<{
      id: string;
      status: string;
      started_at: string | null;
      completed_at: string | null;
      spent_cents: number;
      stats: Record<string, unknown>;
    }>;
  };
  roles: Record<string, { count: number; errors: number }>;
  brier: {
    rolling: number | null;
    resolved_count: number;
    active_count: number;
  };
  settings: {
    ingestion_apis_enabled: boolean;
    cascade_cron_expr: string | null;
    named_operator: string | null;
  };
  providers: {
    workers_ai: { enabled: boolean; free: boolean };
    anthropic: { enabled: boolean; available: boolean };
  };
  roles_assignment: Array<{
    name: string;
    provider: string;
    model: string;
    allow_anthropic_override: boolean;
  }>;
}

export default function SystemPage() {
  const [data, setData] = useState<SystemData | null>(null);

  async function load() {
    setData(await apiGet<SystemData>("/v1/system/"));
  }
  useEffect(() => {
    void load();
  }, []);

  async function toggleIngestion(next: boolean) {
    await apiPatch("/v1/system/settings", { ingestion_apis_enabled: next });
    await load();
  }

  async function toggleAnthropic(next: boolean) {
    await apiPatch("/v1/system/providers", { anthropic_enabled: next });
    await load();
  }

  async function setRoleProvider(name: string, provider: "workers_ai" | "anthropic") {
    await apiPatch(`/v1/system/roles/${name}`, { provider });
    await load();
  }

  if (!data) return <main className="p-4 font-serif italic text-text-dim">Loading…</main>;

  const pct =
    data.cost.monthly_ceiling_cents > 0
      ? Math.min(100, (data.cost.monthly_spend_cents / data.cost.monthly_ceiling_cents) * 100)
      : 0;

  return (
    <main>
      <header className="mb-6">
        <MetadataStrip>System · operations</MetadataStrip>
        <h1 className="font-sans text-3xl font-extrabold uppercase tracking-tight text-cream-bright md:text-4xl">
          Cockpit
        </h1>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <MetadataStrip>Cost · this month</MetadataStrip>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl text-cream-bright">
              ${(data.cost.monthly_spend_cents / 100).toFixed(2)}
            </span>
            <span className="font-mono text-[11px] text-text-dim">
              / ${(data.cost.monthly_ceiling_cents / 100).toFixed(2)}
            </span>
          </div>
          <div className="mt-2 h-2 border border-border-soft bg-bg-deeper">
            <div
              className={`h-full ${pct > 80 ? "bg-signal" : pct > 50 ? "bg-amber" : "bg-sage"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <ul className="mt-3 space-y-1 font-mono text-[11px] text-text-dim">
            {Object.entries(data.cost.by_operation).map(([op, cents]) => (
              <li key={op} className="flex justify-between">
                <span>{op}</span>
                <span>${(cents / 100).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <MetadataStrip>Cascade · last 10 runs</MetadataStrip>
          <ul className="mt-2 space-y-1 font-mono text-[11px]">
            {data.cascade.last_runs.map((r) => (
              <li key={r.id} className="flex justify-between text-text-dim">
                <span>{r.started_at ? new Date(r.started_at).toLocaleString() : "—"}</span>
                <span
                  className={
                    r.status === "failed"
                      ? "text-signal"
                      : r.status === "completed"
                        ? "text-sage"
                        : "text-amber"
                  }
                >
                  {r.status}
                </span>
              </li>
            ))}
            {data.cascade.last_runs.length === 0 && (
              <li className="text-text-faint">No runs yet.</li>
            )}
          </ul>
        </Card>

        <Card>
          <MetadataStrip>Roles · 24h</MetadataStrip>
          <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-[11px] text-text-dim">
            {Object.entries(data.roles).map(([name, s]) => (
              <li key={name} className="flex justify-between">
                <span>{name}</span>
                <span>
                  {s.count}
                  {s.errors > 0 && <span className="text-signal"> ({s.errors})</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <MetadataStrip>Brier · rolling</MetadataStrip>
          <div className="mt-1 font-mono text-2xl text-cream-bright">
            {data.brier.rolling !== null ? data.brier.rolling.toFixed(3) : "—"}
          </div>
          <div className="font-mono text-[11px] text-text-dim">
            {data.brier.resolved_count} resolved · {data.brier.active_count} active
          </div>
        </Card>

        <Card>
          <MetadataStrip>Settings</MetadataStrip>
          <div className="mt-3 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-cream-dim">
              Ingestion APIs
            </span>
            <Toggle checked={data.settings.ingestion_apis_enabled} onChange={toggleIngestion} />
          </div>
          <div className="mt-3 font-mono text-[11px] text-text-dim">
            Cron: {data.settings.cascade_cron_expr ?? "manual only"}
          </div>
          <div className="mt-1 font-mono text-[11px] text-text-dim">
            Named operator: {data.settings.named_operator ?? "—"}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <MetadataStrip>AI Providers</MetadataStrip>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-cream-dim">
                  Workers AI
                </span>
                <span className="font-mono text-[10px] text-sage">FREE</span>
              </div>
              <div className="mt-1 font-serif text-[12px] text-text-dim">
                Llama 4 Scout · Llama 3.3 70B · QwQ-32B · bge embeddings. Always on.
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-cream-dim">
                  Anthropic (opt-in)
                </span>
                <Toggle
                  checked={data.providers.anthropic.enabled}
                  onChange={toggleAnthropic}
                  {...(data.providers.anthropic.available ? {} : { label: "(no key)" })}
                />
              </div>
              <div className="mt-1 font-serif text-[12px] text-text-dim">
                {data.providers.anthropic.available
                  ? "Used per-role only when you flip a role below to anthropic."
                  : "Set ANTHROPIC_API_KEY in Worker secrets to enable."}
              </div>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <MetadataStrip>Role assignments</MetadataStrip>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full font-mono text-[11px]">
              <thead>
                <tr className="text-left text-text-faint">
                  <th className="py-1 pr-3">Role</th>
                  <th className="py-1 pr-3">Provider</th>
                  <th className="py-1 pr-3">Model</th>
                  <th className="py-1">Anthropic override</th>
                </tr>
              </thead>
              <tbody>
                {data.roles_assignment.map((r) => (
                  <tr key={r.name} className="border-t border-border-soft">
                    <td className="py-1 pr-3 text-cream">{r.name}</td>
                    <td className="py-1 pr-3">
                      {r.allow_anthropic_override && data.providers.anthropic.enabled ? (
                        <select
                          value={r.provider}
                          onChange={(e) =>
                            setRoleProvider(r.name, e.target.value as "workers_ai" | "anthropic")
                          }
                          className="border border-border-soft bg-bg-deeper px-1 py-0.5 text-cream"
                        >
                          <option value="workers_ai">workers_ai</option>
                          <option value="anthropic">anthropic</option>
                        </select>
                      ) : (
                        <span className="text-text-dim">{r.provider}</span>
                      )}
                    </td>
                    <td className="py-1 pr-3 text-text-dim">{r.model}</td>
                    <td className="py-1">
                      {r.allow_anthropic_override ? (
                        <span className="text-amber">allowed</span>
                      ) : (
                        <span className="text-text-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </main>
  );
}

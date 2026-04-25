"use client";

import { Badge, Card, ScreenHeader, StatList } from "@/components/primitives";
import { useOrchestratorEvents } from "@/hooks/use-orchestrator-events";
import { ApiError, apiGet } from "@/lib/api-client";
import { useEffect, useState } from "react";

interface CostsSummary {
  monthly_cents: number;
  monthly_ceiling_cents: number;
  monthly_remaining_cents: number;
  window_30d_cents: number;
  by_operation_type: Array<{ operation_type: string; cents: number; count: number }>;
  approved_split: { approved: number; auto: number };
  daily_series: Array<{ day: string; cents: number }>;
  operation_count: number;
}

interface RoleActivity {
  window_30d: Array<{
    role_name: string;
    total: number;
    success: number;
    error: number;
    partial: number;
    total_cost_cents: number;
    tokens_input: number;
    tokens_output: number;
    last_run_at: string | null;
    last_7d: number;
  }>;
  total_invocations: number;
}

interface CascadeRun {
  id: string;
  triggered_by: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  sources_ingested: number;
  claims_written: number;
  questions_generated: number;
  total_cost_cents: number;
}

export default function SystemPage() {
  const [costs, setCosts] = useState<CostsSummary | null>(null);
  const [activity, setActivity] = useState<RoleActivity | null>(null);
  const [cascades, setCascades] = useState<CascadeRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { status: streamStatus } = useOrchestratorEvents({ bufferSize: 10 });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiGet<CostsSummary>("/v1/system/costs"),
      apiGet<RoleActivity>("/v1/system/role-activity"),
      apiGet<CascadeRun[]>("/v1/cascade/runs?limit=10"),
    ])
      .then(([c, a, runs]) => {
        if (cancelled) return;
        setCosts(c);
        setActivity(a);
        setCascades(runs);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : (err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto space-y-10">
      <ScreenHeader title="System" subtitle="cost · role activity · runs · stream health" />

      {error && (
        <Card tone="signal">
          <p className="text-signal font-mono text-xs">could not load system data: {error}</p>
        </Card>
      )}

      <CostsPanel costs={costs} streamStatus={streamStatus} />
      <RoleActivityPanel activity={activity} />
      <CascadeRunsPanel runs={cascades} />
    </div>
  );
}

function CostsPanel({
  costs,
  streamStatus,
}: {
  costs: CostsSummary | null;
  streamStatus: ReturnType<typeof useOrchestratorEvents>["status"];
}) {
  if (!costs) {
    return <Loading label="costs" />;
  }
  const pct = Math.min(100, Math.round((costs.monthly_cents / costs.monthly_ceiling_cents) * 100));
  return (
    <section>
      <SectionHeader title="Cost discipline" right={<StreamDot status={streamStatus} />} />
      <StatList
        stats={[
          { label: "this month", value: `${(costs.monthly_cents / 100).toFixed(2)}` },
          {
            label: "ceiling",
            value: `${(costs.monthly_ceiling_cents / 100).toFixed(2)}`,
          },
          {
            label: "remaining",
            value: `${(costs.monthly_remaining_cents / 100).toFixed(2)}`,
          },
          { label: "30d ops", value: String(costs.operation_count) },
        ]}
      />

      <div className="mt-4 h-2 bg-bg-elevated relative">
        <div
          className={`absolute inset-y-0 left-0 ${pct > 90 ? "bg-signal" : pct > 60 ? "bg-amber" : "bg-sage"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-text-faint font-mono text-xs uppercase tracking-widest mt-1">
        {pct}% of monthly ceiling
      </p>

      {costs.by_operation_type.length > 0 && (
        <div className="mt-6">
          <h4 className="text-text-dim font-mono text-xs uppercase tracking-widest mb-2">
            by operation type · last 30d
          </h4>
          <ul className="space-y-1">
            {costs.by_operation_type.map((op) => (
              <li
                key={op.operation_type}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="text-cream font-serif">
                  {op.operation_type.replace(/_/g, " ")}
                </span>
                <span className="text-text-faint font-mono text-xs">
                  {op.count} ops · {(op.cents / 100).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function RoleActivityPanel({ activity }: { activity: RoleActivity | null }) {
  if (!activity) return <Loading label="role activity" />;
  if (activity.window_30d.length === 0) {
    return (
      <section>
        <SectionHeader title="Role activity · last 30d" />
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
          no role invocations yet
        </p>
      </section>
    );
  }
  return (
    <section>
      <SectionHeader
        title="Role activity · last 30d"
        right={
          <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
            {activity.total_invocations} invocations
          </span>
        }
      />
      <table className="w-full text-sm">
        <thead>
          <tr className="text-text-faint font-mono text-xs uppercase tracking-widest border-b border-border-soft">
            <Th align="left">role</Th>
            <Th>total</Th>
            <Th>last 7d</Th>
            <Th>success</Th>
            <Th>error</Th>
            <Th>cost</Th>
            <Th align="right">last run</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-soft">
          {activity.window_30d.map((r) => {
            const errorRate = r.total > 0 ? r.error / r.total : 0;
            const tone = r.error === 0 ? "sage" : errorRate > 0.2 ? "signal" : "amber";
            return (
              <tr key={r.role_name}>
                <td className="py-2 text-cream font-serif">{r.role_name}</td>
                <Td>{r.total}</Td>
                <Td>{r.last_7d}</Td>
                <Td>{r.success}</Td>
                <Td>
                  <Badge tone={tone}>{String(r.error)}</Badge>
                </Td>
                <Td>{(r.total_cost_cents / 100).toFixed(2)}</Td>
                <Td align="right">
                  <span className="text-text-faint font-mono text-xs">
                    {r.last_run_at ? new Date(r.last_run_at).toLocaleString() : "—"}
                  </span>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function CascadeRunsPanel({ runs }: { runs: CascadeRun[] }) {
  if (runs.length === 0) {
    return (
      <section>
        <SectionHeader title="Recent cascades" />
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
          no cascade runs yet
        </p>
      </section>
    );
  }
  return (
    <section>
      <SectionHeader title="Recent cascades" />
      <ol className="divide-y divide-border-soft">
        {runs.map((run) => {
          const tone =
            run.status === "completed"
              ? "sage"
              : run.status === "failed"
                ? "signal"
                : run.status === "running"
                  ? "amber"
                  : "tan";
          return (
            <li key={run.id} className="py-3 flex items-baseline justify-between gap-4">
              <div>
                <p className="text-cream font-serif">
                  cascade · {run.triggered_by.replace(/_/g, " ")}
                </p>
                <p className="text-text-faint font-mono text-xs mt-1">
                  {run.sources_ingested} sources · {run.claims_written} claims ·{" "}
                  {run.questions_generated} questions · {(run.total_cost_cents / 100).toFixed(2)}
                  <span className="ml-2">{new Date(run.started_at).toLocaleString()}</span>
                </p>
              </div>
              <Badge tone={tone}>{run.status}</Badge>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <header className="flex items-baseline justify-between mb-4">
      <h2 className="font-serif text-xl text-cream">{title}</h2>
      {right}
    </header>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className={`py-2 px-2 ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      className={`py-2 px-2 text-text-dim font-mono text-xs ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`}
    >
      {children}
    </td>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <p className="text-text-faint font-mono text-xs uppercase tracking-widest">loading {label}…</p>
  );
}

function StreamDot({
  status,
}: {
  status: ReturnType<typeof useOrchestratorEvents>["status"];
}) {
  const color =
    status === "open"
      ? "bg-sage"
      : status === "connecting"
        ? "bg-amber"
        : status === "error"
          ? "bg-signal"
          : "bg-text-faint";
  return (
    <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-text-faint">
      <span className={`w-2 h-2 rounded-full ${color}`} aria-hidden />
      sse {status}
    </span>
  );
}

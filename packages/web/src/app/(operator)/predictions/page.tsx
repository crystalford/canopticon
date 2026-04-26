"use client";

import { Badge, Card, ScreenHeader, StatList } from "@/components/primitives";
import { ApiError, apiGet } from "@/lib/api-client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface PredictionRow {
  id: string;
  thesis_id: string | null;
  text: string;
  probability: number;
  ipcc_qualifier: string | null;
  resolution_criteria: string;
  resolution_horizon_at: string | null;
  status: string;
  resolved_at: string | null;
  brier_contribution: number | null;
  domain: string | null;
  created_at: string;
}

interface RollingSummary {
  resolved_count: number;
  active_count: number;
  rolling_brier: number | null;
}

const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "all" },
  { key: "active", label: "active" },
  { key: "resolved_correct", label: "correct" },
  { key: "resolved_incorrect", label: "incorrect" },
  { key: "resolved_ambiguous", label: "ambiguous" },
];

export default function PredictionsPage() {
  const [status, setStatus] = useState("all");
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [summary, setSummary] = useState<RollingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    const qs = params.toString() ? `?${params.toString()}` : "";
    apiGet<{ predictions: PredictionRow[]; summary: RollingSummary }>(`/v1/predictions${qs}`)
      .then((res) => {
        setPredictions(res.predictions);
        setSummary(res.summary);
        setLoadError(null);
      })
      .catch((err) => {
        setLoadError(err instanceof ApiError ? err.message : (err as Error).message);
      })
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <ScreenHeader title="Predictions" subtitle="forecasts · rolling Brier · calibration" />

      {summary && (
        <Card className="mb-6">
          <StatList
            stats={[
              { label: "active", value: String(summary.active_count) },
              { label: "resolved", value: String(summary.resolved_count) },
              {
                label: "rolling brier",
                value: summary.rolling_brier !== null ? summary.rolling_brier.toFixed(3) : "—",
              },
            ]}
          />
          <p className="text-text-faint font-mono text-xs mt-3 leading-relaxed">
            lower brier = better-calibrated · 0 is perfect, 0.25 is uninformed, 1 is maximally wrong
          </p>
        </Card>
      )}

      <nav className="mb-6 flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatus(f.key)}
            className={
              status === f.key
                ? "border border-amber text-amber font-mono text-xs uppercase tracking-widest px-3 py-1"
                : "border border-border-soft text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest px-3 py-1"
            }
          >
            {f.label}
          </button>
        ))}
      </nav>

      {loadError && (
        <p className="text-signal font-mono text-xs mb-4">could not load: {loadError}</p>
      )}

      {loading ? (
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">loading...</p>
      ) : predictions.length === 0 ? (
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
          no predictions {status !== "all" ? `with status ${status}` : "yet"}
        </p>
      ) : (
        <ol className="divide-y divide-border-soft">
          {predictions.map((p) => (
            <li key={p.id} className="py-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-cream font-serif">{p.text}</p>
                <span className="text-amber font-mono text-xs uppercase tracking-widest shrink-0">
                  p={Number(p.probability).toFixed(2)}
                </span>
              </div>
              <p className="text-text-dim text-sm mt-1 leading-relaxed">
                resolves: {p.resolution_criteria}
              </p>
              <div className="flex gap-2 mt-2 items-baseline flex-wrap">
                <Badge tone={predictionTone(p.status)}>{p.status.replace(/_/g, " ")}</Badge>
                {p.ipcc_qualifier && (
                  <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
                    {p.ipcc_qualifier.replace(/_/g, " ")}
                  </span>
                )}
                {p.domain && (
                  <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
                    {p.domain}
                  </span>
                )}
                {p.brier_contribution !== null && (
                  <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
                    brier {Number(p.brier_contribution).toFixed(3)}
                  </span>
                )}
                {p.resolution_horizon_at && (
                  <span className="text-text-faint font-mono text-xs">
                    by {new Date(p.resolution_horizon_at).toLocaleDateString()}
                  </span>
                )}
                {p.thesis_id && (
                  <Link
                    href={`/studio/${p.thesis_id}` as never}
                    className="text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest"
                  >
                    → thesis
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function predictionTone(status: string): "amber" | "sage" | "signal" | "neutral" {
  if (status === "resolved_correct") return "sage";
  if (status === "resolved_incorrect") return "signal";
  if (status === "resolved_ambiguous") return "neutral";
  if (status === "active") return "amber";
  return "neutral";
}

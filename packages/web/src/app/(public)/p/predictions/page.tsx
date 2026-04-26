import { Badge, Card, ScreenHeader, StatList } from "@/components/primitives";
import { PublicApiError, publicGet } from "@/lib/public-api";
import Link from "next/link";

interface PublicPrediction {
  id: string;
  thesis_id: string | null;
  thesis_title: string | null;
  thesis_slug: string | null;
  text: string;
  probability: number;
  ipcc_qualifier: string | null;
  resolution_criteria: string;
  resolution_horizon_at: string | null;
  status: string;
  brier_contribution: number | null;
  domain: string | null;
  created_at: string;
}

interface Summary {
  resolved_count: number;
  active_count: number;
  rolling_brier: number | null;
}

export const revalidate = 60;

export default async function PublicPredictionsPage() {
  let predictions: PublicPrediction[] = [];
  let summary: Summary | null = null;
  let error: string | null = null;
  try {
    const res = await publicGet<{ predictions: PublicPrediction[]; summary: Summary }>(
      "/v1/public/predictions",
    );
    predictions = res.predictions;
    summary = res.summary;
  } catch (err) {
    error = err instanceof PublicApiError ? err.message : (err as Error).message;
  }

  return (
    <div className="px-6 py-12 max-w-4xl mx-auto">
      <ScreenHeader
        title="Prediction ledger"
        subtitle="forecasts on public theses · scored against outcomes"
      />

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
            Brier score = mean squared error between forecast probability and outcome. 0 is perfect,
            0.25 is uninformed, 1 is maximally wrong. The ledger is append-only.
          </p>
        </Card>
      )}

      {error && <p className="text-signal font-mono text-xs mb-6">could not load: {error}</p>}

      {predictions.length === 0 ? (
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
          no predictions on public theses yet
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
                {p.thesis_slug && (
                  <Link
                    href={`/p/theses/${p.thesis_slug}`}
                    className="text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest"
                  >
                    → {p.thesis_title}
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

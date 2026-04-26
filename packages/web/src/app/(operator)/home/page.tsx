"use client";

import { Badge, Card, ScreenHeader, StatList } from "@/components/primitives";
import { ApiError, apiGet } from "@/lib/api-client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface ThesisRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  is_public: boolean;
  declared_at: string;
}

interface FindingRow {
  id: string;
  thesis_id: string | null;
  title: string;
  novelty_grade: string;
  pattern_type: string;
  status: string;
  is_public: boolean;
  surfaced_by: string;
  created_at: string;
}

interface PredictionRow {
  id: string;
  text: string;
  probability: number;
  status: string;
  brier_contribution: number | null;
  created_at: string;
}

interface ContradictionRow {
  id: string;
  thesis_id: string | null;
  objection_text: string;
  severity: string;
  status: string;
  created_at: string;
}

interface AssumptionRow {
  id: string;
  thesis_id: string | null;
  text: string;
  status: string;
  is_linchpin: boolean;
  last_audited_at: string | null;
}

interface MentionRow {
  id: string;
  mention_text: string;
}

interface CalibrationLatest {
  id: string;
  output_structured: {
    narrative?: string;
    trend?: string;
    adjustment_advice?: string[];
  } | null;
  started_at: string;
  triggered_by: string;
}

interface PredictionsEnvelope {
  predictions: PredictionRow[];
  summary: {
    resolved_count: number;
    active_count: number;
    rolling_brier: number | null;
  };
}

export default function HomeDashboardPage() {
  const [theses, setTheses] = useState<ThesisRow[]>([]);
  const [findings, setFindings] = useState<FindingRow[]>([]);
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [predictionSummary, setPredictionSummary] = useState<PredictionsEnvelope["summary"] | null>(
    null,
  );
  const [contradictions, setContradictions] = useState<ContradictionRow[]>([]);
  const [shakenAssumptions, setShakenAssumptions] = useState<AssumptionRow[]>([]);
  const [unresolvedMentions, setUnresolvedMentions] = useState<MentionRow[]>([]);
  const [calibration, setCalibration] = useState<CalibrationLatest | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      apiGet<ThesisRow[]>("/v1/theses"),
      apiGet<FindingRow[]>("/v1/findings"),
      apiGet<PredictionsEnvelope>("/v1/predictions"),
      apiGet<ContradictionRow[]>("/v1/claims?limit=1").catch(() => [] as never),
      apiGet<AssumptionRow[]>("/v1/assumptions?linchpin=true"),
      apiGet<MentionRow[]>("/v1/entities/mentions/unresolved"),
      apiGet<CalibrationLatest | null>("/v1/calibration/latest").catch(() => null),
    ])
      .then(([t, f, p, _c, a, m, cal]) => {
        setTheses(t);
        setFindings(f);
        setPredictions(p.predictions);
        setPredictionSummary(p.summary);
        setShakenAssumptions(a.filter((row) => row.status === "shaken" || row.status === "broken"));
        setUnresolvedMentions(m);
        setCalibration(cal);
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : (err as Error).message));

    // Contradictions live under no top-level route yet for the operator;
    // pull via /v1/public if any thesis is public, otherwise leave empty.
    apiGet<ContradictionRow[]>("/v1/public/contradictions")
      .then(setContradictions)
      .catch(() => setContradictions([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const breakthroughCount = findings.filter(
    (f) => f.novelty_grade === "breakthrough" && f.status !== "retracted",
  ).length;
  const draftFindings = findings.filter((f) => f.status === "draft");
  const publicTheses = theses.filter((t) => t.is_public);
  const recentFindings = [...findings]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);
  const activePredictions = predictions.filter((p) => p.status === "active");
  const latestPredictions = [...predictions]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <ScreenHeader
        title="CANOPTICON"
        subtitle={
          <>
            {theses.length} theses ({publicTheses.length} public) · {findings.length} findings (
            {breakthroughCount} breakthrough) · {activePredictions.length} active predictions
          </>
        }
      />

      {loadError && (
        <p className="text-signal font-mono text-xs mb-4">could not load: {loadError}</p>
      )}

      <Card className="mb-6">
        <StatList
          stats={[
            { label: "theses", value: String(theses.length) },
            { label: "findings", value: String(findings.length) },
            {
              label: "rolling brier",
              value:
                predictionSummary?.rolling_brier !== null &&
                predictionSummary?.rolling_brier !== undefined
                  ? predictionSummary.rolling_brier.toFixed(3)
                  : "—",
            },
            { label: "review queue", value: String(unresolvedMentions.length) },
          ]}
        />
      </Card>

      {calibration?.output_structured?.narrative && (
        <Card tone="amber" className="mb-6">
          <p className="font-mono text-xs uppercase tracking-widest text-amber mb-2">
            calibration · {calibration.output_structured.trend?.replace(/_/g, " ") ?? "stable"}
          </p>
          <p className="text-text leading-relaxed">{calibration.output_structured.narrative}</p>
          {calibration.output_structured.adjustment_advice &&
            calibration.output_structured.adjustment_advice.length > 0 && (
              <ul className="mt-3 space-y-1 list-disc list-inside text-text-dim text-sm">
                {calibration.output_structured.adjustment_advice.slice(0, 3).map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <header className="flex items-baseline justify-between mb-3">
            <h2 className="font-serif text-xl text-cream">Recent findings</h2>
            <Link
              href={"/findings" as never}
              className="text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest"
            >
              all →
            </Link>
          </header>
          {recentFindings.length === 0 ? (
            <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
              no findings yet
            </p>
          ) : (
            <ol className="space-y-3">
              {recentFindings.map((f) => (
                <li key={f.id} className="border-l-2 border-amber-dim pl-3 py-1">
                  <Link href={`/findings/${f.id}` as never} className="block group">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-cream font-serif group-hover:text-cream-bright">
                        {f.title}
                      </p>
                      <Badge tone={gradeTone(f.novelty_grade)}>{f.novelty_grade}</Badge>
                    </div>
                    <div className="flex gap-2 mt-1 items-baseline flex-wrap">
                      <Badge tone="neutral">{f.pattern_type.replace(/_/g, " ")}</Badge>
                      <Badge tone={statusTone(f.status)}>{f.status}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <header className="flex items-baseline justify-between mb-3">
            <h2 className="font-serif text-xl text-cream">Latest predictions</h2>
            <Link
              href={"/predictions" as never}
              className="text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest"
            >
              all →
            </Link>
          </header>
          {latestPredictions.length === 0 ? (
            <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
              no predictions yet
            </p>
          ) : (
            <ol className="space-y-3">
              {latestPredictions.map((p) => (
                <li key={p.id} className="border-l-2 border-blue-dim pl-3 py-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-cream font-serif">{p.text}</p>
                    <span className="text-amber font-mono text-xs uppercase tracking-widest shrink-0">
                      p={Number(p.probability).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-1 items-baseline flex-wrap">
                    <Badge tone={predictionTone(p.status)}>{p.status.replace(/_/g, " ")}</Badge>
                    {p.brier_contribution !== null && (
                      <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
                        brier {Number(p.brier_contribution).toFixed(3)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <header className="flex items-baseline justify-between mb-3">
            <h2 className="font-serif text-xl text-cream">Drafts to confirm</h2>
            <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
              {draftFindings.length}
            </span>
          </header>
          {draftFindings.length === 0 ? (
            <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
              nothing waiting · surface findings from a thesis
            </p>
          ) : (
            <ol className="space-y-2">
              {draftFindings.slice(0, 5).map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/findings/${f.id}` as never}
                    className="text-cream font-serif hover:text-amber"
                  >
                    {f.title}
                  </Link>
                  <p className="text-text-faint font-mono text-xs">via {f.surfaced_by}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <header className="flex items-baseline justify-between mb-3">
            <h2 className="font-serif text-xl text-cream">Shaken or broken linchpins</h2>
            <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
              {shakenAssumptions.length}
            </span>
          </header>
          {shakenAssumptions.length === 0 ? (
            <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
              all linchpins holding
            </p>
          ) : (
            <ol className="space-y-2">
              {shakenAssumptions.slice(0, 5).map((a) => (
                <li key={a.id} className="border-l-2 border-signal-dim pl-3 py-1">
                  <div className="flex items-baseline gap-2">
                    <Badge tone={a.status === "broken" ? "signal" : "amber"}>{a.status}</Badge>
                    <p className="text-text font-serif">{a.text}</p>
                  </div>
                  {a.thesis_id && (
                    <Link
                      href={`/studio/${a.thesis_id}` as never}
                      className="text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest"
                    >
                      → thesis
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        {contradictions.length > 0 && (
          <section className="lg:col-span-2">
            <h2 className="font-serif text-xl text-cream mb-3">
              Open contradictions on public theses
            </h2>
            <ol className="space-y-2">
              {contradictions.slice(0, 5).map((c) => (
                <li key={c.id} className="border-l-2 border-signal-dim pl-3 py-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <Badge tone={severityTone(c.severity)}>{c.severity}</Badge>
                    <Badge tone="neutral">{c.status}</Badge>
                  </div>
                  <p className="text-text font-serif mt-1">{c.objection_text}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}

function gradeTone(g: string): "amber" | "sage" | "blue" {
  if (g === "breakthrough") return "amber";
  if (g === "notable") return "blue";
  return "sage";
}

function statusTone(s: string): "amber" | "sage" | "signal" | "neutral" {
  if (s === "public") return "sage";
  if (s === "confirmed") return "amber";
  if (s === "retracted") return "signal";
  return "neutral";
}

function predictionTone(s: string): "amber" | "sage" | "signal" | "neutral" {
  if (s === "resolved_correct") return "sage";
  if (s === "resolved_incorrect") return "signal";
  if (s === "resolved_ambiguous") return "neutral";
  if (s === "active") return "amber";
  return "neutral";
}

function severityTone(s: string): "amber" | "signal" | "neutral" {
  if (s === "major") return "signal";
  if (s === "notable") return "amber";
  return "neutral";
}

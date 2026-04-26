"use client";

import { Badge, ScreenHeader } from "@/components/primitives";
import { ApiError, apiGet } from "@/lib/api-client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface FindingRow {
  id: string;
  thesis_id: string | null;
  title: string;
  slug: string;
  narrative: string;
  novelty_grade: "incremental" | "notable" | "breakthrough";
  pattern_type: string;
  confidence: number | null;
  status: string;
  is_public: boolean;
  surfaced_by: string;
  created_at: string;
}

const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "all" },
  { key: "draft", label: "draft" },
  { key: "confirmed", label: "confirmed" },
  { key: "public", label: "public" },
  { key: "retracted", label: "retracted" },
];

const GRADE_FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "all grades" },
  { key: "incremental", label: "incremental" },
  { key: "notable", label: "notable" },
  { key: "breakthrough", label: "breakthrough" },
];

export default function FindingsPage() {
  const [rows, setRows] = useState<FindingRow[]>([]);
  const [status, setStatus] = useState("all");
  const [grade, setGrade] = useState("all");
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (grade !== "all") params.set("novelty_grade", grade);
    const qs = params.toString() ? `?${params.toString()}` : "";
    apiGet<FindingRow[]>(`/v1/findings${qs}`)
      .then(setRows)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : (err as Error).message));
  }, [status, grade]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <ScreenHeader title="Findings" subtitle="patterns · novelty · breakthroughs" />
      <p className="text-text-faint font-mono text-xs mb-6 leading-relaxed">
        each finding names a structural pattern in the substrate · draft → confirmed → public · the
        breakthrough grade requires linchpin claims and operator confirmation
      </p>

      <nav className="mb-3 flex gap-2 flex-wrap">
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
      <nav className="mb-6 flex gap-2 flex-wrap">
        {GRADE_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setGrade(f.key)}
            className={
              grade === f.key
                ? "border border-blue text-blue font-mono text-xs uppercase tracking-widest px-3 py-1"
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

      {rows.length === 0 ? (
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
          no findings match these filters · surface them from a thesis
        </p>
      ) : (
        <ol className="divide-y divide-border-soft">
          {rows.map((f) => (
            <li key={f.id} className="py-4">
              <Link href={`/findings/${f.id}` as never} className="block group">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-cream font-serif text-lg group-hover:text-cream-bright">
                    {f.title}
                  </p>
                  <Badge tone={gradeTone(f.novelty_grade)}>{f.novelty_grade}</Badge>
                </div>
                <p className="text-text-dim text-sm mt-1 leading-relaxed">{f.narrative}</p>
                <div className="flex gap-2 mt-2 items-baseline flex-wrap">
                  <Badge tone="neutral">{f.pattern_type.replace(/_/g, " ")}</Badge>
                  <Badge tone={statusTone(f.status)}>{f.status}</Badge>
                  {f.is_public && <Badge tone="amber">public</Badge>}
                  {f.confidence !== null && (
                    <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
                      confidence {Number(f.confidence).toFixed(2)}
                    </span>
                  )}
                  <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
                    via {f.surfaced_by}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function gradeTone(g: string): "amber" | "sage" | "blue" | "signal" {
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

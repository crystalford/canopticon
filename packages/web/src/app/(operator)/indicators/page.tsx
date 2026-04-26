"use client";

import { Badge, ScreenHeader } from "@/components/primitives";
import { ApiError, apiGet } from "@/lib/api-client";
import Link from "next/link";
import { useEffect, useState } from "react";

interface IndicatorRow {
  id: string;
  thesis_id: string | null;
  name: string;
  definition: string;
  source_uri: string | null;
  cadence: string | null;
  is_active: boolean;
  created_at: string;
}

export default function IndicatorsPage() {
  const [rows, setRows] = useState<IndicatorRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeOnly, setActiveOnly] = useState(true);

  useEffect(() => {
    const qs = activeOnly ? "?active=true" : "";
    apiGet<IndicatorRow[]>(`/v1/indicators${qs}`)
      .then(setRows)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : (err as Error).message));
  }, [activeOnly]);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <ScreenHeader title="Indicators" subtitle="signals · cadence · thresholds" />

      <nav className="mb-6 flex gap-2">
        <button
          type="button"
          onClick={() => setActiveOnly(true)}
          className={
            activeOnly
              ? "border border-amber text-amber font-mono text-xs uppercase tracking-widest px-3 py-1"
              : "border border-border-soft text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest px-3 py-1"
          }
        >
          active
        </button>
        <button
          type="button"
          onClick={() => setActiveOnly(false)}
          className={
            !activeOnly
              ? "border border-amber text-amber font-mono text-xs uppercase tracking-widest px-3 py-1"
              : "border border-border-soft text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest px-3 py-1"
          }
        >
          all
        </button>
      </nav>

      {loadError && (
        <p className="text-signal font-mono text-xs mb-4">could not load: {loadError}</p>
      )}

      {rows.length === 0 ? (
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
          no indicators · declare them from a thesis page
        </p>
      ) : (
        <ol className="divide-y divide-border-soft">
          {rows.map((i) => (
            <li key={i.id} className="py-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-cream font-serif">{i.name}</p>
                <Badge tone={i.is_active ? "amber" : "neutral"}>
                  {i.is_active ? "active" : "inactive"}
                </Badge>
              </div>
              <p className="text-text-dim text-sm mt-1 leading-relaxed">{i.definition}</p>
              <div className="flex gap-2 mt-2 items-baseline flex-wrap">
                {i.cadence && (
                  <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
                    {i.cadence}
                  </span>
                )}
                {i.source_uri && (
                  <a
                    href={i.source_uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest"
                  >
                    source
                  </a>
                )}
                {i.thesis_id && (
                  <Link
                    href={`/studio/${i.thesis_id}` as never}
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

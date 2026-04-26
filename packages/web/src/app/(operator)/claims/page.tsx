"use client";

import { Badge, ScreenHeader } from "@/components/primitives";
import { useOrchestratorEvents } from "@/hooks/use-orchestrator-events";
import { ApiError, apiGet } from "@/lib/api-client";
import Link from "next/link";
import { useEffect, useState } from "react";

interface ClaimRow {
  id: string;
  layer: string;
  admiralty_grade: string;
  verification_status: string;
  is_linchpin: boolean;
  slug: string | null;
  created_at: string;
}

const LAYER_FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "all" },
  { key: "factual", label: "factual" },
  { key: "framing", label: "framing" },
  { key: "architectural", label: "architectural" },
  { key: "distributive", label: "distributive" },
];

const VERIFICATION_FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "any" },
  { key: "unverified", label: "unverified" },
  { key: "grounded", label: "grounded" },
  { key: "partial", label: "partial" },
  { key: "unsupported", label: "unsupported" },
  { key: "contradicted", label: "contradicted" },
];

export default function ClaimsPage() {
  const [layer, setLayer] = useState("all");
  const [verification, setVerification] = useState("all");
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { events } = useOrchestratorEvents({
    filter: ["claim.created", "claim.updated"],
    bufferSize: 50,
  });
  const tick = events.length;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void tick;
    const params = new URLSearchParams({ limit: "100" });
    if (layer !== "all") params.set("layer", layer);
    if (verification !== "all") params.set("verification_status", verification);
    apiGet<ClaimRow[]>(`/v1/claims?${params.toString()}`)
      .then((data) => {
        if (!cancelled) {
          setClaims(data);
          setLoadError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : (err as Error).message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [layer, verification, tick]);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <ScreenHeader title="Claims" subtitle="extracted from approved sources" />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <FilterRow label="layer" options={LAYER_FILTERS} value={layer} onChange={setLayer} />
        <FilterRow
          label="verification"
          options={VERIFICATION_FILTERS}
          value={verification}
          onChange={setVerification}
        />
      </div>

      {loadError && (
        <p className="text-signal font-mono text-xs mb-4">could not load: {loadError}</p>
      )}

      {loading ? (
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">loading...</p>
      ) : claims.length === 0 ? (
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
          no claims at these filters
        </p>
      ) : (
        <ul className="divide-y divide-border-soft">
          {claims.map((claim) => (
            <li key={claim.id} className="py-4">
              <ClaimRow claim={claim} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ key: string; label: string }>;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <p className="text-text-faint font-mono text-xs uppercase tracking-widest mb-2">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`px-2 py-1 font-mono text-xs uppercase tracking-widest border ${
              value === opt.key
                ? "border-amber text-amber"
                : "border-border-soft text-text-dim hover:border-border-bright hover:text-cream"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ClaimRow({ claim }: { claim: ClaimRow }) {
  return (
    <Link
      href={`/claims/${claim.id}` as never}
      className="grid gap-2 sm:grid-cols-[auto_auto_1fr_auto] sm:items-baseline group"
    >
      <GradeBadge grade={claim.admiralty_grade} />
      <Badge tone="cream" variant="outline">
        {claim.layer}
      </Badge>
      <div>
        <p className="text-cream font-serif group-hover:text-cream-bright">
          claim {claim.id.slice(0, 8)}
        </p>
        <p className="text-text-faint font-mono text-xs mt-1">
          created {new Date(claim.created_at).toLocaleString()}
          {claim.is_linchpin && (
            <span className="text-signal ml-2 uppercase tracking-widest">· linchpin</span>
          )}
        </p>
      </div>
      <VerificationBadge status={claim.verification_status} />
    </Link>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const tone = grade === "A" ? "amber" : grade === "B" ? "tan" : "neutral";
  return (
    <Badge tone={tone} variant="solid" className="w-7 justify-center">
      {grade}
    </Badge>
  );
}

function VerificationBadge({ status }: { status: string }) {
  const tone =
    status === "grounded"
      ? "sage"
      : status === "contradicted"
        ? "signal"
        : status === "unsupported"
          ? "signal"
          : status === "partial"
            ? "amber"
            : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}

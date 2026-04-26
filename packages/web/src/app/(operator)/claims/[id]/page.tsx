"use client";

import { Badge, Card, ScreenHeader } from "@/components/primitives";
import { ApiError, apiGet, apiPost } from "@/lib/api-client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

interface ClaimVersion {
  id: string;
  version_number?: number;
  data?: string;
  claim_text?: string;
  warrant?: string | null;
  qualifier?: string | null;
  rebuttal?: string | null;
  primary_source_id?: string;
  written_by_role?: string | null;
  change_summary?: string | null;
  created_at?: string;
}

interface ClaimDetail {
  id: string;
  layer: string;
  admiralty_grade: string;
  verification_status: string;
  is_linchpin?: boolean;
  is_archived?: boolean;
  current_version_id: string | null;
  current?: ClaimVersion | null;
  created_at: string;
  updated_at: string;
}

export default function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<ClaimDetail>(`/v1/claims/${id}`)
      .then(setClaim)
      .catch((err) => setError(err instanceof ApiError ? err.message : (err as Error).message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function verify() {
    setVerifying(true);
    setVerifyError(null);
    try {
      await apiPost(`/v1/claims/${id}/verify`, {});
      load();
    } catch (err) {
      setVerifyError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  if (error) {
    return (
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <BackLink />
        <p className="text-signal font-mono text-xs mt-6">could not load: {error}</p>
      </div>
    );
  }
  if (!claim) {
    return (
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">loading...</p>
      </div>
    );
  }

  const v = claim.current ?? null;

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <BackLink />

      <ScreenHeader
        title="Claim"
        subtitle={
          <>
            {claim.layer} · grade {claim.admiralty_grade} · {claim.verification_status}
            {v?.version_number ? ` · v${v.version_number}` : ""}
          </>
        }
      />

      <Card className="mb-6">
        <div className="flex items-baseline gap-2 flex-wrap mb-3">
          <Badge tone={claim.admiralty_grade === "A" ? "amber" : "tan"} variant="solid">
            grade {claim.admiralty_grade}
          </Badge>
          <Badge tone={verificationTone(claim.verification_status)}>
            {claim.verification_status}
          </Badge>
          <Badge tone="neutral">{claim.layer}</Badge>
          {claim.is_linchpin && <Badge tone="amber">linchpin</Badge>}
        </div>
        {v?.claim_text ? (
          <p className="text-cream-bright font-serif text-lg leading-relaxed mb-3">
            {v.claim_text}
          </p>
        ) : (
          <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
            no current version
          </p>
        )}
        {v?.data && (
          <div className="mb-3">
            <p className="font-mono text-xs uppercase tracking-widest text-text-dim mb-1">data</p>
            <p className="text-text leading-relaxed">{v.data}</p>
          </div>
        )}
        {v?.warrant && (
          <div className="mb-3">
            <p className="font-mono text-xs uppercase tracking-widest text-text-dim mb-1">
              warrant
            </p>
            <p className="text-text leading-relaxed">{v.warrant}</p>
          </div>
        )}
        {v?.qualifier && (
          <div className="mb-3">
            <p className="font-mono text-xs uppercase tracking-widest text-text-dim mb-1">
              qualifier
            </p>
            <p className="text-text leading-relaxed">{v.qualifier}</p>
          </div>
        )}
        {v?.rebuttal && (
          <div className="mb-3">
            <p className="font-mono text-xs uppercase tracking-widest text-text-dim mb-1">
              rebuttal
            </p>
            <p className="text-text leading-relaxed">{v.rebuttal}</p>
          </div>
        )}
        {v?.written_by_role && (
          <p className="text-text-faint font-mono text-xs uppercase tracking-widest mt-3">
            written by {v.written_by_role}
            {v.change_summary ? ` · ${v.change_summary}` : ""}
          </p>
        )}
      </Card>

      {claim.verification_status === "unverified" && v?.primary_source_id && (
        <section className="mb-6">
          <button
            type="button"
            onClick={verify}
            disabled={verifying}
            className="border border-amber text-amber font-mono text-xs uppercase tracking-widest px-3 py-1 hover:bg-amber hover:text-bg disabled:opacity-50"
          >
            {verifying ? "verifying..." : "run verifier"}
          </button>
          {verifyError && <p className="text-signal font-mono text-xs mt-2">{verifyError}</p>}
        </section>
      )}

      {v?.primary_source_id && (
        <p className="text-text-faint font-mono text-xs">
          primary source →{" "}
          <Link
            href={`/sources/${v.primary_source_id}` as never}
            className="text-text-dim hover:text-amber"
          >
            {v.primary_source_id.slice(0, 8)}
          </Link>
        </p>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href={"/claims" as never}
      className="text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest"
    >
      ← all claims
    </Link>
  );
}

function verificationTone(s: string): "amber" | "sage" | "signal" | "neutral" {
  if (s === "grounded") return "sage";
  if (s === "contradicted" || s === "unsupported") return "signal";
  if (s === "partial") return "amber";
  return "neutral";
}

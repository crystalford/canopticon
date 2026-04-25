"use client";

import { Badge, Button, Card, FieldError, Label, ScreenHeader } from "@/components/primitives";
import { ApiError, apiGet, apiPost } from "@/lib/api-client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

interface ThesisDetail {
  id: string;
  title: string;
  slug: string;
  status: string;
  cynefin_domain: string | null;
  is_public: boolean;
  declared_at: string;
  current_version: {
    id: string;
    version_number: number;
    seed_paragraph: string;
    bluf: string | null;
    tier_80: string | null;
    tier_800: string | null;
    tier_full: string | null;
    ipcc_likelihood: string | null;
    change_summary: string | null;
    created_at: string;
  } | null;
}

interface IntegratedClaim {
  id: string;
  layer: string;
  admiralty_grade: string;
  verification_status: string;
  claim_text: string;
  added_at: string | null;
}

interface ThesisQuestion {
  id: string;
  text: string;
  rationale: string | null;
  evidence_targets: string[];
  expected_information_gain: number;
  status: string;
  generated_by: string;
  created_at: string;
}

interface CandidateClaim {
  id: string;
  layer: string;
  admiralty_grade: string;
  verification_status: string;
}

const LAYERS = ["factual", "framing", "architectural", "distributive"] as const;

export default function ThesisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [thesis, setThesis] = useState<ThesisDetail | null>(null);
  const [claims, setClaims] = useState<IntegratedClaim[]>([]);
  const [questions, setQuestions] = useState<ThesisQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      apiGet<ThesisDetail>(`/v1/theses/${id}`),
      apiGet<IntegratedClaim[]>(`/v1/theses/${id}/claims`),
      apiGet<ThesisQuestion[]>(`/v1/theses/${id}/questions`),
    ])
      .then(([t, c, q]) => {
        setThesis(t);
        setClaims(c);
        setQuestions(q);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : (err as Error).message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setActing("interrogate");
    setActionError(null);
    try {
      await apiPost(`/v1/theses/${id}/interrogate`, {});
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setActing(null);
    }
  }

  async function publish() {
    setActing("publish");
    setActionError(null);
    try {
      await apiPost(`/v1/theses/${id}/publish`, {});
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setActing(null);
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

  if (!thesis) {
    return (
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">loading...</p>
      </div>
    );
  }

  const v = thesis.current_version;
  const claimsByLayer = groupBy(claims, (c) => c.layer);

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <BackLink />

      <ScreenHeader
        title={thesis.title}
        subtitle={
          <>
            {thesis.slug}
            {thesis.cynefin_domain ? ` · ${thesis.cynefin_domain}` : ""} · status {thesis.status}
            {v ? ` · v${v.version_number}` : ""}
            {thesis.is_public ? " · public" : ""}
          </>
        }
        actions={
          <div className="flex gap-2">
            <Button
              tone="secondary"
              size="sm"
              onClick={generate}
              disabled={acting === "interrogate"}
            >
              {acting === "interrogate" ? "..." : "generate questions"}
            </Button>
            {!thesis.is_public && (
              <Button tone="primary" size="sm" onClick={publish} disabled={acting === "publish"}>
                {acting === "publish" ? "..." : "publish"}
              </Button>
            )}
          </div>
        }
      />

      {actionError && <p className="text-signal font-mono text-xs mb-4">{actionError}</p>}

      {v?.bluf && (
        <Card tone="amber" className="mb-6">
          <p className="font-mono text-xs uppercase tracking-widest text-amber mb-2">BLUF</p>
          <p className="text-cream-bright font-serif text-lg leading-relaxed">{v.bluf}</p>
          {v.ipcc_likelihood && (
            <p className="text-text-faint font-mono text-xs mt-2 uppercase tracking-widest">
              {v.ipcc_likelihood.replace(/_/g, " ")}
            </p>
          )}
        </Card>
      )}

      <section className="mb-8">
        <h2 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-2">
          seed paragraph
        </h2>
        <p className="text-text leading-relaxed">{v?.seed_paragraph ?? "—"}</p>
      </section>

      {(v?.tier_80 || v?.tier_800) && (
        <section className="mb-8 grid gap-4 sm:grid-cols-2">
          {v.tier_80 && (
            <div>
              <h2 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-2">
                80-word
              </h2>
              <p className="text-text leading-relaxed">{v.tier_80}</p>
            </div>
          )}
          {v.tier_800 && (
            <div>
              <h2 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-2">
                800-word
              </h2>
              <p className="text-text leading-relaxed text-sm">{v.tier_800.slice(0, 1000)}…</p>
            </div>
          )}
        </section>
      )}

      <section className="mb-8">
        <header className="flex items-baseline justify-between mb-3">
          <h2 className="font-serif text-xl text-cream">Claims</h2>
          <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
            {claims.length} integrated
          </span>
        </header>
        {claims.length === 0 ? (
          <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
            no claims integrated · use the integrate panel below
          </p>
        ) : (
          <div className="space-y-4">
            {LAYERS.map((layer) => {
              const layerClaims = claimsByLayer[layer] ?? [];
              if (layerClaims.length === 0) return null;
              return (
                <div key={layer}>
                  <h3 className="font-mono text-xs uppercase tracking-widest text-amber mb-2">
                    {layer}
                  </h3>
                  <ul className="space-y-2">
                    {layerClaims.map((c) => (
                      <li
                        key={c.id}
                        className="border-l-2 border-amber-dim pl-3 py-1 grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-baseline"
                      >
                        <Badge
                          tone={c.admiralty_grade === "A" ? "amber" : "tan"}
                          variant="solid"
                          className="w-7 justify-center"
                        >
                          {c.admiralty_grade}
                        </Badge>
                        <p className="text-text font-serif">{c.claim_text}</p>
                        <Badge tone={verificationTone(c.verification_status)}>
                          {c.verification_status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <IntegratePanel
        thesisId={thesis.id}
        integratedIds={claims.map((c) => c.id)}
        onIntegrated={load}
      />

      <section className="mt-10">
        <header className="flex items-baseline justify-between mb-3">
          <h2 className="font-serif text-xl text-cream">Questions</h2>
          <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
            {questions.length} open
          </span>
        </header>
        {questions.length === 0 ? (
          <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
            no questions yet · use generate questions above
          </p>
        ) : (
          <ol className="space-y-3">
            {questions.map((q) => (
              <li key={q.id} className="border-b border-border-soft pb-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-text font-serif">{q.text}</p>
                  <span className="text-amber font-mono text-xs uppercase tracking-widest shrink-0">
                    EIG {q.expected_information_gain.toFixed(2)}
                  </span>
                </div>
                {q.rationale && (
                  <p className="text-text-dim text-sm mt-1 leading-relaxed">{q.rationale}</p>
                )}
                {q.evidence_targets.length > 0 && (
                  <p className="text-text-faint font-mono text-xs mt-1">
                    evidence: {q.evidence_targets.join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function IntegratePanel({
  thesisId,
  integratedIds,
  onIntegrated,
}: {
  thesisId: string;
  integratedIds: string[];
  onIntegrated: () => void;
}) {
  const [candidates, setCandidates] = useState<CandidateClaim[]>([]);
  const [layer, setLayer] = useState<string>("factual");
  const [picked, setPicked] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiGet<CandidateClaim[]>("/v1/claims?limit=100")
      .then(setCandidates)
      .catch(() => {});
  }, []);

  const filtered = candidates.filter((c) => !integratedIds.includes(c.id));

  async function integrate() {
    if (!picked) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/v1/theses/${thesisId}/claims`, { claim_id: picked, layer });
      setPicked("");
      onIntegrated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-6 border-t border-border-soft pt-6">
      <h2 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-3">
        integrate claim
      </h2>
      {filtered.length === 0 ? (
        <p className="text-text-faint font-mono text-xs">
          no available claims to integrate · run a research mission to extract more
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div>
            <Label htmlFor="claim-pick">claim</Label>
            <select
              id="claim-pick"
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
              className="block w-full bg-bg-elevated border border-border-bright text-text px-3 py-2 font-mono text-xs focus:border-amber focus:outline-none"
            >
              <option value="">— select claim —</option>
              {filtered.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id.slice(0, 8)} · {c.layer} · grade {c.admiralty_grade} ·{" "}
                  {c.verification_status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="layer-pick">layer</Label>
            <select
              id="layer-pick"
              value={layer}
              onChange={(e) => setLayer(e.target.value)}
              className="block bg-bg-elevated border border-border-bright text-text px-3 py-2 font-mono text-xs focus:border-amber focus:outline-none"
            >
              {LAYERS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <Button tone="primary" onClick={integrate} disabled={submitting || !picked}>
            {submitting ? "..." : "integrate"}
          </Button>
        </div>
      )}
      <FieldError message={error} />
    </section>
  );
}

function BackLink() {
  return (
    <Link
      href={"/studio" as never}
      className="text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest"
    >
      ← back to studio
    </Link>
  );
}

function verificationTone(s: string): "amber" | "sage" | "signal" | "neutral" {
  if (s === "grounded") return "sage";
  if (s === "contradicted" || s === "unsupported") return "signal";
  if (s === "partial") return "amber";
  return "neutral";
}

function groupBy<T, K extends string>(arr: T[], key: (t: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of arr) {
    const k = key(item);
    out[k] = out[k] ?? [];
    out[k].push(item);
  }
  return out;
}

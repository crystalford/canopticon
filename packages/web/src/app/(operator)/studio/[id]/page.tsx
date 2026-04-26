"use client";

import {
  Badge,
  Button,
  Card,
  FieldError,
  Input,
  Label,
  ScreenHeader,
  Textarea,
} from "@/components/primitives";
import { ApiError, apiGet, apiPost } from "@/lib/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

interface ThesisPrediction {
  id: string;
  text: string;
  probability: number;
  ipcc_qualifier: string | null;
  resolution_criteria: string;
  resolution_horizon_at: string | null;
  status: string;
  brier_contribution: number | null;
  created_at: string;
}

interface ThesisArticle {
  id: string;
  title: string;
  slug: string;
  status: string;
  is_public: boolean;
  updated_at: string;
}

const LAYERS = ["factual", "framing", "architectural", "distributive"] as const;
const IPCC_OPTIONS = [
  ["", "—"],
  ["virtually_certain", "virtually certain (>99%)"],
  ["extremely_likely", "extremely likely (>95%)"],
  ["very_likely", "very likely (>90%)"],
  ["likely", "likely (>66%)"],
  ["more_likely_than_not", "more likely than not (>50%)"],
  ["about_as_likely_as_not", "about as likely as not (33–66%)"],
  ["unlikely", "unlikely (<33%)"],
  ["very_unlikely", "very unlikely (<10%)"],
  ["extremely_unlikely", "extremely unlikely (<5%)"],
  ["exceptionally_unlikely", "exceptionally unlikely (<1%)"],
] as const;

export default function ThesisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [thesis, setThesis] = useState<ThesisDetail | null>(null);
  const [claims, setClaims] = useState<IntegratedClaim[]>([]);
  const [questions, setQuestions] = useState<ThesisQuestion[]>([]);
  const [predictions, setPredictions] = useState<ThesisPrediction[]>([]);
  const [articles, setArticles] = useState<ThesisArticle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      apiGet<ThesisDetail>(`/v1/theses/${id}`),
      apiGet<IntegratedClaim[]>(`/v1/theses/${id}/claims`),
      apiGet<ThesisQuestion[]>(`/v1/theses/${id}/questions`),
      apiGet<{ predictions: ThesisPrediction[] }>(`/v1/predictions?thesis_id=${id}`),
      apiGet<ThesisArticle[]>(`/v1/articles?thesis_id=${id}`),
    ])
      .then(([t, c, q, p, a]) => {
        setThesis(t);
        setClaims(c);
        setQuestions(q);
        setPredictions(p.predictions);
        setArticles(a);
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
          <h2 className="font-serif text-xl text-cream">Predictions</h2>
          <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
            {predictions.filter((p) => p.status === "active").length} active ·{" "}
            {predictions.filter((p) => p.status.startsWith("resolved")).length} resolved
          </span>
        </header>
        {predictions.length === 0 ? (
          <p className="text-text-faint font-mono text-xs uppercase tracking-widest mb-4">
            no predictions yet · declare one below
          </p>
        ) : (
          <ul className="space-y-3 mb-6">
            {predictions.map((p) => (
              <li key={p.id} className="border-b border-border-soft pb-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-text font-serif">{p.text}</p>
                  <span className="text-amber font-mono text-xs uppercase tracking-widest shrink-0">
                    p={Number(p.probability).toFixed(2)}
                  </span>
                </div>
                <p className="text-text-dim text-sm mt-1 leading-relaxed">
                  resolves: {p.resolution_criteria}
                </p>
                <div className="flex gap-2 mt-2 items-baseline">
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
                </div>
                {p.status === "active" && <ResolveControls predictionId={p.id} onResolved={load} />}
              </li>
            ))}
          </ul>
        )}
        <DeclarePredictionPanel thesisId={id} onDeclared={load} />
      </section>

      <section className="mt-10">
        <header className="flex items-baseline justify-between mb-3">
          <h2 className="font-serif text-xl text-cream">Articles</h2>
          <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
            {articles.length} drafted · {articles.filter((a) => a.is_public).length} public
          </span>
        </header>
        {articles.length === 0 ? (
          <p className="text-text-faint font-mono text-xs uppercase tracking-widest mb-4">
            no articles yet · draft one below
          </p>
        ) : (
          <ul className="space-y-2 mb-6">
            {articles.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/studio/articles/${a.id}` as never}
                  className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-baseline hover:bg-bg-subtle -mx-2 px-2 py-1"
                >
                  <p className="text-cream font-serif">{a.title}</p>
                  {a.is_public && <Badge tone="amber">public</Badge>}
                  <Badge tone={articleTone(a.status)}>{a.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <DraftArticlePanel thesisId={id} thesisTitle={thesis.title} thesisSlug={thesis.slug} />
      </section>

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

function DeclarePredictionPanel({
  thesisId,
  onDeclared,
}: {
  thesisId: string;
  onDeclared: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [probability, setProbability] = useState("0.6");
  const [ipcc, setIpcc] = useState("");
  const [criteria, setCriteria] = useState("");
  const [horizon, setHorizon] = useState("");
  const [domain, setDomain] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [premortem, setPremortem] = useState<{
    failure_modes: Array<{
      narrative: string;
      conditional_probability: number;
      linchpin_assumption: string | null;
    }>;
    calibration_note: string;
    recommended_probability: number | null;
    summary: string;
  } | null>(null);

  async function declare(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setPremortem(null);
    try {
      const p = Number(probability);
      if (!(p >= 0 && p <= 1)) {
        throw new Error("probability must be between 0 and 1");
      }
      const body: Record<string, unknown> = {
        thesis_id: thesisId,
        text: text.trim(),
        probability: p,
        resolution_criteria: criteria.trim(),
      };
      if (ipcc) body.ipcc_qualifier = ipcc;
      if (horizon) body.resolution_horizon_at = new Date(horizon).toISOString();
      if (domain) body.domain = domain.trim();

      const result = await apiPost<{
        id: string;
        premortem: {
          failure_modes: Array<{
            narrative: string;
            conditional_probability: number;
            linchpin_assumption: string | null;
          }>;
          calibration_note: string;
          recommended_probability: number | null;
          summary: string;
        };
      }>("/v1/predictions", body);
      setPremortem(result.premortem);
      setText("");
      setCriteria("");
      setHorizon("");
      onDeclared();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button tone="secondary" size="sm" onClick={() => setOpen(true)}>
        + declare prediction
      </Button>
    );
  }

  return (
    <Card tone="amber">
      <form onSubmit={declare} className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="font-serif text-lg text-amber">Declare prediction</h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest"
          >
            cancel
          </button>
        </div>
        <p className="text-text-faint font-mono text-xs leading-relaxed">
          fires Premortem against the proposed forecast before commit · linchpin failure-mode
          assumptions land in the assumptions ledger
        </p>
        <div>
          <Label htmlFor="pred-text">forecast</Label>
          <Textarea
            id="pred-text"
            required
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Carney announces a beneficial-ownership disclosure regime for federal contractors before the next election."
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="pred-prob">probability (0–1)</Label>
            <Input
              id="pred-prob"
              required
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={probability}
              onChange={(e) => setProbability(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pred-ipcc">IPCC qualifier</Label>
            <select
              id="pred-ipcc"
              value={ipcc}
              onChange={(e) => setIpcc(e.target.value)}
              className="block w-full bg-bg-elevated border border-border-bright text-text px-3 py-2 font-mono text-sm focus:border-amber focus:outline-none"
            >
              {IPCC_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <Label htmlFor="pred-criteria">resolution criteria</Label>
          <Textarea
            id="pred-criteria"
            required
            rows={2}
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
            placeholder="Resolves YES if a federal regulation, statute, or order-in-council is published in Canada Gazette Part II creating mandatory beneficial-ownership disclosure for federal contractors."
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="pred-horizon">resolution horizon (optional)</Label>
            <Input
              id="pred-horizon"
              type="date"
              value={horizon}
              onChange={(e) => setHorizon(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pred-domain">domain (optional)</Label>
            <Input
              id="pred-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="federal regulation"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" tone="primary" disabled={submitting}>
            {submitting ? "running premortem..." : "declare"}
          </Button>
        </div>
        <FieldError message={error} />
      </form>

      {premortem && (
        <div className="mt-6 border-t border-border-soft pt-4">
          <h4 className="font-mono text-xs uppercase tracking-widest text-amber mb-2">
            premortem · {premortem.calibration_note.replace(/_/g, " ")}
            {premortem.recommended_probability !== null
              ? ` · recommended p=${premortem.recommended_probability.toFixed(2)}`
              : ""}
          </h4>
          {premortem.summary && (
            <p className="text-text leading-relaxed text-sm mb-3">{premortem.summary}</p>
          )}
          <ol className="space-y-2">
            {premortem.failure_modes.map((fm) => (
              <li key={fm.narrative} className="border-l-2 border-amber-dim pl-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-text font-serif text-sm">{fm.narrative}</p>
                  <span className="text-text-faint font-mono text-xs shrink-0">
                    {(fm.conditional_probability * 100).toFixed(0)}%
                  </span>
                </div>
                {fm.linchpin_assumption && (
                  <p className="text-text-dim font-mono text-xs mt-1">
                    linchpin: {fm.linchpin_assumption}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}

function ResolveControls({
  predictionId,
  onResolved,
}: {
  predictionId: string;
  onResolved: () => void;
}) {
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(outcome: "correct" | "incorrect" | "ambiguous") {
    setSubmitting(outcome);
    setError(null);
    try {
      await apiPost(`/v1/predictions/${predictionId}/resolve`, { outcome });
      onResolved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="mt-2 flex gap-2 items-baseline">
      <span className="text-text-faint font-mono text-xs uppercase tracking-widest">resolve:</span>
      <button
        type="button"
        onClick={() => resolve("correct")}
        disabled={submitting !== null}
        className="text-sage hover:text-cream-bright font-mono text-xs uppercase tracking-widest disabled:opacity-50"
      >
        {submitting === "correct" ? "..." : "correct"}
      </button>
      <button
        type="button"
        onClick={() => resolve("incorrect")}
        disabled={submitting !== null}
        className="text-signal hover:text-cream-bright font-mono text-xs uppercase tracking-widest disabled:opacity-50"
      >
        {submitting === "incorrect" ? "..." : "incorrect"}
      </button>
      <button
        type="button"
        onClick={() => resolve("ambiguous")}
        disabled={submitting !== null}
        className="text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest disabled:opacity-50"
      >
        {submitting === "ambiguous" ? "..." : "ambiguous"}
      </button>
      {error && <span className="text-signal font-mono text-xs">{error}</span>}
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

function articleTone(status: string): "amber" | "sage" | "signal" | "neutral" {
  if (status === "published") return "sage";
  if (status === "corrected") return "amber";
  if (status === "retracted") return "signal";
  return "neutral";
}

function DraftArticlePanel({
  thesisId,
  thesisTitle,
  thesisSlug,
}: {
  thesisId: string;
  thesisTitle: string;
  thesisSlug: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(thesisTitle);
  const [slug, setSlug] = useState(`${thesisSlug}-essay`);
  const [body, setBody] = useState("");
  const [bluf, setBluf] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function draft(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiPost<{ id: string }>("/v1/articles", {
        thesis_id: thesisId,
        title: title.trim(),
        slug: slug.trim(),
        body: body.trim(),
        ...(bluf ? { bluf: bluf.trim() } : {}),
      });
      router.push(`/studio/articles/${result.id}` as never);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button tone="secondary" size="sm" onClick={() => setOpen(true)}>
        + draft article
      </Button>
    );
  }

  return (
    <Card tone="amber">
      <form onSubmit={draft} className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="font-serif text-lg text-amber">Draft article</h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest"
          >
            cancel
          </button>
        </div>
        <p className="text-text-faint font-mono text-xs leading-relaxed">
          creates a new draft article scoped to this thesis · you can cite claims, version-edit, and
          publish from the article workspace
        </p>
        <div>
          <Label htmlFor="art-title">title</Label>
          <Input id="art-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="art-slug">slug</Label>
          <Input
            id="art-slug"
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          />
        </div>
        <div>
          <Label htmlFor="art-bluf">BLUF (optional)</Label>
          <Textarea
            id="art-bluf"
            rows={2}
            value={bluf}
            onChange={(e) => setBluf(e.target.value)}
            placeholder="One-sentence claim of the article."
          />
        </div>
        <div>
          <Label htmlFor="art-body">body</Label>
          <Textarea
            id="art-body"
            required
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Initial draft. You will be redirected to the editor after creation."
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" tone="primary" disabled={submitting || body.trim().length < 20}>
            {submitting ? "drafting..." : "draft"}
          </Button>
        </div>
        <FieldError message={error} />
      </form>
    </Card>
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

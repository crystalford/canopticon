import { Badge, Card } from "@/components/primitives";
import { PublicApiError, publicGet } from "@/lib/public-api";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PublicThesisDetail {
  id: string;
  title: string;
  slug: string;
  status: string;
  declared_at: string;
  cynefin_domain: string | null;
  current_version: {
    version_number: number;
    seed_paragraph: string;
    bluf: string | null;
    tier_80: string | null;
    tier_800: string | null;
    tier_full: string | null;
    ipcc_likelihood: string | null;
    created_at: string;
  } | null;
  contradictions: Array<{
    id: string;
    objection_text: string;
    evidence_gap: string | null;
    severity: string;
    status: string;
    generated_by: string;
    created_at: string;
  }>;
  linchpin_assumptions: Array<{
    id: string;
    text: string;
    status: string;
    consequence_if_failed: string | null;
  }>;
  predictions: Array<{
    id: string;
    text: string;
    probability: number;
    ipcc_qualifier: string | null;
    resolution_criteria: string;
    resolution_horizon_at: string | null;
    status: string;
    brier_contribution: number | null;
  }>;
}

export const runtime = "edge";
export const revalidate = 60;

export default async function PublicThesisPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let thesis: PublicThesisDetail;
  try {
    thesis = await publicGet<PublicThesisDetail>(`/v1/public/theses/${slug}`);
  } catch (err) {
    if (err instanceof PublicApiError && err.status === 404) notFound();
    throw err;
  }

  const v = thesis.current_version;

  return (
    <div className="px-6 py-10 max-w-4xl mx-auto">
      <Link
        href="/p"
        className="text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest"
      >
        ← all theses
      </Link>

      <header className="mt-4 mb-8">
        <h1 className="font-serif text-3xl text-cream-bright mb-2">{thesis.title}</h1>
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
          {thesis.cynefin_domain ? `${thesis.cynefin_domain} · ` : ""}declared{" "}
          {new Date(thesis.declared_at).toLocaleDateString()}
          {v ? ` · v${v.version_number}` : ""}
        </p>
      </header>

      {v?.bluf && (
        <Card tone="amber" className="mb-8">
          <p className="font-mono text-xs uppercase tracking-widest text-amber mb-2">BLUF</p>
          <p className="text-cream-bright font-serif text-lg leading-relaxed">{v.bluf}</p>
          {v.ipcc_likelihood && (
            <p className="text-text-faint font-mono text-xs mt-2 uppercase tracking-widest">
              {v.ipcc_likelihood.replace(/_/g, " ")}
            </p>
          )}
        </Card>
      )}

      {v?.tier_80 && (
        <section className="mb-8">
          <h2 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-2">
            80-word
          </h2>
          <p className="text-text leading-relaxed">{v.tier_80}</p>
        </section>
      )}

      {v?.tier_800 && (
        <section className="mb-8">
          <h2 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-2">
            800-word
          </h2>
          <div className="text-text leading-relaxed whitespace-pre-line">{v.tier_800}</div>
        </section>
      )}

      {v?.tier_full && (
        <section className="mb-8">
          <h2 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-2">
            full account
          </h2>
          <div className="text-text leading-relaxed whitespace-pre-line">{v.tier_full}</div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="font-serif text-xl text-cream mb-3">Predictions</h2>
        {thesis.predictions.length === 0 ? (
          <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
            no predictions yet
          </p>
        ) : (
          <ul className="space-y-3">
            {thesis.predictions.map((p) => (
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
                <div className="flex gap-2 mt-1 items-baseline flex-wrap">
                  <Badge tone={predictionTone(p.status)}>{p.status.replace(/_/g, " ")}</Badge>
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
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <h2 className="font-serif text-xl text-cream mb-3">Linchpin assumptions</h2>
        {thesis.linchpin_assumptions.length === 0 ? (
          <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
            no linchpin assumptions surfaced
          </p>
        ) : (
          <ul className="space-y-2">
            {thesis.linchpin_assumptions.map((a) => (
              <li key={a.id} className="border-l-2 border-amber-dim pl-3">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <Badge tone={assumptionTone(a.status)}>{a.status}</Badge>
                  <p className="text-text font-serif">{a.text}</p>
                </div>
                {a.consequence_if_failed && (
                  <p className="text-text-dim text-sm mt-1 leading-relaxed">
                    if it breaks: {a.consequence_if_failed}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <h2 className="font-serif text-xl text-cream mb-3">Contradictions</h2>
        {thesis.contradictions.length === 0 ? (
          <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
            no open contradictions
          </p>
        ) : (
          <ul className="space-y-3">
            {thesis.contradictions.map((c) => (
              <li key={c.id} className="border-l-2 border-signal-dim pl-3">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <Badge tone={severityTone(c.severity)}>{c.severity}</Badge>
                  <Badge tone="neutral">{c.status}</Badge>
                  <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
                    via {c.generated_by}
                  </span>
                </div>
                <p className="text-text font-serif mt-1">{c.objection_text}</p>
                {c.evidence_gap && (
                  <p className="text-text-dim text-sm mt-1 leading-relaxed">
                    evidence gap: {c.evidence_gap}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
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

function assumptionTone(status: string): "amber" | "sage" | "signal" | "neutral" {
  if (status === "holding") return "sage";
  if (status === "shaken") return "amber";
  if (status === "broken") return "signal";
  return "neutral";
}

function severityTone(severity: string): "amber" | "signal" | "neutral" {
  if (severity === "major") return "signal";
  if (severity === "notable") return "amber";
  return "neutral";
}

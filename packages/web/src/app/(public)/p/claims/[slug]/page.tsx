import { publicGet } from "@/lib/public-api";
import { notFound } from "next/navigation";

export const runtime = "edge";

interface ClaimCache {
  slug: string;
  claim_text: string;
  layer: string;
  admiralty_grade: string | null;
  verification_status: string;
  ipcc_likelihood: string | null;
  payload: {
    data?: string;
    warrant?: string;
    backing?: string;
    qualifier?: string;
    rebuttal?: string;
    sources?: Array<{ slug: string; title: string; supports: boolean }>;
    related_claims?: Array<{ slug: string; claim_text: string; relation: string }>;
  };
}

export default async function ClaimDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await publicGet<{ claim: ClaimCache }>(`/v1/public/claims/${slug}`, 60).catch(
    () => null,
  );
  if (!r) notFound();
  const c = r.claim;
  const p = c.payload;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-[var(--ink-mute)]">
        {c.layer.toUpperCase()} · {c.verification_status.toUpperCase()}
        {c.admiralty_grade ? ` · Grade ${c.admiralty_grade}` : ""}
        {c.ipcc_likelihood ? ` · ${c.ipcc_likelihood.replace(/_/g, " ")}` : ""}
      </p>
      <h1 className="font-serif text-2xl leading-snug text-[var(--ink)]">{c.claim_text}</h1>

      <dl className="mt-8 space-y-4 font-serif text-base text-[var(--ink)]">
        {p.data && (
          <div>
            <dt className="font-mono text-[10.5px] uppercase tracking-wider text-[var(--ink-mute)]">
              Data
            </dt>
            <dd>{p.data}</dd>
          </div>
        )}
        {p.warrant && (
          <div>
            <dt className="font-mono text-[10.5px] uppercase tracking-wider text-[var(--ink-mute)]">
              Warrant
            </dt>
            <dd>{p.warrant}</dd>
          </div>
        )}
        {p.backing && (
          <div>
            <dt className="font-mono text-[10.5px] uppercase tracking-wider text-[var(--ink-mute)]">
              Backing
            </dt>
            <dd>{p.backing}</dd>
          </div>
        )}
        {p.qualifier && (
          <div>
            <dt className="font-mono text-[10.5px] uppercase tracking-wider text-[var(--ink-mute)]">
              Qualifier
            </dt>
            <dd>{p.qualifier}</dd>
          </div>
        )}
        {p.rebuttal && (
          <div>
            <dt className="font-mono text-[10.5px] uppercase tracking-wider text-[var(--ink-mute)]">
              Rebuttal
            </dt>
            <dd>{p.rebuttal}</dd>
          </div>
        )}
      </dl>

      {p.sources && p.sources.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-[var(--ink-mute)]">
            Sources
          </h2>
          <ul className="space-y-1 font-serif">
            {p.sources.map((s) => (
              <li key={s.slug}>
                <a
                  href={`/p/sources/${s.slug}`}
                  className="border-b border-dotted border-[var(--rule)] hover:border-[var(--signal)] hover:text-[var(--signal)]"
                >
                  {s.title}
                </a>
                {!s.supports && <span className="ml-2 text-[var(--signal)]">(contradicts)</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

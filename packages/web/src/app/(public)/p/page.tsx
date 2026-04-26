import { Badge } from "@/components/primitives";
import { PublicApiError, publicGet } from "@/lib/public-api";
import Link from "next/link";

interface PublicThesisRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  declared_at: string;
  cynefin_domain: string | null;
  bluf: string | null;
  ipcc_likelihood: string | null;
  updated_at: string;
}

export const revalidate = 60;

export default async function PublicThesesIndex() {
  let theses: PublicThesisRow[] = [];
  let error: string | null = null;
  try {
    theses = await publicGet<PublicThesisRow[]>("/v1/public/theses");
  } catch (err) {
    error = err instanceof PublicApiError ? err.message : (err as Error).message;
  }

  return (
    <div className="px-6 py-12 max-w-4xl mx-auto">
      <header className="mb-10">
        <h1 className="font-serif text-3xl text-cream-bright mb-2">CANOPTICON</h1>
        <p className="text-text-dim font-mono text-xs uppercase tracking-widest">
          forensic intelligence · published theses
        </p>
        <p className="text-text-dim leading-relaxed mt-4 max-w-2xl">
          Each thesis is a formal claim about Canadian political-economic structure, supported by
          documentary evidence. Predictions are tracked over time and scored against outcomes.
          Contradictions and load-bearing assumptions are surfaced directly — there is nothing the
          operator believes that the public surface hides.
        </p>
      </header>

      {error && <p className="text-signal font-mono text-xs mb-6">could not load: {error}</p>}

      {theses.length === 0 ? (
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
          no public theses yet
        </p>
      ) : (
        <ol className="divide-y divide-border-soft">
          {theses.map((t) => (
            <li key={t.id} className="py-6">
              <Link href={`/p/theses/${t.slug}`} className="block group">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h2 className="font-serif text-xl text-cream group-hover:text-cream-bright">
                    {t.title}
                  </h2>
                  {t.ipcc_likelihood && (
                    <Badge tone="amber">{t.ipcc_likelihood.replace(/_/g, " ")}</Badge>
                  )}
                </div>
                {t.bluf && <p className="text-text leading-relaxed mb-2">{t.bluf}</p>}
                <p className="text-text-faint font-mono text-xs">
                  {t.cynefin_domain ? `${t.cynefin_domain} · ` : ""}declared{" "}
                  {new Date(t.declared_at).toLocaleDateString()}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

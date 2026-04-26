import { Badge, ScreenHeader } from "@/components/primitives";
import { PublicApiError, publicGet } from "@/lib/public-api";
import Link from "next/link";

interface PublicFinding {
  id: string;
  thesis_id: string | null;
  thesis_title: string | null;
  thesis_slug: string | null;
  title: string;
  slug: string;
  narrative: string;
  novelty_grade: "incremental" | "notable" | "breakthrough";
  pattern_type: string;
  confidence: number | null;
  status: string;
  published_at: string | null;
  created_at: string;
}

export const revalidate = 60;

export default async function PublicFindingsPage() {
  let rows: PublicFinding[] = [];
  let error: string | null = null;
  try {
    rows = await publicGet<PublicFinding[]>("/v1/public/findings");
  } catch (err) {
    error = err instanceof PublicApiError ? err.message : (err as Error).message;
  }

  return (
    <div className="px-6 py-12 max-w-4xl mx-auto">
      <ScreenHeader
        title="Findings"
        subtitle="patterns surfaced from the substrate · novelty graded honestly"
      />
      <p className="text-text-dim leading-relaxed mt-2 mb-8 max-w-2xl">
        A finding names a structural pattern in the substrate — a recurring actor, a transaction
        chain, a conflict of interest, an absence the public record has not yet named. The
        breakthrough grade is reserved for findings whose supporting claims, taken together, license
        a conclusion the existing discourse has not articulated.
      </p>

      {error && <p className="text-signal font-mono text-xs mb-6">could not load: {error}</p>}

      {rows.length === 0 ? (
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
          no public findings yet
        </p>
      ) : (
        <ol className="divide-y divide-border-soft">
          {rows.map((f) => (
            <li key={f.id} className="py-6">
              <Link href={`/p/findings/${f.slug}`} className="block group">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h2 className="font-serif text-xl text-cream group-hover:text-cream-bright">
                    {f.title}
                  </h2>
                  <Badge tone={gradeTone(f.novelty_grade)}>{f.novelty_grade}</Badge>
                </div>
                <p className="text-text leading-relaxed mb-2">{f.narrative}</p>
                <div className="flex gap-2 items-baseline flex-wrap">
                  <Badge tone="neutral">{f.pattern_type.replace(/_/g, " ")}</Badge>
                  {f.confidence !== null && (
                    <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
                      confidence {Number(f.confidence).toFixed(2)}
                    </span>
                  )}
                  {f.status === "retracted" && <Badge tone="signal">retracted</Badge>}
                  {f.published_at && (
                    <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
                      published {new Date(f.published_at).toLocaleDateString()}
                    </span>
                  )}
                  {f.thesis_slug && f.thesis_title && (
                    <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
                      → {f.thesis_title}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function gradeTone(g: string): "amber" | "sage" | "blue" {
  if (g === "breakthrough") return "amber";
  if (g === "notable") return "blue";
  return "sage";
}

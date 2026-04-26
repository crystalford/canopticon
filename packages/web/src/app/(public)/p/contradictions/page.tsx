import { Badge, ScreenHeader } from "@/components/primitives";
import { PublicApiError, publicGet } from "@/lib/public-api";
import Link from "next/link";

interface PublicContradiction {
  id: string;
  thesis_id: string;
  thesis_title: string | null;
  thesis_slug: string | null;
  objection_text: string;
  evidence_gap: string | null;
  severity: string;
  status: string;
  generated_by: string;
  created_at: string;
}

export const revalidate = 60;

export default async function PublicContradictionsPage() {
  let rows: PublicContradiction[] = [];
  let error: string | null = null;
  try {
    rows = await publicGet<PublicContradiction[]>("/v1/public/contradictions");
  } catch (err) {
    error = err instanceof PublicApiError ? err.message : (err as Error).message;
  }

  const grouped = groupByThesis(rows);

  return (
    <div className="px-6 py-12 max-w-4xl mx-auto">
      <ScreenHeader
        title="Contradictions"
        subtitle="open objections to public theses · machloket and unresolved"
      />
      <p className="text-text-dim leading-relaxed mt-2 mb-8 max-w-2xl">
        Every published thesis exposes the strongest objections raised against it. We track them
        even when we don&apos;t resolve them — a documented machloket is the honest position when
        the evidence is genuinely contested.
      </p>

      {error && <p className="text-signal font-mono text-xs mb-6">could not load: {error}</p>}

      {rows.length === 0 ? (
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
          no open contradictions on public theses
        </p>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([key, group]) => {
            const head = group[0];
            return (
              <section key={key}>
                {head?.thesis_slug && head.thesis_title && (
                  <Link
                    href={`/p/theses/${head.thesis_slug}`}
                    className="font-serif text-lg text-cream hover:text-amber"
                  >
                    {head.thesis_title}
                  </Link>
                )}
                <ul className="space-y-3 mt-3">
                  {group.map((c) => (
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
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function severityTone(severity: string): "amber" | "signal" | "neutral" {
  if (severity === "major") return "signal";
  if (severity === "notable") return "amber";
  return "neutral";
}

function groupByThesis(rows: PublicContradiction[]): Record<string, PublicContradiction[]> {
  const out: Record<string, PublicContradiction[]> = {};
  for (const r of rows) {
    const key = r.thesis_id;
    out[key] = out[key] ?? [];
    out[key].push(r);
  }
  return out;
}

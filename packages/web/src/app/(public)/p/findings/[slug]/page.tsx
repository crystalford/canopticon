import { Badge, Card } from "@/components/primitives";
import { PublicApiError, publicGet } from "@/lib/public-api";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PublicFindingDetail {
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
  retracted_at: string | null;
  retraction_note: string | null;
  supporting_claims: Array<{
    claim_id: string;
    is_linchpin: boolean;
    admiralty_grade: string;
    claim_text: string;
  }>;
}

export const runtime = "edge";
export const revalidate = 60;

export default async function PublicFindingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let finding: PublicFindingDetail;
  try {
    finding = await publicGet<PublicFindingDetail>(`/v1/public/findings/${slug}`);
  } catch (err) {
    if (err instanceof PublicApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div className="px-6 py-10 max-w-3xl mx-auto">
      <Link
        href="/p/findings"
        className="text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest"
      >
        ← all findings
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="font-serif text-3xl text-cream-bright mb-3">{finding.title}</h1>
        <div className="flex items-baseline gap-2 flex-wrap">
          <Badge tone={gradeTone(finding.novelty_grade)}>{finding.novelty_grade}</Badge>
          <Badge tone="neutral">{finding.pattern_type.replace(/_/g, " ")}</Badge>
          {finding.status === "retracted" && <Badge tone="signal">retracted</Badge>}
          {finding.confidence !== null && (
            <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
              confidence {Number(finding.confidence).toFixed(2)}
            </span>
          )}
          {finding.published_at && (
            <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
              published {new Date(finding.published_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </header>

      {finding.status === "retracted" && finding.retraction_note && (
        <Card tone="signal" className="mb-6">
          <p className="font-mono text-xs uppercase tracking-widest text-signal mb-2">
            retracted
            {finding.retracted_at ? ` ${new Date(finding.retracted_at).toLocaleDateString()}` : ""}
          </p>
          <p className="text-text leading-relaxed">{finding.retraction_note}</p>
        </Card>
      )}

      <article className="text-text leading-relaxed font-serif text-base mb-8 whitespace-pre-line">
        {finding.narrative}
      </article>

      {finding.supporting_claims.length > 0 && (
        <section className="mb-8">
          <h2 className="font-serif text-xl text-cream mb-3">Supporting claims</h2>
          <ul className="space-y-2">
            {finding.supporting_claims.map((c) => (
              <li
                key={c.claim_id}
                className={
                  c.is_linchpin
                    ? "border-l-2 border-amber pl-3"
                    : "border-l-2 border-border-soft pl-3"
                }
              >
                <div className="flex items-baseline gap-2 flex-wrap">
                  <Badge tone={c.admiralty_grade === "A" ? "amber" : "tan"} variant="solid">
                    {c.admiralty_grade}
                  </Badge>
                  {c.is_linchpin && <Badge tone="amber">linchpin</Badge>}
                </div>
                <p className="text-text font-serif mt-1">{c.claim_text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {finding.thesis_slug && finding.thesis_title && (
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
          drawn from →{" "}
          <Link
            href={`/p/theses/${finding.thesis_slug}`}
            className="text-text-dim hover:text-amber"
          >
            {finding.thesis_title}
          </Link>
        </p>
      )}
    </div>
  );
}

function gradeTone(g: string): "amber" | "sage" | "blue" {
  if (g === "breakthrough") return "amber";
  if (g === "notable") return "blue";
  return "sage";
}

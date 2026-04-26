import { Badge, Card } from "@/components/primitives";
import { PublicApiError, publicGet } from "@/lib/public-api";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PublicArticleDetail {
  id: string;
  thesis_id: string | null;
  title: string;
  slug: string;
  status: string;
  published_at: string | null;
  current_version: {
    id: string;
    version_number: number;
    body: string;
    bluf: string | null;
    ipcc_likelihood: string | null;
    change_summary: string | null;
    written_by_role: string | null;
    created_at: string;
  } | null;
  corrections: Array<{
    id: string;
    correction_text: string;
    created_at: string;
  }>;
  claim_count: number;
}

export const revalidate = 60;

export default async function PublicArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let article: PublicArticleDetail;
  try {
    article = await publicGet<PublicArticleDetail>(`/v1/public/articles/${slug}`);
  } catch (err) {
    if (err instanceof PublicApiError && err.status === 404) notFound();
    throw err;
  }

  const v = article.current_version;

  return (
    <div className="px-6 py-10 max-w-3xl mx-auto">
      <Link
        href="/p/articles"
        className="text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest"
      >
        ← all articles
      </Link>

      <header className="mt-4 mb-8">
        <h1 className="font-serif text-3xl text-cream-bright mb-2">{article.title}</h1>
        <div className="flex gap-2 items-baseline flex-wrap">
          <Badge tone={statusTone(article.status)}>{article.status}</Badge>
          {article.published_at && (
            <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
              published {new Date(article.published_at).toLocaleDateString()}
            </span>
          )}
          {v && (
            <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
              v{v.version_number}
            </span>
          )}
          {article.claim_count > 0 && (
            <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
              {article.claim_count} claims cited
            </span>
          )}
        </div>
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

      {v?.body && (
        <article className="text-text leading-relaxed whitespace-pre-line font-serif text-base">
          {v.body}
        </article>
      )}

      {article.corrections.length > 0 && (
        <section className="mt-12 border-t border-border-soft pt-6">
          <h2 className="font-mono text-xs uppercase tracking-widest text-amber mb-4">
            corrections
          </h2>
          <ol className="space-y-4">
            {article.corrections.map((c) => (
              <li key={c.id} className="border-l-2 border-amber-dim pl-3">
                <p className="text-text-faint font-mono text-xs mb-1">
                  {new Date(c.created_at).toLocaleDateString()}
                </p>
                <p className="text-text leading-relaxed">{c.correction_text}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {article.thesis_id && (
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest mt-12">
          this article is grounded in a tracked thesis · the substrate is operator-only
        </p>
      )}
    </div>
  );
}

function statusTone(status: string): "amber" | "sage" | "signal" | "neutral" {
  if (status === "published") return "sage";
  if (status === "corrected") return "amber";
  if (status === "retracted") return "signal";
  return "neutral";
}

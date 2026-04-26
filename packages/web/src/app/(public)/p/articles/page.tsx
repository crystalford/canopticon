import { Badge, ScreenHeader } from "@/components/primitives";
import { PublicApiError, publicGet } from "@/lib/public-api";
import Link from "next/link";

interface PublicArticle {
  id: string;
  thesis_id: string | null;
  title: string;
  slug: string;
  status: string;
  is_public: boolean;
  published_at: string | null;
  updated_at: string;
}

export const revalidate = 60;

export default async function PublicArticlesPage() {
  let articles: PublicArticle[] = [];
  let error: string | null = null;
  try {
    articles = await publicGet<PublicArticle[]>("/v1/public/articles");
  } catch (err) {
    error = err instanceof PublicApiError ? err.message : (err as Error).message;
  }

  return (
    <div className="px-6 py-12 max-w-4xl mx-auto">
      <ScreenHeader title="Articles" subtitle="published narratives drawn from the substrate" />
      <p className="text-text-dim leading-relaxed mt-2 mb-8 max-w-2xl">
        Each article is grounded in claims, predictions, and assumptions tracked elsewhere on this
        site. Corrections are append-only and visible underneath every published piece.
      </p>

      {error && <p className="text-signal font-mono text-xs mb-6">could not load: {error}</p>}

      {articles.length === 0 ? (
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
          no published articles yet
        </p>
      ) : (
        <ol className="divide-y divide-border-soft">
          {articles.map((a) => (
            <li key={a.id} className="py-6">
              <Link href={`/p/articles/${a.slug}`} className="block group">
                <div className="flex items-baseline justify-between gap-4 mb-1">
                  <h2 className="font-serif text-xl text-cream group-hover:text-cream-bright">
                    {a.title}
                  </h2>
                  <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                </div>
                <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
                  {a.published_at
                    ? `published ${new Date(a.published_at).toLocaleDateString()}`
                    : `updated ${new Date(a.updated_at).toLocaleDateString()}`}
                </p>
              </Link>
            </li>
          ))}
        </ol>
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

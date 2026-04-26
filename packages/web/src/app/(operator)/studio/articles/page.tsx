"use client";

import { Badge, ScreenHeader } from "@/components/primitives";
import { ApiError, apiGet } from "@/lib/api-client";
import Link from "next/link";
import { useEffect, useState } from "react";

interface ArticleRow {
  id: string;
  thesis_id: string | null;
  title: string;
  slug: string;
  status: string;
  is_public: boolean;
  published_at: string | null;
  updated_at: string;
}

export default function ArticlesIndexPage() {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<ArticleRow[]>("/v1/articles")
      .then(setArticles)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : (err as Error).message));
  }, []);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <ScreenHeader title="Articles" subtitle="drafts · published · corrected · retracted" />

      <p className="text-text-faint font-mono text-xs mb-6 leading-relaxed">
        new articles are drafted from a thesis page · use &quot;draft article&quot; on{" "}
        <Link href={"/studio" as never} className="text-amber hover:text-cream-bright">
          a thesis
        </Link>
      </p>

      {loadError && (
        <p className="text-signal font-mono text-xs mb-4">could not load: {loadError}</p>
      )}

      {articles.length === 0 ? (
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
          no articles yet
        </p>
      ) : (
        <ol className="divide-y divide-border-soft">
          {articles.map((a) => (
            <li key={a.id} className="py-4">
              <Link
                href={`/studio/articles/${a.id}` as never}
                className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-baseline hover:bg-bg-subtle -mx-2 px-2 py-1"
              >
                <div>
                  <p className="text-cream font-serif text-lg">{a.title}</p>
                  <p className="text-text-faint font-mono text-xs mt-1">
                    {a.slug} · updated {new Date(a.updated_at).toLocaleDateString()}
                  </p>
                </div>
                {a.is_public && <Badge tone="amber">public</Badge>}
                <Badge tone={statusTone(a.status)}>{a.status}</Badge>
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

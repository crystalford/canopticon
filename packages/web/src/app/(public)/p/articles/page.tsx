import { publicGet } from "@/lib/public-api";
import Link from "next/link";

export const runtime = "edge";

interface PubArticle {
  slug: string;
  title: string;
  subtitle?: string | null;
  article_type: string;
  author?: string | null;
  byline_date?: string | null;
  reading_time_minutes?: number | null;
  published_at: string;
}

export default async function ArticlesIndex() {
  const r = await publicGet<{ articles: PubArticle[] }>("/v1/public/articles", 60).catch(() => ({
    articles: [],
  }));
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-8 font-serif text-4xl text-[#1a1410]">Articles</h1>
      <ul className="space-y-6">
        {r.articles.map((a) => (
          <li key={a.slug} className="border-b border-[#1a1410]/15 pb-4">
            <p className="font-mono text-[10.5px] uppercase tracking-wider text-[#5c4a3d]">
              {a.article_type.replace(/_/g, " ")} ·{" "}
              {a.byline_date ?? new Date(a.published_at).toLocaleDateString()}
              {a.reading_time_minutes ? ` · ${a.reading_time_minutes} min read` : ""}
            </p>
            <Link
              href={`/p/articles/${a.slug}`}
              className="mt-1 block font-serif text-2xl text-[#1a1410] hover:text-[#9c2333]"
            >
              {a.title}
            </Link>
            {a.subtitle && <p className="mt-1 font-serif italic text-[#1a1410]/70">{a.subtitle}</p>}
          </li>
        ))}
        {r.articles.length === 0 && (
          <li className="font-serif italic text-[#1a1410]/50">No published articles yet.</li>
        )}
      </ul>
    </div>
  );
}

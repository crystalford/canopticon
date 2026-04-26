import { publicGet } from "@/lib/public-api";
import { notFound } from "next/navigation";

export const runtime = "edge";

interface PubArticleDetail {
  slug: string;
  title: string;
  subtitle?: string | null;
  author?: string | null;
  byline_date?: string | null;
  body_md: string;
  word_count?: number | null;
  reading_time_minutes?: number | null;
  published_at: string;
}

export default async function ArticleDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await publicGet<{ article: PubArticleDetail }>(`/v1/public/articles/${slug}`, 60).catch(
    () => null,
  );
  if (!r) notFound();

  const a = r.article;
  const paras = a.body_md.split(/\n{2,}/);
  const [first, ...rest] = paras;

  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <p className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-[#5c4a3d]">
        CANOPTICON · {a.byline_date ?? new Date(a.published_at).toLocaleDateString()}
        {a.reading_time_minutes ? ` · ${a.reading_time_minutes} min read` : ""}
      </p>
      <h1 className="font-serif text-5xl leading-tight text-[#1a1410]">{a.title}</h1>
      {a.subtitle && (
        <p className="mt-3 font-serif text-xl italic text-[#1a1410]/70">{a.subtitle}</p>
      )}
      {a.author && (
        <p className="mt-4 font-mono text-[10.5px] uppercase tracking-wider text-[#5c4a3d]">
          By {a.author}
        </p>
      )}

      <div className="mt-8 font-serif text-lg leading-relaxed text-[#1a1410]">
        {first && (
          <p className="first-letter:float-left first-letter:mr-2 first-letter:font-serif first-letter:text-[84px] first-letter:font-normal first-letter:leading-[0.85] first-letter:text-[#9c2333]">
            {first}
          </p>
        )}
        {rest.map((p, i) => (
          <p key={i} className="mt-5">
            {p}
          </p>
        ))}
      </div>
    </article>
  );
}

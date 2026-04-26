"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Results {
  articles?: Array<{
    slug: string;
    title: string;
    subtitle?: string | null;
    article_type?: string;
  }>;
  theses?: Array<{ slug: string; title: string; tier_bluf: string }>;
}

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results>({});

  useEffect(() => {
    if (!q || q.length < 2) {
      setResults({});
      return;
    }
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    const t = setTimeout(() => {
      // Use the public list endpoints and filter client-side for first cut.
      Promise.all([
        fetch(`${apiBase}/v1/public/articles`).then((r) => r.json()),
        fetch(`${apiBase}/v1/public/theses`).then((r) => r.json()),
      ]).then(
        ([a, b]: [
          { articles: Array<{ title: string }> },
          { theses: Array<{ title: string }> },
        ]) => {
          const ql = q.toLowerCase();
          const articles = (a.articles ?? []).filter((x) =>
            (x.title ?? "").toLowerCase().includes(ql),
          ) as NonNullable<Results["articles"]>;
          const theses = (b.theses ?? []).filter((x) =>
            (x.title ?? "").toLowerCase().includes(ql),
          ) as NonNullable<Results["theses"]>;
          const next: Results = {};
          if (articles.length > 0) next.articles = articles;
          if (theses.length > 0) next.theses = theses;
          setResults(next);
        },
      );
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-8 font-serif text-4xl text-[#1a1410]">Search</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search across the substrate…"
        className="mb-6 w-full border border-[#1a1410]/30 bg-[#f4ede0] px-3 py-2 font-serif text-lg text-[#1a1410] focus:border-[#9c2333] focus:outline-none"
      />

      {results.articles && results.articles.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-[#5c4a3d]">
            Articles
          </h2>
          <ul className="space-y-2">
            {results.articles.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/p/articles/${a.slug}`}
                  className="font-serif text-lg text-[#1a1410] hover:text-[#9c2333]"
                >
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.theses && results.theses.length > 0 && (
        <section>
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-[#5c4a3d]">
            Theses
          </h2>
          <ul className="space-y-2">
            {results.theses.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/p/theses/${t.slug}`}
                  className="font-serif text-lg text-[#1a1410] hover:text-[#9c2333]"
                >
                  {t.title}
                </Link>
                <p className="font-serif italic text-[#1a1410]/70">{t.tier_bluf}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {q.length >= 2 && !results.articles?.length && !results.theses?.length && (
        <p className="font-serif italic text-[#1a1410]/50">No matches.</p>
      )}
    </div>
  );
}

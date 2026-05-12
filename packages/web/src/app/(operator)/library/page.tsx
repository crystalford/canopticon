"use client";

import { Card, FilterChips, MetadataStrip } from "@/components/primitives";
import { apiGet } from "@/lib/api-client";
import { useEffect, useState } from "react";

type LibTab = "articles" | "books" | "sources" | "theses";

interface SearchResults {
  articles?: Array<{ id: string; title: string; subtitle?: string | null; article_type: string }>;
  books?: Array<{
    id: string;
    title: string;
    authors: string[];
    ingest_mode: string;
    reading_progress: number;
  }>;
  sources?: Array<{
    id: string;
    title: string;
    source_type: string;
    admiralty_grade: string | null;
  }>;
  theses?: Array<{ id: string; title: string; seed_summary: string | null }>;
  claims?: Array<{ claim_id: string; claim_text: string }>;
}

export default function LibraryPage() {
  const [tab, setTab] = useState<LibTab>("articles");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults>({});

  async function load() {
    const path = `/v1/library/search?q=${encodeURIComponent(q)}&types=${tab}`;
    setResults(await apiGet<SearchResults>(path));
  }
  useEffect(() => {
    void load();
  }, [tab, q]);

  return (
    <main>
      <header className="mb-6">
        <MetadataStrip>Library · references</MetadataStrip>
        <h1 className="font-sans text-3xl font-extrabold uppercase tracking-tight text-cream-bright md:text-4xl">
          Library
        </h1>
      </header>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search…"
        className="mb-3 w-full border border-border-soft bg-bg-card px-3 py-2 font-serif text-sm text-cream placeholder:text-text-faint focus:border-cream-dim focus:outline-none"
      />

      <FilterChips
        chips={[
          { value: "articles", label: "Articles" },
          { value: "books", label: "Books" },
          { value: "sources", label: "Sources" },
          { value: "theses", label: "Theses" },
        ]}
        active={tab}
        onChange={setTab}
      />

      <section className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {tab === "articles" &&
          (results.articles ?? []).map((a) => (
            <Card key={a.id}>
              <MetadataStrip>{a.article_type}</MetadataStrip>
              <h3 className="mt-1 font-serif text-base text-cream-bright">{a.title}</h3>
              {a.subtitle && (
                <p className="mt-1 font-serif text-sm italic text-text-dim">{a.subtitle}</p>
              )}
            </Card>
          ))}
        {tab === "books" &&
          (results.books ?? []).map((b) => (
            <Card key={b.id}>
              <MetadataStrip>{`${b.ingest_mode.toUpperCase()} · ${Math.round(b.reading_progress * 100)}%`}</MetadataStrip>
              <h3 className="mt-1 font-serif text-base text-cream-bright">{b.title}</h3>
              <p className="mt-1 font-mono text-[11px] text-text-dim">{b.authors.join(", ")}</p>
            </Card>
          ))}
        {tab === "sources" &&
          (results.sources ?? []).map((s) => (
            <Card key={s.id}>
              <MetadataStrip>{`${s.source_type.toUpperCase()}${s.admiralty_grade ? ` · ${s.admiralty_grade}` : ""}`}</MetadataStrip>
              <h3 className="mt-1 font-serif text-base text-cream-bright">{s.title}</h3>
            </Card>
          ))}
        {tab === "theses" &&
          (results.theses ?? []).map((t) => (
            <Card key={t.id}>
              <MetadataStrip>Thesis</MetadataStrip>
              <h3 className="mt-1 font-serif text-base text-cream-bright">{t.title}</h3>
              {t.seed_summary && (
                <p className="mt-1 font-serif text-sm italic text-text-dim">{t.seed_summary}</p>
              )}
            </Card>
          ))}
      </section>
    </main>
  );
}

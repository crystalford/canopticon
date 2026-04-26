import { publicGet } from "@/lib/public-api";
import { notFound } from "next/navigation";

export const runtime = "edge";

interface SourceCache {
  slug: string;
  title: string;
  source_type: string;
  admiralty_grade: string | null;
  bias_profile: string | null;
  published_at: string | null;
  payload: {
    extracted_claims?: Array<{ slug: string; claim_text: string }>;
    entity_mentions?: Array<{ name: string }>;
    citing_articles?: Array<{ slug: string; title: string }>;
  };
}

export default async function SourceDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await publicGet<{ source: SourceCache }>(`/v1/public/sources/${slug}`, 60).catch(
    () => null,
  );
  if (!r) notFound();
  const s = r.source;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-[#5c4a3d]">
        {s.source_type.toUpperCase()}
        {s.admiralty_grade ? ` · Grade ${s.admiralty_grade}` : ""}
        {s.published_at ? ` · ${new Date(s.published_at).toLocaleDateString()}` : ""}
      </p>
      <h1 className="font-serif text-3xl text-[#1a1410]">{s.title}</h1>
      {s.bias_profile && (
        <p className="mt-3 font-serif text-base italic text-[#1a1410]/70">
          Bias profile: {s.bias_profile}
        </p>
      )}

      {s.payload.extracted_claims && s.payload.extracted_claims.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-[#5c4a3d]">
            Claims extracted
          </h2>
          <ul className="space-y-2 font-serif">
            {s.payload.extracted_claims.map((c) => (
              <li key={c.slug} className="border-l-2 border-[#1a1410]/15 pl-3">
                {c.claim_text}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

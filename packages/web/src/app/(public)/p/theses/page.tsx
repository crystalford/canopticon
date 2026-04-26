import { publicGet } from "@/lib/public-api";
import Link from "next/link";

export const runtime = "edge";

interface PubThesis {
  slug: string;
  title: string;
  seed_summary?: string | null;
  coined_phrase?: string | null;
  ipcc_likelihood?: string | null;
  tier_bluf: string;
  version_number: number;
  published_at: string;
}

export default async function ThesesIndex() {
  const r = await publicGet<{ theses: PubThesis[] }>("/v1/public/theses", 60).catch(() => ({
    theses: [],
  }));
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-8 font-serif text-4xl text-[#1a1410]">Theses</h1>
      <ul className="space-y-6">
        {r.theses.map((t) => (
          <li key={t.slug} className="border-b border-[#1a1410]/15 pb-4">
            <p className="font-mono text-[10.5px] uppercase tracking-wider text-[#5c4a3d]">
              v{t.version_number} · {new Date(t.published_at).toLocaleDateString()}
              {t.ipcc_likelihood ? ` · IPCC: ${t.ipcc_likelihood.replace(/_/g, " ")}` : ""}
            </p>
            <Link
              href={`/p/theses/${t.slug}`}
              className="mt-1 block font-serif text-2xl text-[#1a1410] hover:text-[#9c2333]"
            >
              {t.title}
            </Link>
            <p className="mt-2 font-serif italic text-[#1a1410]/80">{t.tier_bluf}</p>
            {t.coined_phrase && (
              <p className="mt-2 font-mono text-[10.5px] uppercase tracking-wider text-[#9c2333]">
                Coined: {t.coined_phrase}
              </p>
            )}
          </li>
        ))}
        {r.theses.length === 0 && (
          <li className="font-serif italic text-[#1a1410]/50">No published theses yet.</li>
        )}
      </ul>
    </div>
  );
}

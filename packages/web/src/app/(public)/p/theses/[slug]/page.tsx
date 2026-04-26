"use client";

import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface PubThesis {
  slug: string;
  title: string;
  seed_summary?: string | null;
  coined_phrase?: string | null;
  ipcc_likelihood?: string | null;
  tier_bluf: string;
  tier_80: string;
  tier_800: string;
  tier_full?: string | null;
  version_number: number;
  primary_operator?: string | null;
  published_at: string;
}

type Tier = "bluf" | "tier_80" | "tier_800" | "tier_full";

export default function ThesisDetail() {
  const params = useParams<{ slug: string }>();
  const [thesis, setThesis] = useState<PubThesis | null>(null);
  const [tier, setTier] = useState<Tier>("bluf");
  const [error, setError] = useState(false);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    fetch(`${apiBase}/v1/public/theses/${params.slug}`)
      .then((r) => r.json())
      .then((d: { thesis?: PubThesis; error?: unknown }) => {
        if (d.thesis) setThesis(d.thesis);
        else setError(true);
      })
      .catch(() => setError(true));
  }, [params.slug]);

  if (error) notFound();
  if (!thesis) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12 font-serif italic text-[#1a1410]/50">
        Loading…
      </div>
    );
  }

  const body =
    tier === "bluf"
      ? thesis.tier_bluf
      : tier === "tier_80"
        ? thesis.tier_80
        : tier === "tier_800"
          ? thesis.tier_800
          : (thesis.tier_full ?? "Full tier not yet generated.");

  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <p className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-[#5c4a3d]">
        v{thesis.version_number} · {new Date(thesis.published_at).toLocaleDateString()}
        {thesis.ipcc_likelihood ? ` · IPCC: ${thesis.ipcc_likelihood.replace(/_/g, " ")}` : ""}
      </p>
      <h1 className="font-serif text-4xl leading-tight text-[#1a1410]">{thesis.title}</h1>

      {thesis.coined_phrase && (
        <p className="mt-4 border-l-2 border-[#9c2333] pl-3 font-serif text-lg italic text-[#9c2333]">
          "{thesis.coined_phrase}"
        </p>
      )}

      <div className="mt-8 flex gap-2 border-y border-[#1a1410]/15 py-2">
        {(["bluf", "tier_80", "tier_800", "tier_full"] as Tier[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTier(t)}
            className={`px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider ${
              tier === t ? "bg-[#1a1410] text-[#f4ede0]" : "text-[#5c4a3d] hover:bg-[#ede4d2]"
            }`}
          >
            {t === "bluf"
              ? "BLUF"
              : t === "tier_80"
                ? "80 words"
                : t === "tier_800"
                  ? "800 words"
                  : "Full"}
          </button>
        ))}
      </div>

      <div className="mt-6 whitespace-pre-line font-serif text-lg leading-relaxed text-[#1a1410]">
        {body}
      </div>

      {thesis.primary_operator && (
        <p className="mt-12 border-t border-[#1a1410]/15 pt-4 font-mono text-[10.5px] uppercase tracking-wider text-[#5c4a3d]">
          By {thesis.primary_operator}
        </p>
      )}
    </article>
  );
}

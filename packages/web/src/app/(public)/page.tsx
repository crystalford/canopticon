// Public home: editorial masthead + publication feed.
//
// Masthead reads like a newspaper standfirst — small caps banner,
// italic mission line, restrained body. Then the publication feed
// (lead investigation, theses, predictions, contradictions) below.

import { publicGet } from "@/lib/public-api";
import Link from "next/link";

export const runtime = "edge";

interface PubArticle {
  article_id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  author?: string | null;
  byline_date?: string | null;
  reading_time_minutes?: number | null;
  published_at: string;
}

interface PubThesis {
  thesis_id: string;
  slug: string;
  title: string;
  coined_phrase?: string | null;
  ipcc_likelihood?: string | null;
  tier_bluf: string;
}

interface PubPrediction {
  prediction_id: string;
  slug: string;
  statement: string;
  confidence_pct: number;
  resolution_horizon: string;
  status: string;
}

interface PubContradiction {
  contradiction_id: string;
  slug: string;
  posture: string;
  resolution_reasoning: string | null;
  payload: { headline?: string };
}

export default async function PublicHomePage() {
  const [articlesR, thesesR, predsR, contraR] = await Promise.all([
    publicGet<{ articles: PubArticle[] }>("/v1/public/articles", 60).catch(() => ({
      articles: [],
    })),
    publicGet<{ theses: PubThesis[] }>("/v1/public/theses", 60).catch(() => ({ theses: [] })),
    publicGet<{ predictions: PubPrediction[] }>("/v1/public/predictions", 60).catch(() => ({
      predictions: [],
    })),
    publicGet<{ contradictions: PubContradiction[] }>("/v1/public/contradictions", 60).catch(
      () => ({ contradictions: [] }),
    ),
  ]);

  const lead = articlesR.articles[0];
  const theses = thesesR.theses.slice(0, 3);
  const activePreds = predsR.predictions.filter((p) => p.status === "active").slice(0, 3);
  const contradictions = contraR.contradictions.slice(0, 3);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <section className="mb-12 border-b border-[#1a1410]/15 pb-10 text-center">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[#9c2333]">
          A forensic publication · Canadian political intelligence
        </p>
        <h1 className="mt-5 font-serif text-3xl italic leading-snug text-[#1a1410] md:text-4xl">
          The structured record beneath the headlines.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl font-serif text-base leading-relaxed text-[#1a1410]/80">
          Canopticon tracks claims, calibrates predictions, and surfaces contradictions
          in Canada's political and economic record. Investigations link back to the
          evidence behind them — and show, openly, where the work is still uncertain.
        </p>
      </section>

      {lead && (
        <article className="mb-16 border-b border-[#1a1410]/15 pb-12">
          <p className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-[#5c4a3d]">
            Lead investigation ·{" "}
            {lead.byline_date ?? new Date(lead.published_at).toLocaleDateString()}
          </p>
          <h2 className="font-serif text-5xl leading-tight text-[#1a1410]">{lead.title}</h2>
          {lead.subtitle && (
            <p className="mt-3 font-serif text-xl italic text-[#1a1410]/70">{lead.subtitle}</p>
          )}
          <Link
            href={`/p/articles/${lead.slug}`}
            className="mt-4 inline-block font-mono text-[10.5px] uppercase tracking-wider text-[#9c2333] hover:underline"
          >
            Read full investigation →
          </Link>
        </article>
      )}

      <section className="mb-12">
        <h2 className="mb-4 font-mono text-[11px] uppercase tracking-wider text-[#5c4a3d]">
          Theses in progress
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {theses.map((t) => (
            <Link key={t.thesis_id} href={`/p/theses/${t.slug}`} className="block">
              <article className="border border-[#1a1410]/15 bg-[#ede4d2] p-4 hover:border-[#9c2333]">
                {t.ipcc_likelihood && (
                  <p className="font-mono text-[9.5px] uppercase tracking-wider text-[#9c2333]">
                    {t.ipcc_likelihood.replace(/_/g, " ")}
                  </p>
                )}
                <h3 className="mt-2 font-serif text-lg text-[#1a1410]">{t.title}</h3>
                <p className="mt-2 font-serif text-sm italic text-[#1a1410]/70">{t.tier_bluf}</p>
              </article>
            </Link>
          ))}
          {theses.length === 0 && (
            <p className="col-span-3 font-serif italic text-[#1a1410]/50">
              No published theses yet.
            </p>
          )}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 font-mono text-[11px] uppercase tracking-wider text-[#5c4a3d]">
          Active predictions
        </h2>
        <ul className="space-y-3">
          {activePreds.map((p) => (
            <li key={p.prediction_id} className="border-b border-[#1a1410]/10 pb-3">
              <div className="font-mono text-[10.5px] uppercase tracking-wider text-[#5c4a3d]">
                {p.confidence_pct}% by {p.resolution_horizon}
              </div>
              <p className="mt-1 font-serif text-base text-[#1a1410]">{p.statement}</p>
            </li>
          ))}
          {activePreds.length === 0 && (
            <li className="font-serif italic text-[#1a1410]/50">No active predictions.</li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-4 font-mono text-[11px] uppercase tracking-wider text-[#5c4a3d]">
          Contradictions tracked
        </h2>
        <ul className="space-y-3">
          {contradictions.map((c) => (
            <li key={c.contradiction_id} className="border-l-2 border-[#9c2333] pl-3">
              <div className="font-mono text-[10.5px] uppercase tracking-wider text-[#9c2333]">
                {c.posture.replace(/_/g, " ")}
              </div>
              {c.resolution_reasoning && (
                <p className="mt-1 font-serif text-sm italic text-[#1a1410]/80">
                  {c.resolution_reasoning}
                </p>
              )}
            </li>
          ))}
          {contradictions.length === 0 && (
            <li className="font-serif italic text-[#1a1410]/50">No tracked contradictions yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

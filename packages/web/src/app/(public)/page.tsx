// Public home: D1+D4 Vercel-pro near-white. Masthead + publication feed.
// Geist throughout. Single rose accent.

import { publicGet } from "@/lib/public-api";
import Link from "next/link";

export const runtime = "edge";

interface PubArticle {
  article_id?: string;
  id?: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  author?: string | null;
  byline_date?: string | null;
  reading_time_minutes?: number | null;
  published_at: string;
}

interface PubPost {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  post_type: "article" | "thesis" | "note";
  byline?: string | null;
  is_forensic: number;
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
  const [articlesR, postsR, thesesR, predsR, contraR] = await Promise.all([
    publicGet<{ articles: PubArticle[] }>("/v1/public/articles", 60).catch(() => ({
      articles: [],
    })),
    publicGet<{ posts: PubPost[] }>("/v1/public/posts", 60).catch(() => ({ posts: [] })),
    publicGet<{ theses: PubThesis[] }>("/v1/public/theses", 60).catch(() => ({ theses: [] })),
    publicGet<{ predictions: PubPrediction[] }>("/v1/public/predictions", 60).catch(() => ({
      predictions: [],
    })),
    publicGet<{ contradictions: PubContradiction[] }>("/v1/public/contradictions", 60).catch(
      () => ({ contradictions: [] }),
    ),
  ]);

  // Prefer the new CMS posts for the lead; fall back to the older
  // pub_articles_cache shape if no posts are published yet.
  const leadPost = postsR.posts[0];
  const leadArticle = articlesR.articles[0];
  const recentPosts = postsR.posts.slice(0, 4);
  const theses = thesesR.theses.slice(0, 3);
  const activePreds = predsR.predictions.filter((p) => p.status === "active").slice(0, 3);
  const contradictions = contraR.contradictions.slice(0, 3);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      {/* Masthead */}
      <section className="mb-14 border-b border-[var(--rule)] pb-12">
        <p className="mono text-[11px] uppercase tracking-[0.16em] text-[var(--signal)]">
          Forensic publication · Canadian political and economic structure
        </p>
        <h1 className="h-display mt-5 text-[56px] text-[var(--ink)] md:text-[68px]">
          The structured record beneath the headlines.
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-[var(--ink-3)]">
          Canopticon tracks claims, calibrates predictions, and surfaces contradictions in Canada's
          political and economic record. Investigations link back to the evidence behind them — and
          show, openly, where the work is still uncertain.
        </p>
      </section>

      {/* Lead investigation */}
      {leadPost && (
        <article className="mb-16 border-b border-[var(--rule)] pb-12">
          <p className="mono mb-2 text-[11px] uppercase tracking-[0.04em] text-[var(--ink-mute)]">
            Lead {leadPost.post_type === "thesis" ? "thesis" : "investigation"} ·{" "}
            {new Date(leadPost.published_at).toLocaleDateString()}
            {leadPost.is_forensic ? " · Forensic" : ""}
          </p>
          <h2 className="h-display text-[44px] leading-tight text-[var(--ink)]">
            {leadPost.title}
          </h2>
          {leadPost.subtitle && (
            <p className="mt-3 text-[18px] leading-snug text-[var(--ink-3)]">{leadPost.subtitle}</p>
          )}
          <Link
            href={`/p/${leadPost.slug}`}
            className="mono mt-5 inline-block text-[11px] uppercase tracking-[0.06em] text-[var(--signal)] hover:underline"
          >
            Read full investigation →
          </Link>
        </article>
      )}

      {/* Fallback to old articles cache if no posts yet but articles exist */}
      {!leadPost && leadArticle && (
        <article className="mb-16 border-b border-[var(--rule)] pb-12">
          <p className="mono mb-2 text-[11px] uppercase tracking-[0.04em] text-[var(--ink-mute)]">
            Lead investigation ·{" "}
            {leadArticle.byline_date ?? new Date(leadArticle.published_at).toLocaleDateString()}
          </p>
          <h2 className="h-display text-[44px] leading-tight text-[var(--ink)]">
            {leadArticle.title}
          </h2>
          {leadArticle.subtitle && (
            <p className="mt-3 text-[18px] leading-snug text-[var(--ink-3)]">
              {leadArticle.subtitle}
            </p>
          )}
          <Link
            href={`/p/articles/${leadArticle.slug}`}
            className="mono mt-5 inline-block text-[11px] uppercase tracking-[0.06em] text-[var(--signal)] hover:underline"
          >
            Read full investigation →
          </Link>
        </article>
      )}

      {/* Recent posts grid */}
      {recentPosts.length > 1 && (
        <section className="mb-14">
          <h2 className="mono mb-5 text-[11px] uppercase tracking-[0.04em] text-[var(--ink-mute)]">
            Recent
          </h2>
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
            {recentPosts.slice(1).map((p) => (
              <Link
                key={p.id}
                href={`/p/${p.slug}`}
                className="group block border-t border-[var(--rule)] pt-4 hover:border-[var(--ink)]"
              >
                <p className="mono text-[11px] uppercase tracking-[0.04em] text-[var(--ink-mute)]">
                  {p.post_type} · {new Date(p.published_at).toLocaleDateString()}
                </p>
                <h3 className="mt-2 text-[18px] font-semibold leading-snug tracking-tight text-[var(--ink)] group-hover:text-[var(--signal)]">
                  {p.title}
                </h3>
                {p.subtitle && <p className="mt-1 text-[14px] text-[var(--ink-3)]">{p.subtitle}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Theses in progress */}
      <section className="mb-14">
        <h2 className="mono mb-5 text-[11px] uppercase tracking-[0.04em] text-[var(--ink-mute)]">
          Theses in progress
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {theses.map((t) => (
            <Link key={t.thesis_id} href={`/p/theses/${t.slug}`} className="block">
              <article className="h-full border border-[var(--rule)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--ink)]">
                {t.ipcc_likelihood && (
                  <p className="mono text-[10px] uppercase tracking-[0.04em] text-[var(--signal)]">
                    {t.ipcc_likelihood.replace(/_/g, " ")}
                  </p>
                )}
                <h3 className="mt-2 text-[16px] font-semibold leading-snug tracking-tight text-[var(--ink)]">
                  {t.title}
                </h3>
                <p className="mt-2 text-[13.5px] leading-snug text-[var(--ink-3)]">{t.tier_bluf}</p>
              </article>
            </Link>
          ))}
          {theses.length === 0 && (
            <p className="col-span-3 text-[14px] italic text-[var(--ink-faint)]">
              No published theses yet.
            </p>
          )}
        </div>
      </section>

      {/* Active predictions */}
      <section className="mb-14">
        <h2 className="mono mb-5 text-[11px] uppercase tracking-[0.04em] text-[var(--ink-mute)]">
          Active predictions
        </h2>
        <ul className="divide-y divide-[var(--rule)] border-t border-b border-[var(--rule)]">
          {activePreds.map((p) => (
            <li key={p.prediction_id} className="flex items-baseline gap-5 py-3">
              <div className="mono shrink-0 text-[11px] uppercase tracking-[0.04em] text-[var(--ink-mute)] tabular-nums">
                <span className="text-[var(--ink)]">{p.confidence_pct}%</span> · by{" "}
                {p.resolution_horizon}
              </div>
              <p className="text-[14.5px] leading-snug text-[var(--ink-2)]">{p.statement}</p>
            </li>
          ))}
          {activePreds.length === 0 && (
            <li className="py-3 text-[14px] italic text-[var(--ink-faint)]">
              No active predictions.
            </li>
          )}
        </ul>
      </section>

      {/* Contradictions tracked */}
      <section>
        <h2 className="mono mb-5 text-[11px] uppercase tracking-[0.04em] text-[var(--ink-mute)]">
          Contradictions tracked
        </h2>
        <ul className="space-y-4">
          {contradictions.map((c) => (
            <li key={c.contradiction_id} className="border-l-2 border-[var(--signal)] pl-4">
              <div className="mono text-[10.5px] uppercase tracking-[0.04em] text-[var(--signal)]">
                {c.posture.replace(/_/g, " ")}
              </div>
              {c.resolution_reasoning && (
                <p className="mt-1 text-[14.5px] leading-snug text-[var(--ink-2)]">
                  {c.resolution_reasoning}
                </p>
              )}
            </li>
          ))}
          {contradictions.length === 0 && (
            <li className="text-[14px] italic text-[var(--ink-faint)]">
              No tracked contradictions yet.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

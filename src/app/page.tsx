import { createClient } from '@/lib/supabase/server'
import type { Article, ArgumentMap } from '@/types/database'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const TYPE_LABELS: Record<string, string> = {
  analysis: 'Analysis',
  five_whys: 'Five Whys',
  solution_inventory: 'Solution Inventory',
  prediction: 'Prediction',
  thesis: 'Thesis',
}

export default async function HomePage() {
  const supabase = createClient()

  const [{ data: articles }, { data: maps }] = await Promise.all([
    supabase.from('articles').select('id, title, slug, summary, published_at, article_type').eq('status', 'published').order('published_at', { ascending: false }).limit(10),
    supabase.from('argument_maps').select('id, title, article_type, published_at, five_whys, banked_predictions').eq('status', 'published').order('published_at', { ascending: false }).limit(6),
  ])

  return (
    <div className="min-h-screen bg-void text-text-primary">
      <header className="border-b border-border bg-base/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-display text-lg font-bold text-brand tracking-wider">CANOPTICON</span>
          <span className="font-mono text-xs text-text-muted">Canadian Political Intelligence</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-16">
        <section className="space-y-4 border-b border-border pb-12">
          <p className="font-mono text-xs text-signal tracking-widest">OPEN INTELLIGENCE</p>
          <h1 className="font-display text-3xl font-bold text-text-primary leading-tight">
            Mapping how power<br />operates in Canada.
          </h1>
          <p className="font-body text-text-secondary max-w-xl leading-relaxed">
            Structured analysis of the networks, funding flows, and policy mechanisms shaping Canadian political economy. Evidence-graded, source-attributed, publicly accountable.
          </p>
        </section>

        {(articles ?? []).length > 0 && (
          <section className="space-y-6">
            <h2 className="font-display text-sm font-semibold text-text-secondary tracking-wider uppercase">Latest Intelligence</h2>
            <div className="space-y-px">
              {(articles as (Article & { article_type?: string })[]).map((article) => (
                <Link
                  key={article.id}
                  href={`/articles/${article.slug}`}
                  className="group flex gap-6 py-5 border-b border-border hover:border-signal/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-mono text-[10px] text-signal">{TYPE_LABELS[article.article_type ?? 'analysis']}</span>
                      {article.published_at && (
                        <span className="font-mono text-[10px] text-text-muted">{new Date(article.published_at).toLocaleDateString('en-CA')}</span>
                      )}
                    </div>
                    <h3 className="font-display text-base font-semibold text-text-primary group-hover:text-signal transition-colors">{article.title}</h3>
                    {article.summary && (
                      <p className="font-body text-sm text-text-secondary mt-1 line-clamp-2">{article.summary}</p>
                    )}
                  </div>
                  <div className="shrink-0 pt-1 text-text-muted group-hover:text-signal transition-colors font-mono text-xs">→</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {(maps ?? []).length > 0 && (
          <section className="space-y-6">
            <h2 className="font-display text-sm font-semibold text-text-secondary tracking-wider uppercase">Argument Maps</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(maps as ArgumentMap[]).map((map) => (
                <Link
                  key={map.id}
                  href={`/argument-maps/${map.id}`}
                  className="glass-panel p-5 hover:border-signal/30 transition-colors group block"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-[10px] text-hypothesis border border-hypothesis/30 bg-hypothesis/5 px-1.5 py-0.5 rounded-sm">
                      {TYPE_LABELS[map.article_type] ?? map.article_type}
                    </span>
                    {map.published_at && (
                      <span className="font-mono text-[10px] text-text-muted">{new Date(map.published_at).toLocaleDateString('en-CA')}</span>
                    )}
                  </div>
                  <h3 className="font-display text-sm font-semibold text-text-primary group-hover:text-signal transition-colors">{map.title}</h3>
                  <div className="flex gap-3 mt-2">
                    {map.five_whys?.length > 0 && (
                      <span className="font-mono text-[10px] text-text-muted">{map.five_whys.length} whys</span>
                    )}
                    {map.banked_predictions?.length > 0 && (
                      <span className="font-mono text-[10px] text-text-muted">{map.banked_predictions.length} predictions</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {(articles ?? []).length === 0 && (maps ?? []).length === 0 && (
          <section className="py-20 text-center">
            <p className="font-mono text-xs text-text-muted">No published intelligence yet.</p>
          </section>
        )}
      </main>

      <footer className="border-t border-border mt-20">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <p className="font-mono text-xs text-text-muted">CANOPTICON — Canadian Political Intelligence Platform</p>
        </div>
      </footer>
    </div>
  )
}

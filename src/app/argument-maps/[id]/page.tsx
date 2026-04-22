import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ArgumentMap } from '@/types/database'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const TYPE_LABELS: Record<string, string> = {
  analysis: 'Analysis',
  five_whys: 'Five Whys',
  solution_inventory: 'Solution Inventory',
  prediction: 'Prediction',
  thesis: 'Thesis',
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 0.7 ? 'bg-confirmed' : value >= 0.4 ? 'bg-hypothesis' : 'bg-disputed'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1 bg-raised rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${value * 100}%` }} />
      </div>
      <span className="font-mono text-[10px] text-text-muted">{Math.round(value * 100)}%</span>
    </div>
  )
}

export default async function PublicArgumentMapPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: map } = await supabase
    .from('argument_maps')
    .select('*')
    .eq('id', params.id)
    .eq('status', 'published')
    .single()

  if (!map) notFound()

  const m = map as ArgumentMap

  return (
    <div className="min-h-screen bg-void text-text-primary">
      <header className="border-b border-border bg-base/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-display text-lg font-bold text-brand tracking-wider hover:opacity-80 transition-opacity">
            CANOPTICON
          </Link>
          <span className="font-mono text-xs text-text-muted">Canadian Political Intelligence</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        <div className="space-y-3 border-b border-border pb-8">
          <Link href="/" className="font-mono text-xs text-text-muted hover:text-signal transition-colors">← Intelligence</Link>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-hypothesis border border-hypothesis/30 bg-hypothesis/5 px-1.5 py-0.5 rounded-sm">
              {TYPE_LABELS[m.article_type] ?? m.article_type}
            </span>
            {m.published_at && (
              <span className="font-mono text-xs text-text-muted">{new Date(m.published_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            )}
          </div>
          <h1 className="font-display text-2xl font-bold text-text-primary">{m.title}</h1>
        </div>

        {/* Root Claim */}
        {m.argument_tree?.claim && (
          <section className="glass-panel p-6 space-y-3">
            <h2 className="font-display text-sm font-semibold text-text-secondary tracking-wider uppercase">Central Argument</h2>
            <p className="font-body text-text-primary leading-relaxed text-base">{m.argument_tree.claim}</p>
            <ConfidenceBar value={m.argument_tree.confidence ?? 0} />
          </section>
        )}

        {/* Five Whys */}
        {m.five_whys?.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-display text-sm font-semibold text-text-secondary tracking-wider uppercase">Five Whys — Causal Chain</h2>
            <div className="space-y-3">
              {m.five_whys.map((w, i) => (
                <div key={i} className="flex gap-4">
                  <div className="shrink-0 w-8 h-8 rounded-sm bg-signal/10 border border-signal/30 flex items-center justify-center">
                    <span className="font-mono text-xs text-signal font-bold">{w.level}</span>
                  </div>
                  <div className="flex-1 bg-raised border border-border rounded-sm p-4">
                    <p className="font-mono text-xs text-signal mb-1">{w.question}</p>
                    <p className="font-body text-sm text-text-secondary leading-relaxed">{w.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Dominant Frames */}
        {m.dominant_frames?.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-display text-sm font-semibold text-text-secondary tracking-wider uppercase">Dominant Frames</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {m.dominant_frames.map((f, i) => (
                <div key={i} className="glass-panel p-4 space-y-2">
                  <p className="font-display text-sm font-semibold text-signal">{f.frame_name}</p>
                  <p className="font-body text-sm text-text-secondary leading-relaxed">{f.description}</p>
                  <p className="font-mono text-xs text-text-muted">Benefits: {f.who_benefits}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Solution Inventory */}
        {(m.solution_inventory?.reform?.length > 0 || m.solution_inventory?.resistance?.length > 0 || m.solution_inventory?.exit?.length > 0) && (
          <section className="space-y-4">
            <h2 className="font-display text-sm font-semibold text-text-secondary tracking-wider uppercase">Solution Inventory</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(['reform', 'resistance', 'exit'] as const).map((axis) => {
                const items = m.solution_inventory[axis] ?? []
                if (items.length === 0) return null
                const colors = { reform: 'text-confirmed border-confirmed/30', resistance: 'text-signal border-signal/30', exit: 'text-hypothesis border-hypothesis/30' }
                return (
                  <div key={axis} className="glass-panel p-4 space-y-3">
                    <p className={`font-mono text-xs font-semibold uppercase border-b pb-2 ${colors[axis]}`}>{axis}</p>
                    <ul className="space-y-2">
                      {items.map((s, i) => (
                        <li key={i} className="font-body text-sm text-text-secondary leading-relaxed flex gap-2">
                          <span className="text-text-muted mt-0.5">·</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Banked Predictions */}
        {m.banked_predictions?.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-display text-sm font-semibold text-text-secondary tracking-wider uppercase">Banked Predictions</h2>
            <div className="space-y-3">
              {m.banked_predictions.map((p, i) => (
                <div key={i} className="glass-panel p-4 flex gap-4 items-start">
                  <div className="shrink-0 text-center">
                    <div className={`font-mono text-lg font-bold ${p.probability >= 0.7 ? 'text-confirmed' : p.probability >= 0.4 ? 'text-signal' : 'text-disputed'}`}>
                      {Math.round(p.probability * 100)}%
                    </div>
                    <div className="font-mono text-[10px] text-text-muted">probability</div>
                  </div>
                  <div className="flex-1">
                    <p className="font-body text-sm text-text-primary leading-relaxed">{p.claim}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="font-mono text-[10px] text-text-muted">Resolves {p.resolution_date}</span>
                      {p.resolved && (
                        <span className={`font-mono text-[10px] ${p.outcome === 'correct' ? 'text-confirmed' : 'text-disputed'}`}>
                          {p.outcome === 'correct' ? '✓ Correct' : '✗ Incorrect'}
                          {p.brier_score !== undefined && ` (Brier: ${p.brier_score.toFixed(2)})`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-border mt-20">
        <div className="max-w-4xl mx-auto px-6 py-8 flex items-center justify-between">
          <p className="font-mono text-xs text-text-muted">CANOPTICON</p>
          <Link href="/" className="font-mono text-xs text-text-muted hover:text-signal transition-colors">← All Intelligence</Link>
        </div>
      </footer>
    </div>
  )
}

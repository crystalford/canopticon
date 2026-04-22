import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Entity, KnowledgeGap, Hypothesis, ConvergenceEvent } from '@/types/database'

export const dynamic = 'force-dynamic'

const TYPE_COLORS: Record<string, string> = {
  person: 'text-hypothesis',
  organization: 'text-signal',
  corporation: 'text-signal',
  government_body: 'text-confirmed',
  political_party: 'text-brand',
  media_outlet: 'text-text-secondary',
  policy: 'text-text-secondary',
  event: 'text-text-secondary',
  place: 'text-text-secondary',
  concept: 'text-text-muted',
}

export default async function IntelligencePage() {
  const supabase = createClient()

  const [
    { data: recentEntities },
    { data: criticalGaps },
    { data: openHypotheses },
    { data: recentConvergences },
    { count: totalEntities },
    { count: totalClaims },
    { count: openGaps },
  ] = await Promise.all([
    supabase.from('entities').select('*').order('created_at', { ascending: false }).limit(8),
    supabase.from('knowledge_gaps').select('*').eq('is_resolved', false).order('urgency_score', { ascending: false }).limit(5),
    supabase.from('hypotheses').select('*').eq('status', 'open').order('confidence', { ascending: false }).limit(5),
    supabase.from('convergence_events').select('*').eq('reviewed', false).order('detected_at', { ascending: false }).limit(4),
    supabase.from('entities').select('*', { count: 'exact', head: true }),
    supabase.from('claims').select('*', { count: 'exact', head: true }),
    supabase.from('knowledge_gaps').select('*', { count: 'exact', head: true }).eq('is_resolved', false),
  ])

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-text-primary">Intelligence</h1>
          <p className="font-mono text-xs text-text-muted mt-1">Knowledge graph overview — entities, gaps, hypotheses.</p>
        </div>
        <Link href="/admin/intelligence/graph"
          className="font-mono text-xs px-3 py-2 rounded-sm border border-signal/30 text-signal hover:bg-signal/10 transition-colors flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="3" cy="7" r="2" stroke="currentColor" strokeWidth="1.2"/><circle cx="11" cy="3" r="2" stroke="currentColor" strokeWidth="1.2"/><circle cx="11" cy="11" r="2" stroke="currentColor" strokeWidth="1.2"/><line x1="5" y1="6.2" x2="9" y2="3.8" stroke="currentColor" strokeWidth="1"/><line x1="5" y1="7.8" x2="9" y2="10.2" stroke="currentColor" strokeWidth="1"/></svg>
          Open Graph
        </Link>
      </div>

      {/* Summary counters */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Entities', value: totalEntities ?? 0, href: '/admin/entities', color: 'text-signal' },
          { label: 'Claims', value: totalClaims ?? 0, href: '#', color: 'text-confirmed' },
          { label: 'Open Gaps', value: openGaps ?? 0, href: '#', color: openGaps ? 'text-disputed' : 'text-text-secondary' },
        ].map(({ label, value, href, color }) => (
          <Link key={label} href={href} className="glass-panel p-4 hover:border-signal/30 transition-colors block">
            <div className={`font-mono text-3xl font-bold ${color}`}>{value}</div>
            <div className="font-mono text-xs text-text-muted mt-1">{label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Critical Knowledge Gaps */}
        <section className="space-y-3">
          <h2 className="font-mono text-xs text-disputed tracking-wider uppercase flex items-center gap-2">
            <span className="pulse-amber inline-block w-1.5 h-1.5 rounded-full bg-disputed" />
            Critical Gaps ({criticalGaps?.length ?? 0})
          </h2>
          <div className="space-y-2">
            {criticalGaps && criticalGaps.length > 0 ? (
              (criticalGaps as KnowledgeGap[]).map((gap) => (
                <div key={gap.id} className="glass-panel p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs text-signal">{gap.gap_type}</p>
                      <p className="font-display text-sm text-text-primary mt-0.5 leading-snug">{gap.description}</p>
                    </div>
                    <span className="font-mono text-xs text-disputed shrink-0">
                      {Math.round(gap.urgency_score * 100)}%
                    </span>
                  </div>
                  <div className="confidence-bar mt-2">
                    <div className="h-full bg-disputed" style={{ width: `${Math.round(gap.urgency_score * 100)}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <div className="glass-panel p-6 text-center font-mono text-xs text-text-muted">No open gaps.</div>
            )}
          </div>
        </section>

        {/* Open Hypotheses */}
        <section className="space-y-3">
          <h2 className="font-mono text-xs text-hypothesis tracking-wider uppercase">
            Open Hypotheses ({openHypotheses?.length ?? 0})
          </h2>
          <div className="space-y-2">
            {openHypotheses && openHypotheses.length > 0 ? (
              (openHypotheses as Hypothesis[]).map((h) => (
                <div key={h.id} className="glass-panel p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-sm text-text-primary leading-snug">{h.title}</p>
                      <p className="font-mono text-xs text-text-muted mt-0.5 line-clamp-2">{h.description}</p>
                    </div>
                    <span className="hypothesis-badge shrink-0">{Math.round(h.confidence * 100)}%</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="glass-panel p-6 text-center font-mono text-xs text-text-muted">No open hypotheses.</div>
            )}
          </div>
        </section>

        {/* Recent Entities */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs text-text-muted tracking-wider uppercase">Recent Entities</h2>
            <Link href="/admin/entities" className="font-mono text-xs text-signal hover:underline">view all →</Link>
          </div>
          <div className="glass-panel overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {(recentEntities as Entity[])?.map((entity) => (
                  <tr key={entity.id} className="border-b border-border/50 hover:bg-raised/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/entities/${entity.id}`} className="font-display text-text-primary hover:text-signal transition-colors">
                        {entity.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`font-mono text-xs ${TYPE_COLORS[entity.type] ?? 'text-text-muted'}`}>
                        {entity.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-text-muted text-right">
                      {Math.round(entity.confidence_score * 100)}%
                    </td>
                  </tr>
                ))}
                {(!recentEntities || recentEntities.length === 0) && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center font-mono text-xs text-text-muted">
                      No entities yet.{' '}
                      <Link href="/admin/entities/new" className="text-signal hover:underline">Add one →</Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Unreviewed Convergences */}
        <section className="space-y-3">
          <h2 className="font-mono text-xs text-text-muted tracking-wider uppercase">
            Unreviewed Convergences ({recentConvergences?.length ?? 0})
          </h2>
          <div className="space-y-2">
            {recentConvergences && recentConvergences.length > 0 ? (
              (recentConvergences as ConvergenceEvent[]).map((ev) => (
                <div key={ev.id} className="glass-panel p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-xs text-text-muted">
                      {ev.claim_ids.length} claims · {ev.source_ids.length} sources
                    </p>
                    <span className="signal-badge">{Math.round(ev.significance_score * 100)}% sig</span>
                  </div>
                  {ev.notes && <p className="font-display text-sm text-text-secondary mt-1">{ev.notes}</p>}
                  <p className="font-mono text-xs text-text-muted mt-1">
                    {new Date(ev.detected_at).toLocaleDateString('en-CA')}
                  </p>
                </div>
              ))
            ) : (
              <div className="glass-panel p-6 text-center font-mono text-xs text-text-muted">No unreviewed convergences.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

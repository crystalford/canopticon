import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Entity, Claim, Relationship, KnowledgeGap } from '@/types/database'
import { ArrowLeft, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function EntityDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: entity } = await supabase
    .from('entities')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!entity) notFound()

  const e = entity as Entity

  const [{ data: claims }, { data: relationships }, { data: gaps }] = await Promise.all([
    supabase.from('claims').select('*').contains('entity_ids', [params.id]).order('created_at', { ascending: false }).limit(20),
    supabase.from('relationships').select('*, from:from_entity_id(name,type), to:to_entity_id(name,type)').or(`from_entity_id.eq.${params.id},to_entity_id.eq.${params.id}`).limit(20),
    supabase.from('knowledge_gaps').select('*').contains('entity_ids', [params.id]).eq('is_resolved', false).order('urgency_score', { ascending: false }).limit(10),
  ])

  const confidencePct = Math.round(e.confidence_score * 100)
  const resonancePct = Math.round(e.resonance_score * 100)

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/entities" className="text-text-muted hover:text-text-secondary transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl font-bold text-text-primary">{e.name}</h1>
            <span className="signal-badge">{e.type.replace(/_/g, ' ')}</span>
            {e.subtype && <span className="font-mono text-xs text-text-muted">{e.subtype}</span>}
          </div>
          <p className="font-mono text-xs text-text-muted mt-1">{e.entity_id}</p>
        </div>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-panel p-4 space-y-2">
          <p className="font-mono text-xs text-text-muted">CONFIDENCE</p>
          <p className="font-mono text-2xl text-confirmed">{confidencePct}%</p>
          <p className="font-mono text-xs text-text-muted">Evidence quality</p>
          <div className="confidence-bar">
            <div className="h-full bg-confirmed" style={{ width: `${confidencePct}%` }} />
          </div>
        </div>
        <div className="glass-panel p-4 space-y-2">
          <p className="font-mono text-xs text-text-muted">RESONANCE</p>
          <p className="font-mono text-2xl text-hypothesis">{resonancePct}%</p>
          <p className="font-mono text-xs text-text-muted">Belief spread</p>
          <div className="confidence-bar">
            <div className="h-full bg-hypothesis" style={{ width: `${resonancePct}%` }} />
          </div>
        </div>
      </div>

      {/* Description */}
      {e.description && (
        <div className="glass-panel p-4">
          <p className="font-body text-sm text-text-secondary leading-relaxed">{e.description}</p>
        </div>
      )}

      {/* Knowledge Gaps */}
      {gaps && gaps.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-mono text-xs text-signal tracking-wider uppercase">
            Open Knowledge Gaps ({gaps.length})
          </h2>
          <div className="space-y-2">
            {(gaps as KnowledgeGap[]).map((gap) => (
              <div key={gap.id} className="glass-panel p-3 flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs text-signal">{gap.gap_type}</p>
                  <p className="font-display text-sm text-text-primary mt-1">{gap.description}</p>
                </div>
                <span className="font-mono text-xs text-disputed shrink-0">
                  {Math.round(gap.urgency_score * 100)}% urgent
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Relationships */}
      <section className="space-y-3">
        <h2 className="font-mono text-xs text-text-muted tracking-wider uppercase">
          Relationships ({relationships?.length ?? 0})
        </h2>
        {relationships && relationships.length > 0 ? (
          <div className="glass-panel overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="font-mono text-xs text-text-muted text-left px-4 py-2">FROM</th>
                  <th className="font-mono text-xs text-text-muted text-left px-4 py-2">RELATION</th>
                  <th className="font-mono text-xs text-text-muted text-left px-4 py-2">TO</th>
                  <th className="font-mono text-xs text-text-muted text-left px-4 py-2">CONF</th>
                </tr>
              </thead>
              <tbody>
                {(relationships as unknown as Array<Relationship & { from: Pick<Entity,'name'|'type'>, to: Pick<Entity,'name'|'type'> }>).map((rel) => (
                  <tr key={rel.id} className="border-b border-border/50">
                    <td className="px-4 py-2 font-display text-xs text-text-primary">{rel.from?.name}</td>
                    <td className="px-4 py-2 font-mono text-xs text-signal">{rel.relationship_type}</td>
                    <td className="px-4 py-2 font-display text-xs text-text-primary">{rel.to?.name}</td>
                    <td className="px-4 py-2 font-mono text-xs text-text-muted">{Math.round(rel.confidence * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="font-mono text-xs text-text-muted">No relationships recorded.</p>
        )}
      </section>

      {/* Claims */}
      <section className="space-y-3">
        <h2 className="font-mono text-xs text-text-muted tracking-wider uppercase">
          Claims ({claims?.length ?? 0})
        </h2>
        {claims && claims.length > 0 ? (
          <div className="space-y-2">
            {(claims as Claim[]).map((claim) => (
              <div key={claim.id} className="glass-panel p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-xs px-2 py-0.5 rounded-sm border ${
                    claim.status === 'verified' ? 'confirmed-badge' :
                    claim.status === 'disputed' ? 'disputed-badge' :
                    'hypothesis-badge'
                  }`}>
                    {claim.status}
                  </span>
                  <span className="font-mono text-xs text-text-muted">
                    conf {Math.round(claim.confidence * 100)}% · resonance {Math.round(claim.resonance * 100)}%
                  </span>
                </div>
                <p className="font-body text-sm text-text-secondary leading-relaxed">{claim.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="font-mono text-xs text-text-muted">No claims recorded.</p>
        )}
      </section>
    </div>
  )
}

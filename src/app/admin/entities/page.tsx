import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Entity, EntityType } from '@/types/database'
import { Plus } from 'lucide-react'

export const dynamic = 'force-dynamic'

const TYPE_COLORS: Record<EntityType, string> = {
  person: 'text-hypothesis border-hypothesis/30 bg-hypothesis/10',
  organization: 'text-signal border-signal/30 bg-signal/10',
  corporation: 'text-signal border-signal/30 bg-signal/10',
  government_body: 'text-confirmed border-confirmed/30 bg-confirmed/10',
  political_party: 'text-brand border-brand/30 bg-brand/10',
  media_outlet: 'text-text-secondary border-border bg-raised',
  policy: 'text-text-secondary border-border bg-raised',
  event: 'text-text-secondary border-border bg-raised',
  place: 'text-text-secondary border-border bg-raised',
  concept: 'text-text-muted border-border bg-raised',
}

export default async function EntitiesPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string }
}) {
  const supabase = createClient()

  let query = supabase
    .from('entities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (searchParams.q) {
    query = query.ilike('name', `%${searchParams.q}%`)
  }
  if (searchParams.type) {
    query = query.eq('type', searchParams.type as EntityType)
  }

  const { data: entities } = await query

  const TYPES: EntityType[] = [
    'person', 'organization', 'corporation', 'government_body',
    'political_party', 'media_outlet', 'policy', 'event', 'place', 'concept',
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-text-primary">Entities</h1>
          <p className="font-mono text-xs text-text-muted mt-1">
            {entities?.length ?? 0} records
          </p>
        </div>
        <Link href="/admin/entities/new" className="btn-primary flex items-center gap-2">
          <Plus size={14} />
          New Entity
        </Link>
      </div>

      {/* Filters */}
      <form className="flex gap-3 flex-wrap">
        <input
          name="q"
          defaultValue={searchParams.q}
          placeholder="Search entities..."
          className="input-field max-w-xs"
        />
        <select
          name="type"
          defaultValue={searchParams.type ?? ''}
          className="input-field max-w-[180px]"
        >
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t.replace('_', ' ')}</option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">Filter</button>
        {(searchParams.q || searchParams.type) && (
          <Link href="/admin/entities" className="btn-ghost">Clear</Link>
        )}
      </form>

      {/* Table */}
      <div className="glass-panel overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="font-mono text-xs text-text-muted text-left px-4 py-3">NAME</th>
              <th className="font-mono text-xs text-text-muted text-left px-4 py-3">TYPE</th>
              <th className="font-mono text-xs text-text-muted text-left px-4 py-3 hidden sm:table-cell">CONFIDENCE</th>
              <th className="font-mono text-xs text-text-muted text-left px-4 py-3 hidden md:table-cell">RESONANCE</th>
              <th className="font-mono text-xs text-text-muted text-left px-4 py-3 hidden lg:table-cell">ADDED</th>
            </tr>
          </thead>
          <tbody>
            {(entities as Entity[])?.map((entity) => (
              <tr key={entity.id} className="border-b border-border/50 hover:bg-raised/50 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/admin/entities/${entity.id}`} className="font-display text-text-primary hover:text-signal transition-colors">
                    {entity.name}
                  </Link>
                  {entity.subtype && (
                    <span className="font-mono text-xs text-text-muted ml-2">{entity.subtype}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`font-mono text-xs px-2 py-0.5 rounded-sm border ${TYPE_COLORS[entity.type]}`}>
                    {entity.type.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <ConfidenceBar value={entity.confidence_score} />
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <ConfidenceBar value={entity.resonance_score} color="hypothesis" />
                </td>
                <td className="px-4 py-3 hidden lg:table-cell font-mono text-xs text-text-muted">
                  {new Date(entity.created_at).toLocaleDateString('en-CA')}
                </td>
              </tr>
            ))}
            {(!entities || entities.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center font-mono text-xs text-text-muted">
                  No entities found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ConfidenceBar({ value, color = 'confirmed' }: { value: number; color?: string }) {
  const pct = Math.round(value * 100)
  const barColor = value >= 0.7 ? 'bg-confirmed' : value >= 0.4 ? 'bg-hypothesis' : 'bg-disputed'
  return (
    <div className="flex items-center gap-2">
      <div className="confidence-bar w-16">
        <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-text-muted">{pct}%</span>
    </div>
  )
}

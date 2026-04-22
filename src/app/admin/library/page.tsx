import { createClient } from '@/lib/supabase/server'
import type { Source } from '@/types/database'
import AddSourceForm from './AddSourceForm'
import { ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'

const TIER_LABELS: Record<string, { label: string; style: string }> = {
  A: { label: 'A — Completely Reliable', style: 'text-confirmed border-confirmed/30 bg-confirmed/10' },
  B: { label: 'B — Usually Reliable', style: 'text-confirmed border-confirmed/20 bg-confirmed/5' },
  C: { label: 'C — Fairly Reliable', style: 'text-signal border-signal/30 bg-signal/10' },
  D: { label: 'D — Not Usually Reliable', style: 'text-signal border-signal/20 bg-signal/5' },
  E: { label: 'E — Unreliable', style: 'text-disputed border-disputed/30 bg-disputed/10' },
  F: { label: 'F — Cannot Be Judged', style: 'text-text-muted border-border bg-raised' },
}

export default async function LibraryPage({ searchParams }: { searchParams: { tier?: string; q?: string } }) {
  const supabase = createClient()

  let query = supabase.from('sources').select('*').order('created_at', { ascending: false }).limit(100)
  if (searchParams.tier) query = query.eq('reliability_tier', searchParams.tier)
  if (searchParams.q) query = query.or(`title.ilike.%${searchParams.q}%,url.ilike.%${searchParams.q}%`)

  const { data: sources } = await query

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-xl font-bold text-text-primary">Library</h1>
        <p className="font-mono text-xs text-text-muted mt-1">
          {sources?.length ?? 0} sources · NATO Admiralty reliability (A–F)
        </p>
      </div>

      <AddSourceForm />

      {/* Filter bar */}
      <form className="flex gap-3 flex-wrap items-center">
        <input name="q" defaultValue={searchParams.q} placeholder="Search sources..." className="input-field max-w-xs" />
        <select name="tier" defaultValue={searchParams.tier ?? ''} className="input-field max-w-[200px]">
          <option value="">All tiers</option>
          {Object.entries(TIER_LABELS).map(([t, { label }]) => (
            <option key={t} value={t}>{label}</option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">Filter</button>
      </form>

      {/* Sources table */}
      <div className="glass-panel overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="font-mono text-xs text-text-muted text-left px-4 py-3">SOURCE</th>
              <th className="font-mono text-xs text-text-muted text-left px-4 py-3">TIER</th>
              <th className="font-mono text-xs text-text-muted text-left px-4 py-3 hidden md:table-cell">PUBLISHED</th>
            </tr>
          </thead>
          <tbody>
            {(sources as Source[])?.map((source) => (
              <tr key={source.id} className="border-b border-border/50 hover:bg-raised/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-sm text-text-primary line-clamp-1">
                        {source.title ?? 'Untitled'}
                      </p>
                      <a href={source.url} target="_blank" rel="noopener noreferrer"
                        className="font-mono text-xs text-hypothesis hover:underline flex items-center gap-1 truncate max-w-xs">
                        {source.url}
                        <ExternalLink size={10} className="shrink-0" />
                      </a>
                      {source.author && (
                        <p className="font-mono text-xs text-text-muted">{source.author}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`font-mono text-xs px-2 py-0.5 rounded-sm border ${TIER_LABELS[source.reliability_tier]?.style}`}>
                    {source.reliability_tier}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell font-mono text-xs text-text-muted">
                  {source.published_at
                    ? new Date(source.published_at).toLocaleDateString('en-CA')
                    : '—'}
                </td>
              </tr>
            ))}
            {(!sources || sources.length === 0) && (
              <tr><td colSpan={3} className="px-4 py-12 text-center font-mono text-xs text-text-muted">No sources in library.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

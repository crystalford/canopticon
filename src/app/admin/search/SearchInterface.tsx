'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Loader2 } from 'lucide-react'

interface ClaimResult {
  id: string
  content: string
  confidence: number
  resonance: number
  status: string
  similarity?: number
}

interface EntityResult {
  id: string
  name: string
  type: string
  confidence_score: number
  description?: string
}

export default function SearchInterface() {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'semantic' | 'keyword'>('keyword')
  const [loading, setLoading] = useState(false)
  const [claims, setClaims] = useState<ClaimResult[]>([])
  const [entities, setEntities] = useState<EntityResult[]>([])
  const [searched, setSearched] = useState(false)

  async function search() {
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)

    const [claimsRes, entitiesRes] = await Promise.all([
      fetch(`/api/claims?q=${encodeURIComponent(query)}&limit=20&semantic=${mode === 'semantic'}`),
      fetch(`/api/entities?q=${encodeURIComponent(query)}&limit=10`),
    ])

    const [claimsData, entitiesData] = await Promise.all([
      claimsRes.json(),
      entitiesRes.json(),
    ])

    setClaims(Array.isArray(claimsData) ? claimsData : [])
    setEntities(Array.isArray(entitiesData) ? entitiesData : [])
    setLoading(false)
  }

  const STATUS_COLORS: Record<string, string> = {
    verified: 'text-confirmed border-confirmed/30',
    unverified: 'text-text-muted border-border',
    disputed: 'text-disputed border-disputed/30',
    retracted: 'text-text-muted border-border line-through',
  }

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            className="input-field pl-9 w-full"
            placeholder="Search entities and claims..."
            autoFocus
          />
        </div>
        <div className="flex border border-border rounded-sm overflow-hidden">
          <button
            onClick={() => setMode('keyword')}
            className={`font-mono text-xs px-3 py-2 transition-colors ${mode === 'keyword' ? 'bg-signal text-void' : 'text-text-muted hover:text-text-secondary'}`}
          >
            Keyword
          </button>
          <button
            onClick={() => setMode('semantic')}
            className={`font-mono text-xs px-3 py-2 transition-colors ${mode === 'semantic' ? 'bg-signal text-void' : 'text-text-muted hover:text-text-secondary'}`}
          >
            Semantic
          </button>
        </div>
        <button onClick={search} disabled={loading} className="btn-primary disabled:opacity-50 flex items-center gap-2">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Search
        </button>
      </div>

      {mode === 'semantic' && (
        <p className="font-mono text-xs text-text-muted">Semantic mode uses vector embeddings — requires OPENAI_API_KEY. Falls back to keyword if unavailable.</p>
      )}

      {/* Results */}
      {searched && !loading && (
        <div className="space-y-8">
          {/* Entity results */}
          {entities.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-display text-sm font-semibold text-text-secondary tracking-wider uppercase">
                Entities <span className="font-mono text-text-muted normal-case font-normal">{entities.length}</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {entities.map((e) => (
                  <Link
                    key={e.id}
                    href={`/admin/entities/${e.id}`}
                    className="glass-panel p-4 hover:border-signal/30 transition-colors block"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] text-signal">{e.type}</span>
                      <span className="font-mono text-[10px] text-text-muted">{Math.round(e.confidence_score * 100)}% confidence</span>
                    </div>
                    <p className="font-display text-sm font-semibold text-text-primary">{e.name}</p>
                    {e.description && (
                      <p className="font-mono text-xs text-text-muted mt-1 line-clamp-2">{e.description}</p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Claim results */}
          {claims.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-display text-sm font-semibold text-text-secondary tracking-wider uppercase">
                Claims <span className="font-mono text-text-muted normal-case font-normal">{claims.length}</span>
              </h3>
              <div className="space-y-2">
                {claims.map((c) => (
                  <div key={c.id} className="glass-panel p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-sm border ${STATUS_COLORS[c.status] ?? ''}`}>{c.status}</span>
                      <span className="font-mono text-[10px] text-text-muted">conf {Math.round(c.confidence * 100)}%</span>
                      <span className="font-mono text-[10px] text-text-muted">res {Math.round(c.resonance * 100)}%</span>
                      {c.similarity !== undefined && (
                        <span className="font-mono text-[10px] text-hypothesis ml-auto">similarity {Math.round(c.similarity * 100)}%</span>
                      )}
                    </div>
                    <p className="font-body text-sm text-text-secondary leading-relaxed">{c.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {entities.length === 0 && claims.length === 0 && (
            <p className="font-mono text-xs text-text-muted">No results for &quot;{query}&quot;.</p>
          )}
        </div>
      )}
    </div>
  )
}

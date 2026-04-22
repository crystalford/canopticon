'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Play, Trash2, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'

interface ResearchQuery {
  id: string
  query_text: string
  category: string
  is_active: boolean
  last_run_at: string | null
  last_result_summary: string | null
  run_count: number
  created_at: string
}

const CATEGORIES = ['daily_sweep', 'entity_monitor', 'deep_dive', 'relationship_probe']

const CATEGORY_COLORS: Record<string, string> = {
  daily_sweep: 'text-signal border-signal/30',
  entity_monitor: 'text-hypothesis border-hypothesis/30',
  deep_dive: 'text-confirmed border-confirmed/30',
  relationship_probe: 'text-text-secondary border-border',
}

export default function ResearchQueryManager({ queries: initial }: { queries: ResearchQuery[] }) {
  const router = useRouter()
  const [queries, setQueries] = useState(initial)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<string | null>(null)
  const [newQuery, setNewQuery] = useState({ query_text: '', category: 'daily_sweep' })
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)

  async function runAll() {
    setRunning(true)
    setRunResult(null)
    const res = await fetch('/api/research-agent', {
      method: 'GET',
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ''}` },
    })
    const json = await res.json()
    setRunResult(`Ran ${json.ran} queries, ${json.failed} failed. Results pushed to intake queue.`)
    setRunning(false)
    router.refresh()
  }

  async function toggleActive(id: string, current: boolean) {
    await fetch(`/api/research-queries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !current }),
    })
    setQueries(queries.map((q) => q.id === id ? { ...q, is_active: !current } : q))
  }

  async function deleteQuery(id: string) {
    if (!confirm('Delete this research query?')) return
    await fetch(`/api/research-queries/${id}`, { method: 'DELETE' })
    setQueries(queries.filter((q) => q.id !== id))
  }

  async function addQuery() {
    if (!newQuery.query_text.trim()) return
    setAdding(true)
    const res = await fetch('/api/research-queries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newQuery),
    })
    const json = await res.json()
    if (json.id) {
      setQueries([{ id: json.id, ...newQuery, is_active: true, last_run_at: null, last_result_summary: null, run_count: 0, created_at: new Date().toISOString() }, ...queries])
      setNewQuery({ query_text: '', category: 'daily_sweep' })
      setShowForm(false)
    }
    setAdding(false)
  }

  const active = queries.filter((q) => q.is_active)

  return (
    <div className="space-y-4">
      {/* Run button */}
      <div className="flex items-center gap-3">
        <button onClick={runAll} disabled={running || active.length === 0}
          className="btn-primary flex items-center gap-2 disabled:opacity-50">
          {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {running ? 'Running...' : `Run ${active.length} Active Queries`}
        </button>
        <button onClick={() => setShowForm(!showForm)} className="btn-secondary flex items-center gap-2">
          <Plus size={14} /> Add Query
        </button>
      </div>

      {runResult && (
        <div className="glass-panel p-3 border-confirmed/30">
          <p className="font-mono text-xs text-confirmed">{runResult}</p>
          <p className="font-mono text-xs text-text-muted mt-1">Check the Intake queue to process extracted intelligence.</p>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="glass-panel p-4 space-y-3 border-signal/20">
          <textarea
            value={newQuery.query_text}
            onChange={(e) => setNewQuery({ ...newQuery, query_text: e.target.value })}
            rows={3}
            className="input-field font-mono text-xs resize-y w-full"
            placeholder="Ask a research question about Canadian politics, power structures, or specific entities..."
            autoFocus
          />
          <div className="flex gap-3">
            <select value={newQuery.category} onChange={(e) => setNewQuery({ ...newQuery, category: e.target.value })} className="input-field">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
            <button onClick={addQuery} disabled={adding} className="btn-primary disabled:opacity-50">
              {adding ? 'Adding...' : 'Add'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {/* Query list */}
      <div className="space-y-2">
        {queries.map((q) => (
          <div key={q.id} className={`glass-panel p-4 ${!q.is_active ? 'opacity-50' : ''}`}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-sm border ${CATEGORY_COLORS[q.category] ?? 'text-text-muted border-border'}`}>
                    {q.category.replace('_', ' ')}
                  </span>
                  <span className="font-mono text-[10px] text-text-muted">{q.run_count} runs</span>
                  {q.last_run_at && (
                    <span className="font-mono text-[10px] text-text-muted">
                      last {new Date(q.last_run_at).toLocaleDateString('en-CA')}
                    </span>
                  )}
                </div>
                <p className="font-mono text-xs text-text-primary leading-relaxed">{q.query_text}</p>
                {q.last_result_summary && (
                  <p className="font-mono text-[10px] text-text-muted mt-2 line-clamp-2">{q.last_result_summary}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggleActive(q.id, q.is_active)} className="text-text-muted hover:text-signal transition-colors" title={q.is_active ? 'Deactivate' : 'Activate'}>
                  {q.is_active ? <ToggleRight size={18} className="text-signal" /> : <ToggleLeft size={18} />}
                </button>
                <button onClick={() => deleteQuery(q.id)} className="text-text-muted hover:text-disputed transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {queries.length === 0 && (
          <div className="glass-panel p-8 text-center">
            <p className="font-mono text-xs text-text-muted">No research queries yet. Add one above.</p>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Play, CheckCircle, AlertCircle } from 'lucide-react'

type JobResult = { ok: boolean; data: Record<string, unknown> | null; error: string | null }

export default function JobRunner({
  label,
  description,
  endpoint,
}: {
  key: string
  label: string
  description: string
  endpoint: string
}) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<JobResult | null>(null)

  async function run() {
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ''}` },
      })
      const data = await res.json()
      setResult({ ok: res.ok, data, error: res.ok ? null : (data.error ?? 'Job failed') })
    } catch (err) {
      setResult({ ok: false, data: null, error: String(err) })
    }
    setRunning(false)
  }

  return (
    <div className="bg-void border border-border rounded-sm p-3 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-display text-sm text-text-primary">{label}</p>
          {result && (
            result.ok
              ? <CheckCircle size={13} className="text-confirmed" />
              : <AlertCircle size={13} className="text-disputed" />
          )}
        </div>
        <p className="font-mono text-xs text-text-muted mt-0.5">{description}</p>
        {result && (
          <pre className="font-mono text-xs mt-2 p-2 rounded-sm bg-base overflow-x-auto max-h-24 text-text-muted">
            {result.ok
              ? JSON.stringify(result.data, null, 2)
              : result.error}
          </pre>
        )}
      </div>
      <button
        onClick={run}
        disabled={running}
        className="flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded-sm border border-signal/30 text-signal hover:bg-signal/10 transition-colors disabled:opacity-50 shrink-0 mt-0.5"
      >
        <Play size={11} className={running ? 'animate-spin' : ''} />
        {running ? 'Running...' : 'Run Now'}
      </button>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HypothesisActions({ hypothesisId }: { hypothesisId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function updateStatus(status: string) {
    setLoading(true)
    await fetch('/api/hypotheses', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: hypothesisId, status }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex gap-2 shrink-0">
      <button onClick={() => updateStatus('confirmed')} disabled={loading}
        className="font-mono text-xs px-3 py-1 rounded-sm border border-confirmed/30 text-confirmed hover:bg-confirmed/10 transition-colors disabled:opacity-50">
        Confirm
      </button>
      <button onClick={() => updateStatus('refuted')} disabled={loading}
        className="font-mono text-xs px-3 py-1 rounded-sm border border-disputed/30 text-disputed hover:bg-disputed/10 transition-colors disabled:opacity-50">
        Refute
      </button>
    </div>
  )
}

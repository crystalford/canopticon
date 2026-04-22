'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function IntakeActions({ itemId, status }: { itemId: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function updateStatus(newStatus: string) {
    setLoading(true)
    await fetch('/api/intake', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId, status: newStatus }),
    })
    setLoading(false)
    router.refresh()
  }

  if (status === 'done' || status === 'rejected') return null

  return (
    <div className="flex items-center gap-2 shrink-0">
      {status === 'pending' && (
        <button
          onClick={() => updateStatus('processing')}
          disabled={loading}
          className="font-mono text-xs px-3 py-1 rounded-sm border border-signal/30 text-signal hover:bg-signal/10 transition-colors disabled:opacity-50"
        >
          {loading ? '...' : 'Process'}
        </button>
      )}
      <button
        onClick={() => updateStatus('rejected')}
        disabled={loading}
        className="font-mono text-xs px-3 py-1 rounded-sm border border-disputed/30 text-disputed hover:bg-disputed/10 transition-colors disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  )
}

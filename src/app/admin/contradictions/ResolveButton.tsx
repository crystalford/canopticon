'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ResolveButton({ contradictionId }: { contradictionId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState('')

  async function resolve() {
    setLoading(true)
    await fetch('/api/contradictions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contradictionId, resolution_notes: notes }),
    })
    setLoading(false)
    setShowNotes(false)
    router.refresh()
  }

  if (showNotes) {
    return (
      <div className="flex items-center gap-2">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Resolution notes..."
          className="input-field text-xs py-1 w-48"
        />
        <button onClick={resolve} disabled={loading}
          className="font-mono text-xs px-3 py-1 rounded-sm border border-confirmed/30 text-confirmed hover:bg-confirmed/10 transition-colors disabled:opacity-50">
          {loading ? '...' : 'Confirm'}
        </button>
        <button onClick={() => setShowNotes(false)}
          className="font-mono text-xs text-text-muted hover:text-text-secondary">
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button onClick={() => setShowNotes(true)}
      className="font-mono text-xs px-3 py-1 rounded-sm border border-confirmed/30 text-confirmed hover:bg-confirmed/10 transition-colors">
      Resolve
    </button>
  )
}

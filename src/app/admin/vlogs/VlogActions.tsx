'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function VlogActions({ vlogId, status }: { vlogId: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const newStatus = status === 'published' ? 'draft' : 'published'
    await fetch(`/api/vlogs/${vlogId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <button onClick={toggle} disabled={loading}
      className={`font-mono text-xs px-3 py-1 rounded-sm border transition-colors disabled:opacity-50 shrink-0 ${
        status === 'published'
          ? 'border-text-muted text-text-muted hover:border-disputed hover:text-disputed'
          : 'border-confirmed/30 text-confirmed hover:bg-confirmed/10'
      }`}>
      {loading ? '...' : status === 'published' ? 'Unpublish' : 'Publish'}
    </button>
  )
}

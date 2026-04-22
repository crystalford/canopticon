'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ArticleActions({ articleId, status }: { articleId: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function togglePublish() {
    setLoading(true)
    const newStatus = status === 'published' ? 'draft' : 'published'
    await fetch(`/api/articles/${articleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, published_at: newStatus === 'published' ? new Date().toISOString() : null }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <button onClick={togglePublish} disabled={loading}
      className={`font-mono text-xs px-3 py-1 rounded-sm border transition-colors disabled:opacity-50 ${
        status === 'published'
          ? 'border-text-muted text-text-muted hover:border-disputed hover:text-disputed'
          : 'border-confirmed/30 text-confirmed hover:bg-confirmed/10'
      }`}>
      {loading ? '...' : status === 'published' ? 'Unpublish' : 'Publish'}
    </button>
  )
}

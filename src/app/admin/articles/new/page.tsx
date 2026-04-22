'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewArticlePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const res = await fetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: fd.get('title'),
        content: fd.get('content'),
        summary: fd.get('summary') || null,
        status: fd.get('status'),
      }),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to create')
      setSaving(false)
      return
    }
    const { id } = await res.json()
    router.push(`/admin/articles/${id}`)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-display text-xl font-bold text-text-primary">New Article</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="font-mono text-xs text-text-secondary">TITLE *</label>
          <input name="title" required className="input-field" />
        </div>
        <div className="space-y-1">
          <label className="font-mono text-xs text-text-secondary">SUMMARY</label>
          <input name="summary" className="input-field" placeholder="One-sentence summary" />
        </div>
        <div className="space-y-1">
          <label className="font-mono text-xs text-text-secondary">CONTENT (Markdown) *</label>
          <textarea name="content" required rows={20} className="input-field font-mono text-xs resize-y" />
        </div>
        <div className="space-y-1">
          <label className="font-mono text-xs text-text-secondary">STATUS</label>
          <select name="status" defaultValue="draft" className="input-field max-w-[160px]">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
        {error && <p className="font-mono text-xs text-disputed bg-disputed/10 border border-disputed/30 px-3 py-2 rounded-sm">{error}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : 'Create Article'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </div>
  )
}

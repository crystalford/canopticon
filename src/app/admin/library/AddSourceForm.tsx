'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronDown, ChevronUp } from 'lucide-react'

export default function AddSourceForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: fd.get('url'),
        title: fd.get('title') || null,
        author: fd.get('author') || null,
        published_at: fd.get('published_at') || null,
        reliability_tier: fd.get('reliability_tier'),
      }),
    })
    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <div className="glass-panel overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-raised/50 transition-colors">
        <span className="font-display text-sm text-text-primary flex items-center gap-2">
          <Plus size={14} className="text-signal" /> Add Source
        </span>
        {open ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
      </button>
      {open && (
        <form onSubmit={handleSubmit} className="px-4 pb-4 border-t border-border pt-3 grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <label className="font-mono text-xs text-text-secondary">URL *</label>
            <input name="url" required type="url" className="input-field" placeholder="https://..." />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-xs text-text-secondary">TITLE</label>
            <input name="title" className="input-field" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-xs text-text-secondary">AUTHOR</label>
            <input name="author" className="input-field" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-xs text-text-secondary">PUBLISHED DATE</label>
            <input name="published_at" type="date" className="input-field" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-xs text-text-secondary">RELIABILITY TIER</label>
            <select name="reliability_tier" defaultValue="C" className="input-field">
              {['A','B','C','D','E','F'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? 'Adding...' : 'Add to Library'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronDown, ChevronUp } from 'lucide-react'

export default function NewVlogForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    await fetch('/api/vlogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: fd.get('title'),
        youtube_url: fd.get('youtube_url') || null,
        script: fd.get('script') || null,
        status: fd.get('status'),
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
          <Plus size={14} className="text-signal" /> New Vlog
        </span>
        {open ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
      </button>
      {open && (
        <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <div className="space-y-1">
            <label className="font-mono text-xs text-text-secondary">TITLE *</label>
            <input name="title" required className="input-field" placeholder="e.g. The Carney Network — Episode 1" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-xs text-text-secondary">YOUTUBE URL</label>
            <input name="youtube_url" type="url" className="input-field" placeholder="https://youtube.com/watch?v=..." />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-xs text-text-secondary">SCRIPT / NOTES</label>
            <textarea name="script" rows={6} className="input-field resize-y font-body text-sm"
              placeholder="Script, research notes, talking points..." />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-xs text-text-secondary">STATUS</label>
            <select name="status" defaultValue="draft" className="input-field max-w-[160px]">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : 'Create Vlog'}
          </button>
        </form>
      )}
    </div>
  )
}

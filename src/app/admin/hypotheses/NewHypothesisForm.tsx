'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronDown, ChevronUp } from 'lucide-react'

export default function NewHypothesisForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    await fetch('/api/hypotheses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: fd.get('title'),
        description: fd.get('description'),
        confidence: parseFloat(fd.get('confidence') as string),
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
          <Plus size={14} className="text-signal" /> New Hypothesis
        </span>
        {open ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
      </button>
      {open && (
        <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <div className="space-y-1">
            <label className="font-mono text-xs text-text-secondary">TITLE *</label>
            <input name="title" required className="input-field" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-xs text-text-secondary">DESCRIPTION *</label>
            <textarea name="description" required rows={4} className="input-field resize-y" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-xs text-text-secondary">INITIAL CONFIDENCE (0–1)</label>
            <input name="confidence" type="number" min="0" max="1" step="0.05" defaultValue="0.3" className="input-field max-w-[120px]" />
          </div>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : 'Create Hypothesis'}
          </button>
        </form>
      )}
    </div>
  )
}

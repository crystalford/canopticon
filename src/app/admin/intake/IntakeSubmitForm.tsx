'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronDown, ChevronUp } from 'lucide-react'

export default function IntakeSubmitForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    const fd = new FormData(e.currentTarget)
    await fetch('/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        raw_content: fd.get('raw_content'),
        source_url: fd.get('source_url') || null,
      }),
    })
    setSubmitting(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <div className="glass-panel overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-raised/50 transition-colors"
      >
        <span className="font-display text-sm text-text-primary flex items-center gap-2">
          <Plus size={14} className="text-signal" /> Submit Content for Intake
        </span>
        {open ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
      </button>
      {open && (
        <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <div className="space-y-1">
            <label className="font-mono text-xs text-text-secondary">SOURCE URL</label>
            <input name="source_url" type="url" className="input-field" placeholder="https://..." />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-xs text-text-secondary">CONTENT *</label>
            <textarea name="raw_content" required rows={5} className="input-field resize-y" placeholder="Paste article text, notes, or raw intelligence..." />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
            {submitting ? 'Submitting...' : 'Add to Queue'}
          </button>
        </form>
      )}
    </div>
  )
}

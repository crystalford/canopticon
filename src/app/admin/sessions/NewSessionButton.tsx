'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

export default function NewSessionButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: fd.get('title'), description: fd.get('description') }),
    })
    const { id } = await res.json()
    setLoading(false)
    setOpen(false)
    router.push(`/admin/sessions/${id}`)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2">
        <Plus size={14} /> New Session
      </button>
      {open && (
        <div className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSubmit} className="glass-panel p-6 w-full max-w-md space-y-4">
            <h2 className="font-display text-base font-bold text-text-primary">New Intelligence Session</h2>
            <div className="space-y-1">
              <label className="font-mono text-xs text-text-secondary">TITLE *</label>
              <input name="title" required className="input-field" placeholder="e.g. Carney — WEF connections" />
            </div>
            <div className="space-y-1">
              <label className="font-mono text-xs text-text-secondary">DESCRIPTION</label>
              <textarea name="description" rows={3} className="input-field resize-none" placeholder="What are you investigating?" />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
                {loading ? 'Creating...' : 'Start Session'}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EntityType } from '@/types/database'

const ENTITY_TYPES: EntityType[] = [
  'person', 'organization', 'corporation', 'government_body',
  'political_party', 'media_outlet', 'policy', 'event', 'place', 'concept',
]

export default function NewEntityPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const fd = new FormData(e.currentTarget)
    const body = {
      name: fd.get('name') as string,
      type: fd.get('type') as EntityType,
      subtype: (fd.get('subtype') as string) || null,
      description: (fd.get('description') as string) || null,
      confidence_score: parseFloat(fd.get('confidence_score') as string),
      resonance_score: parseFloat(fd.get('resonance_score') as string),
    }

    const res = await fetch('/api/entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to create entity.')
      setSaving(false)
      return
    }

    const { id } = await res.json()
    router.push(`/admin/entities/${id}`)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-text-primary">New Entity</h1>
        <p className="font-mono text-xs text-text-muted mt-1">Add an entity to the knowledge graph.</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1">
            <label className="font-mono text-xs text-text-secondary">NAME *</label>
            <input name="name" required className="input-field" placeholder="e.g. Mark Carney" />
          </div>

          <div className="space-y-1">
            <label className="font-mono text-xs text-text-secondary">TYPE *</label>
            <select name="type" required defaultValue="" className="input-field">
              <option value="" disabled>Select type…</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-mono text-xs text-text-secondary">SUBTYPE</label>
            <input name="subtype" className="input-field" placeholder="e.g. Central Banker" />
          </div>

          <div className="col-span-2 space-y-1">
            <label className="font-mono text-xs text-text-secondary">DESCRIPTION</label>
            <textarea name="description" rows={3} className="input-field resize-none" placeholder="Brief description of this entity's relevance." />
          </div>

          <div className="space-y-1">
            <label className="font-mono text-xs text-text-secondary">
              CONFIDENCE <span className="text-text-muted">(evidence quality 0–1)</span>
            </label>
            <input
              name="confidence_score"
              type="number"
              min="0" max="1" step="0.05"
              defaultValue="0.5"
              required
              className="input-field"
            />
          </div>

          <div className="space-y-1">
            <label className="font-mono text-xs text-text-secondary">
              RESONANCE <span className="text-text-muted">(belief spread 0–1)</span>
            </label>
            <input
              name="resonance_score"
              type="number"
              min="0" max="1" step="0.05"
              defaultValue="0.0"
              required
              className="input-field"
            />
          </div>
        </div>

        {error && (
          <p className="font-mono text-xs text-disputed bg-disputed/10 border border-disputed/30 px-3 py-2 rounded-sm">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Creating...' : 'Create Entity'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

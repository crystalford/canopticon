'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SystemPrompt } from '@/types/database'

export default function SystemPromptsEditor({ prompts }: { prompts: SystemPrompt[] }) {
  const [contents, setContents] = useState<Record<string, string>>(
    Object.fromEntries(prompts.map((p) => [p.key, p.content]))
  )
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  async function save(key: string) {
    setSaving(key)
    const supabase = createClient()
    await supabase.from('system_prompts').update({ content: contents[key], updated_at: new Date().toISOString() }).eq('key', key)
    setSaving(null)
    setSaved(key)
    setTimeout(() => setSaved(null), 2000)
  }

  return (
    <div className="space-y-6">
      {prompts.map((prompt) => (
        <div key={prompt.key} className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-mono text-xs text-signal tracking-wider">{prompt.key}</label>
            <button
              onClick={() => save(prompt.key)}
              disabled={saving === prompt.key}
              className="font-mono text-xs px-3 py-1 rounded-sm border border-signal/30 text-signal hover:bg-signal/10 transition-colors disabled:opacity-50"
            >
              {saving === prompt.key ? 'saving...' : saved === prompt.key ? 'saved ✓' : 'save'}
            </button>
          </div>
          <textarea
            value={contents[prompt.key] ?? ''}
            onChange={(e) => setContents((s) => ({ ...s, [prompt.key]: e.target.value }))}
            rows={6}
            className="input-field font-body text-xs resize-y"
          />
        </div>
      ))}
    </div>
  )
}

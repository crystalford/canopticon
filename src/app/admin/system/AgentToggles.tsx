'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Agent } from '@/types/database'

export default function AgentToggles({ agents }: { agents: Agent[] }) {
  const [states, setStates] = useState<Record<string, boolean>>(
    Object.fromEntries(agents.map((a) => [a.id, a.is_active]))
  )
  const [saving, setSaving] = useState<string | null>(null)

  async function toggle(id: string) {
    setSaving(id)
    const next = !states[id]
    const supabase = createClient()
    await supabase.from('agents').update({ is_active: next }).eq('id', id)
    setStates((s) => ({ ...s, [id]: next }))
    setSaving(null)
  }

  return (
    <div className="space-y-2">
      {agents.map((agent) => (
        <div key={agent.id} className="flex items-center justify-between bg-void border border-border rounded-sm px-4 py-3">
          <div>
            <p className="font-display text-sm text-text-primary">{agent.name}</p>
            <p className="font-mono text-xs text-text-muted">{agent.model_id} · {agent.type}</p>
          </div>
          <button
            onClick={() => toggle(agent.id)}
            disabled={saving === agent.id}
            className={`font-mono text-xs px-3 py-1 rounded-sm border transition-colors ${
              states[agent.id]
                ? 'bg-confirmed/10 text-confirmed border-confirmed/30 hover:bg-confirmed/20'
                : 'bg-void text-text-muted border-border hover:border-signal/30'
            }`}
          >
            {saving === agent.id ? '...' : states[agent.id] ? 'active' : 'inactive'}
          </button>
        </div>
      ))}
    </div>
  )
}

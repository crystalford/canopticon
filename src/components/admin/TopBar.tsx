'use client'

import { useEffect, useState } from 'react'
import { logout } from '@/app/login/actions'
import type { GraphHealth } from '@/types/database'

export default function TopBar() {
  const [time, setTime] = useState('')
  const [health, setHealth] = useState<GraphHealth | null>(null)

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(
        now.toLocaleTimeString('en-CA', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'America/Toronto',
        })
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => null)
  }, [])

  return (
    <header className="h-12 bg-base border-b border-border flex items-center px-4 gap-4 shrink-0">
      <span className="font-display text-sm font-bold text-brand tracking-widest">
        CANOPTICON
      </span>

      <div className="flex-1 flex justify-center">
        <span className="font-mono text-xs text-text-secondary tick">
          {time || '——:——:——'} ET
        </span>
      </div>

      <div className="flex items-center gap-4">
        {health && (
          <div className="flex items-center gap-3 font-mono text-xs text-text-muted">
            <span>
              <span className="text-text-secondary">{health.entities}</span> entities
            </span>
            <span className="text-border">|</span>
            <span>
              <span className="text-text-secondary">{health.relationships}</span> relationships
            </span>
            <span className="text-border">|</span>
            <span className={health.open_gaps > 0 ? 'text-signal' : 'text-text-secondary'}>
              {health.open_gaps} gaps
            </span>
          </div>
        )}

        <form action={logout}>
          <button
            type="submit"
            className="font-mono text-xs text-text-muted hover:text-disputed transition-colors"
          >
            sign out
          </button>
        </form>
      </div>
    </header>
  )
}

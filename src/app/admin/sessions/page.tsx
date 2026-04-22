import { createClient } from '@/lib/supabase/server'
import type { Session } from '@/types/database'
import Link from 'next/link'
import NewSessionButton from './NewSessionButton'
import { MessageSquare } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SessionsPage() {
  const supabase = createClient()
  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-text-primary">Sessions</h1>
          <p className="font-mono text-xs text-text-muted mt-1">AI intelligence sessions — structured research threads.</p>
        </div>
        <NewSessionButton />
      </div>

      <div className="space-y-2">
        {(sessions as Session[])?.map((session) => (
          <Link key={session.id} href={`/admin/sessions/${session.id}`}
            className="glass-panel p-4 flex items-start gap-4 hover:border-signal/30 transition-colors block">
            <MessageSquare size={16} className="text-text-muted mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-display text-sm text-text-primary">{session.title}</p>
                <span className={`font-mono text-xs px-1.5 py-0.5 rounded-sm border ${
                  session.status === 'active'
                    ? 'text-confirmed border-confirmed/30 bg-confirmed/10'
                    : 'text-text-muted border-border bg-raised'
                }`}>{session.status}</span>
              </div>
              {session.description && (
                <p className="font-mono text-xs text-text-muted mt-0.5 truncate">{session.description}</p>
              )}
            </div>
            <span className="font-mono text-xs text-text-muted shrink-0">
              {new Date(session.updated_at).toLocaleDateString('en-CA')}
            </span>
          </Link>
        ))}
        {(!sessions || sessions.length === 0) && (
          <div className="glass-panel p-12 text-center font-mono text-xs text-text-muted">
            No sessions yet. Start one to begin an intelligence analysis.
          </div>
        )}
      </div>
    </div>
  )
}

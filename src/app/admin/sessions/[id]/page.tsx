import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Session, SessionMessage } from '@/types/database'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import SessionChat from './SessionChat'

export const dynamic = 'force-dynamic'

export default async function SessionDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const [{ data: session }, { data: messages }] = await Promise.all([
    supabase.from('sessions').select('*').eq('id', params.id).single(),
    supabase.from('session_messages').select('*').eq('session_id', params.id).order('created_at'),
  ])

  if (!session) notFound()

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.12)-theme(spacing.12))] max-w-4xl">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/admin/sessions" className="text-text-muted hover:text-text-secondary transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="font-display text-lg font-bold text-text-primary">{(session as Session).title}</h1>
          {(session as Session).description && (
            <p className="font-mono text-xs text-text-muted">{(session as Session).description}</p>
          )}
        </div>
      </div>

      <SessionChat
        sessionId={params.id}
        initialMessages={(messages ?? []) as SessionMessage[]}
      />
    </div>
  )
}

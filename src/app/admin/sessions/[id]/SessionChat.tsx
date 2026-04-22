'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { SessionMessage } from '@/types/database'
import { Send, FileText, GitBranch, Loader2 } from 'lucide-react'

export default function SessionChat({
  sessionId,
  initialMessages,
}: {
  sessionId: string
  initialMessages: SessionMessage[]
}) {
  const router = useRouter()
  const [messages, setMessages] = useState<SessionMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [drafting, setDrafting] = useState<'article' | 'argument_map' | null>(null)
  const [draftResult, setDraftResult] = useState<{ type: string; redirect: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setLoading(true)

    const userMsg: SessionMessage = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      role: 'user',
      content: text,
      tool_calls: null,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    const res = await fetch('/api/sessions/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, message: text }),
    })

    const data = await res.json()
    const assistantMsg: SessionMessage = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      role: 'assistant',
      content: data.content ?? data.error ?? 'No response.',
      tool_calls: null,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, assistantMsg])
    setLoading(false)
  }

  async function draft(type: 'article' | 'argument_map') {
    setDrafting(type)
    setDraftResult(null)
    const res = await fetch(`/api/sessions/${sessionId}/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    })
    const data = await res.json()
    setDrafting(null)
    if (data.redirect) {
      setDraftResult({ type, redirect: data.redirect })
    }
  }

  const hasMessages = messages.length > 0
  const assistantMessages = messages.filter((m) => m.role === 'assistant')

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto glass-panel p-4 space-y-4 mb-3">
        {messages.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <p className="font-mono text-xs text-text-muted">Session started. Ask anything about the intelligence graph.</p>
            <p className="font-mono text-xs text-text-muted opacity-60">The agent will query entities, claims, and relationships before answering.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] space-y-1 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              <span className="font-mono text-[10px] text-text-muted px-1">
                {msg.role === 'user' ? 'YOU' : 'CANOPTICON'}
              </span>
              <div className={`px-4 py-3 rounded-sm text-sm font-body leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-signal/10 border border-signal/20 text-text-primary'
                  : 'bg-raised border border-border text-text-secondary'
              }`}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-raised border border-border px-4 py-3 rounded-sm flex items-center gap-2">
              <Loader2 size={12} className="animate-spin text-signal" />
              <span className="font-mono text-xs text-text-muted">Querying graph...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Draft from session — only shows once there are assistant responses */}
      {assistantMessages.length >= 1 && (
        <div className="glass-panel p-3 mb-3 flex items-center gap-3 flex-wrap">
          <span className="font-mono text-[10px] text-text-muted">Synthesize session into:</span>

          <button
            onClick={() => draft('article')}
            disabled={!!drafting}
            className="flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded-sm border border-border text-text-secondary hover:border-signal/40 hover:text-signal transition-colors disabled:opacity-50"
          >
            {drafting === 'article'
              ? <><Loader2 size={12} className="animate-spin" /> Drafting article...</>
              : <><FileText size={12} /> Draft Article</>}
          </button>

          <button
            onClick={() => draft('argument_map')}
            disabled={!!drafting}
            className="flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded-sm border border-border text-text-secondary hover:border-hypothesis/40 hover:text-hypothesis transition-colors disabled:opacity-50"
          >
            {drafting === 'argument_map'
              ? <><Loader2 size={12} className="animate-spin" /> Drafting map...</>
              : <><GitBranch size={12} /> Draft Argument Map</>}
          </button>

          {draftResult && (
            <a
              href={draftResult.redirect}
              className="font-mono text-xs text-confirmed hover:underline ml-auto flex items-center gap-1"
            >
              ✓ {draftResult.type === 'article' ? 'Article' : 'Argument map'} created →
            </a>
          )}
        </div>
      )}

      {/* Input */}
      <div className="glass-panel p-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
          }}
          placeholder="Ask about entities, relationships, or initiate analysis... (Enter to send)"
          rows={2}
          className="input-field resize-none flex-1"
          disabled={loading}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="btn-primary px-3 self-end disabled:opacity-50"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}

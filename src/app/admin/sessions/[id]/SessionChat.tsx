'use client'

import { useState, useRef, useEffect } from 'react'
import type { SessionMessage } from '@/types/database'
import { Send } from 'lucide-react'

export default function SessionChat({
  sessionId,
  initialMessages,
}: {
  sessionId: string
  initialMessages: SessionMessage[]
}) {
  const [messages, setMessages] = useState<SessionMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
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

  return (
    <div className="flex flex-col flex-1 min-h-0 glass-panel overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="font-mono text-xs text-text-muted">Session started. Ask anything about the intelligence graph.</p>
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
            <div className="bg-raised border border-border px-4 py-3 rounded-sm">
              <span className="font-mono text-xs text-text-muted pulse-amber">Analysing...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
          }}
          placeholder="Ask about entities, relationships, or initiate analysis..."
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

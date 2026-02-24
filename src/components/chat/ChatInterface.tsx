'use client'

import type { UIMessage } from 'ai'
import { useEffect, useRef, useState, useCallback } from 'react'
import { MessageBubble } from './MessageBubble'
import { Send, Square, ChevronDown, UserCog, Cpu } from 'lucide-react'
import { PERSONAS, PersonaId } from '@/lib/ai/personas'

interface ChatInterfaceProps {
    conversationId: string | null
    onConversationCreated: (id: string) => void
    onNewChat: () => void
    initialMessages?: UIMessage[]
    initialPersonaId?: PersonaId
    initialInput?: string
}

export function ChatInterface({ conversationId, onConversationCreated, onNewChat, initialMessages, initialPersonaId, initialInput }: ChatInterfaceProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const [input, setInput] = useState<string>(initialInput ?? '')
    const [personaId, setPersonaId] = useState<PersonaId>(initialPersonaId || 'canopticon')
    const [showPersonaMenu, setShowPersonaMenu] = useState(false)
    const [showModelMenu, setShowModelMenu] = useState(false)
    const [selectedModel, setSelectedModel] = useState<'perplexity' | 'openai' | 'anthropic'>('openai')
    const [error, setError] = useState<string | null>(null)
    const [messages, setMessages] = useState<UIMessage[]>(initialMessages || [])
    const [isLoading, setIsLoading] = useState(false)
    const abortControllerRef = useRef<AbortController | null>(null)

    // Generate a unique ID
    const generateId = () => Math.random().toString(36).substring(2, 15)

    // Send a message and stream the response
    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || isLoading) return

        setError(null)

        // Add user message to state immediately for UI responsiveness
        const userMessage: UIMessage = {
            id: generateId(),
            role: 'user',
            parts: [{ type: 'text', text: content }],
        }

        setMessages(prev => [...prev, userMessage])
        setIsLoading(true)

        // Build the messages array for the API
        const apiMessages = [...messages, userMessage].map(m => {
            const textPart = m.parts?.find((p: any) => p.type === 'text') as any
            return {
                role: m.role,
                content: textPart?.text || '',
            }
        })

        // For new conversations, create the conversation row FIRST so the
        // server can save messages in onFinish with a valid conversationId.
        let activeConversationId = conversationId
        if (!activeConversationId) {
            try {
                const conv = await fetch('/api/conversations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: content.substring(0, 80) }),
                }).then(r => r.json())
                if (conv?.id) {
                    activeConversationId = conv.id
                    onConversationCreated(conv.id)
                }
            } catch (err) {
                console.error('[Chat] Failed to create conversation row:', err)
            }
        }

        const assistantId = generateId()
        let fullText = ''
        let assistantAdded = false

        try {
            const controller = new AbortController()
            abortControllerRef.current = controller

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: apiMessages,
                    personaId,
                    modelProvider: selectedModel,
                    conversationId: activeConversationId || undefined,
                }),
                signal: controller.signal,
            })

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
                throw new Error(errorData.error || `Request failed with status ${res.status}`)
            }

            if (!res.body) {
                throw new Error('No response body')
            }

            // Read the stream
            const reader = res.body.getReader()
            const decoder = new TextDecoder()

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })
                fullText += chunk

                if (!assistantAdded) {
                    // First chunk: add the assistant message
                    assistantAdded = true
                    setMessages(prev => [...prev, {
                        id: assistantId,
                        role: 'assistant' as const,
                        parts: [{ type: 'text' as const, text: fullText }],
                    }])
                } else {
                    // Subsequent chunks: update the assistant message
                    setMessages(prev => {
                        const updated = [...prev]
                        const lastMsg = updated[updated.length - 1]
                        if (lastMsg && lastMsg.role === 'assistant') {
                            updated[updated.length - 1] = {
                                ...lastMsg,
                                parts: [{ type: 'text' as const, text: fullText }],
                            }
                        }
                        return updated
                    })
                }
            }

        } catch (err: any) {
            if (err.name === 'AbortError') {
                // User stopped generation — keep what we have
            } else {
                console.error('[Chat] Error:', err)
                setError(err.message || 'An error occurred. Please try again.')
            }
        } finally {
            setIsLoading(false)
            abortControllerRef.current = null
        }
    }, [isLoading, messages, personaId, selectedModel, conversationId, onConversationCreated])

    const stopGeneration = useCallback(() => {
        abortControllerRef.current?.abort()
    }, [])

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    // Auto-focus input
    useEffect(() => {
        inputRef.current?.focus()
    }, [conversationId])

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || isLoading) return
        const text = input
        setInput('')
        sendMessage(text)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            if (input.trim() && !isLoading) {
                e.preventDefault()
                const text = input
                setInput('')
                sendMessage(text)
            } else {
                e.preventDefault()
            }
        }
    }

    const showWelcome = messages.length === 0

    return (
        <div className="flex flex-col h-full">
            {/* Header / Persona Selector */}
            <div className="h-12 border-b border-white/5 flex items-center justify-between px-4">
                <div className="relative">
                    <button
                        onClick={() => setShowPersonaMenu(!showPersonaMenu)}
                        className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/5"
                    >
                        <UserCog size={16} />
                        <span className="font-medium">{PERSONAS[personaId]?.name || 'Canopticon'}</span>
                        <ChevronDown size={14} className={`transition-transform ${showPersonaMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {showPersonaMenu && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowPersonaMenu(false)} />
                            <div className="absolute top-full left-0 mt-1 w-64 bg-zinc-900 border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden py-1">
                                {(Object.values(PERSONAS) as any[]).map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            setPersonaId(p.id as PersonaId)
                                            setShowPersonaMenu(false)
                                        }}
                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-white/10 transition-colors ${personaId === p.id ? 'text-red-400 bg-red-500/5' : 'text-slate-300'
                                            }`}
                                    >
                                        <div className="font-medium">{p.name}</div>
                                        <div className="text-xs text-slate-500 truncate">{p.description}</div>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Messages area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
                {/* Error Banner */}
                {error && (
                    <div className="max-w-3xl mx-auto px-6 py-4">
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
                            <div className="text-red-400 mt-0.5">⚠️</div>
                            <div className="flex-1">
                                <div className="text-red-400 font-medium mb-1">Error</div>
                                <div className="text-sm text-red-300">{error}</div>
                            </div>
                            <button
                                onClick={() => setError(null)}
                                className="text-red-400 hover:text-red-300 transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                )}

                {showWelcome && (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center max-w-lg px-6">
                            <h1 className="text-3xl font-bold text-white mb-2">CANOPTICON</h1>
                            <p className="text-slate-400 text-lg mb-8">
                                Research. Write. Publish.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                                <SuggestionCard
                                    text="What's the top news story in Canada today?"
                                    onClick={(text) => { setInput(text); inputRef.current?.focus() }}
                                />
                                <SuggestionCard
                                    text="Write a 1,000 word article on the latest in Parliament"
                                    onClick={(text) => { setInput(text); inputRef.current?.focus() }}
                                />
                                <SuggestionCard
                                    text="Create a YouTube monitor for CPAC that auto-posts to X"
                                    onClick={(text) => { setInput(text); inputRef.current?.focus() }}
                                />
                                <SuggestionCard
                                    text="Research and write about the federal budget, add images"
                                    onClick={(text) => { setInput(text); inputRef.current?.focus() }}
                                />
                                <SuggestionCard
                                    text="List my published articles"
                                    onClick={(text) => { setInput(text); inputRef.current?.focus() }}
                                />
                                <SuggestionCard
                                    text="Set up an RSS monitor for CBC Politics"
                                    onClick={(text) => { setInput(text); inputRef.current?.focus() }}
                                />
                                <SuggestionCard
                                    text="Post my latest article to X as a thread"
                                    onClick={(text) => { setInput(text); inputRef.current?.focus() }}
                                />
                                <SuggestionCard
                                    text="Show me my draft articles"
                                    onClick={(text) => { setInput(text); inputRef.current?.focus() }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {!showWelcome && (
                    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                        {messages.map((message: UIMessage) => (
                            <MessageBubble key={message.id} message={message} />
                        ))}
                        {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary-600/20 border border-primary-500/30 flex items-center justify-center flex-shrink-0">
                                    <span className="text-primary-400 text-xs font-bold">C</span>
                                </div>
                                <div className="flex items-center gap-1 pt-2">
                                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Input area */}
            <div className="border-t border-white/5 p-4">
                <div className="max-w-3xl mx-auto">
                    <form onSubmit={onSubmit} className="relative">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={`Message ${PERSONAS[personaId]?.name}...`}
                            className="input pr-32 resize-none min-h-[52px] max-h-[200px]"
                            rows={1}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement
                                target.style.height = 'auto'
                                target.style.height = Math.min(target.scrollHeight, 200) + 'px'
                            }}
                        />
                        <div className="absolute right-2 bottom-2 flex items-center gap-2">
                            {/* Model Selector Button */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowModelMenu(!showModelMenu)}
                                    className="px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-300 hover:bg-white/5 transition-colors flex items-center gap-1.5 border border-white/10"
                                >
                                    <Cpu size={12} />
                                    <span className="font-medium">
                                        {selectedModel === 'perplexity' && 'Sonar'}
                                        {selectedModel === 'openai' && 'GPT-4o'}
                                        {selectedModel === 'anthropic' && 'Claude'}
                                    </span>
                                    <ChevronDown size={10} className={`transition-transform ${showModelMenu ? 'rotate-180' : ''}`} />
                                </button>

                                {showModelMenu && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowModelMenu(false)} />
                                        <div className="absolute bottom-full right-0 mb-2 w-56 bg-zinc-900 border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden py-1">
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedModel('perplexity'); setShowModelMenu(false); }}
                                                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 transition-colors ${selectedModel === 'perplexity' ? 'text-purple-400 bg-purple-500/5' : 'text-slate-300'}`}
                                            >
                                                <div className="font-medium">Perplexity Sonar Pro</div>
                                                <div className="text-xs text-slate-500">Fast, web-connected</div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedModel('openai'); setShowModelMenu(false); }}
                                                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 transition-colors ${selectedModel === 'openai' ? 'text-green-400 bg-green-500/5' : 'text-slate-300'}`}
                                            >
                                                <div className="font-medium">OpenAI GPT-4o</div>
                                                <div className="text-xs text-slate-500">Advanced reasoning</div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedModel('anthropic'); setShowModelMenu(false); }}
                                                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 transition-colors ${selectedModel === 'anthropic' ? 'text-orange-400 bg-orange-500/5' : 'text-slate-300'}`}
                                            >
                                                <div className="font-medium">Claude Sonnet</div>
                                                <div className="text-xs text-slate-500">Long context</div>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Send/Stop Button */}
                            {isLoading ? (
                                <button
                                    type="button"
                                    onClick={stopGeneration}
                                    className="p-2.5 rounded-lg bg-white/10 text-slate-300 hover:bg-white/20 transition-colors flex items-center justify-center"
                                    title="Stop generating"
                                >
                                    <Square className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={!input.trim()}
                                    className="p-2.5 rounded-lg bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                                    title="Send message"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}

function SuggestionCard({ text, onClick }: { text: string; onClick: (text: string) => void }) {
    return (
        <button
            onClick={() => onClick(text)}
            className="glass-card p-3 text-sm text-slate-300 text-left hover:text-white transition-colors"
        >
            {text}
        </button>
    )
}

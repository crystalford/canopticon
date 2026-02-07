'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useEffect, useRef, useState, useMemo } from 'react'
import { MessageBubble } from './MessageBubble'
import { Send, Square } from 'lucide-react'

interface ChatInterfaceProps {
    conversationId: string | null
    onConversationCreated: (id: string) => void
    onNewChat: () => void
}

export function ChatInterface({ conversationId, onConversationCreated, onNewChat }: ChatInterfaceProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const [input, setInput] = useState('')

    const transport = useMemo(() => new DefaultChatTransport({
        api: '/api/chat',
        body: conversationId ? { conversationId } : undefined,
    }), [conversationId])

    const { messages, sendMessage, status, stop, setMessages } = useChat({
        transport,
        onError: (error) => {
            console.error('Chat error:', error)
        },
    })

    const isLoading = status === 'submitted' || status === 'streaming'

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || isLoading) return
        sendMessage({ text: input })
        setInput('')
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (input.trim() && !isLoading) {
                sendMessage({ text: input })
                setInput('')
            }
        }
    }

    const showWelcome = messages.length === 0

    return (
        <div className="flex flex-col h-full">
            {/* Messages area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
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
                                    text="List my published articles"
                                    onClick={(text) => { setInput(text); inputRef.current?.focus() }}
                                />
                                <SuggestionCard
                                    text="Research the latest federal budget announcements"
                                    onClick={(text) => { setInput(text); inputRef.current?.focus() }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {!showWelcome && (
                    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                        {messages.map((message) => (
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
                    <form onSubmit={handleSubmit} className="relative">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Research a topic, write an article, publish..."
                            className="input pr-24 resize-none min-h-[52px] max-h-[200px]"
                            rows={1}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement
                                target.style.height = 'auto'
                                target.style.height = Math.min(target.scrollHeight, 200) + 'px'
                            }}
                        />
                        <div className="absolute right-2 bottom-2 flex gap-1">
                            {isLoading ? (
                                <button
                                    type="button"
                                    onClick={() => stop()}
                                    className="p-2 rounded-lg bg-white/10 text-slate-300 hover:bg-white/20 transition-colors"
                                    title="Stop generating"
                                >
                                    <Square className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={!input.trim()}
                                    className="p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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

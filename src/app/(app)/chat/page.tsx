'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ChatInterface } from '@/components/chat/ChatInterface'
import type { UIMessage } from 'ai'

export default function ChatPage() {
    const searchParams = useSearchParams()
    const router = useRouter()

    const [conversationId, setConversationId] = useState<string | null>(null)
    const [initialMessages, setInitialMessages] = useState<UIMessage[] | undefined>(undefined)
    const [loadingMessages, setLoadingMessages] = useState(false)

    // Separate key for controlling ChatInterface remounts.
    const [chatKey, setChatKey] = useState<string>('new')

    // Handle URL changes
    useEffect(() => {
        const c = searchParams.get('c')
        if (c) {
            // If URL has ID and it's different (or we haven't loaded it yet), load it
            if (c !== conversationId) {
                handleSelectConversation(c)
            }
        } else {
            // If URL has no ID, ensure we are in "New Chat" mode
            if (conversationId !== null) {
                handleNewChat()
            }
        }
    }, [searchParams])

    const handleNewChat = useCallback(() => {
        setConversationId(null)
        setInitialMessages(undefined)
        setChatKey('new-' + Date.now())
    }, [])

    const handleConversationCreated = useCallback((id: string) => {
        // When a new chat is created by the interface, update the URL
        // The URL update will trigger the useEffect, but we can also set state directly for speed
        setConversationId(id)
        router.replace(`?c=${id}`)
    }, [router])

    const handleSelectConversation = useCallback(async (id: string) => {
        setLoadingMessages(true)
        setConversationId(id)

        try {
            const res = await fetch(`/api/conversations/${id}/messages`)
            if (!res.ok) throw new Error('Failed to fetch messages')

            const dbMessages = await res.json()
            const uiMessages: UIMessage[] = dbMessages
                .filter((m: any) => m.role === 'user' || m.role === 'assistant')
                .map((m: any) => ({
                    id: m.id,
                    role: m.role as 'user' | 'assistant',
                    parts: [{ type: 'text' as const, text: m.content }],
                }))
            setInitialMessages(uiMessages)
            setChatKey(id) // remount with loaded messages
        } catch (error) {
            console.error('Failed to load messages:', error)
            setInitialMessages(undefined)
            setChatKey(id)
        } finally {
            setLoadingMessages(false)
        }
    }, [])

    return (
        <div className="h-full flex flex-col bg-background relative">
            {loadingMessages ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex items-center gap-2 text-slate-400">
                        <div className="animate-spin w-4 h-4 border-2 border-slate-500 border-t-red-500 rounded-full" />
                        <span>Loading conversation...</span>
                    </div>
                </div>
            ) : (
                <ChatInterface
                    key={chatKey}
                    conversationId={conversationId}
                    onConversationCreated={handleConversationCreated}
                    onNewChat={() => router.push('/chat')} // User clicking "New Chat" in interface
                    initialMessages={initialMessages}
                />
            )}
        </div>
    )
}

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ChatInterface } from '@/components/chat/ChatInterface'
import type { UIMessage } from 'ai'

export default function ChatPage() {
    const searchParams = useSearchParams()
    const router = useRouter()

    const [conversationId, setConversationId] = useState<string | null>(null)
    const [initialMessages, setInitialMessages] = useState<UIMessage[] | undefined>(undefined)
    const [loadingMessages, setLoadingMessages] = useState(false)
    // Tracks IDs we've already loaded via handleSelectConversation to avoid double-loading
    const loadedIdsRef = useRef<Set<string>>(new Set())

    const [initialPersonaId, setInitialPersonaId] = useState<any>(undefined)
    const [initialInput, setInitialInput] = useState<string | undefined>(undefined)
    const [chatKey, setChatKey] = useState('new')

    const handleNewChat = useCallback(() => {
        setConversationId(null)
        setInitialMessages(undefined)
        setChatKey('new-' + Date.now())
    }, [])

    // Called by ChatInterface the instant a new conversation row is created.
    // We update the URL silently (no router event) so the searchParams effect
    // does NOT fire and reset the page.
    const handleConversationCreated = useCallback((id: string) => {
        setConversationId(id)
        loadedIdsRef.current.add(id) // mark as "in memory", don't reload from DB
        // Use native history API to avoid triggering Next.js router / searchParams effect
        window.history.replaceState(null, '', `?c=${id}`)
    }, [])

    const handleSelectConversation = useCallback(async (id: string) => {
        if (loadedIdsRef.current.has(id)) return // already loaded in memory
        setLoadingMessages(true)
        setConversationId(id)
        loadedIdsRef.current.add(id)

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
            setChatKey(id)
        } catch (error) {
            console.error('Failed to load messages:', error)
            setInitialMessages(undefined)
            setChatKey(id)
        } finally {
            setLoadingMessages(false)
        }
    }, [])

    // Only runs on actual URL changes (sidebar navigation, direct links, etc.)
    useEffect(() => {
        const c = searchParams.get('c')
        const mode = searchParams.get('mode')
        const reviewId = searchParams.get('review')
        const editId = searchParams.get('edit')
        const inputParam = searchParams.get('initialInput')

        if (mode) setInitialPersonaId(mode)
        if (reviewId) setInitialInput(`Please review article #${reviewId} and provide editorial feedback.`)
        if (editId) setInitialInput(`I want to edit article ${editId}. Please read it and help me make changes.`)
        if (inputParam) setInitialInput(decodeURIComponent(inputParam))

        if (c) {
            handleSelectConversation(c)
        } else {
            // No ?c= param — only reset if we're not already in a fresh state
            if (conversationId !== null) {
                handleNewChat()
            }
        }
        // Intentionally only react to searchParams changes driven by the router
        // (sidebar clicks, direct links). handleConversationCreated uses
        // window.history.replaceState so it does NOT trigger this effect.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams])

    return (
        <div className="h-full flex flex-col relative">
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
                    onNewChat={() => {
                        window.history.replaceState(null, '', '/chat')
                        handleNewChat()
                    }}
                    initialMessages={initialMessages}
                    initialPersonaId={initialPersonaId}
                    initialInput={initialInput}
                />
            )}
        </div>
    )
}

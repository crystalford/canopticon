'use client'

import { useState, useCallback, useEffect } from 'react'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { ConversationSidebar } from '@/components/chat/ConversationSidebar'
import { SocialMonitorView } from '@/components/social/SocialMonitorView'
import { Menu, X, MessageSquare, Activity } from 'lucide-react'
import type { UIMessage } from 'ai'

export default function DashboardPage() {
    const [conversationId, setConversationId] = useState<string | null>(null)
    const [initialMessages, setInitialMessages] = useState<UIMessage[] | undefined>(undefined)
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [refreshKey, setRefreshKey] = useState(0)
    // Separate key for controlling ChatInterface remounts.
    // Only changes on explicit user actions (new chat, select conversation),
    // NOT when conversation ID is auto-detected after first exchange.
    const [chatKey, setChatKey] = useState<string>('new')
    const [urlInitialized, setUrlInitialized] = useState(false)
    const [view, setView] = useState<'chat' | 'social'>('chat')

    // Load conversation from URL on mount
    useEffect(() => {
        if (urlInitialized) return

        const params = new URLSearchParams(window.location.search)
        const convId = params.get('c')
        const viewParam = params.get('v')

        if (viewParam === 'social') {
            setView('social')
        } else {
            setView('chat')
            if (convId) {
                handleSelectConversation(convId)
            }
        }
        setUrlInitialized(true)
    }, [urlInitialized])

    // Update URL when conversation changes
    useEffect(() => {
        if (!urlInitialized) return

        const url = new URL(window.location.href)
        if (conversationId && view === 'chat') {
            url.searchParams.set('c', conversationId)
        } else {
            url.searchParams.delete('c')
        }

        if (view === 'social') {
            url.searchParams.set('v', 'social')
        } else {
            url.searchParams.delete('v')
        }
        window.history.replaceState({}, '', url)
    }, [conversationId, urlInitialized, view])

    // Close sidebar on mobile by default
    useEffect(() => {
        if (window.innerWidth < 1024) setSidebarOpen(false)
    }, [])

    const handleNewChat = useCallback(() => {
        setView('chat')
        setConversationId(null)
        setInitialMessages(undefined)
        setChatKey('new-' + Date.now())
    }, [])

    const handleConversationCreated = useCallback((id: string) => {
        setConversationId(id)
        // DO NOT change chatKey here - the component keeps its messages
        setRefreshKey(prev => prev + 1)
    }, [])

    const handleSelectConversation = useCallback(async (id: string) => {
        // Close sidebar on mobile
        if (window.innerWidth < 1024) setSidebarOpen(false)

        setView('chat')
        setLoadingMessages(true)
        setConversationId(id)

        try {
            const res = await fetch(`/api/conversations/${id}/messages`)
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

    const handleSocialEngage = useCallback((tweet: any) => {
        setView('chat')
        setConversationId(null)
        const initialMsg: UIMessage = {
            id: 'engage-' + tweet.id,
            role: 'user',
            parts: [{ type: 'text', text: `I want to reply to this tweet from ${tweet.authorHandle}:\n\n"${tweet.content}"\n\n(URL: ${tweet.url})` }]
        }
        setInitialMessages([initialMsg])
        setChatKey('engage-' + tweet.id)
    }, [])

    return (
        <div className="h-screen flex bg-background">
            {/* Mobile overlay backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar - fixed overlay on mobile, static on desktop */}
            <div className={`
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                fixed lg:static inset-y-0 left-0 z-30
                w-64 flex-shrink-0
                border-r border-white/5 bg-background-secondary
                transition-transform duration-300 ease-in-out
                ${!sidebarOpen ? 'lg:translate-x-0 lg:w-0 lg:border-r-0 lg:overflow-hidden' : ''}
            `}>
                <ConversationSidebar
                    currentId={conversationId}
                    onSelect={handleSelectConversation}
                    onNewChat={handleNewChat}
                    refreshKey={refreshKey}
                />
            </div>

            {/* Main content area */}
            <div className="flex-1 flex flex-col relative h-full w-full overflow-hidden">
                {/* Header / Toggle Bar */}
                <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 bg-background/50 backdrop-blur-sm z-10 shrink-0">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 hover:bg-white/5 rounded-lg lg:hidden text-slate-400 hover:text-white"
                        >
                            <Menu className="w-5 h-5" />
                        </button>

                        <div className="flex items-center p-1 bg-white/5 rounded-lg border border-white/5">
                            <button
                                onClick={() => setView('chat')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'chat'
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                                    }`}
                            >
                                <MessageSquare className="w-4 h-4" />
                                Chat
                            </button>
                            <button
                                onClick={() => setView('social')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'social'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                                    }`}
                            >
                                <Activity className="w-4 h-4" />
                                Social Monitor
                            </button>
                        </div>
                    </div>
                </header>

                <main className="flex-1 relative overflow-hidden">
                    {view === 'chat' ? (
                        loadingMessages ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <div className="animate-spin w-4 h-4 border-2 border-slate-500 border-t-primary-400 rounded-full" />
                                    <span>Loading conversation...</span>
                                </div>
                            </div>
                        ) : (
                            <ChatInterface
                                key={chatKey}
                                conversationId={conversationId}
                                onConversationCreated={handleConversationCreated}
                                onNewChat={handleNewChat}
                                initialMessages={initialMessages}
                            />
                        )
                    ) : (
                        key = { chatKey }
                            conversationId={conversationId}
                    onConversationCreated={handleConversationCreated}
                    onNewChat={handleNewChat}
                    initialMessages={initialMessages}
                        />
                    )}
            </div>
        </div>
        </div >
    )
}

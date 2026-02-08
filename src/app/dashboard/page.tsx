'use client'

import { useState, useCallback, useEffect } from 'react'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { ConversationSidebar } from '@/components/chat/ConversationSidebar'
import { Menu, X } from 'lucide-react'
import type { UIMessage } from 'ai'

export default function DashboardPage() {
    const [conversationId, setConversationId] = useState<string | null>(null)
    const [initialMessages, setInitialMessages] = useState<UIMessage[] | undefined>(undefined)
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [refreshKey, setRefreshKey] = useState(0)

    // Close sidebar on mobile by default
    useEffect(() => {
        if (window.innerWidth < 1024) setSidebarOpen(false)
    }, [])

    const handleNewChat = useCallback(() => {
        setConversationId(null)
        setInitialMessages(undefined)
    }, [])

    const handleConversationCreated = useCallback((id: string) => {
        setConversationId(id)
        setRefreshKey(prev => prev + 1)
    }, [])

    const handleSelectConversation = useCallback(async (id: string) => {
        // Close sidebar on mobile
        if (window.innerWidth < 1024) setSidebarOpen(false)

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
        } catch (error) {
            console.error('Failed to load messages:', error)
            setInitialMessages(undefined)
        } finally {
            setLoadingMessages(false)
        }
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
                transition-transform duration-200
                ${!sidebarOpen ? 'lg:translate-x-0 lg:w-0 lg:border-r-0 lg:overflow-hidden' : ''}
            `}>
                <ConversationSidebar
                    activeConversationId={conversationId}
                    onSelect={handleSelectConversation}
                    onNewChat={handleNewChat}
                    refreshKey={refreshKey}
                />
            </div>

            {/* Main area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Top bar */}
                <div className="h-12 border-b border-white/5 flex items-center px-4 gap-3 flex-shrink-0">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    >
                        {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                    </button>
                    <h1 className="text-sm font-semibold text-white tracking-wider">CANOPTICON</h1>
                </div>

                {/* Chat */}
                <div className="flex-1 min-h-0">
                    {loadingMessages ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="flex items-center gap-2 text-slate-400">
                                <div className="animate-spin w-4 h-4 border-2 border-slate-500 border-t-primary-400 rounded-full" />
                                <span>Loading conversation...</span>
                            </div>
                        </div>
                    ) : (
                        <ChatInterface
                            key={conversationId || 'new'}
                            conversationId={conversationId}
                            onConversationCreated={handleConversationCreated}
                            onNewChat={handleNewChat}
                            initialMessages={initialMessages}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}

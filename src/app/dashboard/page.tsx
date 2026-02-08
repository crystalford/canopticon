'use client'

import { useState, useCallback } from 'react'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { ConversationSidebar } from '@/components/chat/ConversationSidebar'
import { Menu, X } from 'lucide-react'

export default function DashboardPage() {
    const [conversationId, setConversationId] = useState<string | null>(null)
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [refreshKey, setRefreshKey] = useState(0)

    const handleNewChat = useCallback(() => {
        setConversationId(null)
    }, [])

    const handleConversationCreated = useCallback((id: string) => {
        setConversationId(id)
        // Refresh sidebar to show new conversation
        setRefreshKey(prev => prev + 1)
    }, [])

    const handleSelectConversation = useCallback((id: string) => {
        setConversationId(id)
    }, [])

    return (
        <div className="h-screen flex bg-background">
            {/* Sidebar */}
            <div className={`${
                sidebarOpen ? 'w-64' : 'w-0'
            } flex-shrink-0 border-r border-white/5 bg-background-secondary overflow-hidden transition-all duration-200`}>
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
                    <ChatInterface
                        key={conversationId || 'new'}
                        conversationId={conversationId}
                        onConversationCreated={handleConversationCreated}
                        onNewChat={handleNewChat}
                    />
                </div>
            </div>
        </div>
    )
}

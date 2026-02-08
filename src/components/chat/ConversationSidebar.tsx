'use client'

import { useEffect, useState } from 'react'
import { Plus, MessageSquare, Trash2, FileText, ExternalLink } from 'lucide-react'

interface Conversation {
    id: string
    title: string | null
    createdAt: string
    updatedAt: string
}

interface Article {
    id: string
    title: string
    slug: string
    status: string
    summary: string | null
    publishedAt: string | null
    createdAt: string
}

interface ConversationSidebarProps {
    activeConversationId: string | null
    onSelect: (id: string) => void
    onNewChat: () => void
    refreshKey: number
}

export function ConversationSidebar({
    activeConversationId,
    onSelect,
    onNewChat,
    refreshKey,
}: ConversationSidebarProps) {
    const [tab, setTab] = useState<'chats' | 'articles'>('chats')
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [articles, setArticles] = useState<Article[]>([])
    const [loading, setLoading] = useState(true)
    const [articlesLoading, setArticlesLoading] = useState(true)

    useEffect(() => {
        setLoading(true)
        fetch('/api/conversations')
            .then(res => res.json())
            .then(data => {
                setConversations(data)
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [refreshKey])

    useEffect(() => {
        setArticlesLoading(true)
        fetch('/api/articles')
            .then(res => res.json())
            .then(data => {
                setArticles(data)
                setArticlesLoading(false)
            })
            .catch(() => setArticlesLoading(false))
    }, [refreshKey])

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (!confirm('Delete this conversation?')) return

        await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
        setConversations(prev => prev.filter(c => c.id !== id))

        if (activeConversationId === id) {
            onNewChat()
        }
    }

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffHrs = diffMs / (1000 * 60 * 60)

        if (diffHrs < 1) return 'Just now'
        if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`
        if (diffHrs < 48) return 'Yesterday'
        return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
    }

    return (
        <div className="flex flex-col h-full">
            {/* New chat button */}
            <div className="p-3">
                <button
                    onClick={onNewChat}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-colors text-sm"
                >
                    <Plus className="w-4 h-4" />
                    New chat
                </button>
            </div>

            {/* Tab bar */}
            <div className="px-3 pb-2 flex gap-1">
                <button
                    onClick={() => setTab('chats')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        tab === 'chats'
                            ? 'bg-white/10 text-white'
                            : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                    Chats
                </button>
                <button
                    onClick={() => setTab('articles')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        tab === 'articles'
                            ? 'bg-white/10 text-white'
                            : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                    Articles
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-2">
                {tab === 'chats' ? (
                    /* Chats tab */
                    loading ? (
                        <div className="text-center text-slate-500 text-sm py-4">Loading...</div>
                    ) : conversations.length === 0 ? (
                        <div className="text-center text-slate-500 text-sm py-4">No conversations yet</div>
                    ) : (
                        <div className="space-y-0.5">
                            {conversations.map(conv => (
                                <button
                                    key={conv.id}
                                    onClick={() => onSelect(conv.id)}
                                    className={`w-full group flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                                        activeConversationId === conv.id
                                            ? 'bg-white/10 text-white'
                                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                                    }`}
                                >
                                    <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate">{conv.title || 'Untitled'}</div>
                                        <div className="text-xs text-slate-500">{formatDate(conv.updatedAt)}</div>
                                    </div>
                                    <button
                                        onClick={(e) => handleDelete(e, conv.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-slate-500 hover:text-red-400 transition-all"
                                        title="Delete conversation"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </button>
                            ))}
                        </div>
                    )
                ) : (
                    /* Articles tab */
                    articlesLoading ? (
                        <div className="text-center text-slate-500 text-sm py-4">Loading...</div>
                    ) : articles.length === 0 ? (
                        <div className="text-center text-slate-500 text-sm py-4">No articles yet</div>
                    ) : (
                        <div className="space-y-0.5">
                            {articles.map(article => (
                                <a
                                    key={article.id}
                                    href={`/articles/${article.slug}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full group flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors text-slate-400 hover:bg-white/5 hover:text-slate-200"
                                >
                                    <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate">{article.title}</div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                                                article.status === 'published' ? 'bg-emerald-400' : 'bg-slate-500'
                                            }`} />
                                            <span>{article.status === 'published' ? 'Published' : 'Draft'}</span>
                                            {article.publishedAt && (
                                                <>
                                                    <span>&middot;</span>
                                                    <span>{formatDate(article.publishedAt)}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </a>
                            ))}
                        </div>
                    )
                )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-white/5">
                <div className="text-xs text-slate-600 text-center">
                    CANOPTICON v2
                </div>
            </div>
        </div>
    )
}

'use client'

import { useEffect, useState, useRef } from 'react'
import { Plus, MessageSquare, Trash2, FileText, ExternalLink, Search, Pin, PinOff, Pencil, Check, X } from 'lucide-react'

interface Conversation {
    id: string
    title: string | null
    pinned: boolean
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
    const [search, setSearch] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editTitle, setEditTitle] = useState('')
    const editInputRef = useRef<HTMLInputElement>(null)

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

    // Focus edit input when editing starts
    useEffect(() => {
        if (editingId) {
            editInputRef.current?.focus()
            editInputRef.current?.select()
        }
    }, [editingId])

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (!confirm('Delete this conversation?')) return

        await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
        setConversations(prev => prev.filter(c => c.id !== id))

        if (activeConversationId === id) {
            onNewChat()
        }
    }

    const handleTogglePin = async (e: React.MouseEvent, conv: Conversation) => {
        e.stopPropagation()
        const newPinned = !conv.pinned

        // Optimistic update
        setConversations(prev =>
            prev.map(c => c.id === conv.id ? { ...c, pinned: newPinned } : c)
                .sort((a, b) => {
                    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
                    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
                })
        )

        await fetch(`/api/conversations/${conv.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pinned: newPinned }),
        })
    }

    const startRename = (e: React.MouseEvent, conv: Conversation) => {
        e.stopPropagation()
        setEditingId(conv.id)
        setEditTitle(conv.title || '')
    }

    const saveRename = async () => {
        if (!editingId) return
        const trimmed = editTitle.trim()

        // Optimistic update
        setConversations(prev =>
            prev.map(c => c.id === editingId ? { ...c, title: trimmed || 'Untitled' } : c)
        )

        await fetch(`/api/conversations/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: trimmed || 'Untitled' }),
        })

        setEditingId(null)
    }

    const cancelRename = () => {
        setEditingId(null)
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

    // Filter conversations by search
    const filtered = search
        ? conversations.filter(c =>
            (c.title || 'Untitled').toLowerCase().includes(search.toLowerCase())
        )
        : conversations

    const pinnedConvs = filtered.filter(c => c.pinned)
    const unpinnedConvs = filtered.filter(c => !c.pinned)

    const renderConversation = (conv: Conversation) => {
        const isEditing = editingId === conv.id
        const isActive = activeConversationId === conv.id

        return (
            <div
                key={conv.id}
                onClick={() => !isEditing && onSelect(conv.id)}
                className={`w-full group flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors cursor-pointer ${
                    isActive
                        ? 'bg-white/10 text-white'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
            >
                {conv.pinned ? (
                    <Pin className="w-3.5 h-3.5 flex-shrink-0 text-primary-400" />
                ) : (
                    <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                )}

                {isEditing ? (
                    <div className="flex-1 min-w-0 flex items-center gap-1">
                        <input
                            ref={editInputRef}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') saveRename()
                                if (e.key === 'Escape') cancelRename()
                            }}
                            onBlur={saveRename}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-sm text-white outline-none focus:border-primary-500/50"
                        />
                    </div>
                ) : (
                    <div className="flex-1 min-w-0">
                        <div className="truncate">{conv.title || 'Untitled'}</div>
                        <div className="text-xs text-slate-500">{formatDate(conv.updatedAt)}</div>
                    </div>
                )}

                {!isEditing && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => startRename(e, conv)}
                            className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors"
                            title="Rename"
                        >
                            <Pencil className="w-3 h-3" />
                        </button>
                        <button
                            onClick={(e) => handleTogglePin(e, conv)}
                            className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-primary-400 transition-colors"
                            title={conv.pinned ? 'Unpin' : 'Pin'}
                        >
                            {conv.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                        </button>
                        <button
                            onClick={(e) => handleDelete(e, conv.id)}
                            className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-red-400 transition-colors"
                            title="Delete"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                )}
            </div>
        )
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

            {/* Search (chats tab only) */}
            {tab === 'chats' && (
                <div className="px-3 pb-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search chats..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-300 placeholder-slate-500 outline-none focus:border-white/20 transition-colors"
                        />
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-2">
                {tab === 'chats' ? (
                    /* Chats tab */
                    loading ? (
                        <div className="text-center text-slate-500 text-sm py-4">Loading...</div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center text-slate-500 text-sm py-4">
                            {search ? 'No matches' : 'No conversations yet'}
                        </div>
                    ) : (
                        <div className="space-y-0.5">
                            {/* Pinned section */}
                            {pinnedConvs.length > 0 && (
                                <>
                                    <div className="px-3 pt-1 pb-1 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                                        Pinned
                                    </div>
                                    {pinnedConvs.map(renderConversation)}
                                    {unpinnedConvs.length > 0 && (
                                        <div className="px-3 pt-3 pb-1 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                                            Recent
                                        </div>
                                    )}
                                </>
                            )}
                            {/* Regular conversations */}
                            {unpinnedConvs.map(renderConversation)}
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

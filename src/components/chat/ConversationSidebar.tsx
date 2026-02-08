'use client'

import { useEffect, useState, useRef } from 'react'
import { Plus, MessageSquare, Trash2, FileText, ExternalLink, Search, Pin, PinOff, Pencil, Radio, Play, Pause, RotateCw } from 'lucide-react'

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

interface Monitor {
    id: string
    name: string
    type: string
    enabled: boolean
    autoPublish: boolean
    prompt: string | null
    lastRunAt: string | null
    lastResult: any
    createdAt: string
}

type TabType = 'chats' | 'articles' | 'monitors'

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
    const [tab, setTab] = useState<TabType>('chats')
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [articles, setArticles] = useState<Article[]>([])
    const [monitors, setMonitors] = useState<Monitor[]>([])
    const [loading, setLoading] = useState(true)
    const [articlesLoading, setArticlesLoading] = useState(true)
    const [monitorsLoading, setMonitorsLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editTitle, setEditTitle] = useState('')
    const [runningId, setRunningId] = useState<string | null>(null)
    const editInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        setLoading(true)
        fetch('/api/conversations')
            .then(res => res.json())
            .then(data => { setConversations(data); setLoading(false) })
            .catch(() => setLoading(false))
    }, [refreshKey])

    useEffect(() => {
        setArticlesLoading(true)
        fetch('/api/articles')
            .then(res => res.json())
            .then(data => { setArticles(data); setArticlesLoading(false) })
            .catch(() => setArticlesLoading(false))
    }, [refreshKey])

    useEffect(() => {
        setMonitorsLoading(true)
        fetch('/api/automations')
            .then(res => res.json())
            .then(data => { setMonitors(data); setMonitorsLoading(false) })
            .catch(() => setMonitorsLoading(false))
    }, [refreshKey])

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
        if (activeConversationId === id) onNewChat()
    }

    const handleTogglePin = async (e: React.MouseEvent, conv: Conversation) => {
        e.stopPropagation()
        const newPinned = !conv.pinned
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

    const handleToggleMonitor = async (e: React.MouseEvent, monitor: Monitor) => {
        e.stopPropagation()
        const newEnabled = !monitor.enabled
        setMonitors(prev =>
            prev.map(m => m.id === monitor.id ? { ...m, enabled: newEnabled } : m)
        )
        await fetch(`/api/automations/${monitor.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: newEnabled }),
        })
    }

    const handleRunMonitor = async (e: React.MouseEvent, monitor: Monitor) => {
        e.stopPropagation()
        setRunningId(monitor.id)
        try {
            const res = await fetch(`/api/automations/${monitor.id}/run`, { method: 'POST' })
            const result = await res.json()
            setMonitors(prev =>
                prev.map(m => m.id === monitor.id ? {
                    ...m,
                    lastRunAt: new Date().toISOString(),
                    lastResult: result,
                } : m)
            )
        } catch (error) {
            console.error('Failed to run monitor:', error)
        } finally {
            setRunningId(null)
        }
    }

    const handleDeleteMonitor = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (!confirm('Delete this monitor?')) return
        await fetch(`/api/automations/${id}`, { method: 'DELETE' })
        setMonitors(prev => prev.filter(m => m.id !== id))
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

    const typeLabels: Record<string, string> = {
        youtube: 'YouTube',
        rss: 'RSS',
        keyword: 'Keyword',
        scheduled: 'Scheduled',
    }

    const typeBadgeColors: Record<string, string> = {
        youtube: 'bg-red-500/20 text-red-400 border-red-500/30',
        rss: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        keyword: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        scheduled: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
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
                                if (e.key === 'Escape') setEditingId(null)
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
                {(['chats', 'articles', 'monitors'] as TabType[]).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            tab === t
                                ? 'bg-white/10 text-white'
                                : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        {t === 'chats' ? 'Chats' : t === 'articles' ? 'Articles' : 'Monitors'}
                    </button>
                ))}
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
                    loading ? (
                        <div className="text-center text-slate-500 text-sm py-4">Loading...</div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center text-slate-500 text-sm py-4">
                            {search ? 'No matches' : 'No conversations yet'}
                        </div>
                    ) : (
                        <div className="space-y-0.5">
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
                            {unpinnedConvs.map(renderConversation)}
                        </div>
                    )
                ) : tab === 'articles' ? (
                    articlesLoading ? (
                        <div className="text-center text-slate-500 text-sm py-4">Loading...</div>
                    ) : articles.length === 0 ? (
                        <div className="text-center text-slate-500 text-sm py-4">No articles yet</div>
                    ) : (
                        <div className="space-y-0.5">
                            {articles.map(article => article.status === 'published' ? (
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
                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                            <span>Published</span>
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
                            ) : (
                                <div
                                    key={article.id}
                                    className="w-full group flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors text-slate-400 hover:bg-white/5 hover:text-slate-200 cursor-default"
                                >
                                    <FileText className="w-3.5 h-3.5 flex-shrink-0 text-amber-500/60" />
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate">{article.title}</div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                                            <span className="text-amber-400/70">Draft</span>
                                            <span>&middot;</span>
                                            <span>{formatDate(article.createdAt)}</span>
                                        </div>
                                        {article.summary && (
                                            <div className="mt-1 text-[10px] text-slate-600 line-clamp-2">{article.summary}</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    /* Monitors tab */
                    monitorsLoading ? (
                        <div className="text-center text-slate-500 text-sm py-4">Loading...</div>
                    ) : monitors.length === 0 ? (
                        <div className="text-center text-slate-500 text-sm py-8 px-4">
                            <Radio className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                            <p>No monitors yet</p>
                            <p className="text-xs text-slate-600 mt-1">Ask Canopticon to set one up in chat</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {monitors.map(monitor => (
                                <div
                                    key={monitor.id}
                                    className="group px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                            monitor.enabled ? 'bg-emerald-400' : 'bg-slate-500'
                                        }`} />
                                        <span className="flex-1 min-w-0 truncate text-slate-300">{monitor.name}</span>
                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => handleRunMonitor(e, monitor)}
                                                disabled={runningId === monitor.id}
                                                className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-emerald-400 transition-colors disabled:opacity-50"
                                                title="Run now"
                                            >
                                                {runningId === monitor.id ? (
                                                    <RotateCw className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <Play className="w-3 h-3" />
                                                )}
                                            </button>
                                            <button
                                                onClick={(e) => handleToggleMonitor(e, monitor)}
                                                className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors"
                                                title={monitor.enabled ? 'Pause' : 'Enable'}
                                            >
                                                {monitor.enabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                            </button>
                                            <button
                                                onClick={(e) => handleDeleteMonitor(e, monitor.id)}
                                                className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-red-400 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 ml-3.5">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                            typeBadgeColors[monitor.type] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                                        }`}>
                                            {typeLabels[monitor.type] || monitor.type}
                                        </span>
                                        {monitor.lastRunAt && (
                                            <span className="text-[10px] text-slate-500">
                                                Ran {formatDate(monitor.lastRunAt)}
                                            </span>
                                        )}
                                        {monitor.lastResult?.success === false && (
                                            <span className="text-[10px] text-red-400" title={monitor.lastResult?.error}>Failed</span>
                                        )}
                                        {monitor.lastResult?.skipped && (
                                            <span className="text-[10px] text-amber-400" title={monitor.lastResult?.reason}>Skipped</span>
                                        )}
                                        {monitor.lastResult?.success === true && (
                                            <span className="text-[10px] text-emerald-400">OK</span>
                                        )}
                                    </div>
                                    {monitor.prompt && (
                                        <div className="mt-1 ml-3.5 text-[10px] text-slate-600 truncate">
                                            {monitor.prompt}
                                        </div>
                                    )}
                                </div>
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

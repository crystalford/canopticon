'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Plus, MessageSquare, Trash2, Pencil, Search, Pin, PinOff, FileText, LayoutGrid, Settings, Video, Newspaper } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Conversation {
    id: string
    title: string | null
    pinned: boolean
    createdAt: string
    updatedAt: string
}

export function ConversationSidebar() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // We determine active conversation from URL ?c=ID
    // But if we are not on /chat, we might not have one.
    const activeConversationId = pathname.includes('/chat') ? searchParams.get('c') : null

    const isFeedsActive = pathname.includes('/feeds')
    const isArticlesActive = pathname.includes('/content')
    const isVideosActive = pathname.includes('/videos')

    const [conversations, setConversations] = useState<Conversation[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editTitle, setEditTitle] = useState('')
    const editInputRef = useRef<HTMLInputElement>(null)

    // Fetch conversations
    useEffect(() => {
        const fetchConvs = () => {
            fetch('/api/conversations')
                .then(res => res.json())
                .then(data => {
                    setConversations(data)
                    setLoading(false)
                })
                .catch(err => {
                    console.error(err)
                    setLoading(false)
                })
        }

        fetchConvs()
        const interval = setInterval(fetchConvs, 5000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        if (editingId) {
            editInputRef.current?.focus()
            editInputRef.current?.select()
        }
    }, [editingId])

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.preventDefault()
        e.stopPropagation()
        if (!confirm('Delete this conversation?')) return

        await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
        setConversations(prev => prev.filter(c => c.id !== id))

        // If we deleted the active one, go to new chat
        if (activeConversationId === id) {
            router.push('/chat')
        }
    }

    const handleTogglePin = async (e: React.MouseEvent, conv: Conversation) => {
        e.preventDefault()
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
        e.preventDefault()
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

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr)
            const now = new Date()
            const diffMs = now.getTime() - date.getTime()
            const diffHrs = diffMs / (1000 * 60 * 60)

            if (diffHrs < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            if (diffHrs < 48) return 'Yesterday'
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        } catch {
            return ''
        }
    }

    const filtered = search
        ? conversations.filter(c => (c.title || 'Untitled').toLowerCase().includes(search.toLowerCase()))
        : conversations

    const pinnedConvs = filtered.filter(c => c.pinned)
    const unpinnedConvs = filtered.filter(c => !c.pinned)

    const renderConversation = (conv: Conversation) => {
        const isEditing = editingId === conv.id
        const isActive = activeConversationId === conv.id

        return (
            <Link
                key={conv.id}
                href={`/chat?c=${conv.id}`}
                className={`w-full group flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors cursor-pointer ${isActive
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    }`}
                onClick={(e) => {
                    if (isEditing) e.preventDefault()
                }}
            >
                {conv.pinned ? (
                    <Pin className="w-3.5 h-3.5 flex-shrink-0 text-primary-400" />
                ) : (
                    <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                )}

                {isEditing ? (
                    <div className="flex-1 min-w-0 flex items-center gap-1" onClick={e => e.preventDefault()}>
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
                            className="flex-1 bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-sm text-white outline-none focus:border-red-500/50"
                        />
                    </div>
                ) : (
                    <div className="flex-1 min-w-0">
                        <div className="truncate">{conv.title || 'Untitled'}</div>
                        <div className="text-[10px] text-slate-600 truncate">{formatDate(conv.updatedAt)}</div>
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
                            className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-red-400 transition-colors"
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
            </Link>
        )
    }

    return (
        <div className="flex flex-col h-full bg-black/20 border-r border-white/5 w-64 flex-shrink-0">
            {/* App Nav Section (Top) */}
            <div className="p-3 space-y-1">
                <Link
                    href="/chat"
                    className={`nav-item w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${!activeConversationId && pathname === '/chat'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/10'
                        }`}
                >
                    <Plus className="w-4 h-4" />
                    New Chat
                </Link>

                <div className="h-px bg-white/5 my-2 mx-1" />

                <Link
                    href="/feeds"
                    className={`nav-item w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isFeedsActive
                        ? 'bg-white/10 text-white'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                        }`}
                >
                    <Newspaper className="w-4 h-4" />
                    Article Pipelines
                </Link>

                <Link
                    href="/content"
                    className={`nav-item w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isArticlesActive
                        ? 'bg-white/10 text-white'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                        }`}
                >
                    <FileText className="w-4 h-4" />
                    Articles
                </Link>

                <Link
                    href="/videos"
                    className={`nav-item w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isVideosActive
                        ? 'bg-white/10 text-white'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                        }`}
                >
                    <Video className="w-4 h-4" />
                    Videos
                </Link>

                <Link
                    href="/settings"
                    className={`nav-item w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${pathname.includes('/settings')
                        ? 'bg-white/10 text-white'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                        }`}
                >
                    <Settings className="w-4 h-4" />
                    Settings
                </Link>
            </div>

            {/* History Section */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="px-4 pt-4 pb-2 text-[10px] font-medium text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>History</span>
                </div>

                <div className="px-3 pb-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-300 placeholder-slate-500 outline-none focus:border-white/20 transition-colors"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-4">
                    {loading ? (
                        <div className="text-center text-slate-500 text-sm py-4">Loading...</div>
                    ) : (
                        <div className="space-y-0.5">
                            {pinnedConvs.length > 0 && (
                                <>
                                    <div className="px-3 pt-2 pb-1 text-[10px] font-medium text-slate-600">PINNED</div>
                                    {pinnedConvs.map(renderConversation)}
                                    <div className="px-3 pt-3 pb-1 text-[10px] font-medium text-slate-600">RECENT</div>
                                </>
                            )}
                            {/* Limit unpinned to last 50 to avoid performance issues maybe? No, list all for now */}
                            {unpinnedConvs.map(renderConversation)}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer / User Profile placeholder */}
            <div className="p-4 border-t border-white/5">
                <Link href="/" className="flex items-center gap-3 group">
                    {/* Canopticon Eye Mark - Small */}
                    <div className="relative w-6 h-6 flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
                            <defs>
                                <linearGradient id="sb-ring" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                                    <stop offset="0%" stopColor="#cbd5e1" />
                                    <stop offset="100%" stopColor="#64748b" />
                                </linearGradient>
                            </defs>
                            <circle cx="14" cy="14" r="12.5" stroke="url(#sb-ring)" strokeWidth="1.5" fill="none" />
                            <circle cx="14" cy="14" r="5.5" stroke="#ef4444" strokeWidth="1.2" fill="none" opacity="0.7" />
                            <circle cx="14" cy="14" r="2.5" fill="#ef4444" />
                        </svg>
                    </div>

                    <div className="flex-1 min-w-0">
                        {/* CAN-OPTI-CON Text Style - Small */}
                        <div className="text-sm font-black tracking-widest uppercase leading-none">
                            <span className="text-white">CAN</span>
                            <span className="text-red-500">OPTI</span>
                            <span className="text-white">CON</span>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">v2.0</div>
                    </div>
                </Link>
            </div>
        </div>
    )
}

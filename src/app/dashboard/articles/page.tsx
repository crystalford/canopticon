'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Edit, Eye, Filter, Calendar, List, Trash2, Plus } from 'lucide-react'

interface Article {
    id: string
    slug: string
    headline: string
    summary: string
    topics?: string[]
    isDraft: boolean
    publishedAt?: string
    createdAt: string
}

export default function ArticlesPage() {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [actionLoading, setActionLoading] = useState(false)
    const [articles, setArticles] = useState<Article[]>([])
    const [loading, setLoading] = useState(true)
    const [showDrafts, setShowDrafts] = useState(true)

    useEffect(() => {
        fetchArticles()
    }, [showDrafts])

    const fetchArticles = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (showDrafts) params.set('drafts', 'true')
            const res = await fetch(`/api/articles?${params}`)
            const data = await res.json()
            setArticles(data.articles || [])
        } catch (error) {
            console.error('Failed to fetch articles:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (slug: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!confirm('Permanently delete this article?')) return
        try {
            const res = await fetch(`/api/articles/${slug}`, { method: 'DELETE' })
            if (res.ok) {
                fetchArticles()
            } else {
                alert('Failed to delete article')
            }
        } catch (error) {
            alert('Error deleting article')
        }
    }

    // Handle "Select All"
    const handleSelectAll = () => {
        if (selectedIds.size === articles.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(articles.map(a => a.id)))
        }
    }

    // Handle individual toggle
    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) {
            newSet.delete(id)
        } else {
            newSet.add(id)
        }
        setSelectedIds(newSet)
    }

    // Bulk Action Handler
    const handleBulkAction = async (action: 'delete' | 'unpublish') => {
        if (action === 'delete') {
            if (!confirm(`Are you sure you want to PERMANENTLY delete ${selectedIds.size} articles?`)) return
        }

        setActionLoading(true)
        try {
            const res = await fetch('/api/articles/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    articleIds: Array.from(selectedIds)
                })
            })

            if (res.ok) {
                // Clear selection and refresh
                setSelectedIds(new Set())
                fetchArticles()
            } else {
                alert('Bulk action failed')
            }
        } catch (error) {
            console.error(error)
            alert('Error performing bulk action')
        } finally {
            setActionLoading(false)
        }
    }


    const [creating, setCreating] = useState(false)
    const router = useRouter()

    // Create New Article Handler
    const handleCreate = async () => {
        setCreating(true)
        try {
            const res = await fetch('/api/articles/create', { method: 'POST' })
            if (res.ok) {
                const data = await res.json()
                router.push(`/dashboard/articles/${data.slug}`)
            } else {
                alert('Failed to create new draft')
                setCreating(false)
            }
        } catch (error) {
            console.error(error)
            alert('Error creating draft')
            setCreating(false)
        }
    }

    return (
        <div className="space-y-8 relative">
            {/* Bulk Action Sticky Bar (only visible when items selected) */}
            {selectedIds.size > 0 && (
                <div className="sticky top-4 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
                    <div className="bg-slate-900/90 border border-primary-500/30 shadow-2xl shadow-primary-500/10 backdrop-blur-md rounded-xl p-4 flex items-center justify-between mx-auto max-w-2xl">
                        <div className="flex items-center gap-4">
                            <div className="text-white font-medium flex items-center gap-2">
                                <span className="bg-primary-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                    {selectedIds.size}
                                </span>
                                Selected
                            </div>
                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="text-xs text-slate-400 hover:text-white underline"
                            >
                                Clear
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleBulkAction('unpublish')}
                                disabled={actionLoading}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-white/10 hover:bg-slate-700 hover:text-white transition-colors text-sm font-medium"
                            >
                                Unpublish
                            </button>
                            <button
                                onClick={() => handleBulkAction('delete')}
                                disabled={actionLoading}
                                className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 transition-colors text-sm font-medium flex items-center gap-2"
                            >
                                {actionLoading ? 'Processing...' : (
                                    <>
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Delete
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Intelligence Archive</h1>
                    <p className="text-slate-400 text-sm">Manage and publish synthesized briefs.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleCreate}
                        disabled={creating}
                        className="btn-primary flex items-center gap-2 px-4 py-2"
                    >
                        {creating ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Plus className="w-4 h-4" />
                        )}
                        New Article
                    </button>

                    <div className="w-px h-8 bg-white/10 mx-1" />

                    <div className="flex items-center gap-3 bg-black/20 p-1 rounded-lg border border-white/10">
                        <button
                            onClick={() => setShowDrafts(!showDrafts)}
                            className={`
                                flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                                ${showDrafts
                                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30 shadow-[0_0_10px_rgba(14,165,233,0.1)]'
                                    : 'text-slate-500 hover:text-slate-300'
                                }
                            `}
                        >
                            <Filter className="w-3 h-3" />
                            {showDrafts ? 'Sort: Drafts' : 'Sort: Published'}
                        </button>
                        <div className="w-px h-4 bg-white/10" />
                        <button
                            onClick={handleSelectAll}
                            className="px-3 text-xs text-slate-500 font-medium hover:text-white transition-colors"
                        >
                            {selectedIds.size === articles.length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="grid gap-4 opacity-50">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="glass-panel p-6 h-32 animate-pulse" />
                    ))}
                </div>
            ) : articles.length === 0 ? (
                <div className="glass-panel p-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-white/5 mx-auto mb-4 flex items-center justify-center">
                        <List className="w-8 h-8 text-slate-600" />
                    </div>
                    <p className="text-white font-medium mb-1">No articles found</p>
                    <p className="text-sm text-slate-500">
                        Generate new briefs from the Daily Brief dashboard to create articles.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {articles.map(article => (
                        <div
                            key={article.id}
                            className={`
                                relative group block transition-all duration-200 min-w-0
                                ${selectedIds.has(article.id) ? 'translate-x-2' : ''}
                            `}
                        >
                            {/* Checkbox Overlay */}
                            <div className="absolute left-[-40px] top-0 bottom-0 flex items-center justify-center w-[40px] opacity-0 group-hover:opacity-100 transition-opacity">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(article.id)}
                                    onChange={() => toggleSelection(article.id)}
                                    className="w-5 h-5 rounded border-slate-600 bg-black/50 text-primary-500 focus:ring-offset-black focus:ring-primary-500"
                                />
                            </div>

                            {/* Always visible checkbox if selected */}
                            {selectedIds.has(article.id) && (
                                <div className="absolute left-[-40px] top-0 bottom-0 flex items-center justify-center w-[40px]">
                                    <input
                                        type="checkbox"
                                        checked={true}
                                        onChange={() => toggleSelection(article.id)}
                                        className="w-5 h-5 rounded border-slate-600 bg-black/50 text-primary-500 focus:ring-offset-black focus:ring-primary-500"
                                    />
                                </div>
                            )}

                            <Link
                                href={`/dashboard/articles/${article.slug}`}
                                className={`
                                    glass-card p-6 flex flex-col md:flex-row gap-6 hover:border-primary-500/20 transition-colors w-full max-w-full
                                    ${selectedIds.has(article.id) ? 'border-primary-500/40 bg-primary-500/5' : ''}
                                `}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-3">
                                        {article.isDraft ? (
                                            <div className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_8px_rgba(251,191,36,0.2)]">
                                                Draft
                                            </div>
                                        ) : (
                                            <div className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20 shadow-[0_0_8px_rgba(74,222,128,0.2)]">
                                                Published
                                            </div>
                                        )}
                                        <span className="text-[10px] text-slate-600 font-mono uppercase flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(article.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-white mb-2 truncate group-hover:text-primary-400 transition-colors">
                                        {article.headline}
                                    </h3>

                                    <p className="text-sm text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                                        {article.summary}
                                    </p>

                                    {article.topics && article.topics.length > 0 && (
                                        <div className="flex gap-2">
                                            {article.topics.slice(0, 3).map(topic => (
                                                <span key={topic} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 border border-white/10 text-slate-500">
                                                    {topic}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-3 md:border-l border-white/5 md:pl-6">
                                    <button
                                        onClick={(e) => handleDelete(article.slug, e)}
                                        className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                                        title="Delete Article"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    {!article.isDraft && (
                                        <a
                                            href={`/articles/${article.slug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                                            title="View Live"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Eye className="w-4 h-4" />
                                        </a>
                                    )}
                                </div>
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

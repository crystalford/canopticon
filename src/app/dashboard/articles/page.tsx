'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FileText, Edit, Eye, Filter, Calendar, List } from 'lucide-react'

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

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Intelligence Archive</h1>
                    <p className="text-slate-400 text-sm">Manage and publish synthesized briefs.</p>
                </div>

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
                        {showDrafts ? 'Showing Drafts' : 'Published Only'}
                    </button>
                    <div className="w-px h-4 bg-white/10" />
                    <span className="px-3 text-xs text-slate-500 font-mono">
                        {articles.length} ITEMS
                    </span>
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
                        <Link
                            key={article.id}
                            href={`/dashboard/articles/${article.slug}`}
                            className="glass-card p-6 flex flex-col md:flex-row gap-6 group block hover:border-primary-500/20 transition-colors"
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
                    ))}
                </div>
            )}
        </div>
    )
}

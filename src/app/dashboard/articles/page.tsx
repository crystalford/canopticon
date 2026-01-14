'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FileText, Edit, Eye } from 'lucide-react'

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
        <div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Articles</h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">Manage synthesized articles</p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={showDrafts}
                        onChange={(e) => setShowDrafts(e.target.checked)}
                        className="rounded border-slate-300"
                    />
                    Show drafts
                </label>
            </div>

            {loading ? (
                <div className="card p-8 text-center">
                    <div className="animate-pulse-subtle text-slate-500">Loading articles...</div>
                </div>
            ) : articles.length === 0 ? (
                <div className="card p-8 text-center">
                    <p className="text-slate-500 dark:text-slate-400">No articles yet</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                        Publish articles from the Daily Brief dashboard
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {articles.map(article => (
                        <div key={article.id} className="card p-6 hover:shadow-lg transition-shadow">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        {article.isDraft ? (
                                            <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                                                📝 Draft
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                                ✅ Published
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="font-semibold text-lg text-slate-900 dark:text-white mb-2">
                                        {article.headline}
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
                                        {article.summary.slice(0, 200)}...
                                    </p>
                                    {article.topics && article.topics.length > 0 && (
                                        <div className="flex gap-2 flex-wrap mb-3">
                                            {article.topics.slice(0, 5).map(topic => (
                                                <span key={topic} className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded">
                                                    {topic}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-xs text-slate-400">
                                        {article.publishedAt
                                            ? `Published: ${new Date(article.publishedAt).toLocaleString()}`
                                            : `Created: ${new Date(article.createdAt).toLocaleString()}`}
                                    </p>
                                </div>
                                <div className="ml-4 flex flex-col gap-2">
                                    <Link
                                        href={`/dashboard/articles/${article.slug}`}
                                        className="btn-primary text-sm flex items-center gap-2"
                                    >
                                        <Edit className="w-4 h-4" />
                                        Edit
                                    </Link>
                                    {!article.isDraft && (
                                        <a
                                            href={`/articles/${article.slug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn-secondary text-sm flex items-center gap-2"
                                        >
                                            <Eye className="w-4 h-4" />
                                            View
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

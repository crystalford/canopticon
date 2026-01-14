'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

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

    const publishArticle = async (id: string) => {
        try {
            const res = await fetch('/api/articles/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ article_id: id }),
            })
            if (res.ok) {
                fetchArticles()
            }
        } catch (error) {
            console.error('Failed to publish:', error)
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
                        Generate articles from approved signals
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {articles.map(article => (
                        <div key={article.id} className="card p-4">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        {article.isDraft ? (
                                            <span className="badge status-pending">Draft</span>
                                        ) : (
                                            <span className="badge status-approved">Published</span>
                                        )}
                                    </div>
                                    <h3 className="font-medium text-slate-900 dark:text-white mb-2">
                                        {article.headline}
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
                                        {article.summary.slice(0, 200)}...
                                    </p>
                                    {article.topics && article.topics.length > 0 && (
                                        <div className="flex gap-1 flex-wrap">
                                            {article.topics.slice(0, 5).map(topic => (
                                                <span key={topic} className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">
                                                    {topic}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="ml-4 flex flex-col gap-2">
                                    {article.isDraft ? (
                                        <button
                                            onClick={() => publishArticle(article.id)}
                                            className="btn-primary text-sm"
                                        >
                                            Publish
                                        </button>
                                    ) : (
                                        <Link
                                            href={`/articles/${article.slug}`}
                                            className="btn-secondary text-sm"
                                        >
                                            View
                                        </Link>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 mt-3">
                                {article.publishedAt
                                    ? `Published: ${new Date(article.publishedAt).toLocaleString()}`
                                    : `Created: ${new Date(article.createdAt).toLocaleString()}`}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

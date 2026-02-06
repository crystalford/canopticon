'use client'

import { useState, useEffect } from 'react'

interface Article {
    id: string
    slug: string
    headline: string
    summary: string
    topics: string[]
    isDraft: boolean
    createdAt: string
}

export default function ArticlesPage() {
    const [articles, setArticles] = useState<Article[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadArticles()
    }, [])

    async function loadArticles() {
        try {
            const res = await fetch('/api/admin/articles')
            const data = await res.json()
            setArticles(data.articles || [])
        } catch (error) {
            console.error('Error loading articles:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-4xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">
                    Articles
                </h1>
                <p className="text-slate-400">
                    View all generated articles from pipeline runs
                </p>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">
                    Loading articles...
                </div>
            ) : articles.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    No articles yet. Run a pipeline to generate one.
                </div>
            ) : (
                <div className="space-y-4">
                    {articles.map((article) => (
                        <div
                            key={article.id}
                            className="p-6 bg-white/5 rounded-lg border border-white/10"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h2 className="text-xl font-bold text-white">
                                        {article.headline}
                                    </h2>
                                    <p className="text-sm text-slate-400 mt-2">
                                        {article.summary}
                                    </p>
                                </div>
                                <span
                                    className={`px-3 py-1 rounded text-sm font-medium whitespace-nowrap ml-4 ${
                                        article.isDraft
                                            ? 'bg-yellow-500/20 text-yellow-400'
                                            : 'bg-green-500/20 text-green-400'
                                    }`}
                                >
                                    {article.isDraft ? 'Draft' : 'Published'}
                                </span>
                            </div>

                            <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                                <span>
                                    {new Date(article.createdAt).toLocaleDateString()}
                                </span>
                                <span className="text-slate-400">
                                    {article.topics.join(', ')}
                                </span>
                            </div>

                            <div className="text-sm text-slate-400 font-mono">
                                {article.slug}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

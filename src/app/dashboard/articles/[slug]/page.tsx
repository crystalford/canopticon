'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Article {
    id: string
    headline: string
    summary: string
    slug: string
    isDraft: boolean
    publishedAt: string | null
    topics: string[]
    entities: string[]
}

export default function ArticleEditorPage({ params }: { params: { slug: string } }) {
    const router = useRouter()
    const [article, setArticle] = useState<Article | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Form state
    const [headline, setHeadline] = useState('')
    const [content, setContent] = useState('') // This maps to summary for now
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetchArticle()
    }, [params.slug])

    const fetchArticle = async () => {
        try {
            // We need an endpoint to get article by slug. 
            // I'll assume we can use the existing /api/articles/[slug] if it exists, or hit the db via a new action
            // For now let's try reading from the list api or a specific one.
            // Wait, looking at open files, there is src/app/api/articles/[slug]/route.ts

            const res = await fetch(`/api/articles/${params.slug}`)
            if (!res.ok) throw new Error('Article not found')

            const data = await res.json()
            setArticle(data.article)
            setHeadline(data.article.headline)
            setContent(data.article.summary)
        } catch (err) {
            setError('Failed to load article')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch(`/api/articles/${params.slug}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    headline,
                    summary: content,
                    // TODO: Add isDraft toggle support later
                })
            })

            if (!res.ok) throw new Error('Failed to save')

            // Refresh local state
            const data = await res.json()
            setArticle(data.article)
            alert('Saved successfully')
        } catch (err) {
            alert('Failed to save changes')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="p-12 text-center">Loading editor...</div>
    if (error || !article) return <div className="p-12 text-center text-red-600">Error: {error || 'Article not found'}</div>

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="flex items-center justify-between mb-6">
                <Link href="/dashboard/articles" className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400">
                    ← Back to Articles
                </Link>
                <div className="flex items-center gap-3">
                    <span className={`badge ${article.isDraft ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                        {article.isDraft ? 'Draft' : 'Published'}
                    </span>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-primary"
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                <div className="card p-8">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Headline</label>
                    <input
                        type="text"
                        value={headline}
                        onChange={(e) => setHeadline(e.target.value)}
                        className="input text-2xl font-bold mb-6"
                    />

                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Content</label>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="input min-h-[500px] font-serif text-lg leading-relaxed whitespace-pre-wrap"
                    />
                </div>
            </div>
        </div>
    )
}

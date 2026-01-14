'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TipTapEditor from '@/components/editor/TipTapEditor'
import { FileText, Eye, Save, Upload, Trash2 } from 'lucide-react'

interface Article {
    id: string
    headline: string
    summary: string
    content: string | null
    excerpt: string | null
    metaDescription: string | null
    featuredImageUrl: string | null
    author: string
    readingTime: number | null
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
    const [content, setContent] = useState<string | null>(null)
    const [summary, setSummary] = useState('')
    const [excerpt, setExcerpt] = useState('')
    const [metaDescription, setMetaDescription] = useState('')
    const [featuredImageUrl, setFeaturedImageUrl] = useState('')
    const [saving, setSaving] = useState(false)
    const [publishing, setPublishing] = useState(false)

    useEffect(() => {
        fetchArticle()
    }, [params.slug])

    const fetchArticle = async () => {
        try {
            const res = await fetch(`/api/articles/${params.slug}`)
            if (!res.ok) throw new Error('Article not found')

            const data = await res.json()
            const a = data.article
            setArticle(a)
            setHeadline(a.headline)
            setContent(a.content)
            setSummary(a.summary)
            setExcerpt(a.excerpt || '')
            setMetaDescription(a.metaDescription || '')
            setFeaturedImageUrl(a.featuredImageUrl || '')
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
                    summary,
                    content,
                    excerpt: excerpt || null,
                    metaDescription: metaDescription || null,
                    featuredImageUrl: featuredImageUrl || null,
                })
            })

            if (!res.ok) throw new Error('Failed to save')

            const data = await res.json()
            setArticle(data.article)
            alert('✅ Saved successfully')
        } catch (err) {
            alert('❌ Failed to save changes')
        } finally {
            setSaving(false)
        }
    }

    const handlePublish = async () => {
        setPublishing(true)
        try {
            const res = await fetch(`/api/articles/${params.slug}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    isDraft: false,
                    publishedAt: new Date().toISOString(),
                })
            })

            if (!res.ok) throw new Error('Failed to publish')

            const data = await res.json()
            setArticle(data.article)
            alert('🚀 Published successfully!')
        } catch (err) {
            alert('❌ Failed to publish')
        } finally {
            setPublishing(false)
        }
    }

    const handleUnpublish = async () => {
        if (!confirm('Are you sure you want to unpublish this article?')) return

        setPublishing(true)
        try {
            const res = await fetch(`/api/articles/${params.slug}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    isDraft: true,
                })
            })

            if (!res.ok) throw new Error('Failed to unpublish')

            const data = await res.json()
            setArticle(data.article)
            alert('Article unpublished')
        } catch (err) {
            alert('❌ Failed to unpublish')
        } finally {
            setPublishing(false)
        }
    }

    if (loading) return <div className="p-12 text-center">Loading editor...</div>
    if (error || !article) return <div className="p-12 text-center text-red-600">Error: {error || 'Article not found'}</div>

    return (
        <div className="max-w-5xl mx-auto pb-20">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <Link href="/dashboard/articles" className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400">
                    ← Back to Articles
                </Link>
                <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${article.isDraft ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                        {article.isDraft ? '📝 Draft' : '✅ Published'}
                    </span>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    {article.isDraft ? (
                        <button
                            onClick={handlePublish}
                            disabled={publishing}
                            className="btn-primary flex items-center gap-2"
                        >
                            <Upload className="w-4 h-4" />
                            {publishing ? 'Publishing...' : 'Publish Now'}
                        </button>
                    ) : (
                        <button
                            onClick={handleUnpublish}
                            disabled={publishing}
                            className="btn-secondary flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            {publishing ? 'Unpublishing...' : 'Unpublish'}
                        </button>
                    )}
                    {!article.isDraft && (
                        <a
                            href={`/articles/${article.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary flex items-center gap-2"
                        >
                            <Eye className="w-4 h-4" />
                            View Live
                        </a>
                    )}
                </div>
            </div>

            {/* Main Editor */}
            <div className="space-y-6">
                <div className="card p-8">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Headline</label>
                    <input
                        type="text"
                        value={headline}
                        onChange={(e) => setHeadline(e.target.value)}
                        className="input text-2xl font-bold mb-6"
                        placeholder="Article headline..."
                    />

                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Content</label>
                    <TipTapEditor
                        content={content}
                        onChange={setContent}
                    />
                </div>

                {/* SEO Section */}
                <div className="card p-8">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        SEO & Metadata
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Featured Image URL
                            </label>
                            <input
                                type="text"
                                value={featuredImageUrl}
                                onChange={(e) => setFeaturedImageUrl(e.target.value)}
                                className="input"
                                placeholder="https://example.com/image.jpg"
                            />
                            {featuredImageUrl && (
                                <img src={featuredImageUrl} alt="Preview" className="mt-2 max-w-xs rounded shadow" />
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Excerpt (Brief Summary)
                            </label>
                            <textarea
                                value={excerpt}
                                onChange={(e) => setExcerpt(e.target.value)}
                                className="input h-20"
                                placeholder="A brief summary for article previews..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Meta Description (SEO)
                                <span className="text-xs text-slate-500 ml-2">({metaDescription.length}/160)</span>
                            </label>
                            <textarea
                                value={metaDescription}
                                onChange={(e) => setMetaDescription(e.target.value.slice(0, 160))}
                                className="input h-20"
                                placeholder="SEO description (150-160 characters)..."
                                maxLength={160}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

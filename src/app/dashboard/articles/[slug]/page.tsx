'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TipTapEditor from '@/components/editor/TipTapEditor'
import { FileText, Eye, Save, Upload, Trash2, ChevronLeft, Globe, Image as ImageIcon } from 'lucide-react'

interface Article {
    headline: string
    content: string | null
    excerpt: string | null
    metaDescription: string | null
    featuredImageUrl: string | null
    author: string
    slug: string
    isDraft: boolean
    publishedAt: string | null
}

export default function ArticleEditorPage({ params }: { params: { slug: string } }) {
    const router = useRouter()
    const [article, setArticle] = useState<Article | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Form state
    const [headline, setHeadline] = useState('')
    const [content, setContent] = useState<string | null>(null)
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
            setExcerpt(a.excerpt || '')
            setMetaDescription(a.metaDescription || '')
            setFeaturedImageUrl(a.featuredImageUrl || '')
        } catch (err) {
            setError('Failed to load article')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            await updateArticle({
                headline,
                content,
                excerpt: excerpt || null,
                metaDescription: metaDescription || null,
                featuredImageUrl: featuredImageUrl || null,
            })
            alert('Draft saved')
        } catch (err) {
            alert('Failed to save')
        } finally {
            setSaving(false)
        }
    }

    const handlePublish = async () => {
        setPublishing(true)
        try {
            await updateArticle({ isDraft: false, publishedAt: new Date() })
            alert('Published successfully')
            fetchArticle() // Refresh to show updated status
        } catch (err) {
            console.error('Publish error:', err)
            alert(`Failed to publish: ${err}`)
        } finally {
            setPublishing(false)
        }
    }

    const handleUnpublish = async () => {
        if (!confirm('Unpublish this article?')) return
        setPublishing(true)
        try {
            await updateArticle({ isDraft: true })
            alert('Unpublished')
        } catch (err) {
            alert('Failed to unpublish')
        } finally {
            setPublishing(false)
        }
    }

    const handleDelete = async () => {
        if (!confirm('Permanently delete this article? This cannot be undone.')) return
        try {
            const res = await fetch(`/api/articles/${params.slug}`, { method: 'DELETE' })
            if (res.ok) {
                alert('Article deleted')
                router.push('/dashboard/articles')
            } else {
                alert('Failed to delete article')
            }
        } catch (err) {
            alert('Error deleting article')
        }
    }

    const updateArticle = async (data: any) => {
        const res = await fetch(`/api/articles/${params.slug}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        if (!res.ok) throw new Error('Update failed')
        const json = await res.json()
        setArticle(json.article)
    }

    if (loading) return <div className="p-12 text-center text-slate-400">Loading editor...</div>
    if (error || !article) return <div className="p-12 text-center text-red-400">Error: {error || 'Article not found'}</div>

    return (
        <div className="max-w-6xl mx-auto pb-20 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 md:static z-20 bg-background/80 backdrop-blur-md pb-4 pt-2 md:py-0 border-b border-white/5 md:border-none">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/articles" className="p-2 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2 h-2 rounded-full ${article.isDraft ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]'}`} />
                            <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                                {article.isDraft ? 'DRAFT STATUS' : 'LIVE'}
                            </span>
                        </div>
                        <h1 className="text-lg font-bold text-white max-w-md truncate">{headline}</h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={handleDelete} className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors" title="Delete Article">
                        <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="w-px h-6 bg-white/10" />

                    <button onClick={handleSave} disabled={saving} className="btn-secondary">
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Saving...' : 'Save Draft'}
                    </button>

                    {article.isDraft ? (
                        <button onClick={handlePublish} disabled={publishing} className="btn-primary">
                            <Upload className="w-4 h-4 mr-2" />
                            {publishing ? 'Publishing...' : 'Publish'}
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button onClick={handleUnpublish} disabled={publishing} className="btn-secondary text-red-300 hover:text-red-200 hover:border-red-500/30">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Unpublish
                            </button>
                            <a href={`/articles/${article.slug}`} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                                <Eye className="w-4 h-4 mr-2" />
                                View Live
                            </a>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Editor */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="glass-panel p-1">
                        <input
                            type="text"
                            value={headline}
                            onChange={(e) => setHeadline(e.target.value)}
                            className="w-full bg-transparent border-none text-3xl font-bold text-white placeholder-slate-600 px-6 py-4 focus:ring-0 focus:outline-none"
                            placeholder="Article Headline..."
                        />
                        <div className="border-t border-white/5">
                            <TipTapEditor
                                content={content}
                                onChange={setContent}
                            />
                        </div>
                    </div>
                </div>

                {/* Sidebar Configuration */}
                <div className="space-y-6">
                    <div className="glass-panel p-6">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Globe className="w-4 h-4" />
                            Metadata & SEO
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-slate-400 text-xs font-medium mb-1.5 block">Excerpt</label>
                                <textarea
                                    value={excerpt}
                                    onChange={(e) => setExcerpt(e.target.value)}
                                    className="input min-h-[100px] text-sm leading-relaxed bg-black/40"
                                    placeholder="Brief summary for previews..."
                                />
                            </div>

                            <div>
                                <label className="text-slate-400 text-xs font-medium mb-1.5 block">
                                    Meta Description
                                    <span className={`ml-2 ${metaDescription.length > 160 ? 'text-red-400' : 'text-slate-600'}`}>
                                        {metaDescription.length}/160
                                    </span>
                                </label>
                                <textarea
                                    value={metaDescription}
                                    onChange={(e) => setMetaDescription(e.target.value.slice(0, 170))}
                                    className="input min-h-[80px] text-sm"
                                    placeholder="Search engine description..."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="glass-panel p-6">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" />
                            Media
                        </h3>
                        <div>
                            <label className="text-slate-400 text-xs font-medium mb-1.5 block">Featured Image URL</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={featuredImageUrl}
                                    onChange={(e) => setFeaturedImageUrl(e.target.value)}
                                    className="input text-sm"
                                    placeholder="https://..."
                                />
                            </div>
                            {featuredImageUrl && (
                                <div className="mt-3 relative aspect-video rounded-lg overflow-hidden border border-white/10">
                                    <img src={featuredImageUrl} alt="Preview" className="w-full h-full object-cover" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TipTapEditor from '@/components/editor/TipTapEditor'
import { ChevronLeft, Save, Globe, Eraser, Loader2, Sparkles, AlertCircle, CheckCircle, Wand2, Clock, Upload, Trash2, Eye } from 'lucide-react'

interface Article {
    id: string
    headline: string
    content: string | null
    excerpt: string | null
    metaDescription: string | null
    featuredImageUrl: string | null
    author: string
    slug: string
    isDraft: boolean
    publishedAt: string | null
    readingTime?: number
}

export default function ArticleEditorPage({ params }: { params: { slug: string } }) {
    const router = useRouter()
    const [article, setArticle] = useState<Article | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Form state
    const [headline, setHeadline] = useState('')
    const [slug, setSlug] = useState('')
    const [content, setContent] = useState<string | null>(null)
    const [excerpt, setExcerpt] = useState('')
    const [metaDescription, setMetaDescription] = useState('')
    const [featuredImageUrl, setFeaturedImageUrl] = useState('')
    const [saving, setSaving] = useState(false)
    const [publishing, setPublishing] = useState(false)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)
    const [autoSaving, setAutoSaving] = useState(false)
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

    // Track unsaved changes by comparing current state to loaded article
    const hasUnsavedChanges = useMemo(() => {
        if (!article) return false
        return (
            headline !== article.headline ||
            slug !== article.slug ||
            content !== article.content ||
            excerpt !== (article.excerpt || '') ||
            metaDescription !== (article.metaDescription || '')
        )
    }, [headline, slug, content, excerpt, metaDescription, article])

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
            setSlug(a.slug)
            setContent(a.content)
            setExcerpt(a.excerpt || '')
            setMetaDescription(a.metaDescription || '')
        } catch (err) {
            setError('Failed to load article')
        } finally {
            setLastSaved(new Date())
            setLoading(false)
        }
    }

    // Extract plain text from TipTap JSON content
    const getPlainTextFromContent = (contentJson: string | null): string => {
        if (!contentJson) return ''
        try {
            const parsed = JSON.parse(contentJson)
            const extractText = (node: any): string => {
                if (node.text) return node.text
                if (node.content) return node.content.map(extractText).join(' ')
                return ''
            }
            return extractText(parsed)
        } catch {
            return ''
        }
    }

    // Calculate reading time (words / 200)
    const calculateReadingTime = (contentJson: string | null): number => {
        const text = getPlainTextFromContent(contentJson)
        const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length
        return Math.max(1, Math.ceil(wordCount / 200))
    }

    // Core save function - saves all current content
    const saveAllContent = useCallback(async (showAlert: boolean = true) => {
        const readingTime = calculateReadingTime(content)
        const plainText = getPlainTextFromContent(content)

        // Basic slug validation
        const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

        await updateArticle({
            headline,
            slug: cleanSlug,
            content,
            // Sync summary with content for list view (first 800 chars)
            summary: plainText.slice(0, 800) || headline,
            excerpt: excerpt || null,
            metaDescription: metaDescription || null,
            readingTime,
            updatedAt: new Date(),
        })

        // If slug changed, we must redirect
        if (article && cleanSlug !== article.slug) {
            router.replace(`/dashboard/articles/${cleanSlug}`)
            // Don't setLastSaved here because we are unmounting
            return
        }

        setLastSaved(new Date())
        if (showAlert) alert('Changes saved')
    }, [headline, slug, content, excerpt, metaDescription, article, router])

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

    // Update button (formerly "Save Draft")
    const handleUpdate = async () => {
        setSaving(true)
        try {
            await saveAllContent(true)
        } catch (err) {
            alert('Failed to save')
        } finally {
            setSaving(false)
        }
    }

    // Autosave: debounced 30 second save after changes
    useEffect(() => {
        if (!hasUnsavedChanges || loading) return

        // Clear existing timer
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current)
        }

        // Set new timer for 30 seconds
        autoSaveTimerRef.current = setTimeout(async () => {
            setAutoSaving(true)
            try {
                await saveAllContent(false)
                console.log('[Autosave] Saved at', new Date().toISOString())
            } catch (err) {
                console.error('[Autosave] Failed:', err)
            } finally {
                setAutoSaving(false)
            }
        }, 30000)

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current)
            }
        }
    }, [hasUnsavedChanges, loading, saveAllContent])

    // Warn before leaving with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault()
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
            }
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [hasUnsavedChanges])

    // Auto-generate metadata from content
    const handleAutoFillMetadata = () => {
        const plainText = getPlainTextFromContent(content)

        // Auto-fill excerpt (first ~200 chars of content)
        if (!excerpt && plainText) {
            const autoExcerpt = plainText.slice(0, 200).trim()
            setExcerpt(autoExcerpt + (plainText.length > 200 ? '...' : ''))
        }

        // Auto-fill meta description (from headline + excerpt)
        if (!metaDescription) {
            const desc = `${headline}. ${plainText.slice(0, 120)}`.slice(0, 155)
            setMetaDescription(desc + '...')
        }
    }

    const handlePublish = async () => {
        setPublishing(true)
        try {
            // CRITICAL: Save ALL content when publishing, not just the flag
            const readingTime = calculateReadingTime(content)
            const plainText = getPlainTextFromContent(content)

            await updateArticle({
                headline,
                content,
                // Sync summary with content
                summary: plainText.slice(0, 800) || headline,
                excerpt: excerpt || null,
                metaDescription: metaDescription || null,
                readingTime,
                isDraft: false,
                publishedAt: article?.publishedAt || new Date(), // Keep original date if republishing
                updatedAt: new Date(),
            })
            setLastSaved(new Date())
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
                                {article.isDraft ? 'DRAFT' : 'LIVE'}
                            </span>
                            {hasUnsavedChanges && (
                                <span className="text-xs text-amber-400 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                    Unsaved changes
                                </span>
                            )}
                            {autoSaving && (
                                <span className="text-xs text-slate-500">Saving...</span>
                            )}
                            {lastSaved && !hasUnsavedChanges && !autoSaving && (
                                <span className="text-xs text-slate-600">Saved</span>
                            )}
                        </div>
                        <h1 className="text-lg font-bold text-white max-w-md truncate">{headline}</h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={handleDelete} className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors" title="Delete Article">
                        <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="w-px h-6 bg-white/10" />

                    <button onClick={handleUpdate} disabled={saving || !hasUnsavedChanges} className="btn-secondary">
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Saving...' : 'Update'}
                    </button>

                    {article.isDraft ? (
                        <button onClick={handlePublish} disabled={publishing} className="btn-primary">
                            <Upload className="w-4 h-4 mr-2" />
                            {publishing ? 'Publishing...' : 'Publish'}
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={async () => {
                                    if (!confirm('Send this article to all subscribers via email?')) return
                                    try {
                                        const res = await fetch('/api/newsletter/broadcast', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ articleId: article.id })
                                        })
                                        const data = await res.json()
                                        if (res.ok) {
                                            alert(`Sent to ${data.sent} subscribers`)
                                        } else {
                                            alert(`Error: ${data.error}`)
                                        }
                                    } catch (e) {
                                        alert('Failed to broadcast')
                                    }
                                }}
                                className="btn-secondary text-primary-300 hover:text-primary-200 hover:border-primary-500/30"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                                Send Email
                            </button>
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
                        {/* Editor Section */}
                        <div className="min-h-[500px] mb-8">
                            <TipTapEditor
                                content={content}
                                onChange={setContent}
                            />
                        </div>
                    </div>

                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Slug Editor */}
                    <div className="glass-panel p-6">
                        <label className="text-slate-400 text-xs font-medium mb-1.5 block">URL Slug</label>
                        <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-3 py-2">
                            <span className="text-slate-600 text-sm">/articles/</span>
                            <input
                                type="text"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                className="bg-transparent border-none text-sm text-white focus:ring-0 focus:outline-none w-full p-0"
                                placeholder="my-article-slug"
                            />
                        </div>
                    </div>

                    {/* Reading Time */}
                    <div className="glass-panel p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-400">
                            <Clock className="w-4 h-4" />
                            <span className="text-sm">Reading Time</span>
                        </div>
                        <span className="text-white font-bold">{calculateReadingTime(content)} min</span>
                    </div>

                    <div className="glass-panel p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Globe className="w-4 h-4" />
                                Metadata & SEO
                            </h3>
                            <button
                                onClick={handleAutoFillMetadata}
                                className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-primary-500/10 transition-colors"
                                title="Auto-fill from content"
                            >
                                <Wand2 className="w-3 h-3" />
                                Auto-fill
                            </button>
                        </div>

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

                </div>
            </div>
        </div>
    )
}

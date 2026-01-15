'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TipTapEditor from '@/components/editor/TipTapEditor'
import { ChevronLeft, Save, Globe, Eraser, Loader2, Sparkles, AlertCircle, CheckCircle, Wand2, Clock, Upload, Trash2, Eye } from 'lucide-react'

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

    // ... (rest of component unchanged until sidebar)

    {/* Sidebar */ }
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
            {/* ... Metadata/Search Engine Preview ... */}
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
            </div >
        </div >
    )
}

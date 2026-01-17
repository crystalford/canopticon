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
    topics: string[] | null
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
    const [topics, setTopics] = useState<string[]>([])
    const [newTopic, setNewTopic] = useState('')
    const [saving, setSaving] = useState(false)
    const [publishing, setPublishing] = useState(false)
    const [optimizing, setOptimizing] = useState(false)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)
    const [autoSaving, setAutoSaving] = useState(false)
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

    // Track unsaved changes by comparing current state to loaded article
    const hasUnsavedChanges = useMemo(() => {
        if (!article) return false
        // Simple array comparison for topics
        const topicsChanged = JSON.stringify(topics.sort()) !== JSON.stringify((article.topics || []).sort())

        return (
            headline !== article.headline ||
            slug !== article.slug ||
            content !== article.content ||
            excerpt !== (article.excerpt || '') ||
            metaDescription !== (article.metaDescription || '') ||
            topicsChanged
        )
    }, [headline, slug, content, excerpt, metaDescription, topics, article])

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
            setTopics(a.topics || [])
        } catch (err) {
            setError('Failed to load article')
        } finally {
            setLastSaved(new Date())
            setLoading(false)
        }
    }

    // Extract plain text from TipTap JSON content
    const getPlainTextFromContent = (contentData: string | object | null): string => {
        if (!contentData) {
            console.log('[ReadingTime] Content is null/empty')
            return ''
        }
        try {
            // contentData can be a string (JSON) or an object (if TipTap passed it directly)
            let parsed: any = contentData
            if (typeof contentData === 'string') {
                if (contentData.trim() === '') return ''
                parsed = JSON.parse(contentData)
            }

            const extractText = (node: any): string => {
                if (!node) return ''
                if (node.text) return node.text
                if (node.content && Array.isArray(node.content)) {
                    return node.content.map(extractText).join(' ')
                }
                return ''
            }
            const text = extractText(parsed)
            console.log(`[ReadingTime] Extracted text length: ${text.length}`)
            return text
        } catch (e) {
            console.error('[ReadingTime] Failed to parse content:', e)
            // Fallback for plain strings if it wasn't JSON
            return typeof contentData === 'string' ? contentData : ''
        }
    }

    // Calculate reading time (words / 200)
    const calculateReadingTime = (contentData: string | object | null): number => {
        const text = getPlainTextFromContent(contentData)
        // More robust word counting (handling newlines, multiple spaces)
        const words = text.trim().split(/[\s\n]+/)
        const wordCount = words.filter(w => w.length > 0).length
        console.log(`[ReadingTime] Word count: ${wordCount}`)

        // If we have content but word count is very low (e.g. just brackets), ensure we don't default to 1 blindly if it looks like an error
        if (wordCount === 0 && contentData) {
            console.warn('[ReadingTime] Content exists but word count is 0')
        }

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
            topics: topics,
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
    }, [headline, slug, content, excerpt, metaDescription, topics, article, router])

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

    // AI Optimization
    const handleOptimize = async () => {
        if (optimizing) return
        setOptimizing(true)
        try {
            const plainText = getPlainTextFromContent(content)
            if (!plainText || plainText.length < 50) {
                alert('Please write some content first.')
                return
            }

            const res = await fetch('/api/articles/optimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ headline, content: plainText })
            })

            if (!res.ok) throw new Error('Optimization failed')

            const data = await res.json()

            if (data.topics) setTopics(prev => Array.from(new Set([...prev, ...data.topics])))
            if (data.excerpt) setExcerpt(data.excerpt)
            if (data.metaDescription) setMetaDescription(data.metaDescription)

        } catch (err) {
            console.error(err)
            alert('Failed to optimize article. Please try again.')
        } finally {
            setOptimizing(false)
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
                topics,
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

    // Topics Handlers
    const addTopic = (e: React.FormEvent) => {
        e.preventDefault()
        const trimmed = newTopic.trim()
        if (trimmed && !topics.includes(trimmed)) {
            setTopics([...topics, trimmed])
            setNewTopic('')
        }
    }

    const removeTopic = (topicToRemove: string) => {
        setTopics(topics.filter(t => t !== topicToRemove))
    }


    // Broadcast State
    const [broadcasting, setBroadcasting] = useState(false)
    const [broadcastDraft, setBroadcastDraft] = useState<any[] | null>(null)
    const [showBroadcastModal, setShowBroadcastModal] = useState(false)
    const [bskyCreds, setBskyCreds] = useState({ handle: '', password: '' }) // Temp UI state

    const handleDraftBroadcast = async () => {
        if (!article) return
        setBroadcasting(true)
        setShowBroadcastModal(true)
        setBroadcastDraft(null)

        try {
            const res = await fetch('/api/broadcast/draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    headline: article.headline,
                    // Use plain text summary or content
                    summary: article.excerpt || article.metaDescription || headline,
                    url: `${window.location.origin}/articles/${article.slug}`
                })
            })
            const data = await res.json()
            if (!data.thread) throw new Error(data.error || 'Failed to generate draft')
            setBroadcastDraft(data.thread)
        } catch (e: any) {
            alert('Failed to draft broadcast: ' + e.message)
            setShowBroadcastModal(false)
        } finally {
            setBroadcasting(false)
        }
    }

    const handleSendBroadcast = async () => {
        if (!broadcastDraft || !bskyCreds.handle || !bskyCreds.password) {
            alert('Please provide Bluesky credentials')
            return
        }

        setBroadcasting(true)
        try {
            const res = await fetch('/api/broadcast/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    thread: broadcastDraft,
                    credentials: bskyCreds
                })
            })
            const data = await res.json()
            if (res.ok) {
                alert('Posted to Bluesky: ' + data.link)
                setShowBroadcastModal(false)
            } else {
                throw new Error(data.error)
            }
        } catch (e: any) {
            alert('Failed to post: ' + e.message)
        } finally {
            setBroadcasting(false)
        }
    }

    if (loading) return <div className="p-12 text-center text-slate-400">Loading editor...</div>
    if (error || !article) return <div className="p-12 text-center text-red-400">Error: {error || 'Article not found'}</div>

    return (
        <div className="max-w-6xl mx-auto pb-20 space-y-8 relative">
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
                                onClick={handleDraftBroadcast}
                                className="btn-secondary text-blue-400 hover:text-blue-300 hover:border-blue-500/30"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                                Broadcast
                            </button>
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
                                Email
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

                    {/* Optimize Panel (Moved to top of sidebar) */}
                    <div className="glass-panel p-6 border-primary-500/20 bg-primary-500/5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold text-primary-400 uppercase tracking-widest flex items-center gap-2">
                                <Sparkles className="w-4 h-4" />
                                AI Assistant
                            </h3>
                        </div>
                        <p className="text-xs text-slate-400 mb-4">
                            Auto-generate topics, excerpt, and SEO description from your content.
                        </p>
                        <button
                            onClick={handleOptimize}
                            disabled={optimizing}
                            className="w-full btn-secondary bg-primary-500/10 hover:bg-primary-500/20 text-primary-300 border-primary-500/20"
                        >
                            {optimizing ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Optimizing...
                                </>
                            ) : (
                                <>
                                    <Wand2 className="w-4 h-4 mr-2" />
                                    Magic Optimize
                                </>
                            )}
                        </button>
                    </div>

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

                    {/* Topics Editor - NEW */}
                    <div className="glass-panel p-6">
                        <label className="text-slate-400 text-xs font-medium mb-1.5 block">Topics / Tags</label>
                        <form onSubmit={addTopic} className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={newTopic}
                                onChange={(e) => setNewTopic(e.target.value)}
                                className="input flex-1 min-h-[36px] py-1 text-sm"
                                placeholder="Add topic..."
                            />
                            <button type="submit" disabled={!newTopic.trim()} className="btn-secondary px-3">
                                +
                            </button>
                        </form>
                        <div className="flex flex-wrap gap-2">
                            {topics.map(topic => (
                                <span key={topic} className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-slate-300 flex items-center gap-1 group">
                                    {topic}
                                    <button
                                        onClick={() => removeTopic(topic)}
                                        className="text-slate-500 hover:text-red-400 transition-colors ml-1"
                                    >
                                        &times;
                                    </button>
                                </span>
                            ))}
                            {topics.length === 0 && (
                                <span className="text-xs text-slate-600 italic">No topics added.</span>
                            )}
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
                            {/* Auto-fill button removed, replaced by Magic Optimize above */}
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

            {/* BROADCAST MODAL */}
            {showBroadcastModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-6 w-full max-w-2xl shadow-2xl relative">
                        <button
                            onClick={() => setShowBroadcastModal(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            &times;
                        </button>

                        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <span className="text-blue-400">Bluesky Broadcast</span>
                            <span className="text-sm font-normal text-slate-500 bg-white/5 px-2 py-0.5 rounded">Setup</span>
                        </h2>

                        {!broadcastDraft ? (
                            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                                <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary-400" />
                                <p>Generatng social thread using AI...</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Preview Thread</h3>
                                    {broadcastDraft.map((post, i) => (
                                        <div key={i} className="p-4 bg-white/5 rounded-lg border border-white/5">
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-800 flex-shrink-0" />
                                                <div className="space-y-1 w-full">
                                                    <div className="h-3 w-20 bg-slate-800 rounded" />
                                                    <p className="text-sm text-slate-200">{post.text}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-lg space-y-3">
                                    <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest">Connect Account</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-slate-500 mb-1 block">Handle (e.g. user.bsky.social)</label>
                                            <input
                                                type="text"
                                                className="input"
                                                value={bskyCreds.handle}
                                                onChange={e => setBskyCreds({ ...bskyCreds, handle: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 mb-1 block">App Password</label>
                                            <input
                                                type="password"
                                                className="input"
                                                value={bskyCreds.password}
                                                onChange={e => setBskyCreds({ ...bskyCreds, password: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-500">Go to Bluesky Settings &gt; Advanced &gt; App Passwords to generate one.</p>
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                                    <button
                                        onClick={() => setShowBroadcastModal(false)}
                                        className="btn-secondary"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSendBroadcast}
                                        disabled={broadcasting}
                                        className="btn-primary bg-blue-600 hover:bg-blue-500 shadow-blue-500/20"
                                    >
                                        {broadcasting ? 'Posting...' : 'Post Thread to Bluesky'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TipTapEditor from '@/components/editor/TipTapEditor'
import { ChevronLeft, Save, Globe, Eraser, Loader2, Sparkles, AlertCircle, CheckCircle, Wand2, Clock, Upload, Trash2, Eye, Send, Copy } from 'lucide-react'
import { DERIVATIVE_CONTENT_TEMPLATE } from '@/lib/templates'

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
    derivativeContent?: string | object | null
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

    // Distribution Cockpit State
    const [activeTab, setActiveTab] = useState<'write' | 'distribute' | 'derivative'>('write')
    const [socialText, setSocialText] = useState('')
    const [socialAccounts, setSocialAccounts] = useState<any[]>([])
    const [isPostingSocial, setIsPostingSocial] = useState(false)

    // Derivative Content State
    const [derivativeContent, setDerivativeContent] = useState('')

    // Track unsaved changes by comparing current state to loaded article
    const hasUnsavedChanges = useMemo(() => {
        if (!article) return false
        // Simple array comparison for topics
        const topicsChanged = JSON.stringify(topics.sort()) !== JSON.stringify((article.topics || []).sort())

        // Handle derivative content comparison (it might be text or jsonb string in DB)
        let originalDerivative = ''
        if (typeof article.derivativeContent === 'string') {
            originalDerivative = article.derivativeContent
        }

        return (
            headline !== article.headline ||
            slug !== article.slug ||
            content !== article.content ||
            excerpt !== (article.excerpt || '') ||
            metaDescription !== (article.metaDescription || '') ||
            topicsChanged ||
            derivativeContent !== originalDerivative
        )
    }, [headline, slug, content, excerpt, metaDescription, topics, derivativeContent, article])

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
            setDerivativeContent(typeof a.derivativeContent === 'string' ? a.derivativeContent : '')

            // Pre-fill social text
            setSocialText(a.excerpt || a.summary || a.headline + ' ' + `${window.location.origin}/articles/${a.slug}`)
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
            derivativeContent: derivativeContent || null, // SAVE DERIVATIVE CONTENT
            readingTime,
            updatedAt: new Date(),
        })

        // If slug changed, we must redirect
        if (article && cleanSlug !== article.slug) {
            router.replace(`/dashboard/articles/${cleanSlug}`)
            // Don't setLastSaved here because we are unmounting
            return
        }

        if (article) {
            // Update local article state to reflect saved changes (crucial for hasUnsavedChanges to reset)
            setArticle({
                ...article,
                headline,
                slug: cleanSlug,
                content,
                excerpt: excerpt || null,
                metaDescription: metaDescription || null,
                topics: topics,
                derivativeContent: derivativeContent || null,
            })
        }

        setLastSaved(new Date())
        if (showAlert) alert('Changes saved')
    }, [headline, slug, content, excerpt, metaDescription, topics, derivativeContent, article, router])

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

        } catch (err: any) {
            console.error(err)
            alert(`Failed to optimize: ${err.message || 'Unknown error'}`)
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
                derivativeContent: derivativeContent || null,
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

    useEffect(() => {
        fetchAccounts()
    }, [])

    const fetchAccounts = async () => {
        try {
            const res = await fetch('/api/settings/social-accounts')
            const data = await res.json()
            if (Array.isArray(data)) {
                setSocialAccounts(data.filter(a => a.isActive))
            }
        } catch (e) {
            console.error('Failed to load accounts')
        }
    }

    const handleSocialPost = async () => {
        if (!socialText.trim()) return alert('Please write a post first')
        if (socialAccounts.length === 0) return alert('No active social accounts found. Please configure them in Settings.')

        if (!confirm(`Post to ${socialAccounts.length} accounts (${socialAccounts.map(a => a.platform).join(', ')})?`)) return

        setIsPostingSocial(true)
        try {
            const res = await fetch('/api/broadcast/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    thread: [{ text: socialText }],
                    accountIds: socialAccounts.map(a => a.id)
                })
            })
            const data = await res.json()
            if (res.ok) {
                alert(`Successfully posted to ${socialAccounts.length} accounts!`)
                setSocialText('') // Clear after post? Or keep?
            } else {
                alert(`Error: ${data.message || data.error}`)
            }
        } catch (e: any) {
            alert('Failed to post: ' + e.message)
        } finally {
            setIsPostingSocial(false)
        }
    }

    const handleNewsletterBroadcast = async () => {
        if (!confirm('Send this article to all subscribers via email?')) return
        try {
            const res = await fetch('/api/newsletter/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ articleId: article!.id })
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
    }

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text).then(() => {
            alert(`Copied ${label} to clipboard!`)
        }, (err) => {
            console.error('Async: Could not copy text: ', err);
        });
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
                    {/* Tab Switcher */}
                    <div className="bg-white/5 rounded-lg p-1 flex items-center gap-1 mr-4">
                        <button
                            onClick={() => setActiveTab('write')}
                            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${activeTab === 'write' ? 'bg-primary-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            WRITE
                        </button>
                        <button
                            onClick={() => setActiveTab('derivative')}
                            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${activeTab === 'derivative' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            DERIVATIVES
                        </button>
                        <button
                            onClick={() => setActiveTab('distribute')}
                            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${activeTab === 'distribute' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            DISTRIBUTE
                        </button>
                    </div>

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
                            <a href={`/articles/${article.slug}`} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                                <Eye className="w-4 h-4 mr-2" />
                                View Live
                            </a>
                        </div>
                    )}
                </div>
            </div>

            {activeTab === 'write' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
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
                        {/* Optimize Panel */}
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

                        {/* Topics Editor */}
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
            )}

            {activeTab === 'derivative' && (
                <div className="animate-in fade-in slide-in-from-bottom-4">
                    <div className="glass-panel p-6">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                                    Derivative Content Strategy
                                </h2>
                                <p className="text-sm text-slate-400 mt-1">
                                    Manage scripts, threads, and alerts derived from this article.
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    if (confirm('Overwrite current content with default template?')) {
                                        setDerivativeContent(DERIVATIVE_CONTENT_TEMPLATE.trim())
                                    }
                                }}
                                className="btn-secondary text-xs"
                            >
                                <Copy className="w-4 h-4 mr-2" />
                                Load Template
                            </button>
                        </div>

                        <textarea
                            className="w-full h-[600px] bg-black/40 border border-white/10 rounded-lg p-6 font-mono text-sm leading-relaxed text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-y"
                            placeholder="# Derivative Content..."
                            value={derivativeContent}
                            onChange={(e) => setDerivativeContent(e.target.value)}
                        />
                    </div>
                </div>
            )}

            {activeTab === 'distribute' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4">

                    {/* Social Section */}
                    <div className="lg:col-span-4 glass-panel p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                Social Broadcast
                                <span className="text-xs font-normal text-slate-500 ml-2 border border-white/10 px-2 py-0.5 rounded-full">Bluesky & Mastodon</span>
                            </h2>
                            <span className="text-xs text-slate-500">
                                Active Accounts: {socialAccounts.length}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <textarea
                                    className="input min-h-[120px] font-sans text-lg"
                                    placeholder="Write your update here... (AI Draft feature coming)"
                                    value={socialText}
                                    onChange={(e) => setSocialText(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSocialPost}
                                        disabled={isPostingSocial || !socialText.trim()}
                                        className="btn-primary flex-1"
                                    >
                                        <Send className="w-4 h-4 mr-2" />
                                        {isPostingSocial ? 'Posting...' : 'Post Now'}
                                    </button>
                                    <Link href="/dashboard/broadcaster" className="btn-secondary">
                                        Open Broadcaster
                                    </Link>
                                </div>
                            </div>
                            <div className="bg-black/20 rounded-lg p-4 text-xs text-slate-400 border border-white/5">
                                <p className="mb-2 font-bold text-slate-500 uppercase tracking-widest">Preview</p>
                                <div className="flex gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-700" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 w-24 bg-slate-800 rounded" />
                                        <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{socialText || 'Your post content will appear here...'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Channel Cards */}
                    {/* Resend */}
                    <div className="glass-panel p-6 space-y-4">
                        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400 mb-2">
                            <Send className="w-5 h-5" />
                        </div>
                        <h3 className="text-sm font-bold text-white">Newsletter</h3>
                        <p className="text-xs text-slate-400">Send to all verified subscribers.</p>
                        <button onClick={handleNewsletterBroadcast} className="btn-secondary w-full text-xs">
                            Broadcast Email
                        </button>
                    </div>

                    {/* Substack */}
                    <div className="glass-panel p-6 space-y-4">
                        <div className="w-10 h-10 rounded-lg bg-[#FF6719]/10 flex items-center justify-center text-[#FF6719] mb-2">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" /></svg>
                        </div>
                        <h3 className="text-sm font-bold text-white">Substack</h3>
                        <div className="space-y-2">
                            <button onClick={() => handleCopy(headline, 'Headline')} className="btn-secondary w-full text-xs justify-start">
                                <span className="mr-2">📋</span> Copy Title
                            </button>
                            <button onClick={() => handleCopy(content || '', 'Content')} className="btn-secondary w-full text-xs justify-start">
                                <span className="mr-2">📋</span> Copy HTML Content
                            </button>
                        </div>
                        <a href="https://substack.com/publish" target="_blank" rel="noopener noreferrer" className="btn-primary w-full text-xs mt-2 bg-[#FF6719] hover:bg-[#FF6719]/90 border-none">
                            Open Substack
                        </a>
                    </div>

                    {/* YouTube */}
                    <div className="glass-panel p-6 space-y-4">
                        <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 mb-2">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" /></svg>
                        </div>
                        <h3 className="text-sm font-bold text-white">YouTube</h3>
                        <div className="space-y-2">
                            <button onClick={() => handleCopy(headline, 'Headline')} className="btn-secondary w-full text-xs justify-start">
                                <span className="mr-2">📋</span> Copy Headline
                            </button>
                            <button onClick={() => handleCopy(excerpt, 'Description')} className="btn-secondary w-full text-xs justify-start">
                                <span className="mr-2">📋</span> Copy Description
                            </button>
                        </div>
                        <a href="https://studio.youtube.com" target="_blank" rel="noopener noreferrer" className="btn-primary w-full text-xs mt-2 bg-red-600 hover:bg-red-500 border-none">
                            Open Studio
                        </a>
                    </div>

                </div>
            )}
        </div>
    )
}

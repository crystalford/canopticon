'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    ArrowLeft, Play, Zap, Calendar, CheckCircle, AlertTriangle,
    ExternalLink, Loader2, Save, RefreshCw, Power, ChevronRight
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import Link from 'next/link'

interface Automation {
    id: string
    name: string
    type: string
    enabled: boolean
    autoPublish: boolean
    prompt: string | null
    lastRunAt: string | null
    lastResult: any
    config: any
    createdAt: string
}

interface VideoClip {
    id: string
    videoTitle: string | null
    youtubeUrl: string
    clipUrl: string | null
    status: string
    clipRationale: string | null
    createdAt: string
}

interface Video {
    videoId: string
    title: string
    link: string
    pubDate: string
    description: string
    thumbnail: string | null
}

interface Article {
    id: string
    title: string
    slug: string
    status: string
    summary: string | null
    createdAt: string
}

interface RunResult {
    success: boolean
    skipped?: boolean
    articleId?: string
    articleTitle?: string
    articleSummary?: string
    threadUrl?: string
    xPostError?: string
    error?: string
}

// Perplexity is used automatically for web search — only tool-capable models here
const WRITING_MODEL_OPTIONS = [
    { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', label: 'Claude Sonnet (recommended)' },
    { provider: 'openai', model: 'gpt-4o', label: 'OpenAI GPT-4o' },
    { provider: 'openai', model: 'gpt-4o-mini', label: 'OpenAI GPT-4o Mini (fast)' },
]

// Derive individual output flags from config (supports both new flags + legacy outputMode)
function deriveFlags(config: any) {
    if ('writeArticle' in config || 'postX' in config) {
        return {
            writeArticle: config.writeArticle ?? true,
            articleDraft: config.articleDraft ?? false,
            clipVideo: config.clipVideo ?? false,
            postX: config.postX ?? false,
            xFormat: config.xFormat ?? 'thread',
            xTweetCount: config.xTweetCount ?? 4,
            includeArticleLink: config.includeArticleLink ?? false,
        }
    }
    // Legacy outputMode
    const mode = config.outputMode || 'article_and_x'
    return {
        writeArticle: mode !== 'x_only',
        articleDraft: mode === 'draft',
        clipVideo: config.videoClippingEnabled ?? false,
        postX: ['article_and_x', 'article_and_x_post', 'x_only'].includes(mode),
        xFormat: mode === 'article_and_x_post' ? 'post' : 'thread',
        xTweetCount: 4,
        includeArticleLink: false,
    }
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-red-600' : 'bg-white/10'}`}
        >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    )
}

export default function PipelineDetailPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()

    const [auto, setAuto] = useState<Automation | null>(null)
    const [videos, setVideos] = useState<Video[]>([])
    const [articles, setArticles] = useState<Article[]>([])
    const [loading, setLoading] = useState(true)
    const [videosLoading, setVideosLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [runningVideoId, setRunningVideoId] = useState<string | null>(null)
    const [videoRunResults, setVideoRunResults] = useState<Record<string, RunResult>>({})
    const [clips, setClips] = useState<VideoClip[]>([])
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')

    // Editable fields
    const [prompt, setPrompt] = useState('')
    const [writingProvider, setWritingProvider] = useState('anthropic')
    const [writingModel, setWritingModel] = useState('claude-3-5-sonnet-20241022')

    // Output flags
    const [writeArticle, setWriteArticle] = useState(true)
    const [articleDraft, setArticleDraft] = useState(false)
    const [clipVideo, setClipVideo] = useState(false)
    const [postX, setPostX] = useState(false)
    const [xFormat, setXFormat] = useState<'thread' | 'post'>('thread')
    const [xTweetCount, setXTweetCount] = useState(4)
    const [includeArticleLink, setIncludeArticleLink] = useState(false)

    const fetchAuto = useCallback(async () => {
        const res = await fetch(`/api/automations/${id}`)
        if (!res.ok) { router.push('/feeds'); return }
        const data: Automation = await res.json()
        setAuto(data)
        setPrompt(data.prompt || '')
        setWritingProvider(data.config.writingProvider || 'anthropic')
        setWritingModel(data.config.writingModel || 'claude-3-5-sonnet-20241022')
        const flags = deriveFlags(data.config)
        setWriteArticle(flags.writeArticle)
        setArticleDraft(flags.articleDraft)
        setClipVideo(flags.clipVideo)
        setPostX(flags.postX)
        setXFormat(flags.xFormat as 'thread' | 'post')
        setXTweetCount(flags.xTweetCount)
        setIncludeArticleLink(flags.includeArticleLink)
        setLoading(false)
    }, [id, router])

    const fetchArticles = useCallback(async () => {
        const res = await fetch(`/api/articles?automationId=${id}`)
        if (res.ok) setArticles(await res.json())
    }, [id])

    const fetchClips = useCallback(async () => {
        const res = await fetch(`/api/videos?automationId=${id}`)
        if (res.ok) setClips(await res.json())
    }, [id])

    const fetchVideos = useCallback(async () => {
        if (!auto || auto.type !== 'youtube') return
        setVideosLoading(true)
        try {
            const res = await fetch(`/api/automations/${id}/videos`)
            if (res.ok) {
                const data = await res.json()
                setVideos(data.videos || [])
            }
        } finally {
            setVideosLoading(false)
        }
    }, [auto, id])

    useEffect(() => { fetchAuto() }, [fetchAuto])
    useEffect(() => { if (auto) { fetchArticles(); fetchVideos(); fetchClips() } }, [auto, fetchArticles, fetchVideos, fetchClips])

    const handleSave = async () => {
        if (!auto) return
        setSaving(true)
        try {
            const res = await fetch(`/api/automations/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    config: {
                        ...auto.config,
                        // New output flags (replaces outputMode + videoClippingEnabled)
                        writeArticle,
                        articleDraft,
                        clipVideo,
                        postX,
                        xFormat,
                        xTweetCount,
                        includeArticleLink,
                        writingProvider,
                        writingModel,
                    }
                })
            })
            if (res.ok) {
                setSaveStatus('saved')
                setTimeout(() => setSaveStatus('idle'), 2000)
                await fetchAuto()
            } else {
                setSaveStatus('error')
            }
        } finally {
            setSaving(false)
        }
    }

    const handleToggleEnabled = async () => {
        if (!auto) return
        await fetch(`/api/automations/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: !auto.enabled })
        })
        await fetchAuto()
    }

    const handleRunVideo = async (video: Video) => {
        setRunningVideoId(video.videoId)
        setVideoRunResults(prev => { const n = { ...prev }; delete n[video.videoId]; return n })
        try {
            const res = await fetch(`/api/automations/${id}/run-video`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: video.title,
                    link: video.link,
                    pubDate: video.pubDate,
                    description: video.description,
                })
            })
            const data = await res.json()

            let articleTitle: string | undefined
            let articleSummary: string | undefined
            if (data.articleId) {
                const artRes = await fetch(`/api/articles/${data.articleId}`)
                if (artRes.ok) {
                    const art = await artRes.json()
                    articleTitle = art.title
                    articleSummary = art.summary?.substring(0, 200)
                }
            }

            setVideoRunResults(prev => ({ ...prev, [video.videoId]: { ...data, articleTitle, articleSummary } }))
            await fetchArticles()
        } catch (e: any) {
            setVideoRunResults(prev => ({ ...prev, [video.videoId]: { success: false, error: e.message } }))
        } finally {
            setRunningVideoId(null)
        }
    }

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto py-12 px-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-white/5 rounded w-64" />
                    <div className="h-48 bg-white/5 rounded" />
                </div>
            </div>
        )
    }

    if (!auto) return null

    const config = auto.config as Record<string, any>
    const isYouTube = auto.type === 'youtube'

    const savedFlags = deriveFlags(config)
    const hasUnsavedChanges =
        prompt !== (auto.prompt || '') ||
        writeArticle !== savedFlags.writeArticle ||
        articleDraft !== savedFlags.articleDraft ||
        clipVideo !== savedFlags.clipVideo ||
        postX !== savedFlags.postX ||
        xFormat !== savedFlags.xFormat ||
        xTweetCount !== savedFlags.xTweetCount ||
        includeArticleLink !== savedFlags.includeArticleLink ||
        writingModel !== (config.writingModel || 'claude-3-5-sonnet-20241022')

    return (
        <div className="max-w-4xl mx-auto py-10 px-6 space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <Link href="/feeds" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm mb-3 transition-colors">
                        <ArrowLeft size={14} /> Back to Pipelines
                    </Link>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-white">{auto.name}</h1>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-mono ${isYouTube ? 'text-red-400 border-red-500/30 bg-red-500/10' : 'text-blue-400 border-blue-500/30 bg-blue-500/10'}`}>
                            {isYouTube ? '⚡ YouTube' : auto.type}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${auto.enabled ? 'text-green-400 bg-green-500/10' : 'text-slate-500 bg-white/5'}`}>
                            {auto.enabled ? 'Active' : 'Paused'}
                        </span>
                    </div>
                    {isYouTube && <p className="text-slate-500 font-mono text-xs mt-1">Channel: {config.channelId}</p>}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleToggleEnabled}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${auto.enabled
                            ? 'border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                            : 'border-green-500/30 text-green-400 hover:bg-green-500/10'}`}
                    >
                        <Power size={13} /> {auto.enabled ? 'Pause' : 'Resume'}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!hasUnsavedChanges || saving}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${hasUnsavedChanges
                            ? 'bg-red-600 hover:bg-red-500 text-white'
                            : 'bg-white/5 text-slate-600 cursor-not-allowed'}`}
                    >
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        {saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'error' ? '✗ Error' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Config Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Outputs */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Outputs</h3>
                    <div className="space-y-3">

                        {/* Article */}
                        <div className={`rounded-xl border p-4 transition-colors ${writeArticle ? 'border-white/15 bg-white/[0.02]' : 'border-white/[0.06]'}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-base">📄</span>
                                    <div>
                                        <div className="text-sm font-medium text-white">Article</div>
                                        <div className="text-[11px] text-slate-500">Write and publish a full article</div>
                                    </div>
                                </div>
                                <Toggle checked={writeArticle} onChange={setWriteArticle} />
                            </div>
                            {writeArticle && (
                                <div className="mt-3 pt-3 border-t border-white/[0.06] flex gap-5">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" checked={!articleDraft} onChange={() => setArticleDraft(false)} className="accent-red-500" />
                                        <span className="text-xs text-slate-300">Auto-publish</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" checked={articleDraft} onChange={() => setArticleDraft(true)} className="accent-red-500" />
                                        <span className="text-xs text-slate-300">Save as draft</span>
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* Video Clip (YouTube only) */}
                        {isYouTube && (
                            <div className={`rounded-xl border p-4 transition-colors ${clipVideo ? 'border-white/15 bg-white/[0.02]' : 'border-white/[0.06]'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-base">🎬</span>
                                        <div>
                                            <div className="text-sm font-medium text-white">Video Clip</div>
                                            <div className="text-[11px] text-slate-500">AI finds the best 30-90s hook, clips via Apify</div>
                                        </div>
                                    </div>
                                    <Toggle checked={clipVideo} onChange={setClipVideo} />
                                </div>
                            </div>
                        )}

                        {/* Post to X */}
                        <div className={`rounded-xl border p-4 transition-colors ${postX ? 'border-white/15 bg-white/[0.02]' : 'border-white/[0.06]'}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-bold text-slate-200 w-5 text-center">𝕏</span>
                                    <div>
                                        <div className="text-sm font-medium text-white">Post to X</div>
                                        <div className="text-[11px] text-slate-500">
                                            {clipVideo ? 'Native clip attached to first tweet' : 'YouTube thumbnail attached'}
                                        </div>
                                    </div>
                                </div>
                                <Toggle checked={postX} onChange={setPostX} />
                            </div>
                            {postX && (
                                <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-3">
                                    <div className="flex gap-5">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" checked={xFormat === 'thread'} onChange={() => setXFormat('thread')} className="accent-red-500" />
                                            <span className="text-xs text-slate-300">Thread</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" checked={xFormat === 'post'} onChange={() => setXFormat('post')} className="accent-red-500" />
                                            <span className="text-xs text-slate-300">Single post</span>
                                        </label>
                                    </div>
                                    {xFormat === 'thread' && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-slate-500 mr-1">Tweets:</span>
                                            {[3, 4, 5].map(n => (
                                                <button
                                                    key={n}
                                                    type="button"
                                                    onClick={() => setXTweetCount(n)}
                                                    className={`w-7 h-7 rounded-lg text-xs font-bold border transition-colors ${xTweetCount === n ? 'bg-red-600 border-red-500 text-white' : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20'}`}
                                                >
                                                    {n}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {writeArticle && (
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={includeArticleLink}
                                                onChange={e => setIncludeArticleLink(e.target.checked)}
                                                className="accent-red-500 w-3.5 h-3.5"
                                            />
                                            <span className="text-xs text-slate-400">
                                                Include article link <span className="text-slate-600">(default: links to YouTube)</span>
                                            </span>
                                        </label>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                </div>

                {/* AI Models */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">AI Model</h3>
                    <div>
                        <select
                            value={`${writingProvider}/${writingModel}`}
                            onChange={e => {
                                const [p, m] = e.target.value.split('/')
                                setWritingProvider(p)
                                setWritingModel(m)
                            }}
                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-white/20"
                        >
                            {WRITING_MODEL_OPTIONS.map(o => (
                                <option key={`${o.provider}/${o.model}`} value={`${o.provider}/${o.model}`}>{o.label}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-600 mt-1.5">Writes articles and publishes. Perplexity web search runs automatically.</p>
                    </div>
                </div>
            </div>

            {/* AI Instructions */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">AI Instructions (Prompt)</h3>
                <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    rows={5}
                    placeholder="e.g. Write a sharp, critical news article focused on the political implications. Highlight any contradictions with previous statements. Use plain language, no jargon."
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 font-mono focus:outline-none focus:border-white/20 resize-y"
                />
                <p className="text-[10px] text-slate-600 mt-1.5">Guides how the AI writes content for this pipeline. Each pipeline can have a completely different tone and focus.</p>
            </div>

            {/* YouTube: Recent Videos (Retroactive Runner) */}
            {isYouTube && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-semibold text-white">Recent Videos — Run on Any</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Don't wait for a new video. Click ▶ on any past video to run the pipeline on it right now.</p>
                        </div>
                        <button onClick={fetchVideos} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-colors">
                            <RefreshCw size={14} className={videosLoading ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    {videosLoading && videos.length === 0 ? (
                        <div className="space-y-2">
                            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />)}
                        </div>
                    ) : videos.length === 0 ? (
                        <p className="text-sm text-slate-500">No videos found — check that the channel ID is correct.</p>
                    ) : (
                        <div className="space-y-2">
                            {videos.map(video => {
                                const result = videoRunResults[video.videoId]
                                const isRunning = runningVideoId === video.videoId
                                return (
                                    <div key={video.videoId} className="border border-white/[0.06] rounded-lg overflow-hidden">
                                        <div className="flex items-start gap-3 p-3">
                                            {video.thumbnail && (
                                                <img
                                                    src={video.thumbnail}
                                                    alt={video.title || ''}
                                                    className="w-24 h-14 object-cover rounded shrink-0 bg-black/20"
                                                />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-slate-200 font-medium line-clamp-2 leading-snug">{video.title}</div>
                                                <div className="text-xs text-slate-600 mt-0.5">
                                                    {video.pubDate ? format(new Date(video.pubDate), 'MMM d, yyyy') : ''}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRunVideo(video)}
                                                disabled={isRunning || !!runningVideoId}
                                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors ${isRunning
                                                    ? 'bg-white/5 text-slate-500 cursor-wait'
                                                    : runningVideoId
                                                        ? 'bg-white/5 text-slate-600 cursor-not-allowed'
                                                        : 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20'}`}
                                            >
                                                {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} className="fill-current" />}
                                                {isRunning ? 'Running…' : 'Run'}
                                            </button>
                                        </div>
                                        {result && (
                                            <div className={`px-3 py-2 text-xs border-t ${result.success ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                                                {result.success ? (
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-3 flex-wrap">
                                                            <span className="text-green-400 flex items-center gap-1">
                                                                <CheckCircle size={11} /> Done
                                                            </span>
                                                            {result.articleId && (
                                                                <a href="/content" className="text-green-300 underline underline-offset-2 flex items-center gap-1">
                                                                    <ExternalLink size={10} /> View Article
                                                                </a>
                                                            )}
                                                            {result.threadUrl && (
                                                                <a href={result.threadUrl} target="_blank" rel="noreferrer" className="text-slate-300 underline underline-offset-2 flex items-center gap-1">
                                                                    <ExternalLink size={10} /> X Post
                                                                </a>
                                                            )}
                                                        </div>
                                                        {result.articleTitle && <div className="text-slate-300 font-medium">{result.articleTitle}</div>}
                                                        {result.articleSummary && <div className="text-slate-500 line-clamp-2">{result.articleSummary}</div>}
                                                        {result.xPostError && <div className="text-yellow-400">⚠ X post failed: {result.xPostError}</div>}
                                                    </div>
                                                ) : (
                                                    <span className="text-red-400">✗ {result.error}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Video Clips Gallery (YouTube only) */}
            {isYouTube && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-white">Video Clips Gallery</h3>
                        <Link href="/videos" className="text-[10px] text-slate-500 hover:text-white uppercase tracking-wider font-bold">View Global Library</Link>
                    </div>
                    {clips.length === 0 ? (
                        <p className="text-sm text-slate-500">No clips generated yet by this pipeline.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {clips.map(clip => (
                                <div key={clip.id} className="group relative bg-black/40 border border-white/[0.05] rounded-xl overflow-hidden hover:border-red-500/30 transition-all">
                                    <div className="p-3">
                                        <div className="text-sm text-white font-bold truncate mb-1" title={clip.videoTitle || undefined}>
                                            {clip.videoTitle || 'Pending extraction...'}
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-3">
                                            <span>{formatDistanceToNow(new Date(clip.createdAt), { addSuffix: true })}</span>
                                            {clip.status === 'done' ? (
                                                <span className="text-green-400 font-bold uppercase tracking-widest">Done</span>
                                            ) : clip.status === 'failed' ? (
                                                <span className="text-red-400 font-bold uppercase tracking-widest">Failed</span>
                                            ) : (
                                                <span className="text-blue-400 animate-pulse font-bold uppercase tracking-widest">{clip.status}...</span>
                                            )}
                                        </div>
                                        {clip.clipUrl && (
                                            <div className="flex gap-2">
                                                <a
                                                    href={clip.clipUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all border border-white/10"
                                                >
                                                    <Play size={12} className="fill-current" />
                                                    Preview
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Articles Produced */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Articles Produced by This Pipeline</h3>
                {articles.length === 0 ? (
                    <p className="text-sm text-slate-500">No articles yet — run a test above to generate the first one.</p>
                ) : (
                    <div className="space-y-2">
                        {articles.map(article => (
                            <div key={article.id} className="flex items-center justify-between gap-4 p-3 rounded-lg border border-white/[0.05] hover:border-white/10 transition-colors">
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-slate-200 font-medium truncate">{article.title}</div>
                                    <div className="text-xs text-slate-600 mt-0.5 flex items-center gap-2">
                                        <span>{format(new Date(article.createdAt), 'MMM d, yyyy h:mm a')}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${article.status === 'published' ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'}`}>
                                            {article.status}
                                        </span>
                                    </div>
                                </div>
                                <a
                                    href={`/articles/${article.slug}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 shrink-0 transition-colors"
                                >
                                    <ExternalLink size={12} /> View
                                </a>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Last Run Info */}
            <div className="text-xs text-slate-600 pb-4">
                Pipeline created {formatDistanceToNow(new Date(auto.createdAt), { addSuffix: true })} ·
                Last run: {auto.lastRunAt ? formatDistanceToNow(new Date(auto.lastRunAt), { addSuffix: true }) : 'never'} ·
                {auto.lastResult?.success && !auto.lastResult?.skipped ? ' Last run succeeded' : auto.lastResult?.error ? ` Last error: ${auto.lastResult.error}` : ''}
            </div>
        </div>
    )
}

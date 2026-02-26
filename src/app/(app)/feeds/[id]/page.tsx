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

const OUTPUT_MODES = [
    { value: 'article_and_x', label: 'Article + 𝕏 Thread', desc: 'Write full article, then post X thread with link' },
    { value: 'article_and_x_post', label: 'Article + 𝕏 Post', desc: 'Write full article, then post ONE tweet with link' },
    { value: 'article_only', label: 'Article Only', desc: 'Write and publish article, no X post' },
    { value: 'draft', label: 'Draft for Review', desc: 'Write article, save as draft — you approve before publish' },
    { value: 'x_only', label: '𝕏 Post Only', desc: 'No AI, no article — just auto-post the video link to X instantly' },
]

const MODEL_OPTIONS = [
    { provider: 'perplexity', model: 'sonar-pro', label: 'Perplexity Sonar Pro (research/news)' },
    { provider: 'openai', model: 'gpt-4o', label: 'OpenAI GPT-4o (writing)' },
    { provider: 'openai', model: 'gpt-4o-mini', label: 'OpenAI GPT-4o Mini (fast/cheap)' },
    { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', label: 'Anthropic Claude Sonnet (deep analysis)' },
]

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
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')

    // Editable fields
    const [prompt, setPrompt] = useState('')
    const [outputMode, setOutputMode] = useState('article_and_x')
    const [researchProvider, setResearchProvider] = useState('perplexity')
    const [researchModel, setResearchModel] = useState('sonar-pro')
    const [writingProvider, setWritingProvider] = useState('openai')
    const [writingModel, setWritingModel] = useState('gpt-4o')
    const [videoClippingEnabled, setVideoClippingEnabled] = useState(false)

    const fetchAuto = useCallback(async () => {
        const res = await fetch(`/api/automations/${id}`)
        if (!res.ok) { router.push('/feeds'); return }
        const data: Automation = await res.json()
        setAuto(data)
        setPrompt(data.prompt || '')
        setOutputMode(data.config.outputMode || 'article_and_x')
        setResearchProvider(data.config.researchProvider || 'perplexity')
        setResearchModel(data.config.researchModel || 'sonar-pro')
        setWritingProvider(data.config.writingProvider || 'openai')
        setWritingModel(data.config.writingModel || 'gpt-4o')
        setVideoClippingEnabled(data.config.videoClippingEnabled || false)
        setLoading(false)
    }, [id, router])

    const fetchArticles = useCallback(async () => {
        const res = await fetch(`/api/articles?automationId=${id}`)
        if (res.ok) setArticles(await res.json())
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
    useEffect(() => { if (auto) { fetchArticles(); fetchVideos() } }, [auto, fetchArticles, fetchVideos])

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
                        outputMode,
                        writingProvider,
                        writingModel,
                        videoClippingEnabled,
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

            // Fetch article preview if we got one
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
    const currentMode = OUTPUT_MODES.find(m => m.value === outputMode)
    const hasUnsavedChanges = prompt !== (auto.prompt || '') ||
        outputMode !== (config.outputMode || 'article_and_x') ||
        researchModel !== (config.researchModel || 'sonar-pro') ||
        writingModel !== (config.writingModel || 'gpt-4o') ||
        videoClippingEnabled !== (config.videoClippingEnabled || false)

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
                {/* Output Mode */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Output Mode</h3>
                    <div className="space-y-2">
                        {OUTPUT_MODES.map(mode => (
                            <label key={mode.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${outputMode === mode.value ? 'border-red-500/40 bg-red-500/10' : 'border-white/[0.06] hover:border-white/10'}`}>
                                <input
                                    type="radio"
                                    name="outputMode"
                                    value={mode.value}
                                    checked={outputMode === mode.value}
                                    onChange={() => setOutputMode(mode.value)}
                                    className="mt-0.5 accent-red-500"
                                />
                                <div>
                                    <div className={`text-sm font-medium ${outputMode === mode.value ? 'text-white' : 'text-slate-300'}`}>{mode.label}</div>
                                    <div className="text-xs text-slate-500 mt-0.5">{mode.desc}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* AI Models */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">AI Models</h3>
                    {outputMode === 'x_only' ? (
                        <div className="text-sm text-slate-500 italic p-3 bg-black/20 rounded-lg">
                            X-only mode uses no AI — posts happen instantly with no model cost.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-500 mb-1.5 block">Research Model</label>
                                <select
                                    value={`${researchProvider}/${researchModel}`}
                                    onChange={e => {
                                        const [p, m] = e.target.value.split('/')
                                        setResearchProvider(p)
                                        setResearchModel(m)
                                    }}
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-white/20"
                                >
                                    {MODEL_OPTIONS.map(o => (
                                        <option key={`${o.provider}/${o.model}`} value={`${o.provider}/${o.model}`}>{o.label}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-600 mt-1">Used for web research before writing</p>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mb-1.5 block">Writing Model</label>
                                <select
                                    value={`${writingProvider}/${writingModel}`}
                                    onChange={e => {
                                        const [p, m] = e.target.value.split('/')
                                        setWritingProvider(p)
                                        setWritingModel(m)
                                    }}
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-white/20"
                                >
                                    {MODEL_OPTIONS.map(o => (
                                        <option key={`${o.provider}/${o.model}`} value={`${o.provider}/${o.model}`}>{o.label}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-600 mt-1">Writes the final article</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Video Clips Config (YouTube only) */}
            {isYouTube && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Video Clips</h3>
                            <p className="text-[10px] text-slate-600 mt-0.5">Automated "Video-First" content generation settings.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={videoClippingEnabled}
                                onChange={e => setVideoClippingEnabled(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                            <span className="ml-3 text-sm font-medium text-slate-300">{videoClippingEnabled ? 'Enabled' : 'Disabled'}</span>
                        </label>
                    </div>
                    {videoClippingEnabled && (
                        <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                            <p className="text-xs text-red-300 leading-relaxed">
                                <strong>Active:</strong> The system will automatically use Fractal AI to identify the viral hook of any new video. This clip will be attached to Threads and single Posts.
                            </p>
                        </div>
                    )}
                </div>
            )}

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
                <p className="text-[10px] text-slate-600 mt-1.5">This prompt guides how the AI writes content for this specific pipeline. Each pipeline can have a completely different tone and focus.</p>
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
                                                                    <ExternalLink size={10} /> X Thread
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

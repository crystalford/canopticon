'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Play, Trash2, Loader2, Video, Radio, CheckCircle, AlertTriangle, ExternalLink, Send, FileText, Settings, Save, RefreshCw, ChevronDown, ChevronUp, Wifi, Clock, Download } from 'lucide-react'
import { format } from 'date-fns'
import { formatDistanceToNow } from 'date-fns'

interface VideoMonitor {
    id: string
    name: string
    enabled: boolean
    lastRunAt: string | null
    lastResult: any
    config: {
        channelId: string
        channelHandle?: string
        contentFilter?: string
        lastSubscribedAt?: string
        clipArticle?: boolean
        postX?: boolean
        postBluesky?: boolean
        postTiktok?: boolean
        postThreads?: boolean
    }
    createdAt: string
}

interface VideoClip {
    id: string
    videoTitle: string | null
    channelName: string | null
    automationId: string | null
    youtubeUrl: string
    clipUrl: string | null
    clipRationale: string | null
    keyQuote: string | null
    extendedQuote: string | null
    speakerName: string | null
    tweetDraft: string | null
    startSeconds: number | null
    endSeconds: number | null
    status: string
    errorMessage: string | null
    retryCount: number
    nextRetryAt: string | null
    xPostedAt: string | null
    blueskyPostedAt: string | null
    tiktokPostedAt: string | null
    threadsPostedAt: string | null
    articleId: string | null
    createdAt: string
}

function hopperState(clip: VideoClip): 'waiting' | 'retrying' | 'scheduled' {
    if (clip.status !== 'queued') return 'waiting'
    if (!clip.nextRetryAt) return 'waiting'
    const msUntil = new Date(clip.nextRetryAt).getTime() - Date.now()
    return msUntil <= 0 ? 'retrying' : 'scheduled'
}

function statusIcon(clip: VideoClip): React.ReactNode {
    if (clip.status === 'queued') {
        const state = hopperState(clip)
        if (state === 'scheduled') return <Clock size={14} className="text-amber-400" />
        if (state === 'retrying') return <Loader2 size={14} className="text-amber-400 animate-spin" />
        return <Loader2 size={14} className="text-slate-400 animate-spin" />
    }
    if (clip.status === 'processing') return <Loader2 size={14} className="text-blue-400 animate-spin" />
    if (clip.status === 'done') return <CheckCircle size={14} className="text-green-400" />
    return <AlertTriangle size={14} className="text-red-400" />
}

function statusLabel(clip: VideoClip): string {
    if (clip.status === 'queued') {
        const state = hopperState(clip)
        if (state === 'retrying') return `Retrying (${clip.retryCount + 1}/5)`
        if (state === 'scheduled') {
            const minLeft = Math.ceil((new Date(clip.nextRetryAt!).getTime() - Date.now()) / 60000)
            return `Retry ${clip.retryCount + 1}/5 in ${minLeft}m`
        }
        return 'Queued'
    }
    if (clip.status === 'processing') {
        if (clip.startSeconds != null) return 'Cutting clip...'
        return 'Analyzing...'
    }
    if (clip.status === 'done') return 'Ready'
    if (clip.status === 'failed') return 'Failed'
    return clip.status
}

type PostingPlatform = 'x' | 'bluesky' | 'tiktok' | 'threads'

export default function VideosPage() {
    const [monitors, setMonitors] = useState<VideoMonitor[]>([])
    const [clips, setClips] = useState<VideoClip[]>([])
    const [loading, setLoading] = useState(true)
    const [showAdd, setShowAdd] = useState(false)
    const [clipUrl, setClipUrl] = useState('')
    const [clipping, setClipping] = useState(false)
    const [form, setForm] = useState({
        name: '', channelId: '', channelHandle: '', contentFilter: '',
        clipArticle: true, postX: true, postBluesky: false, postTiktok: false, postThreads: false,
    })
    const [adding, setAdding] = useState(false)
    const [posting, setPosting] = useState<{ id: string; platform: PostingPlatform } | null>(null)
    const [postErrors, setPostErrors] = useState<Record<string, string>>({})
    const [tiktokDownloaded, setTiktokDownloaded] = useState<Record<string, boolean>>({})
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editConfig, setEditConfig] = useState<{ contentFilter: string; clipArticle: boolean; postX: boolean; postBluesky: boolean; postTiktok: boolean; postThreads: boolean } | null>(null)
    const [saving, setSaving] = useState(false)
    const [videosOpenId, setVideosOpenId] = useState<string | null>(null)
    const [monitorVideos, setMonitorVideos] = useState<Record<string, any[]>>({})
    const [monitorVideosLoading, setMonitorVideosLoading] = useState<Record<string, boolean>>({})
    const [clippingVideo, setClippingVideo] = useState<string | null>(null)
    const [runningMonitorId, setRunningMonitorId] = useState<string | null>(null)
    const [runResults, setRunResults] = useState<Record<string, string>>({})
    const [subscribingId, setSubscribingId] = useState<string | null>(null)
    const [subscribeErrors, setSubscribeErrors] = useState<Record<string, string>>({})

    const fetchAll = useCallback(async () => {
        const [mRes, cRes] = await Promise.all([
            fetch('/api/video-monitors'),
            fetch('/api/videos'),
        ])
        if (mRes.ok) setMonitors(await mRes.json())
        if (cRes.ok) setClips(await cRes.json())
        setLoading(false)
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    useEffect(() => {
        const hasActive = clips.some(c => c.status === 'queued' || c.status === 'processing')
        if (!hasActive) return
        const t = setInterval(fetchAll, 5000)
        return () => clearInterval(t)
    }, [clips, fetchAll])

    const toggleMonitor = async (monitor: VideoMonitor) => {
        await fetch(`/api/video-monitors/${monitor.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: !monitor.enabled }),
        })
        fetchAll()
    }

    const deleteMonitor = async (id: string) => {
        if (!confirm('Delete this video monitor?')) return
        await fetch(`/api/video-monitors/${id}`, { method: 'DELETE' })
        fetchAll()
    }

    const toggleVideos = async (id: string) => {
        if (videosOpenId === id) { setVideosOpenId(null); return }
        setVideosOpenId(id)
        if (monitorVideos[id]) return // already loaded
        setMonitorVideosLoading(prev => ({ ...prev, [id]: true }))
        try {
            const res = await fetch(`/api/video-monitors/${id}/videos`)
            if (res.ok) {
                const data = await res.json()
                setMonitorVideos(prev => ({ ...prev, [id]: data.videos || [] }))
            }
        } finally {
            setMonitorVideosLoading(prev => ({ ...prev, [id]: false }))
        }
    }

    const runMonitor = async (m: VideoMonitor) => {
        setRunningMonitorId(m.id)
        setRunResults(prev => ({ ...prev, [m.id]: '' }))
        try {
            const res = await fetch(`/api/video-monitors/${m.id}/run?force=true`, { method: 'POST' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed')
            const msg = data.skipped
                ? (data.reason || 'No new videos')
                : `${data.clipsQueued ?? 0} clip${data.clipsQueued === 1 ? '' : 's'} queued`
            setRunResults(prev => ({ ...prev, [m.id]: msg }))
            fetchAll()
        } catch (e: any) {
            setRunResults(prev => ({ ...prev, [m.id]: `Error: ${e.message}` }))
        } finally {
            setRunningMonitorId(null)
        }
    }

    const subscribeMonitor = async (m: VideoMonitor) => {
        setSubscribingId(m.id)
        setSubscribeErrors(prev => ({ ...prev, [m.id]: '' }))
        try {
            const res = await fetch(`/api/webhooks/youtube/subscribe?channelId=${m.config.channelId}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || data.details || 'Subscribe failed')
            // Store timestamp in config so it persists
            await fetch(`/api/video-monitors/${m.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: { ...m.config, lastSubscribedAt: new Date().toISOString() } }),
            })
            fetchAll()
        } catch (e: any) {
            setSubscribeErrors(prev => ({ ...prev, [m.id]: e.message }))
        } finally {
            setSubscribingId(null)
        }
    }

    const clipSingleVideo = async (monitorId: string, video: { link: string; title: string }) => {
        setClippingVideo(video.link)
        try {
            await fetch(`/api/video-monitors/${monitorId}/clip-video`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ youtubeUrl: video.link, title: video.title }),
            })
            fetchAll()
        } finally {
            setClippingVideo(null)
        }
    }

    const startEdit = (m: VideoMonitor) => {
        setEditingId(m.id)
        setEditConfig({
            contentFilter: m.config.contentFilter ?? '',
            clipArticle: m.config.clipArticle ?? true,
            postX: m.config.postX ?? true,
            postBluesky: m.config.postBluesky ?? false,
            postTiktok: m.config.postTiktok ?? false,
            postThreads: m.config.postThreads ?? false,
        })
    }

    const saveMonitorConfig = async (m: VideoMonitor) => {
        if (!editConfig) return
        setSaving(true)
        try {
            await fetch(`/api/video-monitors/${m.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: { ...m.config, ...editConfig } }),
            })
            setEditingId(null)
            setEditConfig(null)
            fetchAll()
        } finally {
            setSaving(false)
        }
    }



    const addMonitor = async () => {
        if (!form.name || !form.channelId) return
        setAdding(true)
        try {
            await fetch('/api/video-monitors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form }),
            })
            setForm({ name: '', channelId: '', channelHandle: '', contentFilter: '', clipArticle: true, postX: true, postBluesky: false, postTiktok: false, postThreads: false })
            setShowAdd(false)
            fetchAll()
        } finally {
            setAdding(false)
        }
    }

    const deleteClip = async (id: string) => {
        await fetch(`/api/videos/${id}`, { method: 'DELETE' })
        fetchAll()
    }

    const postClip = async (id: string, platform: PostingPlatform) => {
        setPosting({ id, platform })
        setPostErrors(prev => ({ ...prev, [`${id}-${platform}`]: '' }))
        try {
            const endpoint = platform === 'x' ? 'post-x'
                : platform === 'bluesky' ? 'post-bluesky'
                : platform === 'tiktok' ? 'post-tiktok'
                : 'post-threads'
            const res = await fetch(`/api/videos/${id}/${endpoint}`, { method: 'POST' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to post')
            fetchAll()
        } catch (e: any) {
            setPostErrors(prev => ({ ...prev, [`${id}-${platform}`]: e.message }))
        } finally {
            setPosting(null)
        }
    }

    const clipVideo = async () => {
        if (!clipUrl.trim()) return
        setClipping(true)
        try {
            const res = await fetch('/api/videos/clip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ youtubeUrl: clipUrl }),
            })
            if (res.ok) { setClipUrl(''); fetchAll() }
        } finally {
            setClipping(false)
        }
    }

    const Toggle = ({ value, onChange, label }: { value: boolean; onChange: () => void; label: string }) => (
        <label className="flex items-center gap-2 cursor-pointer" onClick={onChange}>
            <div className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${value ? 'bg-red-500' : 'bg-white/10'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-xs text-slate-400">{label}</span>
        </label>
    )

    if (loading) return (
        <div className="max-w-4xl mx-auto py-12 px-6 animate-pulse space-y-4">
            <div className="h-8 bg-white/5 rounded w-48" />
            <div className="h-40 bg-white/5 rounded" />
        </div>
    )

    return (
        <div className="max-w-4xl mx-auto py-10 px-6 space-y-8">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Videos</h1>
                    <p className="text-sm text-slate-500 mt-1">Monitor channels · AI clips the hook · Posts to all platforms.</p>
                </div>
                <button
                    onClick={() => setShowAdd(!showAdd)}
                    className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm transition-colors"
                >
                    <Plus size={15} />
                    Add Monitor
                </button>
            </div>

            {/* Add Monitor */}
            {showAdd && (
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-white">New Video Monitor</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">Name</label>
                            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. CPAC" className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-white/20" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">YouTube Channel ID</label>
                            <input value={form.channelId} onChange={e => setForm(f => ({ ...f, channelId: e.target.value }))}
                                placeholder="UCxxxxxxxxxxxxxxxx" className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-white/20" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">Handle (optional)</label>
                            <input value={form.channelHandle} onChange={e => setForm(f => ({ ...f, channelHandle: e.target.value }))}
                                placeholder="@cpac" className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-white/20" />
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs text-slate-500 mb-1 block">Content filter (optional)</label>
                            <input value={form.contentFilter} onChange={e => setForm(f => ({ ...f, contentFilter: e.target.value }))}
                                placeholder="e.g. Canadian politics only, Mark Carney only, federal budget" className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-white/20" />
                            <p className="text-[10px] text-slate-600 mt-1">Only clip videos whose title matches this topic. Leave blank to clip everything.</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <p className="text-xs text-slate-500 mb-2">Generate for each clip:</p>
                            <div className="flex flex-wrap gap-4">
                                <Toggle value={form.clipArticle} onChange={() => setForm(f => ({ ...f, clipArticle: !f.clipArticle }))} label="Article" />
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 mb-2">Auto-post clips to:</p>
                            <div className="flex flex-wrap gap-4">
                                <Toggle value={form.postX} onChange={() => setForm(f => ({ ...f, postX: !f.postX }))} label="𝕏 (Twitter)" />
                                <Toggle value={form.postBluesky} onChange={() => setForm(f => ({ ...f, postBluesky: !f.postBluesky }))} label="Bluesky" />
                                <Toggle value={form.postTiktok} onChange={() => setForm(f => ({ ...f, postTiktok: !f.postTiktok }))} label="TikTok" />
                                <Toggle value={form.postThreads} onChange={() => setForm(f => ({ ...f, postThreads: !f.postThreads }))} label="Threads" />
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={addMonitor} disabled={adding || !form.name || !form.channelId}
                            className="bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                            {adding ? 'Adding...' : 'Add Monitor'}
                        </button>
                        <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Monitors */}
            <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Monitors ({monitors.length})</h2>
                {monitors.length === 0 ? (
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-8 text-center">
                        <Radio size={24} className="text-slate-600 mx-auto mb-2" />
                        <p className="text-slate-500 text-sm">No monitors yet. Add a YouTube channel above.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {monitors.map(m => {
                            const isEditing = editingId === m.id
                            return (
                                <div key={m.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
                                    {/* Header row */}
                                    <div className="px-4 py-3 flex items-center gap-3">
                                        <div onClick={() => toggleMonitor(m)}
                                            className={`w-9 h-5 rounded-full relative cursor-pointer flex-shrink-0 transition-colors ${m.enabled ? 'bg-red-500' : 'bg-white/10'}`}>
                                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${m.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-medium text-white">{m.name}</span>
                                                {m.config.channelHandle && <span className="text-xs text-slate-500">{m.config.channelHandle}</span>}
                                                {(m.config.clipArticle ?? true) && <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">Article</span>}
                                                {m.config.postX && <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">𝕏</span>}
                                                {m.config.postBluesky && <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">Bluesky</span>}
                                                {m.config.postTiktok && <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">TikTok</span>}
                                                {m.config.postThreads && <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">Threads</span>}
                                                {m.config.contentFilter && <span className="text-[10px] bg-amber-900/40 text-amber-400/80 border border-amber-500/20 px-1.5 py-0.5 rounded" title={m.config.contentFilter}>Filter: {m.config.contentFilter.length > 24 ? m.config.contentFilter.slice(0, 24) + '…' : m.config.contentFilter}</span>}
                                            </div>
                                            <p className="text-xs text-slate-600 mt-0.5">
                                                {m.lastRunAt ? `Last run ${formatDistanceToNow(new Date(m.lastRunAt), { addSuffix: true })}` : 'Never run'}
                                                {m.lastResult?.clipsQueued != null && ` · ${m.lastResult.clipsQueued} clips queued`}
                                                {m.lastResult?.error && ` · ${m.lastResult.error}`}
                                                {runResults[m.id] && <span className="text-green-400/70 ml-1">→ {runResults[m.id]}</span>}
                                                {(() => {
                                                    const sub = m.config.lastSubscribedAt
                                                    if (!sub) return <span className="text-amber-500/70 ml-1">· Push not subscribed</span>
                                                    const daysAgo = (Date.now() - new Date(sub).getTime()) / 86400000
                                                    const daysLeft = Math.max(0, 10 - daysAgo)
                                                    const color = daysLeft < 2 ? 'text-red-400/70' : 'text-green-400/50'
                                                    return <span className={`${color} ml-1`}>· Push active · expires in {daysLeft < 1 ? '<1' : Math.floor(daysLeft)}d</span>
                                                })()}
                                                {subscribeErrors[m.id] && <span className="text-red-400/70 ml-1">· Subscribe failed: {subscribeErrors[m.id]}</span>}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <button onClick={() => subscribeMonitor(m)} disabled={subscribingId === m.id}
                                                className="p-1.5 text-slate-500 hover:text-green-400 disabled:opacity-40 rounded-lg hover:bg-white/5 transition-colors"
                                                title={m.config.lastSubscribedAt ? `Push subscribed · auto-renews daily. Click to renew now.` : 'Subscribe to push notifications (new video → instant clip)'}>
                                                {subscribingId === m.id ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
                                            </button>
                                            <button onClick={() => runMonitor(m)} disabled={runningMonitorId === m.id}
                                                className="p-1.5 text-slate-500 hover:text-green-400 disabled:opacity-40 rounded-lg hover:bg-white/5 transition-colors" title="Run now (latest video)">
                                                {runningMonitorId === m.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                                            </button>
                                            <button onClick={() => toggleVideos(m.id)}
                                                className={`p-1.5 rounded-lg hover:bg-white/5 transition-colors ${videosOpenId === m.id ? 'text-white' : 'text-slate-400 hover:text-white'}`} title="Browse videos">
                                                {videosOpenId === m.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>
                                            <button onClick={() => isEditing ? (setEditingId(null), setEditConfig(null)) : startEdit(m)}
                                                className={`p-1.5 rounded-lg hover:bg-white/5 transition-colors ${isEditing ? 'text-white' : 'text-slate-500 hover:text-white'}`} title="Settings">
                                                <Settings size={14} />
                                            </button>
                                            <button onClick={() => deleteMonitor(m.id)}
                                                className="p-1.5 text-slate-600 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors" title="Delete">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    {/* Video list panel */}
                                    {videosOpenId === m.id && (
                                        <div className="border-t border-white/[0.06]">
                                            <div className="flex items-center justify-between px-4 py-2">
                                                <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Recent Videos</span>
                                                <button onClick={() => {
                                                    setMonitorVideos(prev => { const n = { ...prev }; delete n[m.id]; return n })
                                                    setMonitorVideosLoading(prev => ({ ...prev, [m.id]: true }))
                                                    fetch(`/api/video-monitors/${m.id}/videos`).then(r => r.ok ? r.json() : null).then(d => {
                                                        if (d) setMonitorVideos(prev => ({ ...prev, [m.id]: d.videos || [] }))
                                                        setMonitorVideosLoading(prev => ({ ...prev, [m.id]: false }))
                                                    })
                                                }} className="p-1 text-slate-600 hover:text-white transition-colors" title="Refresh">
                                                    <RefreshCw size={12} />
                                                </button>
                                            </div>
                                            {clippingVideo && (
                                                <p className="text-xs text-blue-400/80 px-4 pb-2">
                                                    Fetching transcript + analyzing with AI — this takes ~30s...
                                                </p>
                                            )}
                                            {monitorVideosLoading[m.id] ? (
                                                <div className="space-y-2 px-4 pb-4">
                                                    {[1, 2, 3].map(i => <div key={i} className="h-14 bg-white/5 rounded-lg animate-pulse" />)}
                                                </div>
                                            ) : (monitorVideos[m.id] || []).length === 0 ? (
                                                <p className="text-sm text-slate-500 px-4 pb-4">No videos found.</p>
                                            ) : (
                                                <div className="space-y-1 px-4 pb-4">
                                                    {(monitorVideos[m.id] || []).map((video: any) => (
                                                        <div key={video.videoId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                                                            {video.thumbnail && (
                                                                <img src={video.thumbnail} alt="" className="w-20 h-12 object-cover rounded shrink-0 bg-black/20" />
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs text-slate-200 font-medium line-clamp-2 leading-snug">{video.title}</p>
                                                                <p className="text-[10px] text-slate-600 mt-0.5">
                                                                    {video.pubDate ? format(new Date(video.pubDate), 'MMM d, yyyy') : ''}
                                                                </p>
                                                            </div>
                                                            <button
                                                                onClick={() => clipSingleVideo(m.id, video)}
                                                                disabled={clippingVideo === video.link}
                                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium shrink-0 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 disabled:opacity-50 transition-colors"
                                                            >
                                                                {clippingVideo === video.link ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} className="fill-current" />}
                                                                Clip
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {/* Edit panel */}
                                    {isEditing && editConfig && (
                                        <div className="px-4 pb-4 pt-1 border-t border-white/[0.06] space-y-3">
                                            <div>
                                                <label className="text-xs text-slate-500 mb-1 block">Content filter (optional)</label>
                                                <input value={editConfig.contentFilter} onChange={e => setEditConfig(c => c && ({ ...c, contentFilter: e.target.value }))}
                                                    placeholder="e.g. Canadian politics only, Mark Carney only"
                                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-white/20" />
                                                <p className="text-[10px] text-slate-600 mt-1">Only clip videos whose title matches this topic. Leave blank to clip everything.</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 mb-2">Generate for each clip:</p>
                                                <Toggle value={editConfig.clipArticle} onChange={() => setEditConfig(c => c && ({ ...c, clipArticle: !c.clipArticle }))} label="Article" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 mb-2">Auto-post clips to:</p>
                                                <div className="flex flex-wrap gap-4">
                                                    <Toggle value={editConfig.postX} onChange={() => setEditConfig(c => c && ({ ...c, postX: !c.postX }))} label="𝕏 (Twitter)" />
                                                    <Toggle value={editConfig.postBluesky} onChange={() => setEditConfig(c => c && ({ ...c, postBluesky: !c.postBluesky }))} label="Bluesky" />
                                                    <Toggle value={editConfig.postTiktok} onChange={() => setEditConfig(c => c && ({ ...c, postTiktok: !c.postTiktok }))} label="TikTok" />
                                                    <Toggle value={editConfig.postThreads} onChange={() => setEditConfig(c => c && ({ ...c, postThreads: !c.postThreads }))} label="Threads" />
                                                </div>
                                            </div>
                                            <button onClick={() => saveMonitorConfig(m)} disabled={saving}
                                                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                                Save
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Manual Clip */}
            <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Clip a Video</h2>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex gap-3">
                    <input value={clipUrl} onChange={e => setClipUrl(e.target.value)}
                        placeholder="https://youtube.com/watch?v=..."
                        onKeyDown={e => e.key === 'Enter' && clipVideo()}
                        className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-white/20" />
                    <button onClick={clipVideo} disabled={clipping || !clipUrl.trim()}
                        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 text-slate-200 px-4 py-2 rounded-lg text-sm transition-colors">
                        {clipping ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
                        {clipping ? 'Queuing...' : 'Clip It'}
                    </button>
                </div>
            </div>

            {/* Clips Library */}
            <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Clips Library ({clips.length})</h2>
                {clips.length === 0 ? (
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-8 text-center">
                        <Video size={24} className="text-slate-600 mx-auto mb-2" />
                        <p className="text-slate-500 text-sm">No clips yet.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {clips.map(clip => (
                            <div key={clip.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 space-y-2">
                                {/* Top row: status + title + actions */}
                                <div className="flex items-start gap-3">
                                    <div className="flex items-center gap-1.5 flex-shrink-0 w-28 pt-0.5">
                                        {statusIcon(clip)}
                                        <span className={`text-xs ${
                                            clip.status === 'queued' && hopperState(clip) !== 'waiting' ? 'text-amber-400' :
                                            clip.status === 'failed' ? 'text-red-400' :
                                            clip.status === 'done' ? 'text-green-400' :
                                            'text-slate-500'
                                        }`}>{statusLabel(clip)}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-white truncate">
                                            {clip.videoTitle && clip.videoTitle !== 'Loading...' ? clip.videoTitle : clip.youtubeUrl}
                                        </p>
                                        {(clip.channelName || clip.automationId) && (
                                            <p className="text-xs text-slate-500 truncate">
                                                {clip.channelName || monitors.find(m => m.id === clip.automationId)?.name || ''}
                                            </p>
                                        )}
                                        {clip.startSeconds != null && clip.endSeconds != null && (
                                            <p className="text-xs text-slate-600">{clip.startSeconds}s → {clip.endSeconds}s · {clip.endSeconds - clip.startSeconds}s</p>
                                        )}
                                        {/* Retry progress bar */}
                                        {clip.status === 'queued' && clip.retryCount > 0 && (
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="flex gap-0.5">
                                                    {[0,1,2,3,4].map(i => (
                                                        <div key={i} className={`w-3 h-1.5 rounded-sm ${i < clip.retryCount ? 'bg-amber-500/60' : 'bg-white/10'}`} />
                                                    ))}
                                                </div>
                                                <span className="text-[10px] text-slate-600">{clip.retryCount} of 5 attempts used</span>
                                            </div>
                                        )}
                                        {clip.errorMessage && (
                                            <p className={`text-xs mt-1 break-words ${clip.status === 'queued' ? 'text-amber-400/60' : 'text-red-400/80'}`}>{clip.errorMessage}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {clip.clipUrl && (
                                            <a href={clip.clipUrl} target="_blank" rel="noopener noreferrer"
                                                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors" title="View clip">
                                                <ExternalLink size={13} />
                                            </a>
                                        )}
                                        <button onClick={() => deleteClip(clip.id)}
                                            className="p-1.5 text-slate-600 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors" title="Delete">
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>

                                {/* Rationale — always shown when available */}
                                {clip.clipRationale && (
                                    <p className="text-xs text-slate-400 pl-24 leading-relaxed">{clip.clipRationale}</p>
                                )}

                                {/* Key quote — shown for any status */}
                                {clip.keyQuote && (
                                    <p className="text-xs text-amber-300/80 italic pl-24 leading-relaxed">
                                        &ldquo;{clip.keyQuote}&rdquo;
                                        {clip.speakerName && <span className="not-italic text-slate-500"> — {clip.speakerName}</span>}
                                    </p>
                                )}

                                {/* Tweet draft preview for in-progress clips */}
                                {clip.tweetDraft && clip.status !== 'done' && (
                                    <p className="text-[11px] text-slate-600 pl-24 leading-relaxed">
                                        Draft: {clip.tweetDraft}
                                    </p>
                                )}

                                {/* Platform buttons + badges */}
                                {clip.status === 'done' && (
                                    <div className="pl-24 flex flex-wrap items-center gap-1.5">
                                        {/* Article link */}
                                        {clip.articleId && (
                                            <a href={`/content`}
                                                className="flex items-center gap-1 px-2 py-1 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-xs">
                                                <FileText size={10} />
                                                Article
                                            </a>
                                        )}

                                        {/* X */}
                                        {!clip.xPostedAt ? (
                                            <button onClick={() => postClip(clip.id, 'x')}
                                                disabled={posting?.id === clip.id && posting.platform === 'x'}
                                                className="flex items-center gap-1 px-2 py-1 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 rounded-lg text-xs transition-colors disabled:opacity-50"
                                                title={postErrors[`${clip.id}-x`] || 'Post to X'}>
                                                {posting?.id === clip.id && posting.platform === 'x' ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                                                𝕏
                                            </button>
                                        ) : (
                                            <span className="text-[10px] bg-sky-500/10 border border-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded">𝕏 ✓</span>
                                        )}

                                        {/* Bluesky */}
                                        {!clip.blueskyPostedAt ? (
                                            <button onClick={() => postClip(clip.id, 'bluesky')}
                                                disabled={posting?.id === clip.id && posting.platform === 'bluesky'}
                                                className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-lg text-xs transition-colors disabled:opacity-50"
                                                title={postErrors[`${clip.id}-bluesky`] || 'Post to Bluesky'}>
                                                {posting?.id === clip.id && posting.platform === 'bluesky' ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                                                Bluesky
                                            </button>
                                        ) : (
                                            <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">Bluesky ✓</span>
                                        )}

                                        {/* TikTok — download MP4 for manual upload */}
                                        {!clip.tiktokPostedAt ? (
                                            <div className="flex flex-col gap-0.5">
                                                <a
                                                    href={clip.clipUrl!}
                                                    download={`${clip.videoTitle || 'clip'}.mp4`}
                                                    onClick={() => setTiktokDownloaded(prev => ({ ...prev, [clip.id]: true }))}
                                                    className="flex items-center gap-1 px-2 py-1 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 text-pink-400 rounded-lg text-xs transition-colors"
                                                >
                                                    <Download size={10} />
                                                    {tiktokDownloaded[clip.id] ? 'Downloaded ✓' : 'TikTok'}
                                                </a>
                                                {tiktokDownloaded[clip.id] && (
                                                    <span className="text-[9px] text-slate-500 leading-tight pl-0.5">Open TikTok to upload</span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-[10px] bg-pink-500/10 border border-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded">TikTok ✓</span>
                                        )}

                                        {/* Threads */}
                                        {!clip.threadsPostedAt ? (
                                            <button onClick={() => postClip(clip.id, 'threads')}
                                                disabled={posting?.id === clip.id && posting.platform === 'threads'}
                                                className="flex items-center gap-1 px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 rounded-lg text-xs transition-colors disabled:opacity-50"
                                                title={postErrors[`${clip.id}-threads`] || 'Post to Threads'}>
                                                {posting?.id === clip.id && posting.platform === 'threads' ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                                                Threads
                                            </button>
                                        ) : (
                                            <span className="text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">Threads ✓</span>
                                        )}

                                        <span className="text-xs text-slate-600 ml-auto">
                                            {formatDistanceToNow(new Date(clip.createdAt), { addSuffix: true })}
                                        </span>
                                    </div>
                                )}

                                {/* Post errors — shown prominently below the buttons */}
                                {(['x', 'bluesky', 'tiktok', 'threads'] as PostingPlatform[]).map(p =>
                                    postErrors[`${clip.id}-${p}`] ? (
                                        <div key={p} className="pl-24 flex items-start gap-1.5">
                                            <AlertTriangle size={11} className="text-red-400 mt-0.5 flex-shrink-0" />
                                            <p className="text-[11px] text-red-400 break-words leading-snug">
                                                {p.toUpperCase()} post failed: {postErrors[`${clip.id}-${p}`]}
                                            </p>
                                        </div>
                                    ) : null
                                )}

                                {/* Timestamp for non-done clips */}
                                {clip.status !== 'done' && (
                                    <div className="pl-24">
                                        <span className="text-xs text-slate-600">
                                            {formatDistanceToNow(new Date(clip.createdAt), { addSuffix: true })}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

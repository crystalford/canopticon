'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Play, Trash2, Loader2, Video, Radio, CheckCircle, AlertTriangle, Clock, ExternalLink } from 'lucide-react'
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
        postX?: boolean
    }
    createdAt: string
}

interface VideoClip {
    id: string
    videoTitle: string | null
    youtubeUrl: string
    clipUrl: string | null
    clipRationale: string | null
    startSeconds: number | null
    endSeconds: number | null
    status: string
    errorMessage: string | null
    xPostedAt: string | null
    createdAt: string
}

const STATUS_ICON: Record<string, React.ReactNode> = {
    queued: <Clock size={14} className="text-slate-400" />,
    processing: <Loader2 size={14} className="text-blue-400 animate-spin" />,
    done: <CheckCircle size={14} className="text-green-400" />,
    failed: <AlertTriangle size={14} className="text-red-400" />,
}

const STATUS_LABEL: Record<string, string> = {
    queued: 'Queued',
    processing: 'Processing',
    done: 'Ready',
    failed: 'Failed',
}

export default function VideosPage() {
    const [monitors, setMonitors] = useState<VideoMonitor[]>([])
    const [clips, setClips] = useState<VideoClip[]>([])
    const [loading, setLoading] = useState(true)
    const [showAdd, setShowAdd] = useState(false)
    const [clipUrl, setClipUrl] = useState('')
    const [clipping, setClipping] = useState(false)
    const [running, setRunning] = useState<string | null>(null)
    const [form, setForm] = useState({ name: '', channelId: '', channelHandle: '', postX: true })
    const [adding, setAdding] = useState(false)

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

    // Poll while clips are in-flight
    useEffect(() => {
        const hasActive = clips.some(c => c.status === 'queued' || c.status === 'processing')
        if (!hasActive) return
        const t = setInterval(fetchAll, 8000)
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

    const runMonitor = async (id: string) => {
        setRunning(id)
        try {
            await fetch(`/api/video-monitors/${id}/run`, { method: 'POST' })
            fetchAll()
        } finally {
            setRunning(null)
        }
    }

    const addMonitor = async () => {
        if (!form.name || !form.channelId) return
        setAdding(true)
        try {
            await fetch('/api/video-monitors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            setForm({ name: '', channelId: '', channelHandle: '', postX: true })
            setShowAdd(false)
            fetchAll()
        } finally {
            setAdding(false)
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
                    <p className="text-sm text-slate-500 mt-1">Monitor channels · AI clips the hook · Posts to X natively.</p>
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
                        <div className="flex items-end pb-2">
                            <label className="flex items-center gap-2 cursor-pointer" onClick={() => setForm(f => ({ ...f, postX: !f.postX }))}>
                                <div className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${form.postX ? 'bg-red-500' : 'bg-white/10'}`}>
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${form.postX ? 'translate-x-5' : 'translate-x-1'}`} />
                                </div>
                                <span className="text-sm text-slate-300">Auto-post to X</span>
                            </label>
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
                        {monitors.map(m => (
                            <div key={m.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 flex items-center gap-3">
                                <div onClick={() => toggleMonitor(m)}
                                    className={`w-9 h-5 rounded-full relative cursor-pointer flex-shrink-0 transition-colors ${m.enabled ? 'bg-red-500' : 'bg-white/10'}`}>
                                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${m.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-white">{m.name}</span>
                                        {m.config.channelHandle && <span className="text-xs text-slate-500">{m.config.channelHandle}</span>}
                                        {m.config.postX && <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">Posts to X</span>}
                                    </div>
                                    <p className="text-xs text-slate-600 mt-0.5">
                                        {m.lastRunAt ? `Last run ${formatDistanceToNow(new Date(m.lastRunAt), { addSuffix: true })}` : 'Never run'}
                                        {m.lastResult?.clipsQueued != null && ` · ${m.lastResult.clipsQueued} clips queued`}
                                        {m.lastResult?.error && ` · ${m.lastResult.error}`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button onClick={() => runMonitor(m.id)} disabled={running === m.id}
                                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors" title="Run now">
                                        {running === m.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                                    </button>
                                    <button onClick={() => deleteMonitor(m.id)}
                                        className="p-1.5 text-slate-600 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors" title="Delete">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
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
                    <div className="space-y-2">
                        {clips.map(clip => (
                            <div key={clip.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 flex items-center gap-3">
                                <div className="flex items-center gap-1.5 flex-shrink-0 w-24">
                                    {STATUS_ICON[clip.status] ?? STATUS_ICON.queued}
                                    <span className="text-xs text-slate-500">{STATUS_LABEL[clip.status] ?? clip.status}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white truncate">{clip.videoTitle || clip.youtubeUrl}</p>
                                    {clip.clipRationale && <p className="text-xs text-slate-500 mt-0.5 truncate">{clip.clipRationale}</p>}
                                    {clip.startSeconds != null && clip.endSeconds != null && (
                                        <p className="text-xs text-slate-600">{clip.startSeconds}s → {clip.endSeconds}s · {clip.endSeconds - clip.startSeconds}s</p>
                                    )}
                                    {clip.errorMessage && <p className="text-xs text-red-400 mt-0.5 truncate">{clip.errorMessage}</p>}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {clip.xPostedAt && <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">𝕏 Posted</span>}
                                    {clip.clipUrl && (
                                        <a href={clip.clipUrl} target="_blank" rel="noopener noreferrer"
                                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors" title="View clip">
                                            <ExternalLink size={13} />
                                        </a>
                                    )}
                                    <span className="text-xs text-slate-600 w-20 text-right">
                                        {formatDistanceToNow(new Date(clip.createdAt), { addSuffix: true })}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

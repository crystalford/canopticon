'use client'

import { useState, useEffect } from 'react'
import { Plus, Video, Play, CheckCircle2, XCircle, Clock, Trash2, ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { VideoClip } from '@/db/schema'

export default function VideosPage() {
    const [clips, setClips] = useState<VideoClip[]>([])
    const [loading, setLoading] = useState(true)
    const [newUrl, setNewUrl] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        fetchClips()
        const interval = setInterval(fetchClips, 5000)
        return () => clearInterval(interval)
    }, [])

    const fetchClips = async () => {
        try {
            const res = await fetch('/api/videos')
            const data = await res.json()
            if (Array.isArray(data)) setClips(data)
            setLoading(false)
        } catch (e) {
            console.error(e)
            setLoading(false)
        }
    }

    const handleAddUrl = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newUrl) return

        setIsSubmitting(true)
        try {
            const res = await fetch('/api/videos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ youtubeUrl: newUrl }),
            })
            if (res.ok) {
                setNewUrl('')
                fetchClips()
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleProcess = async (id: string) => {
        // Optimistic UI update
        setClips(prev => prev.map(c => c.id === id ? { ...c, status: 'processing', errorMessage: null } : c))

        try {
            const res = await fetch(`/api/videos/${id}/process`, { method: 'POST' })
            const data = await res.json()
            if (!res.ok) {
                // Revert optimistic update with error
                setClips(prev => prev.map(c => c.id === id ? { ...c, status: 'failed', errorMessage: data.error } : c))
                return
            }
            // Success update
            if (data.success && data.clip) {
                setClips(prev => prev.map(c => c.id === id ? data.clip : c))
            }
        } catch (e: any) {
            setClips(prev => prev.map(c => c.id === id ? { ...c, status: 'failed', errorMessage: e.message } : c))
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this clip job?')) return
        setClips(prev => prev.filter(c => c.id !== id))
        await fetch(`/api/videos/${id}`, { method: 'DELETE' })
    }

    return (
        <div className="max-w-5xl mx-auto py-12 px-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <Video className="w-8 h-8 text-red-500" />
                        Video Clips
                    </h1>
                    <p className="text-slate-400">Extract high-impact clips from YouTube using AI.</p>
                </div>
            </div>

            {/* Input Form */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6 mb-8">
                <form onSubmit={handleAddUrl} className="flex gap-4">
                    <input
                        type="url"
                        placeholder="Paste YouTube URL here (e.g., https://youtube.com/watch?v=...)"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        required
                        className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500/50"
                    />
                    <button
                        type="submit"
                        disabled={isSubmitting || !newUrl}
                        className="bg-red-500 hover:bg-red-600 text-white font-medium px-6 py-3 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                        <Plus className="w-5 h-5" />
                        Add Video
                    </button>
                </form>
            </div>

            {/* Clips List */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-white/[0.05] text-slate-400 uppercase text-xs font-medium">
                        <tr>
                            <th className="px-6 py-4">Source Video</th>
                            <th className="px-6 py-4">AI Selection</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                        {loading && clips.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                    Loading clips...
                                </td>
                            </tr>
                        ) : clips.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                    No clips created yet. Paste a YouTube URL above to start.
                                </td>
                            </tr>
                        ) : (
                            clips.map(clip => (
                                <tr key={clip.id} className="hover:bg-white/[0.02] transition-colors">
                                    {/* Video Source Column */}
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-white mb-1">
                                            {clip.videoTitle || 'Pending title...'}
                                        </div>
                                        <a
                                            href={clip.youtubeUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            {clip.youtubeUrl}
                                        </a>
                                        <div className="text-[10px] text-slate-500 mt-2">
                                            Added {formatDistanceToNow(new Date(clip.createdAt), { addSuffix: true })}
                                        </div>
                                    </td>

                                    {/* AI Selection Column */}
                                    <td className="px-6 py-4 max-w-xs">
                                        {clip.startSeconds != null && clip.endSeconds != null ? (
                                            <div>
                                                <div className="text-xs font-mono text-slate-300 bg-black/30 inline-block px-2 py-1 rounded mb-2">
                                                    {clip.startSeconds}s → {clip.endSeconds}s
                                                </div>
                                                {clip.clipRationale && (
                                                    <div className="text-xs text-slate-400 italic line-clamp-3">
                                                        "{clip.clipRationale}"
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-500 italic">Waiting for AI selection...</div>
                                        )}
                                    </td>

                                    {/* Status Column */}
                                    <td className="px-6 py-4">
                                        {clip.status === 'queued' && (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                                <Clock className="w-3.5 h-3.5" /> Queued
                                            </span>
                                        )}
                                        {clip.status === 'processing' && (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
                                                <Video className="w-3.5 h-3.5 animate-spin" /> Extracting & Clipping...
                                            </span>
                                        )}
                                        {clip.status === 'done' && (
                                            <div className="flex flex-col gap-2">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 w-max">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Done
                                                </span>
                                                {clip.clipUrl && (
                                                    <a
                                                        href={clip.clipUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-xs text-red-500 hover:text-red-400 font-medium flex items-center gap-1"
                                                    >
                                                        <Play className="w-3 h-3" /> View MP4
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                        {clip.status === 'failed' && (
                                            <div className="flex flex-col gap-1 max-w-[200px]">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 w-max">
                                                    <XCircle className="w-3.5 h-3.5" /> Failed
                                                </span>
                                                {clip.errorMessage && (
                                                    <span className="text-[10px] text-red-400/70 whitespace-normal">
                                                        {clip.errorMessage}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </td>

                                    {/* Actions Column */}
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {(clip.status === 'queued' || clip.status === 'failed') && (
                                                <button
                                                    onClick={() => handleProcess(clip.id)}
                                                    className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded transition-colors"
                                                    title={clip.status === 'failed' ? "Retry" : "Process now"}
                                                >
                                                    <Play className="w-4 h-4 fill-current" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(clip.id)}
                                                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

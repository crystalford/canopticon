'use client'

import { useState, useEffect } from 'react'
import {
    Video, Play, CheckCircle2, XCircle, Clock, Trash2,
    ExternalLink, Download, Search, Filter, Loader2, Plus, Zap
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { VideoClip } from '@/db/schema'

export default function VideosPage() {
    const [clips, setClips] = useState<VideoClip[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [newUrl, setNewUrl] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showAddForm, setShowAddForm] = useState(false)

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
                setShowAddForm(false)
                fetchClips()
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleProcess = async (id: string) => {
        setClips(prev => prev.map(c => c.id === id ? { ...c, status: 'processing', errorMessage: null } : c))
        try {
            const res = await fetch(`/api/videos/${id}/process`, { method: 'POST' })
            const data = await res.json()
            if (!res.ok) {
                setClips(prev => prev.map(c => c.id === id ? { ...c, status: 'failed', errorMessage: data.error } : c))
                return
            }
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

    const filteredClips = clips.filter(c =>
        (c.videoTitle || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.youtubeUrl || '').toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="max-w-6xl mx-auto py-12 px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-4xl font-black text-white mb-2 tracking-tight flex items-center gap-4">
                        <div className="p-2.5 rounded-2xl bg-red-600 shadow-lg shadow-red-600/20">
                            <Video className="w-8 h-8 text-white" />
                        </div>
                        CLIP LIBRARY
                    </h1>
                    <p className="text-slate-400 font-medium">Your database of high-impact video highlights and viral hooks.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-red-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search clips..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-red-500/50 w-64 transition-all"
                        />
                    </div>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-all shadow-lg shadow-red-600/20"
                    >
                        {showAddForm ? 'Cancel' : (
                            <>
                                <Plus size={18} />
                                New Clip
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Inline Add Form */}
            {showAddForm && (
                <div className="bg-white/[0.03] border border-red-500/20 rounded-2xl p-6 mb-10 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
                    <form onSubmit={handleAddUrl} className="flex gap-3">
                        <div className="flex-1 relative">
                            <Video className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <input
                                type="url"
                                placeholder="Paste YouTube URL to extract a clip..."
                                value={newUrl}
                                onChange={(e) => setNewUrl(e.target.value)}
                                required
                                className="w-full bg-black/50 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-red-500/50 transition-all font-mono text-sm"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSubmitting || !newUrl}
                            className="bg-white text-black hover:bg-slate-200 font-bold px-8 py-3.5 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                            Extract
                        </button>
                    </form>
                </div>
            )}

            {/* Clips List */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden backdrop-blur-sm">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-white/[0.04] text-slate-500 uppercase text-[11px] font-bold tracking-widest border-b border-white/[0.06]">
                        <tr>
                            <th className="px-8 py-5">Clip Details</th>
                            <th className="px-8 py-5">Selection & Context</th>
                            <th className="px-8 py-5">Status</th>
                            <th className="px-8 py-5 text-right">Library Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                        {loading && filteredClips.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-8 py-24 text-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
                                        <p className="text-slate-500 font-medium">Scanning library...</p>
                                    </div>
                                </td>
                            </tr>
                        ) : filteredClips.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-8 py-24 text-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-16 h-16 rounded-3xl bg-white/[0.03] flex items-center justify-center text-slate-700">
                                            <Video size={32} />
                                        </div>
                                        <div>
                                            <p className="text-white font-bold text-lg">No clips found</p>
                                            <p className="text-slate-500 mt-1 max-w-xs mx-auto">
                                                Your clip library is empty. Add a YouTube URL or run an automation to see them here.
                                            </p>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredClips.map(clip => (
                                <tr key={clip.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-8 py-6 align-top">
                                        <div className="max-w-md">
                                            <div className="font-bold text-white text-base mb-1 truncate group-hover:text-red-400 transition-colors" title={clip.videoTitle || undefined}>
                                                {clip.videoTitle || 'Pending extraction...'}
                                            </div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <a
                                                    href={clip.youtubeUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-xs text-slate-500 hover:text-white flex items-center gap-1 transition-colors"
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                    Watch Source
                                                </a>
                                            </div>
                                            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-600">
                                                Added {formatDistanceToNow(new Date(clip.createdAt), { addSuffix: true })}
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-8 py-6 align-top">
                                        <div className="max-w-xs">
                                            {clip.startSeconds != null ? (
                                                <div className="space-y-3">
                                                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-xs font-mono text-red-400">
                                                        <Clock size={12} />
                                                        {Math.floor(clip.startSeconds / 60)}:{String(clip.startSeconds % 60).padStart(2, '0')} → {Math.floor(clip.endSeconds! / 60)}:{String(clip.endSeconds! % 60).padStart(2, '0')}
                                                    </div>
                                                    {clip.clipRationale && (
                                                        <p className="text-xs text-slate-400 leading-relaxed italic line-clamp-3">
                                                            "{clip.clipRationale}"
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-xs text-slate-600 italic">
                                                    <Loader2 size={12} className="animate-spin" />
                                                    AI is choosing the viral hook...
                                                </div>
                                            )}
                                        </div>
                                    </td>

                                    <td className="px-8 py-6 align-top">
                                        <div className="flex flex-col gap-2">
                                            {clip.status === 'queued' && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-slate-500/10 text-slate-500 border border-slate-500/10">
                                                    <Clock className="w-3.5 h-3.5" /> Queued
                                                </span>
                                            )}
                                            {clip.status === 'processing' && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Clipping...
                                                </span>
                                            )}
                                            {clip.status === 'done' && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                                                </span>
                                            )}
                                            {clip.status === 'failed' && (
                                                <div className="space-y-1">
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                                                        <XCircle className="w-3.5 h-3.5" /> Failed
                                                    </span>
                                                    {clip.errorMessage && (
                                                        <p className="text-[10px] text-red-400/60 max-w-[150px] leading-tight">{clip.errorMessage}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </td>

                                    <td className="px-8 py-6 text-right align-top">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                            {clip.clipUrl && (
                                                <>
                                                    <a
                                                        href={clip.clipUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all border border-white/10 shadow-xl"
                                                    >
                                                        <Play className="w-3.5 h-3.5 fill-current" />
                                                        Preview
                                                    </a>
                                                    <a
                                                        href={clip.clipUrl}
                                                        download
                                                        className="p-2.5 bg-white/5 hover:bg-white/20 text-slate-300 hover:text-white rounded-xl transition-all border border-white/10"
                                                        title="Download MP4"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </a>
                                                </>
                                            )}
                                            {(clip.status === 'queued' || clip.status === 'failed') && (
                                                <button
                                                    onClick={() => handleProcess(clip.id)}
                                                    className="p-2.5 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20"
                                                    title="Retry processing"
                                                >
                                                    <Zap className="w-4 h-4 fill-current" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(clip.id)}
                                                className="p-2.5 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                                title="Delete from database"
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

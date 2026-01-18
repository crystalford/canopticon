'use client'

import { useState, useEffect } from 'react'
import { Upload, Play, Film, Loader2, Trash2, Calendar, Share } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Video {
    id: string
    filename: string
    originalName: string
    mimeType: string
    size: number
    createdAt: string
}

export default function VideoLibraryPage() {
    const [videos, setVideos] = useState<Video[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [dragActive, setDragActive] = useState(false)

    // Playback state
    const [playingId, setPlayingId] = useState<string | null>(null)

    useEffect(() => {
        fetchVideos()
    }, [])

    const fetchVideos = async () => {
        try {
            const res = await fetch('/api/videos/list') // Need to create this or do server component
            // Actually, let's keep it simple and just fetch from a new list route or server component?
            // For now, let's do client fetch to a separate list route we'll make in a second.
            // Or better, fetch from the upload route if we make it support GET?
            // Let's assume we make a GET /api/videos endpoint.
            const data = await res.json()
            setVideos(data.videos || [])
        } catch (e) {
            console.error('Failed to load videos', e)
        } finally {
            setLoading(false)
        }
    }

    const handleUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return

        const file = files[0]
        if (!file.type.startsWith('video/')) {
            alert('Please upload a valid video file')
            return
        }

        setUploading(true)
        const formData = new FormData()
        formData.append('file', file)

        try {
            const res = await fetch('/api/videos/upload', {
                method: 'POST',
                body: formData
            })

            if (!res.ok) throw new Error('Upload failed')

            await fetchVideos()
        } catch (e) {
            alert('Error uploading video')
        } finally {
            setUploading(false)
        }
    }

    // Drag handlers
    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else if (e.type === 'dragleave') {
            setDragActive(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleUpload(e.dataTransfer.files)
        }
    }

    const handleDispatch = async (id: string) => {
        if (!confirm('Dispatch this video to your configured Webhook?')) return

        try {
            const res = await fetch(`/api/videos/${id}/dispatch`, { method: 'POST' })
            const data = await res.json()

            if (res.ok) {
                alert('Video dispatched successfully!')
            } else {
                alert(`Error: ${data.error}`)
            }
        } catch (e) {
            alert('Failed to dispatch video')
        }
    }

    return (
        <div className="max-w-7xl mx-auto pb-20 space-y-8">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Private Video Library</h1>
                    <p className="text-slate-400">Securely hosted videos for your dashboard.</p>
                </div>

                <div className="relative">
                    <input
                        type="file"
                        id="video-upload"
                        className="hidden"
                        accept="video/*"
                        onChange={(e) => handleUpload(e.target.files)}
                    />
                    <label
                        htmlFor="video-upload"
                        className={`btn-primary cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                        {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        {uploading ? 'Uploading...' : 'Upload Video'}
                    </label>
                </div>
            </header>

            {/* Drop Zone / Empty State */}
            {videos.length === 0 && !loading && (
                <div
                    className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${dragActive ? 'border-primary-500 bg-primary-500/10' : 'border-slate-800 hover:border-slate-700'}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                        <Film className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">No videos yet</h3>
                    <p className="text-slate-400 mb-6 max-w-sm mx-auto">
                        Upload videos to keep them safe in your private dashboard library.
                    </p>
                </div>
            )}

            {/* Video Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {videos.map(video => (
                    <div key={video.id} className="glass-panel overflow-hidden group">
                        <div className="aspect-video bg-black relative">
                            {playingId === video.id ? (
                                <video
                                    src={`/api/videos/${video.id}/stream`}
                                    controls
                                    autoPlay
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                                    <Film className="w-12 h-12 text-slate-700 mb-2" />
                                    <button
                                        onClick={() => setPlayingId(video.id)}
                                        className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/20 transition-colors group-hover:scale-110 duration-200"
                                    >
                                        <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-xl">
                                            <Play className="w-8 h-8 text-white fill-white ml-1" />
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="p-4">
                            <h3 className="text-white font-bold truncate mb-1" title={video.originalName}>
                                {video.originalName}
                            </h3>
                            <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(video.createdAt).toLocaleDateString()}
                                </span>

                                <div className="flex items-center gap-3">
                                    <span>{(video.size / (1024 * 1024)).toFixed(1)} MB</span>
                                    <button
                                        onClick={() => handleDispatch(video.id)}
                                        className="p-1.5 hover:bg-primary-500/20 hover:text-primary-400 text-slate-500 rounded transition-colors"
                                        title="Dispatch to Webhook"
                                    >
                                        <Share className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {loading && (
                <div className="text-center py-20 text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                    Loading library...
                </div>
            )}
        </div>
    )
}

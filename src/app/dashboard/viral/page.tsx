'use client'

import { useState, useEffect } from 'react'
import { Flame, RefreshCw, ArrowRight, ExternalLink } from 'lucide-react'

type ViralPost = {
    platform: 'bluesky' | 'mastodon'
    uri: string
    cid: string
    author: {
        handle: string
        displayName: string
        avatar?: string
    }
    content: string
    metrics: {
        likes: number
        reposts: number
        replies: number
    }
    indexedAt: string
}

export default function ViralMonitorPage() {
    const [posts, setPosts] = useState<ViralPost[]>([])
    const [loading, setLoading] = useState(true)

    const fetchFeed = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/ingest/viral')
            const data = await res.json()
            setPosts(data.posts || [])
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchFeed()
    }, [])

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <Flame className="w-8 h-8 text-orange-500" />
                        Viral Monitor <span className="text-xs bg-orange-500/10 text-orange-400 px-2 py-1 rounded border border-orange-500/20">LIVE</span>
                    </h1>
                    <p className="text-slate-400">Real-time trending narratives from Bluesky and Mastodon (#cdnpoli).</p>
                </div>
                <button
                    onClick={fetchFeed}
                    disabled={loading}
                    className="btn-secondary flex items-center gap-2"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Feed
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map((post) => (
                    <div key={post.uri || Math.random().toString()} className={`glass-panel p-5 flex flex-col h-full group transition-colors ${post.platform === 'mastodon' ? 'hover:border-purple-500/30' : 'hover:border-blue-500/30'}`}>
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                {post.author.avatar ? (
                                    <img src={post.author.avatar} alt={post.author.handle} className="w-10 h-10 rounded-full bg-slate-800" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-slate-800" />
                                )}
                                <div>
                                    <div className="font-bold text-white text-sm line-clamp-1">{post.author.displayName}</div>
                                    <div className="text-xs text-slate-500">@{post.author.handle}</div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${post.platform === 'mastodon' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                    {post.platform}
                                </span>
                                <div className="flex items-center gap-1 text-[10px] font-mono text-orange-400">
                                    <Flame className="w-3 h-3" />
                                    {post.metrics.likes + post.metrics.reposts}
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 mb-4">
                            <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed line-clamp-6">
                                {post.content}
                            </p>
                        </div>

                        {/* Metrics & Actions */}
                        <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                            <div className="flex gap-4 text-xs text-slate-500 font-mono">
                                <span>L: {post.metrics.likes}</span>
                                <span>R: {post.metrics.reposts}</span>
                            </div>

                            <a
                                href={post.platform === 'bluesky'
                                    ? `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`
                                    : post.uri
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                            >
                                Open <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    </div>
                ))}


                {!loading && posts.length === 0 && (
                    <div className="col-span-full h-40 flex items-center justify-center text-slate-500 border border-dashed border-white/10 rounded-xl">
                        No trending posts found. (The public feed might be rate limited or empty).
                    </div>
                )}
            </div>
        </div>
    )
}

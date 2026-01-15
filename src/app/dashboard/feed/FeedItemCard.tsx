'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, ArrowRight, Archive, ExternalLink, Clock } from 'lucide-react'

interface FeedItem {
    id: string
    title: string
    bodyText: string
    publishedAt: Date | null
    createdAt: Date
    sourceName: string | null
    originalUrl: string
}

export default function FeedItemCard({ item }: { item: FeedItem }) {
    const router = useRouter()
    const [status, setStatus] = useState<'idle' | 'converting' | 'archiving'>('idle')

    const handleConvert = async () => {
        setStatus('converting')
        try {
            const res = await fetch('/api/feed/convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rawArticleId: item.id })
            })

            if (res.ok) {
                const data = await res.json()
                router.push(`/dashboard/articles/${data.slug}`)
            } else {
                alert('Failed to convert')
                setStatus('idle')
            }
        } catch (e) {
            console.error(e)
            setStatus('idle')
        }
    }

    const handleArchive = async () => {
        if (!confirm('Dismiss this story from the feed?')) return
        setStatus('archiving')
        try {
            await fetch('/api/feed/archive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rawArticleId: item.id })
            })
            router.refresh()
        } catch (e) {
            console.error(e)
            setStatus('idle')
        }
    }

    if (status === 'archiving') {
        return null // Optimistic remove
    }

    return (
        <div className="glass-card p-5 group flex flex-col md:flex-row gap-6 border border-white/5 hover:border-primary-500/30 transition-all">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                        {item.sourceName || 'Unknown Source'}
                    </span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.createdAt).toLocaleString()}
                    </span>
                </div>

                <h3 className="text-lg font-bold text-white mb-2 leading-tight group-hover:text-primary-400 transition-colors">
                    {item.title}
                </h3>
                <p className="text-sm text-slate-400 line-clamp-2 md:line-clamp-1 mb-3">
                    {item.bodyText.slice(0, 300)}
                </p>

                <div className="flex items-center gap-4 text-xs text-slate-500">
                    <a
                        href={item.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-white flex items-center gap-1 transition-colors"
                    >
                        <ExternalLink className="w-3 h-3" />
                        View Source
                    </a>
                </div>
            </div>

            <div className="flex items-center gap-3 md:border-l border-white/5 md:pl-6">
                {status === 'converting' ? (
                    <div className="flex items-center gap-2 text-primary-400 px-4">
                        <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" />
                        <span className="text-xs font-bold uppercase">Creating Draft...</span>
                    </div>
                ) : (
                    <>
                        <button
                            onClick={handleArchive}
                            className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                            title="Dismiss / Archive"
                        >
                            <Archive className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleConvert}
                            className="btn-primary py-2 px-4 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                        >
                            <FileText className="w-4 h-4 mr-2" />
                            Draft Article
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

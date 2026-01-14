'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Calendar, ArrowRight, Activity } from 'lucide-react'

interface BriefStory {
    headline: string
    summary: string
    keyPlayers: string[]
    significance: number
    sourceUrls: string[]
}

interface DailyBrief {
    id: string
    generatedAt: string
    stories: BriefStory[]
    status: 'draft' | 'published'
}

export default function DashboardPage() {
    const [brief, setBrief] = useState<DailyBrief | null>(null)
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [publishing, setPublishing] = useState<number | null>(null)

    useEffect(() => {
        fetchBrief()
    }, [])

    const fetchBrief = async () => {
        try {
            const res = await fetch('/api/brief')
            const data = await res.json()
            setBrief(data.brief)
        } catch (err) {
            console.error('Failed to fetch brief')
        } finally {
            setLoading(false)
        }
    }

    const handleGenerate = async () => {
        setGenerating(true)
        setError(null)
        try {
            const res = await fetch('/api/brief/generate', { method: 'POST' })
            const data = await res.json()
            if (res.ok) setBrief(data.brief)
            else setError(data.error || 'Failed to generate')
        } catch (err) {
            setError('Network error.')
        } finally {
            setGenerating(false)
        }
    }

    const handlePublishClick = async (storyIndex: number) => {
        if (!brief) return
        setPublishing(storyIndex)
        try {
            const res = await fetch('/api/brief/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ briefId: brief.id, storyIndex })
            })
            if (res.ok) {
                const data = await res.json()
                window.location.href = `/dashboard/articles/${data.slug}`
            } else {
                const errorData = await res.json()
                alert(`Failed to publish: ${errorData.error || 'Unknown error'}`)
            }
        } catch (e) {
            console.error('Publish error:', e)
            alert('Error publishing story')
        } finally {
            setPublishing(null)
        }
    }

    const getSignificanceBadge = (score: number) => {
        if (score >= 8) return 'bg-red-500/10 text-red-400 border-red-500/20'
        if (score >= 6) return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        return 'bg-slate-500/10 text-slate-500 border-slate-500/20'
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-slate-400 font-mono text-sm">Loading...</div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Daily Intelligence Brief</h1>
                    <p className="text-slate-400 text-sm flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="btn-primary"
                >
                    {generating ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                            GENERATING...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            GENERATE BRIEF
                        </>
                    )}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="glass-panel p-4 border-l-2 border-red-500 text-red-200 bg-red-500/10">
                    <span className="font-bold">ERROR:</span> {error}
                </div>
            )}

            {/* Empty State */}
            {!brief && !generating && (
                <div className="glass-panel p-16 text-center">
                    <Activity className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">No Brief Generated</h2>
                    <p className="text-slate-400 max-w-md mx-auto mb-6">
                        Click "Generate Brief" to scan Canadian political news and synthesize intelligence.
                    </p>
                </div>
            )}

            {/* Stories List */}
            {brief && (
                <div className="grid gap-4">
                    {brief.stories.map((story, index) => (
                        <div
                            key={index}
                            onClick={() => handlePublishClick(index)}
                            className="glass-card p-6 flex flex-col md:flex-row gap-6 group cursor-pointer hover:border-primary-500/20 transition-colors"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getSignificanceBadge(story.significance)}`}>
                                        Impact {story.significance}/10
                                    </span>
                                    <span className="text-[10px] text-slate-600 font-mono uppercase">
                                        #{String(index + 1).padStart(2, '0')}
                                    </span>
                                </div>

                                <h3 className="text-lg font-bold text-white mb-2 truncate group-hover:text-primary-400 transition-colors">
                                    {story.headline}
                                </h3>

                                <p className="text-sm text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                                    {story.summary}
                                </p>

                                {story.keyPlayers && story.keyPlayers.length > 0 && (
                                    <div className="flex gap-2">
                                        {story.keyPlayers.slice(0, 3).map((player, i) => (
                                            <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 border border-white/10 text-slate-500">
                                                {player}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-3 md:border-l border-white/5 md:pl-6">
                                <div className="text-slate-500 group-hover:text-primary-400 transition-colors flex items-center gap-2">
                                    {publishing === index ? (
                                        <span className="text-xs">Opening...</span>
                                    ) : (
                                        <>
                                            <span className="text-xs font-medium">Draft Article</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

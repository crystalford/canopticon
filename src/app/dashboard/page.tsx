'use client'

import { useState, useEffect } from 'react'
import { Sparkles, FileText, ArrowRight, Clock, Users, Globe } from 'lucide-react'

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

    const handlePublish = async (storyIndex: number) => {
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
                window.open(`/dashboard/articles/${data.slug}`, '_blank')
            } else {
                alert('Failed to publish story')
            }
        } catch (e) {
            alert('Error publishing story')
        } finally {
            setPublishing(null)
        }
    }

    const getImpactColor = (score: number) => {
        if (score >= 8) return 'text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.4)]'
        if (score >= 6) return 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]'
        return 'text-slate-400'
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-primary-500/20 border-t-primary-500 animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse shadow-[0_0_10px_#0ea5e9]"></div>
                    </div>
                </div>
                <div className="text-slate-400 font-mono text-sm tracking-widest animate-pulse">INITIALIZING UPLINK...</div>
            </div>
        )
    }

    return (
        <div className="space-y-10">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                        Daily Brief
                        <span className="text-primary-500">.</span>
                    </h1>
                    <div className="flex items-center gap-3 text-slate-400 text-sm">
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-xs">
                            {new Date().toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
                        </span>
                        <span>•</span>
                        <span>AI-Synthesized Intelligence</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="btn-primary relative overflow-hidden group"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        <div className="flex items-center gap-2 relative z-10">
                            {generating ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Sparkles className="w-4 h-4" />
                            )}
                            <span>{generating ? 'SYNTHESIZING...' : 'GENERATE BRIEF'}</span>
                        </div>
                    </button>
                </div>
            </header>

            {/* Error State */}
            {error && (
                <div className="glass-panel p-4 border-l-2 border-red-500 flex gap-3 text-red-200 bg-red-500/10">
                    <span className="font-bold">ERROR:</span> {error}
                </div>
            )}

            {/* Empty State */}
            {!brief && !generating && (
                <div className="glass-panel min-h-[400px] flex flex-col items-center justify-center text-center p-12 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                    <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-glass backdrop-blur-sm relative z-10">
                        <Globe className="w-8 h-8 text-primary-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2 relative z-10">Ready to Scan</h2>
                    <p className="text-slate-400 max-w-sm mb-8 relative z-10">
                        Initiate a scan of Canadian political news sources to synthesize today's intelligence brief.
                    </p>
                    <button onClick={handleGenerate} className="btn-secondary relative z-10">
                        Initialize Scan
                    </button>
                </div>
            )}

            {/* Content Grid */}
            {brief && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {brief.stories.map((story, index) => {
                        const isTopStory = index === 0
                        return (
                            <div
                                key={index}
                                className={`
                                    glass-card relative flex flex-col
                                    ${isTopStory ? 'lg:col-span-12 min-h-[300px]' : 'lg:col-span-6 min-h-[350px]'}
                                `}
                            >
                                {/* Active Indicator (Top Story Only) */}
                                {isTopStory && (
                                    <div className="absolute -top-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-500 to-transparent opacity-50" />
                                )}

                                <div className="p-6 md:p-8 flex flex-col h-full relative z-10">
                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono text-sm text-slate-500">#{String(index + 1).padStart(2, '0')}</span>
                                            {isTopStory && (
                                                <span className="px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-300 text-[10px] font-bold uppercase tracking-wider border border-primary-500/20">
                                                    Priority Alpha
                                                </span>
                                            )}
                                        </div>
                                        <div className={`text-xs font-bold font-mono tracking-wider flex items-center gap-2 ${getImpactColor(story.significance)}`}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                            IMPACT {story.significance}/10
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <h2 className={`font-bold text-white mb-4 leading-tight ${isTopStory ? 'text-3xl lg:text-4xl' : 'text-xl'}`}>
                                        {story.headline}
                                    </h2>

                                    <p className={`text-slate-400 leading-relaxed mb-8 ${isTopStory ? 'text-lg max-w-4xl' : 'text-sm'}`}>
                                        {story.summary}
                                    </p>

                                    {/* Footer / Actions */}
                                    <div className="mt-auto pt-6 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        {/* Tags */}
                                        <div className="flex items-center gap-2 overflow-hidden mask-linear-fade">
                                            <Users className="w-4 h-4 text-slate-600 shrink-0" />
                                            <div className="flex gap-2">
                                                {story.keyPlayers.slice(0, 3).map((player, i) => (
                                                    <span key={i} className="px-2 py-1 rounded bg-white/5 text-slate-400 text-xs border border-white/5 whitespace-nowrap">
                                                        {player}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Action Button */}
                                        <button
                                            onClick={() => handlePublish(index)}
                                            disabled={publishing === index}
                                            className="btn-secondary group/btn whitespace-nowrap"
                                        >
                                            {publishing === index ? 'OPENING...' : (
                                                <span className="flex items-center gap-2">
                                                    <FileText className="w-4 h-4" />
                                                    DRAFT ARTICLE
                                                    <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform text-primary-400" />
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

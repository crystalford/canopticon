'use client'

import { useState, useEffect } from 'react'
import { Sparkles, FileText, ArrowRight, Clock, Users } from 'lucide-react'

interface BriefStory {
    headline: string
    summary: string
    keyPlayers: string[]
    significance: number
    sourceUrls: string[]
    videoScript?: string
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

            if (res.ok) {
                setBrief(data.brief)
            } else {
                setError(data.error || 'Failed to generate brief')
            }
        } catch (err) {
            setError('Network error. Please try again.')
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
                body: JSON.stringify({
                    briefId: brief.id,
                    storyIndex
                })
            })

            if (res.ok) {
                const data = await res.json()
                window.open(`/dashboard/articles/${data.slug}`, '_blank')
            } else {
                alert('Failed to publish story')
            }
        } catch (e) {
            console.error(e)
            alert('Error publishing story')
        } finally {
            setPublishing(null)
        }
    }

    const getSignificanceColor = (score: number) => {
        if (score >= 8) return 'text-red-600 dark:text-red-400'
        if (score >= 6) return 'text-amber-600 dark:text-amber-400'
        return 'text-slate-600 dark:text-slate-400'
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
                    <div className="text-slate-500 font-medium">Loading Intelligence...</div>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
                        Daily Brief
                        <span className="px-3 py-1 bg-primary-100/50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium rounded-full">
                            {new Date().toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                        </span>
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 max-w-2xl">
                        AI-synthesized intelligence from Canadian political sources.
                    </p>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="btn-primary px-6 py-3 text-base shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40 relative overflow-hidden group"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    <div className="flex items-center gap-2 relative z-10">
                        {generating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Synthesizing...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5" />
                                Generate New Brief
                            </>
                        )}
                    </div>
                </button>
            </div>

            {error && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 flex items-start gap-3">
                    <div className="text-red-600 mt-0.5">⚠️</div>
                    <p className="text-red-700 dark:text-red-300 font-medium">{error}</p>
                </div>
            )}

            {!brief && !generating && (
                <div className="py-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl shadow-inner">
                        📡
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                        No Intelligence Generated
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-8">
                        Initialize a scan of Canadian political news sources to generate today's briefing.
                    </p>
                    <button onClick={handleGenerate} className="btn-secondary">
                        Start Scan
                    </button>
                </div>
            )}

            {brief && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-1">
                        <Clock className="w-3 h-3" />
                        Generated {new Date(brief.generatedAt).toLocaleTimeString()}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {brief.stories.map((story, index) => (
                            <div
                                key={index}
                                className={`
                                    group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300
                                    ${index === 0 ? 'lg:col-span-2 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-900/50 border-primary-100 dark:border-primary-900/30' : ''}
                                `}
                            >
                                <div className="p-6 md:p-8 flex flex-col h-full">
                                    {/* Card Header */}
                                    <div className="flex items-start justify-between gap-4 mb-4">
                                        <div className="flex items-center gap-3">
                                            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold font-mono text-sm">
                                                #{index + 1}
                                            </span>
                                            {index === 0 && (
                                                <span className="bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs px-2 py-1 rounded font-medium uppercase tracking-wide">
                                                    Top Story
                                                </span>
                                            )}
                                        </div>
                                        <div className={`flex items-center gap-1.5 font-bold text-sm ${getSignificanceColor(story.significance)}`}>
                                            <span className="w-2 h-2 rounded-full bg-current opacity-75" />
                                            {story.significance}/10 Impact
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <h2 className={`font-bold text-slate-900 dark:text-white mb-3 ${index === 0 ? 'text-2xl md:text-3xl' : 'text-xl'}`}>
                                        {story.headline}
                                    </h2>

                                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-6 line-clamp-4 group-hover:line-clamp-none transition-all">
                                        {story.summary}
                                    </p>

                                    {/* Footer */}
                                    <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        {/* Key Players */}
                                        <div className="flex items-center gap-2 text-slate-500 overflow-hidden">
                                            <Users className="w-4 h-4 shrink-0" />
                                            <div className="flex gap-2 ms-1 overflow-x-auto scrollbar-none mask-linear-fade">
                                                {story.keyPlayers.slice(0, 3).map((player, i) => (
                                                    <span key={i} className="text-xs font-medium whitespace-nowrap px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-400">
                                                        {player}
                                                    </span>
                                                ))}
                                                {story.keyPlayers.length > 3 && (
                                                    <span className="text-xs self-center">+{story.keyPlayers.length - 3}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action */}
                                        <button
                                            onClick={() => handlePublish(index)}
                                            disabled={publishing === index}
                                            className="btn-secondary group-hover:border-primary-500/50 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors flex items-center gap-2 whitespace-nowrap"
                                        >
                                            {publishing === index ? (
                                                'Opening Editor...'
                                            ) : (
                                                <>
                                                    <FileText className="w-4 h-4" />
                                                    Draft Article
                                                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

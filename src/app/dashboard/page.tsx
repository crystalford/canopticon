'use client'

import { useState, useEffect } from 'react'

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
    const [expandedStory, setExpandedStory] = useState<number | null>(null)

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

    const getSignificanceBadge = (score: number) => {
        if (score >= 8) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
        if (score >= 6) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-slate-500">Loading...</div>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                        Daily Brief
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400">
                        AI-curated Canadian political news
                    </p>
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="btn-primary px-6 py-3 text-lg"
                >
                    {generating ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                        </>
                    ) : (
                        '✨ Generate Today\'s Brief'
                    )}
                </button>
            </div>

            {error && (
                <div className="card p-4 mb-6 border-l-4 border-l-red-500 bg-red-50 dark:bg-red-900/20">
                    <p className="text-red-700 dark:text-red-300">{error}</p>
                </div>
            )}

            {!brief && !generating && (
                <div className="card p-12 text-center">
                    <div className="text-6xl mb-4">📰</div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                        No brief generated yet
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-6">
                        Click "Generate Today's Brief" to discover the top 5 Canadian political stories
                    </p>
                </div>
            )}

            {brief && (
                <div className="space-y-6">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        Generated {new Date(brief.generatedAt).toLocaleString()}
                    </div>

                    {brief.stories.map((story, index) => (
                        <div key={index} className="card p-6 hover:shadow-lg transition-shadow">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                                            #{index + 1}
                                        </span>
                                        <span className={`badge ${getSignificanceBadge(story.significance)}`}>
                                            Significance: {story.significance}/10
                                        </span>
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                                        {story.headline}
                                    </h2>
                                </div>
                            </div>

                            <div className="mb-4">
                                <div className={`text-slate-700 dark:text-slate-300 leading-relaxed ${expandedStory === index ? '' : 'line-clamp-4'
                                    }`}>
                                    {story.summary}
                                </div>
                                <button
                                    onClick={() => setExpandedStory(expandedStory === index ? null : index)}
                                    className="text-primary-600 dark:text-primary-400 text-sm font-medium mt-2 hover:underline"
                                >
                                    {expandedStory === index ? 'Show less' : 'Read full summary'}
                                </button>
                            </div>

                            {story.keyPlayers.length > 0 && (
                                <div className="mb-4">
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                        Key Players:
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {story.keyPlayers.map((player, i) => (
                                            <span key={i} className="badge bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                                {player}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex-1">
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                        Sources:
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {story.sourceUrls.map((url, i) => (
                                            <a
                                                key={i}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                                            >
                                                Source {i + 1} ↗
                                            </a>
                                        ))}
                                    </div>
                                </div>
                                <button className="btn-secondary text-sm">
                                    Publish
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Signal {
    id: string
    signalType: 'breaking' | 'repetition' | 'contradiction' | 'shift'
    confidenceScore: number
    significanceScore: number
    status: 'pending' | 'flagged' | 'approved' | 'archived'
    aiNotes?: string
    createdAt: string
}

export default function DashboardPage() {
    const [signals, setSignals] = useState<Signal[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<string>('all')

    useEffect(() => {
        fetchSignals()
    }, [filter])

    const fetchSignals = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (filter !== 'all') {
                params.set('status', filter)
            }
            const res = await fetch(`/api/signals?${params}`)
            const data = await res.json()
            setSignals(data.signals || [])
        } catch (error) {
            console.error('Failed to fetch signals:', error)
        } finally {
            setLoading(false)
        }
    }

    const runTriage = async () => {
        try {
            const res = await fetch('/api/signals/triage', { method: 'POST' })
            const data = await res.json()
            const errorDetails = data.reasons?.length ? `\nErrors: ${data.reasons.join(', ')}` : ''
            alert(`Triage complete: ${data.processed} processed, ${data.created} created, ${data.errors} errors${errorDetails}`)
            fetchSignals()
        } catch (error) {
            alert('Triage failed')
        }
    }

    const getSignalTypeBadge = (type: Signal['signalType']) => {
        const classes: Record<string, string> = {
            breaking: 'badge-breaking',
            repetition: 'badge-repetition',
            contradiction: 'badge-contradiction',
            shift: 'badge-shift',
        }
        return `badge ${classes[type] || ''}`
    }

    const getStatusBadge = (status: Signal['status']) => {
        const classes: Record<string, string> = {
            pending: 'status-pending',
            flagged: 'status-flagged',
            approved: 'status-approved',
            archived: 'status-archived',
        }
        return `badge ${classes[status] || ''}`
    }

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'score-high'
        if (score >= 40) return 'score-medium'
        return 'score-low'
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Signal Queue</h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">Review and approve incoming signals</p>
                </div>
                <button onClick={runTriage} className="btn-primary">
                    Run Triage
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-6">
                {['all', 'flagged', 'pending', 'approved', 'archived'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f
                            ? 'bg-primary-600 text-white'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>

            {/* Signal List */}
            {loading ? (
                <div className="card p-8 text-center">
                    <div className="animate-pulse-subtle text-slate-500">Loading signals...</div>
                </div>
            ) : signals.length === 0 ? (
                <div className="card p-8 text-center">
                    <p className="text-slate-500 dark:text-slate-400">No signals found</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                        Run triage to process new articles
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {signals.map(signal => (
                        <Link
                            key={signal.id}
                            href={`/dashboard/signal/${signal.id}`}
                            className="card p-4 block hover:shadow-md transition-shadow"
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={getSignalTypeBadge(signal.signalType)}>
                                            {signal.signalType}
                                        </span>
                                        <span className={getStatusBadge(signal.status)}>
                                            {signal.status}
                                        </span>
                                    </div>
                                    {signal.aiNotes && (
                                        <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                                            {signal.aiNotes}
                                        </p>
                                    )}
                                    <p className="text-xs text-slate-400 mt-2">
                                        {new Date(signal.createdAt).toLocaleString()}
                                    </p>
                                </div>
                                <div className="text-right ml-4">
                                    <div className="text-sm">
                                        <span className="text-slate-500">Confidence: </span>
                                        <span className={`font-medium ${getScoreColor(signal.confidenceScore)}`}>
                                            {signal.confidenceScore}%
                                        </span>
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-slate-500">Significance: </span>
                                        <span className={`font-medium ${getScoreColor(signal.significanceScore)}`}>
                                            {signal.significanceScore}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}

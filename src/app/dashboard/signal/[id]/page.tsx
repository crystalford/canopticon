'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface SignalDetail {
    signal: {
        id: string
        signalType: 'breaking' | 'repetition' | 'contradiction' | 'shift'
        confidenceScore: number
        significanceScore: number
        status: 'pending' | 'flagged' | 'approved' | 'archived'
        aiNotes?: string
        createdAt: string
    }
    cluster: {
        id: string
        primaryArticleId: string
        createdAt: string
    }
    articles: Array<{
        id: string
        title: string
        originalUrl: string
        publishedAt?: string
        bodyText: string
    }>
}

export default function SignalDetailPage() {
    const params = useParams()
    const router = useRouter()
    const [data, setData] = useState<SignalDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState(false)

    useEffect(() => {
        fetchSignal()
    }, [params.id])

    const fetchSignal = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/signals/${params.id}`)
            const data = await res.json()
            setData(data)
        } catch (error) {
            console.error('Failed to fetch signal:', error)
        } finally {
            setLoading(false)
        }
    }

    const updateStatus = async (status: string) => {
        setUpdating(true)
        try {
            const res = await fetch(`/api/signals/${params.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            })
            if (res.ok) {
                fetchSignal()
            }
        } catch (error) {
            console.error('Failed to update status:', error)
        } finally {
            setUpdating(false)
        }
    }

    const generateArticle = async () => {
        if (!data || data.signal.status !== 'approved') {
            alert('Signal must be approved before generating an article')
            return
        }

        setUpdating(true)
        try {
            const res = await fetch('/api/articles/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signal_id: data.signal.id }),
            })
            const result = await res.json()
            if (result.success) {
                router.push(`/dashboard/articles`)
            } else {
                alert(result.error || 'Failed to generate article')
            }
        } catch {
            alert('Failed to generate article')
        } finally {
            setUpdating(false)
        }
    }

    const runAnalysis = async () => {
        if (!confirm('Run AI analysis on this signal? This will verify the content and generate scores.')) return

        setUpdating(true)
        try {
            const res = await fetch(`/api/signals/${params.id}/analyze`, {
                method: 'POST',
            })
            const result = await res.json()
            if (result.success) {
                fetchSignal()
            } else {
                alert(result.error || 'Analysis failed')
            }
        } catch {
            alert('Failed to run analysis')
        } finally {
            setUpdating(false)
        }
    }

    if (loading) {
        return (
            <div className="card p-8 text-center">
                <div className="animate-pulse-subtle text-slate-500">Loading signal...</div>
            </div>
        )
    }

    if (!data) {
        return (
            <div className="card p-8 text-center">
                <p className="text-slate-500">Signal not found</p>
                <Link href="/dashboard" className="btn-secondary mt-4 inline-block">
                    Back to Dashboard
                </Link>
            </div>
        )
    }

    const { signal, articles } = data

    return (
        <div>
            <div className="flex items-center gap-4 mb-8">
                <Link href="/dashboard" className="text-slate-500 hover:text-slate-700">
                    ← Back
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Signal Detail</h1>
            </div>

            {/* Signal Info Card */}
            <div className="card p-6 mb-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`badge badge-${signal.signalType}`}>{signal.signalType}</span>
                            <span className={`badge status-${signal.status}`}>{signal.status}</span>
                        </div>
                        <p className="text-sm text-slate-500">
                            Created: {new Date(signal.createdAt).toLocaleString()}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-sm mb-1">
                            <span className="text-slate-500">Confidence: </span>
                            <span className="font-medium">{signal.confidenceScore}%</span>
                        </div>
                        <div className="text-sm">
                            <span className="text-slate-500">Significance: </span>
                            <span className="font-medium">{signal.significanceScore}%</span>
                        </div>
                    </div>
                </div>

                {signal.aiNotes && (
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 mb-4">
                        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">AI Notes</h3>
                        <p className="text-slate-600 dark:text-slate-400">{signal.aiNotes}</p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button
                        onClick={runAnalysis}
                        disabled={updating || signal.status === 'approved'}
                        className="btn-primary bg-indigo-600 hover:bg-indigo-700"
                    >
                        {updating ? 'Analyzing...' : '⚡ Analyze with AI'}
                    </button>

                    {signal.status !== 'approved' && (
                        <button
                            onClick={() => updateStatus('approved')}
                            disabled={updating}
                            className="btn-primary"
                        >
                            Approve
                        </button>
                    )}
                    {signal.status === 'approved' && (
                        <button
                            onClick={generateArticle}
                            disabled={updating}
                            className="btn-primary"
                        >
                            Generate Article
                        </button>
                    )}
                    {signal.status !== 'archived' && (
                        <button
                            onClick={() => updateStatus('archived')}
                            disabled={updating}
                            className="btn-secondary"
                        >
                            Archive
                        </button>
                    )}
                    {signal.status !== 'flagged' && signal.status !== 'approved' && (
                        <button
                            onClick={() => updateStatus('flagged')}
                            disabled={updating}
                            className="btn-ghost"
                        >
                            Flag for Review
                        </button>
                    )}
                </div>
            </div>

            {/* Source Articles */}
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                Source Articles ({articles.length})
            </h2>
            <div className="space-y-4">
                {articles.map(article => (
                    <div key={article.id} className="card p-4">
                        <h3 className="font-medium text-slate-900 dark:text-white mb-2">{article.title}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 mb-3">
                            {article.bodyText.slice(0, 300)}...
                        </p>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">
                                {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'No date'}
                            </span>
                            <a
                                href={article.originalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary-600 hover:text-primary-700"
                            >
                                View Source →
                            </a>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

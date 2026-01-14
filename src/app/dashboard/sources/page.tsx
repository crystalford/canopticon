'use client'

import { useState, useEffect } from 'react'

interface Source {
    id: string
    name: string
    protocol: string
    endpoint: string
    pollingInterval: string
    reliabilityWeight: number
    isActive: boolean
    createdAt: string
    updatedAt: string
}

export default function SourcesPage() {
    const [manualUrl, setManualUrl] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [sources, setSources] = useState<Source[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchSources()
    }, [])

    const fetchSources = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/sources')
            const data = await res.json()
            setSources(data.sources || [])
        } catch (error) {
            console.error('Failed to fetch sources:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!manualUrl) return

        setSubmitting(true)
        setMessage(null)

        try {
            const res = await fetch('/api/ingest/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: manualUrl }),
            })

            const data = await res.json()

            if (res.ok) {
                setMessage({ type: 'success', text: 'Article ingested successfully! Check the dashboard.' })
                setManualUrl('')
                // Refresh sources to see the "Manual Submission" source if it was just created
                fetchSources()
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to ingest article' })
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'An error occurred during submission' })
        } finally {
            setSubmitting(false)
        }
    }

    const disableSource = async (id: string) => {
        try {
            const res = await fetch(`/api/sources/${id}/disable`, { method: 'POST' })
            if (res.ok) {
                fetchSources()
            }
        } catch (error) {
            console.error('Failed to disable source:', error)
        }
    }

    const syncSource = async (source: Source) => {
        // Only verify for Parliament initially
        const isParliament = source.name.includes('Parliament')
        if (!isParliament) return

        setMessage({ type: 'success', text: `Syncing ${source.name}...` })
        setSubmitting(true)

        try {
            const res = await fetch('/api/ingest/parliament', { method: 'POST' })
            const data = await res.json()

            if (res.ok) {
                setMessage({
                    type: 'success',
                    text: `Sync complete: ${data.stats.ingested} ingested, ${data.stats.skipped} skipped, ${data.stats.errors} errors`
                })
            } else {
                setMessage({ type: 'error', text: 'Sync failed' })
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Sync failed' })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sources</h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">Manage ingestion sources</p>
                </div>
            </div>

            {/* Manual Ingestion Form */}
            <div className="card p-6 mb-8 border-l-4 border-l-primary-500">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Manual Ingestion</h2>
                <form onSubmit={handleManualSubmit} className="flex gap-4">
                    <input
                        type="url"
                        value={manualUrl}
                        onChange={(e) => setManualUrl(e.target.value)}
                        placeholder="https://www.canada.ca/en/..."
                        className="input flex-1"
                        required
                    />
                    <button
                        type="submit"
                        disabled={submitting}
                        className="btn-primary whitespace-nowrap"
                    >
                        {submitting ? 'Ingesting...' : 'Ingest URL'}
                    </button>
                </form>
                {message && (
                    <div className={`mt-4 p-3 rounded-lg text-sm ${message.type === 'success'
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                        {message.text}
                    </div>
                )}
            </div>

            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Configured Sources</h2>

            {loading ? (
                <div className="card p-8 text-center">
                    <div className="animate-pulse-subtle text-slate-500">Loading sources...</div>
                </div>
            ) : sources.length === 0 ? (
                <div className="card p-8 text-center">
                    <p className="text-slate-500 dark:text-slate-400">No sources configured</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                        Sources will be added automatically when workers run
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {sources.map(source => (
                        <div key={source.id} className="card p-4">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="font-medium text-slate-900 dark:text-white">{source.name}</h3>
                                        {source.isActive ? (
                                            <span className="badge status-approved">Active</span>
                                        ) : (
                                            <span className="badge status-archived">Disabled</span>
                                        )}
                                    </div>
                                    <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                                        <p>Protocol: {source.protocol}</p>
                                        <p>Endpoint: <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">{source.endpoint}</code></p>
                                        <p>Polling: {source.pollingInterval}</p>
                                        <p>Reliability: {source.reliabilityWeight}/100</p>
                                    </div>
                                </div>
                                <div className="ml-4 flex gap-2">
                                    {source.name.includes('Parliament') && (
                                        <button
                                            onClick={() => syncSource(source)}
                                            disabled={submitting}
                                            className="btn-secondary text-sm"
                                        >
                                            Sync Now
                                        </button>
                                    )}
                                    {source.isActive && (
                                        <button
                                            onClick={() => disableSource(source.id)}
                                            className="btn-danger text-sm"
                                        >
                                            Disable
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 mt-3">
                                Last updated: {new Date(source.updatedAt).toLocaleString()}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

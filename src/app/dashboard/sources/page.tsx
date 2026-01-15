'use client'

import { useState, useEffect } from 'react'
import { Database, RefreshCw, Power, Trash2 } from 'lucide-react'

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
                setMessage({ type: 'success', text: 'Article ingested successfully!' })
                setManualUrl('')
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
            await fetch(`/api/sources/${id}/disable`, { method: 'POST' })
            fetchSources()
        } catch (error) {
            console.error('Failed to disable source:', error)
        }
    }

    return (
        <div className="space-y-8">
            <div className="pb-6 border-b border-white/5">
                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Sources</h1>
                <p className="text-slate-400 text-sm">Manage ingestion sources</p>
            </div>

            {/* Manual Ingestion */}
            <div className="glass-panel p-6 border-l-2 border-primary-500">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5 text-primary-400" />
                    Manual Ingestion
                </h2>
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
                        ? 'bg-green-500/10 text-green-300 border border-green-500/20'
                        : 'bg-red-500/10 text-red-300 border border-red-500/20'
                        }`}>
                        {message.text}
                    </div>
                )}
            </div>

            {/* Configured Sources */}
            <div>
                <h2 className="text-lg font-semibold text-white mb-4">Configured Sources</h2>

                {loading ? (
                    <div className="glass-panel p-8 text-center">
                        <div className="text-slate-400">Loading sources...</div>
                    </div>
                ) : sources.length === 0 ? (
                    <div className="glass-panel p-8 text-center">
                        <Database className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400">No sources configured</p>
                        <p className="text-sm text-slate-500 mt-1">
                            Sources will be added automatically when workers run
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sources.map(source => (
                            <div key={source.id} className="glass-card p-4 flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="font-medium text-white">{source.name}</h3>
                                        {source.isActive ? (
                                            <span className="px-2 py-0.5 rounded text-[10px] bg-green-500/10 text-green-400 border border-green-500/20">
                                                Active
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-500/10 text-slate-500 border border-slate-500/20">
                                                Disabled
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 font-mono truncate">
                                        {source.endpoint}
                                    </p>
                                </div>
                                <button
                                    onClick={() => disableSource(source.id)}
                                    className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    title="Disable Source"
                                >
                                    <Power className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

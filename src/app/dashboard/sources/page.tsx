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

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sources</h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">Manage ingestion sources</p>
                </div>
            </div>

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
                                <div className="ml-4">
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

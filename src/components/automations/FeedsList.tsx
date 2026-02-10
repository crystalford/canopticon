'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, Trash2, CheckCircle, XCircle, AlertTriangle, RefreshCw, Play } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Automation {
    id: string
    name: string
    type: string
    enabled: boolean
    autoPublish: boolean
    lastRunAt: string | null
    lastResult: any
    config: any
}

export function FeedsList() {
    const [automations, setAutomations] = useState<Automation[]>([])
    const [loading, setLoading] = useState(true)

    const fetchAutomations = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/automations')
            if (res.ok) {
                setAutomations(await res.json())
            }
        } catch (error) {
            console.error('Failed to fetch automations', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAutomations()
        const interval = setInterval(fetchAutomations, 30000)
        return () => clearInterval(interval)
    }, [])

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this feed?')) return
        await fetch(`/api/automations/${id}`, { method: 'DELETE' })
        fetchAutomations()
    }

    const handleSubscribeHelper = (channelId: string) => {
        const url = `/api/webhooks/youtube/subscribe?channelId=${channelId}`
        window.open(url, '_blank')
    }

    if (loading && automations.length === 0) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="h-7 w-32 bg-white/10 rounded animate-pulse" />
                    <div className="h-9 w-9 bg-white/10 rounded animate-pulse" />
                </div>
                <div className="grid gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 h-32 animate-pulse">
                            <div className="flex gap-4">
                                <div className="flex-1 space-y-3">
                                    <div className="h-5 w-1/3 bg-white/10 rounded" />
                                    <div className="h-4 w-1/2 bg-white/5 rounded" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Active Feeds</h2>
                <button onClick={fetchAutomations} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                    <RefreshCw size={18} />
                </button>
            </div>

            <div className="grid gap-4">
                {automations.map(auto => (
                    <div key={auto.id} className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 hover:bg-white/[0.05] transition-colors group">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-medium text-white">{auto.name}</h3>
                                    <span className={`text-xs px-2 py-0.5 rounded-full border ${auto.type === 'youtube' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                        auto.type === 'rss' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
                                            'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                        }`}>
                                        {auto.type.toUpperCase()}
                                    </span>
                                    {auto.autoPublish && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 flex items-center gap-1">
                                            <Play size={10} className="fill-current" /> Auto-Publish
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm text-slate-400 font-mono truncate max-w-md">
                                    {auto.type === 'youtube' ?
                                        `Channel ID: ${auto.config.channelId}` :
                                        auto.config.feedUrl || JSON.stringify(auto.config)
                                    }
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {auto.type === 'youtube' && (
                                    <button
                                        onClick={() => handleSubscribeHelper(auto.config.channelId)}
                                        className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors flex items-center gap-2"
                                        title="Click to register webhook with Google"
                                    >
                                        <RefreshCw size={12} /> Sync Webhook
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDelete(auto.id)}
                                    className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-500">
                            <div className="flex items-center gap-4">
                                <span>Last Run: {auto.lastRunAt ? formatDistanceToNow(new Date(auto.lastRunAt), { addSuffix: true }) : 'Never'}</span>
                                {auto.lastResult && (
                                    <span className={`flex items-center gap-1.5 ${auto.lastResult.success ? 'text-green-400' : 'text-red-400'}`}>
                                        {auto.lastResult.success ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                                        {auto.lastResult.success ? 'Success' : 'Error'}
                                    </span>
                                )}
                            </div>
                            {auto.lastResult?.summary && (
                                <span className="truncate max-w-[200px] italic opacity-70">
                                    "{auto.lastResult.summary}"
                                </span>
                            )}
                        </div>
                    </div>
                ))}

                {automations.length === 0 && !loading && (
                    <div className="text-center py-12 rounded-xl border border-dashed border-white/10 text-slate-500">
                        <p>No feeds active.</p>
                        <p className="text-sm mt-2">Ask the Chat to "Monitor YouTube channel [URL]" to add one.</p>
                    </div>
                )}
            </div>
        </div>
    )
}

'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, Trash2, CheckCircle, XCircle, AlertTriangle, RefreshCw, Play, ChevronDown, ChevronUp, Plus, Activity } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'

interface Automation {
    id: string
    name: string
    type: string
    enabled: boolean
    autoPublish: boolean
    prompt: string
    lastRunAt: string | null
    lastResult: any
    config: any
}

export function FeedsList() {
    const [automations, setAutomations] = useState<Automation[]>([])
    const [loading, setLoading] = useState(true)
    const [runningId, setRunningId] = useState<string | null>(null)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const router = useRouter()

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

    const handleRun = async (id: string) => {
        setRunningId(id)
        try {
            const res = await fetch(`/api/automations/${id}/run`, {
                method: 'POST',
                body: JSON.stringify({ force: true })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to run')
            // Refresh to show result
            await fetchAutomations()
        } catch (error) {
            console.error('Run failed:', error)
            alert('Failed to run monitor. Check console.')
        } finally {
            setRunningId(null)
        }
    }

    const handleSubscribeHelper = (channelId: string) => {
        const url = `/api/webhooks/youtube/subscribe?channelId=${channelId}`
        window.open(url, '_blank')
    }

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id)
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
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-semibold text-white">Active Feeds</h2>
                    <button
                        onClick={() => router.push('/chat?initialInput=Create a new monitor for...')}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
                    >
                        <Plus size={16} /> New Feed
                    </button>
                </div>
                <button onClick={fetchAutomations} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                    <RefreshCw size={18} />
                </button>
            </div>

            <div className="grid gap-4">
                {automations.map(auto => (
                    <div key={auto.id} className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden transition-colors group">
                        <div className="p-4">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1 flex-1">
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
                                        {auto.config.autoPostToX && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-300 flex items-center gap-1">
                                                <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>
                                                Posts to X
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
                                    <button
                                        onClick={() => handleRun(auto.id)}
                                        disabled={runningId === auto.id}
                                        className={`p-2 rounded-lg transition-colors ${runningId === auto.id ? 'bg-white/10 text-slate-400 cursor-wait' : 'hover:bg-green-500/20 text-green-400 hover:text-green-300'}`}
                                        title="Run Now"
                                    >
                                        <Play size={18} className={runningId === auto.id ? 'animate-pulse' : ''} />
                                    </button>

                                    <button
                                        onClick={() => toggleExpand(auto.id)}
                                        className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                                        title="View Details"
                                    >
                                        {expandedId === auto.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </button>

                                    <button
                                        onClick={() => handleDelete(auto.id)}
                                        className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all"
                                        title="Delete Feed"
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
                                {auto.type === 'youtube' && (
                                    <button
                                        onClick={() => handleSubscribeHelper(auto.config.channelId)}
                                        className="text-xs hover:text-red-400 transition-colors flex items-center gap-1"
                                    >
                                        <Activity size={12} /> Webhook Status
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedId === auto.id && (
                            <div className="bg-black/20 p-4 border-t border-white/[0.06] space-y-4">
                                <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Instructions (Prompt)</h4>
                                    <div className="bg-black/40 rounded p-3 text-sm text-slate-300 whitespace-pre-wrap font-mono">
                                        {auto.prompt}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Configuration</h4>
                                        <pre className="bg-black/40 rounded p-3 text-xs text-slate-400 overflow-x-auto">
                                            {JSON.stringify(auto.config, null, 2)}
                                        </pre>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Last Result Debug</h4>
                                        <pre className="bg-black/40 rounded p-3 text-xs text-slate-400 overflow-x-auto h-32">
                                            {JSON.stringify(auto.lastResult || {}, null, 2)}
                                        </pre>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-2">
                                        <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>
                                        X / Twitter Publishing
                                    </h4>
                                    <div className="bg-black/40 rounded p-3 text-xs text-slate-400 space-y-2">
                                        <div className="flex justify-between border-b border-white/10 pb-2">
                                            <span>Auto-Post Status:</span>
                                            <span className={auto.config.autoPostToX ? 'text-green-400' : 'text-slate-500'}>
                                                {auto.config.autoPostToX ? 'Enabled' : 'Disabled'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between border-b border-white/10 pb-2">
                                            <span>Strategy:</span>
                                            <span className="text-white">Thread Generation (Auto-Size)</span>
                                        </div>
                                        <div>
                                            <span className="block mb-1 opacity-70">System Prompt (Hardcoded):</span>
                                            <div className="font-mono text-[10px] opacity-70 bg-black/20 p-2 rounded">
                                                "Convert this article into an engaging Twitter thread (3-8 tweets)... Hook, Middle points, Last tweet must link to article."
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {automations.length === 0 && !loading && (
                    <div className="text-center py-12 rounded-xl border border-dashed border-white/10 text-slate-500">
                        <p>No feeds active.</p>
                        <p className="text-sm mt-2 mb-4">Add a monitor to start tracking content.</p>
                        <button
                            onClick={() => router.push('/chat?initialInput=Create a new monitor for...')}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                        >
                            <Plus size={16} /> Add Feed via Chat
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

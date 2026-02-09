'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, MessageSquare, ExternalLink, RefreshCw, AlertTriangle, Twitter, Search, TrendingUp } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface SocialMonitor {
    id: string
    accountHandle: string
    displayName: string | null
    monitorType: string
    createdAt: string
}

interface TrackedTweet {
    id: string
    tweetId: string
    content: string
    authorHandle: string
    authorName: string | null
    url: string
    createdAt: string
    analyzed: boolean
    fallaciesDetected: any[]
    replyStatus: string
    monitor: SocialMonitor
}

interface SocialMonitorViewProps {
    onEngage: (tweet: TrackedTweet) => void
}

export function SocialMonitorView({ onEngage }: SocialMonitorViewProps) {
    const [monitors, setMonitors] = useState<SocialMonitor[]>([])
    const [tweets, setTweets] = useState<TrackedTweet[]>([])
    const [loading, setLoading] = useState(true)
    const [newHandle, setNewHandle] = useState('')
    const [addingMonitor, setAddingMonitor] = useState(false)
    const [checking, setChecking] = useState(false)
    const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set())

    const fetchData = async () => {
        setLoading(true)
        try {
            const [monitorsRes, tweetsRes] = await Promise.all([
                fetch('/api/social-monitors'),
                fetch('/api/tracked-tweets')
            ])

            if (monitorsRes.ok) setMonitors(await monitorsRes.json())
            if (tweetsRes.ok) setTweets(await tweetsRes.json())
        } catch (error) {
            console.error('Failed to fetch data:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, 30000) // Poll every 30s
        return () => clearInterval(interval)
    }, [])

    const [addType, setAddType] = useState<'account' | 'keyword' | 'trending'>('account')

    const handleAddMonitor = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newHandle) return

        setAddingMonitor(true)
        try {
            const res = await fetch('/api/social-monitors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountHandle: newHandle,
                    monitorType: addType === 'keyword' ? 'keyword' : addType === 'trending' ? 'trending' : 'fallacy_detection',
                    displayName: newHandle
                })
            })

            if (res.ok) {
                setNewHandle('')
                fetchData() // Refresh list
            }
        } catch (error) {
            console.error('Failed to add monitor:', error)
        } finally {
            setAddingMonitor(false)
        }
    }

    const handleDeleteMonitor = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Are you sure you want to stop monitoring this account?')) return
        try {
            await fetch(`/api/social-monitors/${id}`, { method: 'DELETE' })
            fetchData()
        } catch (error) {
            console.error('Failed to delete monitor:', error)
        }
    }

    const handleCheckNow = async () => {
        setChecking(true)
        try {
            const res = await fetch('/api/social-monitors/check', { method: 'POST' })
            const data = await res.json()

            if (!res.ok) throw new Error(data.error || 'Check failed')

            // Show feedback
            const newCount = data.results?.reduce((acc: number, r: any) => acc + (r.new || 0), 0)
            const errors = data.results?.filter((r: any) => r.error).map((r: any) => `${r.handle}: ${r.error}`)

            if (errors && errors.length > 0) {
                alert(`Sync complete with errors:\n${errors.join('\n')}`)
            } else {
                alert(`Sync complete! Found ${newCount} new tweets.`)
            }

            await fetchData() // Refresh the view
        } catch (error) {
            console.error('Failed to checked monitors:', error)
            alert('Failed to sync. Check console for details.')
        } finally {
            setChecking(false)
        }
    }

    const handleAnalyze = async (tweetId: string) => {
        setAnalyzingIds(prev => {
            const next = new Set(prev)
            next.add(tweetId)
            return next
        })
        try {
            const res = await fetch(`/api/tracked-tweets/${tweetId}/analyze`, { method: 'POST' })
            if (!res.ok) throw new Error('Analysis failed')
            await fetchData()
        } catch (error) {
            console.error('Failed to analyze tweet:', error)
        } finally {
            setAnalyzingIds(prev => {
                const next = new Set(prev)
                next.delete(tweetId)
                return next
            })
        }
    }

    return (
        <div className="flex h-full">
            {/* Sidebar (Matches ConversationSidebar) */}
            <div className="w-[260px] flex flex-col h-full border-r border-white/5 bg-transparent">
                {/* Header / Add Action */}
                <div className="p-3">
                    <div className="flex gap-1 mb-2 bg-white/5 p-0.5 rounded-lg">
                        <button
                            onClick={() => setAddType('account')}
                            className={`flex-1 text-[10px] uppercase font-bold py-1 rounded-md transition-all ${addType === 'account' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Account
                        </button>
                        <button
                            onClick={() => setAddType('keyword')}
                            className={`flex-1 text-[10px] uppercase font-bold py-1 rounded-md transition-all ${addType === 'keyword' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Keyword
                        </button>
                        <button
                            onClick={() => {
                                setAddType('trending')
                                setNewHandle('Canada Trends')
                            }}
                            className={`flex-1 text-[10px] uppercase font-bold py-1 rounded-md transition-all ${addType === 'trending' ? 'bg-pink-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Trends
                        </button>
                    </div>

                    <form onSubmit={handleAddMonitor} className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                        <input
                            type="text"
                            value={newHandle}
                            onChange={e => setNewHandle(e.target.value)}
                            placeholder={addType === 'account' ? "@handle" : addType === 'keyword' ? "Topic" : "Location"}
                            disabled={addType === 'trending'}
                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-300 placeholder-slate-500 outline-none focus:border-white/20 transition-colors disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={addingMonitor || !newHandle}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded text-slate-400 disabled:opacity-50"
                        >
                            <Plus className="w-3 h-3" />
                        </button>
                    </form>
                </div>

                <div className="px-3 pb-2 flex gap-1">
                    <div className="px-3 pt-1 pb-1 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                        Monitored Feeds
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
                    {monitors.map(monitor => (
                        <div key={monitor.id} className="w-full group flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-colors text-slate-400 hover:bg-white/5 hover:text-slate-200 cursor-default">
                            <div className="flex items-center gap-2 truncate">
                                {monitor.monitorType === 'keyword' ? (
                                    <Search className="w-3.5 h-3.5 flex-shrink-0 text-purple-400" />
                                ) : monitor.monitorType === 'trending' ? (
                                    <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 text-pink-400" />
                                ) : (
                                    <Twitter className="w-3.5 h-3.5 flex-shrink-0" />
                                )}
                                <span className="truncate">{monitor.accountHandle}</span>
                            </div>
                            <button
                                onClick={(e) => handleDeleteMonitor(monitor.id, e)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-slate-500 hover:text-red-400 transition-colors"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                    {monitors.length === 0 && (
                        <div className="text-center text-slate-500 text-sm py-4">No monitors added</div>
                    )}
                </div>

                {/* Action Bar at Bottom of Sidebar */}
                <div className="p-3 border-t border-white/5">
                    <button
                        onClick={handleCheckNow}
                        disabled={checking}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors text-xs font-medium disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                        {checking ? 'Syncing...' : 'Sync Now'}
                    </button>
                </div>
            </div>

            {/* Main Feed (Matches Chat Interface Area) */}
            <div className="flex-1 overflow-y-auto bg-transparent">
                {/* Headerless to match Chat, or minimal header if needed by Dashboard layout? 
                     Chat interface doesn't have a header in the component itself. 
                     We'll rely on the Dashboard styling. 
                 */}

                <div className="max-w-3xl mx-auto p-6 space-y-6">
                    {/* Title/Header Area in Feed */}
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 bg-blue-500/10 rounded-xl">
                            <Twitter className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-white">Social Command Center</h1>
                            <p className="text-sm text-slate-400">Monitor and snipe tracked accounts</p>
                        </div>
                    </div>

                    {tweets.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/5 mb-4">
                                <MessageSquare className="w-6 h-6 text-slate-500" />
                            </div>
                            <h3 className="text-sm font-medium text-slate-300">No tweets yet</h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Add handles on the left and click "Sync Now"
                            </p>
                        </div>
                    ) : (
                        tweets.map(tweet => (
                            <div key={tweet.id} className="flex gap-4 group">
                                {/* Avatar */}
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 border border-slate-600 text-xs font-bold text-slate-300">
                                    {tweet.authorHandle[1]?.toUpperCase() || 'X'}
                                </div>

                                {/* Content Bubble */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-medium text-slate-200">{tweet.authorName || tweet.authorHandle}</span>
                                        <span className="text-xs text-slate-500">{tweet.authorHandle}</span>
                                        <span className="text-xs text-slate-600">•</span>
                                        <span className="text-xs text-slate-500">{formatDistanceToNow(new Date(tweet.createdAt))} ago</span>
                                        <a href={tweet.url} target="_blank" rel="noopener noreferrer" className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-blue-400">
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                    </div>

                                    <div className="bg-white/5 border border-white/5 rounded-2xl rounded-tl-none px-4 py-3 mb-2 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                                        {tweet.content}
                                    </div>

                                    {/* Action Row */}
                                    <div className="flex gap-2">
                                        {!tweet.analyzed ? (
                                            <button
                                                onClick={() => handleAnalyze(tweet.id)}
                                                disabled={analyzingIds.has(tweet.id)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium text-slate-400 transition-colors disabled:opacity-50"
                                            >
                                                <AlertTriangle className={`w-3.5 h-3.5 ${analyzingIds.has(tweet.id) ? 'animate-pulse' : ''}`} />
                                                <span>Check Fallacies</span>
                                            </button>
                                        ) : tweet.fallaciesDetected && tweet.fallaciesDetected.length > 0 ? (
                                            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-200 max-w-lg">
                                                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-red-400" />
                                                <div>
                                                    <span className="font-semibold text-red-400">{tweet.fallaciesDetected[0].type}: </span>
                                                    {tweet.fallaciesDetected[0].explanation}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-500/70">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                                                Clean
                                            </span>
                                        )}

                                        <button
                                            onClick={() => onEngage(tweet)}
                                            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-primary-600/10 hover:bg-primary-600/20 text-primary-400 border border-primary-600/20 rounded-lg text-xs font-medium transition-colors"
                                        >
                                            <MessageSquare className="w-3.5 h-3.5" />
                                            <span>Snipe</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

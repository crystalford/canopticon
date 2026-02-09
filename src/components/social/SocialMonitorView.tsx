'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, MessageSquare, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react'
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
                    monitorType: 'fallacy_detection', // Default for now
                    displayName: newHandle
                })
            })

            if (res.ok) {
                setNewHandle('')
                fetchData()
            }
        } catch (error) {
            console.error('Failed to add monitor:', error)
        } finally {
            setAddingMonitor(false)
        }
    }

    const handleDeleteMonitor = async (id: string) => {
        if (!confirm('Are you sure you want to stop monitoring this account?')) return
        try {
            await fetch(`/api/social-monitors/${id}`, { method: 'DELETE' })
            fetchData()
        } catch (error) {
            console.error('Failed to delete monitor:', error)
        }
    }

    return (
        <div className="flex flex-col h-full bg-background text-foreground">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background-secondary/50">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Social Command Center
                </h2>
                <button
                    onClick={fetchData}
                    className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Monitors Sidebar (Left) */}
                <div className="w-64 border-r border-border bg-background-secondary/30 flex flex-col">
                    <div className="p-4 border-b border-border">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Monitored Accounts</h3>
                        <form onSubmit={handleAddMonitor} className="flex gap-2">
                            <input
                                type="text"
                                value={newHandle}
                                onChange={e => setNewHandle(e.target.value)}
                                placeholder="@handle"
                                className="flex-1 bg-background border border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:border-primary"
                            />
                            <button
                                type="submit"
                                disabled={addingMonitor || !newHandle}
                                className="p-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </form>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {monitors.map(monitor => (
                            <div key={monitor.id} className="flex items-center justify-between p-2 rounded hover:bg-white/5 group">
                                <span className="text-sm font-medium truncat">{monitor.accountHandle}</span>
                                <button
                                    onClick={() => handleDeleteMonitor(monitor.id)}
                                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Feed (Center) */}
                <div className="flex-1 overflow-y-auto p-6 bg-background">
                    <div className="max-w-3xl mx-auto space-y-6">
                        {tweets.length === 0 ? (
                            <div className="text-center text-muted-foreground py-20">
                                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p>No tweets tracked yet. Add monitored accounts to start ingesting content.</p>
                                <p className="text-xs mt-2 opacity-60">(New tweets will appear here automatically)</p>
                            </div>
                        ) : (
                            tweets.map(tweet => (
                                <div key={tweet.id} className="bg-card border border-border rounded-lg p-5 hover:border-white/20 transition-colors shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">
                                                {tweet.authorHandle[1]}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-sm">{tweet.authorName || tweet.authorHandle}</div>
                                                <div className="text-xs text-muted-foreground">{tweet.authorHandle} • {formatDistanceToNow(new Date(tweet.createdAt), { addSuffix: true })}</div>
                                            </div>
                                        </div>
                                        <a href={tweet.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    </div>

                                    <p className="text-base whitespace-pre-wrap mb-4 leading-relaxed">
                                        {tweet.content}
                                    </p>

                                    {/* Analysis Badge (Placeholder for Phase 2) */}
                                    {tweet.fallaciesDetected && tweet.fallaciesDetected.length > 0 && (
                                        <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded p-3 text-sm">
                                            <div className="flex items-center gap-2 text-red-400 font-semibold mb-1">
                                                <AlertTriangle className="w-4 h-4" />
                                                Fallacy Detected: {tweet.fallaciesDetected[0].type}
                                            </div>
                                            <p className="text-muted-foreground text-xs">{tweet.fallaciesDetected[0].explanation}</p>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-end pt-3 border-t border-white/5">
                                        <button
                                            onClick={() => onEngage(tweet)}
                                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
                                        >
                                            <MessageSquare className="w-4 h-4" />
                                            Engage / Snipe
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    Trash2, CheckCircle, AlertTriangle, RefreshCw, Play, ChevronDown, ChevronUp,
    Plus, Zap, Calendar, ArrowRight, ExternalLink, Loader2, Settings
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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

interface RunResult {
    success: boolean
    skipped?: boolean
    reason?: string
    articleId?: string
    articleTitle?: string
    articleSummary?: string
    error?: string
    threadUrl?: string
    xPostError?: string
}

// Resolve display name for a model ID
function modelLabel(provider?: string, modelId?: string): string {
    if (!provider && !modelId) return 'Default'
    const p = provider || ''
    const m = modelId || ''
    if (p === 'perplexity') return `Perplexity ${m === 'sonar-pro' ? 'Sonar Pro' : m}`
    if (p === 'openai') return `OpenAI ${m === 'gpt-4o' ? 'GPT-4o' : m}`
    if (p === 'anthropic') return `Anthropic ${m.includes('sonnet') ? 'Sonnet' : m}`
    return `${p}/${m}`
}

// Pipeline stages badge row
function PipelineFlow({ automation }: { automation: Automation }) {
    const { type, autoPublish, config } = automation
    const researchLabel = modelLabel(config.researchProvider || 'perplexity', config.researchModel || 'sonar-pro')
    const writingLabel = modelLabel(config.writingProvider || 'openai', config.writingModel || 'gpt-4o')
    const postToX = config.autoPostToX

    const stages: { label: string; color: string }[] = [
        type === 'youtube'
            ? { label: '⚡ YouTube Push', color: 'text-red-400 bg-red-500/10 border-red-500/20' }
            : type === 'rss'
                ? { label: '📡 RSS Feed', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' }
                : { label: '🔍 Keyword Search', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
        { label: `${researchLabel}: Research`, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
        { label: `${writingLabel}: Write`, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
        autoPublish
            ? { label: '✓ Auto-Publish', color: 'text-green-400 bg-green-500/10 border-green-500/20' }
            : { label: '📋 Save as Draft', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
        ...(postToX ? [{ label: '𝕏 Thread', color: 'text-slate-300 bg-slate-500/10 border-slate-500/20' }] : []),
    ]

    return (
        <div className="flex items-center gap-1 flex-wrap mt-2">
            {stages.map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${s.color}`}>
                        {s.label}
                    </span>
                    {i < stages.length - 1 && <ArrowRight size={10} className="text-slate-600 shrink-0" />}
                </div>
            ))}
        </div>
    )
}

export function FeedsList() {
    const [automations, setAutomations] = useState<Automation[]>([])
    const [loading, setLoading] = useState(true)
    const [runningId, setRunningId] = useState<string | null>(null)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [runResults, setRunResults] = useState<Record<string, RunResult>>({})
    const [webhookStatus, setWebhookStatus] = useState<Record<string, 'activating' | 'active' | 'error'>>({})
    const router = useRouter()

    const fetchAutomations = useCallback(async () => {
        try {
            const res = await fetch('/api/automations')
            if (res.ok) setAutomations(await res.json())
        } catch (e) {
            console.error('Failed to fetch automations', e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchAutomations()
        const interval = setInterval(fetchAutomations, 30000)
        return () => clearInterval(interval)
    }, [fetchAutomations])

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this pipeline?')) return
        await fetch(`/api/automations/${id}`, { method: 'DELETE' })
        setAutomations(prev => prev.filter(a => a.id !== id))
    }

    const handleRun = async (auto: Automation) => {
        setRunningId(auto.id)
        setRunResults(prev => { const n = { ...prev }; delete n[auto.id]; return n })
        try {
            const res = await fetch(`/api/automations/${auto.id}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force: true }),
            })
            const data = await res.json()

            // If we got an articleId, fetch the article summary for the preview
            let articleTitle: string | undefined
            let articleSummary: string | undefined
            if (data.articleId) {
                try {
                    const artRes = await fetch(`/api/articles/${data.articleId}`)
                    if (artRes.ok) {
                        const art = await artRes.json()
                        articleTitle = art.title
                        articleSummary = art.summary || art.content?.substring(0, 200)
                    }
                } catch { /* optional preview */ }
            }

            setRunResults(prev => ({ ...prev, [auto.id]: { ...data, articleTitle, articleSummary } }))
            await fetchAutomations()
        } catch (err: any) {
            setRunResults(prev => ({ ...prev, [auto.id]: { success: false, error: err.message } }))
        } finally {
            setRunningId(null)
        }
    }

    const handleActivateWebhook = async (auto: Automation) => {
        setWebhookStatus(prev => ({ ...prev, [auto.id]: 'activating' }))
        try {
            const res = await fetch(`/api/webhooks/youtube/subscribe?channelId=${auto.config.channelId}`)
            if (res.ok) {
                setWebhookStatus(prev => ({ ...prev, [auto.id]: 'active' }))
            } else {
                setWebhookStatus(prev => ({ ...prev, [auto.id]: 'error' }))
            }
        } catch {
            setWebhookStatus(prev => ({ ...prev, [auto.id]: 'error' }))
        }
    }

    const eventPipelines = automations.filter(a => a.type === 'youtube')
    const scheduledPipelines = automations.filter(a => a.type !== 'youtube')

    if (loading && automations.length === 0) {
        return (
            <div className="space-y-3">
                {[1, 2].map(i => (
                    <div key={i} className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 h-28 animate-pulse" />
                ))}
            </div>
        )
    }

    const renderCard = (auto: Automation) => {
        const result = runResults[auto.id]
        const whStatus = webhookStatus[auto.id]
        const isRunning = runningId === auto.id
        const isExpanded = expandedId === auto.id

        return (
            <div key={auto.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden group transition-colors hover:border-white/10">
                <div className="p-4">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-white truncate">{auto.name}</h3>
                            <div className="text-xs text-slate-500 font-mono truncate mt-0.5">
                                {auto.type === 'youtube'
                                    ? `Channel: ${auto.config.channelId}`
                                    : auto.type === 'rss'
                                        ? auto.config.feedUrl
                                        : (auto.config.keywords || []).join(', ')}
                            </div>
                            <PipelineFlow automation={auto} />
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                onClick={() => handleRun(auto)}
                                disabled={isRunning}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${isRunning
                                    ? 'bg-white/5 text-slate-500 cursor-wait'
                                    : 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20'
                                    }`}
                                title="Force run now (ignores lastRunAt)"
                            >
                                {isRunning
                                    ? <Loader2 size={13} className="animate-spin" />
                                    : <Play size={13} className="fill-current" />}
                                {isRunning ? 'Running…' : 'Test Run'}
                            </button>

                            <button
                                onClick={() => setExpandedId(isExpanded ? null : auto.id)}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-colors"
                                title="Expand details"
                            >
                                {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </button>

                            <Link
                                href={`/feeds/${auto.id}`}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-slate-200 transition-colors"
                                title="Pipeline details & settings"
                            >
                                <Settings size={14} />
                            </Link>

                            <button
                                onClick={() => handleDelete(auto.id)}
                                className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 text-slate-600 rounded-lg transition-all"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Status bar */}
                    <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center justify-between text-[11px] text-slate-600">
                        <div className="flex items-center gap-3">
                            <span>Last run: {auto.lastRunAt ? formatDistanceToNow(new Date(auto.lastRunAt), { addSuffix: true }) : 'Never'}</span>
                            {!result && auto.lastResult && (
                                <span className={`flex items-center gap-1 ${auto.lastResult.success && !auto.lastResult.skipped ? 'text-green-500' : auto.lastResult.skipped ? 'text-slate-500' : 'text-red-500'}`}>
                                    {auto.lastResult.success && !auto.lastResult.skipped ? <CheckCircle size={11} /> : auto.lastResult.skipped ? null : <AlertTriangle size={11} />}
                                    {auto.lastResult.skipped ? 'No new content' : auto.lastResult.success ? 'Success' : 'Failed'}
                                </span>
                            )}
                        </div>

                        {/* Webhook activation for YouTube */}
                        {auto.type === 'youtube' && (
                            <button
                                onClick={() => handleActivateWebhook(auto)}
                                disabled={whStatus === 'activating'}
                                className={`flex items-center gap-1 transition-colors ${whStatus === 'active'
                                    ? 'text-green-400 cursor-default'
                                    : whStatus === 'error'
                                        ? 'text-red-400'
                                        : whStatus === 'activating'
                                            ? 'text-slate-500'
                                            : 'text-slate-500 hover:text-red-400'
                                    }`}
                            >
                                {whStatus === 'activating' && <Loader2 size={10} className="animate-spin" />}
                                {whStatus === 'active' ? '✓ Webhook active' : whStatus === 'error' ? '✗ Activation failed' : '⚡ Activate webhook'}
                            </button>
                        )}
                    </div>

                    {/* Run result — shown after clicking Test Run */}
                    {result && (
                        <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${result.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                            {result.skipped ? (
                                <span className="text-slate-400">No new content found (ran anyway — no new articles created)</span>
                            ) : result.success ? (
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <span className="text-green-400 flex items-center gap-1 font-medium">
                                            <CheckCircle size={12} /> Article generated
                                        </span>
                                        {result.articleId && (
                                            <a href="/content" className="text-green-300 hover:text-green-200 flex items-center gap-1 underline underline-offset-2">
                                                <ExternalLink size={11} /> View in Articles
                                            </a>
                                        )}
                                        {result.threadUrl && (
                                            <a href={result.threadUrl} target="_blank" rel="noreferrer" className="text-slate-300 hover:text-white flex items-center gap-1 underline underline-offset-2">
                                                <ExternalLink size={11} /> View X Thread
                                            </a>
                                        )}
                                        {result.xPostError && <span className="text-yellow-400">⚠ X post failed: {result.xPostError}</span>}
                                    </div>
                                    {result.articleTitle && (
                                        <div className="text-slate-300 font-medium mt-1">{result.articleTitle}</div>
                                    )}
                                    {result.articleSummary && (
                                        <div className="text-slate-500 leading-relaxed line-clamp-2">{result.articleSummary}</div>
                                    )}
                                </div>
                            ) : (
                                <span className="text-red-400">✗ {result.error || 'Run failed'}</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Expanded details */}
                {isExpanded && (
                    <div className="bg-black/20 border-t border-white/[0.05] p-4 space-y-3">
                        {auto.prompt && (
                            <div>
                                <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">AI Instructions</div>
                                <div className="bg-black/30 rounded p-2.5 text-xs text-slate-300 font-mono whitespace-pre-wrap">{auto.prompt}</div>
                            </div>
                        )}
                        <div>
                            <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Last Run Result</div>
                            <pre className="bg-black/30 rounded p-2.5 text-[11px] text-slate-500 overflow-x-auto">{JSON.stringify(auto.lastResult || {}, null, 2)}</pre>
                        </div>
                        {auto.type === 'youtube' && (
                            <div className="text-[11px] text-slate-500 bg-black/20 rounded p-2.5 space-y-1">
                                <div className="text-slate-400 font-medium">How YouTube pipelines work</div>
                                <div>1. Click <strong className="text-slate-300">⚡ Activate webhook</strong> once per channel — YouTube will push a notification the instant a new video goes live</div>
                                <div>2. The webhook fires → research + article generation runs automatically</div>
                                <div>3. If webhook expires (~10 days), the hourly cron job polls as a backup</div>
                                <div>4. <strong className="text-slate-300">Test Run</strong> always grabs the most recent video regardless of timing — use this to test</div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    const isEmpty = automations.length === 0

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push('/chat?initialInput=Create a new pipeline for me')}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
                    >
                        <Plus size={15} /> New Pipeline
                    </button>
                </div>
                <button onClick={fetchAutomations} className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-colors" title="Refresh">
                    <RefreshCw size={15} />
                </button>
            </div>

            {isEmpty ? (
                <div className="text-center py-16 rounded-xl border border-dashed border-white/10 text-slate-500">
                    <p className="text-base mb-2">No pipelines yet</p>
                    <p className="text-sm mb-5">Tell the AI what you want to monitor and it will set one up.</p>
                    <button
                        onClick={() => router.push('/chat?initialInput=Create a new pipeline for me')}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors text-sm"
                    >
                        <Plus size={15} /> Create Pipeline via Chat
                    </button>
                </div>
            ) : (
                <>
                    {/* Event Pipelines — YouTube */}
                    {eventPipelines.length > 0 && (
                        <section>
                            <div className="flex items-center gap-2 mb-3">
                                <Zap size={14} className="text-red-400" />
                                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Event Pipelines</h2>
                                <span className="text-[10px] text-slate-600">— fire instantly when new content is published</span>
                            </div>
                            <div className="space-y-3">{eventPipelines.map(renderCard)}</div>
                        </section>
                    )}

                    {/* Scheduled Pipelines — RSS, keyword */}
                    {scheduledPipelines.length > 0 && (
                        <section>
                            <div className="flex items-center gap-2 mb-3">
                                <Calendar size={14} className="text-blue-400" />
                                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Scheduled Pipelines</h2>
                                <span className="text-[10px] text-slate-600">— run on a schedule via cron</span>
                            </div>
                            <div className="space-y-3">{scheduledPipelines.map(renderCard)}</div>
                        </section>
                    )}
                </>
            )}
        </div>
    )
}

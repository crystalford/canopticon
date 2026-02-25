'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    Trash2, CheckCircle, AlertTriangle, RefreshCw, Play, ChevronDown, ChevronUp,
    Plus, Zap, Calendar, ArrowRight, ExternalLink, Loader2, Settings, X
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

function modelLabel(provider?: string, modelId?: string): string {
    if (!provider && !modelId) return 'Default'
    const p = provider || ''
    const m = modelId || ''
    if (p === 'perplexity') return `Perplexity ${m === 'sonar-pro' ? 'Sonar Pro' : m}`
    if (p === 'openai') return `OpenAI ${m === 'gpt-4o' ? 'GPT-4o' : m}`
    if (p === 'anthropic') return `Anthropic ${m.includes('sonnet') ? 'Sonnet' : m}`
    return `${p}/${m}`
}

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

// ── New Pipeline Form ───────────────────────────────────────────────────────
const DEFAULT_YOUTUBE_PROMPT = `Write a sharp 600-800 word news article based on this video. Focus on key speakers, debates, policy implications, and direct quotes. Structure with a headline, summary paragraph, and 2-3 analysis sections. Tags should reflect the specific topic.`

interface NewPipelineFormProps {
    onCreated: () => void
    onCancel: () => void
}

function NewPipelineForm({ onCreated, onCancel }: NewPipelineFormProps) {
    const [type, setType] = useState<'youtube' | 'rss' | 'keyword'>('youtube')
    const [name, setName] = useState('')
    const [channelId, setChannelId] = useState('')
    const [feedUrl, setFeedUrl] = useState('')
    const [keywords, setKeywords] = useState('')
    const [prompt, setPrompt] = useState(DEFAULT_YOUTUBE_PROMPT)
    const [xThreadPrompt, setXThreadPrompt] = useState('')
    const [autoPublish, setAutoPublish] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!name.trim()) { setError('Name is required'); return }

        let config: Record<string, unknown> = {}
        if (type === 'youtube') {
            const cid = channelId.trim()
            if (!cid) { setError('Channel ID is required (starts with UC...)'); return }
            config = { channelId: cid }
        } else if (type === 'rss') {
            if (!feedUrl.trim()) { setError('Feed URL is required'); return }
            config = { feedUrl: feedUrl.trim() }
        } else {
            const kws = keywords.split(',').map(k => k.trim()).filter(Boolean)
            if (!kws.length) { setError('At least one keyword is required'); return }
            config = { keywords: kws }
        }
        if (xThreadPrompt.trim()) config.xThreadPrompt = xThreadPrompt.trim()

        setSaving(true)
        try {
            const res = await fetch('/api/automations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), type, config, prompt: prompt.trim(), autoPublish }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
            onCreated()
        } catch (e: any) {
            setError(e.message || 'Failed to create pipeline')
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white/[0.03] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">New Pipeline</h3>
                <button type="button" onClick={onCancel} className="p-1 text-slate-500 hover:text-white transition-colors">
                    <X size={16} />
                </button>
            </div>

            {/* Type */}
            <div className="flex gap-2">
                {(['youtube', 'rss', 'keyword'] as const).map(t => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${type === t
                            ? 'bg-red-600 border-red-500 text-white'
                            : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20'}`}
                    >
                        {t === 'youtube' ? '⚡ YouTube' : t === 'rss' ? '📡 RSS Feed' : '🔍 Keyword'}
                    </button>
                ))}
            </div>

            {/* Name */}
            <div>
                <label className="text-xs text-slate-500 mb-1 block">Pipeline Name</label>
                <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={type === 'youtube' ? 'e.g. CPAC Monitor' : type === 'rss' ? 'e.g. Globe & Mail Feed' : 'e.g. Tariff Monitor'}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-white/20"
                />
            </div>

            {/* Source config */}
            {type === 'youtube' && (
                <div>
                    <label className="text-xs text-slate-500 mb-1 block">YouTube Channel ID</label>
                    <input
                        value={channelId}
                        onChange={e => setChannelId(e.target.value)}
                        placeholder="UCxxxxxxxxxxxxxxxxxxxxxxxx"
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 font-mono focus:outline-none focus:border-white/20"
                    />
                    <p className="text-[10px] text-slate-600 mt-1">
                        CPAC Canada: <button type="button" onClick={() => { setChannelId('UCFZSV_So_OaXgXVzgu58tJQ'); setName(name || 'CPAC Monitor') }} className="text-red-400 underline">UCFZSV_So_OaXgXVzgu58tJQ</button>
                        {' · '}Find yours: go to channel page → View Source → search "channelId"
                    </p>
                </div>
            )}
            {type === 'rss' && (
                <div>
                    <label className="text-xs text-slate-500 mb-1 block">RSS Feed URL</label>
                    <input
                        value={feedUrl}
                        onChange={e => setFeedUrl(e.target.value)}
                        placeholder="https://example.com/rss"
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 font-mono focus:outline-none focus:border-white/20"
                    />
                </div>
            )}
            {type === 'keyword' && (
                <div>
                    <label className="text-xs text-slate-500 mb-1 block">Keywords (comma-separated)</label>
                    <input
                        value={keywords}
                        onChange={e => setKeywords(e.target.value)}
                        placeholder="tariffs, CUSMA, trade war"
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-white/20"
                    />
                </div>
            )}

            {/* Prompt */}
            <div>
                <label className="text-xs text-slate-500 mb-1 block">AI Instructions</label>
                <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    rows={4}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-white/20 resize-y"
                />
            </div>

            {/* X Thread Prompt */}
            <div>
                <label className="text-xs text-slate-500 mb-1 flex items-center gap-1.5 block">
                    𝕏 Thread Instructions
                    <span className="text-slate-600">(optional — leave blank for defaults)</span>
                </label>
                <textarea
                    value={xThreadPrompt}
                    onChange={e => setXThreadPrompt(e.target.value)}
                    rows={3}
                    placeholder={`e.g. Write a sharp, fact-driven thread quoting speakers directly. No hype.`}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-white/20 resize-y"
                />
            </div>

            {/* Options */}
            <label className="flex items-center gap-2 cursor-pointer">
                <input
                    type="checkbox"
                    checked={autoPublish}
                    onChange={e => setAutoPublish(e.target.checked)}
                    className="accent-red-500"
                />
                <span className="text-sm text-slate-300">Auto-publish articles</span>
                <span className="text-xs text-slate-500">(unchecked = save as draft for review)</span>
            </label>

            {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-2 pt-1">
                <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    {saving ? 'Creating…' : 'Create Pipeline'}
                </button>
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-white/10 text-slate-400 hover:text-white text-sm transition-colors">
                    Cancel
                </button>
            </div>
        </form>
    )
}

// ── Inline prompt editor (used in expanded card view) ───────────────────────
function PromptEditor({
    automationId, label, field, value, placeholder, onSaved
}: {
    automationId: string
    label: string
    field: 'prompt' | 'xThreadPrompt'
    value: string
    placeholder?: string
    onSaved: () => void
}) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(value)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        try {
            const body = field === 'prompt'
                ? { prompt: draft }
                : { config: { xThreadPrompt: draft } }  // backend PATCH merges config
            const res = await fetch(`/api/automations/${automationId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            if (!res.ok) throw new Error('Save failed')
            setSaved(true)
            setEditing(false)
            onSaved()
            setTimeout(() => setSaved(false), 2000)
        } catch {
            // keep editing open on failure
        } finally {
            setSaving(false)
        }
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] font-semibold text-slate-500 uppercase">{label}</div>
                {!editing && (
                    <button onClick={() => { setDraft(value); setEditing(true) }}
                        className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
                        Edit
                    </button>
                )}
                {saved && <span className="text-[10px] text-green-400">Saved ✓</span>}
            </div>
            {editing ? (
                <div className="space-y-1.5">
                    <textarea
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        rows={5}
                        className="w-full bg-black/30 border border-white/20 rounded p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-white/30 resize-y"
                        autoFocus
                    />
                    <div className="flex gap-2">
                        <button onClick={handleSave} disabled={saving}
                            className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs text-white transition-colors disabled:opacity-50">
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={() => setEditing(false)}
                            className="px-2.5 py-1 rounded text-xs text-slate-500 hover:text-white transition-colors">
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-black/30 rounded p-2.5 text-xs text-slate-400 font-mono whitespace-pre-wrap min-h-[2.5rem]">
                    {value || <span className="text-slate-600 italic">{placeholder?.split('\n')[0]}</span>}
                </div>
            )}
        </div>
    )
}

// ── Main FeedsList ──────────────────────────────────────────────────────────
export function FeedsList() {
    const [automations, setAutomations] = useState<Automation[]>([])
    const [loading, setLoading] = useState(true)
    const [fetchError, setFetchError] = useState<string | null>(null)
    const [showNewForm, setShowNewForm] = useState(false)
    const [runningId, setRunningId] = useState<string | null>(null)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [runResults, setRunResults] = useState<Record<string, RunResult>>({})
    const [webhookStatus, setWebhookStatus] = useState<Record<string, 'activating' | 'active' | 'error'>>({})
    const router = useRouter()

    const fetchAutomations = useCallback(async () => {
        try {
            const res = await fetch('/api/automations')
            if (!res.ok) throw new Error(`API ${res.status}`)
            const data = await res.json()
            setAutomations(data)
            setFetchError(null)
        } catch (e: any) {
            console.error('Failed to fetch automations', e)
            setFetchError(e?.message || 'Failed to load pipelines')
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
        } catch (e: any) {
            setRunResults(prev => ({ ...prev, [auto.id]: { success: false, error: e.message } }))
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

    if (fetchError && automations.length === 0) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                    <span className="text-sm text-red-400">Failed to load pipelines: {fetchError}</span>
                    <button onClick={fetchAutomations} className="text-xs text-red-300 underline">Retry</button>
                </div>
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

                    {/* Status row */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${auto.enabled ? 'text-green-400 bg-green-500/10' : 'text-slate-500 bg-white/5'}`}>
                            {auto.enabled ? 'Active' : 'Paused'}
                        </span>
                        {auto.lastRunAt && (
                            <span className="text-[10px] text-slate-600">
                                Last run: {formatDistanceToNow(new Date(auto.lastRunAt), { addSuffix: true })}
                            </span>
                        )}
                        {auto.lastResult?.success === false && auto.lastResult?.error && (
                            <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                                <AlertTriangle size={10} /> {auto.lastResult.error.substring(0, 60)}
                            </span>
                        )}

                        {/* YouTube: Webhook button */}
                        {auto.type === 'youtube' && (
                            <button
                                onClick={() => handleActivateWebhook(auto)}
                                disabled={whStatus === 'activating'}
                                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ml-auto ${whStatus === 'active'
                                    ? 'text-green-400 border-green-500/30 cursor-default'
                                    : whStatus === 'error'
                                        ? 'text-red-400 border-red-500/30 hover:bg-red-500/10'
                                        : whStatus === 'activating'
                                            ? 'text-slate-500 border-white/10 cursor-wait'
                                            : 'text-slate-400 border-white/10 hover:text-white hover:border-white/20'}`}
                            >
                                {whStatus === 'activating' ? '⟳ Activating…'
                                    : whStatus === 'active' ? '✓ Webhook Active'
                                        : whStatus === 'error' ? '✗ Retry Webhook'
                                            : '⚡ Activate Webhook'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Run result preview */}
                {result && (
                    <div className={`px-4 py-2 text-xs border-t ${result.success ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                        {result.success ? (
                            <div className="space-y-1">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span className="text-green-400 flex items-center gap-1">
                                        <CheckCircle size={11} /> Done
                                    </span>
                                    {result.articleId && (
                                        <a href="/content" className="text-green-300 hover:text-white flex items-center gap-1 underline underline-offset-2">
                                            <ExternalLink size={11} /> View Article
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

                {/* Expanded details */}
                {isExpanded && (
                    <div className="bg-black/20 border-t border-white/[0.05] p-4 space-y-4">
                        <PromptEditor
                            automationId={auto.id}
                            label="AI Instructions"
                            field="prompt"
                            value={auto.prompt}
                            placeholder="Describe what the AI should write about each video…"
                            onSaved={fetchAutomations}
                        />
                        <PromptEditor
                            automationId={auto.id}
                            label="𝕏 Thread Instructions"
                            field="xThreadPrompt"
                            value={auto.config?.xThreadPrompt || ''}
                            placeholder={`Leave blank to use the default:\n"Write an analytical Twitter/X thread. Be specific and substantive — actual facts, quotes, and insights. Sound like a sharp journalist, not a Twitter influencer."`}
                            onSaved={fetchAutomations}
                        />
                        <div>
                            <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Last Run Result</div>
                            <pre className="bg-black/30 rounded p-2.5 text-[11px] text-slate-500 overflow-x-auto">{JSON.stringify(auto.lastResult || {}, null, 2)}</pre>
                        </div>
                        {auto.type === 'youtube' && (
                            <div className="text-[11px] text-slate-500 bg-black/20 rounded p-2.5 space-y-1">
                                <div className="text-slate-400 font-medium">How YouTube pipelines work</div>
                                <div>1. Click <strong className="text-slate-300">⚡ Activate webhook</strong> once — YouTube pushes a notification the instant a new video goes live</div>
                                <div>2. The webhook fires → research + article generation runs automatically</div>
                                <div>3. If webhook expires (~10 days), the daily cron auto-renews it</div>
                                <div>4. <strong className="text-slate-300">Test Run</strong> always grabs the most recent video — use this to test immediately</div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => setShowNewForm(f => !f)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
                >
                    {showNewForm ? <X size={15} /> : <Plus size={15} />}
                    {showNewForm ? 'Cancel' : 'New Pipeline'}
                </button>
                <button onClick={fetchAutomations} className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-colors" title="Refresh">
                    <RefreshCw size={15} />
                </button>
            </div>

            {/* Inline creation form */}
            {showNewForm && (
                <NewPipelineForm
                    onCreated={() => { setShowNewForm(false); fetchAutomations() }}
                    onCancel={() => setShowNewForm(false)}
                />
            )}

            {automations.length === 0 && !showNewForm ? (
                <div className="text-center py-16 rounded-xl border border-dashed border-white/10 text-slate-500">
                    <p className="text-base mb-2">No pipelines yet</p>
                    <p className="text-sm mb-5">Click <strong className="text-white">New Pipeline</strong> above to create one directly, or ask the AI in chat.</p>
                </div>
            ) : (
                <>
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

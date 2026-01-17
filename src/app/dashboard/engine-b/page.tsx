'use client'

import { useState, useEffect } from 'react'
import { Microscope, Plus, FileText, ExternalLink, AlertTriangle, ArrowRight } from 'lucide-react'

export default function DiscourseAnalysisPage() {
    const [articles, setArticles] = useState<any[]>([])
    const [selectedArticleId, setSelectedArticleId] = useState<string>('')
    const [secondaryUrls, setSecondaryUrls] = useState<string[]>([''])
    const [analyzing, setAnalyzing] = useState(false)
    const [report, setReport] = useState<any>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        // Fetch recent primary articles to analyze
        fetch('/api/articles?status=published')
            .then(res => res.json())
            .then(data => setArticles(data.articles || []))
            .catch(err => console.error('Failed to load articles', err))
    }, [])

    const handleAddUrl = () => {
        setSecondaryUrls([...secondaryUrls, ''])
    }

    const handleUrlChange = (index: number, value: string) => {
        const newUrls = [...secondaryUrls]
        newUrls[index] = value
        setSecondaryUrls(newUrls)
    }

    const runAnalysis = async () => {
        if (!selectedArticleId) {
            setError('Please select a primary article.')
            return
        }

        const validUrls = secondaryUrls.filter(u => u.trim().length > 0)
        if (validUrls.length === 0) {
            setError('Please add at least one secondary source URL.')
            return
        }

        setAnalyzing(true)
        setError('')
        setReport(null)

        try {
            // 1. Ingest all URLs first
            const ingestedIds = []
            for (const url of validUrls) {
                const res = await fetch('/api/ingest/secondary/social', {
                    method: 'POST',
                    body: JSON.stringify({ url })
                })
                const data = await res.json()
                if (data.article) ingestedIds.push(data.article.id)
                else if (data.id) ingestedIds.push(data.id) // existing
            }

            // 2. Trigger Analysis
            const res = await fetch('/api/engine-b/analyze', {
                method: 'POST',
                body: JSON.stringify({
                    targetArticleId: selectedArticleId,
                    secondaryArticleIds: ingestedIds
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Analysis failed')

            setReport(data.report)

        } catch (e: any) {
            setError(e.message)
        } finally {
            setAnalyzing(false)
        }
    }

    return (
        <div className="space-y-8">
            <div className="pb-6 border-b border-white/5">
                <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    <Microscope className="w-8 h-8 text-indigo-500" />
                    Discourse Analysis <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded border border-indigo-500/20">ENGINE B</span>
                </h1>
                <p className="text-slate-400">Analyze how primary events are framed by secondary sources.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* CONFIGURATION */}
                <div className="space-y-6">
                    <div className="glass-panel p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">1. Select Primary Event</h2>
                        <select
                            className="input bg-black/40"
                            value={selectedArticleId}
                            onChange={(e) => setSelectedArticleId(e.target.value)}
                        >
                            <option value="">-- Select an Article --</option>
                            {articles.map(a => (
                                <option key={a.id} value={a.id}>
                                    {a.headline} ({new Date(a.publishedAt).toLocaleDateString()})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="glass-panel p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">2. Add Secondary Sources</h2>
                        <p className="text-xs text-slate-500 mb-3">Paste URLs from Bluesky posts, Reddit threads, or Opinion articles.</p>

                        <div className="space-y-3">
                            {secondaryUrls.map((url, idx) => (
                                <div key={idx} className="flex gap-2">
                                    <input
                                        type="url"
                                        className="input"
                                        placeholder="https://bsky.app/..."
                                        value={url}
                                        onChange={(e) => handleUrlChange(idx, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                        <button onClick={handleAddUrl} className="mt-3 text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                            <Plus className="w-4 h-4" /> Add another URL
                        </button>
                    </div>

                    <button
                        onClick={runAnalysis}
                        disabled={analyzing}
                        className="btn-primary w-full bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20"
                    >
                        {analyzing ? 'Running Analysis...' : 'Run Discourse Analysis'}
                    </button>

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">
                            {error}
                        </div>
                    )}
                </div>

                {/* RESULTS */}
                <div className="space-y-6">
                    {report ? (
                        <div className="glass-panel p-6 animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-white">Analysis Report</h2>
                                <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-xs font-mono border border-green-500/20">COMPLETE</span>
                            </div>

                            <div className="bg-white/5 rounded-lg p-4 mb-6">
                                <h3 className="text-sm uppercase tracking-wider text-slate-400 mb-2 font-bold">Bias Landscape</h3>
                                <p className="text-slate-200 leading-relaxed">{report.biasAnalysis}</p>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-sm uppercase tracking-wider text-slate-400 mb-2 font-bold">Key Fallacies Detected</h3>
                                {(report.fallaciesDetected || []).map((f: any, i: number) => (
                                    <div key={i} className="p-4 border border-white/5 rounded-lg hover:bg-white/5 transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-mono text-red-400 text-sm">{f.name}</span>
                                            <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${f.severity === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                                {f.severity} Severity
                                            </span>
                                        </div>
                                        <p className="text-slate-300 text-sm italic mb-2">"{f.quote}"</p>
                                        <p className="text-slate-500 text-xs">{f.explanation}</p>
                                        <div className="mt-2 text-[10px] text-slate-600 border-t border-white/5 pt-2">
                                            Source: {f.sourceTitle}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] glass-panel flex flex-col items-center justify-center text-slate-500 border-dashed border-2 border-white/5">
                            <Microscope className="w-16 h-16 mb-4 opacity-20" />
                            <p>Configure analysis to see results</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

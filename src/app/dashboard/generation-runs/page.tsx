'use client'

import { useState, useEffect } from 'react'

interface GenerationRun {
    id: string
    articleId: string | null
    task: string
    providerId: string
    promptId: string
    input: any
    output: any
    tokensUsed: number | null
    costUsd: string | null
    durationMs: number | null
    status: string
    errorMessage: string | null
    createdAt: string
}

/**
 * Generation Runs Inspector
 *
 * Purpose: Full transparency into what your AI is doing
 * Features:
 * - View all generation runs (discovery, writing, etc.)
 * - Filter by task type and status
 * - Inspect raw AI responses
 * - See input prompts vs output results
 * - View timing and costs
 * - See errors with full context
 */
export default function GenerationRunsPage() {
    // Data state
    const [runs, setRuns] = useState<GenerationRun[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Filter state
    const [taskFilter, setTaskFilter] = useState<string>('')
    const [statusFilter, setStatusFilter] = useState<string>('')

    // Detail view state
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

    useEffect(() => {
        loadRuns()
    }, [taskFilter, statusFilter])

    async function loadRuns() {
        const startTime = Date.now()
        console.log('[generation-runs] Loading runs...')

        try {
            setLoading(true)
            setError(null)

            const params = new URLSearchParams()
            if (taskFilter) params.append('task', taskFilter)
            if (statusFilter) params.append('status', statusFilter)

            const res = await fetch(`/api/admin/generation-runs?${params.toString()}`)

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || data.details || `Failed to load runs: ${res.status}`)
            }

            const data = await res.json()
            setRuns(data.runs || [])

            const elapsed = Date.now() - startTime
            console.log(`[generation-runs] Loaded ${data.runs?.length || 0} runs in ${elapsed}ms`)
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error'
            console.error('[generation-runs] Load error:', err)
            setError(`Failed to load generation runs: ${errorMsg}`)
        } finally {
            setLoading(false)
        }
    }

    const selectedRun = selectedRunId ? runs.find(r => r.id === selectedRunId) : null

    // ========== RENDER ==========

    if (loading) {
        return (
            <div className="max-w-6xl">
                <div className="text-center py-12 text-slate-400">
                    <div className="inline-block animate-pulse mr-2">⏳</div>
                    Loading generation runs...
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-6xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Generation Runs</h1>
                    <p className="text-slate-400">
                        Inspect all AI-generated content with full transparency
                    </p>
                </div>
                <button
                    onClick={() => {
                        loadRuns()
                    }}
                    className="px-4 py-2 bg-white/10 text-white rounded hover:bg-white/20 transition-colors"
                >
                    🔄 Refresh
                </button>
            </div>

            {/* Status Messages */}
            {error && (
                <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded text-red-300 whitespace-pre-wrap">
                    {error}
                    <button
                        onClick={() => loadRuns()}
                        className="ml-4 px-2 py-1 bg-red-500/30 hover:bg-red-500/50 rounded text-sm"
                    >
                        Try again
                    </button>
                </div>
            )}

            {/* Filters */}
            <div className="mb-6 flex gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Task</label>
                    <select
                        value={taskFilter}
                        onChange={(e) => setTaskFilter(e.target.value)}
                        className="px-3 py-2 bg-black border border-white/20 rounded text-white text-sm"
                    >
                        <option value="">All tasks</option>
                        <option value="discovery">Discovery</option>
                        <option value="writing">Writing</option>
                        <option value="editing">Editing</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-black border border-white/20 rounded text-white text-sm"
                    >
                        <option value="">All statuses</option>
                        <option value="success">Success</option>
                        <option value="error">Error</option>
                    </select>
                </div>

                <div className="flex items-end">
                    <span className="text-sm text-slate-400">
                        {runs.length} run{runs.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            {/* Main Layout */}
            <div className="flex gap-6">
                {/* List */}
                <div className="flex-1">
                    <div className="space-y-2">
                        {runs.length === 0 && (
                            <div className="text-center py-12 text-slate-500">No generation runs yet</div>
                        )}

                        {runs.map((run) => (
                            <div
                                key={run.id}
                                onClick={() => setSelectedRunId(run.id)}
                                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                                    selectedRunId === run.id
                                        ? 'bg-primary-500/20 border-primary-500/50'
                                        : 'bg-white/5 border-white/10 hover:border-white/20'
                                }`}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <div className="font-medium text-white">
                                            {run.task.charAt(0).toUpperCase() + run.task.slice(1)}
                                        </div>
                                        <div className="text-xs text-slate-500 font-mono">
                                            {new Date(run.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                    <span
                                        className={`text-xs px-2 py-1 rounded font-medium ${
                                            run.status === 'success'
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-red-500/20 text-red-400'
                                        }`}
                                    >
                                        {run.status.toUpperCase()}
                                    </span>
                                </div>

                                <div className="text-sm text-slate-400">
                                    {run.durationMs && <span>{run.durationMs}ms</span>}
                                    {run.tokensUsed && <span className="ml-3">tokens: {run.tokensUsed}</span>}
                                    {run.costUsd && <span className="ml-3">${run.costUsd}</span>}
                                </div>

                                {run.errorMessage && (
                                    <div className="mt-2 text-xs text-red-400 line-clamp-2">{run.errorMessage}</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Detail Panel */}
                {selectedRun && (
                    <div className="flex-1 sticky top-8 h-fit">
                        <div className="bg-white/5 border border-white/10 rounded-lg p-6 max-h-[80vh] overflow-y-auto">
                            <div className="flex items-start justify-between mb-6">
                                <h2 className="text-lg font-bold text-white">Run Details</h2>
                                <button
                                    onClick={() => setSelectedRunId(null)}
                                    className="text-slate-400 hover:text-white"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Metadata */}
                            <div className="mb-6 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Task:</span>
                                    <span className="text-white font-mono">{selectedRun.task}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Status:</span>
                                    <span
                                        className={
                                            selectedRun.status === 'success'
                                                ? 'text-green-400'
                                                : 'text-red-400'
                                        }
                                    >
                                        {selectedRun.status.toUpperCase()}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Duration:</span>
                                    <span className="text-white font-mono">
                                        {selectedRun.durationMs ? `${selectedRun.durationMs}ms` : 'N/A'}
                                    </span>
                                </div>
                                {selectedRun.tokensUsed && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Tokens:</span>
                                        <span className="text-white font-mono">{selectedRun.tokensUsed}</span>
                                    </div>
                                )}
                                {selectedRun.costUsd && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Cost:</span>
                                        <span className="text-white font-mono">${selectedRun.costUsd}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Created:</span>
                                    <span className="text-white font-mono text-xs">
                                        {new Date(selectedRun.createdAt).toLocaleString()}
                                    </span>
                                </div>
                                {selectedRun.articleId && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Article ID:</span>
                                        <span className="text-blue-400 font-mono text-xs">{selectedRun.articleId}</span>
                                    </div>
                                )}
                            </div>

                            {/* Error Message */}
                            {selectedRun.errorMessage && (
                                <div className="mb-6 p-3 bg-red-500/20 border border-red-500/50 rounded">
                                    <div className="text-xs font-medium text-red-400 mb-2">ERROR</div>
                                    <div className="text-sm text-red-300 font-mono whitespace-pre-wrap break-words">
                                        {selectedRun.errorMessage}
                                    </div>
                                </div>
                            )}

                            {/* Input */}
                            {selectedRun.input && (
                                <div className="mb-6">
                                    <div className="text-xs font-medium text-slate-400 mb-2">INPUT</div>
                                    <div className="bg-black/30 rounded p-3 text-xs text-slate-300 font-mono max-h-48 overflow-y-auto whitespace-pre-wrap break-words">
                                        {typeof selectedRun.input === 'string'
                                            ? selectedRun.input
                                            : JSON.stringify(selectedRun.input, null, 2)}
                                    </div>
                                </div>
                            )}

                            {/* Output */}
                            {selectedRun.output && (
                                <div className="mb-6">
                                    <div className="text-xs font-medium text-slate-400 mb-2">OUTPUT (PARSED)</div>
                                    <div className="bg-black/30 rounded p-3 text-xs text-slate-300 font-mono max-h-48 overflow-y-auto whitespace-pre-wrap break-words">
                                        {typeof selectedRun.output === 'string'
                                            ? selectedRun.output
                                            : (() => {
                                                  const output = selectedRun.output
                                                  // Remove rawResponse from display for clarity
                                                  const { rawResponse, ...parsed } = output
                                                  return JSON.stringify(parsed, null, 2)
                                              })()}
                                    </div>
                                </div>
                            )}

                            {/* Raw Response */}
                            {selectedRun.output?.rawResponse && (
                                <div className="mb-6">
                                    <div className="text-xs font-medium text-slate-400 mb-2">RAW RESPONSE (FROM AI)</div>
                                    <div className="bg-black/30 rounded p-3 text-xs text-slate-300 font-mono max-h-48 overflow-y-auto whitespace-pre-wrap break-words">
                                        {selectedRun.output.rawResponse}
                                    </div>
                                </div>
                            )}

                            {/* JSON View Toggle */}
                            {(selectedRun.input || selectedRun.output) && (
                                <div className="text-xs text-slate-500 border-t border-white/10 pt-4">
                                    💡 Tip: Use your browser's DevTools (F12) to inspect the full JSON with formatting
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

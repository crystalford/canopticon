'use client'

import { useState, useEffect } from 'react'

/**
 * Content Source Type
 * Represents a source of content (YouTube channel, news search, RSS feed, Bluesky account)
 *
 * Flow:
 * 1. User creates a source (e.g., "CPAC Official" YouTube channel)
 * 2. Source is linked to a workflow (e.g., "cpac-analysis" workflow)
 * 3. When new content detected (webhook or poll), workflow triggers automatically
 * 4. Article is generated and logged to generation_runs
 */
interface ContentSource {
    id: string
    type: 'youtube_channel' | 'news_search' | 'rss_feed' | 'bluesky_account'
    name: string
    config: Record<string, any>
    workflowId: string
    workflowName?: string
    isActive: boolean
    lastTriggeredAt: string | null
    createdAt: string
}

interface Workflow {
    id: string
    task: string
}

/**
 * Content Sources Admin Page
 *
 * Purpose: Manage all content sources (YouTube channels, news feeds, etc.)
 * Users can:
 * - Add new sources
 * - Edit existing sources
 * - Delete sources
 * - Test sources (manually trigger)
 * - View last triggered time
 * - Link to workflows
 *
 * Visual feedback:
 * - Status messages for every action
 * - Clear error messages if something fails
 * - Loading states during API calls
 * - Timestamps for transparency
 */
export default function SourcesPage() {
    const [sources, setSources] = useState<ContentSource[]>([])
    const [workflows, setWorkflows] = useState<Workflow[]>([])
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [testingId, setTestingId] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        name: '',
        type: 'youtube_channel' as const,
        config: { channel_id: '' },
        workflowId: '',
    })

    /**
     * Load all sources and workflows on mount
     * Shows loading state, error state, and success confirmation
     */
    useEffect(() => {
        loadData()
    }, [])

    /**
     * Fetch sources and workflows from API
     * Includes error handling and status messages
     */
    async function loadData() {
        try {
            setLoading(true)
            setError(null)

            const [sourcesRes, workflowsRes] = await Promise.all([
                fetch('/api/admin/content-sources'),
                fetch('/api/admin/workflow-config'),
            ])

            if (!sourcesRes.ok) {
                throw new Error(`Failed to load sources: ${sourcesRes.status}`)
            }
            if (!workflowsRes.ok) {
                throw new Error(`Failed to load workflows: ${workflowsRes.status}`)
            }

            const sourcesData = await sourcesRes.json()
            const workflowsData = await workflowsRes.json()

            setSources(sourcesData.sources || [])
            setWorkflows(workflowsData.configs || [])

            // Set default workflow if available
            if (workflowsData.configs?.length > 0 && !formData.workflowId) {
                setFormData((f) => ({ ...f, workflowId: workflowsData.configs[0].id }))
            }

            setLoading(false)
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error loading data'
            setError(`❌ Error loading content sources: ${errorMsg}`)
            setLoading(false)
            console.error('Load data error:', err)
        }
    }

    /**
     * Create or update a content source
     * Validates form data and shows clear error/success messages
     */
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setSuccessMessage(null)

        try {
            // Validation
            if (!formData.name.trim()) {
                setError('❌ Source name is required')
                return
            }
            if (!formData.workflowId) {
                setError('❌ You must select a workflow')
                return
            }

            // For YouTube, validate channel_id is provided
            if (formData.type === 'youtube_channel' && !formData.config.channel_id) {
                setError('❌ YouTube channel ID is required')
                return
            }

            const url = editingId
                ? `/api/admin/content-sources?id=${editingId}`
                : '/api/admin/content-sources'
            const method = editingId ? 'PATCH' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || `Request failed: ${res.status}`)
            }

            setShowForm(false)
            setEditingId(null)
            setFormData({
                name: '',
                type: 'youtube_channel',
                config: { channel_id: '' },
                workflowId: workflows[0]?.id || '',
            })
            setSuccessMessage(
                `✅ ${editingId ? 'Source updated' : 'Source created'} successfully!`
            )

            await loadData()
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error'
            setError(`❌ Failed to save source: ${errorMsg}`)
            console.error('Submit error:', err)
        }
    }

    /**
     * Delete a content source
     * Requires confirmation and shows status messages
     */
    async function handleDelete(id: string, name: string) {
        if (!confirm(`Delete source "${name}"? This cannot be undone.`)) return

        try {
            setError(null)
            const res = await fetch(`/api/admin/content-sources?id=${id}`, {
                method: 'DELETE',
            })

            if (!res.ok) {
                throw new Error(`Delete failed: ${res.status}`)
            }

            setSuccessMessage(`✅ Source "${name}" deleted successfully`)
            await loadData()
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error'
            setError(`❌ Failed to delete source: ${errorMsg}`)
            console.error('Delete error:', err)
        }
    }

    /**
     * Test a source by manually triggering its workflow
     * Shows real-time status as the workflow runs
     */
    async function handleTest(id: string, name: string, task: string) {
        try {
            setError(null)
            setSuccessMessage(null)
            setTestingId(id)

            setSuccessMessage(`🔄 Testing source "${name}"...`)

            const res = await fetch(`/api/workflows/${task}`, {
                method: 'POST',
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || data.details || `Request failed: ${res.status}`)
            }

            setSuccessMessage(
                `✅ Source test successful!\n\n` +
                `Article: ${data.data.article.headline}\n` +
                `Generation Run ID: ${data.generationRunId}`
            )
            await loadData()
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error'
            setError(
                `❌ Source test failed: ${errorMsg}\n\n` +
                `Check that the workflow is properly configured and the source has valid content.`
            )
            console.error('Test error:', err)
        } finally {
            setTestingId(null)
        }
    }

    /**
     * Format timestamp for display
     */
    function formatDate(date: string | null): string {
        if (!date) return 'Never'
        return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString()
    }

    /**
     * Get workflow name from ID
     */
    function getWorkflowName(id: string): string {
        return workflows.find((w) => w.id === id)?.task || 'Unknown'
    }

    // ========== RENDER ==========

    if (loading) {
        return (
            <div className="max-w-4xl">
                <div className="text-center py-12 text-slate-400">
                    🔄 Loading content sources...
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Content Sources</h1>
                    <p className="text-slate-400">
                        Manage YouTube channels, news feeds, RSS feeds, and other content sources
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditingId(null)
                        setFormData({
                            name: '',
                            type: 'youtube_channel',
                            config: { channel_id: '' },
                            workflowId: workflows[0]?.id || '',
                        })
                        setShowForm(true)
                    }}
                    className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors font-medium"
                >
                    + Add Source
                </button>
            </div>

            {/* Status Messages */}
            {error && (
                <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded text-red-300 whitespace-pre-wrap">
                    {error}
                </div>
            )}
            {successMessage && (
                <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded text-green-300 whitespace-pre-wrap">
                    {successMessage}
                </div>
            )}

            {/* Add/Edit Form */}
            {showForm && (
                <div className="mb-8 p-6 bg-white/5 rounded-lg border border-white/10">
                    <h2 className="text-lg font-bold text-white mb-4">
                        {editingId ? 'Edit Source' : 'Add New Source'}
                    </h2>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Source Name
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white"
                                placeholder="e.g. CPAC Official"
                                required
                            />
                            <p className="text-xs text-slate-500 mt-1">Human-readable name for this source</p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Source Type
                            </label>
                            <select
                                value={formData.type}
                                onChange={(e) => {
                                    const type = e.target.value as any
                                    setFormData({
                                        ...formData,
                                        type,
                                        config: getDefaultConfig(type),
                                    })
                                }}
                                className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white"
                            >
                                <option value="youtube_channel">YouTube Channel</option>
                                <option value="news_search">News Search</option>
                                <option value="rss_feed">RSS Feed</option>
                                <option value="bluesky_account">Bluesky Account</option>
                            </select>
                            <p className="text-xs text-slate-500 mt-1">What type of content source is this?</p>
                        </div>

                        {formData.type === 'youtube_channel' && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    YouTube Channel ID
                                </label>
                                <input
                                    type="text"
                                    value={formData.config.channel_id || ''}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            config: { ...formData.config, channel_id: e.target.value },
                                        })
                                    }
                                    className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white font-mono text-sm"
                                    placeholder="e.g. UCxxx..."
                                    required
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Find in YouTube URL: youtube.com/@CPAC or youtube.com/channel/UCxxx
                                </p>
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Linked Workflow
                            </label>
                            <select
                                value={formData.workflowId}
                                onChange={(e) => setFormData({ ...formData, workflowId: e.target.value })}
                                className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white"
                                required
                            >
                                <option value="">Select workflow...</option>
                                {workflows.map((w) => (
                                    <option key={w.id} value={w.id}>
                                        {w.task}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500 mt-1">
                                Which workflow should run when new content is detected?
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors font-medium"
                            >
                                {editingId ? 'Update Source' : 'Create Source'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-4 py-2 bg-white/10 text-white rounded hover:bg-white/20 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Sources List */}
            <div className="space-y-4">
                {sources.length === 0 && !showForm && (
                    <div className="text-center py-12 text-slate-500">
                        No content sources configured yet.
                        <br />
                        Add your first source to start automated content ingestion.
                    </div>
                )}

                {sources.map((source) => (
                    <div
                        key={source.id}
                        className={`p-6 rounded-lg border transition-colors ${
                            source.isActive
                                ? 'bg-white/5 border-white/10'
                                : 'bg-slate-900/30 border-slate-700/50 opacity-60'
                        }`}
                    >
                        {/* Source Header */}
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <h3 className="text-lg font-bold text-white">{source.name}</h3>
                                    <span
                                        className={`text-xs px-2 py-1 rounded ${
                                            source.isActive
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-slate-500/20 text-slate-400'
                                        }`}
                                    >
                                        {source.isActive ? '🟢 Active' : '⭕ Inactive'}
                                    </span>
                                </div>
                                <div className="text-sm text-slate-400">
                                    Type: <span className="capitalize">{source.type.replace('_', ' ')}</span>
                                </div>
                                <div className="text-sm text-slate-400 mt-1">
                                    Workflow:{' '}
                                    <span className="text-primary-400 font-medium">
                                        {getWorkflowName(source.workflowId)}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => handleTest(source.id, source.name, getWorkflowName(source.workflowId))}
                                disabled={testingId === source.id}
                                className="px-3 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 rounded text-sm font-medium"
                            >
                                {testingId === source.id ? '🔄 Testing...' : '🧪 Test'}
                            </button>
                        </div>

                        {/* Source Details */}
                        <div className="bg-black/50 p-3 rounded mb-4 text-xs text-slate-400 font-mono">
                            <div>Created: {formatDate(source.createdAt)}</div>
                            <div>Last Triggered: {formatDate(source.lastTriggeredAt)}</div>
                        </div>

                        {/* Source Config */}
                        {source.type === 'youtube_channel' && source.config.channel_id && (
                            <div className="text-sm text-slate-400 mb-4">
                                Channel ID: <span className="font-mono text-slate-300">{source.config.channel_id}</span>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 text-sm">
                            <button
                                onClick={() => {
                                    setEditingId(source.id)
                                    setFormData({
                                        name: source.name,
                                        type: source.type,
                                        config: source.config,
                                        workflowId: source.workflowId,
                                    })
                                    setShowForm(true)
                                }}
                                className="text-primary-400 hover:text-primary-300"
                            >
                                Edit
                            </button>
                            <button
                                onClick={() => handleDelete(source.id, source.name)}
                                className="text-red-400 hover:text-red-300"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

/**
 * Get default config object based on source type
 * Ensures proper structure for each source type
 */
function getDefaultConfig(type: string): Record<string, any> {
    switch (type) {
        case 'youtube_channel':
            return { channel_id: '' }
        case 'news_search':
            return { keywords: '' }
        case 'rss_feed':
            return { feed_url: '' }
        case 'bluesky_account':
            return { handle: '' }
        default:
            return {}
    }
}

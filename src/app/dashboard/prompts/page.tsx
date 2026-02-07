'use client'

import { useState, useEffect } from 'react'

/**
 * Prompt Definition
 * Templates for AI interactions, used by workflows
 *
 * Fields:
 * - name: Identifier for the prompt (used in UI and lookups)
 * - description: Human-readable explanation
 * - promptText: The actual prompt template sent to AI
 * - variables: Optional placeholders (for writing prompts: {headline}, {summary}, etc.)
 * - isActive: Whether this prompt can be used
 */
interface Prompt {
    id: string
    name: string
    description: string | null
    promptText: string
    variables: string[] | null
    isActive: boolean
    createdAt: string
}

/**
 * Prompts Admin Page
 *
 * Purpose: Create and manage AI prompt templates
 * Features:
 * - Create, edit, delete prompts
 * - Preview prompt text
 * - See variables/placeholders
 * - Full error handling with user-visible messages
 * - Loading states during all operations
 */
export default function PromptsPage() {
    // Data state
    const [allPrompts, setAllPrompts] = useState<Prompt[]>([])

    // UI state
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Feedback state
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        promptText: '',
        variables: '',
    })

    useEffect(() => {
        loadPrompts()
    }, [])

    /**
     * Load all prompts from the database
     */
    async function loadPrompts() {
        const startTime = Date.now()
        console.log('[prompts] Loading prompts...')

        try {
            setLoading(true)
            setError(null)

            const res = await fetch('/api/admin/prompts')

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || data.details || `Failed to load prompts: ${res.status}`)
            }

            const data = await res.json()
            setAllPrompts(data.prompts || [])

            const elapsed = Date.now() - startTime
            console.log(`[prompts] Loaded ${data.prompts?.length || 0} prompts in ${elapsed}ms`)
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error'
            console.error('[prompts] Load error:', err)
            setError(`Failed to load prompts: ${errorMsg}`)
        } finally {
            setLoading(false)
        }
    }

    /**
     * Create or update a prompt
     */
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setSuccessMessage(null)

        // Validation
        if (!formData.name.trim()) {
            setError('Prompt name is required')
            return
        }
        if (!formData.promptText.trim()) {
            setError('Prompt text is required')
            return
        }

        const isEdit = !!editingId
        console.log(`[prompts] ${isEdit ? 'Updating' : 'Creating'} prompt: ${formData.name}`)

        try {
            setSaving(true)

            const variables = formData.variables
                .split(',')
                .map((v) => v.trim())
                .filter((v) => v.length > 0)

            const url = isEdit
                ? `/api/admin/prompts?id=${editingId}`
                : '/api/admin/prompts'

            const res = await fetch(url, {
                method: isEdit ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    description: formData.description || null,
                    promptText: formData.promptText,
                    variables: variables.length > 0 ? variables : null,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || data.details || `Request failed: ${res.status}`)
            }

            console.log(`[prompts] Prompt ${isEdit ? 'updated' : 'created'} successfully`)

            setShowForm(false)
            setEditingId(null)
            setFormData({
                name: '',
                description: '',
                promptText: '',
                variables: '',
            })
            setSuccessMessage(`Prompt "${formData.name}" ${isEdit ? 'updated' : 'created'} successfully!`)

            await loadPrompts()
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error'
            console.error('[prompts] Save error:', err)
            setError(`Failed to save prompt: ${errorMsg}`)
        } finally {
            setSaving(false)
        }
    }

    /**
     * Populate form for editing
     */
    function handleEdit(prompt: Prompt) {
        setFormData({
            name: prompt.name,
            description: prompt.description || '',
            promptText: prompt.promptText,
            variables: prompt.variables?.join(', ') || '',
        })
        setEditingId(prompt.id)
        setShowForm(true)
        setError(null)
        setSuccessMessage(null)
    }

    /**
     * Delete a prompt with confirmation
     */
    async function handleDelete(id: string, name: string) {
        if (!confirm(`Delete prompt "${name}"? This cannot be undone.`)) return

        console.log(`[prompts] Deleting prompt: ${name}`)

        try {
            setError(null)
            setSuccessMessage(null)

            const res = await fetch(`/api/admin/prompts?id=${id}`, {
                method: 'DELETE',
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || `Delete failed: ${res.status}`)
            }

            console.log(`[prompts] Prompt deleted: ${name}`)
            setSuccessMessage(`Prompt "${name}" deleted successfully`)
            await loadPrompts()
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error'
            console.error('[prompts] Delete error:', err)
            setError(`Failed to delete prompt: ${errorMsg}`)
        }
    }

    // ========== RENDER ==========

    if (loading) {
        return (
            <div className="max-w-4xl">
                <div className="text-center py-12 text-slate-400">
                    <div className="inline-block animate-pulse mr-2">⏳</div>
                    Loading prompts...
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Prompts</h1>
                    <p className="text-slate-400">
                        Manage AI prompts for discovery, writing, and content generation
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditingId(null)
                        setFormData({
                            name: '',
                            description: '',
                            promptText: '',
                            variables: '',
                        })
                        setShowForm(true)
                        setError(null)
                        setSuccessMessage(null)
                    }}
                    className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors font-medium"
                >
                    + Add Prompt
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

            {/* Add/Edit Prompt Form */}
            {showForm && (
                <div className="mb-8 p-6 bg-white/5 rounded-lg border border-white/10">
                    <h2 className="text-lg font-bold text-white mb-4">
                        {editingId ? 'Edit Prompt' : 'Add New Prompt'}
                    </h2>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Prompt Name
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white"
                                placeholder="e.g. discovery, writing, cpac-analysis"
                                required
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                A short name to identify this prompt in workflow config
                            </p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Description (optional)
                            </label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white"
                                placeholder="Brief description of what this prompt does"
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Prompt Text
                            </label>
                            <textarea
                                value={formData.promptText}
                                onChange={(e) => setFormData({ ...formData, promptText: e.target.value })}
                                className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white font-mono text-sm min-h-48"
                                placeholder="Enter the prompt text... Use {placeholder} for dynamic values in writing prompts."
                                required
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                The actual text sent to the AI. For writing prompts, use placeholders like {'{headline}'}, {'{summary}'}, {'{topics}'}
                            </p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Variables (optional, comma-separated)
                            </label>
                            <input
                                type="text"
                                value={formData.variables}
                                onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
                                className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white"
                                placeholder="e.g. headline, summary, topics"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                List the placeholders used in this prompt (for documentation)
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors font-medium disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : editingId ? 'Update Prompt' : 'Save Prompt'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowForm(false)
                                    setEditingId(null)
                                }}
                                className="px-4 py-2 bg-white/10 text-white rounded hover:bg-white/20 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Prompts List */}
            <div className="space-y-4">
                {allPrompts.length === 0 && !showForm && (
                    <div className="text-center py-12 text-slate-500">
                        No prompts configured yet.
                        <br />
                        Add your first prompt to use in workflows.
                    </div>
                )}

                {allPrompts.map((prompt) => (
                    <div
                        key={prompt.id}
                        className="p-4 bg-white/5 rounded-lg border border-white/10"
                    >
                        <div className="mb-3">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="font-medium text-white text-lg">
                                        {prompt.name}
                                    </div>
                                    {prompt.description && (
                                        <div className="text-sm text-slate-400 mt-1">
                                            {prompt.description}
                                        </div>
                                    )}
                                </div>
                                <span
                                    className={`text-xs px-2 py-1 rounded ${
                                        prompt.isActive
                                            ? 'bg-green-500/20 text-green-400'
                                            : 'bg-slate-500/20 text-slate-400'
                                    }`}
                                >
                                    {prompt.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>

                        <div className="mb-3 p-3 bg-black/30 rounded border border-white/5">
                            <div className="text-xs text-slate-500 mb-2">
                                Prompt ({prompt.promptText.length} characters):
                            </div>
                            <div className="text-sm text-slate-300 font-mono line-clamp-4 whitespace-pre-wrap">
                                {prompt.promptText}
                            </div>
                        </div>

                        {prompt.variables && prompt.variables.length > 0 && (
                            <div className="mb-3">
                                <div className="text-xs text-slate-500 mb-1">Variables:</div>
                                <div className="flex flex-wrap gap-2">
                                    {prompt.variables.map((variable) => (
                                        <span
                                            key={variable}
                                            className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded font-mono"
                                        >
                                            {'{' + variable + '}'}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 text-sm">
                            <button
                                onClick={() => handleEdit(prompt)}
                                className="text-primary-400 hover:text-primary-300"
                            >
                                Edit
                            </button>
                            <button
                                onClick={() => handleDelete(prompt.id, prompt.name)}
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

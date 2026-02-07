'use client'

import { useState, useEffect } from 'react'

/**
 * Workflow Configuration
 * Links an AI service + prompt together for a specific task
 *
 * Data Flow:
 * 1. User creates workflow (task name, AI service, model, prompt)
 * 2. When triggered, pipeline runner looks up this config
 * 3. Executes the prompt with the configured AI service
 * 4. Logs results to generation_runs table
 */
interface WorkflowConfig {
    id: string
    task: string
    model: string
    serviceId: string
    promptId: string
    serviceName: string
    promptName: string
    createdAt: string
}

interface AIService {
    id: string
    name: string
}

interface Prompt {
    id: string
    name: string
}

/**
 * Workflows Admin Page
 *
 * Purpose: Configure which AI service + prompt to use for each workflow task
 * Features:
 * - Create, edit, delete workflows
 * - Run workflows directly from the UI
 * - See which service and prompt each workflow uses
 * - Full error handling with user-visible messages
 * - Loading states during all operations
 */
export default function WorkflowsPage() {
    // Data state
    const [configs, setConfigs] = useState<WorkflowConfig[]>([])
    const [services, setServices] = useState<AIService[]>([])
    const [prompts, setPrompts] = useState<Prompt[]>([])

    // UI state
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [runningTask, setRunningTask] = useState<string | null>(null)

    // Feedback state
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        task: 'discovery',
        serviceId: '',
        model: '',
        promptId: '',
    })

    useEffect(() => {
        loadData()
    }, [])

    /**
     * Load all data on mount
     * Fetches workflows, services, and prompts in parallel for speed
     */
    async function loadData() {
        const startTime = Date.now()
        console.log('[workflows] Loading data...')

        try {
            setLoading(true)
            setError(null)

            // Fetch all data in parallel for faster loading
            const [configRes, serviceRes, promptRes] = await Promise.all([
                fetch('/api/admin/workflow-config'),
                fetch('/api/admin/ai-services'),
                fetch('/api/admin/prompts'),
            ])

            // Check for errors
            if (!configRes.ok) {
                const data = await configRes.json().catch(() => ({}))
                throw new Error(data.error || data.details || `Failed to load workflows: ${configRes.status}`)
            }
            if (!serviceRes.ok) {
                const data = await serviceRes.json().catch(() => ({}))
                throw new Error(data.error || data.details || `Failed to load AI services: ${serviceRes.status}`)
            }
            if (!promptRes.ok) {
                const data = await promptRes.json().catch(() => ({}))
                throw new Error(data.error || data.details || `Failed to load prompts: ${promptRes.status}`)
            }

            const configData = await configRes.json()
            const serviceData = await serviceRes.json()
            const promptData = await promptRes.json()

            setConfigs(configData.configs || [])
            setServices(serviceData.providers || [])
            setPrompts(promptData.prompts || [])

            // Set default form values if available
            if (serviceData.providers?.length > 0 && !formData.serviceId) {
                setFormData((f) => ({ ...f, serviceId: serviceData.providers[0].id }))
            }
            if (promptData.prompts?.length > 0 && !formData.promptId) {
                setFormData((f) => ({ ...f, promptId: promptData.prompts[0].id }))
            }

            const elapsed = Date.now() - startTime
            console.log(`[workflows] Loaded in ${elapsed}ms - ${configData.configs?.length || 0} workflows`)
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error'
            console.error('[workflows] Load error:', err)
            setError(`Failed to load data: ${errorMsg}`)
        } finally {
            setLoading(false)
        }
    }

    /**
     * Create or update a workflow
     * Validates form and shows clear success/error messages
     */
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setSuccessMessage(null)

        // Validation
        if (!formData.task.trim()) {
            setError('Task name is required')
            return
        }
        if (!formData.serviceId) {
            setError('Please select an AI service')
            return
        }
        if (!formData.model.trim()) {
            setError('Model name is required')
            return
        }
        if (!formData.promptId) {
            setError('Please select a prompt')
            return
        }

        const isEdit = !!editingId
        console.log(`[workflows] ${isEdit ? 'Updating' : 'Creating'} workflow: ${formData.task}`)

        try {
            setSaving(true)

            const url = isEdit
                ? `/api/admin/workflow-config?id=${editingId}`
                : '/api/admin/workflow-config'

            const res = await fetch(url, {
                method: isEdit ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || data.details || `Request failed: ${res.status}`)
            }

            console.log(`[workflows] Workflow ${isEdit ? 'updated' : 'created'} successfully`)

            setShowForm(false)
            setEditingId(null)
            setFormData({
                task: 'discovery',
                serviceId: services[0]?.id || '',
                model: '',
                promptId: prompts[0]?.id || '',
            })
            setSuccessMessage(`Workflow "${formData.task}" ${isEdit ? 'updated' : 'created'} successfully!`)

            await loadData()
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error'
            console.error('[workflows] Save error:', err)
            setError(`Failed to save workflow: ${errorMsg}`)
        } finally {
            setSaving(false)
        }
    }

    /**
     * Populate form for editing
     */
    function handleEdit(config: WorkflowConfig) {
        setFormData({
            task: config.task,
            serviceId: config.serviceId,
            model: config.model,
            promptId: config.promptId,
        })
        setEditingId(config.id)
        setShowForm(true)
        setError(null)
        setSuccessMessage(null)
    }

    /**
     * Delete a workflow with confirmation
     */
    async function handleDelete(id: string, task: string) {
        if (!confirm(`Delete workflow "${task}"? This cannot be undone.`)) return

        console.log(`[workflows] Deleting workflow: ${task}`)

        try {
            setError(null)
            setSuccessMessage(null)

            const res = await fetch(`/api/admin/workflow-config?id=${id}`, {
                method: 'DELETE',
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || `Delete failed: ${res.status}`)
            }

            console.log(`[workflows] Workflow deleted: ${task}`)
            setSuccessMessage(`Workflow "${task}" deleted successfully`)
            await loadData()
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error'
            console.error('[workflows] Delete error:', err)
            setError(`Failed to delete workflow: ${errorMsg}`)
        }
    }

    /**
     * Run a workflow and show detailed results
     */
    async function triggerWorkflow(task: string) {
        console.log(`[workflows] Triggering workflow: ${task}`)

        try {
            setError(null)
            setSuccessMessage(null)
            setRunningTask(task)

            setSuccessMessage(`Running "${task}" workflow...`)

            const startTime = Date.now()
            const res = await fetch(`/api/workflows/${task}`, { method: 'POST' })
            const elapsed = Date.now() - startTime

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || data.details || `Workflow failed: ${res.status}`)
            }

            console.log(`[workflows] Workflow completed in ${elapsed}ms:`, data)

            // Show detailed success message
            const articleInfo = data.data?.article
            setSuccessMessage(
                `Workflow "${task}" completed! (${elapsed}ms)\n\n` +
                (articleInfo
                    ? `Article: "${articleInfo.headline}"\nID: ${articleInfo.id}`
                    : `Generation Run: ${data.generationRunId}`)
            )
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error'
            console.error('[workflows] Run error:', err)
            setError(
                `Workflow "${task}" failed:\n${errorMsg}\n\n` +
                `Check that the AI service has a valid API key and the prompt is configured correctly.`
            )
        } finally {
            setRunningTask(null)
        }
    }

    // ========== RENDER ==========

    if (loading) {
        return (
            <div className="max-w-4xl">
                <div className="text-center py-12 text-slate-400">
                    <div className="inline-block animate-pulse mr-2">⏳</div>
                    Loading workflows...
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Workflows</h1>
                    <p className="text-slate-400">
                        Configure AI service + prompt for each workflow task
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditingId(null)
                        setFormData({
                            task: 'discovery',
                            serviceId: services[0]?.id || '',
                            model: '',
                            promptId: prompts[0]?.id || '',
                        })
                        setShowForm(true)
                        setError(null)
                        setSuccessMessage(null)
                    }}
                    className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors font-medium"
                >
                    + Add Workflow
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

            {/* Prerequisites Warning */}
            {(services.length === 0 || prompts.length === 0) && (
                <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded text-yellow-300">
                    <strong>Setup Required:</strong>
                    {services.length === 0 && <span> Add an AI Service first.</span>}
                    {prompts.length === 0 && <span> Add a Prompt first.</span>}
                </div>
            )}

            {/* Form */}
            {showForm && (
                <div className="mb-8 p-6 bg-white/5 rounded-lg border border-white/10">
                    <h2 className="text-lg font-bold text-white mb-4">
                        {editingId ? 'Edit Workflow' : 'Add New Workflow'}
                    </h2>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Task Name
                            </label>
                            <input
                                type="text"
                                value={formData.task}
                                onChange={(e) => setFormData({ ...formData, task: e.target.value })}
                                className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white"
                                placeholder="e.g. discovery, writing, editing"
                                required
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Used in API route: /api/workflows/[task]
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    AI Service
                                </label>
                                <select
                                    value={formData.serviceId}
                                    onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                                    className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white"
                                    required
                                >
                                    <option value="">Select service...</option>
                                    {services.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Model
                                </label>
                                <input
                                    type="text"
                                    value={formData.model}
                                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                    className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white"
                                    placeholder="e.g. sonar-pro, gpt-4, claude-3"
                                    required
                                />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Prompt
                            </label>
                            <select
                                value={formData.promptId}
                                onChange={(e) => setFormData({ ...formData, promptId: e.target.value })}
                                className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white"
                                required
                            >
                                <option value="">Select prompt...</option>
                                {prompts.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors font-medium disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : editingId ? 'Update Workflow' : 'Save Workflow'}
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

            {/* Workflows List */}
            <div className="space-y-4">
                {configs.length === 0 && !showForm && (
                    <div className="text-center py-12 text-slate-500">
                        No workflows configured yet.
                        <br />
                        Create your first workflow to connect an AI service with a prompt.
                    </div>
                )}

                {configs.map((config) => (
                    <div
                        key={config.id}
                        className="p-4 bg-white/5 rounded-lg border border-white/10"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <div className="font-bold text-white text-lg">{config.task}</div>
                                <div className="text-sm text-slate-400 mt-1">
                                    {config.serviceName} → {config.promptName}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                    Model: <span className="font-mono">{config.model}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => triggerWorkflow(config.task)}
                                disabled={runningTask === config.task}
                                className="px-3 py-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50 rounded text-sm font-medium"
                            >
                                {runningTask === config.task ? '⏳ Running...' : '▶ Run'}
                            </button>
                        </div>

                        <div className="flex gap-2 text-sm">
                            <button
                                onClick={() => handleEdit(config)}
                                className="text-primary-400 hover:text-primary-300"
                            >
                                Edit
                            </button>
                            <button
                                onClick={() => handleDelete(config.id, config.task)}
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

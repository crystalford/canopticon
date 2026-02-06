'use client'

import { useState, useEffect } from 'react'

interface AIService {
    id: string
    name: string
}

interface Prompt {
    id: string
    name: string
}

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

export default function WorkflowsPage() {
    const [configs, setConfigs] = useState<WorkflowConfig[]>([])
    const [services, setServices] = useState<AIService[]>([])
    const [prompts, setPrompts] = useState<Prompt[]>([])
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        task: 'discovery',
        serviceId: '',
        model: '',
        promptId: '',
    })

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        const [configRes, serviceRes, promptRes] = await Promise.all([
            fetch('/api/admin/workflow-config'),
            fetch('/api/admin/ai-services'),
            fetch('/api/admin/prompts'),
        ])

        const configData = await configRes.json()
        const serviceData = await serviceRes.json()
        const promptData = await promptRes.json()

        setConfigs(configData.configs || [])
        setServices(serviceData.providers || [])
        setPrompts(promptData.prompts || [])

        // Set default service and prompt if available
        if (serviceData.providers?.length > 0 && !formData.serviceId) {
            setFormData((f) => ({ ...f, serviceId: serviceData.providers[0].id }))
        }
        if (promptData.prompts?.length > 0 && !formData.promptId) {
            setFormData((f) => ({ ...f, promptId: promptData.prompts[0].id }))
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()

        const url = editingId
            ? `/api/admin/workflow-config?id=${editingId}`
            : '/api/admin/workflow-config'
        const method = editingId ? 'PATCH' : 'POST'

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
        })

        if (res.ok) {
            setShowForm(false)
            setEditingId(null)
            setFormData({
                task: 'discovery',
                serviceId: services[0]?.id || '',
                model: '',
                promptId: prompts[0]?.id || '',
            })
            loadData()
        }
    }

    function handleEdit(config: WorkflowConfig) {
        setFormData({
            task: config.task,
            serviceId: config.serviceId,
            model: config.model,
            promptId: config.promptId,
        })
        setEditingId(config.id)
        setShowForm(true)
    }

    async function handleDelete(id: string) {
        if (!confirm('Delete this workflow config?')) return

        const res = await fetch(`/api/admin/workflow-config?id=${id}`, {
            method: 'DELETE',
        })

        if (res.ok) {
            loadData()
        }
    }

    async function triggerWorkflow(task: string) {
        try {
            const res = await fetch(`/api/workflows/${task}`, { method: 'POST' })
            const data = await res.json()

            if (data.success) {
                alert(`✅ ${task} workflow executed successfully!\\n\\nArticle: ${data.data.article.headline}`)
            } else {
                alert(`❌ Workflow failed: ${data.error}`)
            }
        } catch (error) {
            alert(`Error: ${error}`)
        }
    }

    return (
        <div className="max-w-4xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Workflows
                    </h1>
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
                    }}
                    className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors font-medium"
                >
                    + Add Workflow
                </button>
            </div>

            {/* Form */}
            {showForm && (
                <div className="mb-8 p-6 bg-white/5 rounded-lg border border-white/10">
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Task Name
                            </label>
                            <input
                                type="text"
                                value={formData.task}
                                onChange={(e) =>
                                    setFormData({ ...formData, task: e.target.value })
                                }
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
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            serviceId: e.target.value,
                                        })
                                    }
                                    className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white"
                                    required
                                >
                                    <option value="">Select service...</option>
                                    {services.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
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
                                    onChange={(e) =>
                                        setFormData({ ...formData, model: e.target.value })
                                    }
                                    className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white"
                                    placeholder="e.g. sonar-pro"
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
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        promptId: e.target.value,
                                    })
                                }
                                className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white"
                                required
                            >
                                <option value="">Select prompt...</option>
                                {prompts.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors font-medium"
                            >
                                {editingId ? 'Update Workflow' : 'Save Workflow'}
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
                        No workflows configured. Add your first workflow config.
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
                                className="px-3 py-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded text-sm font-medium"
                            >
                                ▶ Run
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
                                onClick={() => handleDelete(config.id)}
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

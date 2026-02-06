'use client'

import { useState, useEffect } from 'react'

interface Prompt {
    id: string
    name: string
    description: string | null
    promptText: string
    variables: string[] | null
    isActive: boolean
    createdAt: string
}

export default function PromptsPage() {
    const [allPrompts, setAllPrompts] = useState<Prompt[]>([])
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        promptText: '',
        variables: '',
    })

    useEffect(() => {
        loadPrompts()
    }, [])

    async function loadPrompts() {
        const res = await fetch('/api/admin/prompts')
        const data = await res.json()
        setAllPrompts(data.prompts || [])
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()

        const variables = formData.variables
            .split(',')
            .map((v) => v.trim())
            .filter((v) => v.length > 0)

        const url = editingId
            ? `/api/admin/prompts?id=${editingId}`
            : '/api/admin/prompts'
        const method = editingId ? 'PATCH' : 'POST'

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: formData.name,
                description: formData.description || null,
                promptText: formData.promptText,
                variables,
            }),
        })

        if (res.ok) {
            setShowForm(false)
            setEditingId(null)
            setFormData({
                name: '',
                description: '',
                promptText: '',
                variables: '',
            })
            loadPrompts()
        }
    }

    function handleEdit(prompt: Prompt) {
        setFormData({
            name: prompt.name,
            description: prompt.description || '',
            promptText: prompt.promptText,
            variables: prompt.variables?.join(', ') || '',
        })
        setEditingId(prompt.id)
        setShowForm(true)
    }

    async function handleDelete(id: string) {
        if (!confirm('Delete this prompt?')) return

        const res = await fetch(`/api/admin/prompts?id=${id}`, {
            method: 'DELETE',
        })

        if (res.ok) {
            loadPrompts()
        }
    }

    return (
        <div className="max-w-4xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Prompts
                    </h1>
                    <p className="text-slate-400">
                        Manage AI prompts for discovery, writing, and video
                        generation
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
                    }}
                    className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors font-medium"
                >
                    + Add Prompt
                </button>
            </div>

            {/* Add/Edit Prompt Form */}
            {showForm && (
                <div className="mb-8 p-6 bg-white/5 rounded-lg border border-white/10">
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Prompt Name
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        name: e.target.value,
                                    })
                                }
                                className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white"
                                placeholder="e.g. discovery_v1"
                                required
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Description
                            </label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        description: e.target.value,
                                    })
                                }
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
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        promptText: e.target.value,
                                    })
                                }
                                className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white font-mono text-sm min-h-48"
                                placeholder="Enter the prompt text..."
                                required
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Variables (comma-separated)
                            </label>
                            <input
                                type="text"
                                value={formData.variables}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        variables: e.target.value,
                                    })
                                }
                                className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white"
                                placeholder="e.g. story, context, tone"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors font-medium"
                            >
                                {editingId ? 'Update Prompt' : 'Save Prompt'}
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
                        No prompts configured. Add your first prompt to get
                        started.
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
                                    <div className="font-medium text-white">
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
                                Prompt:
                            </div>
                            <div className="text-sm text-slate-300 font-mono line-clamp-3">
                                {prompt.promptText}
                            </div>
                        </div>

                        {prompt.variables && prompt.variables.length > 0 && (
                            <div className="mb-3 flex flex-wrap gap-2">
                                {prompt.variables.map((variable) => (
                                    <span
                                        key={variable}
                                        className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded"
                                    >
                                        {variable}
                                    </span>
                                ))}
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
                                onClick={() => handleDelete(prompt.id)}
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

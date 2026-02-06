'use client'

import { useState, useEffect } from 'react'

interface AIService {
    id: string
    name: string
    provider: string
    isActive: boolean
    createdAt: string
}

export default function AIServicesPage() {
    const [services, setServices] = useState<AIService[]>([])
    const [showForm, setShowForm] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        provider: 'perplexity',
        apiKey: '',
        model: 'sonar-pro',
    })

    useEffect(() => {
        loadServices()
    }, [])

    async function loadServices() {
        const res = await fetch('/api/admin/ai-services')
        const data = await res.json()
        setServices(data.providers || [])
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()

        const res = await fetch('/api/admin/ai-services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: formData.name,
                provider: formData.provider,
                apiKey: formData.apiKey,
                config: { model: formData.model },
            }),
        })

        if (res.ok) {
            setShowForm(false)
            setFormData({ name: '', provider: 'perplexity', apiKey: '', model: 'sonar-pro' })
            loadServices()
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Delete this service?')) return

        const res = await fetch(`/api/admin/ai-services?id=${id}`, {
            method: 'DELETE',
        })

        if (res.ok) {
            loadServices()
        }
    }

    return (
        <div className="max-w-4xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">AI Services</h1>
                    <p className="text-slate-400">
                        Manage your AI API keys (BYOK - Bring Your Own Key)
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors font-medium"
                >
                    + Add Service
                </button>
            </div>

            {/* Add Service Form */}
            {showForm && (
                <div className="mb-8 p-6 bg-white/5 rounded-lg border border-white/10">
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Service Name
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white"
                                placeholder="e.g. Perplexity Production"
                                required
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Service Type
                            </label>
                            <select
                                value={formData.provider}
                                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                                className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white"
                            >
                                <option value="perplexity">Perplexity</option>
                                <option value="openai">ChatGPT (OpenAI)</option>
                                <option value="anthropic">Claude (Anthropic)</option>
                                <option value="google">Gemini (Google)</option>
                            </select>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                API Key
                            </label>
                            <input
                                type="password"
                                value={formData.apiKey}
                                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                                className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white font-mono text-sm"
                                placeholder="sk-..."
                                required
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Model
                            </label>
                            <input
                                type="text"
                                value={formData.model}
                                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white"
                                placeholder="sonar-pro"
                                required
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors font-medium"
                            >
                                Save Service
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

            {/* Services List */}
            <div className="space-y-4">
                {services.length === 0 && !showForm && (
                    <div className="text-center py-12 text-slate-500">
                        No services configured. Add your first AI service to get started.
                    </div>
                )}

                {services.map((service) => (
                    <div
                        key={service.id}
                        className="p-4 bg-white/5 rounded-lg border border-white/10 flex items-center justify-between"
                    >
                        <div>
                            <div className="font-medium text-white">{service.name}</div>
                            <div className="text-sm text-slate-400 capitalize">{service.provider}</div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span
                                className={`text-xs px-2 py-1 rounded ${
                                    service.isActive
                                        ? 'bg-green-500/20 text-green-400'
                                        : 'bg-slate-500/20 text-slate-400'
                                }`}
                            >
                                {service.isActive ? 'Active' : 'Inactive'}
                            </span>
                            <button
                                onClick={() => handleDelete(service.id)}
                                className="text-red-400 hover:text-red-300 text-sm"
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

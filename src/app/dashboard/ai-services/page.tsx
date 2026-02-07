'use client'

import { useState, useEffect } from 'react'

/**
 * AI Service Configuration
 * Stores API keys for different AI providers
 *
 * Data Flow:
 * 1. User adds their API key for a provider (Perplexity, OpenAI, etc.)
 * 2. Key is stored encrypted in database
 * 3. Workflows reference this service to make AI calls
 * 4. Pipeline runner retrieves key and creates AI client
 */
interface AIService {
    id: string
    name: string
    provider: string
    isActive: boolean
    createdAt: string
}

/**
 * AI Services Admin Page
 *
 * Purpose: Manage AI API keys (BYOK - Bring Your Own Key)
 * Features:
 * - Add new AI services with API keys
 * - Delete existing services
 * - See which services are configured
 * - Full error handling with user-visible messages
 * - Loading states during all operations
 */
export default function AIServicesPage() {
    // Data state
    const [services, setServices] = useState<AIService[]>([])

    // UI state
    const [showForm, setShowForm] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Feedback state
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        provider: 'perplexity',
        apiKey: '',
        model: 'sonar-pro',
    })

    useEffect(() => {
        loadServices()
    }, [])

    /**
     * Load all AI services from the database
     */
    async function loadServices() {
        const startTime = Date.now()
        console.log('[ai-services] Loading services...')

        try {
            setLoading(true)
            setError(null)

            const res = await fetch('/api/admin/ai-services')

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || data.details || `Failed to load services: ${res.status}`)
            }

            const data = await res.json()
            setServices(data.providers || [])

            const elapsed = Date.now() - startTime
            console.log(`[ai-services] Loaded ${data.providers?.length || 0} services in ${elapsed}ms`)
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error'
            console.error('[ai-services] Load error:', err)
            setError(`Failed to load AI services: ${errorMsg}`)
        } finally {
            setLoading(false)
        }
    }

    /**
     * Create a new AI service
     */
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setSuccessMessage(null)

        // Validation
        if (!formData.name.trim()) {
            setError('Service name is required')
            return
        }
        if (!formData.apiKey.trim()) {
            setError('API key is required')
            return
        }
        if (!formData.model.trim()) {
            setError('Model name is required')
            return
        }

        console.log(`[ai-services] Creating service: ${formData.name} (${formData.provider})`)

        try {
            setSaving(true)

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

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || data.details || `Request failed: ${res.status}`)
            }

            console.log(`[ai-services] Service created successfully`)

            setShowForm(false)
            setFormData({ name: '', provider: 'perplexity', apiKey: '', model: 'sonar-pro' })
            setSuccessMessage(`AI service "${formData.name}" created successfully!`)

            await loadServices()
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error'
            console.error('[ai-services] Create error:', err)
            setError(`Failed to create AI service: ${errorMsg}`)
        } finally {
            setSaving(false)
        }
    }

    /**
     * Delete an AI service with confirmation
     */
    async function handleDelete(id: string, name: string) {
        if (!confirm(`Delete AI service "${name}"? This cannot be undone.`)) return

        console.log(`[ai-services] Deleting service: ${name}`)

        try {
            setError(null)
            setSuccessMessage(null)

            const res = await fetch(`/api/admin/ai-services?id=${id}`, {
                method: 'DELETE',
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || `Delete failed: ${res.status}`)
            }

            console.log(`[ai-services] Service deleted: ${name}`)
            setSuccessMessage(`AI service "${name}" deleted successfully`)
            await loadServices()
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error'
            console.error('[ai-services] Delete error:', err)
            setError(`Failed to delete AI service: ${errorMsg}`)
        }
    }

    /**
     * Get suggested model based on provider
     */
    function getSuggestedModel(provider: string): string {
        switch (provider) {
            case 'perplexity':
                return 'sonar-pro'
            case 'openai':
                return 'gpt-4-turbo'
            case 'anthropic':
                return 'claude-3-opus-20240229'
            case 'google':
                return 'gemini-1.5-pro'
            default:
                return ''
        }
    }

    // ========== RENDER ==========

    if (loading) {
        return (
            <div className="max-w-4xl">
                <div className="text-center py-12 text-slate-400">
                    <div className="inline-block animate-pulse mr-2">⏳</div>
                    Loading AI services...
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">AI Services</h1>
                    <p className="text-slate-400">
                        Manage your AI API keys (BYOK - Bring Your Own Key)
                    </p>
                </div>
                <button
                    onClick={() => {
                        setShowForm(true)
                        setError(null)
                        setSuccessMessage(null)
                    }}
                    className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors font-medium"
                >
                    + Add Service
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

            {/* Add Service Form */}
            {showForm && (
                <div className="mb-8 p-6 bg-white/5 rounded-lg border border-white/10">
                    <h2 className="text-lg font-bold text-white mb-4">Add New AI Service</h2>
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
                                placeholder="e.g. Perplexity Production, OpenAI Main"
                                required
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                A name to identify this service in workflow configs
                            </p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Provider
                            </label>
                            <select
                                value={formData.provider}
                                onChange={(e) => {
                                    const provider = e.target.value
                                    setFormData({
                                        ...formData,
                                        provider,
                                        model: getSuggestedModel(provider),
                                    })
                                }}
                                className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white"
                            >
                                <option value="perplexity">Perplexity (web search + AI)</option>
                                <option value="openai">OpenAI (GPT-4, GPT-3.5)</option>
                                <option value="anthropic">Anthropic (Claude)</option>
                                <option value="google">Google (Gemini)</option>
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
                                placeholder={formData.provider === 'perplexity' ? 'pplx-...' : 'sk-...'}
                                required
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Your API key is stored securely and never shown again
                            </p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Default Model
                            </label>
                            <input
                                type="text"
                                value={formData.model}
                                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white"
                                placeholder="e.g. sonar-pro, gpt-4-turbo"
                                required
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Model can be overridden in individual workflow configs
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors font-medium disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : 'Save Service'}
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
                        No AI services configured yet.
                        <br />
                        Add your first API key to start using workflows.
                    </div>
                )}

                {services.map((service) => (
                    <div
                        key={service.id}
                        className="p-4 bg-white/5 rounded-lg border border-white/10 flex items-center justify-between"
                    >
                        <div>
                            <div className="font-medium text-white text-lg">{service.name}</div>
                            <div className="text-sm text-slate-400 capitalize">{service.provider}</div>
                            <div className="text-xs text-slate-500 mt-1">
                                Added {new Date(service.createdAt).toLocaleDateString()}
                            </div>
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
                                onClick={() => handleDelete(service.id, service.name)}
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

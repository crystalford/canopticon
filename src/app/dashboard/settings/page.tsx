'use client'

import { useState, useEffect } from 'react'
import { Key, CheckCircle, XCircle } from 'lucide-react'

export default function SettingsPage() {
    const [provider, setProvider] = useState('openai')
    const [status, setStatus] = useState({ openai: false, anthropic: false, grok: false, gemini: false })
    const [inputs, setInputs] = useState({ openai_key: '', anthropic_key: '', grok_key: '', gemini_key: '' })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings')
            const data = await res.json()
            setProvider(data.provider)
            setStatus(data.status)
        } catch (error) {
            console.error('Failed to load settings')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setMessage(null)

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider,
                    openai_key: inputs.openai_key || undefined,
                    anthropic_key: inputs.anthropic_key || undefined,
                    grok_key: inputs.grok_key || undefined,
                    gemini_key: inputs.gemini_key || undefined,
                })
            })

            if (res.ok) {
                setMessage({ type: 'success', text: 'Settings saved successfully' })
                setInputs({ openai_key: '', anthropic_key: '', grok_key: '', gemini_key: '' })
                fetchSettings()
            } else {
                setMessage({ type: 'error', text: 'Failed to save settings' })
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error saving settings' })
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="p-8 text-center text-slate-400">Loading settings...</div>

    return (
        <div className="space-y-8 max-w-4xl">
            <div className="pb-6 border-b border-white/5">
                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">System Settings</h1>
                <p className="text-slate-400 text-sm">Configure AI providers and system parameters.</p>
            </div>

            <form onSubmit={handleSave} className="space-y-8">
                {/* Provider Selection */}
                <div className="glass-panel p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">AI Provider</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { value: 'openai', name: 'OpenAI', desc: 'GPT-4o, GPT-4o-mini' },
                            { value: 'anthropic', name: 'Anthropic', desc: 'Claude 3.5 Sonnet' },
                            { value: 'grok', name: 'xAI (Grok)', desc: 'Grok Beta' },
                            { value: 'gemini', name: 'Google Gemini', desc: 'Gemini 2.5 Flash (FREE)' },
                        ].map(p => (
                            <label key={p.value} className={`
                                cursor-pointer p-4 rounded-lg border-2 transition-all block
                                ${provider === p.value
                                    ? 'border-primary-500 bg-primary-500/10'
                                    : 'border-white/10 hover:border-white/20'}
                            `}>
                                <input
                                    type="radio"
                                    name="provider"
                                    value={p.value}
                                    checked={provider === p.value}
                                    onChange={(e) => setProvider(e.target.value)}
                                    className="sr-only"
                                />
                                <div className="font-medium text-white">{p.name}</div>
                                <div className="text-sm text-slate-400">{p.desc}</div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* API Keys */}
                <div className="glass-panel p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Key className="w-5 h-5 text-primary-400" />
                        API Keys
                    </h3>
                    <p className="text-sm text-slate-400 mb-6">
                        Enter API keys for the providers you wish to use. Keys are encrypted at rest. Leave blank to keep existing keys.
                    </p>

                    <div className="space-y-4">
                        {[
                            { key: 'openai_key', label: 'OpenAI API Key', status: status.openai },
                            { key: 'anthropic_key', label: 'Anthropic API Key', status: status.anthropic },
                            { key: 'grok_key', label: 'xAI API Key', status: status.grok },
                            { key: 'gemini_key', label: 'Gemini API Key', status: status.gemini },
                        ].map(field => (
                            <div key={field.key}>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-slate-300">{field.label}</label>
                                    {field.status ? (
                                        <span className="flex items-center gap-1 text-xs text-green-400">
                                            <CheckCircle className="w-3 h-3" /> Configured
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-xs text-slate-500">
                                            <XCircle className="w-3 h-3" /> Not Set
                                        </span>
                                    )}
                                </div>
                                <input
                                    type="password"
                                    value={inputs[field.key as keyof typeof inputs]}
                                    onChange={(e) => setInputs({ ...inputs, [field.key]: e.target.value })}
                                    placeholder="sk-..."
                                    className="input w-full font-mono text-sm"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex items-center justify-between">
                    {message && (
                        <div className={`px-4 py-2 rounded-lg text-sm ${message.type === 'success'
                            ? 'bg-green-500/10 text-green-300 border border-green-500/20'
                            : 'bg-red-500/10 text-red-300 border border-red-500/20'
                            }`}>
                            {message.text}
                        </div>
                    )}
                    <button type="submit" disabled={saving} className="btn-primary ml-auto">
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </form>
        </div>
    )
}
